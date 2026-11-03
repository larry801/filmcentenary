import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Virgin Queen after Elizabeth's death", () => {
    it("is removed when played for CP", () => {
        const G = game();
        G.powers.england.cards = ["vq-036"];
        const elizabeth = G.royals.find((royal) => royal.id === "elizabeth");
        if (elizabeth !== undefined) elizabeth.alive = false;

        expect(playCard(G, context(), {cardId: "vq-036"})).toBeUndefined();

        expect(G.removed).toContain("vq-036");
    });
});
