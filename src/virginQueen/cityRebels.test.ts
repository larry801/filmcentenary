import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("City State Rebels (card #18)", () => {
    it("wipes out a small garrison and restores the home power", () => {
        const G = game();
        G.powers.england.cards = ["vq-018"];
        G.spaces.rotterdam.control = "france";
        G.spaces.rotterdam.land = {france: {regular: 1, merc: 0, cav: 0}};
        G.leaders.guise = {id: "guise", location: "rotterdam"};
        G.spaces.rotterdam.leaders = ["guise"];

        expect(playCard(G, context(), {cardId: "vq-018", asEvent: true, target: "rotterdam"})).toBeUndefined();

        expect(G.spaces.rotterdam.land.france).toBeUndefined();
        expect(G.spaces.rotterdam.control).toBe("protestant");
        expect(G.spaces.rotterdam.land.protestant?.regular).toBe(1);
        expect(G.leaders.guise.location).toBe("captured");
    });
});
