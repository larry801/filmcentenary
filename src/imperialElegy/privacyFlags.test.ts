/**
 * Privacy split for per-power flags.
 *
 * Rule 8.0's player displays, the printed power-projection and plus-card
 * tracks, and resolved public events are public information; a player's hand,
 * National Goal draw, saved card, CP chain and open-decision bookkeeping are
 * not.  `redactForView` copies only the documented `PUBLIC_POWER_FLAGS` to
 * opponents and spectators and keeps every other flag private.
 */

import {ImperialElegyState, Power, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  PUBLIC_POWER_FLAGS,
  isPublicPowerFlag,
  publicPowerFlags,
  redactForView,
  RedactedView,
} from "./engine/privacy";

const makeCtx = (playerID: string | null = "0") => ({
  playerID,
  random: {Die: () => 3},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "action",
}) as any;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());
const asView = (G: ImperialElegyState, seat: string | null): RedactedView => redactForView(G, seat);
const seat = (power: Power): string => String(POWERS.indexOf(power));

/** Plant one of every category the split has to separate. */
const plantFlags = (G: ImperialElegyState): void => {
  for (const power of POWERS) {
    G.powers[power].flags = {
      ...G.powers[power].flags,
      // Public, rule-based flags.
      plusCards: 2,
      reserveLimitBonus: 1,
      industryDrm: 2,
      rapidMobilization: true,
      professionalArmy: false,
      // 12.4/A092 public naval limits and the Naval Arms Race discount window.
      navalLimit: 4,
      navalLimitRaised: 4,
      navalSquadronLimit: 4,
      navalDreadnoughtLimit: 4,
      navalDiscount: 1,
      navalDiscountThrough: 3,
      // Private bookkeeping.
      savedCards: `SAVED-${power}`,
      ngChoices: `NG-${power}`,
      cpChainActive: true,
      alreadyInfluenced: true,
      actionCpSpentThisImpulse: true,
      pendingCard: "IE-A017",
    };
  }
};

test("the allowlist contains only rule-public flags and no secret bookkeeping", () => {
  expect(PUBLIC_POWER_FLAGS).toEqual(
    expect.arrayContaining(["powerProjection", "plusCards", "reserveLimitBonus", "industryDrm", "rapidMobilization"]),
  );
  for (const secret of ["savedCards", "ngChoices", "pendingCard", "cpChainActive", "cpChainSpent", "alreadyInfluenced"]) {
    expect(isPublicPowerFlag(secret)).toBe(false);
  }
  expect(publicPowerFlags({powerProjection: 8, savedCards: "IE-A017", plusCards: 1})).toEqual({
    powerProjection: 8,
    plusCards: 1,
  });
  // The split 12.4/A092 limits and the discount window are public too.
  expect(
    publicPowerFlags({
      navalLimit: 4,
      navalLimitRaised: 4,
      navalSquadronLimit: 4,
      navalDreadnoughtLimit: 4,
      navalDiscount: 1,
      navalDiscountThrough: 3,
      savedCards: "IE-A017",
    }),
  ).toEqual({
    navalLimit: 4,
    navalLimitRaised: 4,
    navalSquadronLimit: 4,
    navalDreadnoughtLimit: 4,
    navalDiscount: 1,
    navalDiscountThrough: 3,
  });
});

test("an opponent sees the public flags but none of the private ones", () => {
  const G = fresh();
  plantFlags(G);
  const view = asView(G, seat("FR"));

  for (const power of POWERS) {
    if (power === "FR") continue;
    const flags = view.powers[power].flags;
    expect(flags.powerProjection).toBe(G.powers[power].flags.powerProjection);
    expect(flags.plusCards).toBe(2);
    expect(flags.reserveLimitBonus).toBe(1);
    expect(flags.industryDrm).toBe(2);
    expect(flags.rapidMobilization).toBe(true);
    expect(flags.professionalArmy).toBe(false);
    expect(flags.navalLimit).toBe(4);
    expect(flags.navalLimitRaised).toBe(4);
    expect(flags.navalSquadronLimit).toBe(4);
    expect(flags.navalDreadnoughtLimit).toBe(4);
    expect(flags.navalDiscount).toBe(1);
    expect(flags.navalDiscountThrough).toBe(3);
    expect(flags.savedCards).toBeUndefined();
    expect(flags.ngChoices).toBeUndefined();
    expect(flags.pendingCard).toBeUndefined();
    expect(flags.cpChainActive).toBeUndefined();
    expect(flags.alreadyInfluenced).toBeUndefined();
  }
});

test("the owner still sees every flag, including its saved card", () => {
  const G = fresh();
  plantFlags(G);
  const view = asView(G, seat("GE"));
  expect(view.powers.GE.flags).toEqual(G.powers.GE.flags);
  expect(view.powers.GE.flags.savedCards).toBe("SAVED-GE");
});

test("a spectator sees only the public subset", () => {
  const G = fresh();
  plantFlags(G);
  const view = asView(G, null);
  const serialized = JSON.stringify(view);
  for (const power of POWERS) {
    const flags = view.powers[power].flags;
    expect(flags.plusCards).toBe(2);
    expect(flags.savedCards).toBeUndefined();
    expect(flags.ngChoices).toBeUndefined();
    expect(flags.cpChainActive).toBeUndefined();
  }
  for (const power of POWERS) {
    expect(serialized).not.toContain(`SAVED-${power}`);
    expect(serialized).not.toContain(`NG-${power}`);
  }
});

test("a secret saved-card identity in a private flag never reaches another seat", () => {
  const G = fresh();
  G.powers.UK.flags.savedCards = "SAVED-UK-SECRET";
  G.powers.UK.flags.ngChoices = "NG-UK-SECRET";
  G.powers.UK.hand = ["IE-H-UK-3"];

  const own = asView(G, seat("UK"));
  expect(own.powers.UK.flags.savedCards).toBe("SAVED-UK-SECRET");

  for (const viewer of [seat("GE"), seat("FR"), null]) {
    const view = asView(G, viewer);
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("SAVED-UK-SECRET");
    expect(serialized).not.toContain("NG-UK-SECRET");
    expect(view.powers.UK.flags.savedCards).toBeUndefined();
    // The hidden hand is empty for everybody but its owner.
    expect(view.powers.UK.hand).toEqual([]);
  }
});

test("the existing hand, goal and pending leak guarantees are unchanged", () => {
  const G = fresh();
  plantFlags(G);
  G.powers.GE.hand = ["IE-A017"];
  G.powers.GE.goals = ["NG-24"];
  G.pending = {
    id: "d-1",
    kind: "eventChoice",
    power: "GE",
    prompt: "Choose",
    options: [{id: "a", label: "A", secret: true}],
    context: {card: "IE-A017"},
    createdAt: 1,
  };

  const opponent = asView(G, seat("FR"));
  expect(opponent.powers.GE.hand).toEqual([]);
  expect(opponent.powers.GE.goals).toEqual([]);
  expect(opponent.pending?.options).toEqual([]);
  expect(opponent.pending?.context).toEqual({});
  // The opponent's hand and private flags never expose the card identity.
  expect(opponent.powers.GE.flags.savedCards).toBeUndefined();
  expect(opponent.powers.GE.flags.pendingCard).toBeUndefined();
  expect(JSON.stringify(opponent.powers.GE)).not.toContain("IE-A017");
});
