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
 * #30 Ruler Falls Ill discards "a hand card", so Home cards are part of the
 * random pool (they are set aside by discardCard) while Mandatory Events must
 * stay in hand until played.
 */
describe("Ruler Falls Ill (#30) home card discard", () => {
    it("discards a lone home card and sets it aside", () => {
        const G = game();
        G.powers.france.cards = ["vq-030"];
        // Spanish Road: a Spanish Home card.
        G.powers.spain.cards = ["vq-003"];

        expect(playCard(G, context(), {cardId: "vq-030", asEvent: true, target: "spain"})).toBeUndefined();

        expect(G.powers.spain.cards).toEqual([]);
        expect(G.homeSetAside).toContain("vq-003");
        expect(G.discard).not.toContain("vq-003");
    });

    it("rolls across home cards as well as event cards", () => {
        // Die 2 of 2 must reach the second card, which is the Home card.
        const G = game(2);
        G.powers.france.cards = ["vq-030"];
        G.powers.spain.cards = ["vq-020", "vq-003"];

        expect(playCard(G, context(2), {cardId: "vq-030", asEvent: true, target: "spain"})).toBeUndefined();

        expect(G.powers.spain.cards).toEqual(["vq-020"]);
        expect(G.homeSetAside).toContain("vq-003");
        expect(G.discard).not.toContain("vq-003");
    });

    it("can discard a specifically named home card", () => {
        const G = game();
        G.powers.france.cards = ["vq-030"];
        G.powers.spain.cards = ["vq-020", "vq-003"];

        expect(playCard(G, context(), {cardId: "vq-030", asEvent: true, target: "spain:discard:vq-003"})).toBeUndefined();

        expect(G.homeSetAside).toContain("vq-003");
        expect(G.powers.spain.cards).toEqual(["vq-020"]);
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

    it("does nothing when only a Mandatory Event is in hand", () => {
        const G = game();
        G.powers.france.cards = ["vq-030"];
        G.powers.spain.cards = ["vq-004"];

        expect(playCard(G, context(), {cardId: "vq-030", asEvent: true, target: "spain"})).toBeUndefined();

        expect(G.powers.spain.cards).toEqual(["vq-004"]);
        expect(G.discard).not.toContain("vq-004");
        expect(G.homeSetAside).not.toContain("vq-004");
    });
});
