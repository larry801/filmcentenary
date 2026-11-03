import {Ctx} from "boardgame.io";
import {Power, VQGame} from "./constant/general";
import {actionResponseOptions, moveLand, respondAction, startActionTurn} from "./moves";
import {setupGame} from "./util";

const context = (playerID = "0"): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    activePlayers: null,
    numPlayers: 6,
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

/**
 * A response happens on the active power's turn: `currentPlayer` stays the
 * Ottoman while `playerID` is the responding power.  Resumed moves derive the
 * acting power from `currentPlayer` in six-player games, so the distinction
 * matters when a response releases an interrupted march.
 */
const responseContext = (playerID: string): Ctx => ({...context(playerID), currentPlayer: "0"} as Ctx);

const game = (): VQGame => {
    const G = setupGame({...context(), phase: "action"} as Ctx, {scenario: "campaign"});
    G.dealtYear = G.year;
    // A known card so the response draw is observable.
    G.deck = ["vq-030"];
    return G;
};

const beginImpulse = (G: VQGame, power: Power): void => {
    G.activePower = power;
    const ctx = {...context(), events: {endTurn: jest.fn(), endStage: jest.fn(), setActivePlayers: jest.fn()}} as unknown as Ctx;
    startActionTurn(G, ctx);
};

/** Ottoman's first impulse, Spain's impulse, then the Ottoman's second. */
const reachOttomanSecondImpulse = (G: VQGame): void => {
    beginImpulse(G, "ottoman");
    beginImpulse(G, "spain");
    beginImpulse(G, "ottoman");
};

const ottomanMove = (G: VQGame): void => {
    G.powers.ottoman.cp = 5;
    expect(moveLand(G, context("0"), {from: "istanbul", to: "edirne", units: {regular: 1}, leaders: []})).toBeUndefined();
};

describe("Sultan's Harem decline marker per holder (card #16)", () => {
    it("offers the impulse window to every holder and records each holder's decline", () => {
        const G = game();
        // The deck has a single #16, so two holders is a synthetic seam used
        // to prove the marker is keyed by power rather than by impulse alone.
        G.powers.spain.cards = ["vq-016"];
        G.powers.england.cards = ["vq-016"];
        reachOttomanSecondImpulse(G);

        expect(G.pendingAction).toMatchObject({power: "ottoman", responder: "spain", responders: ["spain", "england"], move: "impulse"});
        expect(actionResponseOptions(G, "spain").map((option) => option.id)).toEqual(["continue", "harem"]);
        expect(actionResponseOptions(G, "england").map((option) => option.id)).toEqual(["continue", "harem"]);

        // Spain declines: only Spain's marker is set and England keeps the
        // still-open impulse window instead of inheriting the decline.
        expect(respondAction(G, responseContext("1"), {choice: "continue"})).toBeUndefined();
        expect(G.haremDeclinedImpulse).toEqual({spain: G.impulse});
        expect(G.pendingAction).toMatchObject({responder: "england", responders: ["england"]});
        expect(actionResponseOptions(G, "england").map((option) => option.id)).toEqual(["continue", "harem"]);

        expect(respondAction(G, responseContext("2"), {choice: "continue"})).toBeUndefined();
        expect(G.haremDeclinedImpulse).toEqual({spain: G.impulse, england: G.impulse});
        expect(G.pendingAction).toBeUndefined();

        // Both holders answered once this impulse, so the move-declaration
        // window has nothing left to offer and the march proceeds.
        expect(G.pendingAction).toBeUndefined();
        G.powers.ottoman.cp = 5;
        expect(moveLand(G, context("0"), {from: "istanbul", to: "edirne", units: {regular: 1}, leaders: []})).toBeUndefined();
        expect(G.pendingAction).toBeUndefined();
        expect(G.spaces.edirne.land.ottoman?.regular ?? 0).toBe(1);
    });

    it("lets a new holder answer after the card is transferred in the same impulse", () => {
        const G = game();
        G.powers.spain.cards = ["vq-016"];
        reachOttomanSecondImpulse(G);
        expect(G.pendingAction).toMatchObject({responder: "spain", responders: ["spain"], move: "impulse"});
        expect(respondAction(G, responseContext("1"), {choice: "continue"})).toBeUndefined();
        expect(G.haremDeclinedImpulse).toEqual({spain: G.impulse});

        // Card transfer (e.g. Black Queen or Sultana Safiye) to England.
        G.powers.spain.cards = G.powers.spain.cards.filter((id) => id !== "vq-016");
        G.powers.england.cards = ["vq-016"];

        ottomanMove(G);
        expect(G.pendingAction).toMatchObject({power: "ottoman", responder: "england", responders: ["england"], move: "moveLand"});
        expect(actionResponseOptions(G, "england").map((option) => option.id)).toEqual(["continue", "harem"]);

        // The old holder's decline does not follow the card to its new owner.
        expect(respondAction(G, responseContext("2"), {choice: "harem"})).toBeUndefined();
        expect(G.pendingAction).toBeUndefined();
        expect(G.skipImpulse).toContain("ottoman");
        expect(G.powers.england.cards).toEqual(["vq-030"]);
        expect(G.powers.spain.cards).toEqual([]);
        expect(G.haremDeclinedImpulse).toEqual({spain: G.impulse});
        // The interrupted march resumed and paid the normal CP cost.
        expect(G.powers.ottoman.cp).toBe(4);
        expect(G.spaces.edirne.land.ottoman?.regular ?? 0).toBe(1);
    });

    it("merges Storms and #16 holders into one response window", () => {
        const G = game();
        // England acquires #16 after the impulse started, so no impulse-start
        // window was offered this impulse.
        G.powers.england.cards = [];
        reachOttomanSecondImpulse(G);
        expect(G.pendingAction).toBeUndefined();
        G.powers.spain.cards = ["vq-015"];
        G.powers.england.cards = ["vq-016"];

        ottomanMove(G);
        expect(G.pendingAction).toMatchObject({power: "ottoman", responder: "spain", responders: ["spain", "england"], move: "moveLand"});
        expect(actionResponseOptions(G, "spain").map((option) => option.id)).toEqual(["continue", "storms"]);
        expect(actionResponseOptions(G, "england").map((option) => option.id)).toEqual(["continue", "harem"]);

        // Spain passes on Storms; England still gets its own answer for the
        // same action instead of losing the window to the Storms holder.
        expect(respondAction(G, responseContext("1"), {choice: "continue"})).toBeUndefined();
        expect(G.pendingAction).toMatchObject({responder: "england", responders: ["england"]});
        expect(G.haremDeclinedImpulse).toEqual({spain: G.impulse});
        expect(G.powers.spain.cards).toContain("vq-015");

        expect(respondAction(G, responseContext("2"), {choice: "harem"})).toBeUndefined();
        expect(G.skipImpulse).toContain("ottoman");
        expect(G.powers.england.cards).toEqual(["vq-030"]);
        expect(G.powers.spain.cards).toEqual(["vq-015"]);
        expect(G.spaces.edirne.land.ottoman?.regular ?? 0).toBe(1);
        expect(G.pendingAction).toBeUndefined();
    });

    it("releases the interrupted action once every merged responder declines", () => {
        const G = game();
        G.powers.england.cards = [];
        reachOttomanSecondImpulse(G);
        G.powers.spain.cards = ["vq-015"];
        G.powers.england.cards = ["vq-016"];

        ottomanMove(G);
        expect(G.pendingAction?.responders).toEqual(["spain", "england"]);
        expect(respondAction(G, responseContext("1"), {choice: "continue"})).toBeUndefined();
        expect(respondAction(G, responseContext("2"), {choice: "continue"})).toBeUndefined();

        expect(G.pendingAction).toBeUndefined();
        expect(G.haremDeclinedImpulse).toEqual({spain: G.impulse, england: G.impulse});
        expect(G.powers.spain.cards).toEqual(["vq-015"]);
        expect(G.powers.england.cards).toEqual(["vq-016"]);
        expect(G.powers.ottoman.cp).toBe(4);
        expect(G.spaces.edirne.land.ottoman?.regular ?? 0).toBe(1);
    });
});
