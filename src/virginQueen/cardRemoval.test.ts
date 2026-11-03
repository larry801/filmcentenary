import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {resolveUntimelyDeath} from "./cardEvents";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (player = "3"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), numPlayers: 6} as Ctx);

describe("cards leaving play", () => {
    it("removes Grand Tour after the Catholic League has formed, even when played for CP", () => {
        const G = game();
        G.catholicLeagueFormed = true;
        G.powers.france.cards = ["vq-053"];
        G.powers.france.cp = 0;

        expect(playCard(G, context("3"), {cardId: "vq-053"})).toBeUndefined();

        expect(G.removed).toContain("vq-053");
        expect(G.discard).not.toContain("vq-053");
        expect(G.powers.france.cp).toBeGreaterThan(0);
    });

    it("discards Grand Tour normally before the League forms", () => {
        const G = game();
        G.powers.france.cards = ["vq-053"];
        G.powers.france.cp = 0;

        expect(playCard(G, context("3"), {cardId: "vq-053"})).toBeUndefined();

        expect(G.discard).toContain("vq-053");
        expect(G.removed).not.toContain("vq-053");
    });

    it("removes Dragut Falls when Dragut leaves play", () => {
        const G = game();
        expect(G.leaders.dragut).toBeDefined();
        G.deck.push("vq-011");

        resolveUntimelyDeath(G, "dragut");

        expect(G.leaders.dragut).toBeUndefined();
        expect(G.removed).toContain("vq-011");
        expect(G.deck).not.toContain("vq-011");
    });
});
