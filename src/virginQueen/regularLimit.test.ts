import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {recruit} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const clearSpanishRegulars = (G: VQGame): void => {
    for (const space of Object.values(G.spaces)) {
        if (space.land.spain !== undefined) space.land.spain.regular = 0;
    }
    G.powers.spain.cp = 10;
    G.spaces.seville.control = "spain";
    G.spaces.seville.unrest = false;
};

describe("regular counter limit (17.1)", () => {
    it("blocks recruiting beyond the physical regular limit", () => {
        const G = game();
        clearSpanishRegulars(G);
        G.spaces.madrid.land.spain = {regular: 42, merc: 0, cav: 0};

        expect(recruit(G, context(), {space: "seville", kind: "regular"})).toBe(INVALID_MOVE);
    });

    it("allows recruiting up to the limit", () => {
        const G = game();
        clearSpanishRegulars(G);
        G.spaces.madrid.land.spain = {regular: 41, merc: 0, cav: 0};

        expect(recruit(G, context(), {space: "seville", kind: "regular"})).toBeUndefined();
        expect(G.spaces.madrid.land.spain.regular + (G.spaces.seville.land.spain?.regular ?? 0)).toBe(42);
    });
});
