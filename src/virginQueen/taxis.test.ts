import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "4",
    playerID: "4",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Taxis Family Courier (card #68)", () => {
    it("gives a card to another power and draws one", () => {
        const G = game();
        G.powers.hre.cards = ["vq-068", "vq-020"];
        G.powers.france.cards = [];

        expect(playCard(G, context(), {cardId: "vq-068", asEvent: true, target: "france"})).toBeUndefined();

        expect(G.powers.france.cards).toContain("vq-020");
        expect(G.powers.hre.cards).not.toContain("vq-020");
        expect(G.powers.hre.cards).toHaveLength(1);
        expect(G.lockedCards?.hre).toHaveLength(1);
        expect(G.lockedCards?.hre?.[0]).toBe(G.powers.hre.cards[0]);
    });
});
