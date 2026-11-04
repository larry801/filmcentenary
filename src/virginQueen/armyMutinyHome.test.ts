import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
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

describe("Army Mutiny (card #17) home cards", () => {
    it("auto-discards a home card and keeps regulars by its CP", () => {
        const G = game();
        G.powers.france.cards = ["vq-017"];
        G.spaces.brussels.control = "spain";
        G.spaces.brussels.land.spain = {regular: 5, merc: 2, cav: 0};
        // Spanish Road is a Spanish Home card worth 5 CP: the printed event
        // allows discarding a Home card, so it is the automatic discard.
        G.powers.spain.cards = ["vq-003"];
        G.spaces.brussels.unrest = false;

        expect(playCard(G, context(), {cardId: "vq-017", asEvent: true, target: "brussels"})).toBeUndefined();

        expect(G.powers.spain.cards).not.toContain("vq-003");
        expect(G.homeSetAside).toContain("vq-003");
        expect(G.spaces.brussels.land.spain?.merc).toBe(0);
        expect(G.spaces.brussels.land.spain?.regular).toBe(5);
        expect(G.spaces.brussels.unrest).toBe(true);
    });

    it("still refuses to discard a mandatory event card", () => {
        const G = game();
        G.powers.france.cards = ["vq-017"];
        G.spaces.brussels.control = "spain";
        G.spaces.brussels.land.spain = {regular: 5, merc: 2, cav: 0};
        G.powers.spain.cards = ["vq-004"];
        G.spaces.brussels.unrest = false;

        expect(playCard(G, context(), {cardId: "vq-017", asEvent: true, target: "brussels"})).toBeUndefined();

        expect(G.powers.spain.cards).toContain("vq-004");
        expect(G.spaces.brussels.land.spain).toBeUndefined();
    });
});
