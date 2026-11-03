import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {atWar, setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "0",
    playerID: "0",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Ottoman Tribute (card #2)", () => {
    it("takes tribute instead of declaring war when the target has a card", () => {
        const G = game();
        if (!G.powers.ottoman.cards.includes("vq-002")) G.powers.ottoman.cards.push("vq-002");
        G.powers.hre.cards = ["vq-020"];
        G.powers.hre.treasures = [];

        expect(playCard(G, context(), {cardId: "vq-002", asEvent: true, target: "hre"})).toBeUndefined();

        expect(G.powers.hre.cards).toHaveLength(0);
        expect(G.powers.ottoman.cards).toContain("vq-020");
        expect(atWar(G, "ottoman", "hre")).toBe(false);
    });

    it("can demand a treasure instead of a card", () => {
        const G = game();
        if (!G.powers.ottoman.cards.includes("vq-002")) G.powers.ottoman.cards.push("vq-002");
        G.powers.hre.cards = ["vq-020"];
        G.powers.hre.treasures = [3];

        expect(playCard(G, context(), {cardId: "vq-002", asEvent: true, target: "hre:treasure"})).toBeUndefined();

        expect(G.powers.hre.cards).toContain("vq-020");
        expect(G.powers.ottoman.treasures).toContain(3);
    });

    it("declares war and gains 2 CP when the target has nothing to give", () => {
        const G = game();
        if (!G.powers.ottoman.cards.includes("vq-002")) G.powers.ottoman.cards.push("vq-002");
        G.powers.hre.cards = [];
        G.powers.hre.treasures = [];
        const cp = G.powers.ottoman.cp;

        expect(playCard(G, context(), {cardId: "vq-002", asEvent: true, target: "hre"})).toBeUndefined();

        expect(atWar(G, "ottoman", "hre")).toBe(true);
        expect(G.powers.ottoman.cp).toBe(cp + 2);
    });
});
