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

describe("Army Mutiny (card #17)", () => {
    it("removes mercenaries and limits regulars by the discarded card", () => {
        const G = game();
        G.powers.france.cards = ["vq-017"];
        G.spaces.brussels.control = "spain";
        G.spaces.brussels.land.spain = {regular: 5, merc: 2, cav: 0};
        G.powers.spain.cards = ["vq-090"];
        G.spaces.brussels.unrest = false;

        expect(playCard(G, context(), {cardId: "vq-017", asEvent: true, target: "brussels"})).toBeUndefined();

        expect(G.spaces.brussels.land.spain?.merc).toBe(0);
        expect(G.spaces.brussels.land.spain?.regular).toBe(2);
        expect(G.spaces.brussels.unrest).toBe(true);
        expect(G.discard).toContain("vq-090");
    });
});
