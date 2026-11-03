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

describe("Sea Beggars (card #66)", () => {
    it("seizes an undefended Dutch port and places a galleon/regular", () => {
        const G = game();
        G.powers.protestant.cards = ["vq-066"];
        G.spaces.amsterdam.control = "spain";
        G.spaces.amsterdam.land = {};
        G.spaces.antwerp.control = "spain";
        G.spaces.antwerp.unrest = false;

        expect(playCard(G, context(), {cardId: "vq-066", asEvent: true, target: "amsterdam"})).toBeUndefined();

        expect(G.spaces.amsterdam.control).toBe("protestant");
        expect(G.spaces.amsterdam.religion).toBe("protestant");
        expect(G.spaces.amsterdam.land.protestant?.regular).toBe(1);
        expect(G.spaces.amsterdam.naval.protestant?.galleon).toBe(1);
        expect(G.pendingPiracy?.zone).toBe("northSea");
        expect(G.pendingPiracy?.remaining).toBe(3);
    });
});
