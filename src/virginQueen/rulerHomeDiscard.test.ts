import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (die = 1): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => die, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (die = 1): VQGame => setupGame({...context(die), phase: "action"} as Ctx);

/**
 * Rule 6.1: "Home Cards can never be taken from a power's hand when a random
 * draw is required (either by Event card play, diplomatic agreement,
 * espionage or piracy) or when a specific card is chosen (Event card play or
 * espionage)."  #30 Ruler Falls Ill discards a random hand card, so Home cards
 * are immune; only #17 Army Mutiny prints an explicit Home-card exception.
 * Mandatory Events also stay: they must be played that turn.
 */
describe("Ruler Falls Ill (#30) never discards a Home card", () => {
    it("leaves a lone Home card in hand", () => {
        const G = game();
        G.powers.france.cards = ["vq-030"];
        // Spanish Road: a Spanish Home card.
        G.powers.spain.cards = ["vq-003"];

        expect(playCard(G, context(), {cardId: "vq-030", asEvent: true, target: "spain"})).toBeUndefined();

        expect(G.powers.spain.cards).toEqual(["vq-003"]);
        expect(G.homeSetAside).not.toContain("vq-003");
        expect(G.discard).not.toContain("vq-003");
    });

    it("skips Home cards when rolling across the hand", () => {
        // The pool holds only #20, so any die value must discard #20.
        const G = game(2);
        G.powers.france.cards = ["vq-030"];
        G.powers.spain.cards = ["vq-020", "vq-003"];

        expect(playCard(G, context(2), {cardId: "vq-030", asEvent: true, target: "spain"})).toBeUndefined();

        expect(G.powers.spain.cards).toEqual(["vq-003"]);
        expect(G.discard).toContain("vq-020");
        expect(G.homeSetAside).not.toContain("vq-003");
    });

    it("refuses a specifically named Home card", () => {
        const G = game();
        G.powers.france.cards = ["vq-030"];
        G.powers.spain.cards = ["vq-020", "vq-003"];

        // The named card is ineligible, so resolution falls back to the random
        // pick among the remaining eligible cards.
        expect(playCard(G, context(), {cardId: "vq-030", asEvent: true, target: "spain:discard:vq-003"})).toBeUndefined();

        expect(G.homeSetAside).not.toContain("vq-003");
        expect(G.powers.spain.cards).toEqual(["vq-003"]);
        expect(G.discard).toContain("vq-020");
    });

    it("leaves Mandatory Events out of the random pool", () => {
        // German Intervention (#4) is mandatory and sits second; the pool is
        // only #20, so die 2 still discards #20.
        const G = game(2);
        G.powers.france.cards = ["vq-030"];
        G.powers.spain.cards = ["vq-020", "vq-004"];

        expect(playCard(G, context(2), {cardId: "vq-030", asEvent: true, target: "spain"})).toBeUndefined();

        expect(G.powers.spain.cards).toEqual(["vq-004"]);
        expect(G.discard).toContain("vq-020");
        expect(G.discard).not.toContain("vq-004");
    });

    it("will not play a Mandatory Event as the named discard", () => {
        const G = game();
        G.powers.france.cards = ["vq-030"];
        G.powers.spain.cards = ["vq-020", "vq-004"];

        // The named card is not eligible, so resolution falls back to the
        // random pick among the remaining hand.
        expect(playCard(G, context(), {cardId: "vq-030", asEvent: true, target: "spain:discard:vq-004"})).toBeUndefined();

        expect(G.powers.spain.cards).toEqual(["vq-004"]);
        expect(G.discard).toContain("vq-020");
    });

    it("does nothing when the hand holds only Home and Mandatory cards", () => {
        const G = game();
        G.powers.france.cards = ["vq-030"];
        G.powers.spain.cards = ["vq-004", "vq-003"];

        expect(playCard(G, context(), {cardId: "vq-030", asEvent: true, target: "spain"})).toBeUndefined();

        expect(G.powers.spain.cards).toEqual(["vq-004", "vq-003"]);
        expect(G.discard).not.toContain("vq-004");
        expect(G.homeSetAside).not.toContain("vq-003");
    });
});
