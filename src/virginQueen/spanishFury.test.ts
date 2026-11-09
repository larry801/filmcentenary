import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Spanish Fury (card #46)", () => {
    it("seizes a defender card, draws one, and gives the defender +1 Card", () => {
        const G = game();
        if (!G.powers.spain.cards.includes("vq-046")) G.powers.spain.cards.push("vq-046");
        G.powers.england.cards = ["vq-020", "vq-021"];
        G.lastCapture = {space: "antwerp", attacker: "spain", impulse: G.impulse};

        expect(playCard(G, context(), {cardId: "vq-046", asEvent: true, target: "england"})).toBeUndefined();

        expect(G.powers.england.cards).toHaveLength(1);
        expect(G.powers.england.marriageCardModifier).toBe(1);
        expect(G.powers.spain.cards.some((id) => ["vq-020", "vq-021"].includes(id))).toBe(true);
    });
});
