import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "0",
    playerID: "0",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Sultana Safiye, option 1 (card #98)", () => {
    it("can require a specific card from the target", () => {
        const G = game();
        G.powers.ottoman.ruler = "muradIII";
        G.powers.ottoman.cards = ["vq-098", "vq-020"];
        G.powers.england.cards = ["vq-021", "vq-022"];

        expect(playCard(G, context(), {cardId: "vq-098", asEvent: true, target: "england:vq-022"})).toBeUndefined();

        expect(G.powers.england.cards).toContain("vq-020");
        expect(G.powers.ottoman.cards).toContain("vq-022");
    });

    it("can take the Venice influence option", () => {
        const G = game();
        G.powers.france.cards = ["vq-098"];
        G.powers.france.influence.venice = 0;
        const franceContext = {...context(), currentPlayer: "3", playerID: "3"} as Ctx;

        expect(playCard(G, franceContext, {cardId: "vq-098", asEvent: true, target: "venice"})).toBeUndefined();

        expect(G.powers.france.influence.venice).toBe(2);
        expect(G.minorDiplomacyResolved).toContain("venice");
    });

    it("exchanges a card with another power and draws for England/France", () => {
        const G = game();
        G.powers.ottoman.ruler = "muradIII";
        G.powers.ottoman.cards = ["vq-098", "vq-020"];
        G.powers.england.cards = ["vq-021"];

        expect(playCard(G, context(), {cardId: "vq-098", asEvent: true, target: "england"})).toBeUndefined();

        expect(G.powers.england.cards).toContain("vq-020");
        expect(G.powers.ottoman.cards).toContain("vq-021");
        expect(G.powers.ottoman.cards).toHaveLength(2);
    });
});
