import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {navalRetreatCandidates} from "./navalCombat";
import {controllersEnemy, removeLandLosses, setWar, setupGame} from "./util";

const context = (die: number, values: number[] = []): Ctx => ({
    currentPlayer: "0",
    playerID: "0",
    phase: "action",
    numPlayers: 6,
    random: {Die: (sides: number) => values.length > 0 ? values.shift()! : die, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (ctx: Ctx = context(3)): VQGame => setupGame({...ctx, phase: "action"} as Ctx);

/**
 * Two defects found by the seeded `tools/vq-sim` sweep during CI.  Both are
 * order/seat bugs that only surface in long self-play games, which is exactly
 * what the property layer exists to find.
 */
describe("naval retreat hostility (rule 16.2 step 9)", () => {
    it("does not crash when a minor or independent fleet is adjacent", () => {
        const G = game();
        // `atWar` compares major powers only; calling it with Venice read
        // `G.powers.venice.wars` and threw.  A minor's fleet is routine in a
        // long game (allied minors patrol their ports), so any naval loss that
        // offered a retreat crashed the reducer.
        G.seaZones.englishChannel.naval.england = {galley: 0, galleon: 2, racebuilt: 0, corsair: 0};
        G.spaces.calais.naval.venice = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        G.spaces.calais.naval.independent = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};

        expect(() => navalRetreatCandidates(G, "englishChannel", ["england"])).not.toThrow();
    });

    it("treats an independent fleet as an enemy", () => {
        const G = game();
        expect(controllersEnemy(G, "england", "independent")).toBe(true);
    });

    it("only treats a minor fleet as an enemy when it is actually hostile", () => {
        const G = game();
        // Rule 16.2 step 9: a *neutral*, non-belligerent fleet does not block a
        // retreat.  Venice is allied to Spain in the campaign set-up, and
        // England is not at war with either, so this is not an enemy fleet.
        expect(controllersEnemy(G, "england", "venice")).toBe(false);

        // Declared war on the minor directly.
        G.powers.england.warsMinors = ["venice"];
        expect(controllersEnemy(G, "england", "venice")).toBe(true);
    });

    it("treats a minor allied to an enemy major as hostile", () => {
        const G = game();
        setWar(G, "england", "spain");
        G.powers.spain.alliedMinors = ["venice"];
        // Venice fights alongside Spain, which is at war with England, so
        // Venice's fleet is an enemy fleet for the retreat rule.
        expect(controllersEnemy(G, "england", "venice")).toBe(true);
    });

    it("never treats a minor allied to the moving power as an enemy", () => {
        const G = game();
        G.powers.england.alliedMinors = ["venice"];
        setWar(G, "england", "spain");
        // Venice fights alongside England itself, so its fleet can never block
        // England's retreat even though England is at war elsewhere.
        expect(controllersEnemy(G, "england", "venice")).toBe(false);
    });
});

describe("allied loss split uses the match RNG (rule 14)", () => {
    const placeTwo = (G: VQGame): void => {
        G.spaces.amiens.land.england = {regular: 4, merc: 0, cav: 0};
        G.spaces.amiens.land.protestant = {regular: 4, merc: 0, cav: 0};
    };

    it("takes the odd loss from one of the defenders", () => {
        const G = game();
        placeTwo(G);
        // One hit over two defenders is an odd loss: exactly one of them loses
        // a unit, chosen by the seeded die rather than `Math.random()`.
        removeLandLosses(G, "amiens", ["england", "protestant"], 1, context(3));
        const english = G.spaces.amiens.land.england!.regular;
        const protestant = G.spaces.amiens.land.protestant!.regular;
        expect(english + protestant).toBe(7);
        expect(Math.min(english, protestant)).toBe(3);
    });

    it("is reproducible: the same seeded ctx yields the same allocation", () => {
        const run = (values: number[]): string => {
            const G = game();
            placeTwo(G);
            removeLandLosses(G, "amiens", ["england", "protestant"], 1, context(3, [...values]));
            return `${G.spaces.amiens.land.england!.regular}/${G.spaces.amiens.land.protestant!.regular}`;
        };
        expect(run([1])).toBe(run([1]));
        // A different seed value picks a different defender, which is what
        // `Math.random()` made impossible to guarantee.
        expect(run([1])).not.toBe(run([2]));
    });
});
