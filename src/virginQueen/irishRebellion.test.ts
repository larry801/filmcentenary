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

describe("Irish Rebellion (card #57)", () => {
    it("halves the English garrisons and raises Ulster when Ireland allies", () => {
        const G = game();
        if (!G.powers.spain.cards.includes("vq-057")) G.powers.spain.cards.push("vq-057");
        G.minorDiplomacyResolved = G.minorDiplomacyResolved.filter((minor) => minor !== "ireland");
        for (const power of ["ottoman", "spain", "england", "france", "hre", "protestant"] as const) {
            G.powers[power].influence.ireland = 0;
        }
        G.powers.spain.influence.ireland = 9;
        G.spaces.dublin.land.england = {regular: 4, merc: 2, cav: 0};
        G.spaces.kinsale.land.england = {regular: 1, merc: 0, cav: 0};
        G.spaces.ulster.land = {england: {regular: 2, merc: 0, cav: 0}};
        G.spaces.ulster.control = "england";

        expect(playCard(G, context(), {cardId: "vq-057", asEvent: true})).toBeUndefined();

        expect(G.powers.spain.alliedMinors).toContain("ireland");
        expect(G.spaces.dublin.land.england.regular).toBe(2);
        expect(G.spaces.dublin.land.england.merc).toBe(1);
        expect(G.spaces.kinsale.land.england.regular).toBe(0);
        expect(G.spaces.ulster.land.england).toBeUndefined();
        expect(G.spaces.ulster.land.ireland?.regular).toBe(3);
    });
});
