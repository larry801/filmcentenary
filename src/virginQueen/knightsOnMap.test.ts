import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {eventTargetOptions} from "./eventTargets";
import {playCard} from "./moves";
import {setupGame} from "./util";

/**
 * #27 Knights of St. John has two printed paragraphs.  The second one (Knights
 * absent) was implemented; the first one (Knights already on the map, so the
 * playing power draws a random Ottoman card or reduces Ottoman piracy VP by 1)
 * was missing entirely — the handler simply returned.
 */

const ctx = (die = 1): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => die, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...ctx(), phase: "action"} as Ctx);

/** Knights on Malta, with the Knights connected to an Ottoman Aegean port. */
const knightsOnMap = (): VQGame => {
    const G = game();
    G.spaces.malta.control = "spain";
    G.spaces.malta.siege = undefined;
    G.spaces.malta.land = {independent: {regular: 2, merc: 0, cav: 0}};
    // Salonika is an Aegean (Ottoman-home) port, reachable from Malta through
    // the Tyrrhenian -> Ionian -> Aegean chain.
    G.spaces.salonika.control = "ottoman";
    return G;
};

describe("Knights of St. John (#27) with the Knights on the map", () => {
    it("draws a random card from the Ottoman hand", () => {
        const G = knightsOnMap();
        G.powers.england.cards = ["vq-027"];
        G.powers.ottoman.cards = ["vq-020", "vq-021"];
        const ottomanBefore = G.powers.ottoman.cards.length;

        expect(playCard(G, ctx(), {cardId: "vq-027", asEvent: true, target: "cards"})).toBeUndefined();

        expect(G.powers.ottoman.cards.length).toBe(ottomanBefore - 1);
        expect(G.powers.england.cards.some((id) => ["vq-020", "vq-021"].includes(id))).toBe(true);
    });

    it("reduces Ottoman piracy VP by 1 instead", () => {
        const G = knightsOnMap();
        G.powers.england.cards = ["vq-027"];
        G.powers.ottoman.cards = ["vq-020"];
        const vp = G.powers.ottoman.bonusVp;

        expect(playCard(G, ctx(), {cardId: "vq-027", asEvent: true, target: "piracyVp"})).toBeUndefined();

        expect(G.powers.ottoman.bonusVp).toBe(vp - 1);
        // The Ottoman keeps the card in this branch.
        expect(G.powers.ottoman.cards).toContain("vq-020");
    });

    it("offers both choices in the target list", () => {
        const G = knightsOnMap();
        G.powers.ottoman.cards = ["vq-020"];
        const values = eventTargetOptions(G, "vq-027", "england").map((option) => option.value);
        expect(values).toEqual(expect.arrayContaining(["cards", "piracyVp"]));
    });
});
