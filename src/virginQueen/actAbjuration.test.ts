import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {chooseAbjuration, playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Act of Abjuration (card #103)", () => {
    it("allies with the Protestant and sends up to five regulars", () => {
        const G = game();
        G.powers.england.cards = ["vq-103"];
        G.spaces.amsterdam.control = "protestant";
        G.spaces.amsterdam.land = {};
        G.spaces.london.land.england = {regular: 5, merc: 0, cav: 0};
        const vp = G.powers.england.bonusVp;

        expect(playCard(G, context(), {cardId: "vq-103", asEvent: true, target: "amsterdam"})).toBeUndefined();
        expect(G.pendingAbjuration?.offers.some((offer) => offer.power === "england")).toBe(true);
        const protestantContext = {...context(), currentPlayer: "5", playerID: "5"} as Ctx;
        expect(chooseAbjuration(G, protestantContext, {power: "england"})).toBeUndefined();

        expect(G.powers.england.allies).toContain("protestant");
        expect(G.spaces.amsterdam.land.england?.regular).toBe(5);
        expect(G.powers.england.bonusVp).toBe(vp + 1);
        expect(G.removed).toContain("vq-103");
    });
});
