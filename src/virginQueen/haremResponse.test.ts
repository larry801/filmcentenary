import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {Power, VQGame} from "./constant/general";
import {actionResponseOptions, moveLand, playCard, respondAction, startActionTurn} from "./moves";
import {setupGame} from "./util";

const context = (playerID = "0"): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    activePlayers: null,
    numPlayers: 2,
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => {
    const G = setupGame({...context(), phase: "action"} as Ctx, {scenario: "tutorial"});
    G.dealtYear = G.year;
    G.powers.spain.cards = ["vq-016"];
    // A known card so the response draw is observable.
    G.deck = ["vq-030"];
    return G;
};

/** Starts one action-phase impulse and returns its endTurn spy. */
const beginImpulse = (G: VQGame, p: Power): jest.Mock => {
    G.activePower = p;
    const endTurn = jest.fn();
    const ctx = {...context(), events: {endTurn, endStage: jest.fn(), setActivePlayers: jest.fn()}} as unknown as Ctx;
    startActionTurn(G, ctx);
    return endTurn;
};

/** Ottoman's first impulse, Spain's impulse, then the Ottoman's second. */
const reachOttomanSecondImpulse = (G: VQGame): void => {
    beginImpulse(G, "ottoman");
    beginImpulse(G, "spain");
    beginImpulse(G, "ottoman");
};

const ottomanMove = (G: VQGame): void | typeof INVALID_MOVE => {
    G.powers.ottoman.cp = 5;
    return moveLand(G, context("0"), {from: "istanbul", to: "edirne", units: {regular: 1}, leaders: []});
};

describe("Sultan's Harem response (card #16)", () => {
    it("offers a legal response after the Ottoman's first impulse", () => {
        const G = game();
        reachOttomanSecondImpulse(G);

        expect(ottomanMove(G)).toBeUndefined();

        expect(G.pendingAction).toMatchObject({power: "ottoman", responder: "spain", move: "moveLand"});
        expect(actionResponseOptions(G).map((option) => option.id)).toEqual(["continue", "harem"]);
    });

    it("rejects the response on the Ottoman's first impulse of the turn", () => {
        const G = game();
        beginImpulse(G, "ottoman");

        expect(ottomanMove(G)).toBeUndefined();

        // The move is not interrupted: no response window is opened.
        expect(G.pendingAction).toBeUndefined();
        expect(actionResponseOptions(G)).toEqual([]);
        expect(G.powers.spain.cards).toContain("vq-016");
        expect(G.skipImpulse ?? []).not.toContain("ottoman");

        // Even a manually opened window refuses the illegal choice.
        G.pendingAction = {power: "ottoman", responder: "spain", move: "moveLand", args: {from: "istanbul", to: "edirne"}};
        expect(respondAction(G, context("1"), {choice: "harem"})).toBe(INVALID_MOVE);
        expect(G.pendingAction).toBeDefined();
    });

    it("sets the Ottoman's next-impulse skip and lets the responder draw one", () => {
        const G = game();
        reachOttomanSecondImpulse(G);
        const deckBefore = G.deck.length;
        expect(ottomanMove(G)).toBeUndefined();

        expect(respondAction(G, context("1"), {choice: "harem"})).toBeUndefined();

        expect(G.pendingAction).toBeUndefined();
        expect(G.skipImpulse).toContain("ottoman");
        expect(G.powers.spain.cards).toEqual(["vq-030"]);
        expect(G.deck).toHaveLength(deckBefore - 1);
        // Response mode must not grant the Ottoman event-mode bonuses.
        expect(G.haremImpulse).toBeUndefined();

        // The interrupted march resumes and is paid for normally.
        expect(G.powers.ottoman.cp).toBe(4);
        expect(G.spaces.edirne.land.ottoman?.regular ?? 0).toBe(1);

        // The Ottoman's next impulse is skipped without counting as taken.
        const impulseBefore = G.impulse;
        const endTurn = beginImpulse(G, "ottoman");
        expect(endTurn).toHaveBeenCalled();
        expect(G.impulse).toBe(impulseBefore);
        expect(G.skipImpulse ?? []).not.toContain("ottoman");
    });

    it("discards #16 instead of removing it from play", () => {
        const G = game();
        reachOttomanSecondImpulse(G);
        expect(ottomanMove(G)).toBeUndefined();

        expect(respondAction(G, context("1"), {choice: "harem"})).toBeUndefined();

        expect(G.powers.spain.cards).not.toContain("vq-016");
        expect(G.discard).toContain("vq-016");
        expect(G.removed).not.toContain("vq-016");
    });

    it("keeps #16 as an Ottoman-only event", () => {
        const G = setupGame({...context(), numPlayers: 6, phase: "action"} as Ctx, {scenario: "campaign"});
        G.powers.spain.cards = ["vq-016"];

        expect(playCard(G, {...context("1"), currentPlayer: "1"} as Ctx, {cardId: "vq-016", asEvent: true})).toBe(INVALID_MOVE);
        expect(G.powers.spain.cards).toContain("vq-016");
        expect(G.powers.ottoman.cp).toBe(0);
        expect(G.haremImpulse).toBeUndefined();
    });
});
