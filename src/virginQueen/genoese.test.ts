import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {applyPendingCardDraws, setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Genoese Bankers (card #22)", () => {
    it("draws two and penalizes next year's draw", () => {
        const G = game();
        G.powers.france.cards = ["vq-022"];
        G.year = 1;

        expect(playCard(G, context(), {cardId: "vq-022", asEvent: true})).toBeUndefined();
        expect(G.pendingCardDraws).toEqual([{power: "france", turn: 2, amount: -1}]);

        G.year = 2;
        expect(applyPendingCardDraws(G)).toEqual({france: -1});
    });
});
