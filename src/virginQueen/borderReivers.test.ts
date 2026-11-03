import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Border Reivers (card #41)", () => {
    it("takes a card from another border power", () => {
        const G = game();
        G.powers.england.cards = ["vq-041"];
        G.spaces.york.control = "england";
        G.spaces.edinburgh.control = "france";
        G.powers.france.cards = ["vq-020"];

        expect(playCard(G, context(), {cardId: "vq-041", asEvent: true, target: "france"})).toBeUndefined();

        expect(G.powers.france.cards).toHaveLength(0);
        expect(G.powers.england.cards).toContain("vq-020");
    });

    it("adds four Scottish influence without a target", () => {
        const G = game();
        G.powers.england.cards = ["vq-041"];
        G.powers.england.influence.scotland = 0;

        expect(playCard(G, context(), {cardId: "vq-041", asEvent: true})).toBeUndefined();

        expect(G.powers.england.influence.scotland).toBe(4);
    });
});
