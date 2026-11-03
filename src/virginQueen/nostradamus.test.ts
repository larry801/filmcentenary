import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {cardById} from "./constant/cards";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Nostradamus' Prophecies (card #63)", () => {
    it("draws and keeps the highest-CP card", () => {
        const G = game();
        G.powers.france.cards = ["vq-063"];
        G.deck = ["vq-020", "vq-021", "vq-022", "vq-023"];
        const best = G.deck.slice().sort((a, b) => (cardById(b).cp ?? 0) - (cardById(a).cp ?? 0))[0];

        expect(playCard(G, context(), {cardId: "vq-063", asEvent: true})).toBeUndefined();

        expect(G.powers.france.cards).toContain(best);
        expect(G.deck).not.toContain(best);
        expect(G.removed).toContain("vq-063");
    });
});
