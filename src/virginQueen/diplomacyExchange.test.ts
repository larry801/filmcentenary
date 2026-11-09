import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {giveMercenary, giveRandomCard, giveTreasure} from "./moves";
import {setWar, setupGame} from "./util";

const context = (values: number[] = []): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "diplomacy",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 3, Shuffle: (cards: unknown[]) => cards},
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

    it("transfers a random non-home card", () => {
        const G = game();
        G.powers.france.cards = ["vq-020", "vq-036"];
        G.powers.spain.cards = [];

        expect(giveRandomCard(G, context([1]), {target: "spain"})).toBeUndefined();

        expect(G.powers.france.cards).not.toContain("vq-020");
        expect(G.powers.spain.cards).toContain("vq-020");
    });

    it("transfers one mercenary in a selected space", () => {
        const G = game();
        G.spaces.paris.land.france = {regular: 0, merc: 1, cav: 0};

        expect(giveMercenary(G, context(), {target: "spain", space: "paris"})).toBeUndefined();

        expect(G.spaces.paris.land.france).toBeUndefined();
        expect(G.spaces.paris.land.spain?.merc).toBe(1);
    });

    it("cannot transfer to an enemy or with an invalid index", () => {
        const G = game();
        G.powers.france.treasures = [2];
        setWar(G, "france", "spain");
        expect(giveTreasure(G, context(), {target: "spain", index: 0})).toBe(INVALID_MOVE);
        expect(giveTreasure(G, context(), {target: "england", index: 2})).toBe(INVALID_MOVE);
    });

    it("limits random card gifts to 2 per direction per phase", () => {
        const G = game();
        G.diplomacyGifts = {};
        G.powers.france.cards = ["vq-020", "vq-036", "vq-050"];
        G.powers.spain.cards = [];

        expect(giveRandomCard(G, context([1]), {target: "spain"})).toBeUndefined();
        expect(giveRandomCard(G, context([1]), {target: "spain"})).toBeUndefined();
        expect(giveRandomCard(G, context([1]), {target: "spain"})).toBe(INVALID_MOVE);
    });

    it("limits treasure gifts to 2 per direction per phase", () => {
        const G = game();
        G.diplomacyGifts = {};
        G.powers.france.treasures = [1, 2, 3];

        expect(giveTreasure(G, context(), {target: "spain", index: 0})).toBeUndefined();
        expect(giveTreasure(G, context(), {target: "spain", index: 0})).toBeUndefined();
        expect(giveTreasure(G, context(), {target: "spain", index: 0})).toBe(INVALID_MOVE);
    });

    it("limits mercenary gifts to 4 per direction per phase", () => {
        const G = game();
        G.diplomacyGifts = {};
        G.spaces.paris.land.france = {regular: 0, merc: 5, cav: 0};

        expect(giveMercenary(G, context(), {target: "spain", space: "paris"})).toBeUndefined();
        expect(giveMercenary(G, context(), {target: "spain", space: "paris"})).toBeUndefined();
        expect(giveMercenary(G, context(), {target: "spain", space: "paris"})).toBeUndefined();
        expect(giveMercenary(G, context(), {target: "spain", space: "paris"})).toBeUndefined();
        expect(giveMercenary(G, context(), {target: "spain", space: "paris"})).toBe(INVALID_MOVE);
    });

    it("tracks limits per direction independently", () => {
        const G = game();
        G.diplomacyGifts = {};
        G.powers.france.treasures = [1, 2, 3, 4];

        expect(giveTreasure(G, context(), {target: "spain", index: 0})).toBeUndefined();
        expect(giveTreasure(G, context(), {target: "spain", index: 0})).toBeUndefined();
        expect(giveTreasure(G, context(), {target: "spain", index: 0})).toBe(INVALID_MOVE);
        // Different target is still allowed
        expect(giveTreasure(G, context(), {target: "england", index: 0})).toBeUndefined();
    });
});
