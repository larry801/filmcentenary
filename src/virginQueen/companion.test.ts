import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {navigationCheck, setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Drake/Hawkins companion damage", () => {
    it("loses the companion before eliminating the main captain", () => {
        const G = game();
        G.worldCaptains.drake = {power: "england", location: "northAtlantic", damaged: false, colony: false, companion: "hawkins"};

        expect(navigationCheck(G, context(), "drake")).toBe(true);

        expect(G.worldCaptains.drake).toBeDefined();
        expect(G.worldCaptains.drake.companion).toBeUndefined();
    });
});
