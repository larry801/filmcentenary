import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {dealYear, setupGame} from "./util";

const context = (phase = "action"): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase,
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Conquest of the Philippines (card #49)", () => {
    it("places Spanish control and enables the fifth treasure box", () => {
        const G = game();
        if (!G.powers.spain.cards.includes("vq-049")) G.powers.spain.cards.push("vq-049");
        G.powers.spain.treasures = [2, 3, 4, 5];

        expect(playCard(G, context(), {cardId: "vq-049", asEvent: true})).toBeUndefined();

        expect(G.worldControls.philippines).toBe("spain");
        expect(G.philippinesSpanish).toBe(true);
        expect(G.powers.spain.treasures).toHaveLength(5);
        expect(G.removed).toContain("vq-049");
    });

    it("draws five Spanish treasures at Card Draw once the Philippines are Spanish", () => {
        const G = game();
        G.philippinesSpanish = true;
        G.powers.spain.treasures = [];

        dealYear(G, context("cardDraw"));

        expect(G.powers.spain.treasures).toHaveLength(5);
    });
});
