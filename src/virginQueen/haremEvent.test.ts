import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {moveError} from "./movePolicy";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "0",
    playerID: "0",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Sultan's Harem event (card #16)", () => {
    it("grants 5 CP and restricts spending to naval actions", () => {
        const G = game();
        G.powers.ottoman.cards = ["vq-016"];
        G.powers.ottoman.cp = 0;

        expect(playCard(G, context(), {cardId: "vq-016", asEvent: true})).toBeUndefined();

        expect(G.powers.ottoman.cp).toBe(5);
        expect(G.haremImpulse).toBe(G.impulse);
        expect(moveError(G, "recruit", {space: "istanbul", kind: "regular"})).toBeDefined();
    });
});
