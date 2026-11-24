/**
 * Mutation tests for the rule-invariant catalogue.
 *
 * An invariant that never fires is worse than no invariant: it looks like
 * coverage but proves nothing.  Each test takes a *real* mid-game state
 * produced by the seeded self-play harness, injects the single rule violation
 * that invariant exists to catch, and asserts the checker reports it.
 *
 * The state is real rather than hand-built on purpose: a hand-built fixture
 * would only prove the checker agrees with the fixture's shape, while a real
 * state keeps every unrelated zone populated, so a checker that flags the
 * wrong thing (or crashes on a valid state) still shows up.
 *
 * Run explicitly (jest excludes tools/):
 *   npx jest --testPathPatterns "tools/vq-sim/invariantMutation" \
 *     --testPathIgnorePatterns "/node_modules/" --runInBand
 */
import {Ctx} from "boardgame.io";
import {POWERS, Power, Treasure, VQGame} from "../../src/virginQueen/constant/general";
import {SEA_ZONE_BY_ID, SPACE_BY_ID} from "../../src/virginQueen/mapData";
import {ownerOf} from "../../src/virginQueen/ownership";
import {runSeededGame} from "./harness";
import {checkRuleInvariants} from "./invariants";

jest.setTimeout(600000);

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

let mid: VQGame;
let small: VQGame;

const capture = (numPlayers: number, stopAfterTurn: number): VQGame => {
    let last: VQGame | undefined;
    const result = runSeededGame({
        seed: `VQ-MUT-${numPlayers}p`,
        numPlayers,
        chaos: 0.35,
        maxSteps: 6000,
        stopAfterTurn,
        onState: (G) => {
            last = JSON.parse(JSON.stringify(G)) as VQGame;
        },
    });
    if (last === undefined) throw new Error(`no state captured: ${result.issues.map((issue) => issue.detail).join("; ")}`);
    return last;
};

beforeAll(() => {
    mid = capture(6, 2);
    small = capture(2, 1);
});

const ids = (G: VQGame, ctx?: Ctx): string[] => checkRuleInvariants(G, {ctx}).map((violation) => violation.id);

const ownedPairAtPeace = (G: VQGame): [Power, Power] | undefined => {
    const owned = POWERS.filter((power) => ownerOf(G, power) !== undefined);
    for (const a of owned) {
        for (const b of owned) {
            if (a === b) continue;
            if (!G.powers[a].wars.includes(b) && !G.powers[a].allies.includes(b)) return [a, b];
        }
    }
    return undefined;
};

interface Mutation {
    name: string;
    /** Invariant id the checker must report. */
    expect: string;
    mutate: (G: VQGame) => void;
}

const MUTATIONS: Mutation[] = [
    {
        name: "a card occupies two physical zones",
        expect: "cards.single-copy",
        mutate: (G) => {
            const card = [...G.deck, ...G.discard, ...G.futureDeck][0];
            if (card === undefined) throw new Error("no card outside a hand");
            G.powers.france.cards.push(card);
        },
    },
    {
        name: "an unknown card id in the deck",
        expect: "cards.known",
        mutate: (G) => {
            G.deck.push("vq-does-not-exist");
        },
    },
    {
        name: "more treasure counters of one value than the printed mix",
        expect: "treasures.mix",
        mutate: (G) => {
            for (let index = 0; index < 12; index += 1) G.powers.spain.treasures.push(5 as Treasure);
        },
    },
    {
        name: "an impossible treasure value",
        expect: "treasures.values",
        mutate: (G) => {
            G.powers.england.treasures.push(9 as Treasure);
        },
    },
    {
        name: "a negative command point counter",
        expect: "counters.cp",
        mutate: (G) => {
            G.powers.france.cp = -1;
        },
    },
    {
        name: "a fractional influence marker",
        expect: "influence.cap",
        mutate: (G) => {
            G.powers.spain.influence.venice = 12;
        },
    },
    {
        name: "a negative land stack",
        expect: "units.land",
        mutate: (G) => {
            const space = Object.values(G.spaces).find((state) => state.land.spain !== undefined);
            if (space === undefined) throw new Error("Spain has no land on the board");
            space.land.spain!.regular = -2;
        },
    },
    {
        name: "a space that is not on the map",
        expect: "zones.space",
        mutate: (G) => {
            G.spaces.atlantis = clone(G.spaces[SPACE_BY_ID.paris.id]);
        },
    },
    {
        name: "a sea zone that is not on the map",
        expect: "zones.sea",
        mutate: (G) => {
            const id = Object.keys(SEA_ZONE_BY_ID)[0];
            (G.seaZones as Record<string, VQGame["seaZones"][keyof VQGame["seaZones"]]>).middleEarth =
                clone(G.seaZones[id as keyof VQGame["seaZones"]]);
        },
    },
    {
        name: "a leader listed in two places",
        expect: "leaders.single-place",
        mutate: (G) => {
            const entry = Object.entries(G.spaces).find(([, state]) => state.leaders.length > 0);
            if (entry === undefined) throw new Error("no leader on the board");
            const [spaceId, state] = entry;
            const other = Object.keys(G.spaces).find((id) => id !== spaceId);
            if (other === undefined) throw new Error("no second space");
            G.spaces[other].leaders.push(state.leaders[0]);
        },
    },
    {
        name: "a leader whose recorded location is not where it is listed",
        expect: "leaders.location",
        mutate: (G) => {
            const entry = Object.entries(G.spaces).find(([, state]) => state.leaders.length > 0);
            if (entry === undefined) throw new Error("no leader on the board");
            G.leaders[entry[1].leaders[0]].location = "pool";
        },
    },
    {
        name: "naval units in an inland space",
        expect: "naval.port",
        mutate: (G) => {
            const inland = Object.values(SPACE_BY_ID).find((space) => (space.ports ?? []).length === 0);
            if (inland === undefined) throw new Error("no inland space");
            G.spaces[inland.id].naval.spain = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
        },
    },
    {
        name: "a space controlled by nobody",
        expect: "control.valid",
        mutate: (G) => {
            G.spaces.paris.control = "nobody" as never;
        },
    },
    {
        name: "a one-sided war",
        expect: "diplomacy.symmetry",
        mutate: (G) => {
            const pair = ownedPairAtPeace(G);
            if (pair === undefined) throw new Error("every owned pair is already at war or allied");
            G.powers[pair[0]].wars.push(pair[1]);
        },
    },
    {
        name: "three pirates in one sea zone",
        expect: "piracy.zone-cap",
        mutate: (G) => {
            const zone = Object.keys(SEA_ZONE_BY_ID)[0];
            G.piracyZones = {[zone]: ["spain", "france", "england"]};
        },
    },
    {
        name: "two informants on the same power card",
        expect: "espionage.informant",
        mutate: (G) => {
            G.informants.push(
                {owner: "spain", target: "france", neutralized: false, plantedImpulse: G.impulse},
                {owner: "spain", target: "france", neutralized: false, plantedImpulse: G.impulse},
            );
        },
    },
    {
        name: "the same patron type patronized twice in one turn",
        expect: "patronage.once",
        mutate: (G) => {
            G.patronizedThisTurn.push("spain:artist", "spain:artist");
        },
    },
    {
        name: "a siege besieged by a power that is not a major",
        expect: "siege.besieger",
        mutate: (G) => {
            G.spaces.paris.siege = {by: "ottoman", besiegers: ["bavaria" as Power], sinceImpulse: G.impulse};
        },
    },
    {
        name: "a year outside the scenario",
        expect: "turn.year",
        mutate: (G) => {
            G.year = 99;
        },
    },
    {
        name: "more consecutive passes than seats",
        expect: "turn.passes",
        mutate: (G) => {
            G.consecutivePasses = POWERS.length + 3;
        },
    },
    {
        name: "a pending conversion for a power nobody controls",
        expect: "pending.owner",
        mutate: (G) => {
            // `ownerOf` resolves an activated major to its ally's seat, so drop
            // the activation first to reproduce a power with no seat at all.
            const seatless = POWERS.find((power) => {
                if (G.activatedMajors !== undefined) delete G.activatedMajors[power];
                return ownerOf(G, power) === undefined;
            });
            if (seatless === undefined) throw new Error("every power has a controlling seat");
            G.pendingConversion = {power: seatless, side: "protestant", area: "france", dice: [6, 1],
                extraUnrest: 0, unrestOnOnes: false};
        },
    },
    {
        name: "a gameover that names the wrong seat",
        expect: "victory.seat",
        mutate: () => undefined,
    },
    {
        name: "naval counters beyond the printed pool",
        expect: "force.naval",
        mutate: (G) => {
            const zone = Object.keys(G.seaZones)[0] as keyof VQGame["seaZones"];
            const stack = G.seaZones[zone].naval.spain ?? {galley: 0, galleon: 0, racebuilt: 0, corsair: 0};
            stack.galleon += 20;
            G.seaZones[zone].naval.spain = stack;
        },
    },
    {
        name: "land units beyond the printed pool",
        expect: "force.land",
        mutate: (G) => {
            const space = Object.values(G.spaces).find((state) => state.land.france !== undefined);
            if (space === undefined) throw new Error("France has no land on the board");
            space.land.france!.regular += 40;
        },
    },
];

test.each(MUTATIONS.map((mutation) => [mutation.name, mutation] as const))(
    "the catalogue catches %s",
    (_name, mutation) => {
        // Reduced tables are where a pending window can belong to a power with
        // no seat; the full table exercises every other checker.
        const state = clone(mutation.expect === "pending.owner" ? small : mid);
        mutation.mutate(state);
        if (mutation.expect === "victory.seat") {
            // Rule 25 only evaluates a finished match; the corrupted context
            // names a winner that does not own the winning power.
            const ctx = {gameover: {winner: "99", power: "france", reason: "timeLimit"}} as unknown as Ctx;
            expect(ids(state, ctx)).toContain("victory.seat");
            return;
        }
        expect(ids(state)).toContain(mutation.expect);
    },
);

test("the untouched states pass every A-tier invariant", () => {
    // The baseline matters: a mutation test proves nothing if the unmutated
    // state is already failing.  Only A-tier violations count as failure —
    // B-tier entries are rule audits (printed limits the engine representation
    // is deliberately looser than), so they are allowed on a healthy board.
    for (const state of [mid, small]) {
        expect(checkRuleInvariants(state).filter((violation) => violation.tier === "A")).toEqual([]);
    }
});
