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
    it("launches a colonist expedition and grants 3 CP", () => {
        const G = game();
        G.powers.england.cards = ["vq-022"];
        G.powers.england.seaCaptains = ["drake"];
        G.worldCaptains = {};
        G.powers.england.cp = 0;
        const englandContext = {...context(), currentPlayer: "2", playerID: "2"} as Ctx;

        expect(playCard(G, englandContext, {cardId: "vq-022", asEvent: true, target: "drake"})).toBeUndefined();

        expect(G.worldCaptains.drake?.colony).toBe(true);
        expect(G.powers.england.cp).toBe(3);
    });

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
