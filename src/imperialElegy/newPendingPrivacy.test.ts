/**
 * Privacy coverage for the treaty-minor and combat support-deny pendings.
 *
 * These decisions are opened by newer code paths (rule 16.2 realignment, A062
 * Miscommunication and GW-05 Capable Commander) and all reuse the generic
 * `pending`/`combatSupport` plumbing.  Each test checks the authoritative state
 * still holds the secret, then checks the owner's view keeps it while every
 * other seat and a spectator get the redacted decision.
 */

import type {Ctx} from "boardgame.io";
import {setupImperialElegy} from "./engine/setup";
import {redactForView, type RedactedView} from "./engine/privacy";
import {ImperialElegyGameDef} from "./game";
import {POWERS, type ImperialElegyState, type Power, type WarState} from "./types";
import {createWarState} from "./engine/limitedWar";
import {resolvePending, resolveWar} from "./moves";
import {beginLandBattle, chooseSupport, playCombatCard} from "./engine/combat";
import {placeUnit, removeUnit} from "./engine/effects";
import {landUnitsIn} from "./engine/rules";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {
      Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3,
      Number: () => 1,
      Shuffle: (a: unknown[]) => a,
    },
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const SEATS = ["0", "1", "2", "3", "4", "5"] as const;
/** GE sits at seat 0; every other seat is a non-owner. */
const NON_GE = [...SEATS.slice(1), null];

const asView = (G: ImperialElegyState, seat: string | null): RedactedView =>
  redactForView(G, seat);

/** Call the real boardgame.io hook, which is what clients actually receive. */
const viaPlayerView = (G: ImperialElegyState, seat: string | null): RedactedView =>
  ImperialElegyGameDef.playerView!(G, makeCtx([], seat), seat) as RedactedView;

const clearHands = (G: ImperialElegyState): void => {
  for (const power of POWERS) G.powers[power].hand = [];
};

const clearLandUnits = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...landUnitsIn(G, space)]) removeUnit(G, unit.id);
};

const warState = (attacker: Power, defender: Power): WarState => ({
  attacker,
  defender,
  attackerAllies: [],
  defenderAllies: [],
  attackerMinors: [],
  defenderMinors: [],
  warAim: "conquest",
  objectives: [],
  status: "maneuver",
  budgets: {},
  initiative: [],
  treaties: [],
  victor: null,
  truceTurns: 2,
  passed: [],
  startedTurn: 1,
} as unknown as WarState);

/** A normal three-army-vs-three-army land battle with neutral DRMs. */
const stageEvenBattle = (G: ImperialElegyState, ctx: Ctx): void => {
  clearLandUnits(G, "berlin");
  clearLandUnits(G, "saxony");
  for (let i = 0; i < 3; i += 1) placeUnit(G, "GE", "army", "berlin", 2);
  for (let i = 0; i < 3; i += 1) placeUnit(G, "FR", "army", "saxony", 2);
  const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
  if (!battle) throw new Error("battle did not start");
  battle.attackerDrm = 0;
  battle.defenderDrm = 0;
};

const finishSupportWindows = (G: ImperialElegyState, ctx: Ctx): void => {
  let guard = 0;
  while (G.pending?.kind === "combatSupport" && guard++ < 6) {
    // Clear first so the next support window does not suspend the previous one
    // on `pendingStack`; that keeps the redaction assertions focused.
    G.pending = null;
    chooseSupport(G, ctx, "done");
  }
};

/** Rule 16.2 realignment with three legal minors opens the minor chooser. */
const openTreatyMinorPending = (): ImperialElegyState => {
  const G = fresh();
  G.spaces.hanover.ally = "AU";
  G.spaces.saxony.ally = "AU";
  G.spaces.bavaria.ally = "AU";
  G.phase = "wartime";
  G.activePower = "GE";
  G.pending = null;
  G.spaces.bohemia.control = "AU";
  G.spaces.bohemia.occupiedBy = "GE";
  G.war = createWarState(G, "GE", "AU", "conquest", ["bohemia"], 2);
  const ctx = makeCtx([], "0");
  expect(resolveWar(G, ctx)).toBeUndefined();
  expect(G.pending?.kind).toBe("treatyOption");
  expect(resolvePending(G, ctx, "realignment")).toBeUndefined();
  expect(G.pending?.kind).toBe("treatySpace");
  return G;
};

/** Play A062 Miscommunication in a live land battle. */
const openA062Pending = (): ImperialElegyState => {
  const G = fresh();
  G.phase = "wartime";
  G.war = warState("GE", "FR");
  clearHands(G);
  G.powers.GE.hand = ["IE-A062"];
  G.powers.FR.hand = ["IE-A060"];
  clearLandUnits(G, "saxony");
  placeUnit(G, "FR", "army", "saxony", 2);
  const ctx = makeCtx([3, 3]);
  beginLandBattle(G, ctx, "GE", "berlin", "saxony");
  finishSupportWindows(G, ctx);
  expect(G.pending?.kind).toBe("combatCard");
  playCombatCard(G, ctx, "IE-A062");
  expect(G.pending?.kind).toBe("combatSupport");
  expect(G.pending?.context?.supportDeny).toBe(true);
  return G;
};

/** Play GW-05 Capable Commander after the dice in a Great War land battle. */
const openGw05Pending = (): ImperialElegyState => {
  const G = fresh();
  G.phase = "gwManeuver";
  G.gw = {
    active: true,
    turn: 2,
    order: ["GE", "FR"],
    belligerents: ["GE", "FR"],
    neutrals: ["UK", "AU", "RU", "OT"],
    te: ["FR"],
    ta: ["GE"],
    usIn: false,
    italyIn: false,
    usStability: 3,
    usManpower: 3,
    usBudget: 4,
    italyStability: 3,
    italyManpower: 3,
    italyBudget: 2,
    trenches: {},
    lastColonialWar: null,
    victor: null,
    outbreakDone: true,
    nationalWillDone: true,
    bonusImpulses: [],
    combatCardsInFront: [],
  } as NonNullable<ImperialElegyState["gw"]>;
  clearHands(G);
  G.powers.GE.gwCard = "IE-GW-05";
  const ctx = makeCtx([4, 3]);
  stageEvenBattle(G, ctx);
  finishSupportWindows(G, ctx);
  expect(G.pending?.kind).toBe("combatCard");
  playCombatCard(G, ctx, "IE-GW-05");
  expect(G.pending?.kind).toBe("combatSupport");
  expect(G.pending?.context?.gwReroll).toBe(true);
  return G;
};

// ---------------------------------------------------------------------------
// Shared assertions
// ---------------------------------------------------------------------------

/**
 * Seed the top-level card fields that an open decision normally carries.  The
 * real new pending paths leave them null, so seeding them proves the generic
 * redaction branch fires for these decisions instead of passing vacuously.
 */
const plantIncitingCard = (G: ImperialElegyState, cardId: string): void => {
  G.resolvingCard = cardId;
  G.impulseCard = cardId;
  G.flags.pendingCard = cardId;
  G.flags.pendingMandatory = true;
  G.flags.pendingResponse = true;
};

const expectPublicDataVisible = (G: ImperialElegyState, view: RedactedView): void => {
  expect(view.handCounts).toEqual(
    Object.fromEntries(POWERS.map((power) => [power, G.powers[power].hand.length])),
  );
  expect(view.goalCounts).toEqual(
    Object.fromEntries(POWERS.map((power) => [power, G.powers[power].goals.length])),
  );
  expect(view.deckCount).toBe(G.deck.length);
  expect(view.discardCount).toBe(G.discard.length);
  expect(view.removedCount).toBe(G.removed.length);
  expect(view.gwDiscardCount).toBe(G.gw?.discard?.length ?? 0);
  expect(view.faceupCombat).toEqual({GE: "IE-GW-03", FR: "IE-GW-04"});
};

const expectOwnerKeepsDecision = (
  G: ImperialElegyState,
  view: RedactedView,
): void => {
  expect(view.pending).not.toBeNull();
  expect(view.pending!.kind).toBe(G.pending!.kind);
  expect(view.pending!.power).toBe(G.pending!.power);
  expect(view.pending!.options).toEqual(G.pending!.options);
  expect(view.pending!.context).toEqual(G.pending!.context);
  expect(view.pending!.promptArgs).toEqual(G.pending!.promptArgs);
};

const expectNonOwnerDecisionRedacted = (
  G: ImperialElegyState,
  view: RedactedView,
): void => {
  expect(view.pending).not.toBeNull();
  // Public metadata is deliberately preserved.
  expect(view.pending!.kind).toBe(G.pending!.kind);
  expect(view.pending!.power).toBe(G.pending!.power);
  expect(view.pending!.prompt).toBe(G.pending!.prompt);
  // Secret payload is gone.
  expect(view.pending!.options).toEqual([]);
  expect(view.pending!.context).toEqual({});
  expect(view.pending!.promptArgs).toEqual({});
};

const expectIncitingCardHidden = (view: RedactedView): void => {
  expect(view.resolvingCard).toBeNull();
  expect(view.impulseCard).toBeNull();
  expect(view.flags.pendingCard).toBeUndefined();
  expect(view.flags.pendingMandatory).toBeUndefined();
  expect(view.flags.pendingResponse).toBeUndefined();
};

// ---------------------------------------------------------------------------
// 1. Treaty-minor pending
// ---------------------------------------------------------------------------

test("treaty-minor pending exposes minors, victory, remaining and applied only to the winner", () => {
  const G = openTreatyMinorPending();
  const pending = G.pending!;

  // Authoritative state: a real rule 16.2 minor chooser.
  expect(pending.kind).toBe("treatySpace");
  expect(pending.power).toBe("GE");
  expect(pending.context?.kind).toBe("minor");
  expect(pending.options.map((option) => option.id)).toEqual([
    "Hanover",
    "Saxony",
    "Bavaria",
  ]);
  expect(pending.context?.victory).toBeDefined();
  expect(pending.context?.remaining).toBe(1);
  expect(pending.context?.applied).toEqual([]);

  plantIncitingCard(G, "IE-A017");
  G.flags.gwFaceupCombat = "GE:IE-GW-03,FR:IE-GW-04";
  const before = JSON.parse(JSON.stringify(G)) as ImperialElegyState;

  // The winner (GE, seat 0) keeps the full chooser.
  const ownerView = asView(G, "0");
  expectOwnerKeepsDecision(G, ownerView);
  expect(ownerView.resolvingCard).toBe("IE-A017");
  expect(ownerView.impulseCard).toBe("IE-A017");
  expect(ownerView.flags.pendingCard).toBe("IE-A017");
  expectPublicDataVisible(G, ownerView);
  expect(viaPlayerView(G, "0")).toEqual(ownerView);

  // Every other seat and the spectator see an empty decision, but the public
  // prompt/kind/power and all public counters survive.
  for (const seat of NON_GE) {
    const view = asView(G, seat);
    expectNonOwnerDecisionRedacted(G, view);
    expectIncitingCardHidden(view);
    expectPublicDataVisible(G, view);
    for (const option of pending.options) {
      expect(JSON.stringify(view.pending)).not.toContain(option.id);
    }
    expect(JSON.stringify(view.pending)).not.toContain("realignment");
    expect(JSON.stringify(view.pending)).not.toContain("bohemia");
  }

  const spectatorView = asView(G, null);
  expectNonOwnerDecisionRedacted(G, spectatorView);
  expectIncitingCardHidden(spectatorView);
  expectPublicDataVisible(G, spectatorView);
  expect(viaPlayerView(G, "1")).toEqual(asView(G, "1"));
  expect(viaPlayerView(G, null)).toEqual(spectatorView);

  // Redaction is pure: the authoritative chooser is untouched.
  expect(G.pending!.options).toHaveLength(3);
  expect(G.pending!.context?.kind).toBe("minor");
  expect(JSON.parse(JSON.stringify(G))).toEqual(before);
});

// ---------------------------------------------------------------------------
// 2. A062 combat support-deny pending
// ---------------------------------------------------------------------------

test("A062 support-deny pending hides the space options and support-deny context from non-owners", () => {
  const G = openA062Pending();
  const pending = G.pending!;
  const battle = G.battle!;

  // Authoritative state: the card opened a real space chooser.
  expect(pending.kind).toBe("combatSupport");
  expect(pending.power).toBe("GE");
  expect(pending.context).toEqual({
    battle: true,
    supportDeny: true,
    promptKind: "miscommunication",
  });
  expect(pending.options.map((option) => option.id)).toContain("bavaria");
  expect(battle.pendingSupportDeny).toBe(true);
  // The denied-space list is still empty while the choice is open.
  expect(battle.supportDenied ?? []).toEqual([]);

  plantIncitingCard(G, "IE-A062");
  G.flags.gwFaceupCombat = "GE:IE-GW-03,FR:IE-GW-04";
  const before = JSON.parse(JSON.stringify(G)) as ImperialElegyState;

  const ownerView = asView(G, "0");
  expectOwnerKeepsDecision(G, ownerView);
  expect(ownerView.pending!.context?.supportDeny).toBe(true);
  expect(ownerView.pending!.options.map((option) => option.id)).toContain("bavaria");
  expect(ownerView.resolvingCard).toBe("IE-A062");
  expect(ownerView.impulseCard).toBe("IE-A062");
  expect(ownerView.flags.pendingCard).toBe("IE-A062");
  expectPublicDataVisible(G, ownerView);
  expect(viaPlayerView(G, "0")).toEqual(ownerView);

  for (const seat of NON_GE) {
    const view = asView(G, seat);
    expectNonOwnerDecisionRedacted(G, view);
    expectIncitingCardHidden(view);
    expectPublicDataVisible(G, view);
    // No denied space, support-deny marker or card id leaks through the
    // decision payload or the redacted card fields.
    expect(view.pending!.context?.supportDeny).toBeUndefined();
    expect(view.battle?.supportDenied ?? []).toEqual([]);
    for (const option of pending.options) {
      expect(JSON.stringify(view.pending)).not.toContain(option.id);
    }
    expect(JSON.stringify(view)).not.toContain("supportDenied");
    // The combat-card play itself is faceup; only the decision's payload and the
    // inciting-card fields stay private.
    expect(view.log.find((entry) => entry.key === "combatCardPlayed")!.args?.card).toBe("IE-A062");
  }

  const spectatorView = asView(G, null);
  expectNonOwnerDecisionRedacted(G, spectatorView);
  expectIncitingCardHidden(spectatorView);
  expectPublicDataVisible(G, spectatorView);
  expect(viaPlayerView(G, "1")).toEqual(asView(G, "1"));
  expect(viaPlayerView(G, null)).toEqual(spectatorView);

  // Authoritative state is untouched.
  expect(G.pending!.options.map((option) => option.id)).toContain("bavaria");
  expect(G.battle!.supportDenied ?? []).toEqual([]);
  expect(JSON.parse(JSON.stringify(G))).toEqual(before);
});

// ---------------------------------------------------------------------------
// 3. GW-05 reroll-side pending
// ---------------------------------------------------------------------------

test("GW-05 reroll-side pending hides the side options and reroll context from non-owners", () => {
  const G = openGw05Pending();
  const pending = G.pending!;
  const battle = G.battle!;

  // Authoritative state: the post-dice GW-05 window opened a real side chooser.
  expect(pending.kind).toBe("combatSupport");
  expect(pending.power).toBe("GE");
  expect(pending.context).toEqual({battle: true, gwReroll: true});
  expect(pending.options.map((option) => option.id)).toEqual(["attacker", "defender"]);
  expect(battle.rerollPending).toBe(true);
  expect(battle.rerollUsed).toBeUndefined();
  // Authoritative state: the played GW-05 sits in the private GW discard pile.
  expect(G.gw!.discard).toEqual(["IE-GW-05"]);

  plantIncitingCard(G, "IE-GW-05");
  G.flags.gwFaceupCombat = "GE:IE-GW-03,FR:IE-GW-04";
  const before = JSON.parse(JSON.stringify(G)) as ImperialElegyState;

  const ownerView = asView(G, "0");
  expectOwnerKeepsDecision(G, ownerView);
  expect(ownerView.pending!.context?.gwReroll).toBe(true);
  expect(ownerView.pending!.options.map((option) => option.id)).toEqual([
    "attacker",
    "defender",
  ]);
  expect(ownerView.resolvingCard).toBe("IE-GW-05");
  expect(ownerView.impulseCard).toBe("IE-GW-05");
  expect(ownerView.flags.pendingCard).toBe("IE-GW-05");
  expectPublicDataVisible(G, ownerView);
  expect(viaPlayerView(G, "0")).toEqual(ownerView);
  // Owner behaviour follows the top-level discard precedent: the pile's size
  // is visible but its ordering and card ids are not, even to its owner.
  expect(ownerView.gw!.discard).toEqual([]);
  expect(ownerView.gwDiscardCount).toBe(1);

  for (const seat of NON_GE) {
    const view = asView(G, seat);
    expectNonOwnerDecisionRedacted(G, view);
    expectIncitingCardHidden(view);
    expectPublicDataVisible(G, view);
    // The secret side payload/context is gone.  `rerollPending` is public
    // battle status (the battle continues), not the chosen side, so it remains.
    expect(view.pending!.context?.gwReroll).toBeUndefined();
    expect(view.battle?.rerollPending).toBe(true);
    expect(view.battle?.rerollUsed).toBeUndefined();
    // No GW discard card id or ordering leaks; only the public count remains.
    expect(view.gw!.discard).toEqual([]);
    expect(view.gwDiscardCount).toBe(1);
    for (const option of pending.options) {
      expect(JSON.stringify(view.pending)).not.toContain(option.id);
    }
    // The GW-05 combat play is public (a combat card is played openly), but the
    // pile itself holds no card id for any viewer.
    expect(JSON.stringify(view.gw!.discard)).not.toContain("IE-GW-05");
  }

  const spectatorView = asView(G, null);
  expectNonOwnerDecisionRedacted(G, spectatorView);
  expectIncitingCardHidden(spectatorView);
  expectPublicDataVisible(G, spectatorView);
  expect(spectatorView.gw!.discard).toEqual([]);
  expect(spectatorView.gwDiscardCount).toBe(1);
  expect(JSON.stringify(spectatorView.gw!.discard)).not.toContain("IE-GW-05");
  expect(viaPlayerView(G, "1")).toEqual(asView(G, "1"));
  expect(viaPlayerView(G, null)).toEqual(spectatorView);

  // Authoritative state is untouched.
  expect(G.pending!.options.map((option) => option.id)).toEqual(["attacker", "defender"]);
  expect(G.battle!.rerollPending).toBe(true);
  expect(JSON.parse(JSON.stringify(G))).toEqual(before);
});

// ---------------------------------------------------------------------------
// 4. Great War discard privacy
// ---------------------------------------------------------------------------

test("gw.discard card ids are hidden from every viewer and only its count is public", () => {
  const G = openGw05Pending();
  G.flags.gwFaceupCombat = "GE:IE-GW-03,FR:IE-GW-04";
  // Facedown cards in front of a player are public by rule 26.1.
  G.gw!.combatCardsInFront = [{holder: "FR", cardId: "IE-GW-03", faceup: false}];
  G.gw!.discard = [...(G.gw!.discard ?? []), "IE-GW-06"];
  expect(G.gw!.discard).toEqual(["IE-GW-05", "IE-GW-06"]);
  const before = JSON.parse(JSON.stringify(G)) as ImperialElegyState;

  for (const seat of [...SEATS, null]) {
    const view = asView(G, seat);

    // The pile is emptied for everyone; only its size is public.
    expect(view.gw!.discard).toEqual([]);
    expect(view.gwDiscardCount).toBe(G.gw!.discard!.length);

    // Public GW card state in front of players is preserved.
    expect(view.gw!.combatCardsInFront).toEqual(G.gw!.combatCardsInFront);
    expect(view.faceupCombat).toEqual({GE: "IE-GW-03", FR: "IE-GW-04"});
  }

  // No GW discard card id is reachable from the pile; the only public trace is
  // the log line for a combat card that was played faceup on the table.
  for (const seat of [...SEATS, null]) {
    const view = asView(G, seat);
    expect(JSON.stringify(view.gw!.discard)).not.toContain("IE-GW-05");
    expect(JSON.stringify(view.gw!.discard)).not.toContain("IE-GW-06");
  }

  // The owner is not an exception: same precedent as the top-level discard.
  const ownerView = asView(G, "0");
  expect(ownerView.gw!.discard).toEqual([]);
  expect(ownerView.gwDiscardCount).toBe(2);
  // The owner's own play log may still name the card they just played; that
  // is pre-existing owner-visible log behaviour, not the discard pile.

  // Redaction never mutates the authoritative piles.
  expect(JSON.parse(JSON.stringify(G))).toEqual(before);
});
