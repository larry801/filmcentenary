import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {Power, VQGame} from "./constant/general";
import {ownerOf} from "./ownership";
import {diplomacyActionState, giftState} from "./diplomacyPolicy";
import {
    formAlliance,
    giveMercenary,
    giveRandomCard,
    giveTreasure,
    loanNaval,
    makePeace,
    yieldSpace,
} from "./moves";
import {proposeDeal, respondDeal} from "./negotiationMoves";
import {validateNegotiation} from "./negotiation";
import {setupGame} from "./util";

/**
 * Scenario Book p. 13 (Activated Major Powers): in 2-5 player games the HRE
 * (and, in 2-4 player games, the Ottoman) is not a seated power until
 * diplomacy activates it.  A power with no seat cannot be the other party to a
 * negotiated agreement, so no diplomatic move may target it.  Declaring war is
 * the one exception: that is exactly the rule that draws the inactive major
 * power into the game.
 */
const context = (numPlayers: number, playerID: string): Ctx => ({
    numPlayers,
    currentPlayer: playerID,
    playerID,
    phase: "diplomacy",
    activePlayers: null,
    events: {setActivePlayers: jest.fn(), endStage: jest.fn()},
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

/** A game where `power` holds a card, a treasure and a mercenary to give away. */
const gameWithAssets = (numPlayers: number): {G: VQGame; ctx: Ctx; power: Power} => {
    const ctx = context(numPlayers, "0");
    const G = setupGame(ctx, {scenario: "campaign"});
    const seat = Object.keys(G.playerPowers!)[0];
    const power = G.playerPowers![seat][0];
    G.activePower = power;
    G.powers[power].cards = ["vq-020", "vq-050"];
    G.powers[power].treasures = [2];
    G.spaces.vienna.land[power] = {regular: 0, merc: 2, cav: 0};
    G.spaces.bordeaux.control = power;
    return {G, ctx: {...ctx, currentPlayer: seat, playerID: seat}, power};
};

describe.each([2, 3, 4, 5])("inactive major powers in a %i-player game", (numPlayers) => {
    it("has no HRE seat", () => {
        const {G} = gameWithAssets(numPlayers);
        expect(ownerOf(G, "hre")).toBeUndefined();
    });

    it("refuses every negotiated agreement with the seatless HRE", () => {
        const {G, ctx} = gameWithAssets(numPlayers);

        expect(formAlliance(G, ctx, {target: "hre"})).toBe(INVALID_MOVE);
        expect(makePeace(G, ctx, {target: "hre"})).toBe(INVALID_MOVE);
        expect(giveRandomCard(G, ctx, {target: "hre"})).toBe(INVALID_MOVE);
        expect(giveTreasure(G, ctx, {target: "hre"})).toBe(INVALID_MOVE);
        expect(giveMercenary(G, ctx, {target: "hre", space: "vienna"})).toBe(INVALID_MOVE);
        expect(yieldSpace(G, ctx, {target: "hre", space: "bordeaux"})).toBe(INVALID_MOVE);
        expect(loanNaval(G, ctx, {
            target: "hre", fromPort: "vienna", toPort: "vienna", kind: "galley",
        })).toBe(INVALID_MOVE);

        // No partial state leaked out of the rejected moves.
        expect(G.powers[G.activePower].cards).toEqual(["vq-020", "vq-050"]);
        expect(G.powers[G.activePower].treasures).toEqual([2]);
        expect(G.powers.hre.cards).toEqual([]);
        expect(G.powers.hre.treasures).toEqual([]);
        expect(G.spaces.bordeaux.control).toBe(G.activePower);
        expect(G.diplomacyGifts ?? {}).toEqual({});
    });

    it("reports the seatless HRE to the diplomacy panel instead of a silent rejection", () => {
        const {G, power} = gameWithAssets(numPlayers);

        expect(diplomacyActionState(G, power, "hre", "formAlliance")).toEqual({ok: false, reason: "noPlayer"});
        expect(diplomacyActionState(G, power, "hre", "makePeace")).toEqual({ok: false, reason: "noPlayer"});
        expect(giftState(G, power, "hre", "cards")).toEqual({ok: false, reason: "noPlayer"});
        expect(giftState(G, power, "hre", "treasures")).toEqual({ok: false, reason: "noPlayer"});
        expect(giftState(G, power, "hre", "mercenaries")).toEqual({ok: false, reason: "noPlayer"});
    });

    it("still allows declaring war on the seatless HRE", () => {
        const {G, power} = gameWithAssets(numPlayers);
        // The declaration itself is legal; it is what triggers the diplomatic
        // status check that seats the HRE under a winning ally.
        expect(diplomacyActionState(G, power, "hre", "declareWar").ok).toBe(true);
    });

    it("rejects a negotiation offer that names the seatless HRE", () => {
        const {G, ctx, power} = gameWithAssets(numPlayers);

        expect(proposeDeal(G, ctx, {
            target: "hre",
            terms: [{kind: "cards", from: power, to: "hre", count: 1}],
        })).toBe(INVALID_MOVE);
        expect(G.negotiation?.offer ?? null).toBeNull();
        // The shared validator names the reason the panel shows.
        expect(validateNegotiation(G, power, "hre", [{kind: "alliance"}]).map((issue) => issue.code))
            .toContain("noPlayer");
    });
});

describe("an activated major power takes part in diplomacy normally", () => {
    it("lets the controlling ally negotiate with the now-seated HRE", () => {
        const ctx = context(5, "1");
        const G = setupGame(ctx, {scenario: "campaign"});
        G.activePower = "spain";
        G.powers.spain.cards = ["vq-020"];
        // Seat the HRE under England's control, as `activateMajor` does.
        G.activatedMajors = {hre: {ally: "england", baseline: 0}};
        // Five-player seats: 0 Ottoman, 1 Spain, 2 England, 3 France,
        // 4 Protestant.
        expect(ownerOf(G, "hre")).toBe("2");

        expect(diplomacyActionState(G, "spain", "hre", "formAlliance")).toEqual({ok: true});
        expect(giftState(G, "spain", "hre", "cards")).toEqual({ok: true});
        expect(proposeDeal(G, {...ctx, playerID: "1", currentPlayer: "1"}, {
            target: "hre",
            terms: [{kind: "cards", from: "spain", to: "hre", count: 1}],
        })).toBeUndefined();
        expect(respondDeal(G, {...ctx, playerID: "2"}, {offerId: "deal-1", action: "accept"})).toBeUndefined();
        expect(G.powers.hre.cards).toEqual(["vq-020"]);
    });
});
