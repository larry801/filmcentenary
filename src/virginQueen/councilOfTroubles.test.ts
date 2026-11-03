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

describe("Council of Troubles (card #50)", () => {
    it("converts the Netherlands, takes empty Protestant spaces and gives the Protestant a card marker", () => {
        const G = game();
        if (!G.powers.spain.cards.includes("vq-050")) G.powers.spain.cards.push("vq-050");
        G.spaces.brussels.control = "spain";
        G.spaces.brussels.land.spain = {regular: 5, merc: 0, cav: 0};
        G.spaces.utrecht.control = "protestant";
        G.spaces.utrecht.land = {};
        G.spaces.utrecht.religion = "protestant";
        G.spaces.utrecht.unrest = false;

        expect(playCard(G, context(), {cardId: "vq-050", asEvent: true})).toBeUndefined();

        expect(G.powers.protestant.marriageCardModifier).toBe(1);
        expect(G.spaces.utrecht.control).toBe("spain");
        expect(G.log.join("\n")).toContain("Council of Troubles");
    });

    it("does nothing without 5 Spanish units in the Netherlands", () => {
        const G = game();
        if (!G.powers.spain.cards.includes("vq-050")) G.powers.spain.cards.push("vq-050");

        expect(playCard(G, context(), {cardId: "vq-050", asEvent: true})).toBeUndefined();

        expect(G.powers.protestant.marriageCardModifier ?? 0).toBe(0);
        expect(G.log.join("\n")).toContain("fewer than 5 units");
    });
});
