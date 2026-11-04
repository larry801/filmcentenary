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

describe("Sir Edward Stafford (card #102)", () => {
    it("automatically discards a non-home card from the target", () => {
        const G = game();
        G.year = 4;
        if (!G.powers.england.cards.includes("vq-102")) G.powers.england.cards.push("vq-102");
        G.powers.spain.cards = ["vq-020", "vq-021"];
        G.powers.spain.treasures = [];

        expect(playCard(G, context([1]), {cardId: "vq-102", asEvent: true, target: "spain"})).toBeUndefined();

        expect(G.powers.spain.cards).toHaveLength(1);
        expect(G.discard.length).toBeGreaterThan(0);
    });

    it("automatically discards a treasure when the target has as many treasures as cards", () => {
        const G = game();
        G.year = 4;
        if (!G.powers.england.cards.includes("vq-102")) G.powers.england.cards.push("vq-102");
        G.powers.spain.cards = ["vq-020"];
        G.powers.spain.treasures = [3];

        expect(playCard(G, context([1]), {cardId: "vq-102", asEvent: true, target: "spain"})).toBeUndefined();

        expect(G.powers.spain.treasures).toEqual([]);
        expect(G.powers.spain.cards).toEqual(["vq-020"]);
    });
});
