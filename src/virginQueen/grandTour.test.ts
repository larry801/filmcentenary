import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setWar, setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Grand Tour (card #53)", () => {
    it("can make peace with a major power", () => {
        const G = game();
        G.powers.france.cards = ["vq-053"];
        G.discard = ["vq-063"];
        setWar(G, "france", "spain");

        expect(playCard(G, context(), {cardId: "vq-053", asEvent: true, target: "peace:spain"})).toBeUndefined();

        expect(G.powers.france.wars).not.toContain("spain");
        expect(G.powers.spain.wars).not.toContain("france");
        expect(G.discard).toContain("vq-063");
    });

    it("can give a specific card to another power", () => {
        const G = game();
        G.powers.france.cards = ["vq-053", "vq-020", "vq-021"];
        G.powers.spain.cards = [];

        expect(playCard(G, context(), {cardId: "vq-053", asEvent: true, target: "give:spain:vq-021"})).toBeUndefined();

        expect(G.powers.spain.cards).toContain("vq-021");
        expect(G.powers.france.cards).toContain("vq-020");
    });

    it("clears French unrest, recovers Nostradamus, and reinforces Paris", () => {
        const G = game();
        G.powers.france.cards = ["vq-053"];
        G.spaces.paris.land.france = {regular: 0, merc: 0, cav: 0};
        G.spaces.paris.unrest = true;
        G.discard = ["vq-063"];

        expect(playCard(G, context(), {cardId: "vq-053", asEvent: true})).toBeUndefined();

        expect(G.spaces.paris.unrest).toBe(false);
        expect(G.powers.france.cards).toContain("vq-063");
        expect(G.spaces.paris.land.france?.regular).toBe(1);
    });
});
