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

describe("Diplomatic Faux Pas / German Recruitment Curtailed", () => {
    it("removes up to five influence", () => {
        const G = game();
        G.powers.france.cards = ["vq-019"];
        G.powers.spain.influence.venice = 3;
        G.powers.spain.influence.papacy = 2;

        expect(playCard(G, context(), {cardId: "vq-019", asEvent: true, target: "spain"})).toBeUndefined();

        expect(G.powers.spain.influence.venice).toBe(0);
        expect(G.powers.spain.influence.papacy).toBe(0);
    });

    it("lets the HRE choose two spaces", () => {
        const G = game();
        G.powers.hre.cards = ["vq-023"];
        G.spaces.brussels.land.spain = {regular: 1, merc: 2, cav: 0};
        G.spaces.antwerp.land.spain = {regular: 1, merc: 3, cav: 0};
        const hreContext = {...context(), currentPlayer: "4", playerID: "4"} as Ctx;

        expect(playCard(G, hreContext, {cardId: "vq-023", asEvent: true, target: "brussels:antwerp"})).toBeUndefined();

        expect(G.spaces.brussels.land.spain?.merc).toBe(0);
        expect(G.spaces.antwerp.land.spain?.merc).toBe(0);
    });

    it("removes all mercenaries in a space", () => {
        const G = game();
        G.powers.france.cards = ["vq-023"];
        G.spaces.brussels.land.spain = {regular: 1, merc: 3, cav: 0};
        G.spaces.brussels.land.france = {regular: 1, merc: 2, cav: 0};

        expect(playCard(G, context(), {cardId: "vq-023", asEvent: true, target: "brussels"})).toBeUndefined();

        expect(G.spaces.brussels.land.spain?.merc).toBe(0);
        expect(G.spaces.brussels.land.france?.merc).toBe(0);
    });
});
