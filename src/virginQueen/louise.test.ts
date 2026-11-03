import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Louise of Lorraine (card #95)", () => {
    it("adds Louise to the marriage pool for the playing power", () => {
        const G = game();
        G.powers.france.cards = ["vq-095"];
        G.royals = G.royals.filter((royal) => royal.id !== "louiseLorraine");

        expect(playCard(G, context(), {cardId: "vq-095", asEvent: true})).toBeUndefined();

        const louise = G.royals.find((royal) => royal.id === "louiseLorraine");
        expect(louise?.power).toBe("france");
        expect(louise?.status).toBe("available");
        expect(G.removed).toContain("vq-095");
    });
});
