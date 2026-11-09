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

        // Rule 9.1: the treasure is drawn at random, not chosen by index.
        expect(G.powers.france.treasures).toHaveLength(1);
        expect(G.powers.spain.treasures).toHaveLength(1);
        expect([...G.powers.france.treasures, ...G.powers.spain.treasures].sort()).toEqual([2, 3]);
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
        // Rule 9.1: received mercenaries are placed in the receiver's capital.
        const capital = G.spaces.madrid.control === "spain" ? "madrid" : "milan";
        expect(G.spaces[capital].land.spain?.merc).toBe(1);
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
        // A different recipient is still allowed (France is at war with
        // England in the campaign setup, so use the HRE here).
        expect(giveTreasure(G, context(), {target: "hre", index: 0})).toBeUndefined();
    });

    it("prevents both powers from giving the same kind of item in one turn", () => {
        const G = game();
        G.diplomacyGifts = {};
        G.powers.france.treasures = [1, 2, 3, 4];
        G.powers.spain.treasures = [5];

        expect(giveTreasure(G, context(), {target: "spain", index: 0})).toBeUndefined();
        expect(giveTreasure(G, {...context(), currentPlayer: "1", playerID: "1"},
            {target: "france", index: 0})).toBe(INVALID_MOVE);
    });

    it("applies the mercenary giving/receiving restrictions", () => {
        const G = game();
        G.diplomacyGifts = {};
        G.spaces.istanbul.land.ottoman = {regular: 0, merc: 1, cav: 0};
        G.spaces.paris.land.france = {regular: 0, merc: 1, cav: 0};
        G.powers.france.wars = G.powers.france.wars.filter((p) => p !== "hre");
        G.powers.hre.wars = G.powers.hre.wars.filter((p) => p !== "france");

        // The Ottoman may not give mercenaries at all.
        expect(giveMercenary(G, {...context(), currentPlayer: "0", playerID: "0"},
            {target: "france", space: "istanbul"})).toBe(INVALID_MOVE);
        // The HRE may not receive mercenaries.
        expect(giveMercenary(G, context("3"), {target: "hre", space: "paris"})).toBe(INVALID_MOVE);
    });
});
