import {Ctx} from "boardgame.io";
import {
  CardId,
  ImperialElegyState,
  PendingDecision,
  Power,
  POWERS,
  PowerOrMinor,
  SpaceId,
  Unit,
} from "../types";
import {CardDef, Effect, SpaceFilter} from "../constant/cards";
import {SPACES, isNavalBox, neighboursOf, spaceLabel} from "../constant/spaces";
import {FLASHPOINTS, POWER_DEFS} from "../constant/powers";
import {CAMPAIGN_SETUP, MINOR_POWER_HOMES} from "../constant/setup";
import {cardById, CARD_BY_ID, discardCard, drawCards, removeCard} from "./deck";
import {
  ARAB_KEY_SPACES,
  adjacentForLandMove,
  allied,
  atWar,
  changeStability,
  changeWtt,
  computePowerProjection,
  die,
  EGYPTIAN_SPACES,
  controlledBy,
  crossesSuez,
  displacementTargetForLoc,
  dominatedFlashpoints,
  effectiveKeyType,
  enemiesOf,
  friendlySpace,
  hasLoc,
  hostileOwner,
  isHomeSpace,
  isMinorPowerOwner,
  italianMinorSpaces,
  minorController,
  minorFriendlySpace,
  minorHasLoc,
  minorUpkeepPower,
  PAPAL_STATES_SPACE,
  isArmyKind,
  isPower,
  landUnitsIn,
  log,
  ownsKey,
  unitsIn,
  recomputeTracks,
  refreshPowerProjection,
  setSpaceControl,
  unitById,
  unitsOfPower,
} from "./rules";
import {POLAND, isPolandIndependent, polishController, polishHasLoc, polishReserveIds} from "./poland";
import {closeDecision, decision, openDecision, option} from "./pending";
import {gwExhaustionTurnZero} from "./playability";
import {facedownGwCombatCards, flipGwCombatCardFaceup} from "./combatCards";
import {GOALS_BY_ID} from "../constant/goals";
import {crisisRoll, italyTable, openCrisisDecision, unifyItaly} from "./greatWar";
import {
  addPressuredPower,
  adjacentToEnemyArmies,
  drawReplacementGwCard,
  enterGwAlly,
  LAND_ATTACK_TURN_FLAG,
  majorEntryCandidates,
  queueGwExhaustion,
  resolveMajorPowerEntry,
  usAllianceBox,
} from "./greatWarFlow";
import {
  applyItalyAllianceResolution,
  isCommittedBox,
  italyAllianceBox,
  italyEntryOdds,
  rollItalyAllianceResolution,
  type ItalyAllianceShift,
} from "./italyEntry";
import {checkGermanUnification, checkItalianUnification} from "./victory";
import {noteGwUnitEliminated} from "./gwMajors";
import {ALLIANCE_TRACK, shiftAlliance, sideOfAllianceBox, type AllianceShiftResult} from "./alliance";
import {initialNonPlayerBuildBox} from "./endPhase";
import {nonPlayerCounterKindFor, nonPlayerHasCounterFor} from "./counters";
import {
  AU_NATIONALITIES,
  auCitizenshipBlocked,
  isIndependentIndia,
  planIndiaIndependence,
  planIndianArmyDisplacement,
} from "./characteristics";
import {
  eligibleNationalistUprisingSpaces,
  matchedAuCitizenshipCount,
} from "./nationality";

export interface EffectContext {
  /** Extra data supplied by a target decision. */
  targetSpace?: SpaceId;
  targetPower?: Power;
  targetUnit?: string;
  choice?: string;
  /** Effects to run after a decision resolves. */
  resume?: Effect[];
  [key: string]: unknown;
}

const powerOf = (G: ImperialElegyState, actor: Power, target?: "self" | Power): Power =>
  target === undefined || target === "self" ? actor : target;

/** First of the eight AU nationalities that has not been assigned yet. */
const nextAuNationality = (assigned: readonly string[]): string | undefined =>
  AU_NATIONALITIES.find((nationality) => !assigned.includes(nationality));

/**
 * The powers a card flag applies to.  `"others"` is A75's printed "all other
 * players"; `"self"` keeps the historical per-power bag for every other
 * `duration: "turn"`/`"war"` card.  The `"global"` scope never reaches here.
 */
const flagRecipients = (actor: Power, scope: "self" | "others"): readonly Power[] =>
  scope === "others" ? POWERS.filter((power) => power !== actor) : [actor];

export const placeUnit = (
  G: ImperialElegyState,
  owner: PowerOrMinor,
  kind: Unit["kind"],
  space: SpaceId | null,
  steps: 1 | 2,
  extra: Partial<Unit> = {},
): Unit => {
  const id = `u${G.nextUnitId++}`;
  const unit: Unit = {
    id,
    kind,
    owner,
    steps,
    space,
    naval: ["squadron", "dreadnought"].includes(kind),
    ...extra,
  };
  G.units[id] = unit;
  if (space !== null && G.spaces[space]) G.spaces[space].units.push(id);
  return unit;
};

/**
 * Rule 4.2 — place a **non-player** counter only while its printed chart row
 * still has that counter available.
 *
 * Legacy creation sites (20.3 minor builds, the 22.4 Italian rebuild, the 25.2
 * US entry, and the Zulu/Mahdi/Boxer/Meiji event placements) used to call
 * `placeUnit` directly, which could exceed the transposed non-player mix.  They
 * now call this guard: an exhausted row logs `nonPlayerCounterExhausted` and
 * skips the placement instead of over-placing.  Owners the chart does not print
 * (Tuscany, Egypt, `REBEL:Sepoy`, …) keep the deliberate "no invented cap"
 * behaviour of `nonPlayerHasCounterFor` and are always placed.
 *
 * Player powers are not routed through here; their own builds already go
 * through `hasCounterFor` in `recruit`/`constructFleet`/`buildEf`/the GW draft.
 */
export const placeNonPlayerCounter = (
  G: ImperialElegyState,
  owner: PowerOrMinor,
  kind: Unit["kind"],
  space: SpaceId | null,
  steps: 1 | 2,
  extra: Partial<Unit> = {},
): Unit | null => {
  if (!isPower(owner)) {
    const poolKind = nonPlayerCounterKindFor(kind);
    if (poolKind !== null && !nonPlayerHasCounterFor(G, owner, poolKind)) {
      log(G, undefined, "nonPlayerCounterExhausted", {owner, kind, pool: poolKind, space});
      return null;
    }
  }
  return placeUnit(G, owner, kind, space, steps, extra);
};

export const removeUnit = (G: ImperialElegyState, unitId: string): void => {
  const unit = G.units[unitId];
  if (!unit) return;
  // 32.1: an eliminated US army costs the US 1 stability (and may surrender it).
  if (G.gw?.active) noteGwUnitEliminated(G, unit);
  if (!G.units[unitId]) return;
  // 22.4: destroyed Italian units go to the Italy space of the Minor Power
  // Build Box, from where 20.3 rebuilds them at full strength.
  if (unit.owner === "IT" && (unit.kind === "italianArmy" || unit.kind === "squadron" || unit.kind === "dreadnought")) {
    const box = (G.nonPlayerBuildBox ??= initialNonPlayerBuildBox());
    box.italy[unit.kind] += 1;
  }
  if (unit.space && G.spaces[unit.space]) {
    G.spaces[unit.space].units = G.spaces[unit.space].units.filter((id) => id !== unitId);
  }
  delete G.units[unitId];
};

/**
 * Rule 33.2.3 — place or upgrade the Indian Fort.
 *
 * The UK can only do this with one of their home cards (the Sun Never Sets
 * card); the standard Construct Fort action can neither place nor upgrade it.
 * The marker lives in India, its maximum level is 2, and its `indian` flag is
 * what exempts it from the 20.2 end-phase degradation.  An existing Indian
 * fort is upgraded rather than replaced, so a level-1 marker becomes level 2.
 */
export const placeIndianFort = (G: ImperialElegyState, space: SpaceId = "india", level: 1 | 2 = 1): boolean => {
  const state = G.spaces[space];
  if (!state) return false;
  // 33.2.2: independence removes the Indian Fort and it can never come back.
  if (G.powers.UK.indiaIndependent === true && space === "india") return false;
  if (state.fort && state.fort.indian !== true) return false;
  const current = state.fort?.level ?? 0;
  // First placement is level 1; the card's other use upgrades it to level 2.
  const next = (current >= 1 && level < 2 ? 2 : Math.max(current, level)) as 1 | 2;
  state.fort = {power: "UK", level: next, indian: true};
  log(G, "UK", "indianFortPlaced", {space, level: next});
  return true;
};

/** Move an on-map unit to another space without any rule checks. */
const moveUnitTo = (G: ImperialElegyState, unit: Unit, to: SpaceId): void => {
  if (unit.space) {
    const from = G.spaces[unit.space];
    if (from) from.units = from.units.filter((id) => id !== unit.id);
  }
  G.spaces[to].units.push(unit.id);
  unit.space = to;
};

// ---------------------------------------------------------------------------
// 5.7 — general displacement
// ---------------------------------------------------------------------------

export interface UnitDisplacementResult {
  unitId: string;
  owner: PowerOrMinor;
  from: SpaceId;
  /** Destination, or null when the unit had nowhere legal to go and was eliminated. */
  to: SpaceId | null;
  kind: "land" | "naval";
  eliminated: boolean;
}

/** Deterministic breadth-first search for the closest space satisfying `accept`. */
const closestSpace = (
  G: ImperialElegyState,
  from: SpaceId,
  accept: (space: SpaceId) => boolean,
): SpaceId | null => {
  if (!G.spaces[from]) return null;
  const seen = new Set<SpaceId>([from]);
  const queue: SpaceId[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of neighboursOf(current)) {
      if (seen.has(next) || isNavalBox(next)) continue;
      seen.add(next);
      if (accept(next)) return next;
      queue.push(next);
    }
  }
  return null;
};

/**
 * 5.7: "Displaced land units are moved to the closest friendly controlled
 * space with a LoC.  There are no restrictions around this.  They are just
 * picked up and moved (teleported)."
 *
 * The BFS walks the printed connection order and returns the first qualifying
 * space, so the result is stable across saves.  An independent minor traces to
 * its own controlled spaces (5.6.1); a controlled minor uses its controller's
 * friendly spaces and LoC.  A rebel (or a non-player major with no anchor) has
 * no friendly controlled space, so it is eliminated by the caller.
 */
export const landDisplacementTarget = (
  G: ImperialElegyState,
  owner: PowerOrMinor,
  from: SpaceId,
): SpaceId | null => {
  if (!G.spaces[from]) return null;
  if (isPower(owner)) return displacementTargetForLoc(G, owner, from);
  if (owner === POLAND) {
    const controller = polishController(G);
    if (controller !== null) return displacementTargetForLoc(G, controller, from);
    return closestSpace(
      G,
      from,
      (space) =>
        (G.spaces[space]?.control === POLAND || G.spaces[space]?.occupiedBy === POLAND) &&
        polishHasLoc(G, space),
    );
  }
  if (isMinorPowerOwner(owner)) {
    const controller = minorController(G, owner) ?? minorUpkeepPower(G, owner);
    if (controller !== null) return displacementTargetForLoc(G, controller, from);
    return closestSpace(
      G,
      from,
      (space) => minorFriendlySpace(G, owner, space) && minorHasLoc(G, owner, space),
    );
  }
  return null;
};

/**
 * 5.7: "Naval units displace to an adjacent naval box."  Adjacent boxes are
 * tried in id order, preferring a box without hostile units; a Suez crossing
 * still requires the canal to be open.
 */
export const navalDisplacementTarget = (
  G: ImperialElegyState,
  owner: PowerOrMinor,
  from: SpaceId,
): SpaceId | null => {
  const boxes = neighboursOf(from)
    .filter((next) => isNavalBox(next))
    .filter((next) => !(crossesSuez(from, next) && G.persistent.suezCanal !== true))
    .sort();
  if (boxes.length === 0) return null;
  const hostile = (box: SpaceId): boolean =>
    unitsIn(G, box).some((unit) => unit.owner !== owner && isPower(owner) && hostileOwner(G, owner, unit.owner));
  return boxes.find((box) => !hostile(box)) ?? boxes[0];
};

/**
 * 5.7 — move one on-map unit to the closest friendly controlled space with a
 * LoC (land) or to an adjacent naval box (naval), with any unit that has no
 * legal destination eliminated.  This is the single reusable displacement
 * helper: the WoI independence step, the treaty cession settlement, the
 * Balkan/American event specials and the demobilisation paths all call it, so
 * they share the printed tie-breaking instead of hand-rolling a "first
 * friendly space" search.
 *
 * Returns null for an unknown unit or a unit that is already off map (in a
 * reserve holding box, for example); such a unit is not displaced.
 */
export const displaceUnitToFriendlyLoc = (
  G: ImperialElegyState,
  unitId: string,
): UnitDisplacementResult | null => {
  const unit = G.units[unitId];
  if (!unit || !unit.space || !G.spaces[unit.space]) return null;
  const from = unit.space;
  const kind: "land" | "naval" = unit.naval === true ? "naval" : "land";
  const to =
    kind === "naval"
      ? navalDisplacementTarget(G, unit.owner, from)
      : landDisplacementTarget(G, unit.owner, from);
  const actor = isPower(unit.owner) ? unit.owner : undefined;
  if (to === null) {
    removeUnit(G, unitId);
    log(G, actor, "unitDisplaced", {unit: unitId, owner: unit.owner, from, to: null, kind, eliminated: true});
    return {unitId, owner: unit.owner, from, to: null, kind, eliminated: true};
  }
  moveUnitTo(G, unit, to);
  log(G, actor, "unitDisplaced", {unit: unitId, owner: unit.owner, from, to, kind, eliminated: false});
  return {unitId, owner: unit.owner, from, to, kind, eliminated: false};
};

/**
 * True when a unit owned by `owner` may stay in a space that is now controlled
 * by `keeper` (a treaty cession or a liberation).  Enemy units leave; the
 * beneficiary's own units, its player allies and its allied minor troops stay.
 */
const unitStaysWithController = (
  G: ImperialElegyState,
  owner: PowerOrMinor,
  state: {ally?: Power | null},
  keeper: PowerOrMinor,
): boolean => {
  if (owner === keeper) return true;
  if (isPower(keeper)) {
    if (isPower(owner) && allied(G, keeper, owner)) return true;
    if (!isPower(owner) && state.ally === keeper) return true;
    if ((owner === "US" || owner === "IT") && !hostileOwner(G, keeper, owner)) return true;
  }
  return false;
};

/**
 * 5.7 / 16.2.1: after a treaty cedes or liberates a space, every unit that is
 * not friendly to the new controller is displaced (to its closest friendly
 * controlled space with a LoC, or eliminated when none exists).
 */
export const displaceUnitsNotFriendlyTo = (
  G: ImperialElegyState,
  space: SpaceId,
  keeper: PowerOrMinor,
): UnitDisplacementResult[] => {
  const state = G.spaces[space];
  if (!state) return [];
  const displaced: UnitDisplacementResult[] = [];
  for (const id of [...state.units]) {
    const unit = G.units[id];
    if (!unit) continue;
    if (unitStaysWithController(G, unit.owner, state, keeper)) continue;
    const result = displaceUnitToFriendlyLoc(G, id);
    if (result) displaced.push(result);
  }
  return displaced;
};

/**
 * 22.5 / 3.8: the Polish reserve armies holding box is created the first time
 * Poland becomes independent.  Add Poland to the End Phase Build Box roster
 * (20.3 only builds for powers in the box) and create its reserve box.
 *
 * 22.5(1) caps **all** Polish army counters (on the map plus this holding box)
 * at the Polish spaces controlled + 1, so independence does not hand Poland two
 * free reserve counters: the 4th and 5th army counters are built by the 20.3
 * build step (once the three standing counters are on the map) or by 12.8
 * recruitment, and live in this box during peacetime.  Idempotent: a second call
 * never creates a second box.
 */
export const registerPolishIndependence = (G: ImperialElegyState): boolean => {
  if (!isPolandIndependent(G)) return false;
  const box = (G.nonPlayerBuildBox ??= initialNonPlayerBuildBox());
  let changed = false;
  if (!box.minors.includes(POLAND)) {
    box.minors.push(POLAND);
    changed = true;
  }
  if (box.poland === undefined) {
    box.poland = {reserveArmies: []};
    changed = true;
  }
  if (changed) {
    log(G, undefined, "polishIndependence", {
      spaces: Object.values(G.spaces).filter((s) => s.control === POLAND).length,
      reserves: polishReserveIds(G).length,
    });
  }
  return changed;
};

/**
 * 33.2 The Indian Army: "Indian armies automatically displace to Bengal or
 * India: (1) at the end of a turn, or (2) the conclusion of a war the UK
 * participated in."
 *
 * Pure planning lives in `characteristics.ts#planIndianArmyDisplacement`; this
 * applies it, keeps every unit on the map and returns how many armies moved.
 */
export const displaceIndianArmies = (
  G: ImperialElegyState,
  reason: "endOfTurn" | "warEnd",
): number => {
  if (G.powers.UK.eliminated) return 0;
  let moved = 0;
  for (const entry of planIndianArmyDisplacement(G)) {
    if (entry.to === null) continue;
    const unit = G.units[entry.unitId];
    if (!unit) continue;
    moveUnitTo(G, unit, entry.to);
    moved += 1;
    log(G, "UK", "indianArmyDisplaced", {unit: unit.id, from: entry.from, to: entry.to, reason});
  }
  return moved;
};

/**
 * 33.2.2 India independence.  Applies the printed sequence:
 *   - displace all units in India (skipped during the GW);
 *   - eliminate the Indian Fort and all Indian armies except one;
 *   - the UK is limited to 1 Indian army for the rest of the game;
 *   - India cannot be controlled by any player for the rest of the game.
 *
 * Bengal is a separate space (33.2.2 "Important") and is never touched here.
 * Returns false when India was already independent (idempotent).
 */
export const applyIndiaIndependence = (G: ImperialElegyState): boolean => {
  const uk = G.powers.UK;
  if (uk.indiaIndependent === true) return false;
  const plan = planIndiaIndependence(G);
  let displaced = 0;
  for (const entry of [...plan.landDisplacements, ...plan.navalDisplacements]) {
    const unit = G.units[entry.unitId];
    if (!unit) continue;
    moveUnitTo(G, unit, entry.to);
    displaced += 1;
  }
  for (const id of plan.eliminatedUnitIds) removeUnit(G, id);
  const fortRemoved = plan.removeFort;
  G.spaces.india.fort = null;
  for (const id of plan.eliminateIndianArmyIds) removeUnit(G, id);
  uk.indiaIndependent = true;
  uk.indiaStable = false;
  const india = G.spaces.india;
  india.control = null;
  india.influence = null;
  india.diplomacy = null;
  india.ally = null;
  india.occupiedBy = null;
  india.pacification = 0;
  // 30.0/6.x key counting lives in recomputeTracks; India now contributes none.
  recomputeTracks(G);
  log(G, "UK", "indiaIndependence", {
    displaced,
    eliminated: plan.eliminatedUnitIds.length,
    armiesKept: plan.keepIndianArmyId === null ? 0 : 1,
    armiesEliminated: plan.eliminateIndianArmyIds.length,
    fortRemoved,
  });
  return true;
};

/**
 * 33.2 Rapid Deployment: grant the UK one free naval movement action for
 * entering `scope` (a limited war or the Great War).  The grant is refreshed
 * for each new limited war and only once per Great War; `spent` is set by the
 * move layer when the action is used or declined.
 */
export const grantRapidDeployment = (G: ImperialElegyState, scope: "limited" | "gw"): boolean => {
  const uk = G.powers.UK;
  if (!uk || uk.eliminated === true) return false;
  // A new limited war always refreshes the grant; the Great War grants it once.
  if (scope === "gw" && uk.rapidDeployment?.scope === "gw") return false;
  uk.rapidDeployment = {scope, turn: G.turn, spent: false};
  return true;
};

export const damageUnit = (G: ImperialElegyState, unitId: string, steps = 1): void => {
  const unit = G.units[unitId];
  if (!unit) return;
  unit.steps -= steps;
  if (unit.steps <= 0) removeUnit(G, unitId);
};

export const addReserve = (G: ImperialElegyState, power: Power, count: number): void => {
  const p = G.powers[power];
  for (let i = 0; i < count; i += 1) {
    const unit = placeUnit(G, power, "reserveArmy", null, 2);
    p.reserves.push(unit.id);
  }
};

export const spendReserveSteps = (G: ImperialElegyState, power: Power, steps: number): number => {
  const p = G.powers[power];
  let remaining = steps;
  for (const id of [...p.reserves]) {
    const unit = G.units[id];
    if (!unit) {
      p.reserves = p.reserves.filter((x) => x !== id);
      continue;
    }
    const take = Math.min(unit.steps, remaining);
    unit.steps -= take;
    remaining -= take;
    if (unit.steps <= 0) {
      removeUnit(G, id);
      p.reserves = p.reserves.filter((x) => x !== id);
    }
    if (remaining <= 0) break;
  }
  return steps - remaining;
};

const matchesFilter = (G: ImperialElegyState, actor: Power, id: SpaceId, filter: SpaceFilter): boolean => {
  const def = SPACES[id];
  const state = G.spaces[id];
  if (!def || !state) return false;
  if (filter.region && def.region !== filter.region) return false;
  if (filter.submap && def.submap !== filter.submap) return false;
  if (filter.type && def.type !== filter.type) return false;
  if (filter.colonial && effectiveKeyType(G, id) !== "colonial") return false;
  if (filter.homeSpace && def.home !== actor) return false;
  if (filter.homeOf === "self" && def.home !== actor) return false;
  if (filter.homeOf === "other" && (def.home === actor || def.home === null)) return false;
  if (filter.uncontrolled && state.control !== null) return false;
  if (filter.controlledBy === "self" && !controlledBy(G, id, actor)) return false;
  if (filter.controlledBy === "enemy" && (state.control === null || !isPower(state.control) || !atWar(G, actor, state.control))) return false;
  if (filter.controlledBy === "neutral" && (state.control === null || isPower(state.control))) return false;
  if (filter.hasUnit && state.units.length === 0) return false;
  if (filter.hasPort && (!def.ports || def.ports.length === 0)) return false;
  if (filter.inFlashpoint && !def.flashpoints?.includes(filter.inFlashpoint)) return false;
  if (filter.excluding?.includes(id)) return false;
  return true;
};

export const legalSpaces = (G: ImperialElegyState, actor: Power, filter: SpaceFilter = {}): SpaceId[] =>
  Object.keys(SPACES).filter((id) => matchesFilter(G, actor, id, filter));

const promptSpaceOptions = (G: ImperialElegyState, actor: Power, filter: SpaceFilter) =>
  legalSpaces(G, actor, filter).map((id) => option(id, spaceLabel(id, "en")));

export const resolveCard = (G: ImperialElegyState, ctx: Ctx, actor: Power, card: CardDef): boolean => {
  G.resolvingCard = card.id;
  if (card.options && card.options.length > 0) {
    openDecision(G, ctx, decision(
      "eventChoice",
      actor,
      "Choose an event option",
      card.options.map((o, index) => option(`opt${index}`, o.label, {index})),
      {cardId: card.id, options: card.options.map((o) => o.effects)},
    ));
    return false;
  }
  return resolveEffects(G, ctx, actor, card.effects, {});
};

/** Run effects in order.  Returns false when a decision interrupts the chain. */
export const resolveEffects = (
  G: ImperialElegyState,
  ctx: Ctx,
  actor: Power,
  effects: Effect[],
  data: EffectContext,
): boolean => {
  for (let i = 0; i < effects.length; i += 1) {
    const effect = effects[i];
    const resume = effects.slice(i + 1);
    const done = performEffect(G, ctx, actor, effect, data, resume);
    if (!done) return false;
  }
  // 23.0/23.1: several inciting events raise the WTT inside a special handler
  // (Powder Keg, Naval Arms Race, Balkan Wars, Bosnian Crisis) instead of the
  // `wtt` effect.  Catch that here, once the handler's own text has been
  // followed, so those printed Crisis Table rows are reachable in live play.
  // A decision opened mid-chain returns false above and never reaches this.
  if (G.wtt >= 5 && !G.gw?.active && G.pending === null) {
    openCrisisDecision(G, ctx, actor, []);
    return false;
  }
  return true;
};

export const resumeEffects = (G: ImperialElegyState, ctx: Ctx, pending: PendingDecision, data: EffectContext): void => {
  const resume = (pending.context?.resume as Effect[] | undefined) ?? [];
  const actor = pending.power;
  if (resume.length > 0) {
    resolveEffects(G, ctx, actor, resume, data);
  }
  // 23.0/23.1: a special handler that raised the WTT inside a card-choice chain
  // (e.g. Naval Arms Race) must still open the Crisis Table once the chain's
  // printed text has been followed.  `resolveEffects` already does this for
  // chains with a non-empty resume list; this covers the chain-special path.
  if (G.wtt >= 5 && !G.gw?.active && G.pending === null) {
    openCrisisDecision(G, ctx, actor, []);
    return;
  }
  G.resolvingCard = null;
};

const openTargetSpace = (
  G: ImperialElegyState,
  ctx: Ctx,
  actor: Power,
  effect: Extract<Effect, {type: "targetSpace"}>,
  resume: Effect[],
): boolean => {
  const options = promptSpaceOptions(G, actor, effect.filter);
  if (options.length === 0) {
    log(G, actor, "noLegalTarget", {card: G.resolvingCard});
    return true;
  }
  openDecision(G, ctx, decision(
    "eventTargetSpace",
    actor,
    "Choose a space",
    options,
    {resume, then: effect.then, filter: effect.filter, count: effect.count ?? 1},
  ));
  return false;
};

const openTargetPower = (
  G: ImperialElegyState,
  ctx: Ctx,
  actor: Power,
  effect: Extract<Effect, {type: "targetPower"}>,
  resume: Effect[],
): boolean => {
  const powers = POWERS.filter((p) => p !== actor || effect.filter.side === "self");
  const filtered = powers.filter((p) => {
    if (effect.filter.side === "enemy" && !atWar(G, actor, p)) return false;
    if (effect.filter.side === "ally" && !allied(G, actor, p)) return false;
    if (effect.filter.side === "neutral" && G.powers[p].alliance !== "neutral") return false;
    if (effect.filter.hasCards && G.powers[p].hand.length === 0) return false;
    if (effect.filter.stabilityAtMost !== undefined && G.powers[p].stability > effect.filter.stabilityAtMost) return false;
    return true;
  });
  if (filtered.length === 0) {
    log(G, actor, "noLegalTarget", {card: G.resolvingCard});
    return true;
  }
  openDecision(G, ctx, decision(
    "eventTargetPower",
    actor,
    "Choose a power",
    filtered.map((p) => option(p, POWER_DEFS[p].name)),
    {resume, then: effect.then},
  ));
  return false;
};

/**
 * Open an explicit "choose a space" decision for a card special.
 *
 * Returning true when there is no legal space keeps the old behaviour of a
 * special with no target: the remaining effects continue immediately.
 */
const openSpecialSpace = (
  G: ImperialElegyState,
  ctx: Ctx,
  actor: Power,
  handler: string,
  spaces: SpaceId[],
  prompt: string,
  resume: Effect[],
): boolean => {
  if (spaces.length === 0) return true;
  openDecision(G, ctx, decision(
    "eventTargetSpace",
    actor,
    prompt,
    spaces.map((id) => option(id, spaceLabel(id, "en"))),
    {resume, special: handler},
  ));
  return false;
};

/**
 * A070 Papal Influence: "gain an alliance with the Papal States (Rome)",
 * removing an opposing diplomacy/ally marker in the space first.  Also used
 * for the card's second mode, which targets another Italian minor power.
 */
const allyItalianMinor = (G: ImperialElegyState, actor: Power, space: SpaceId): void => {
  const state = G.spaces[space];
  if (!state) return;
  // An alliance marker replaces whatever diplomacy/ally marker is present.
  state.diplomacy = null;
  state.ally = actor;
  log(G, actor, "minorAlliance", {space});
};

/**
 * The card's Special: "+1 card marker" when the player is allied to the Papal
 * States and at least one other Italian minor power after the event resolves.
 */
const papalInfluenceCardBonus = (G: ImperialElegyState, actor: Power): boolean =>
  G.spaces[PAPAL_STATES_SPACE]?.ally === actor &&
  italianMinorSpaces(G).some((id) => id !== PAPAL_STATES_SPACE && G.spaces[id]?.ally === actor);

const applyPacification = (G: ImperialElegyState, space: SpaceId, value: number): void => {
  const state = G.spaces[space];
  if (!state) return;
  state.pacification = Math.max(0, (state.pacification ?? 0) + value);
};

/** One player's resolved alliance step, for logs and tests. */
export interface AllianceResolutionEntry {
  power: Power;
  /** Total MPIT influence that decided the resolution order (8.6). */
  total: number;
  /** The marker results; null when only one marker was in play (automatic shift). */
  rolls: {te: number; ta: number; neutral: number} | null;
  direction: "te" | "ta" | "neutral" | null;
  /** The shift actually applied (null when the marker did not move). */
  shift: AllianceShiftResult | null;
  /** True when the printed shift was refused because the alliance was full. */
  blocked: boolean;
}

// ------------------------------------------------------------------ card choice chains
/**
 * Multi-step card events (the printed "choose a player, who then chooses a
 * space", the card auctions and the placement rounds) are driven as a chain of
 * ordinary pending decisions.  Every decision carries `context.special` naming
 * the chain plus the remaining `queue`, and `resolveCardDecision` dispatches it
 * back into `resolveCardChain`.  Only `eventTargetSpace` / `eventTargetPower` /
 * `eventChoice` are used, so the generic pending-decision panel renders every
 * step without any UI change.
 *
 * Privacy: the deciding seat is `pending.power`, and `playerView` hides every
 * other seat's options, context and prompt arguments, so an auction bid (the
 * card being played face down) never leaks to the other bidders.
 */
const CARD_CHAIN_SPECIALS: ReadonlySet<string> = new Set([
  "secondOpiumWar",
  "rebellionsInChina",
  "berlinConference",
  "urabiRevolt",
  "moroccanCrisis",
  "navalArmsRace",
  "highSeasFleet",
  "empireOfTheSun",
  "balkanWars",
  "gwSubmarines",
  "gwPoliticalPressure",
  "gwExhaustion",
]);

const QING_CHINA_SPACES = (): SpaceId[] =>
  Object.values(SPACES).filter((s) => s.minorHome === "Qing China").map((s) => s.id);

/** Qing-controlled China spaces that do not already hold a player marker. */
const qingChoiceSpaces = (G: ImperialElegyState, exclude: SpaceId[] = []): SpaceId[] =>
  QING_CHINA_SPACES().filter((id) => G.spaces[id].control === "Qing China" && !exclude.includes(id));

/** Africa-submap spaces that can take an influence marker (12.5.1). */
const africanInfluenceSpaces = (G: ImperialElegyState): SpaceId[] =>
  Object.values(SPACES)
    .filter((s) => s.submap === "africa" && G.spaces[s.id].control === null && G.spaces[s.id].influence === null)
    .map((s) => s.id);

/** Africa-submap spaces with no control marker (a control marker may be placed). */
const africanControlSpaces = (G: ImperialElegyState): SpaceId[] =>
  Object.values(SPACES)
    .filter((s) => s.submap === "africa" && G.spaces[s.id].control === null)
    .map((s) => s.id);

const spaceOptions = (G: ImperialElegyState, spaces: SpaceId[]) =>
  spaces.map((id) => option(id, spaceLabel(id, "en")));

const powerOptions = (powers: readonly Power[]) =>
  powers.map((p) => option(p, POWER_DEFS[p].name));

const chainQueue = (G: ImperialElegyState, powers: readonly Power[]): Power[] =>
  powers.filter((p) => !G.powers[p].eliminated);

/** Close a completed chain and continue the card's remaining effects. */
const finishCardChain = (G: ImperialElegyState, ctx: Ctx, pending: PendingDecision): void => {
  closeDecision(G, ctx);
  resumeEffects(G, ctx, pending, {});
};

/**
 * 33.2.2: after independence "India cannot be controlled by any player for the
 * rest of the game".  Every event/treaty marker write funnels through here so a
 * legacy or card path cannot quietly re-control India; the write is skipped and
 * the rejection is logged.  Bengal is a separate space (33.2.2 "Important").
 */
const rejectIndependentIndiaMarker = (
  G: ImperialElegyState,
  actor: Power | undefined,
  space: SpaceId | undefined,
  marker: "control" | "influence" | "diplomacy" | "ally",
): boolean => {
  if (!space || !isIndependentIndia(G, space)) return false;
  log(G, actor, "indiaMarkerRejected", {space, marker});
  return true;
};

/** A79 Loose Grip names these three Ottoman spaces; it takes all it can. */
export const LOOSE_GRIP_CARD = "IE-A079" as const;
export const LOOSE_GRIP_SPACES: readonly SpaceId[] = ["tripoli", "benghazi", "tunisia"];

/**
 * A79: "Remove from the game if Tunisia and Libya are no longer Ottoman
 * controlled."  Libya is the two printed spaces (Tripoli and Benghazi), so the
 * condition holds once none of the three is Ottoman controlled.
 */
export const looseGripRemovalDue = (G: ImperialElegyState): boolean =>
  LOOSE_GRIP_SPACES.every((id) => G.spaces[id]?.control !== "OT");

/**
 * A79: move the card to the removed pile when its printed condition holds.
 * `reason` is public provenance only (a live control change, the event, or a
 * CP play); the card id is public because the removal is a deck event.
 */
export const removeLooseGripIfDue = (
  G: ImperialElegyState,
  reason: "control" | "cp" | "event",
): boolean => {
  if (!looseGripRemovalDue(G)) return false;
  // The check runs at every live control change; only the first removal logs.
  if (G.removed.includes(LOOSE_GRIP_CARD)) return false;
  removeCard(G, LOOSE_GRIP_CARD);
  log(G, undefined, "looseGripRemoved", {reason});
  return true;
};

/** Give a power a control marker, clearing the minor markers it replaces. */
export const placeControlMarker = (G: ImperialElegyState, space: SpaceId, control: PowerOrMinor): void => {
  const state = G.spaces[space];
  if (!state) return;
  if (rejectIndependentIndiaMarker(G, isPower(control) ? control : undefined, space, "control")) return;
  setSpaceControl(G, space, control, {clearInfluence: true, clearDiplomacy: true});
  // A79: a live control change on Tunisia/Libya can trigger the card's printed
  // removal from the game (this path covers every event/treaty marker write).
  if (LOOSE_GRIP_SPACES.includes(space)) removeLooseGripIfDue(G, "control");
};

/**
 * Displace every unit in `space` that does not belong to `keep` (or to a minor
 * power allied with `keep`) to a friendly space, eliminating units with nowhere
 * to go ("Displace units" on the Balkan cards).
 */
const displaceUnits = (G: ImperialElegyState, space: SpaceId, keep: PowerOrMinor): SpaceId[] => {
  const state = G.spaces[space];
  if (!state) return [];
  const moved: SpaceId[] = [];
  for (const id of [...state.units]) {
    const unit = G.units[id];
    if (!unit) continue;
    if (unit.owner === keep) continue;
    if (!isPower(unit.owner) && state.ally === keep) continue;
    // 5.7: the general helper picks the closest friendly LoC space instead of
    // the old first-in-SPACES haven, and handles minor-owned units too.
    const result = displaceUnitToFriendlyLoc(G, id);
    if (result?.to) moved.push(result.to);
  }
  return moved;
};

// ------------------------------------------------------------------ auctions
/** Cards a player may play face down in an auction ("not a mandatory event"). */
const auctionCards = (G: ImperialElegyState, power: Power): CardId[] =>
  G.powers[power].hand.filter((id) => {
    const card = cardById(id);
    return card.kind !== "home" && card.type !== "mandatory" && card.type !== "mandatoryResponse";
  });

const auctionOptions = (G: ImperialElegyState, power: Power) => [
  ...auctionCards(G, power).map((id) => option(`card:${id}`, cardById(id).title, {card: id}, true)),
  option("pass", "Play no card"),
];

const AUCTION_BID_FLAG = "auctionBid";
const AUCTION_CARD_FLAG = "auctionCard";

/** Play an auction card face down: it leaves the hand and its printed CP is bid. */
const playAuctionCard = (G: ImperialElegyState, power: Power, cardId: CardId): number => {
  const card = cardById(cardId);
  G.powers[power].hand = G.powers[power].hand.filter((id) => id !== cardId);
  if (card.remove) G.removed.push(cardId);
  else G.discard.push(cardId);
  // Remember the face-down card privately; the public reveal happens once the
  // whole auction resolves (`auctionCardsRevealed`).
  G.powers[power].flags[AUCTION_CARD_FLAG] = cardId;
  return card.cp;
};

const auctionBid = (G: ImperialElegyState, power: Power): number =>
  Number(G.powers[power].flags[AUCTION_BID_FLAG] ?? 0);

/** The face-down card a power played in the current auction, if any. */
const auctionCard = (G: ImperialElegyState, power: Power): CardId | null => {
  const card = G.powers[power].flags[AUCTION_CARD_FLAG];
  return typeof card === "string" && card !== "" ? card : null;
};

/** Public reveal of the auction's played cards, after every bid is in. */
const revealAuctionCards = (G: ImperialElegyState, auction: "urabi" | "morocco", powers: readonly Power[]): void => {
  const cards = [...new Set(powers)]
    .map((power) => auctionCard(G, power))
    .filter((card): card is CardId => card !== null);
  if (cards.length > 0) log(G, undefined, "auctionCardsRevealed", {auction, cards: cards.join(",")});
};

const clearAuctionBids = (G: ImperialElegyState, powers: readonly Power[]): void => {
  for (const power of powers) {
    delete G.powers[power].flags[AUCTION_BID_FLAG];
    delete G.powers[power].flags[AUCTION_CARD_FLAG];
  }
};

/**
 * Highest d6 + bonus wins; ties are rerolled among the tied leaders.  The
 * printed auctions are resolved with the server-authoritative dice, so the
 * result is deterministic for a given seed.
 */
const auctionWinner = (
  G: ImperialElegyState,
  ctx: Ctx,
  contenders: {power: Power; bonus: number}[],
): {winner: Power; totals: Partial<Record<Power, number>>} => {
  let remaining: {power: Power; bonus: number}[] = [...contenders];
  let totals: Partial<Record<Power, number>> = {};
  for (let attempt = 0; attempt < 30 && remaining.length > 0; attempt += 1) {
    const scored = remaining.map((entry) => ({power: entry.power, bonus: entry.bonus, total: entry.bonus + die(ctx, 6)}));
    totals = {};
    for (const entry of scored) totals[entry.power] = entry.total;
    const best = Math.max(...scored.map((entry) => entry.total));
    const leaders = scored.filter((entry) => entry.total === best);
    if (leaders.length === 1) return {winner: leaders[0].power, totals};
    remaining = leaders;
  }
  return {winner: remaining[0]?.power ?? contenders[0].power, totals};
};

/**
 * Rule 8.6: alliance resolutions run from the highest total influence down,
 * with ties broken by turn order (the fixed GE, UK, FR, AU, RU, OT seat order).
 * Powers with no influence at all have nothing to resolve and are skipped.
 */
export const allianceResolutionOrder = (G: ImperialElegyState): Power[] =>
  POWERS.map((power, index) => ({power, index, total: G.powers[power].mpit.te + G.powers[power].mpit.ta + G.powers[power].mpit.neutral}))
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total || a.index - b.index)
    .map((entry) => entry.power);

/**
 * Rule 8.6's tie-break is "the player chooses how they shift".  The
 * deterministic default prefers the direction of the power's current box (a
 * player moving toward the alliance they are already in), then TE, TA, neutral
 * in printed track order.  The live 20.9 step asks the player instead; this
 * default is used by the action-phase alliance events and as the pending
 * decision's decline fallback, so no game can stall on a tie.
 */
const tieBreakDirection = (
  G: ImperialElegyState,
  power: Power,
  tied: readonly AllianceDirection[],
): AllianceDirection => {
  const current = sideOfAllianceBox(G.powers[power].alliance) ?? "neutral";
  if (tied.includes(current)) return current;
  return tied[0];
};

export type AllianceDirection = "te" | "ta" | "neutral";

/** One power's 8.6 roll, before the shift is applied. */
export interface AllianceResolutionRoll {
  power: Power;
  /** MPIT influence at the moment the power resolved. */
  influence: {te: number; ta: number; neutral: number};
  /** The total that fixed the resolution order. */
  total: number;
  /** The marker results; null when only one marker was in play (automatic shift). */
  rolls: {te: number; ta: number; neutral: number} | null;
  /** Directions by result, highest first (printed TE/TA/neutral order on ties). */
  ranked: {side: AllianceDirection; result: number}[];
  /**
   * Directions tied for the highest result.  More than one is the printed
   * "in the case of a tie the player chooses how they shift" (8.6).
   */
  tied: AllianceDirection[];
  /** The direction a non-interactive caller takes (8.6's deterministic default). */
  direction: AllianceDirection;
}

/**
 * Rule 8.6, first half: total a power's influence and roll the markers.
 *
 *  - one influence type ≥ 1: the chit shifts one box in that direction
 *    automatically, no die roll;
 *  - two or three types ≥ 1: two dice are rolled for each marker and the
 *    influence is added as a DRM; the highest result wins, and a differential
 *    of 10 or more shifts two boxes (8.6.1);
 *  - a tie among the top results is the deciding player's choice.
 *
 * The rolls are performed here (and only here) so an interactive caller can
 * suspend the step without re-rolling when play resumes.
 */
export const rollAllianceResolution = (
  G: ImperialElegyState,
  ctx: Ctx,
  power: Power,
): AllianceResolutionRoll => {
  const p = G.powers[power];
  const influence = {te: p.mpit.te, ta: p.mpit.ta, neutral: p.mpit.neutral};
  const present = (["te", "ta", "neutral"] as const).filter((side) => influence[side] >= 1);
  if (present.length === 1) {
    const side = present[0];
    return {
      power,
      influence,
      total: influence.te + influence.ta + influence.neutral,
      rolls: null,
      ranked: [{side, result: influence[side]}],
      tied: [],
      direction: side,
    };
  }
  const rolls = {
    te: die(ctx, 6) + die(ctx, 6) + influence.te,
    ta: die(ctx, 6) + die(ctx, 6) + influence.ta,
    neutral: die(ctx, 6) + die(ctx, 6) + influence.neutral,
  };
  const ranked = (["te", "ta", "neutral"] as const)
    .map((side) => ({side, result: rolls[side]}))
    .sort((a, b) => b.result - a.result || ["te", "ta", "neutral"].indexOf(a.side) - ["te", "ta", "neutral"].indexOf(b.side));
  const top = ranked[0];
  const tied = ranked.filter((entry) => entry.result === top.result).map((entry) => entry.side);
  return {
    power,
    influence,
    total: influence.te + influence.ta + influence.neutral,
    rolls,
    ranked,
    tied,
    direction: tied.length > 1 ? tieBreakDirection(G, power, tied) : top.side,
  };
};

/**
 * Rule 8.6.1: a differential of 10+ between the highest and second-highest
 * results shifts the chit twice "if possible".  A second-highest result is
 * always a remaining marker; on a tie the differential is 0.
 */
export const allianceStepsFor = (roll: AllianceResolutionRoll, direction: AllianceDirection): number => {
  const top = roll.ranked[0];
  const second = roll.ranked.find((entry) => entry.side !== direction);
  return top !== undefined && second !== undefined && top.result - second.result >= 10 ? 2 : 1;
};

/**
 * Rule 8.6, second half: shift the chit, then reset the MPIT except for the
 * marker matching the new Alliance Track box, which is set to 1 (8.5).
 */
export const applyAllianceResolution = (
  G: ImperialElegyState,
  roll: AllianceResolutionRoll,
  direction: AllianceDirection,
): AllianceResolutionEntry => {
  const power = roll.power;
  const p = G.powers[power];
  const steps = allianceStepsFor(roll, direction);
  const shift = shiftAlliance(G, power, direction, steps);
  p.mpit = {te: 0, ta: 0, neutral: 0};
  const position = sideOfAllianceBox(p.alliance);
  if (position === "te") p.mpit.te = 1;
  else if (position === "ta") p.mpit.ta = 1;
  else p.mpit.neutral = 1;
  log(G, power, "allianceResolution", {
    te: roll.rolls?.te ?? roll.influence.te,
    ta: roll.rolls?.ta ?? roll.influence.ta,
    neutral: roll.rolls?.neutral ?? roll.influence.neutral,
    steps: shift.steps,
    blocked: shift.blocked,
    to: p.alliance,
  });
  return {
    power,
    total: roll.total,
    rolls: roll.rolls,
    direction,
    shift,
    blocked: shift.blocked,
  };
};

/**
 * Rule 8.6 — conduct the Alliance Resolution Step.
 *
 * Each player totals their MPIT influence (TE + TA + neutral).  Resolutions run
 * from the highest total down (ties by turn order, 8.6) because the order
 * decides who can still enter an alliance at the three-player cap (8.4).
 * A tied highest roll is resolved with the deterministic default; the live
 * 20.9 end-phase step asks the player instead (`rollAllianceResolution` /
 * `applyAllianceResolution`).
 *
 * Afterwards the MPIT is reset, except the marker matching the new Alliance
 * Track box, which is set to 1 (8.5).
 */
export const resolveAllianceStep = (G: ImperialElegyState, ctx: Ctx): AllianceResolutionEntry[] => {
  const resolved: AllianceResolutionEntry[] = [];
  for (const power of allianceResolutionOrder(G)) {
    const roll = rollAllianceResolution(G, ctx, power);
    resolved.push(applyAllianceResolution(G, roll, roll.direction));
  }
  return resolved;
};

/**
 * Rule 8.6 — the live action-phase Alliance Resolution Step of the Alliance
 * System / Shifting Alliances events.
 *
 * The printed tie ("in the case of a tie the player chooses how they shift")
 * suspends the card exactly like the live 20.9 step: the already-rolled dice
 * and the resolution cursor are kept in the pending decision's context, and
 * the same `allianceTie` pending kind is used for both callers.  Returns false
 * when the card chain suspended on a tie, true when every resolution ran.
 */
export const continueAllianceResolutionEvent = (
  G: ImperialElegyState,
  ctx: Ctx,
  actor: Power,
  order: readonly Power[],
  index: number,
  resume: Effect[],
  resumeOnComplete: boolean,
): boolean => {
  for (let i = Math.max(0, index); i < order.length; i += 1) {
    const power = order[i];
    const roll = rollAllianceResolution(G, ctx, power);
    if (roll.tied.length > 1) {
      openDecision(G, ctx, decision(
        "allianceTie",
        power,
        `${POWER_DEFS[power].name}: the alliance resolution roll is tied — choose the shift`,
        roll.tied.map((side) => option(
          side,
          side === "te" ? "Triple Entente" : side === "ta" ? "Triple Alliance" : "Neutral",
        )),
        {special: "allianceResolution", order: [...order], index: i, roll, resume},
      ));
      return false;
    }
    applyAllianceResolution(G, roll, roll.direction);
  }
  // Rule 8.6: "all players and a unified Italy determine if they shift".  Italy
  // is not a player power, so its own typed MPIT column resolves after the
  // players (it is exempt from the 8.4 cap, so its position cannot change any
  // player's shift) with the printed Italian tie reroll rather than a decision.
  resolveItalyAllianceStep(G, ctx);
  G.flags.allianceResolutionRequested = true;
  // When the effect chain continues synchronously the outer `resolveEffects`
  // loop runs `resume`; only the suspended-and-resumed path owns it here.
  if (resumeOnComplete && resume.length > 0) resolveEffects(G, ctx, actor, resume, {});
  return true;
};

/** Rule 8.6: start the live action-phase resolution for a card event. */
export const beginAllianceResolutionEvent = (
  G: ImperialElegyState,
  ctx: Ctx,
  actor: Power,
  resume: Effect[],
): boolean => continueAllianceResolutionEvent(G, ctx, actor, allianceResolutionOrder(G), 0, resume, false);

/**
 * Rules 8.5/8.6: resolve a unified Italy's own MPIT column.
 *
 * "During this step all players and a unified Italy determine if they shift on
 * the alliance track."  Italy rolls like a player power (one marker shifts
 * automatically; two or three roll 2d6 per marker with influence as a DRM) but
 * rerolls a tie instead of opening a decision.  The 20.9 end phase and the
 * action-phase Alliance System / Shifting Alliances events share this one
 * resolver so their printed behaviour cannot drift apart.
 *
 * Returns the applied shift, or null when Italy is not unified / has no
 * influence (both are legal no-ops).
 */
export const resolveItalyAllianceStep = (
  G: ImperialElegyState,
  ctx: Ctx,
): ItalyAllianceShift | null => {
  if (G.persistent.italyUnified !== true) return null;
  const roll = rollItalyAllianceResolution(G, () => die(ctx, 6));
  if (roll === null) return null;
  const shift = applyItalyAllianceResolution(G, roll);
  log(G, undefined, "italyAllianceResolution", {
    major: "IT",
    te: roll.rolls?.te ?? roll.influence.te,
    ta: roll.rolls?.ta ?? roll.influence.ta,
    neutral: roll.rolls?.neutral ?? roll.influence.neutral,
    direction: roll.direction,
    steps: shift.steps,
    blocked: shift.blocked,
    from: shift.from,
    to: shift.to,
  });
  return shift;
};

/**
 * Rule 8.6 — finish a suspended action-phase resolution when its tie is
 * answered (or declined to the deterministic default).
 */
export const resolveAllianceResolutionTie = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): boolean => {
  const context = pending.context ?? {};
  const roll = context.roll as AllianceResolutionRoll | undefined;
  const order = context.order;
  const index = Number(context.index);
  if (roll === undefined || !Array.isArray(order) || !Number.isFinite(index)) return false;
  if (!roll.tied.includes(optionId as AllianceDirection)) return false;
  applyAllianceResolution(G, roll, optionId as AllianceDirection);
  const resume = (context.resume as Effect[] | undefined) ?? [];
  // The continuation may suspend again on a later power's tie; either way the
  // answered tie was handled.
  continueAllianceResolutionEvent(G, ctx, pending.power, order as Power[], index + 1, resume, true);
  return true;
};

// ------------------------------------------------------------------ chain steps
/**
 * Open the next decision of a chain.  Returns true when a decision was opened
 * and false when the chain has nothing left to ask (the caller then finishes
 * the chain, or - from `doSpecial` - simply continues the effect list).
 */
const openSecondOpiumWarStep = (
  G: ImperialElegyState,
  ctx: Ctx,
  resume: Effect[],
  queue: Power[],
): boolean => {
  const rest = [...queue];
  while (rest.length > 0) {
    const power = rest.shift()!;
    if (G.powers[power].eliminated) continue;
    const spaces = qingChoiceSpaces(G);
    if (spaces.length === 0) {
      log(G, power, "noLegalTarget", {card: G.resolvingCard});
      continue;
    }
    openDecision(G, ctx, decision(
      "eventTargetSpace",
      power,
      `Second Opium War: ${POWER_DEFS[power].name} places a control marker in Qing China`,
      spaceOptions(G, spaces),
      {resume, special: "secondOpiumWar", queue: rest, owner: power, required: true},
    ));
    return true;
  }
  return false;
};

const openRebellionsInChinaPlacement = (
  G: ImperialElegyState,
  ctx: Ctx,
  resume: Effect[],
  power: Power,
  owner: Power,
  stage: "place" | "secondPlace",
): boolean => {
  if (G.powers[power].eliminated) return false;
  const spaces = qingChoiceSpaces(G);
  if (spaces.length === 0) {
    log(G, power, "noLegalTarget", {card: G.resolvingCard});
    return false;
  }
  openDecision(G, ctx, decision(
    "eventTargetSpace",
    power,
    stage === "place"
      ? "Rebellions in China: place your control marker in Qing China"
      : "Rebellions in China: place a control marker in Qing China",
    spaceOptions(G, spaces),
    {resume, special: "rebellionsInChina", stage, owner, required: true},
  ));
  return true;
};

const openBerlinConferenceStep = (
  G: ImperialElegyState,
  ctx: Ctx,
  resume: Effect[],
  queue: {seat: Power; label: string}[],
  owner: Power,
): boolean => {
  const rest = [...queue];
  while (rest.length > 0) {
    const entry = rest[0];
    if (G.powers[entry.seat].eliminated) {
      rest.shift();
      continue;
    }
    const spaces = africanInfluenceSpaces(G);
    if (spaces.length === 0) {
      log(G, entry.seat, "noLegalTarget", {card: G.resolvingCard});
      rest.shift();
      continue;
    }
    openDecision(G, ctx, decision(
      "eventTargetSpace",
      entry.seat,
      `Berlin Conference: ${entry.label} places one influence marker in Africa`,
      spaceOptions(G, spaces),
      {resume, special: "berlinConference", stage: "influence", queue: rest.slice(1), seat: entry.seat, label: entry.label, owner, required: true},
    ));
    return true;
  }
  // The Belgian ally places the Belgian control marker once, in addition to
  // their own marker (the printed card's optional extra placement).
  const belgian = POWERS.find((p) => G.spaces.belgium.ally === p && !G.powers[p].eliminated);
  if (belgian) {
    const spaces = africanControlSpaces(G);
    if (spaces.length > 0) {
      openDecision(G, ctx, decision(
        "eventTargetSpace",
        belgian,
        "Berlin Conference: you may place the Belgian control marker in Africa",
        [...spaceOptions(G, spaces), option("done", "Decline the Belgian control marker")],
        {resume, special: "berlinConference", stage: "belgium", owner, required: true},
      ));
      return true;
    }
  }
  return false;
};

const openUrabiBid = (
  G: ImperialElegyState,
  ctx: Ctx,
  resume: Effect[],
  queue: Power[],
  owner: Power,
): boolean => {
  const rest = [...queue];
  while (rest.length > 0) {
    const power = rest.shift()!;
    if (G.powers[power].eliminated) continue;
    const options = auctionOptions(G, power);
    if (options.length <= 1) {
      // No playable card: the power still rolls, with 0 CP bid.
      G.powers[power].flags[AUCTION_BID_FLAG] = 0;
      continue;
    }
    openDecision(G, ctx, decision(
      "eventChoice",
      power,
      "Urabi Revolt: play a card face down (its CP is your bid) or pass",
      options,
      {resume, special: "urabiRevolt", stage: "bid", queue: rest, owner, required: true},
    ));
    return true;
  }
  return false;
};

/** Roll the Urabi auction and hand Egypt to the highest bidder. */
const resolveUrabiAuction = (G: ImperialElegyState, ctx: Ctx): void => {
  const bidders = chainQueue(G, ["UK", "FR", "OT"]);
  const played = bidders.filter((p) => auctionBid(G, p) > 0).length;
  const contenders = bidders.map((power) => ({
    power,
    bonus: auctionBid(G, power) + (G.spaces.egypt.diplomacy === power || G.spaces.egypt.ally === power ? 2 : 0),
  }));
  if (contenders.length === 0) return;
  const {winner, totals} = auctionWinner(G, ctx, contenders);
  for (const id of EGYPTIAN_SPACES) {
    const state = G.spaces[id];
    if (!state) continue;
    setSpaceControl(G, id, winner, {clearInfluence: true, clearDiplomacy: true});
    state.influence = null;
    state.diplomacy = null;
    // "If the UK or France wins, all Egyptian spaces become colonial home
    // spaces": the home-space half is live.  The Egypt key also becomes a
    // colonial key for that player (the other two spaces are not keys, so
    // they get the home override but keep their printed territory type).
    if (winner === "UK" || winner === "FR") {
      state.homeOverride = winner;
      if (SPACES[id]?.keyType !== undefined) state.keyTypeOverride = "colonial";
    }
  }
  if (played >= 2) changeWtt(G, 1, ctx, G.resolvingCard ?? undefined);
  // Every bid is in: the face-down cards are no longer secret, so reveal their
  // titles publicly before the private bid flags are cleared.
  revealAuctionCards(G, "urabi", bidders);
  clearAuctionBids(G, bidders);
  if (winner === "UK" || winner === "FR") G.persistent.egyptColonialHome = winner;
  // Keep the public track totals in step with the new control/key type; the
  // end phase would otherwise be the first recompute after the event.
  recomputeTracks(G);
};

const openMoroccanBid = (
  G: ImperialElegyState,
  ctx: Ctx,
  resume: Effect[],
  queue: Power[],
  owner: Power,
  controller: Power,
): boolean => {
  const rest = [...queue];
  while (rest.length > 0) {
    const power = rest.shift()!;
    if (G.powers[power].eliminated) continue;
    const options = auctionOptions(G, power);
    if (options.length <= 1) {
      G.powers[power].flags[AUCTION_BID_FLAG] = 0;
      continue;
    }
    openDecision(G, ctx, decision(
      "eventChoice",
      power,
      "Moroccan Crisis: play a card face down (its CP is your bid) or pass",
      options,
      {resume, special: "moroccanCrisis", stage: "bid", queue: rest, owner, controller, required: true},
    ));
    return true;
  }
  // The UK may join one side if it is not already involved.
  if (owner !== "UK" && controller !== "UK" && !G.powers.UK.eliminated && auctionCards(G, "UK").length > 0) {
    const options = [
      ...auctionCards(G, "UK").map((id) => option(`card:${id}:a`, cardById(id).title, {card: id, side: "a"}, true)),
      ...auctionCards(G, "UK").map((id) => option(`card:${id}:b`, cardById(id).title, {card: id, side: "b"}, true)),
      option("pass", "Stay out of the crisis"),
    ];
    openDecision(G, ctx, decision(
      "eventChoice",
      "UK",
      "Moroccan Crisis: you may play a card to help one side",
      options,
      {resume, special: "moroccanCrisis", stage: "uk", owner, controller, required: true},
    ));
    return true;
  }
  return false;
};

const resolveMoroccanAuction = (G: ImperialElegyState, ctx: Ctx, owner: Power, controller: Power): void => {
  const ukFlags = G.powers.UK.flags;
  const ukAid = ukFlags.moroccoUkSide as "a" | "b" | undefined;
  const ukCp = Number(ukFlags.moroccoUkCp ?? 0);
  const contestants = [owner, controller].filter((p) => !G.powers[p].eliminated);
  const played = [owner, controller, "UK" as Power].filter(
    (p) => !G.powers[p].eliminated && auctionBid(G, p) > 0,
  ).length;
  const contenders = contestants.map((power) => ({
    power,
    bonus:
      auctionBid(G, power) +
      (power === owner && ukAid === "a" ? ukCp : 0) +
      (power === controller && ukAid === "b" ? ukCp : 0),
  }));
  if (contenders.length > 0) {
    const {winner} = auctionWinner(G, ctx, contenders);
    placeControlMarker(G, "morocco", winner);
  }
  if (played >= 2) changeWtt(G, 1, ctx, G.resolvingCard ?? undefined);
  // Every bid (including the UK's optional aid card) is in; reveal the titles.
  revealAuctionCards(G, "morocco", [owner, controller, "UK"]);
  clearAuctionBids(G, [owner, controller, "UK"]);
  delete ukFlags.moroccoUkSide;
  delete ukFlags.moroccoUkCp;
};

/** Every space in the Balkans flashpoint (Istanbul included). */
const BALKAN_SPACES: readonly SpaceId[] = [
  "bosnia-herzegovina",
  "serbia",
  "bulgaria",
  "macedonia",
  "greece",
  "romania",
  "istanbul",
];

/** The Balkan minor an independent space belongs to (or null when unknown). */
const balkanMinorOf = (space: SpaceId): string | null => {
  const entry = Object.entries(MINOR_POWER_HOMES).find(([, home]) => home === space);
  return entry ? entry[0] : null;
};

const isIndependentBalkanMinor = (G: ImperialElegyState, space: SpaceId): boolean => {
  const minor = balkanMinorOf(space);
  return minor !== null && G.spaces[space].control === minor;
};

/** Give one Balkan space its independence and displace the occupiers. */
const grantBalkanIndependence = (G: ImperialElegyState, space: SpaceId): void => {
  const minor = balkanMinorOf(space) ?? "Independent";
  placeControlMarker(G, space, minor);
  displaceUnits(G, space, minor);
};

const openBalkanAward = (
  G: ImperialElegyState,
  ctx: Ctx,
  resume: Effect[],
  owner: Power,
): boolean => {
  const options: {id: string; label: string}[] = [];
  for (const space of ["greece", "bulgaria", "serbia"] as SpaceId[]) {
    if (isIndependentBalkanMinor(G, space)) {
      options.push({id: space, label: SPACES[space]?.name ?? space});
    }
  }
  options.push({id: "OT", label: POWER_DEFS.OT.name});
  openDecision(G, ctx, decision(
    "eventChoice",
    owner,
    "The Balkan Wars: give Macedonia to Greece, Bulgaria, Serbia or the Ottomans",
    options.map((entry) => option(entry.id, entry.label)),
    {resume, special: "balkanWars", stage: "award", owner, required: true},
  ));
  return true;
};

const resolveEmpireOfTheSun = (
  G: ImperialElegyState,
  ctx: Ctx,
  owner: Power,
  target: SpaceId,
  discard: boolean,
): void => {
  // "At the end of the war the active player becomes the ally of Japan": the
  // player's ally marker goes on Japan (the minor's home space), which is what
  // `friendlySpace` and `minorAlliesOf` read.
  const crownJapanAlliance = (): void => {
    G.spaces.japan.ally = owner;
    G.spaces.japan.diplomacy = null;
  };
  const defender = G.spaces[target].control;
  if (!isPower(defender)) {
    placeControlMarker(G, target, "Japan");
    G.spaces[target].ally = owner;
    crownJapanAlliance();
    return;
  }
  // Defending naval units in or adjacent to the Pacific Ocean: the box itself
  // plus every port space that touches it.
  const pacificBox: SpaceId = "pacific-ocean";
  const defendingNavy = Object.values(G.units).filter((unit) => {
    if (unit.owner !== defender || unit.naval !== true) return false;
    if (unit.space === pacificBox) return true;
    return Boolean(unit.space) && (SPACES[unit.space as SpaceId]?.ports ?? []).includes(pacificBox);
  });
  if (discard && G.powers[defender].hand.length > 0) {
    const index = die(ctx, G.powers[defender].hand.length) - 1;
    discardCard(G, defender, G.powers[defender].hand[index], "empireOfTheSun");
  }
  // "-1 DRM for each defending naval unit in or adjacent to the Pacific, -1 if
  // the defender immediately discards a random card.  On 3 or more Japan wins."
  const roll = die(ctx, 6) - defendingNavy.length - (discard ? 1 : 0);
  const won = roll >= 3;
  if (won) placeControlMarker(G, target, "Japan");
  if (won) G.spaces[target].ally = owner;
  changeStability(G, defender, -1, ctx);
  // "The defending player decreases stability by 1 and eliminates all their
  // naval units in or adjacent to the Pacific Ocean" (win or lose).
  for (const unit of defendingNavy) removeUnit(G, unit.id);
  crownJapanAlliance();
};

// ------------------------------------------------------------------ GW card helpers
/** Naval boxes a power is adjacent to: its controlled ports and its fleets. */
const navalBoxesOf = (G: ImperialElegyState, power: Power): SpaceId[] => {
  const boxes = new Set<SpaceId>();
  for (const def of Object.values(SPACES)) {
    const state = G.spaces[def.id];
    if (!state || !def.ports?.length) continue;
    if (state.control === power || state.occupiedBy === power) {
      for (const box of def.ports) boxes.add(box);
    }
  }
  for (const unit of unitsOfPower(G, power)) {
    if (unit.naval === true && unit.space) boxes.add(unit.space);
  }
  return [...boxes];
};

const sharedNavalBox = (G: ImperialElegyState, a: Power, b: Power): boolean => {
  const boxes = new Set(navalBoxesOf(G, a));
  return navalBoxesOf(G, b).some((box) => boxes.has(box));
};

const shiftAllianceOnce = (G: ImperialElegyState, power: Power, direction: number): void => {
  const p = G.powers[power];
  const index = ALLIANCE_TRACK.indexOf(p.alliance);
  p.alliance = ALLIANCE_TRACK[Math.max(0, Math.min(ALLIANCE_TRACK.length - 1, index + direction))];
};

/**
 * A92: "Shift both powers away from each other on the Alliance Track (if both
 * neutral, determine shifts randomly)."
 */
const shiftAllianceAway = (G: ImperialElegyState, ctx: Ctx, a: Power, b: Power): void => {
  const indexA = ALLIANCE_TRACK.indexOf(G.powers[a].alliance);
  const indexB = ALLIANCE_TRACK.indexOf(G.powers[b].alliance);
  if (indexA === indexB) {
    // Both neutral (allied powers are never legal targets): one goes each way.
    const roll = die(ctx, 2);
    shiftAllianceOnce(G, a, roll === 1 ? 1 : -1);
    shiftAllianceOnce(G, b, roll === 1 ? -1 : 1);
    return;
  }
  shiftAllianceOnce(G, a, Math.sign(indexA - indexB));
  shiftAllianceOnce(G, b, Math.sign(indexB - indexA));
};

const applyNavalArmsRace = (G: ImperialElegyState, ctx: Ctx, actor: Power, target: Power): void => {
  // "You and the chosen power receive a 1 CP discount when constructing naval
  // squadrons or dreadnoughts for the rest of this turn and during the next
  // turn."  `constructFleet` reads the flag and its expiry turn.
  for (const power of [actor, target]) {
    const p = G.powers[power];
    p.flags.navalDiscount = 1;
    p.flags.navalDiscountThrough = G.turn + 1;
  }
  shiftAllianceAway(G, ctx, actor, target);
  const raised = [actor, target].filter((p) => p === "OT" || p === "AU" || p === "GE");
  if (raised.length > 0) {
    const current = String(G.persistent.navalLimitRaised ?? "").split(",").filter(Boolean);
    for (const power of raised) {
      if (!current.includes(power)) current.push(power);
      G.powers[power].flags.navalLimitRaised = 4;
      G.powers[power].flags.navalSquadronLimit = 4;
      G.powers[power].flags.navalDreadnoughtLimit = 4;
    }
    G.persistent.navalLimitRaised = current.join(",");
  }
  changeWtt(G, 1, ctx, G.resolvingCard ?? undefined);
};

/** GW-07: apply the chosen die modifier, roll and resolve the printed table. */
const applySubmarines = (
  G: ImperialElegyState,
  ctx: Ctx,
  context: Record<string, unknown>,
  optionId: string,
): void => {
  const target = context.target as Power | undefined;
  if (!target) return;
  const drm = optionId === "plus2" ? 2 : optionId === "minus2" ? -2 : 0;
  const raw = die(ctx, 6) + drm;
  // The printed table only covers 1-6; a modified roll is clamped to it.
  const total = Math.max(1, Math.min(6, raw));
  const loss = total <= 3 ? 1 : 2;
  const before = G.powers[target].gwBudget ?? 0;
  // "On 4-6 the loss cannot reduce a budget below 1."
  const after = total >= 4 ? Math.max(1, before - loss) : Math.max(0, before - loss);
  G.powers[target].gwBudget = after;
  let usBox: string | null = null;
  if (total === 6) {
    const box = G.powers[target].alliance;
    const side: "te" | "ta" | null = box.startsWith("te") ? "te" : box.startsWith("ta") ? "ta" : null;
    if (side !== null) {
      const index = ALLIANCE_TRACK.indexOf(usAllianceBox(G));
      const next = ALLIANCE_TRACK[Math.max(0, Math.min(ALLIANCE_TRACK.length - 1, index + (side === "te" ? 1 : -1)))];
      G.persistent.usAlliance = next;
      usBox = next;
      if (isCommittedBox(next)) enterGwAlly(G, ctx, "US", side);
    }
  }
};

/**
 * The chain dispatcher.  Called from `resolveCardDecision` before the generic
 * target/choice handling; it consumes the option and either opens the next
 * step or closes the chain.
 */
const resolveCardChain = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): void => {
  const context = pending.context ?? {};
  const resume = (context.resume as Effect[] | undefined) ?? [];
  const special = String(context.special ?? "");
  const owner = (context.owner as Power | undefined) ?? pending.power;
  switch (special) {
    case "secondOpiumWar": {
      if (G.spaces[optionId]?.control === "Qing China") {
        placeControlMarker(G, optionId, pending.power);
      }
      const queue = (context.queue as Power[] | undefined) ?? [];
      if (!openSecondOpiumWarStep(G, ctx, resume, queue)) finishCardChain(G, ctx, pending);
      return;
    }
    case "rebellionsInChina": {
      if (context.stage === "place") {
        placeControlMarker(G, optionId, pending.power);
        const others = POWERS.filter(
          (p) => p !== pending.power && !G.powers[p].eliminated && qingChoiceSpaces(G).length > 0,
        );
        if (others.length === 0) {
          log(G, pending.power, "noLegalTarget", {card: G.resolvingCard});
          finishCardChain(G, ctx, pending);
          return;
        }
        openDecision(G, ctx, decision(
          "eventTargetPower",
          pending.power,
          "Rebellions in China: choose another player to place a control marker",
          powerOptions(others),
          {resume, special: "rebellionsInChina", stage: "choosePlayer", owner, required: true},
        ));
        return;
      }
      if (context.stage === "choosePlayer") {
        const chosen = optionId as Power;
        if (!openRebellionsInChinaPlacement(G, ctx, resume, chosen, owner, "secondPlace")) {
          finishCardChain(G, ctx, pending);
        }
        return;
      }
      placeControlMarker(G, optionId, pending.power);
      finishCardChain(G, ctx, pending);
      return;
    }
    case "berlinConference": {
      if (context.stage === "belgium") {
        if (optionId !== "done") {
          G.spaces[optionId].influence = null;
          placeControlMarker(G, optionId, "Belgium");
        }
        finishCardChain(G, ctx, pending);
        return;
      }
      const seat = (context.seat as Power | undefined) ?? pending.power;
      G.spaces[optionId].influence = seat;
      log(G, seat, "influencePlaced", {space: optionId});
      const queue = (context.queue as {seat: Power; label: string}[] | undefined) ?? [];
      if (!openBerlinConferenceStep(G, ctx, resume, queue, owner)) finishCardChain(G, ctx, pending);
      return;
    }
    case "urabiRevolt": {
      if (optionId === "pass") G.powers[pending.power].flags[AUCTION_BID_FLAG] = 0;
      else if (optionId.startsWith("card:")) {
        G.powers[pending.power].flags[AUCTION_BID_FLAG] = playAuctionCard(G, pending.power, optionId.slice(5));
      }
      const queue = (context.queue as Power[] | undefined) ?? [];
      if (openUrabiBid(G, ctx, resume, queue, owner)) return;
      resolveUrabiAuction(G, ctx);
      finishCardChain(G, ctx, pending);
      return;
    }
    case "moroccanCrisis": {
      const controller = (context.controller as Power | undefined) ?? owner;
      if (context.stage === "uk") {
        if (optionId === "pass") {
          delete G.powers.UK.flags.moroccoUkSide;
          delete G.powers.UK.flags.moroccoUkCp;
        } else if (optionId.startsWith("card:")) {
          const [, cardId, side] = optionId.split(":");
          const cp = playAuctionCard(G, "UK", cardId);
          // Private per-power flags keep the aid card off the public state.
          G.powers.UK.flags.moroccoUkCp = cp;
          G.powers.UK.flags.moroccoUkSide = side;
          G.powers.UK.flags[AUCTION_BID_FLAG] = cp;
        }
        resolveMoroccanAuction(G, ctx, owner, controller);
        finishCardChain(G, ctx, pending);
        return;
      }
      if (optionId === "pass") G.powers[pending.power].flags[AUCTION_BID_FLAG] = 0;
      else if (optionId.startsWith("card:")) {
        G.powers[pending.power].flags[AUCTION_BID_FLAG] = playAuctionCard(G, pending.power, optionId.slice(5));
      }
      const queue = (context.queue as Power[] | undefined) ?? [];
      if (openMoroccanBid(G, ctx, resume, queue, owner, controller)) return;
      resolveMoroccanAuction(G, ctx, owner, controller);
      finishCardChain(G, ctx, pending);
      return;
    }
    case "navalArmsRace": {
      applyNavalArmsRace(G, ctx, owner, optionId as Power);
      finishCardChain(G, ctx, pending);
      return;
    }
    case "highSeasFleet": {
      if (context.stage === "power") {
        const target = optionId as Power;
        const ports = Object.values(SPACES)
          .filter((s) => (s.ports?.length ?? 0) > 0 && G.spaces[s.id].control === target)
          .map((s) => s.id);
        if (ports.length === 0) {
          log(G, target, "noLegalTarget", {card: G.resolvingCard});
          finishCardChain(G, ctx, pending);
          return;
        }
        openDecision(G, ctx, decision(
          "eventTargetSpace",
          owner,
          `High Seas Fleet: choose a port for ${POWER_DEFS[target].name}'s dreadnought`,
          spaceOptions(G, ports),
          {resume, special: "highSeasFleet", stage: "port", target, owner, required: true},
        ));
        return;
      }
      const target = (context.target as Power | undefined) ?? owner;
      placeUnit(G, target, "dreadnought", optionId, 2);
      log(G, target, "fleetBuilt", {space: optionId, kind: "dreadnought"});
      finishCardChain(G, ctx, pending);
      return;
    }
    case "empireOfTheSun": {
      if (context.stage === "target") {
        const target = optionId;
        const controller = G.spaces[target].control;
        if (!isPower(controller)) {
          resolveEmpireOfTheSun(G, ctx, owner, target, false);
          finishCardChain(G, ctx, pending);
          return;
        }
        // The defender may discard a random card for -1; it is only worth a
        // decision when the defender is a different player with a card in hand.
        if (controller !== owner && G.powers[controller].hand.length > 0) {
          openDecision(G, ctx, decision(
            "eventChoice",
            controller,
            "Empire of the Sun: discard a random card to give Japan -1?",
            [option("discard", "Discard a random card (-1 to Japan's roll)"), option("done", "Keep the cards")],
            {resume, special: "empireOfTheSun", stage: "defender", target, owner, required: true},
          ));
          return;
        }
        resolveEmpireOfTheSun(G, ctx, owner, target, false);
        finishCardChain(G, ctx, pending);
        return;
      }
      const target = (context.target as SpaceId | undefined) ?? "korea";
      resolveEmpireOfTheSun(G, ctx, owner, target, optionId === "discard");
      finishCardChain(G, ctx, pending);
      return;
    }
    case "balkanWars": {
      if (context.stage === "independence") {
        grantBalkanIndependence(G, optionId);
        const chosen = [...((context.chosen as SpaceId[] | undefined) ?? []), optionId];
        const needed = Number(context.needed ?? 0) - 1;
        const remaining = ((context.candidates as SpaceId[] | undefined) ?? []).filter(
          (id) => !chosen.includes(id),
        );
        if (needed > 0 && remaining.length >= needed) {
          openDecision(G, ctx, decision(
            "eventTargetSpace",
            owner,
            "The Balkan Wars: choose another Ottoman space to gain independence",
            spaceOptions(G, remaining),
            {resume, special: "balkanWars", stage: "independence", chosen, needed, candidates: remaining, owner, required: true},
          ));
          return;
        }
        // The remaining choices are forced when every candidate must go.
        for (const space of remaining.slice(0, Math.max(0, needed))) {
          grantBalkanIndependence(G, space);
        }
        if (!openBalkanAward(G, ctx, resume, owner)) finishCardChain(G, ctx, pending);
        return;
      }
      const award = optionId;
      const control = award === "OT" ? "OT" : (balkanMinorOf(award) ?? "Independent");
      placeControlMarker(G, "macedonia", control);
      displaceUnits(G, "macedonia", control);
      finishCardChain(G, ctx, pending);
      return;
    }
    case "gwSubmarines": {
      if (context.stage === "target") {
        const target = optionId as Power;
        openDecision(G, ctx, decision(
          "eventChoice",
          owner,
          "Submarines: you may add +2 or -2 to the die before rolling",
          [option("plus2", "+2 DRM"), option("zero", "No modifier"), option("minus2", "-2 DRM")],
          {resume, special: "gwSubmarines", stage: "drm", target, owner, required: true},
        ));
        return;
      }
      applySubmarines(G, ctx, context, optionId);
      finishCardChain(G, ctx, pending);
      return;
    }
    case "gwPoliticalPressure": {
      const target = optionId as Power;
      addPressuredPower(G, target);
      // "must make an attack later this turn": earlier attacks do not count.
      G.powers[target].flags[LAND_ATTACK_TURN_FLAG] = -1;
      finishCardChain(G, ctx, pending);
      return;
    }
    case "gwExhaustion": {
      // "This event takes effect at the end of this impulse": queue the mode
      // and let `activateGwExhaustion` apply it when the impulse ends.
      const mode = optionId === "vp" ? "vp" : "stability";
      queueGwExhaustion(G, owner, mode);
      finishCardChain(G, ctx, pending);
      return;
    }
    default:
      return;
  }
};

const doSpecial = (G: ImperialElegyState, ctx: Ctx, actor: Power, handler: string, args: Record<string, unknown> = {}, resume: Effect[]): boolean => {
  switch (handler) {
    case "colonialConflict": {
      const candidates = legalSpaces(G, actor, {region: "africa"})
        .concat(legalSpaces(G, actor, {region: "asia"}))
        .concat(legalSpaces(G, actor, {region: "northAmerica"}))
        .filter((id) => {
          const s = G.spaces[id];
          if (s.control === null) return false;
          const home = SPACES[id].home;
          return home !== s.control;
        });
      if (candidates.length === 0) return true;
      openDecision(G, ctx, decision("eventTargetSpace", actor, "Choose a colonial space", candidates.map((id) => option(id, spaceLabel(id, "en"))), {resume, special: handler}));
      return false;
    }
    case "shiftingAlliances": {
      const p = G.powers[actor];
      const choices = [
        {id: "te", label: "Triple Entente"},
        {id: "ta", label: "Triple Alliance"},
        {id: "neutral", label: "Neutral"},
      ];
      openDecision(G, ctx, decision("eventChoice", actor, "Shift your alliance marker", choices.map((c) => option(c.id, c.label)), {resume, special: handler}));
      return false;
    }
    case "liberalReforms": {
      for (const p of POWERS) spendReserveSteps(G, p, 2);
      G.powers[actor].flags.noBuildArmiesThisImpulse = true;
      return true;
    }
    case "choosePlayerStabilityOrCard": {
      const target = args.target as Power | undefined;
      const candidates = POWERS.filter((p) => p !== actor);
      openDecision(G, ctx, decision("eventTargetPower", actor, "Choose a player", candidates.map((p) => option(p, POWER_DEFS[p].name)), {resume, special: "stabilityOrCard", rollBackfire: args.rollBackfire}));
      return false;
    }
    case "newAdministration": {
      const p = G.powers[actor];
      const drawn = p.goalDeck.splice(0, 3);
      if (drawn.length === 0) return true;
      openDecision(G, ctx, decision(
        "goalChoice",
        actor,
        "Draw three National Goals and keep one",
        drawn.map((id) => option(id, GOALS_BY_ID[id]?.title ?? id)),
        {resume, drawn, keep: 1},
      ));
      return false;
    }
    case "divideAndConquer": {
      const choices = [
        {id: "pacify", label: "Add 2 to a pacification value and roll"},
        {id: "rebel", label: "Eliminate a rebel army, place an EF and pacify"},
      ];
      openDecision(G, ctx, decision("eventChoice", actor, "Choose an option", choices.map((c) => option(c.id, c.label)), {resume, special: handler}));
      return false;
    }
    case "foreignInvestment": {
      const choices = POWERS.filter((p) => p === "OT" || p === "RU").map((p) => option(p, POWER_DEFS[p].name));
      openDecision(G, ctx, decision("eventTargetPower", actor, "Give the card to the Ottomans or Russians", choices, {resume, special: handler}));
      return false;
    }
    case "influenceSeaPower": {
      for (const p of POWERS) {
        if (dominatedFlashpoints(G, p).includes("powerProjection")) {
          if (p === "UK") {
            const ukPp = Number(G.powers.UK.flags.powerProjection ?? 0);
            const others = POWERS.filter((x) => x !== "UK").map((x) => Number(G.powers[x].flags.powerProjection ?? 0));
            const maxOther = Math.max(0, ...others);
            if (ukPp > 0 && ukPp >= maxOther * 2) G.powers.UK.flags.plusCards = Number(G.powers.UK.flags.plusCards ?? 0) + 1;
          } else {
            G.powers[p].flags.plusCards = Number(G.powers[p].flags.plusCards ?? 0) + 1;
          }
        }
      }
      return true;
    }
    case "italy": {
      italyTable(G, ctx, actor);
      return true;
    }
    case "sepoyMutiny": {
      G.powers.UK.indiaStable = false;
      G.spaces.india.rebellion = {minor: "Sepoy", step: 0, rebels: []};
      const rebel = placeNonPlayerCounter(G, "REBEL:Sepoy", "rebelArmy", "india", 2);
      if (rebel) G.spaces.india.rebellion.rebels.push(rebel.id);
      return true;
    }
    case "secondOpiumWar": {
      // "The UK player and French player place a control marker in China (the
      // UK places first)."  Each of the two chooses; a power with no legal
      // space is skipped and logged.
      return openSecondOpiumWarStep(G, ctx, resume, chainQueue(G, ["UK", "FR"]));
    }
    case "britishTrade": {
      const uk = G.powers.UK;
      const other = uk.homeCards.find((id) => id !== uk.selectedHomeCard);
      if (other && !uk.hand.includes(other)) uk.hand.push(other);
      return true;
    }
    case "suezCanal": {
      G.persistent.suezCanal = true;
      SPACES.egypt.ports = ["western-mediterranean", "indian-ocean"];
      G.flags.suezBuilt = true;
      return true;
    }
    case "meijiRestoration": {
      G.flags.meiji = true;
      G.persistent.meiji = true;
      setSpaceControl(G, "japan", "Japan");
      placeNonPlayerCounter(G, "Japan", "minorArmy", "japan", 2);
      log(G, actor, "meiji", {});
      return true;
    }
    case "americanCivilWar": {
      G.persistent.acw = true;
      G.flags.acw = true;
      return true;
    }
    case "boxerRebellion": {
      for (const id of ["shandong-peninsula", "shanghai", "guangzhou"]) {
        if (G.spaces[id].control !== null) {
          G.spaces[id].rebellion = {minor: "Boxer", step: 0, rebels: []};
          const rebel = placeNonPlayerCounter(G, "REBEL:Boxer", "rebelArmy", id, 2);
          if (rebel) G.spaces[id].rebellion.rebels.push(rebel.id);
        }
      }
      return true;
    }
    case "berlinConference": {
      // "The limit of one influence marker in Africa is lifted for the rest of
      // the game."  `placeInfluence`/`removeInfluence` read this flag (12.5.2 /
      // 12.6).
      G.persistent.berlinConference = true;
      const order: {seat: Power; label: string}[] = [{seat: actor, label: POWER_DEFS[actor].name}];
      for (const p of ["UK", "FR", "GE"] as Power[]) {
        if (p !== actor) order.push({seat: p, label: POWER_DEFS[p].name});
      }
      if (G.persistent.italyUnified === true) {
        // "A player allied with Italy places Italy's markers; if Italy has no
        // ally the active player places them."  Italy is not a player power, so
        // its marker is represented by its controlling ally's influence marker.
        const ally = POWERS.find(
          (p) => p !== actor && Object.values(SPACES).some(
            (s) => G.spaces[s.id].control === "Italy" && G.spaces[s.id].ally === p,
          ),
        );
        order.push({seat: ally ?? actor, label: "Italy"});
      }
      return openBerlinConferenceStep(G, ctx, resume, order, actor);
    }
    case "quagmire": {
      const candidates = legalSpaces(G, actor, {region: "africa", controlledBy: "enemy"});
      if (candidates.length === 0) return true;
      openDecision(G, ctx, decision("eventTargetSpace", actor, "Choose an African space", candidates.map((id) => option(id, spaceLabel(id, "en"))), {resume, special: handler}));
      return false;
    }
    case "looseGrip": {
      // "Take control of the two spaces in Libya (Tripoli and Benghazi) if they
      // are Ottoman controlled. Take control of Tunisia if it is Ottoman
      // controlled."  The card takes every named space that still qualifies —
      // it is not a choice — and the event is removed from the game once
      // Tunisia and Libya are no longer Ottoman controlled.
      const named = LOOSE_GRIP_SPACES.filter((id) => G.spaces[id]?.control === "OT");
      if (named.length === 0) {
        // "Remove from the game if Tunisia and Libya are no longer Ottoman
        // controlled."  The card is being resolved, so remove it now instead of
        // letting the normal event play discard it.
        removeLooseGripIfDue(G, "event");
        return true;
      }
      for (const id of named) {
        setSpaceControl(G, id, actor);
        log(G, actor, "looseGrip", {space: id});
      }
      return true;
    }
    case "indianNationalism": {
      // 33.2.2: "If the Indian Stability marker was already on its unstable
      // side India immediately gains independence."  The card is the only
      // printed flip-to-unstable event with that clause (Sepoy Mutiny only
      // flips the marker), so independence is applied here.
      if (G.powers.UK.indiaStable === false) applyIndiaIndependence(G);
      else G.powers.UK.indiaStable = false;
      return true;
    }
    case "deathOfFranzJoseph": {
      changeStability(G, "AU", -1, ctx);
      return true;
    }
    case "impulsiveRuler": {
      return true;
    }
    case "removeAnyMinorAlliance": {
      const candidates = Object.values(SPACES)
        .filter((s) => s.flashpoints?.length && G.spaces[s.id].ally !== null)
        .map((s) => s.id);
      return openSpecialSpace(G, ctx, actor, handler, candidates, "Choose a minor power alliance to remove", resume);
    }
    case "chineseIntervention": {
      const candidates = Object.values(SPACES)
        .filter((s) => {
          if (s.minorHome !== "Qing China") return false;
          const control = G.spaces[s.id].control;
          return isPower(control) || control === "Japan";
        })
        .map((s) => s.id);
      return openSpecialSpace(G, ctx, actor, handler, candidates, "Choose a space in Qing China for the Qing army", resume);
    }
    case "graveyardOfEmpires": {
      G.persistent.goe = "afghanistan";
      const ef = landUnitsIn(G, "afghanistan").find((u) => u.kind === "expeditionary");
      if (ef) removeUnit(G, ef.id);
      const influencer = G.spaces.afghanistan.influence;
      if (isPower(influencer)) {
        G.powers[influencer].cardMarkers -= 1;
        G.spaces.afghanistan.influence = null;
      }
      if (isPower(G.spaces.afghanistan.control)) {
        G.powers[G.spaces.afghanistan.control as Power].cardMarkers -= 1;
        G.spaces.afghanistan.control = null;
      }
      return true;
    }
    case "declineOfQing": {
      const qingControlled = Object.values(SPACES)
        .filter((s) => s.minorHome === "Qing China" && G.spaces[s.id].control === "Qing China")
        .map((s) => s.id);
      const replaceable = Object.values(SPACES)
        .filter((s) => s.minorHome === "Qing China" && isPower(G.spaces[s.id].control) && G.spaces[s.id].control !== actor)
        .map((s) => s.id);
      const choosingQing = qingControlled.length > 0;
      return openSpecialSpace(
        G,
        ctx,
        actor,
        handler,
        choosingQing ? qingControlled : replaceable,
        choosingQing ? "Choose a Qing-controlled space" : "Choose another player's space to replace",
        resume,
      );
    }
    case "sickMan": {
      if (matchedAuCitizenshipCount(G) < 4) changeStability(G, "AU", -1, ctx);
      if (G.powers.OT.industry < 4) changeStability(G, "OT", -1, ctx);
      return true;
    }
    case "rebellionsInChina": {
      // "Place a control marker in a Qing-controlled space in China, then
      // choose another player to do the same.  ... does not allow players to
      // place control markers in spaces that already contain control markers."
      return openRebellionsInChinaPlacement(G, ctx, resume, actor, actor, "place");
    }
    case "greatGame": {
      const targets = ["qajar-persia", "kuwait", "balochistan", "central-asia", "afghanistan"].filter((id) => G.spaces[id]);
      return openSpecialSpace(G, ctx, actor, handler, targets, "Choose a space for influence and an EF", resume);
    }
    case "uprisingInIreland": {
      G.spaces.ireland.rebellion = {minor: "Ireland", step: 0, rebels: []};
      const rebel = placeNonPlayerCounter(G, "REBEL:Ireland", "rebelArmy", "ireland", 2);
      if (rebel) G.spaces.ireland.rebellion.rebels.push(rebel.id);
      const controller = G.spaces.ireland.control;
      if (isPower(controller)) {
        changeStability(G, controller, -1, ctx);
        G.powers[controller].cardMarkers -= 1;
      }
      return true;
    }
    case "prussianTradition": {
      // "This event has no effect during the Great War."  The card can still be
      // played as a standard event during a German GW impulse (the response
      // window itself is closed there by playability), but it does nothing.
      if (G.gw?.active === true) return true;
      G.powers.GE.flags.landDrm = 1;
      return true;
    }
    case "folieDeGrandeur": {
      const target = Object.values(SPACES).find((s) => s.region !== "europe" && G.spaces[s.id].control === "FR");
      if (target) applyPacification(G, target.id, 1);
      changeStability(G, "FR", -1, ctx);
      G.powers.FR.cardMarkers -= 1;
      return true;
    }
    case "frenchIntervention": {
      // Indochina and Mexico are the card's special targets; they may still
      // be held by a minor power (but not by a player or the United States).
      const preferred = ["indochina", "mexico"].filter((id) =>
        G.spaces[id] && !isPower(G.spaces[id].control) && G.spaces[id].control !== "United States");
      const general = legalSpaces(G, actor, {uncontrolled: true})
        .filter((id) => SPACES[id].region !== "europe" && !preferred.includes(id));
      return openSpecialSpace(
        G,
        ctx,
        actor,
        handler,
        [...preferred, ...general],
        "Choose an uncontrolled space for French influence and an EF",
        resume,
      );
    }
    case "dualMonarchy": {
      changeStability(G, "AU", 1, ctx);
      const hungarians = AU_NATIONALITIES.find((nationality) => nationality === "Hungarians");
      if (hungarians && !G.powers.AU.citizenship.includes(hungarians)) G.powers.AU.citizenship.push(hungarians);
      G.persistent.dualMonarchy = true;
      G.persistent.dualMonarchyPlayed = true;
      return true;
    }
    case "multiculturalEmpire": {
      // A85 Hungarian Obstinacy blocks both branches of the card.
      if (auCitizenshipBlocked(G)) return true;
      changeStability(G, "AU", -1, ctx);
      const target = nextAuNationality(G.powers.AU.rights) ?? AU_NATIONALITIES[0];
      G.powers.AU.rights.push(target);
      return true;
    }
    case "southGermanConfederation": {
      setSpaceControl(G, "bavaria", "AU");
      G.spaces.bavaria.homeOverride = "AU";
      for (const id of Object.keys(G.units)) {
        if (G.units[id].owner === "Bavaria") removeUnit(G, id);
      }
      return true;
    }
    case "reforms1860s": {
      const roll = die(ctx, 6);
      if (roll <= 2) changeStability(G, "RU", -1, ctx);
      else if (roll <= 4) changeStability(G, "RU", 1, ctx);
      else {
        changeStability(G, "RU", 1, ctx);
        G.powers.RU.cardMarkers += 1;
      }
      return true;
    }
    case "polishRevolt": {
      const polish = Object.values(SPACES).filter((s) => s.nationalities?.includes("Poles") || s.id === "poland");
      const controller = (isPower(G.spaces.poland.control) ? G.spaces.poland.control : actor) as Power;
      const targets = polish.filter((s) => G.spaces[s.id].control === controller).slice(0, 2);
      for (const s of targets) {
        G.spaces[s.id].rebellion = {minor: "Poland", step: 0, rebels: []};
        const rebel = placeNonPlayerCounter(G, "REBEL:Poland", "rebelArmy", s.id, 2);
        if (rebel) G.spaces[s.id].rebellion!.rebels.push(rebel.id);
      }
      if (G.powers[controller].hand.length > 0) {
        const index = die(ctx, G.powers[controller].hand.length) - 1;
        discardCard(G, controller, G.powers[controller].hand[index], "polishRevolt");
      } else changeStability(G, controller, -1, ctx);
      return true;
    }
    case "easternOrthodoxy": {
      const balkan = ["greece", "serbia", "bulgaria", "romania", "macedonia"].map((id) => SPACES[id]).filter((s) => s && G.spaces[s.id].control !== null && !isPower(G.spaces[s.id].control));
      const target = balkan[0];
      if (target) {
        G.spaces[target.id].diplomacy = null;
        G.spaces[target.id].ally = "RU";
      }
      return true;
    }
    case "powderKeg": {
      changeWtt(G, 1, ctx, G.resolvingCard ?? undefined);
      const targets = ["bosnia-herzegovina", "serbia", "bulgaria", "macedonia", "greece"].filter((id) => G.spaces[id]?.control === "OT");
      for (const id of targets.slice(0, 2)) {
        G.spaces[id].rebellion = {minor: "Balkans", step: 0, rebels: []};
        const rebel = placeNonPlayerCounter(G, "REBEL:Balkans", "rebelArmy", id, 2);
        if (rebel) G.spaces[id].rebellion.rebels.push(rebel.id);
      }
      return true;
    }
    case "failedReforms": {
      const armies = Object.values(G.units).filter((u) => u.owner === "OT" && u.kind === "army" && u.steps === 2).slice(0, 2);
      for (const army of armies) army.steps = 1;
      drawCards(G, ctx, actor, 1);
      return true;
    }
    case "nationalism": {
      const candidates = POWERS.filter((p) => p !== actor && Object.values(SPACES).some((s) => s.nationalities?.length && G.spaces[s.id].control === p));
      const target = candidates[0] ?? "AU";
      if (G.powers[target].hand.length > 0) {
        const index = die(ctx, G.powers[target].hand.length) - 1;
        discardCard(G, target, G.powers[target].hand[index], "nationalism");
      } else changeStability(G, target, -1, ctx);
      changeStability(G, actor, 1, ctx);
      return true;
    }
    case "miscommunication": {
      G.flags.miscommunication = true;
      return true;
    }
    case "secretTreaty": {
      const target = Object.values(SPACES).find((s) => s.flashpoints?.length && G.spaces[s.id].ally !== null && G.spaces[s.id].ally !== actor && atWar(G, actor, G.spaces[s.id].ally as Power));
      if (target) G.spaces[target.id].ally = actor;
      return true;
    }
    case "indianOceanArms": {
      const target = Object.values(SPACES).find((s) => (G.spaces[s.id].pacification ?? 0) > 0);
      if (target) applyPacification(G, target.id, -1);
      drawCards(G, ctx, actor, 1);
      return true;
    }
    case "flipReducedRebelToFull": {
      // Flip one reduced rebel army to full strength, preferring a rebel in a
      // space that still has a pacification marker, then draw an extra card.
      const reduced = Object.values(G.units).filter(
        (unit) => unit.kind === "rebelArmy" && unit.steps === 1 && unit.space !== null && unit.space !== undefined,
      );
      const target =
        reduced.find((unit) => (G.spaces[unit.space as SpaceId]?.pacification ?? 0) > 0) ?? reduced[0];
      if (!target) return true;
      target.steps = 2;
      drawCards(G, ctx, actor, 1);
      return true;
    }
    case "internationalConference": {
      G.flags.crisisDrm = Number(G.flags.crisisDrm ?? 0) + 2;
      return true;
    }
    case "theUnitedStates": {
      if (G.persistent.acw) return true;
      const choice = die(ctx, 2);
      if (choice === 1) {
        drawCards(G, ctx, actor, 1);
        G.powers[actor].cardMarkers += 1;
      } else {
        const target = G.spaces.mexico.control === null ? "mexico" : "japan";
        setSpaceControl(G, target, "United States", {clearDiplomacy: true});
        G.spaces[target].diplomacy = null;
        for (const id of [...G.spaces[target].units]) {
          const u = G.units[id];
          if (u && u.owner !== "United States") {
            // 5.7: displaced units keep their identity/steps and go to their
            // own closest friendly LoC space, not the first friendly space of
            // the card's actor.
            displaceUnitToFriendlyLoc(G, id);
          }
        }
        G.cpRemaining += 3;
      }
      return true;
    }
    case "papalInfluence": {
      // "event cannot be played after Italy unifies" and "you cannot trigger
      // this effect if you dominate the Italy flashpoint".
      if (G.persistent.italyUnified === true) return true;
      if (dominatedFlashpoints(G, actor).includes("italy")) return true;
      if (!G.spaces[PAPAL_STATES_SPACE]) return true;
      if (G.spaces[PAPAL_STATES_SPACE].ally === actor) {
        // Already allied: reach one of the other Italian minor powers.
        const targets = italianMinorSpaces(G).filter(
          (id) => id !== PAPAL_STATES_SPACE && G.spaces[id]?.ally !== actor,
        );
        return openSpecialSpace(
          G,
          ctx,
          actor,
          "papalInfluence",
          targets,
          "Papal Influence: choose another Italian minor power to ally",
          resume,
        );
      }
      allyItalianMinor(G, actor, PAPAL_STATES_SPACE);
      if (papalInfluenceCardBonus(G, actor)) G.powers[actor].cardMarkers += 1;
      return true;
    }
    case "urabiRevolt": {
      // "Eliminate the minor power army in Egypt."  Then the printed auction:
      // the UK, France and the Ottomans may each play a card face down (not a
      // mandatory event), each rolls d6 + the card's CP (+2 with a diplomacy or
      // ally marker in Egypt) and the highest total controls all of Egypt.
      for (const id of EGYPTIAN_SPACES) {
        for (const u of landUnitsIn(G, id)) if (u.owner === "Egypt") removeUnit(G, u.id);
      }
      // With no bidders holding a card the auction still has to resolve (every
      // power rolls d6), so only an actually-opened decision interrupts play.
      if (openUrabiBid(G, ctx, resume, chainQueue(G, ["UK", "FR", "OT"]), actor)) return false;
      resolveUrabiAuction(G, ctx);
      return true;
    }
    case "economicPanic": {
      for (const p of POWERS) {
        const hand = G.powers[p].hand.filter((id) => cardById(id).type !== "mandatory");
        if (hand.length > 0) discardCard(G, p, hand[0], "economicPanic");
        else G.powers[p].cardMarkers -= 1;
      }
      return true;
    }
    case "zulus": {
      placeNonPlayerCounter(G, "REBEL:Zulu", "rebelArmy", "south-africa", 1);
      const controller = G.spaces["south-africa"].control;
      if (isPower(controller)) G.powers[controller].cardMarkers -= 1;
      return true;
    }
    case "crackColonialTroops": {
      const target = Object.values(SPACES).find((s) => s.keyType === "colonial" && G.spaces[s.id].control === actor);
      if (target) placeUnit(G, actor, "eliteColonialEf", target.id, 1, {elite: true});
      return true;
    }
    case "conquestCentralAsia": {
      G.spaces["central-asia"].homeOverride = "RU";
      setSpaceControl(G, "central-asia", "RU");
      placeUnit(G, "RU", "reserveArmy", "central-asia", 2);
      G.persistent.russianAsiaReserve = true;
      return true;
    }
    case "nationalistUprising": {
      const candidates = eligibleNationalistUprisingSpaces(G);
      return openSpecialSpace(G, ctx, actor, handler, candidates, "Choose a space containing a minority nationality", resume);
    }
    case "boerWars": {
      G.spaces["south-africa"].pacification = (G.spaces["south-africa"].pacification ?? 0) + 2;
      const controller = G.spaces["south-africa"].control;
      if (isPower(controller)) G.powers[controller].cardMarkers -= 1;
      return true;
    }
    case "mahdistWar": {
      const candidates = Object.values(SPACES)
        .filter((s) => s.region === "africa" && (isPower(G.spaces[s.id].influence) || isPower(G.spaces[s.id].control)))
        .map((s) => s.id);
      return openSpecialSpace(G, ctx, actor, handler, candidates, "Choose an African space with a player marker", resume);
    }
    case "ourPlaceInTheSun": {
      G.powers[actor].flags.freeColonialCp = 5;
      return true;
    }
    case "navalArmsRace": {
      // "Choose one player with whom you are not allied.  That player must
      // either (1) be the UK, or (2) be adjacent to a naval box you are also
      // adjacent to."
      const targets = POWERS.filter(
        (p) => p !== actor &&
          !G.powers[p].eliminated &&
          !allied(G, actor, p) &&
          (p === "UK" || sharedNavalBox(G, actor, p)),
      );
      if (targets.length === 0) {
        log(G, actor, "noLegalTarget", {card: G.resolvingCard});
        return true;
      }
      openDecision(G, ctx, decision(
        "eventTargetPower",
        actor,
        "Naval Arms Race: choose a non-allied player (the UK, or a shared naval box)",
        powerOptions(targets),
        {resume, special: "navalArmsRace", owner: actor, required: true},
      ));
      return false;
    }
    case "empireOfTheSun": {
      // "Japan gains 1 naval unit.  Japan attempts to conquer either Korea or
      // Manchuria (active player's choice).  Do not increase the WTT."
      placeNonPlayerCounter(G, "Japan", "squadron", "japan", 2);
      openDecision(G, ctx, decision(
        "eventChoice",
        actor,
        "Empire of the Sun: choose Korea or Manchuria",
        [option("korea", SPACES.korea.name), option("manchuria", SPACES.manchuria.name)],
        {resume, special: "empireOfTheSun", stage: "target", owner: actor, required: true},
      ));
      return false;
    }
    case "diplomaticRecognition": {
      const target = Object.values(SPACES).find((s) => G.spaces[s.id].rebellion?.step === 0);
      if (target) {
        const rebellion = G.spaces[target.id].rebellion;
        if (rebellion) {
          rebellion.step = 1;
          setSpaceControl(G, target.id, rebellion.minor);
          G.spaces[target.id].rebellion = null;
        }
      }
      return true;
    }
    case "dreadnought": {
      const port = Object.values(SPACES).find((s) => s.region === "europe" && s.ports?.length && G.spaces[s.id].control === actor);
      if (port) placeUnit(G, actor, "dreadnought", port.id, 2);
      else placeUnit(G, actor, "dreadnought", "london", 2);
      G.persistent.dreadnoughts = true;
      return true;
    }
    case "balkanWars": {
      const openBalkanIndependence = (candidates: SpaceId[]): boolean => {
        const needed = Math.min(2, candidates.length);
        if (needed === 0) return false;
        if (candidates.length <= needed) {
          // No choice to make: every remaining Ottoman Balkan space goes.
          for (const space of candidates) grantBalkanIndependence(G, space);
          return false;
        }
        openDecision(G, ctx, decision(
          "eventTargetSpace",
          actor,
          "The Balkan Wars: choose an Ottoman Balkan space to gain independence",
          spaceOptions(G, candidates),
          {resume, special: "balkanWars", stage: "independence", chosen: [], needed, candidates, owner: actor, required: true},
        ));
        return true;
      };
      changeWtt(G, 1, ctx, G.resolvingCard ?? undefined);
      // "If the Ottomans control space(s) in the Balkans other than Istanbul,
      // remove all Ottoman ally markers in the Balkans and roll a die."
      for (const space of BALKAN_SPACES) {
        if (G.spaces[space].ally === "OT") G.spaces[space].ally = null;
      }
      const otBalkan = BALKAN_SPACES.filter((id) => id !== "istanbul" && G.spaces[id].control === "OT");
      if (otBalkan.length > 0) {
        const nonPlayerArmies = otBalkan.reduce(
          (sum, id) => sum + landUnitsIn(G, id).filter((u) => isArmyKind(u.kind) && !isPower(u.owner)).length,
          0,
        );
        const otArmies = otBalkan.reduce(
          (sum, id) => sum + landUnitsIn(G, id).filter((u) => isArmyKind(u.kind) && u.owner === "OT").length,
          0,
        );
        const roll = die(ctx, 6) + nonPlayerArmies - otArmies;
        if (roll >= 5) {
          changeWtt(G, 1, ctx, G.resolvingCard ?? undefined);
          return openBalkanIndependence(otBalkan);
        }
        // "all rebel armies in the Balkans and each independent Balkan minor
        // power army suffer a step loss."
        for (const space of BALKAN_SPACES) {
          for (const unit of landUnitsIn(G, space)) {
            if (!isArmyKind(unit.kind)) continue;
            const independentMinor = !isPower(unit.owner) && G.spaces[space].control === unit.owner;
            if (unit.kind === "rebelArmy" || independentMinor) damageUnit(G, unit.id, 1);
          }
        }
      }
      changeWtt(G, 1, ctx, G.resolvingCard ?? undefined);
      // "The active player gives Macedonia to Greece, Bulgaria, Serbia or the
      // Ottomans (a minor power must be independent)."
      return openBalkanAward(G, ctx, resume, actor);
    }
    case "moroccanCrisis": {
      // "You and the player currently controlling Morocco may play a card
      // facedown ... Then, if not already involved, the UK may play a card to
      // help either side.  The chosen players roll a die adding the CP of the
      // card they played.  The player with the higher total gains control."
      const controller = G.spaces.morocco.control;
      if (!isPower(controller) || controller === actor) {
        log(G, actor, "noLegalTarget", {card: G.resolvingCard});
        return true;
      }
      if (openMoroccanBid(G, ctx, resume, [actor, controller], actor, controller)) return false;
      resolveMoroccanAuction(G, ctx, actor, controller);
      return true;
    }
    case "bosnianCrisis": {
      setSpaceControl(G, "bosnia-herzegovina", "AU");
      G.spaces["bosnia-herzegovina"].homeOverride = "AU";
      // A103 grants Bosnians rights; A85 blocks the grant, not the annexation.
      if (!auCitizenshipBlocked(G) && !G.powers.AU.rights.includes("Bosnians")) {
        G.powers.AU.rights.push("Bosnians");
      }
      if (die(ctx, 6) >= 4) changeWtt(G, 1, ctx, G.resolvingCard ?? undefined);
      return true;
    }
    case "youngTurks": {
      // "Place an Ottoman elite corps with an Ottoman army.  Permanent: (1)
      // increase Turkish manpower by one and (2) the Ottoman player can field
      // 2 ECs instead of one."  `recruit` reads `otTwoElite` for the EC cap and
      // `otManpowerBonus` for the manpower ceiling.  A54 Failed Reforms is
      // printed "Cannot be played after The Young Turks", so record the turn
      // gate for `playability.ts#youngTurksBlocksFailedReforms`.
      const army = Object.values(G.units).find((u) => u.owner === "OT" && u.kind === "army");
      placeUnit(G, "OT", "eliteCorps", army?.space ?? "istanbul", 1);
      G.powers.OT.manpower += 1;
      G.persistent.otTwoElite = true;
      G.persistent.otManpowerBonus = 1;
      G.persistent.youngTurks = true;
      return true;
    }
    case "worldsFair": {
      let discards = 0;
      for (const p of POWERS) {
        const hand = G.powers[p].hand.filter((id) => cardById(id).type !== "mandatory");
        if (hand.length > 0) {
          discardCard(G, p, hand[0], "worldsFair");
          discards += 1;
        }
      }
      if (discards >= 5) changeWtt(G, -2, ctx);
      else if (discards >= 3) changeWtt(G, -1, ctx);
      return true;
    }
    case "highSeasFleet": {
      // "A non-British player of your choice gains one dreadnought."
      const targets = POWERS.filter((p) => p !== "UK" && !G.powers[p].eliminated);
      if (targets.length === 0) {
        log(G, actor, "noLegalTarget", {card: G.resolvingCard});
        return true;
      }
      openDecision(G, ctx, decision(
        "eventTargetPower",
        actor,
        "High Seas Fleet: choose the non-British player who gains a dreadnought",
        powerOptions(targets),
        {resume, special: "highSeasFleet", stage: "power", owner: actor, required: true},
      ));
      return false;
    }
    case "revolution1905": {
      if (G.powers.RU.hand.length > 0) {
        const index = die(ctx, G.powers.RU.hand.length) - 1;
        discardCard(G, "RU", G.powers.RU.hand[index], "revolution1905");
      } else changeStability(G, "RU", -1, ctx);
      drawCards(G, ctx, actor, 1);
      return true;
    }
    case "extremeMilitarism": {
      G.powers[actor].flags.reserveLimitBonus = 1;
      if (G.gw === null) G.powers[actor].vp -= 1;
      return true;
    }
    case "grantRightsOrCitizenship": {
      // A95 Death of Franz Joseph is the prerequisite A112 Franz Ferdinand
      // prints; the two cards share their effect text, so tag the state while
      // A95 itself resolves.  A85 blocks the grant itself but not the record
      // that Franz Joseph has died.
      if (G.resolvingCard === "IE-A095") G.persistent.franzJosephDead = true;
      if (auCitizenshipBlocked(G)) return true;
      const nationality = nextAuNationality(G.powers.AU.citizenship);
      if (nationality && G.powers.AU.rights.includes(nationality)) G.powers.AU.citizenship.push(nationality);
      else if (nationality) G.powers.AU.rights.push(nationality);
      return true;
    }
    case "germanGeneralStaff": {
      changeStability(G, "GE", 1, ctx);
      const candidate = G.discard.find((id) => ["response", "combat"].includes(cardById(id).type));
      if (candidate) {
        G.discard = G.discard.filter((id) => id !== candidate);
        G.powers.GE.hand.push(candidate);
      }
      return true;
    }
    case "sunNeverSets": {
      changeStability(G, "UK", 1, ctx);
      // 33.2.2: once India is independent the marker can no longer be flipped;
      // force the unstable side rather than trusting the stored value.
      G.powers.UK.indiaStable = G.powers.UK.indiaIndependent === true ? false : true;
      placeUnit(G, "UK", "squadron", "london", 2);
      G.powers.UK.flags.freeColonialCp = 2;
      // 33.2.3: the card's second option places the Indian Fort in India (a
      // level-1 marker, or an upgrade to level 2).  The chosen-option split is
      // still the existing simplification; the fort counter itself is created
      // here so 20.2's exemption has a live create path.
      placeIndianFort(G, "india");
      return true;
    }
    case "balanceOfPower": {
      // Option B of the card: "Playable as an event to gain 1 stability.  Draw
      // a card."  Option A (becoming the primary defender of a just-declared
      // war) is the dedicated `moves.playBalanceOfPower` path; the flag below
      // is the public record of either resolution.
      G.powers.UK.flags.balanceOfPower = true;
      changeStability(G, "UK", 1, ctx);
      drawCards(G, ctx, actor, 1);
      return true;
    }
    case "cityOfLightHome": {
      changeStability(G, "FR", 1, ctx);
      G.cpRemaining += 3;
      if (die(ctx, 6) <= G.turn) G.powers.FR.cityOfLight = Math.min(6, (G.powers.FR.cityOfLight ?? 0) + 1);
      return true;
    }
    case "auxArmes": {
      addReserve(G, "FR", 2);
      G.powers.FR.flags.warDeclaration = true;
      return true;
    }
    case "habsburgDynasty": {
      const target = Object.values(SPACES).find((s) => s.flashpoints?.includes("germany") && !isPower(G.spaces[s.id].control));
      if (target) {
        G.spaces[target.id].diplomacy = null;
        G.spaces[target.id].ally = "AU";
      }
      return true;
    }
    case "kaiserreich": {
      changeStability(G, "AU", 1, ctx);
      if (!auCitizenshipBlocked(G)) {
        const nationality = nextAuNationality(G.powers.AU.rights);
        if (nationality) G.powers.AU.rights.push(nationality);
      }
      return true;
    }
    case "russoTurkishWars": {
      G.powers.RU.flags.warDeclaration = true;
      return true;
    }
    case "godSaveTheTsar": {
      // A093 Nicholas II: "Russia's God Save the Tsar home card only grants a
      // stability on a roll of 3 or more."  One roll serves both the stability
      // grant and the TSRR completion check.
      const roll = die(ctx, 6);
      if (G.persistent.nicholasII !== true || roll >= 3) changeStability(G, "RU", 1, ctx);
      if (roll <= G.turn) G.powers.RU.tsrr = true;
      return true;
    }
    case "modernization": {
      changeStability(G, "OT", 1, ctx);
      G.powers.OT.flags.modernization = true;
      return true;
    }
    case "jihadWar": {
      G.powers.OT.flags.warDeclaration = true;
      return true;
    }
    case "bismarckWar": {
      changeStability(G, "GE", 1, ctx);
      G.powers.GE.flags.warDeclaration = true;
      return true;
    }
    case "southGermanConfederationHome": {
      return true;
    }
    case "gwMinorPowerEntry": {
      const minors = Object.values(SPACES).filter((s) => s.minorHome && G.spaces[s.id].control === s.minorHome && !s.keyType);
      const target = minors[0];
      if (target && die(ctx, 6) >= 5) {
        G.spaces[target.id].ally = actor;
        placeNonPlayerCounter(G, target.minorHome!, "minorArmy", target.id, 2);
      }
      return true;
    }
    case "gwMajorPowerEntry": {
      // The play itself is gated by `playGwCardMove` (GW #2 "cannot be played on
      // GW turn 0" except for Italy inside the Outbreak Step).  Here only who
      // can still join matters — the outbreak flag is spent by this very play.
      // The play already checked GW #2's timing; here only who can join matters.
      const majors = majorEntryCandidates(G, actor, "resolve");
      if (majors.length === 0) {
        // "Remove from the game and draw another card if neither Italy nor
        // the US can join."  `playGwCardMove` removes the card afterwards.
        G.flags.gwRemoveAfterEvent = G.resolvingCard ?? "";
        const replacement = drawReplacementGwCard(G, ctx, actor);
        log(G, actor, "gwMajorEntryNone", {drew: replacement !== null});
        return true;
      }
      openDecision(G, ctx, decision(
        "eventChoice",
        actor,
        "Major Power Entry: shift Italy or the US toward your alliance",
        majors.map((major) => option(major, major === "IT" ? `Italy (in ${italyAllianceBox(G)}; ${italyEntryOdds(italyAllianceBox(G))})` : `United States (now ${usAllianceBox(G)})`)),
        {resume, special: "gwMajorEntry"},
      ));
      return false;
    }
    case "gwCapableCommander": {
      G.persistent.gwCardFlipped = true;
      const facedown = facedownGwCombatCards(G);
      if (facedown.length === 0) return true;
      // GW-05's event mode chooses one facedown in-front card and flips it.
      openDecision(G, ctx, decision(
        "eventChoice",
        actor,
        "Flip a facedown GW combat card faceup",
        facedown.map((entry, index) => option(`flip${index}`, `${entry.cardId} (${entry.holder})`)),
        {
          resume,
          special: "gwCombatFlip",
          flipTargets: facedown.map((entry) => ({holder: entry.holder, cardId: entry.cardId})),
        },
      ));
      return false;
    }
    case "gwSubmarines": {
      // "Choose a player that is not currently blockaded and was not blockaded
      // last turn, then roll a die."  The pre-roll modifier is a second
      // decision (see `resolveCardChain`).
      const blockedNow = G.gw?.blockaded ?? [];
      const blockedLast = G.gw?.blockadedLastTurn ?? [];
      const targets = POWERS.filter(
        (p) =>
          !G.powers[p].eliminated &&
          !blockedNow.includes(p) &&
          !blockedLast.includes(p),
      );
      if (targets.length === 0) {
        log(G, actor, "noLegalTarget", {card: G.resolvingCard});
        return true;
      }
      openDecision(G, ctx, decision(
        "eventTargetPower",
        actor,
        "Submarines: choose a player that is not blockaded now or last turn",
        powerOptions(targets),
        {resume, special: "gwSubmarines", stage: "target", owner: actor, required: true},
      ));
      return false;
    }
    case "gwPoliticalPressure": {
      // "Choose a player with a war budget of at least 2 CP. ... a player not
      // adjacent to any enemy armies can neither be targeted nor affected."
      const targets = POWERS.filter(
        (p) =>
          p !== actor &&
          !G.powers[p].eliminated &&
          (G.powers[p].gwBudget ?? 0) >= 2 &&
          adjacentToEnemyArmies(G, p),
      );
      if (targets.length === 0) {
        log(G, actor, "noLegalTarget", {card: G.resolvingCard});
        return true;
      }
      openDecision(G, ctx, decision(
        "eventTargetPower",
        actor,
        "Political Pressure: choose a player that must attack this GW turn",
        powerOptions(targets),
        {resume, special: "gwPoliticalPressure", owner: actor, required: true},
      ));
      return false;
    }
    case "gwExhaustion": {
      // "Neither event triggers on GW turn 0."  GW-10 is mandatory, so playing
      // it stays legal (27.3); only the event trigger is gated.
      if (gwExhaustionTurnZero(G)) {
        log(G, actor, "gwTurnZero", {card: G.resolvingCard ?? "IE-GW-10"});
        return true;
      }
      // "OR all players fighting in the GW lose 1 VP; this option can only be
      // chosen if there is currently a neutral player(s)."
      const options = [option("stability", "All major defeats cost 2 stability this turn")];
      const neutrals = G.gw?.neutrals ?? [];
      if (neutrals.length > 0) options.push(option("vp", "All GW players lose 1 VP"));
      openDecision(G, ctx, decision(
        "eventChoice",
        actor,
        "Exhaustion: choose this GW turn's effect",
        options,
        {resume, special: "gwExhaustion", owner: actor, required: true},
      ));
      return false;
    }
    default:
      log(G, actor, "unhandledSpecial", {handler, card: G.resolvingCard});
      return true;
  }
};

export const performEffect = (
  G: ImperialElegyState,
  ctx: Ctx,
  actor: Power,
  effect: Effect,
  data: EffectContext,
  resume: Effect[],
): boolean => {
  switch (effect.type) {
    case "stability": {
      changeStability(G, powerOf(G, actor, effect.target), effect.delta, ctx);
      return true;
    }
    case "draw": {
      drawCards(G, ctx, powerOf(G, actor, effect.target), effect.count);
      return true;
    }
    case "discard": {
      const p = powerOf(G, actor, effect.target);
      const candidates = G.powers[p].hand.filter((id) => effect.allowHome || cardById(id).kind !== "home");
      for (let i = 0; i < effect.count && candidates.length > 0; i += 1) {
        const index = effect.random ? die(ctx, candidates.length) - 1 : 0;
        discardCard(G, p, candidates.splice(index, 1)[0], "eventDiscard");
      }
      return true;
    }
    case "wtt": {
      changeWtt(G, effect.delta, ctx, G.resolvingCard ?? undefined);
      if (G.wtt >= 5 && !G.gw?.active) {
        // 23.0/23.1: the crisis roll happens as soon as the WTT reaches 5, and
        // the rest of the inciting event is suspended until it resolves.
        openCrisisDecision(G, ctx, actor, resume);
        return false;
      }
      return true;
    }
    case "vp": {
      G.powers[powerOf(G, actor, effect.target)].vp += effect.delta;
      return true;
    }
    case "mpit": {
      const target = powerOf(G, actor, effect.target);
      G.powers[target].mpit[effect.track] += effect.amount;
      return true;
    }
    case "mpitChoice": {
      openDecision(G, ctx, decision("mpitAllocation", actor, "Allocate influence", [
        option("te", "Triple Entente"),
        option("ta", "Triple Alliance"),
        option("neutral", "Neutral"),
      ], {resume, amount: effect.amount, track: effect.track}));
      return false;
    }
    case "allianceShift": {
      // 8.4: the cap is enforced by the shared shift helper.
      const direction = effect.direction === "te" ? "te" : effect.direction === "ta" ? "ta" : "neutral";
      shiftAlliance(G, actor, direction, direction === "neutral" ? ALLIANCE_TRACK.length : effect.steps ?? 1);
      return true;
    }
    case "allianceResolution": {
      // Rule 8.6: a tied marker roll is the player's choice, so the action-
      // phase event suspends on the shared 20.9 `allianceTie` pending instead
      // of applying the deterministic default.
      return beginAllianceResolutionEvent(G, ctx, actor, resume);
    }
    case "placeInfluence":
    case "placeDiplomacy":
    case "removeInfluence":
    case "removeDiplomacy":
    case "minorAlliance":
    case "removeMinorAlliance":
    case "controlSpace":
    case "pacification":
    case "fort":
    case "units":
    case "removeUnits":
    case "rebel":
    case "minorIndependence": {
      const target = data.targetSpace;
      if (!target && effect.type !== "fort" && effect.type !== "units") {
        const filter = "filter" in effect ? effect.filter ?? {} : {};
        return openTargetSpace(G, ctx, actor, {type: "targetSpace", filter, then: [effect]}, resume);
      }
      switch (effect.type) {
        case "placeInfluence": {
          const id = target ?? legalSpaces(G, actor, effect.filter)[0];
          if (id && !rejectIndependentIndiaMarker(G, actor, id, "influence")) G.spaces[id].influence = actor;
          break;
        }
        case "placeDiplomacy": {
          const id = target ?? legalSpaces(G, actor, effect.filter)[0];
          if (id && !rejectIndependentIndiaMarker(G, actor, id, "diplomacy") && !G.spaces[id].diplomacy) G.spaces[id].diplomacy = actor;
          break;
        }
        case "removeInfluence": {
          const id = target;
          if (id && G.spaces[id].influence === actor) G.spaces[id].influence = null;
          break;
        }
        case "removeDiplomacy": {
          const id = target;
          if (id && G.spaces[id].diplomacy === actor) G.spaces[id].diplomacy = null;
          break;
        }
        case "minorAlliance": {
          const id = target;
          if (id && G.spaces[id].diplomacy === actor && !rejectIndependentIndiaMarker(G, actor, id, "ally")) {
            G.spaces[id].diplomacy = null;
            G.spaces[id].ally = actor;
          }
          break;
        }
        case "removeMinorAlliance": {
          const id = target;
          if (id && G.spaces[id].ally !== null) {
            G.spaces[id].ally = null;
          }
          break;
        }
        case "controlSpace": {
          const id = target;
          if (id && !rejectIndependentIndiaMarker(G, actor, id, "control")) {
            setSpaceControl(G, id, actor, {clearInfluence: true, clearDiplomacy: true});
          }
          break;
        }
        case "pacification": {
          const id = target;
          if (id) applyPacification(G, id, effect.value ?? 0);
          break;
        }
        case "fort": {
          const id = target ?? (effect.filter ? legalSpaces(G, actor, effect.filter)[0] : undefined);
          if (id && !effect.remove) G.spaces[id].fort = {power: actor, level: effect.level ?? 1};
          if (id && effect.remove) G.spaces[id].fort = null;
          break;
        }
        case "units": {
          const id = target ?? (effect.filter ? legalSpaces(G, actor, effect.filter)[0] : undefined);
          if (id) {
            const owner = effect.target && effect.target !== "self" ? effect.target : actor;
            for (let i = 0; i < effect.count; i += 1) {
              placeNonPlayerCounter(G, owner, effect.unit as Unit["kind"], id, effect.reduced ? 1 : 2);
            }
          }
          break;
        }
        case "removeUnits": {
          const id = target;
          if (id) {
            const victims = landUnitsIn(G, id).filter((u) => (effect.target === "self" ? u.owner === actor : u.owner !== actor));
            for (let i = 0; i < effect.count && i < victims.length; i += 1) removeUnit(G, victims[i].id);
          }
          break;
        }
        case "rebel": {
          const id = target;
          if (id) {
            const rebellion = G.spaces[id].rebellion ?? {minor: effect.nationality ?? "Rebels", step: 0 as const, rebels: []};
            G.spaces[id].rebellion = rebellion;
            for (let i = 0; i < (effect.count ?? 1); i += 1) {
              const rebel = placeNonPlayerCounter(G, `REBEL:${rebellion.minor}`, "rebelArmy", id, 2);
              if (rebel) rebellion.rebels.push(rebel.id);
            }
          }
          break;
        }
        case "minorIndependence": {
          const id = target;
          if (id) {
            setSpaceControl(G, id, G.spaces[id].rebellion?.minor ?? "Independent");
            G.spaces[id].rebellion = null;
          }
          break;
        }
      }
      return true;
    }
    case "reserve": {
      addReserve(G, powerOf(G, actor, effect.target), effect.count);
      return true;
    }
    case "industry": {
      const target = powerOf(G, actor, effect.target);
      G.powers[target].industry = Math.min(7, G.powers[target].industry + effect.delta);
      return true;
    }
    case "keys": {
      const p = G.powers[powerOf(G, actor, effect.target)];
      if (effect.territorial) p.territorialKeys += effect.territorial;
      if (effect.colonial) p.colonialKeys += effect.colonial;
      if (effect.arab) p.arabKeys = (p.arabKeys ?? 0) + effect.arab;
      return true;
    }
    case "manpower": {
      const target = powerOf(G, actor, effect.target);
      G.powers[target].manpower = Math.max(0, G.powers[target].manpower + effect.delta);
      return true;
    }
    case "cityOfLight": {
      G.powers.FR.cityOfLight = Math.max(0, Math.min(6, (G.powers.FR.cityOfLight ?? 0) + effect.delta));
      return true;
    }
    case "indiaStability": {
      // 33.2.2: flipping the marker to unstable while it is already unstable
      // triggers the independence sequence; independence is permanent.
      if (G.powers.UK.indiaIndependent === true) {
        G.powers.UK.indiaStable = false;
      } else if (effect.stable === false && G.powers.UK.indiaStable === false) {
        applyIndiaIndependence(G);
      } else {
        G.powers.UK.indiaStable = effect.stable;
      }
      return true;
    }
    case "tsrr": {
      G.powers.RU.tsrr = effect.complete ?? true;
      return true;
    }
    case "flag": {
      const duration = effect.duration ?? "game";
      const scope = effect.scope ?? "self";
      if (duration === "game") {
        // Permanent flags live in the public `persistent` bag, except A75-style
        // per-player grants which belong to each recipient's own bag.
        if (scope === "others") {
          for (const power of flagRecipients(actor, scope)) G.powers[power].flags[effect.flag] = effect.value;
        } else {
          G.persistent[effect.flag] = effect.value;
        }
      } else if (duration === "war" && G.war) {
        // War-duration flags live directly on `G.flags`; combat reads them
        // there (e.g. A023/A024 write `warLandDrm`).  `"others"` war cards
        // would target each other power instead.
        if (scope === "others") {
          for (const power of flagRecipients(actor, scope)) G.powers[power].flags[effect.flag] = effect.value;
        } else {
          G.flags[effect.flag] = effect.value;
        }
      } else if (scope === "global") {
        // A85 Hungarian Obstinacy is a public Austria-wide restriction: every
        // reader (`canGrantCitizenship`, `auRightsDecision`, the AU card
        // handlers) reads the single `G.flags` slot, whichever power played it.
        G.flags[effect.flag] = effect.value;
      } else {
        for (const power of flagRecipients(actor, scope)) G.powers[power].flags[effect.flag] = effect.value;
      }
      return true;
    }
    case "removeCard": {
      if (effect.card) removeCard(G, effect.card);
      return true;
    }
    case "removeThisCard": {
      if (G.resolvingCard) removeCard(G, G.resolvingCard);
      return true;
    }
    case "drawReplacement": {
      drawCards(G, ctx, actor, 1);
      return true;
    }
    case "war": {
      openDecision(G, ctx, decision("eventChoice", actor, "Declare war", [
        option("conquest", "War of conquest"),
        option("liberation", "War of liberation"),
        option("unification", "War of unification"),
      ], {resume, special: "warDeclaration", free: effect.free}));
      return false;
    }
    case "peace": {
      G.flags.peaceOffered = true;
      return true;
    }
    case "shiftAllianceOf": {
      const target = powerOf(G, actor, effect.target);
      const direction = effect.direction === "te" ? "te" : effect.direction === "ta" ? "ta" : "neutral";
      shiftAlliance(G, target, direction, direction === "neutral" ? ALLIANCE_TRACK.length : 1);
      return true;
    }
    case "suez": {
      G.persistent.suezCanal = effect.build ?? true;
      if (effect.blockedBy === false) delete G.persistent.suezBlockedBy;
      else if (effect.blockedBy !== undefined) G.persistent.suezBlockedBy = effect.blockedBy;
      return true;
    }
    case "italy": {
      if (effect.action === "unify") unifyItaly(G, ctx, actor);
      else if (effect.action === "roll" || effect.action === "table") italyTable(G, ctx, actor);
      return true;
    }
    case "meiji": {
      return doSpecial(G, ctx, actor, "meijiRestoration", {}, resume);
    }
    case "americanCivilWar": {
      G.persistent.acw = true;
      if (effect.side) G.persistent.acwSide = effect.side;
      return true;
    }
    case "jihad": {
      G.powers.OT.jihad = (G.powers.OT.jihad ?? 0) + effect.count;
      return true;
    }
    case "germanUnificationCheck": {
      checkGermanUnification(G, ctx);
      return true;
    }
    case "italianUnificationCheck": {
      checkItalianUnification(G, ctx);
      return true;
    }
    case "crisis": {
      openCrisisDecision(G, ctx, actor, resume);
      return false;
    }
    case "choice": {
      openDecision(G, ctx, decision("eventChoice", actor, "Choose", effect.options.map((o, i) => option(`opt${i}`, o.label)), {resume, options: effect.options.map((o) => o.effects)}));
      return false;
    }
    case "targetSpace": {
      return openTargetSpace(G, ctx, actor, effect, resume);
    }
    case "targetPower": {
      return openTargetPower(G, ctx, actor, effect, resume);
    }
    case "if": {
      // Conditions are evaluated by dedicated code paths; unknown conditions
      // are treated as true so an event is never silently dropped.
      const branch = effect.condition.startsWith("!") ? effect.otherwise ?? [] : effect.then;
      return resolveEffects(G, ctx, actor, branch, data);
    }
    case "special": {
      return doSpecial(G, ctx, actor, effect.handler, effect.args ?? {}, resume);
    }
    case "note":
      return true;
    default:
      return true;
  }
};

/** Resolve a decision produced by a card effect. */
export const resolveCardDecision = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
  optData: Record<string, unknown>,
): void => {
  const context = pending.context ?? {};
  const resume = (context.resume as Effect[] | undefined) ?? [];
  const special = context.special as string | undefined;
  const actor = pending.power;
  // The multi-step card chains own their own bookkeeping: they must run before
  // the generic target/choice branches below.
  if (special !== undefined && CARD_CHAIN_SPECIALS.has(special)) {
    resolveCardChain(G, ctx, pending, optionId);
    return;
  }
  const data: EffectContext = {...context, choice: optionId, targetSpace: optData.space as SpaceId | undefined, targetPower: optData.power as Power | undefined};
  if (pending.kind === "eventTargetSpace") {
    const space = optionId;
    data.targetSpace = space;
    if (special === "colonialConflict") {
      const value = SPACES[space]?.type === "navalBase" ? 2 : 0;
      applyPacification(G, space, value);
    } else if (special === "quagmire") {
      const p = G.spaces[space].control;
      G.spaces[space].pacification = (G.spaces[space].pacification ?? 0) + 1;
      if (isPower(p)) changeStability(G, p, -1, ctx);
      else changeStability(G, actor, -1, ctx);
    } else if (special === "looseGrip") {
      if (!rejectIndependentIndiaMarker(G, actor, space, "control")) {
        setSpaceControl(G, space, actor);
        log(G, actor, "looseGrip", {space});
      }
    } else if (special === "berlinConference") {
      if (!rejectIndependentIndiaMarker(G, actor, space, "influence")) G.spaces[space].influence = actor;
    } else if (special === "greatGame") {
      if (!rejectIndependentIndiaMarker(G, actor, space, "influence")) {
        G.spaces[space].influence = actor;
        placeUnit(G, actor, "expeditionary", space, 1);
        applyPacification(G, space, 1);
      }
    } else if (special === "frenchIntervention") {
      if (!rejectIndependentIndiaMarker(G, "FR", space, "influence")) {
        G.spaces[space].influence = "FR";
        placeUnit(G, "FR", "expeditionary", space, 1);
        applyPacification(G, space, 1);
      }
    } else if (special === "papalInfluence") {
      allyItalianMinor(G, actor, space);
      if (papalInfluenceCardBonus(G, actor)) G.powers[actor].cardMarkers += 1;
    } else if (special === "chineseIntervention") {
      G.spaces[space].rebellion = {minor: "Qing", step: 0, rebels: []};
      const rebel = placeNonPlayerCounter(G, "REBEL:Qing", "rebelArmy", space, 1);
      if (rebel) G.spaces[space].rebellion!.rebels.push(rebel.id);
      G.flags[`qingIntervention_${space}`] = G.turn;
    } else if (special === "declineOfQing") {
      if (!rejectIndependentIndiaMarker(G, actor, space, "control")) setSpaceControl(G, space, actor);
    } else if (special === "nationalistUprising") {
      const nationalities = SPACES[space]?.nationalities ?? ["Rebels"];
      G.spaces[space].rebellion = {minor: "Rebels", step: 0, rebels: []};
      const rebel = placeNonPlayerCounter(G, `REBEL:${nationalities[0]}`, "rebelArmy", space, 2);
      if (rebel) G.spaces[space].rebellion!.rebels.push(rebel.id);
      const controller = G.spaces[space].control as Power;
      if (G.powers[controller].hand.length > 0) {
        const index = die(ctx, G.powers[controller].hand.length) - 1;
        discardCard(G, controller, G.powers[controller].hand[index], "nationalistUprising");
      } else changeStability(G, controller, -1, ctx);
    } else if (special === "mahdistWar") {
      placeNonPlayerCounter(G, "REBEL:Mahdi", "rebelArmy", space, 1);
      applyPacification(G, space, 1);
      if (isPower(G.spaces[space].control)) G.powers[G.spaces[space].control as Power].cardMarkers -= 1;
    } else if (special === "removeAnyMinorAlliance") {
      G.spaces[space].ally = null;
      G.spaces[space].diplomacy = null;
      log(G, actor, "minorAllianceRemoved", {space});
    } else {
      const then = (context.then as Effect[] | undefined) ?? [];
      if (then.length > 0) resolveEffects(G, ctx, actor, then, data);
    }
    closeDecision(G, ctx);
    resumeEffects(G, ctx, pending, data);
    return;
  }
  if (pending.kind === "eventTargetPower") {
    const target = optionId as Power;
    data.targetPower = target;
    if (special === "stabilityOrCard") {
      const p = G.powers[target];
      if (p.hand.length > 0) {
        const index = die(ctx, p.hand.length) - 1;
        discardCard(G, target, p.hand[index], "eventDiscard");
      } else {
        changeStability(G, target, -1, ctx);
      }
    } else if (special === "foreignInvestment") {
      // The chosen power receives the card as its industrialization card and
      // automatically industrializes in the end phase.
      const card = G.resolvingCard;
      if (card) {
        G.powers[target].industryCard = card;
        G.powers[target].autoIndustry = true;
      }
    } else {
      const then = (context.then as Effect[] | undefined) ?? [];
      if (then.length > 0) resolveEffects(G, ctx, actor, then, data);
    }
    closeDecision(G, ctx);
    resumeEffects(G, ctx, pending, data);
    return;
  }
  if (pending.kind === "eventChoice") {
    const options = (context.options as Effect[][] | undefined) ?? [];
    const index = Number.isFinite(Number(optionId)) ? Number(optionId) : Number(optData.index);
    const chosen = options[index];
    if (special === "shiftingAlliances") {
      const direction = optionId === "te" ? "te" : optionId === "ta" ? "ta" : "neutral";
      shiftAlliance(G, actor, direction, direction === "neutral" ? ALLIANCE_TRACK.length : 1);
    } else if (special === "divideAndConquer") {
      if (optionId === "pacify") {
        const candidates = legalSpaces(G, actor, {});
        if (candidates.length > 0) {
          const space = candidates[0];
          G.spaces[space].pacification = (G.spaces[space].pacification ?? 0) + 2;
        }
      } else {
        const rebels = Object.values(G.units).filter((u) => u.kind === "rebelArmy");
        if (rebels.length > 0) removeUnit(G, rebels[0].id);
      }
    } else if (special === "gwMajorEntry") {
      if (optionId === "IT" || optionId === "US") resolveMajorPowerEntry(G, ctx, actor, optionId);
    } else if (special === "gwCombatFlip") {
      const index = optionId.startsWith("flip") ? Number(optionId.slice(4)) : -1;
      const targets = (context.flipTargets as {holder: Power; cardId: CardId}[] | undefined) ?? [];
      const target = targets[index];
      if (target) {
        flipGwCombatCardFaceup(G, target.holder, target.cardId);
        log(G, actor, "gwCombatCardFlipped", {card: target.cardId, holder: target.holder});
      }
    } else if (chosen) {
      resolveEffects(G, ctx, actor, chosen, data);
    }
    closeDecision(G, ctx);
    resumeEffects(G, ctx, pending, data);
    return;
  }
  if (pending.kind === "mpitAllocation") {
    const track = optionId as "te" | "ta" | "neutral";
    G.powers[actor].mpit[track] += Number(context.amount ?? 1);
    closeDecision(G, ctx);
    resumeEffects(G, ctx, pending, data);
    return;
  }
  if (pending.kind === "goalChoice") {
    const p = G.powers[pending.power];
    const drawn = (context.drawn as string[] | undefined) ?? [];
    if (drawn.includes(optionId)) {
      p.goals.push(optionId);
      p.goalDeck.push(...drawn.filter((id) => id !== optionId));
      if (p.goals.length > 3) {
        const returned = p.goals.shift();
        if (returned) p.goalDeck.push(returned);
      }
    }
    closeDecision(G, ctx);
    resumeEffects(G, ctx, pending, data);
  }
};

/** Cards with mandatory/removal bookkeeping. */
export const finishCard = (G: ImperialElegyState, actor: Power, cardId: CardId): void => {
  const card = CARD_BY_ID[cardId];
  if (!card) return;
  if (card.remove) removeCard(G, cardId);
  else discardCard(G, actor, cardId, "cardPlayed");
};
