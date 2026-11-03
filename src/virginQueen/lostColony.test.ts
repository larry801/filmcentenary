import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (values: number[]): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context([]), phase: "action"} as Ctx);

const prepare = (G: VQGame): void => {
    if (!G.powers.spain.cards.includes("vq-075")) G.powers.spain.cards.push("vq-075");
    G.worldColonies.atlanticCoast = "spain";
    G.worldControls.atlanticCoast = "spain";
};

describe("Lost Colony (card #75)", () => {
    it("destroys the colony on 1-4", () => {
        const G = game();
        prepare(G);

        expect(playCard(G, context([1]), {cardId: "vq-075", asEvent: true})).toBeUndefined();

        expect(G.worldColonies.atlanticCoast).toBeUndefined();
    });

    it("keeps the colony on 5-6", () => {
        const G = game();
        prepare(G);

        expect(playCard(G, context([5]), {cardId: "vq-075", asEvent: true})).toBeUndefined();

        expect(G.worldColonies.atlanticCoast).toBe("spain");
    });
});
