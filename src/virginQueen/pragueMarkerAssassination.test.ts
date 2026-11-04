import {Ctx} from "boardgame.io";
import {POWERS, Power, VQGame} from "./constant/general";
import {assassinationTargets, espionageOptions, espionageDice} from "./espionage";
import {assassinate, playCard} from "./moves";
import {patronById} from "./scenario";
import {rulerStats, setupGame} from "./util";

/**
 * #35 residual: Rudolf II assassination must be reachable, must remove the
 * Prague marker, must apply the HRE 1/0 penalty, and must not let Patron of
 * Arts re-place the marker afterwards.  Both royal id spellings are covered.
 */

/** Deterministic die queue; successful assassination needs attack-defense >= 2. */
const context = (p: Power = "spain", values: number[] = []): Ctx => ({
    currentPlayer: String(POWERS.indexOf(p)), playerID: String(POWERS.indexOf(p)), phase: "action", numPlayers: 6,
    random: {Die: () => values.shift() ?? 1, Shuffle: (a: unknown[]) => a},
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
} as unknown as Ctx);

const game = (): VQGame => {
    const G = setupGame(context());
    G.year = 3;
    G.impulse = 10;
    G.activePower = "spain";
    for (const p of POWERS) {
        G.powers[p].cards = [];
        G.powers[p].treasures = [];
        G.powers[p].cp = 20;
    }
    return G;
};

const activePatron = (G: VQGame) =>
    G.patronsAvailable.map((id) => patronById(G, id)).find((patron) => patron?.rating !== null);

/** Answer every pending espionage response with "continue" until done. */
const drainResponses = (G: VQGame) => {
    let guard = 0;
    while (G.pendingEspionage && guard++ < 10) {
        const ids = espionageOptions(G).map((o) => o.id);
        if (!ids.includes("continue")) break;
        const {chooseEspionage} = require("./espionage");
        const {ownerOf} = require("./ownership");
        chooseEspionage(G, {...context(), playerID: ownerOf(G, G.pendingEspionage.responding)!}, {choice: "continue"});
    }
};

describe("#35 Rudolf assassination", () => {
    it("is reachable and kills the canonical rudolf, removing the marker", () => {
        const G = game();
        const patron = activePatron(G);
        expect(patron).toBeDefined();
        G.pragueCulturalCenter = patron!.id;
        G.royals = G.royals.filter((r) => r.id !== "rudolf" && r.id !== "rudolfII");
        G.royals.push({id: "rudolf", name: "Rudolf II", power: "hre", gender: "male", eligibility: 3, alive: true, married: false, status: "available"});
        G.powers.hre.ruler = "rudolf";

        expect(assassinationTargets(G, "spain")).toContain("rudolf");
        // Attack dice: cp 4 -> [6,6,6,6] (4 hits); defense: base 1 + Prague capital +1 = 2 dice -> [1,1] (0 hits); diff 4 -> kill.
        const ctx = context("spain", [6, 6, 6, 6, 1, 1]);
        expect(assassinate(G, ctx, {target: "rudolf", cp: 4})).toBeUndefined();
        drainResponses(G);

        const royal = G.royals.find((r) => r.id === "rudolf");
        expect(royal?.alive).toBe(false);
        expect(G.pragueCulturalCenter).toBeUndefined();
        expect(rulerStats(G, "hre")).toEqual({cardBonus: 0, admin: 1});
        expect(G.log.join("\n")).toContain("Prague Cultural Center marker is removed");
        expect(G.log.join("\n")).toContain("drops to 1 Admin");
        expect(G.assassinationUsed).toContain("spain");
    });

    it("accepts the scenario-book rudolfII id without TypeError", () => {
        const G = game();
        const patron = activePatron(G);
        G.pragueCulturalCenter = patron!.id;
        G.royals = G.royals.filter((r) => r.id !== "rudolf" && r.id !== "rudolfII");
        G.royals.push({id: "rudolfII", name: "Rudolf II", power: "hre", gender: "male", eligibility: 3, alive: true, married: false, status: "available"});
        G.powers.hre.ruler = "rudolfII";

        expect(assassinationTargets(G, "spain")).toContain("rudolfII");
        const ctx = context("spain", [6, 6, 6, 6, 1, 1]);
        expect(() => {
            assassinate(G, ctx, {target: "rudolfII", cp: 4});
            drainResponses(G);
        }).not.toThrow();

        const royal = G.royals.find((r) => r.id === "rudolfII");
        expect(royal?.alive).toBe(false);
        expect(G.pragueCulturalCenter).toBeUndefined();
        expect(rulerStats(G, "hre")).toEqual({cardBonus: 0, admin: 1});
    });

    it("does not let Patron of Arts re-place the marker after Rudolf's death", () => {
        const G = game();
        G.royals = G.royals.filter((r) => r.id !== "rudolf" && r.id !== "rudolfII");
        G.royals.push({id: "rudolf", name: "Rudolf II", power: "hre", gender: "male", eligibility: 3, alive: false, married: false, status: "dead"});
        G.powers.hre.ruler = "rudolf";
        G.powers.hre.cards = ["vq-035"];
        const patron = activePatron(G);
        expect(patron).toBeDefined();

        const ctx = context("hre");
        expect(playCard(G, ctx, {cardId: "vq-035", asEvent: true, target: patron!.id})).toBeUndefined();
        expect(G.pragueCulturalCenter).toBeUndefined();
        expect(G.log.join("\n")).not.toContain("Prague Cultural Center marker is removed");
    });

    it("computes dice without touching a leader table", () => {
        const G = game();
        G.spaces.prague.control = "hre";
        const pending = {kind: "assassination", power: "spain", targetPower: "hre", target: "rudolfII", cp: 4} as never;
        expect(() => espionageDice(G, pending)).not.toThrow();
        // attack = cp 4; defense = base 1 + Prague home bonus 1 = 2.
        expect(espionageDice(G, pending)).toEqual({attack: 4, defense: 2});
    });
});
