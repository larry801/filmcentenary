/**
 * Imperial Elegy — rule 22.5 (Poland) helpers.
 *
 * "An independent Poland follows all normal minor power rules, however they
 * have 3 special rules:
 *  (1) Poland can build armies equal to the number of Polish spaces they
 *      control +1 (the Polish 4th and 5th armies are reserve armies and must be
 *      placed in the Polish reserve armies holding box during peacetime),
 *  (2) during wartime when the player controlling Poland takes a deploy
 *      reserves action they may also deploy 1 Polish reserve army in addition
 *      to their own armies,
 *  (3) during the end phase an independent Poland builds 2 army steps (instead
 *      of 1)."
 *
 * The counter chart (`public/imperial-elegy/charts/counter-count.png`,
 * transcribed in `engine/counters.ts`) gives Poland 5 army counters and 1 EC:
 * the 1st–3rd armies are standing counters, the 4th and 5th are the reserve
 * counters held in the Polish reserve armies holding box (3.8).  This module
 * is pure: it never mutates state and is safe to call from the end phase, the
 * deploy-reserves move, the demobilisation step and tests.
 */

import {ImperialElegyState, Power, SpaceId} from "../types";
import {SPACES, isNavalBox, neighboursOf} from "../constant/spaces";
import {friendlySpace, hasLoc, isArmyKind, landStackingLimit, landUnitsIn, minorController} from "./rules";
import {nonPlayerCounterRemaining, nonPlayerHasCounterFor} from "./counters";

/** The Polish minor power's name (the map space id is `poland`). */
export const POLAND = "Poland";

/** Rule 22.5(1): the 4th and 5th Polish armies are reserve-army counters. */
export const POLISH_STANDING_COUNTERS = 3;
export const POLISH_RESERVE_ARMY_COUNT = 2;
/** The physical Polish army-counter mix: 5 armies (3 standing + 2 reserve). */
export const POLISH_TOTAL_ARMY_COUNTERS = POLISH_STANDING_COUNTERS + POLISH_RESERVE_ARMY_COUNT;

/** The space that is the Polish home key (Poland has no `MINOR_POWER_HOMES` entry). */
export const POLISH_HOME: SpaceId = "poland";

/** A Polish space is a key whose printed population includes Poles. */
export const isPolishSpace = (space: SpaceId): boolean =>
  SPACES[space]?.nationalities?.includes("Poles") ?? false;

/** The Polish spaces Poland itself currently controls, in id order. */
export const polishControlledSpaces = (G: ImperialElegyState): SpaceId[] =>
  Object.values(SPACES)
    .filter((def) => isPolishSpace(def.id) && G.spaces[def.id]?.control === POLAND)
    .map((def) => def.id)
    .sort();

/**
 * Rule 22.5: Poland is independent once it controls at least one Polish space.
 * A player-allied Poland is still independent (the ally marker records the
 * controlling player, not ownership of the minor), so independence and control
 * are separate questions.
 */
export const isPolandIndependent = (G: ImperialElegyState): boolean =>
  polishControlledSpaces(G).length > 0;

/** The player currently controlling Poland (its allied player), or null. */
export const polishController = (G: ImperialElegyState): Power | null =>
  minorController(G, POLAND);

/** Rule 22.5(1): armies Poland may build = Polish spaces it controls + 1. */
export const polishArmyCap = (G: ImperialElegyState): number =>
  isPolandIndependent(G)
    ? Math.min(POLISH_TOTAL_ARMY_COUNTERS, polishControlledSpaces(G).length + 1)
    : 0;

/**
 * Every Polish army counter in play, on the map **and** in the Polish reserve
 * armies holding box.
 *
 * 22.5(1) settles the cap interpretation: "Poland can build armies equal to
 * the number of Polish spaces they control +1 (the Polish 4th and 5th armies
 * are reserve armies and must be placed in the Polish reserve armies holding
 * box during peacetime)".  The allowance therefore counts all army counters —
 * the ones on the map plus the reserve counters waiting in the box — and 4.2's
 * five-counter mix is the hard ceiling.  Scenario 2 ("Independent Poland")
 * corroborates it: three Polish spaces, three armies on the map and the fourth
 * counter as a reserve army in the box = spaces + 1.
 *
 * Reserve counters are not free: they are built through 20.3 (once the three
 * standing counters are on the map) or 12.8 recruitment, and `polishArmyTotal`
 * is what every build gate compares with `polishArmyCap`.  22.5(2) deployment
 * is the one exception: it moves a counter from the box to the map without
 * changing the total.
 */
export const polishArmyTotal = (G: ImperialElegyState): number =>
  Object.values(G.units).filter((unit) => unit.owner === POLAND && isArmyKind(unit.kind)).length;

/** True while a limited war or the Great War is in progress. */
export const isWartime = (G: ImperialElegyState): boolean => G.war !== null || G.gw?.active === true;

/**
 * The on-map Polish *standing-army* ceiling for the printed 20.3 build step.
 * Only three standing army counters exist: the printed 4th and 5th armies are
 * reserve-army counters, so they never enter the map through the build step
 * (peacetime they must stay in the holding box; in wartime 22.5(2) may deploy
 * them as reserve armies).  `polishArmyCap` still reports the printed
 * spaces + 1 total, which those deployed reserve counters count towards.
 */
export const polishMapArmyCap = (G: ImperialElegyState): number =>
  Math.min(POLISH_STANDING_COUNTERS, polishArmyCap(G));

/** Reserve-army counters currently held in the Polish reserve armies box. */
export const polishReserveIds = (G: ImperialElegyState): string[] => {
  const ids = G.nonPlayerBuildBox?.poland?.reserveArmies ?? [];
  return ids.filter((id) => {
    const unit = G.units[id];
    return unit !== undefined && unit.owner === POLAND && unit.kind === "reserveArmy";
  });
};

/**
 * 5.6.1: a Polish supply source is the Polish home key it controls (no second
 * key is required); otherwise a Polish army traces through friendly spaces to
 * a supply source of the player controlling Poland.
 */
export const polishHasLoc = (G: ImperialElegyState, from: SpaceId): boolean => {
  if (!G.spaces[from]) return false;
  const controller = polishController(G);
  const isSource = (space: SpaceId): boolean =>
    (space === POLISH_HOME && G.spaces[space]?.control === POLAND) ||
    (controller !== null && G.spaces[space] !== undefined && hasLoc(G, controller, space));
  const friendly = (space: SpaceId): boolean =>
    G.spaces[space]?.control === POLAND ||
    G.spaces[space]?.occupiedBy === POLAND ||
    (controller !== null && friendlySpace(G, space, controller));
  if (isSource(from)) return true;
  const seen = new Set<SpaceId>([from]);
  const queue: SpaceId[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of neighboursOf(current)) {
      if (seen.has(next)) continue;
      seen.add(next);
      if (isNavalBox(next)) continue;
      if (!friendly(next)) continue;
      if (isSource(next)) return true;
      queue.push(next);
    }
  }
  return false;
};

/**
 * The space a Polish reserve army may deploy to.  Rule 15.2.3 requires a
 * controlled or occupied main-map space with a land LoC; for the Polish clause
 * the army may join the controller's deployment target, so the preferred space
 * is accepted when it is friendly to the controller/Poland, and Poland's own
 * home key is the deterministic fallback.  Returns null when neither space
 * qualifies.
 *
 * 22.5(2) moves a counter out of the holding box onto the map, so the total
 * 22.5(1) allowance does not change and the deployment is not gated on it (the
 * deployment is exactly how the 4th/5th army counters reach the map during
 * wartime).  5.5.3 stacking still applies.
 */
export const polishDeploySpace = (
  G: ImperialElegyState,
  power: Power,
  preferred: SpaceId | null = null,
): SpaceId | null => {
  if (!isPolandIndependent(G) || polishController(G) !== power) return null;
  const candidates: SpaceId[] = [];
  for (const space of [preferred, POLISH_HOME]) {
    if (space !== null && !candidates.includes(space)) candidates.push(space);
  }
  for (const space of candidates) {
    const def = SPACES[space];
    const state = G.spaces[space];
    if (!def || !state) continue;
    if (isNavalBox(space) || def.submap !== "main") continue;
    const heldBySide =
      state.control === POLAND ||
      state.occupiedBy === POLAND ||
      state.control === power;
    if (!heldBySide) continue;
    if (!polishHasLoc(G, space)) continue;
    // 5.5.3: a deploy-reserves placement still cannot end overstacked.
    const armies = landUnitsIn(G, space).filter((unit) => isArmyKind(unit.kind)).length;
    if (armies >= landStackingLimit(space)) continue;
    return space;
  }
  return null;
};

/** The player who may take the printed Polish reserve deployment, if any. */
export const polishReserveDeployer = (G: ImperialElegyState): Power | null => {
  if (!isPolandIndependent(G) || !isWartime(G)) return null;
  if (polishReserveIds(G).length === 0) return null;
  return polishController(G);
};

// ---------------------------------------------------------------------------
// 12.8 / 22.5 — player-initiated Polish recruitment
// ---------------------------------------------------------------------------

/**
 * 12.8 Minor Power Alliance: "The allied player can build more of that minor
 * power's units.  This includes armies in excess of those in the End Phase
 * Build Box.  However, the amount of armies and naval units a minor power can
 * have is limited by the counter mix."  The 22.5 clauses then cap Poland.
 *
 * Costs are the printed 12.2 costs: 1 CP per army step and 2 CP for an elite
 * corps.  A new army may be built reduced (1 step) or full (2 steps); flipping
 * a reduced Polish army to full always costs 1 CP.
 */
export type PolishRecruitKind = "army" | "reserveArmy" | "eliteCorps";

/** The counter chart's Polish row: 5 armies and 1 EC (`engine/counters.ts`). */
export const POLISH_ELITE_CORPS_COUNTERS = 1;

export interface PolishRecruitDecision {
  /** The player whose impulse builds the unit, or null with no seat. */
  power: Power | null;
  minor: typeof POLAND;
  kind: PolishRecruitKind;
  /** The Polish space for an army/EC; null for a reserve box build. */
  space: SpaceId | null;
  /** Steps paid for a new army (1 = reduced, 2 = full). */
  steps: 1 | 2;
  /** Printed CP cost of the action. */
  cost: number;
  allowed: boolean;
  /** Set when the action flips an existing reduced counter instead of placing one. */
  upgradeUnitId: string | null;
  reasons: string[];
}

/** Polish army counters currently on the map (standing + deployed reserves). */
export const polishArmiesOnMap = (G: ImperialElegyState): number =>
  Object.values(G.units).filter(
    (unit) =>
      unit.owner === POLAND &&
      isArmyKind(unit.kind) &&
      unit.space !== null &&
      unit.space !== undefined,
  ).length;

/** Polish standing-army counters owned (on the map; standing counters never sit in the box). */
export const polishStandingArmies = (G: ImperialElegyState): number =>
  Object.values(G.units).filter((unit) => unit.owner === POLAND && unit.kind === "army").length;

/** Every Polish army counter owned, map and holding box alike. */
export const polishArmyCounters = (G: ImperialElegyState): number =>
  Object.values(G.units).filter((unit) => unit.owner === POLAND && isArmyKind(unit.kind)).length;

/**
 * The printed placement conditions for a Polish build: a Polish space on the
 * main map, held by Poland or by the player controlling it, with a Polish LoC.
 */
const polishBuildSpaceReasons = (
  G: ImperialElegyState,
  power: Power,
  space: SpaceId,
): string[] => {
  const reasons: string[] = [];
  const def = SPACES[space];
  const state = G.spaces[space];
  if (!def || !state) return [`Unknown space ${space}`];
  if (isNavalBox(space) || def.submap !== "main") {
    reasons.push("Polish units must be built on the main map");
  }
  if (!isPolishSpace(space)) reasons.push("Polish units must be built in a Polish space");
  if (state.control !== POLAND && state.occupiedBy !== POLAND && state.control !== power) {
    reasons.push("Poland or its controlling player must control the space");
  }
  if (!polishHasLoc(G, space)) reasons.push("The space has no Polish line of communication");
  return reasons;
};

/**
 * Pure 12.8/22.5 decision for a player-initiated Polish build.
 *
 * - only the player holding Poland's ally marker may build (12.8);
 * - only an independent Poland has units to build (22.5);
 * - recruitment is an action-phase action (12.2);
 * - a standing army/EC goes to a Polish space with a LoC and stacking room,
 *   while the 4th/5th reserve counters go to the Polish reserve armies holding
 *   box (3.8, 22.5(1));
 * - the ceiling is Polish spaces controlled + 1 **total** army counters, map
 *   plus holding box (max 5, 4.2); a new build needs
 *   `polishArmyTotal < polishArmyCap`, and a standing build additionally needs
 *   one of the three printed standing counters free.
 */
export const polishRecruitDecision = (
  G: ImperialElegyState,
  power: Power | null,
  kind: PolishRecruitKind,
  space: SpaceId | null = null,
  steps: 1 | 2 = 1,
): PolishRecruitDecision => {
  const reasons: string[] = [];
  const decision: PolishRecruitDecision = {
    power,
    minor: POLAND,
    kind,
    space,
    steps,
    cost: kind === "eliteCorps" ? 2 : steps,
    allowed: false,
    upgradeUnitId: null,
    reasons,
  };
  if (power === null) {
    reasons.push("No player controls Poland");
    return decision;
  }
  if (!isPolandIndependent(G)) {
    reasons.push("Poland is not independent");
    return decision;
  }
  if (polishController(G) !== power) {
    reasons.push("Only the player allied to Poland may build its units (12.8)");
    return decision;
  }
  if (G.phase !== "action") {
    reasons.push("Recruitment is an action-phase action (12.2)");
    return decision;
  }
  if (steps !== 1 && steps !== 2) {
    reasons.push("An army build is one or two steps");
    return decision;
  }

  if (kind === "reserveArmy") {
    const reserves = Object.values(G.units).filter(
      (unit) => unit.owner === POLAND && unit.kind === "reserveArmy",
    );
    const reducedInBox = polishReserveIds(G)
      .map((id) => G.units[id])
      .find((unit) => unit !== undefined && unit.steps < 2);
    if (reducedInBox) {
      decision.upgradeUnitId = reducedInBox.id;
      decision.cost = 1;
      decision.allowed = true;
      reasons.push("Flip one reduced Polish reserve army to full strength (12.2)");
      return decision;
    }
    if (reserves.length >= POLISH_RESERVE_ARMY_COUNT) {
      reasons.push("No Polish reserve army counter is available");
      return decision;
    }
    if (polishArmyTotal(G) >= polishArmyCap(G)) {
      reasons.push(`Polish army counters already equal the 22.5 limit (${polishArmyCap(G)})`);
      return decision;
    }
    if (!nonPlayerHasCounterFor(G, POLAND, "army")) {
      reasons.push("No Polish army counter is available");
      return decision;
    }
    decision.allowed = true;
    return decision;
  }

  if (space === null) {
    reasons.push("An army needs a Polish space");
    return decision;
  }
  reasons.push(...polishBuildSpaceReasons(G, power, space));

  if (kind === "eliteCorps") {
    decision.cost = 2;
    const army = landUnitsIn(G, space).find(
      (unit) => unit.owner === POLAND && isArmyKind(unit.kind),
    );
    if (!army) reasons.push("An elite corps needs a Polish army to attach to");
    const ecs = Object.values(G.units).filter(
      (unit) => unit.owner === POLAND && unit.kind === "eliteCorps",
    ).length;
    if (ecs >= POLISH_ELITE_CORPS_COUNTERS) {
      reasons.push("Poland has only one elite corps counter (4.2)");
    }
    if (!nonPlayerHasCounterFor(G, POLAND, "eliteCorps")) {
      reasons.push("No Polish elite corps counter is available");
    }
    decision.allowed = reasons.length === 0;
    return decision;
  }

  // Flipping a reduced army adds no unit, so stacking cannot block it.
  const reduced = landUnitsIn(G, space).find(
    (unit) => unit.owner === POLAND && isArmyKind(unit.kind) && unit.steps < 2,
  );
  if (reduced) {
    decision.upgradeUnitId = reduced.id;
    decision.cost = 1;
    decision.allowed = reasons.length === 0;
    if (decision.allowed) reasons.push("Flip one reduced Polish army to full strength (12.2)");
    return decision;
  }
  // Standing army: 5.5.3 still forbids ending a build overstacked.
  const armies = landUnitsIn(G, space).filter((unit) => isArmyKind(unit.kind)).length;
  if (armies >= landStackingLimit(space)) reasons.push("Stacking limit reached");
  if (polishArmyTotal(G) >= polishArmyCap(G)) {
    reasons.push(`Polish army counters already equal the 22.5 limit (${polishArmyCap(G)})`);
  }
  if (polishStandingArmies(G) >= POLISH_STANDING_COUNTERS) {
    reasons.push("No Polish standing army counter is available");
  }
  if (!nonPlayerHasCounterFor(G, POLAND, "army")) {
    reasons.push("No Polish army counter is available");
  }
  decision.allowed = reasons.length === 0;
  return decision;
};

/** Remaining printed Polish army counters (used by tests and the build UI). */
export const polishArmyCountersRemaining = (G: ImperialElegyState): number | null =>
  nonPlayerCounterRemaining(G, POLAND, "army");
