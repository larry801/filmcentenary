import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {applyPendingCardDraws, setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Muscovy Company (card #29)", () => {
    it("grants England extra draws next year and two years later", () => {
        const G = game();
        G.powers.england.cards = ["vq-029"];
        G.year = 1;

        expect(playCard(G, context(), {cardId: "vq-029", asEvent: true})).toBeUndefined();
        expect(G.pendingCardDraws).toEqual([
            {power: "england", turn: 2, amount: 1},
            {power: "england", turn: 3, amount: 1},
        ]);

        G.year = 2;
        expect(applyPendingCardDraws(G)).toEqual({england: 1});
        expect(G.pendingCardDraws).toHaveLength(1);
        G.year = 3;
        expect(applyPendingCardDraws(G)).toEqual({england: 1});
        expect(G.pendingCardDraws).toHaveLength(0);
    });
});
