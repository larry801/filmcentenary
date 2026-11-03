import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {worldPiracy} from "./moves";
import {returnWorldCaptains, setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Drake expedition treasure capacity", () => {
    it("carries captured treasure and delivers it at winter", () => {
        const G = game();
        G.worldCaptains.drake = {power: "england", location: "northAtlantic", damaged: false, colony: false, treasureValues: []};
        G.worldControls.atlanticCoast = "spain";
        G.powers.spain.treasures = [3];
        G.powers.england.cp = 10;

        expect(worldPiracy(G, context(), {captain: "drake"})).toBeUndefined();
        expect(G.worldCaptains.drake.treasureValues).toEqual([3]);

        returnWorldCaptains(G);
        expect(G.powers.england.treasures).toContain(3);
    });
});
