import {Ctx} from "boardgame.io";
import {POWERS, Power, VQGame} from "./constant/general";
import {worldPiracy} from "./moves";
import {setupGame} from "./util";

/**
 * Phase 4: world piracy against Portugal (Rule 16.5).  Portugal may be
 * targeted even before it enters play; the allied exemption and the
 * Portuguese galleon / treasure-row capture are exercised here.
 */

const context = (p: Power = "england", values: number[] = [6]): Ctx => ({
    currentPlayer: String(POWERS.indexOf(p)), playerID: String(POWERS.indexOf(p)), phase: "action", numPlayers: 6,
    random: {Die: () => values.shift() ?? 1, Shuffle: (a: unknown[]) => a},
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
} as unknown as Ctx);

const game = (): VQGame => {
    const G = setupGame(context());
    for (const p of POWERS) {
        G.powers[p].cards = [];
        G.powers[p].cp = 20;
        G.powers[p].treasures = [];
    }
    return G;
};

const drakeInGuinea = (G: VQGame) => {
    G.worldCaptains.drake = {power: "england", location: "guineaCoast", damaged: false, colony: false, route: ["guineaCoast"]};
};

describe("world piracy against Portugal", () => {
    it("targets a Portuguese settlement before Portugal enters play when no Spanish settlement is present", () => {
        const G = game();
        drakeInGuinea(G);
        G.portugalEntered = false;
        G.portugueseTreasures = [3, 2];

        expect(worldPiracy(G, context("england", [6, 6, 6, 6]), {captain: "drake"})).toBeUndefined();
        expect(G.powers.england.treasures).toContain(2);
        expect(G.log.join("\n")).toContain("Portuguese");
    });

    it("cannot pirate Portugal when allied with Portugal", () => {
        const G = game();
        drakeInGuinea(G);
        G.powers.england.alliedMinors.push("portugal");

        expect(worldPiracy(G, context(), {captain: "drake"})).toBe("INVALID_MOVE");
    });

    it("counts Portuguese galleons as defense dice", () => {
        const G = game();
        drakeInGuinea(G);
        G.spaces.lisbon.naval.portugal = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        G.spaces.oporto.naval.portugal = {galley: 0, galleon: 0, racebuilt: 0, corsair: 0};
        // Defense rolls first: 1 galleon die [1] -> 0 hits, survives; piracy dice all 6s.
        expect(worldPiracy(G, context("england", [1, 6, 6, 6, 6]), {captain: "drake"})).toBeUndefined();
        expect(G.worldCaptains.drake).toBeDefined();
        expect(G.log.join("\n")).toContain("World piracy defense");
    });

    it("prefers a Spanish settlement when both Spain and Portugal are present", () => {
        const G = game();
        drakeInGuinea(G);
        G.worldControls.guineaCoastColony = "spain";
        G.powers.spain.treasures = [5];

        expect(worldPiracy(G, context("england", [6, 6, 6, 6]), {captain: "drake"})).toBeUndefined();
        expect(G.log.join("\n")).toContain("Spanish");
    });
});
