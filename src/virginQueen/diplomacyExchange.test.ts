import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {giveTreasure} from "./moves";
import {setWar, setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "diplomacy",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("diplomatic treasure exchange (rule 9.1)", () => {
    it("transfers a treasure to another power", () => {
        const G = game();
        G.powers.france.treasures = [2, 3];
        G.powers.spain.treasures = [];

        expect(giveTreasure(G, context(), {target: "spain", index: 0})).toBeUndefined();

        expect(G.powers.france.treasures).toEqual([3]);
        expect(G.powers.spain.treasures).toEqual([2]);
    });

    it("cannot transfer to an enemy or with an invalid index", () => {
        const G = game();
        G.powers.france.treasures = [2];
        setWar(G, "france", "spain");
        expect(giveTreasure(G, context(), {target: "spain", index: 0})).toBe(INVALID_MOVE);
        expect(giveTreasure(G, context(), {target: "england", index: 2})).toBe(INVALID_MOVE);
    });
});
