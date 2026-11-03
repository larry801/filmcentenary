import {Ctx} from "boardgame.io";
import {VQGame, landCount} from "./constant/general";
import {playCard, spanishRoadMove} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Spanish Road (card #3)", () => {
    it("adds a Milan regular and moves a formation without interception", () => {
        const G = game();
        G.spaces.milan.control = "spain";
        G.spaces.milan.land.spain = {regular: 2, merc: 0, cav: 0};
        G.spaces.genoa.control = "spain";
        if (!G.powers.spain.cards.includes("vq-003")) G.powers.spain.cards.push("vq-003");

        expect(playCard(G, context(), {cardId: "vq-003", asEvent: true})).toBeUndefined();
        expect(G.spanishRoadAvailable).toBe(true);
        expect(G.spaces.milan.land.spain.regular).toBe(3);

        expect(spanishRoadMove(G, context(), {to: "genoa", units: {regular: 2}})).toBeUndefined();

        expect(G.spanishRoadAvailable).toBeUndefined();
        expect(landCount(G.spaces.genoa.land.spain)).toBe(3);
        expect(G.spaces.milan.land.spain.regular).toBe(1);
    });
});
