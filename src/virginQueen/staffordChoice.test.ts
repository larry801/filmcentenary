import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (values: number[] = []): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const staffordGame = (): VQGame => {
    const G = game();
    G.year = 4;
    if (!G.powers.england.cards.includes("vq-102")) G.powers.england.cards.push("vq-102");
    return G;
};

describe("Sir Edward Stafford event choices (card #102)", () => {
    it("discards a chosen card instead of automatically discarding a treasure", () => {
        const G = staffordGame();
        G.powers.spain.cards = ["vq-020", "vq-021"];
        G.powers.spain.treasures = [3, 5];

        expect(playCard(G, context([1]), {cardId: "vq-102", asEvent: true, target: "spain:card:vq-021"})).toBeUndefined();

        expect(G.powers.spain.cards).toEqual(["vq-020"]);
        expect(G.powers.spain.treasures).toEqual([3, 5]);
        expect(G.discard).toContain("vq-021");
    });

    it("discards a chosen treasure value instead of automatically discarding a card", () => {
        const G = staffordGame();
        G.powers.spain.cards = ["vq-020", "vq-021", "vq-022"];
        G.powers.spain.treasures = [3, 5];

        expect(playCard(G, context([1]), {cardId: "vq-102", asEvent: true, target: "spain:treasure:5"})).toBeUndefined();

        expect(G.powers.spain.cards).toEqual(["vq-020", "vq-021", "vq-022"]);
        expect(G.powers.spain.treasures).toEqual([3]);
    });

    it("discards only one treasure when the chosen value appears twice", () => {
        const G = staffordGame();
        G.powers.spain.cards = ["vq-020"];
        G.powers.spain.treasures = [5, 5, 3];

        expect(playCard(G, context([1]), {cardId: "vq-102", asEvent: true, target: "spain:treasure:5"})).toBeUndefined();

        expect(G.powers.spain.treasures).toEqual([5, 3]);
        expect(G.powers.spain.cards).toEqual(["vq-020"]);
    });

    it("falls back to automatic selection when the chosen card is unavailable", () => {
        const G = staffordGame();
        G.powers.spain.cards = ["vq-020", "vq-021"];
        G.powers.spain.treasures = [];

        expect(playCard(G, context([1]), {cardId: "vq-102", asEvent: true, target: "spain:card:vq-022"})).toBeUndefined();

        expect(G.powers.spain.cards).toEqual(["vq-021"]);
        expect(G.discard).toContain("vq-020");
    });

    it("falls back to automatic selection when the chosen treasure is unavailable", () => {
        const G = staffordGame();
        G.powers.spain.cards = ["vq-020"];
        G.powers.spain.treasures = [3];

        expect(playCard(G, context([1]), {cardId: "vq-102", asEvent: true, target: "spain:treasure:9"})).toBeUndefined();

        expect(G.powers.spain.treasures).toEqual([]);
        expect(G.powers.spain.cards).toEqual(["vq-020"]);
    });
});
