/**
 * A79 Loose Grip — "Remove from the game if Tunisia and Libya are no longer
 * Ottoman controlled."
 *
 * The condition is checked both at the card's resolution (event and CP play)
 * and at every live control-marker change on the three named spaces.  Libya is
 * the printed pair Tripoli + Benghazi, so the card only leaves the game once
 * none of the three spaces is Ottoman controlled.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {LOOSE_GRIP_CARD, looseGripRemovalDue, placeControlMarker} from "./engine/effects";
import {eventPlayability} from "./engine/playability";
import {playCard} from "./moves";

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    random: {Die: (n: number) => Math.min(n, 3)},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  for (const power of POWERS) G.powers[power].hand = [];
  return G;
};

const takeTurn = (G: ImperialElegyState, power: Power, card = LOOSE_GRIP_CARD): Ctx => {
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = 0;
  G.powers[power].hand = [card];
  return makeCtx(seat(power));
};

const NAMED = ["tripoli", "benghazi", "tunisia"] as const;

describe("A79 removal at the card's resolution", () => {
  test("a CP play removes the card instead of discarding it once both areas are lost", () => {
    const G = fresh();
    for (const id of NAMED) G.spaces[id].control = "FR";
    expect(looseGripRemovalDue(G)).toBe(true);
    const ctx = takeTurn(G, "UK");

    expect(playCard(G, ctx, LOOSE_GRIP_CARD, "cp")).toBeUndefined();

    expect(G.powers.UK.hand).not.toContain(LOOSE_GRIP_CARD);
    expect(G.removed).toContain(LOOSE_GRIP_CARD);
    expect(G.discard).not.toContain(LOOSE_GRIP_CARD);
    expect(G.cpRemaining).toBe(3);
    const removed = G.log.find((entry) => entry.key === "looseGripRemoved");
    expect(removed?.args).toMatchObject({reason: "cp"});
  });

  test("a CP play with Tunisia still Ottoman is an ordinary discard", () => {
    const G = fresh();
    G.spaces.tripoli.control = "FR";
    G.spaces.benghazi.control = "FR";
    G.spaces.tunisia.control = "OT";
    expect(looseGripRemovalDue(G)).toBe(false);
    const ctx = takeTurn(G, "UK");

    expect(playCard(G, ctx, LOOSE_GRIP_CARD, "cp")).toBeUndefined();

    expect(G.removed).not.toContain(LOOSE_GRIP_CARD);
    expect(G.discard).toContain(LOOSE_GRIP_CARD);
    expect(G.log.some((entry) => entry.key === "looseGripRemoved")).toBe(false);
  });

  test("a CP play with one Libya space still Ottoman keeps the card in the discard", () => {
    const G = fresh();
    G.spaces.tripoli.control = "FR";
    G.spaces.benghazi.control = "OT";
    G.spaces.tunisia.control = "FR";
    expect(looseGripRemovalDue(G)).toBe(false);
    const ctx = takeTurn(G, "UK");

    expect(playCard(G, ctx, LOOSE_GRIP_CARD, "cp")).toBeUndefined();

    expect(G.removed).not.toContain(LOOSE_GRIP_CARD);
    expect(G.discard).toContain(LOOSE_GRIP_CARD);
  });

  test("the event play still removes the card once both areas are lost", () => {
    const G = fresh();
    for (const id of NAMED) G.spaces[id].control = "FR";
    const ctx = takeTurn(G, "UK");
    expect(eventPlayability(G, "UK", LOOSE_GRIP_CARD)).toEqual({ok: true});

    expect(playCard(G, ctx, LOOSE_GRIP_CARD, "event")).toBeUndefined();

    expect(G.removed).toContain(LOOSE_GRIP_CARD);
    expect(G.discard).not.toContain(LOOSE_GRIP_CARD);
    expect(G.log.some((entry) => entry.key === "looseGripRemoved")).toBe(true);
    for (const id of NAMED) expect(G.spaces[id].control).toBe("FR");
  });

  test("the Ottomans still cannot play it for its event", () => {
    const G = fresh();
    const ctx = takeTurn(G, "OT");
    expect(eventPlayability(G, "OT", LOOSE_GRIP_CARD)).toEqual({ok: false, reason: "power-list"});
    expect(playCard(G, ctx, LOOSE_GRIP_CARD, "event")).toBe(INVALID_MOVE);
  });
});

describe("A79 removal at a live control change", () => {
  test("the card leaves the game when the last Ottoman space changes hands", () => {
    const G = fresh();
    // Tunisia is the last Ottoman space; the card is held by another power.
    G.spaces.tripoli.control = "FR";
    G.spaces.benghazi.control = "FR";
    G.spaces.tunisia.control = "OT";
    G.powers.FR.hand = [LOOSE_GRIP_CARD];
    expect(looseGripRemovalDue(G)).toBe(false);

    placeControlMarker(G, "tunisia", "FR");

    expect(G.spaces.tunisia.control).toBe("FR");
    expect(looseGripRemovalDue(G)).toBe(true);
    expect(G.powers.FR.hand).not.toContain(LOOSE_GRIP_CARD);
    expect(G.removed).toContain(LOOSE_GRIP_CARD);
    expect(G.discard).not.toContain(LOOSE_GRIP_CARD);
    expect(G.log.find((entry) => entry.key === "looseGripRemoved")?.args).toMatchObject({reason: "control"});
  });

  test("a change that leaves one named space Ottoman does not remove the card", () => {
    const G = fresh();
    G.spaces.tripoli.control = "OT";
    G.spaces.benghazi.control = "FR";
    G.powers.FR.hand = [LOOSE_GRIP_CARD];

    placeControlMarker(G, "tunisia", "FR");

    expect(looseGripRemovalDue(G)).toBe(false);
    expect(G.powers.FR.hand).toContain(LOOSE_GRIP_CARD);
    expect(G.removed).not.toContain(LOOSE_GRIP_CARD);
  });

  test("an Ottoman re-control never removes the card", () => {
    const G = fresh();
    for (const id of NAMED) G.spaces[id].control = "FR";
    G.powers.UK.hand = [LOOSE_GRIP_CARD];
    // Re-establishing Ottoman control over one space keeps the condition false.
    placeControlMarker(G, "tunisia", "OT");
    expect(looseGripRemovalDue(G)).toBe(false);
    expect(G.powers.UK.hand).toContain(LOOSE_GRIP_CARD);
    expect(G.removed).not.toContain(LOOSE_GRIP_CARD);
  });
});
