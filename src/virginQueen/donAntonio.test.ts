import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Don Antonio of Portugal (card #105)", () => {
    it("adds three influence and resolves Portugal when not allied", () => {
        const G = game();
        G.portugalEntered = true;
        G.minorDiplomacyResolved = G.minorDiplomacyResolved.filter((minor) => minor !== "portugal");
        G.powers.spain.cards = ["vq-105"];
        for (const power of ["ottoman", "spain", "england", "france", "hre", "protestant"] as const) {
            G.minorInfluenceDefaults[power].portugal = power === "spain" ? 1 : 0;
            G.powers[power].influence.portugal = power === "spain" ? 1 : 0;
        }

        expect(playCard(G, context(), {cardId: "vq-105", asEvent: true})).toBeUndefined();

        expect(G.minorDiplomacyResolved).toContain("portugal");
        expect(G.powers.spain.influence.portugal).toBeGreaterThanOrEqual(3);
    });

    it("places three Portuguese regulars when allied", () => {
        const G = game();
        G.portugalEntered = true;
        G.powers.spain.cards = ["vq-105"];
        G.powers.spain.alliedMinors = ["portugal"];
        G.spaces.lisbon.control = "portugal";
        G.spaces.lisbon.land = {};
        G.spaces.lisbon.siege = undefined;

        expect(playCard(G, context(), {cardId: "vq-105", asEvent: true})).toBeUndefined();

        expect(G.spaces.lisbon.land.portugal?.regular).toBe(3);
    });

    it("can place Portuguese regulars in a chosen home space", () => {
        const G = game();
        G.powers.spain.cards = ["vq-105"];
        G.powers.spain.alliedMinors = ["portugal"];
        G.spaces.lisbon.control = "portugal";
        G.spaces.lisbon.land.portugal = {regular: 0, merc: 0, cav: 0};
        G.spaces.oporto.control = "portugal";
        G.spaces.oporto.land.portugal = {regular: 0, merc: 0, cav: 0};

        expect(playCard(G, context(), {cardId: "vq-105", asEvent: true, target: "oporto"})).toBeUndefined();

        expect(G.spaces.oporto.land.portugal?.regular).toBe(3);
        expect(G.spaces.lisbon.land.portugal?.regular).toBe(0);
    });
});
