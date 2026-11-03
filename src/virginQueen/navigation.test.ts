import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {moveExpedition} from "./moves";
import {setupGame} from "./util";

const context = (values: number[]): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context([]), phase: "action"} as Ctx);

const prepare = (G: VQGame): void => {
    G.powers.england.cp = 2;
    G.worldCaptains.drake = {power: "england", location: "chileanCoast", damaged: false, colony: false};
};

describe("Navigation Table (rule 16.4)", () => {
    it("eliminates the expedition on 2-6", () => {
        const G = game();
        prepare(G);

        expect(moveExpedition(G, context([1, 2]), {captain: "drake", zone: "southAtlantic"})).toBeUndefined();

        expect(G.worldCaptains.drake).toBeUndefined();
        expect(G.lastRolls).toContain("= 6");
    });

    it("damages the expedition on 7-8", () => {
        const G = game();
        prepare(G);

        expect(moveExpedition(G, context([2, 3]), {captain: "drake", zone: "southAtlantic"})).toBeUndefined();

        expect(G.worldCaptains.drake.location).toBe("southAtlantic");
        expect(G.worldCaptains.drake.damaged).toBe(true);
    });

    it("eliminates an already damaged expedition on a second damaged result", () => {
        const G = game();
        prepare(G);
        G.worldCaptains.drake.damaged = true;

        expect(moveExpedition(G, context([2, 3]), {captain: "drake", zone: "southAtlantic"})).toBeUndefined();

        expect(G.worldCaptains.drake).toBeUndefined();
    });

    it("survives on 9+ and adds the Map Projection bonus", () => {
        const safe = game();
        prepare(safe);
        expect(moveExpedition(safe, context([6, 6]), {captain: "drake", zone: "southAtlantic"})).toBeUndefined();
        expect(safe.worldCaptains.drake.location).toBe("southAtlantic");
        expect(safe.worldCaptains.drake.damaged).toBe(false);

        const projection = game();
        prepare(projection);
        projection.powers.england.scienceBonuses = ["mapProjection"];
        expect(moveExpedition(projection, context([1, 2]), {captain: "drake", zone: "southAtlantic"})).toBeUndefined();
        expect(projection.worldCaptains.drake.damaged).toBe(true);
        expect(projection.lastRolls).toContain("Map Projection");
    });
});
