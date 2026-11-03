import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (player: string): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context("1"), phase: "action"} as Ctx);

describe("Spanish Pay Ships Seized (card #67)", () => {
    it("removes two Spanish Netherlands regulars and draws a card", () => {
        const G = game();
        G.powers.england.cards = ["vq-067"];
        G.spaces.brussels.control = "spain";
        G.spaces.brussels.land.spain = {regular: 2, merc: 0, cav: 0};

        expect(playCard(G, context("2"), {cardId: "vq-067", asEvent: true})).toBeUndefined();

        expect(G.spaces.brussels.land.spain).toBeUndefined();
        expect(G.powers.england.cards).not.toContain("vq-067");
        expect(G.powers.england.cards).toHaveLength(1);
    });

    it("cannot be played by Spain", () => {
        const G = game();
        G.powers.spain.cards = ["vq-067"];
        expect(playCard(G, context("1"), {cardId: "vq-067", asEvent: true})).toBe(INVALID_MOVE);
    });
});
