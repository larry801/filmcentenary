import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {INVALID_MOVE} from "boardgame.io/core";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (values: number[] = [], player = "2"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Beacon Fires (card #14)", () => {
    it("cannot be pre-played as an ordinary event", () => {
        const G = game();
        if (!G.powers.england.cards.includes("vq-014")) G.powers.england.cards.push("vq-014");
        expect(playCard(G, context([], "2"), {cardId: "vq-014", asEvent: true})).toBe(INVALID_MOVE);
        expect(G.powers.england.cards).toContain("vq-014");
    });
});
