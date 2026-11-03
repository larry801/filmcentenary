import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (player: string): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context("1"), phase: "action"} as Ctx);

describe("Tenth Penny (card #69)", () => {
    it("lets Spain take a random Protestant card", () => {
        const G = game();
        G.powers.spain.cards = ["vq-069"];
        G.powers.protestant.cards = ["vq-020"];

        expect(playCard(G, context("1"), {cardId: "vq-069", asEvent: true})).toBeUndefined();

        expect(G.powers.protestant.cards).toHaveLength(0);
        expect(G.powers.spain.cards).toContain("vq-020");
        expect(G.lockedCards?.spain).toContain("vq-020");
        G.powers.spain.cardPlayed = false;
        expect(playCard(G, context("1"), {cardId: "vq-020", asEvent: true, target: "venice"})).toBe("INVALID_MOVE");
    });
});
