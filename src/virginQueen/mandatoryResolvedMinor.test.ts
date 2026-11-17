import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {POWERS, Power, VQGame} from "./constant/general";
import {MANDATORY_CARDS} from "./data/cards";
import {passBlockReasons, playCard} from "./moves";
import {ownerOf} from "./ownership";
import {resolveMinorDiplomacy, setupGame} from "./util";
import {untimelyDeathTargets} from "./cardEvents";

const context = (playerID: string, phase = "action"): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase,
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
    events: {setActivePlayers: () => undefined, endStage: () => undefined, endTurn: () => undefined},
} as unknown as Ctx);

/** Campaign Action Phase with `power` active and holding only `cardId`. */
const holding = (power: Power, cardId: string, year = 1): VQGame => {
    const G = setupGame({...context("0"), phase: "action"} as Ctx);
    G.activePower = power;
    G.powers[power].cards = [cardId];
    G.powers[power].cp = 0;
    G.powers[power].cardPlayed = false;
    G.year = year;
    return G;
};

/**
 * Rule 24.6 lets an Event that re-evaluates a minor already resolved this turn
 * be ignored, but a Mandatory Event still has to be playable: Rule 11 forbids
 * passing while one is in hand.  Refusing #74 after Scotland was evaluated
 * therefore deadlocked the whole Action Phase — every seat was blocked by
 * `moveError` until a choice that could never be made.
 */
describe("mandatory events stay playable when their minor was already resolved", () => {
    it("plays Scottish Lords Rebel instead of refusing it and blocking the pass", () => {
        const G = holding("england", "vq-074");
        resolveMinorDiplomacy(G, {...context("0"), phase: "action"} as Ctx, "scotland");
        expect(G.minorDiplomacyResolved).toContain("scotland");

        expect(playCard(G, context(ownerOf(G, "england") ?? "0"), {cardId: "vq-074", asEvent: true})).toBeUndefined();

        // Rule 11: after the Mandatory Event the power may end its impulse.
        expect(passBlockReasons(G, "england")).not.toContain("mandatory");
        expect(G.powers.england.cards).not.toContain("vq-074");
    });

    it("logs the ignored resolution instead of re-evaluating Scotland", () => {
        const G = holding("england", "vq-074");
        resolveMinorDiplomacy(G, {...context("0"), phase: "action"} as Ctx, "scotland");
        const resolvedBefore = G.minorDiplomacyResolved.length;

        playCard(G, context(ownerOf(G, "england") ?? "0"), {cardId: "vq-074", asEvent: true});

        expect(G.minorDiplomacyResolved).toHaveLength(resolvedBefore);
        expect(G.log.some((line) => line.includes("already evaluated"))).toBe(true);
    });

    it("still refuses an ordinary Event that targets a resolved minor", () => {
        // #57 resolves Ireland; a non-Mandatory Event keeps the play guard.
        const G = holding("spain", "vq-057");
        G.minorDiplomacyResolved = ["ireland"];
        expect(playCard(G, context(ownerOf(G, "spain") ?? "0"), {cardId: "vq-057", asEvent: true}))
            .toBe(INVALID_MOVE);
    });

    it("never leaves a Mandatory Event in hand and every seat blocked", () => {
        // The sweep-level invariant: for every Mandatory Event, the power that
        // holds it must either be able to play it or be able to pass.  Each
        // card's own target grammar is sent, exactly as the card drawer builds
        // it (`EventTargetMode`/`EventBranchPanel`).
        const deadlocks: string[] = [];
        for (const card of MANDATORY_CARDS) {
            for (const power of POWERS) {
                const G = holding(power, card.id);
                const seat = ownerOf(G, power) ?? "0";
                const blocked = passBlockReasons(G, power);
                // The card drawer sends the first listed leader, or "none".
                const target = card.id === "vq-076" ? (untimelyDeathTargets(G)[0] ?? "none")
                    : card.id === "vq-004" || card.id === "vq-037" ? "3" : undefined;
                const refused = playCard(G, context(seat), {
                    cardId: card.id, asEvent: true, ...(target !== undefined ? {target} : {}),
                }) === INVALID_MOVE;
                if (refused && blocked.length > 0) deadlocks.push(`${card.id}/${power}`);
            }
        }
        expect(deadlocks).toEqual([]);
    });
});
