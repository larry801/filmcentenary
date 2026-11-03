import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {Power, VQGame} from "./constant/general";
import {actionResponseOptions, moveLand, pass, recruit, respondAction, startActionTurn} from "./moves";
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

/** Starts one action-phase impulse and returns its begin spies. */
const beginImpulse = (G: VQGame, p: Power): {endTurn: jest.Mock; setActivePlayers: jest.Mock} => {
    G.activePower = p;
    const endTurn = jest.fn();
    const setActivePlayers = jest.fn();
    const ctx = {...context(), events: {endTurn, endStage: jest.fn(), setActivePlayers}} as unknown as Ctx;
    startActionTurn(G, ctx);
    return {endTurn, setActivePlayers};
};

/** Ottoman's first impulse, Spain's impulse, then the Ottoman's second. */
const reachOttomanSecondImpulse = (G: VQGame): void => {
    beginImpulse(G, "ottoman");
    beginImpulse(G, "spain");
    beginImpulse(G, "ottoman");
};

describe("Sultan's Harem impulse response (card #16)", () => {
    it("opens a legal window at the start of every Ottoman impulse after the first", () => {
        const G = game();

        beginImpulse(G, "ottoman");
        // The FAQ forbids skipping the Ottoman's first action round.
        expect(G.pendingAction).toBeUndefined();
        expect(actionResponseOptions(G)).toEqual([]);

        beginImpulse(G, "spain");
        const {setActivePlayers} = beginImpulse(G, "ottoman");

        expect(G.pendingAction).toMatchObject({power: "ottoman", responder: "spain", move: "impulse"});
        expect(actionResponseOptions(G).map((option) => option.id)).toEqual(["continue", "harem"]);
        expect(setActivePlayers).toHaveBeenCalledWith({value: {"1": "actionResponse"}});
    });

    it("does not offer or allow the response before the Ottoman's first impulse", () => {
        const G = game();
        beginImpulse(G, "ottoman");

        expect(G.pendingAction).toBeUndefined();
        expect(G.powers.spain.cards).toContain("vq-016");

        // Even a manually opened window refuses the illegal choice, and no
        // Storms option appears for an impulse-start window.
        G.pendingAction = {power: "ottoman", responder: "spain", move: "impulse", args: {}};
        expect(actionResponseOptions(G).map((option) => option.id)).toEqual(["continue"]);
        expect(respondAction(G, context("1"), {choice: "harem"})).toBe(INVALID_MOVE);
        expect(G.pendingAction).toBeDefined();
        expect(G.skipImpulse ?? []).not.toContain("ottoman");
    });

    it("covers a recruit impulse and lets the recruit proceed after the window is released", () => {
        const G = game();
        reachOttomanSecondImpulse(G);
        expect(G.pendingAction?.move).toBe("impulse");

        const before = G.spaces.istanbul.land.ottoman?.regular ?? 0;
        expect(respondAction(G, context("1"), {choice: "continue"})).toBeUndefined();
        expect(G.pendingAction).toBeUndefined();

        G.powers.ottoman.cp = 2;
        expect(recruit(G, context("0"), {space: "istanbul", kind: "regular"})).toBeUndefined();
        expect(G.spaces.istanbul.land.ottoman?.regular ?? 0).toBe(before + 1);
        expect(G.powers.ottoman.cp).toBe(0);
        expect(G.powers.spain.cards).toEqual(["vq-016"]);
    });

    it("suppresses the move-declaration window for the rest of the declined impulse", () => {
        const G = game();
        reachOttomanSecondImpulse(G);
        expect(respondAction(G, context("1"), {choice: "continue"})).toBeUndefined();
        expect(G.haremDeclinedImpulse).toEqual({spain: G.impulse});
        expect(G.pendingAction).toBeUndefined();

        G.powers.ottoman.cp = 5;
        expect(moveLand(G, context("0"), {from: "istanbul", to: "edirne", units: {regular: 1}, leaders: []})).toBeUndefined();

        // The same holder is not asked again in this impulse, and the march
        // still happens normally.
        expect(G.pendingAction).toBeUndefined();
        expect(G.powers.spain.cards).toContain("vq-016");
        expect(G.spaces.edirne.land.ottoman?.regular ?? 0).toBe(1);

        // A later Ottoman impulse opens a fresh impulse-start window.
        beginImpulse(G, "spain");
        const {setActivePlayers} = beginImpulse(G, "ottoman");
        expect(G.pendingAction).toMatchObject({power: "ottoman", responder: "spain", move: "impulse"});
        expect(setActivePlayers).toHaveBeenCalledWith({value: {"1": "actionResponse"}});
    });

    it("covers a pass impulse", () => {
        const G = game();
        reachOttomanSecondImpulse(G);
        expect(G.pendingAction?.move).toBe("impulse");

        expect(respondAction(G, context("1"), {choice: "continue"})).toBeUndefined();
        expect(pass(G, context("0"))).toBeUndefined();
        expect(G.powers.ottoman.passed).toBe(true);
        expect(G.pendingAction).toBeUndefined();
    });

    it("makes the Ottoman skip its next impulse and lets the responder draw one", () => {
        const G = game();
        reachOttomanSecondImpulse(G);
        const deckBefore = G.deck.length;

        expect(respondAction(G, context("1"), {choice: "harem"})).toBeUndefined();

        expect(G.pendingAction).toBeUndefined();
        expect(G.skipImpulse).toContain("ottoman");
        expect(G.powers.spain.cards).toEqual(["vq-030"]);
        expect(G.deck).toHaveLength(deckBefore - 1);
        // Response mode must not grant the Ottoman event-mode bonuses.
        expect(G.haremImpulse).toBeUndefined();

        // The next Ottoman impulse is skipped without counting as taken.
        const impulseBefore = G.impulse;
        const {endTurn, setActivePlayers} = beginImpulse(G, "ottoman");
        expect(endTurn).toHaveBeenCalled();
        expect(G.impulse).toBe(impulseBefore);
        expect(G.skipImpulse ?? []).not.toContain("ottoman");
        // No second window: Spain no longer holds #16.
        expect(setActivePlayers).not.toHaveBeenCalled();
    });
});
