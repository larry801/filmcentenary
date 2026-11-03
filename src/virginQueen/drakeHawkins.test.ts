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

describe("Drake / Hawkins Expedition (card #106)", () => {
    it("forms a combined English expedition", () => {
        const G = game();
        G.powers.england.cards = ["vq-106"];
        G.powers.england.seaCaptains = ["drake", "hawkins"];
        G.worldCaptains = {};

        expect(playCard(G, context(), {cardId: "vq-106", asEvent: true})).toBeUndefined();

        expect(G.worldCaptains.drake?.power).toBe("england");
        expect(G.powers.england.seaCaptains).not.toContain("drake");
        expect(G.powers.england.seaCaptains).not.toContain("hawkins");
        expect(G.removed).toContain("vq-106");
    });
});
