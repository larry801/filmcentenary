import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "5",
    playerID: "5",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Jeanne of Navarre (card #58)", () => {
    it("takes Bayonne and adds a Protestant regular", () => {
        const G = game();
        G.powers.protestant.cards = ["vq-058"];
        G.spaces.bayonne.control = "france";
        G.spaces.bayonne.land = {france: {regular: 2, merc: 0, cav: 0}};

        expect(playCard(G, context(), {cardId: "vq-058", asEvent: true})).toBeUndefined();

        expect(G.spaces.bayonne.control).toBe("protestant");
        expect(G.spaces.bayonne.land.france).toBeUndefined();
        expect(G.spaces.bayonne.land.protestant?.regular).toBe(1);
        expect(G.removed).toContain("vq-058");
    });
});
