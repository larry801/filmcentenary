import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {SPACES} from "./mapData";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "5",
    playerID: "5",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Calvinist Zeal (card #32)", () => {
    it("can trigger rebellions in two spaces", () => {
        const G = game();
        G.powers.protestant.cards = ["vq-032"];
        G.spaces.orleans.control = "france";
        G.spaces.orleans.religion = "protestant";
        G.spaces.orleans.siege = undefined;
        G.spaces.antwerp.control = "spain";
        G.spaces.antwerp.religion = "protestant";
        G.spaces.antwerp.siege = undefined;

        expect(playCard(G, context(), {cardId: "vq-032", asEvent: true, target: "double:orleans:antwerp"})).toBeUndefined();

        expect(G.log.filter((line) => line.toLowerCase().includes("rebellion")).length).toBeGreaterThanOrEqual(2);
    });

    it("makes seven attempts in France and the Netherlands", () => {
        const G = game();
        G.powers.protestant.cards = ["vq-032"];
        for (const space of SPACES.filter((def) => def.area === "france" || def.area === "netherlands")) {
            G.spaces[space.id].religion = "catholic";
        }

        expect(playCard(G, context(), {cardId: "vq-032", asEvent: true})).toBeUndefined();

        expect(G.log.filter((line) => line.includes("conversions in")).length).toBe(2);
    });
});
