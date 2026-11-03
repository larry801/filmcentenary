import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("The Black Queen, option 3 (card #80)", () => {
    it("takes a random card from the target", () => {
        const G = game();
        G.powers.france.cards = ["vq-080"];
        G.powers.spain.cards = ["vq-020"];

        expect(playCard(G, context(), {cardId: "vq-080", asEvent: true, target: "spain"})).toBeUndefined();

        expect(G.powers.spain.cards).toHaveLength(0);
        expect(G.powers.france.cards).toContain("vq-020");
    });

    it("can send agents and draw a card", () => {
        const G = game();
        G.powers.france.cards = ["vq-080"];
        const hand = G.powers.france.cards.length;

        expect(playCard(G, context(), {cardId: "vq-080", asEvent: true, target: "agents"})).toBeUndefined();

        expect(G.powers.france.cards).toHaveLength(hand);
        expect(G.log.join("\n")).toContain("sends two agents");
    });

    it("can draw two instead of taking the target's card", () => {
        const G = game();
        G.powers.france.cards = ["vq-080"];
        G.powers.spain.cards = ["vq-020"];
        const hand = G.powers.france.cards.length;

        expect(playCard(G, context(), {cardId: "vq-080", asEvent: true, target: "spain:draw"})).toBeUndefined();

        expect(G.powers.spain.cards).toContain("vq-020");
        expect(G.powers.france.cards).toHaveLength(hand - 1 + 2);
    });

    it("draws two when the target has no card", () => {
        const G = game();
        G.powers.france.cards = ["vq-080"];
        G.powers.spain.cards = [];
        const hand = G.powers.france.cards.length;

        expect(playCard(G, context(), {cardId: "vq-080", asEvent: true, target: "spain"})).toBeUndefined();

        expect(G.powers.france.cards).toHaveLength(hand - 1 + 2);
    });
});
