/**
 * Imperial Elegy — reusable Great War turn flow.
 *
 * `engine/greatWar.ts` owns the one-off rules (outbreak, crisis, Italy) and the
 * low-level state.  This module owns the repeating GW turn loop:
 *
 *   planning (beginGwTurn) -> maneuver impulses (startGwManeuver /
 *   advanceGwImpulse / performGwManeuver) -> winter (resolveGwWinter) ->
 *   planning of the next turn.
 *
 * Everything here is a *helper*: it validates against the existing typed state
 * and returns a structured result instead of throwing or returning
 * `INVALID_MOVE`.  That keeps the helpers usable from boardgame.io moves, from
 * bots and from tests without duplicating the rules in each caller.
 *
 * Only fields already declared in `types.ts` are written:
 *   - `G.gw.*`, `G.phase`, `G.activePower`, `G.turnIndex`, `G.flags`
 *   - `G.powers[].gwCard/gwBudget/warBudget/manpower/industry/stability/flags`
 *   - `G.spaces[].units` and `G.units[].space/steps`
 *
 * Planned faceup combat cards are tracked in the existing, serializable
 * `PowerState.flags` bag (`gwFaceupCombat`), and CP-transfer / bonus-impulse
 * bookkeeping uses the other documented flag slots.  No new persistent shape
 * is introduced, so old saves remain valid.
 */

import {Ctx} from "boardgame.io";
import {
  AllianceBox,
  CardId,
  GreatWarState,
  GwColonialBonusChoice,
  GwColonialTransferChoice,
  GwColonialWarRollState,
  GwExhaustionMode,
  GwNeutralEntryState,
  GwSide,
  GwWinterState,
  ImperialElegyState,
  PendingDecision,
  Power,
  POWERS,
  SpaceId,
  Unit,
} from "../types";
import {CARDS} from "../constant/cards.data";
import {POWER_DEFS} from "../constant/powers";
import {
  SPACES,
  connectionBetween,
  connectionsOf,
  isNavalBox,
  neighboursOf,
  spaceLabel,
} from "../constant/spaces";
import {
  allied,
  armyEndProblem,
  atWar,
  beginImpulseUpkeep,
  capitalOf,
  changeStability,
  clearTurnDurationFlags,
  die,
  eliminatePower,
  friendlySpace,
  formerlyControlledMarchAllowed,
  formerlyControlledOwner,
  formerlyControlledRailAllowed,
  gwAllyImpulseFor,
  gwMajorSide,
  hasLoc,
  hostileOwner,
  isArmyKind,
  isBlockaded,
  isEliteKind,
  isFormerlyControlledSpace,
  isHomeSpace,
  isNavalKind,
  effectiveKeyType,
  isPower,
  ITALIAN_ARMY_COUNTER_MAX,
  ITALIAN_STANDING_ARMIES,
  italianArmyDeploySpaces,
  italianArmyTarget,
  italianNavalDeploySpace,
  minorController,
  landUnitsIn,
  log,
  maneuverDestinationProblem,
  movementEndProblem,
  navalUnitsIn,
  ownsKey,
  PORT_NAVAL_LIMIT,
  recordOccupation,
  resolveCapitalSurrenders,
  setSpaceControl,
  sweepOrphanedMinorUnits,
} from "./rules";
import {blockadedAt, tsrrConnectionUsable} from "./blockade";

// 17.1 / 29.1: keep the historical greatWarFlow exports working for callers
// (and tests) that import the shared blockade helpers from this module.
export {BLOCKADE_ALLOWED_BOXES, BLOCKADE_EXEMPT_BOXES, PACIFIC_BOXES, blockadeTrace, tsrrConnectionUsable} from "./blockade";
import {
  beginLandBattle,
  firstTransitInterceptHop,
  navalInterceptCandidates,
  openNavalContactDecision,
  openNavalTransitInterception,
  pruneTrenchBattle,
} from "./combat";
import {planNavalMove, requestDardanellesPassage} from "./navalMovement";
import {counterRemaining, hasCounterFor, nonPlayerCounterRemaining, nonPlayerHasCounterFor} from "./counters";
import {ALLIANCE_MAX_PLAYERS} from "./alliance";
import {
  facedownGwCombatCards,
  faceupGwCombatCardsInFront,
  flipFacedownGwCombatCards,
  flipGwCombatCardFaceup,
  gwCombatCardsInFront,
  placeGwCombatCardFaceDown,
  removeGwCombatCardInFront,
} from "./combatCards";
import {applyGwKeyCapture, checkGwVictory, endGreatWar} from "./greatWar";
import {grantRapidDeployment, placeNonPlayerCounter, placeUnit, removeUnit} from "./effects";
import {EXHAUSTION_CARD} from "./characteristics";
import {gwExhaustionTurnZero} from "./playability";
import {
  enemyOccupiedItalianKeys,
  hasSurrendered,
  italianHomeKeys,
  syncItalianHomeKeys,
  usArmyMayLeaveNorthAmerica,
  usCanLeaveNorthAmerica,
  usNorthAtlanticCheck,
} from "./gwMajors";
import {openDecision, option} from "./pending";
import {
  ALLIANCE_TRACK,
  isAllianceBox,
  isCommittedBox,
  italyAllianceBox,
  italyGwCardEntryPlan,
  planItalyOutbreak,
  shiftItalyToward,
  type ItalyOutbreakPlan,
  type ItalySide,
} from "./italyEntry";

// The facedown GW combat-card lifecycle is shared with `combat.ts` (which
// queues the card after the battle) but lives with the card data helpers to
// avoid a combat.ts <-> greatWarFlow.ts import cycle.
export {
  facedownGwCombatCards,
  faceupGwCombatCardsInFront,
  flipFacedownGwCombatCards,
  flipGwCombatCardFaceup,
  gwCombatCardsInFront,
  placeGwCombatCardFaceDown,
  removeGwCombatCardInFront,
};

// ------------------------------------------------------------------ results

export type GwFlowError =
  | "noGreatWar"
  | "wrongPhase"
  | "notActive"
  | "pending"
  | "eliminated"
  | "notBelligerent"
  | "notAllied"
  | "insufficientBudget"
  | "invalidTarget"
  | "invalidUnit"
  | "noReserve"
  | "noManpower"
  | "alreadyUsed"
  | "alreadyEntered"
  | "invalidOrder"
  | "invalidBattle"
  | "noEligibleImpulse"
  | "noCard"
  | "invalidCard"
  | "invalidEntry"
  | "noCounter";

export interface GwFailure {
  ok: false;
  error: GwFlowError;
  message: string;
  /**
   * A live decision was opened instead of performing the action (3.4.1's
   * Dardanelles permission).  The move wrapper returns normally: the state
   * change is the pending, no CP/budget was spent.
   */
  pending?: boolean;
}

const fail = (error: GwFlowError, message: string, pending = false): GwFailure =>
  ({ok: false, error, message, ...(pending ? {pending: true} : {})});

export type {GwSide};

/**
 * Faceup GW combat cards by holder.  One power may hold BOTH GW-03 and GW-04
 * (26.1), so a holder maps to a single id when it has one card and to an array
 * when it has two.
 */
export type FaceupCombatMap = Partial<Record<Power, CardId | CardId[]>>;

export interface GwTurnBegin {
  ok: true;
  turn: number;
  phase: "gwPlanning";
  /** Cards newly dealt this planning step. */
  dealt: Partial<Record<Power, CardId>>;
  /** Combat-typed GW cards that are faceup for this turn. */
  faceupCombat: FaceupCombatMap;
  /** War budgets after the planning reset. */
  budgets: Partial<Record<Power, number>>;
  order: GreatWarState["order"];
  firstPower: Power | null;
  usIn: boolean;
  italyIn: boolean;
}

export type GwBeginResult = GwTurnBegin | GwFailure;

export interface GwManeuverBegin {
  ok: true;
  power: Power;
  index: number;
  order: GreatWarState["order"];
}

export type GwManeuverBeginResult = GwManeuverBegin | GwFailure;

export type GwImpulseKind = "power" | "bonus" | "ally" | "end";

export interface GwImpulse {
  ok: true;
  kind: GwImpulseKind;
  /** The Power that actually takes the impulse (even for a bonus slot). */
  power?: Power;
  /** The order slot that produced the impulse (`"bonus"`, `"IT"`, `"US"`…). */
  slot?: GreatWarState["order"][number];
  index: number;
  side?: GwSide | null;
  allPassed?: boolean;
}

export type GwImpulseResult = GwImpulse | GwFailure;

export type GwManeuverKind =
  | "deploy"
  | "draft"
  | "refit"
  | "refitFleet"
  | "landBattle"
  | "rail"
  | "march"
  | "naval"
  | "jointNaval";

export interface GwBattleSummary {
  kind: "land" | "naval";
  attacker: Power;
  defender: Power;
  from: SpaceId;
  to: SpaceId;
}

export interface GwManeuverSuccess {
  ok: true;
  kind: GwManeuverKind;
  power: Power;
  cost: number;
  budgetBefore: number;
  budgetAfter: number;
  from?: SpaceId;
  to?: SpaceId;
  unitIds?: string[];
  ally?: Power;
  battle?: GwBattleSummary;
}

export type GwManeuverResult = GwManeuverSuccess | GwFailure;

export type GwManeuverRequest =
  | {kind: "deploy"; power: Power; space: SpaceId; unitId?: string}
  | {kind: "draft"; power: Power; space: SpaceId}
  | {kind: "refit"; power: Power; unitId: string}
  | {kind: "refitFleet"; power: Power; unitId: string}
  | {kind: "landBattle"; power: Power; from: SpaceId; to: SpaceId}
  | {kind: "rail"; power: Power; unitId: string; to: SpaceId}
  | {kind: "march"; power: Power; unitId: string; to: SpaceId}
  | {kind: "naval"; power: Power; unitIds: string[]; to: SpaceId}
  | {
      kind: "jointNaval";
      power: Power;
      ally: Power;
      unitIds: string[];
      allyUnitIds: string[];
      to: SpaceId;
    };

/** 29.2: one colonial-war roll, including its modifiers and consequences. */
export type GwColonialWarRoll = GwColonialWarRollState;

export interface GwNeutralEntry {
  power: Power;
  side: GwSide;
}

export interface GwWinterSuccess {
  ok: true;
  turnBefore: number;
  turnAfter: number;
  blockaded: Power[];
  industryLost: Power[];
  colonialWar: {africa: GwColonialWarRoll; asia: GwColonialWarRoll};
  joinedNeutrals: GwNeutralEntry[];
  eliminated: Power[];
  ended: boolean;
  reason: "turnLimit" | "elimination" | null;
  result: ImperialElegyState["result"];
  /** GW-08/09: pressured players that failed the attack condition. */
  politicalPressureLosses?: Power[];
  /**
   * 29.3: the winter is waiting for the neutral-entry decisions.  No turn
   * advance or planning reset has happened yet; the pending decision is open.
   */
  awaitingNeutrals?: boolean;
  /** 29.3 roll-off order (highest first), for the log/tests. */
  neutralOrder?: Power[];
  /** Bonus CP owed at the next planning step (29.2 / 29.3). */
  bonusCp?: Partial<Record<Power, number>>;
  /** 29.1.1: stability the US lost at this winter. */
  usStabilityLoss?: number;
  /** 29.2.1: colonial-war stability changes. */
  colonialStability?: {power: Power; delta: number; reason: string}[];
  /**
   * 29.2: the colonial transfers actually applied this winter, from both the
   * interactive choices and the deterministic fallback.
   */
  colonialTransfers?: {
    region: "africa" | "asia";
    side: GwSide;
    by: Power;
    space: SpaceId;
    from: string | null;
  }[];
  /**
   * 29.2: the winter stopped after the colonial war to let the winning
   * alliances choose their spaces / bonus-CP split.  The turn has not advanced.
   */
  awaitingColonialChoices?: boolean;
}

export type GwWinterResult = GwWinterSuccess | GwFailure;

export interface GwTransferSuccess {
  ok: true;
  from: Power;
  to: Power;
  amount: number;
  fromBefore: number;
  fromAfter: number;
  toBefore: number;
  toAfter: number;
}

export type GwTransferResult = GwTransferSuccess | GwFailure;

export interface GwAllyEntrySuccess {
  ok: true;
  ally: "IT" | "US";
  side: GwSide;
  orderIndex: number;
  budget: number;
  bonusImpulse: boolean;
}

export type GwAllyEntryResult = GwAllyEntrySuccess | GwFailure;

export interface GwRevealSuccess {
  ok: true;
  power: Power;
  cardId: CardId;
}

export type GwRevealResult = GwRevealSuccess | GwFailure;

// ------------------------------------------------------------------ helpers

const sideOf = (G: ImperialElegyState, power: Power): GwSide | null => {
  if (!G.gw) return null;
  if (G.gw.te.includes(power)) return "te";
  if (G.gw.ta.includes(power)) return "ta";
  return null;
};

/**
 * Faceup combat cards are public information.  They live in top-level
 * `G.flags` (the per-power `flags` bag is redacted in `playerView`) as a
 * compact `GE:IE-GW-03,FR:IE-GW-04` string.
 */
const FACEUP_COMBAT_FLAG = "gwFaceupCombat";

const parseFaceupCombat = (raw: unknown): Partial<Record<Power, CardId>> => {
  const out: Partial<Record<Power, CardId>> = {};
  if (typeof raw !== "string" || raw.length === 0) return out;
  for (const entry of raw.split(",")) {
    const [power, cardId] = entry.split(":");
    if (isPower(power) && cardId) out[power] = cardId;
  }
  return out;
};

const serializeFaceupCombat = (cards: FaceupCombatMap): string =>
  POWERS.filter((power) => cards[power] !== undefined)
    .map((power) => {
      const value = cards[power]!;
      const cardId = Array.isArray(value) ? value[0] : value;
      return `${power}:${cardId}`;
    })
    .join(",");

/** Build the faceup map directly from the in-front cards (26.1). */
const faceupFromInFront = (G: ImperialElegyState): FaceupCombatMap => {
  const out: FaceupCombatMap = {};
  for (const entry of faceupGwCombatCardsInFront(G)) {
    const current = out[entry.holder];
    if (current === undefined) out[entry.holder] = entry.cardId;
    else if (Array.isArray(current)) current.push(entry.cardId);
    else out[entry.holder] = [current, entry.cardId];
  }
  return out;
};

const isEnteredAlly = (G: ImperialElegyState, slot: "IT" | "US"): boolean =>
  slot === "IT" ? G.gw?.italyIn === true : G.gw?.usIn === true;

const allySide = (G: ImperialElegyState, slot: "IT" | "US"): GwSide | null => {
  const raw = slot === "IT" ? G.flags.italySide : G.flags.usSide;
  return raw === "te" || raw === "ta" ? raw : null;
};

const livingPowers = (G: ImperialElegyState, powers: Power[]): Power[] =>
  powers.filter((p) => G.powers[p] && !G.powers[p].eliminated);

// ------------------------------------------------------------------ 29.1 blockade

/**
 * The printed maximum industry level: Germany's display has an industry box 7,
 * every other display stops at 6 (`POWER_DEFS[].industryCards` has 8/7
 * entries, indices 0..7/0..6).
 */
export const printedMaxIndustry = (power: Power): number =>
  Math.max(3, POWER_DEFS[power].industryCards.length - 1);

/** 29.1: the current maximum industry level, never below the floor of three. */
export const maxIndustryOf = (G: ImperialElegyState, power: Power): number => {
  const raw = G.powers[power]?.maxIndustry;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(3, Math.min(printedMaxIndustry(power), Math.floor(raw)));
  }
  return printedMaxIndustry(power);
};

/** Set the maximum industry level, clamped to the printed range and floor 3. */
export const setMaxIndustry = (G: ImperialElegyState, power: Power, value: number): number => {
  const next = Math.max(3, Math.min(printedMaxIndustry(power), Math.floor(value)));
  G.powers[power].maxIndustry = next;
  return next;
};

/**
 * 29.1: the blockaded players.  A player is blockaded when every naval box it
 * can trace to from its capital is a Baltic/Black Sea box (or it can reach
 * none at all).
 */
export const blockadePlan = (G: ImperialElegyState): Power[] => {
  if (!G.gw?.active) return [];
  return livingPowers(G, [...G.gw.belligerents]).filter((power) => blockadedAt(G, power));
};

/**
 * 29.1 cadence: at the end of each GW *year* (the GW turn counter is the year,
 * so turn 0 — the outbreak turn — is excluded) every blockaded player's
 * maximum industry drops by one, never below 3, and its current industry is
 * clamped to the new maximum.
 */
const applyBlockade = (
  G: ImperialElegyState,
  turnBefore: number,
): {blockaded: Power[]; industryLost: Power[]} => {
  const blockaded: Power[] = [];
  const industryLost: Power[] = [];
  if (!G.gw) return {blockaded, industryLost};
  for (const power of blockadePlan(G)) {
    blockaded.push(power);
    // GW turn 0 is the outbreak turn, not a year: the set is still recorded (it
    // is the blockade in force for the next turn, which GW-07 reads) but no
    // maximum-industry reduction happens.
    if (turnBefore <= 0) continue;
    const before = maxIndustryOf(G, power);
    const after = setMaxIndustry(G, power, before - 1);
    const industryBefore = G.powers[power].industry;
    if (G.powers[power].industry > after) G.powers[power].industry = after;
    if (after !== before || G.powers[power].industry !== industryBefore) industryLost.push(power);
    log(G, power, "gwBlockade", {
      maxIndustry: after,
      industry: G.powers[power].industry,
      reduced: after !== before,
    });
  }
  return {blockaded, industryLost};
};

const firstLivingOrderIndex = (G: ImperialElegyState): number => {
  if (!G.gw) return -1;
  return G.gw.order.findIndex((slot) => isPower(slot) && !G.powers[slot].eliminated);
};

const orderSideCounts = (G: ImperialElegyState): {te: number; ta: number} => {
  let te = 0;
  let ta = 0;
  if (!G.gw) return {te, ta};
  for (const slot of G.gw.order) {
    if (!isPower(slot) || G.powers[slot].eliminated) continue;
    if (G.gw.te.includes(slot)) te += 1;
    else if (G.gw.ta.includes(slot)) ta += 1;
  }
  return {te, ta};
};

const pickSidePower = (G: ImperialElegyState, side: GwSide): Power | null => {
  if (!G.gw) return null;
  return livingPowers(G, side === "te" ? G.gw.te : G.gw.ta)[0] ?? null;
};

/**
 * Pick the power that receives the order's `"bonus"` slot.
 *
 * 30.1 grants the marker to the eliminated power's alliance, which can leave
 * the alliances equal in size; the recorded `bonusImpulseSide` therefore wins
 * over the 25.7.1/29.3 size heuristic.  Older saves/tests without the record
 * keep the historic "outnumbered alliance" behaviour.
 */
const pickBonusPower = (G: ImperialElegyState): {power: Power; side: GwSide} | null => {
  if (!G.gw) return null;
  const {te, ta} = orderSideCounts(G);
  const recorded = G.gw.bonusImpulseSide;
  if (recorded !== "te" && recorded !== "ta" && te === ta) return null;
  const side: GwSide = recorded === "te" || recorded === "ta" ? recorded : te < ta ? "te" : "ta";
  const sidePowers = livingPowers(G, side === "te" ? G.gw.te : G.gw.ta);
  if (sidePowers.length === 0) return null;
  // Prefer powers that are already in the order; fall back to the side roster.
  const ordered = sidePowers.filter((p) => G.gw!.order.includes(p));
  const pool = ordered.length > 0 ? ordered : sidePowers;
  const prior = G.gw.bonusImpulses.filter((entry) => isPower(entry) && pool.includes(entry)).length;
  return {power: pool[prior % pool.length], side};
};

/** 15.2.3: clear the "deployed this impulse" marker when the next impulse starts. */
const clearDeployedThisImpulse = (G: ImperialElegyState): void => {
  for (const unit of Object.values(G.units)) {
    if (unit.flags?.deployedThisImpulse === true) delete unit.flags.deployedThisImpulse;
  }
};

const activateImpulse = (
  G: ImperialElegyState,
  ctx: Ctx,
  power: Power,
  index: number,
  bonus: boolean,
  kind: GwImpulseKind,
  slot: GreatWarState["order"][number],
): GwImpulse => {
  G.activePower = power;
  G.turnIndex = index;
  // 15.2.3/29.3: a unit deployed during the previous impulse may act now.
  clearDeployedThisImpulse(G);
  G.powers[power].flags.gwActionsThisImpulse = 0;
  if (bonus) G.powers[power].flags.passedGw = false;
  G.flags.gwBonusImpulse = bonus;
  // 26.3: an "IT"/"US" slot is that major's own impulse, run by a player on
  // its side with the major's budget and units.
  G.flags.gwAllyImpulse = kind === "ally" && (slot === "IT" || slot === "US") ? slot : "";
  const side = sideOf(G, power);
  log(G, power, "gwImpulse", {kind, index, slot, bonus});
  // 5.5.3 / 5.6.2: the incoming belligerent's start-of-impulse penalties.
  beginImpulseUpkeep(G, ctx, power);
  return {ok: true, kind, power, slot, index, side};
};

const requireManeuver = (G: ImperialElegyState, power: Power): {budget: number} | GwFailure => {
  if (!G.gw?.active) return fail("noGreatWar", "The Great War is not active");
  if (G.phase !== "gwManeuver") return fail("wrongPhase", "Not in the GW maneuver step");
  if (G.pending !== null) return fail("pending", "A pending decision blocks the impulse");
  if (!G.powers[power]) return fail("invalidTarget", `Unknown power ${power}`);
  if (G.powers[power].eliminated) return fail("eliminated", `${power} is eliminated`);
  if (!G.gw.belligerents.includes(power)) return fail("notBelligerent", `${power} is not a belligerent`);
  if (G.activePower !== power) return fail("notActive", `${power} is not the active power`);
  const major = gwAllyImpulseFor(G, power);
  const budget = major === null ? G.powers[power].gwBudget ?? 0 : majorBudget(G, major);
  if (budget < 1) {
    return fail("insufficientBudget", `${major ?? power} has no GW budget left`);
  }
  return {budget};
};

const majorBudget = (G: ImperialElegyState, major: "IT" | "US"): number =>
  major === "US" ? G.gw?.usBudget ?? 0 : G.gw?.italyBudget ?? 0;

/** Space names used for US / unified-Italy control on the map. */
const MAJOR_CONTROL: Record<"IT" | "US", readonly string[]> = {
  IT: ["IT"],
  US: ["US", "United States"],
};

/**
 * Whether `power` commands `unit` for a GW maneuver: its own units, or the
 * US/Italian units during that major's impulse (26.3).
 */
const commandsUnit = (G: ImperialElegyState, power: Power, unit: Unit | undefined): unit is Unit => {
  if (!unit) return false;
  if (unit.owner === power) return true;
  const major = gwAllyImpulseFor(G, power);
  return major !== null && unit.owner === major;
};

/** Unit kinds a controlled allied minor may contribute to a GW rail action (15.4). */
const GW_MINOR_RAIL_ARMY_KINDS: readonly Unit["kind"][] = ["army", "reserveArmy", "minorArmy"];

/**
 * 15.4 + 27.5: "Minor powers that are allied to a player move as part of their
 * controlling player's march, rail, and naval movement actions."  A GW Rail
 * Move therefore carries a controlled allied minor's army with the same
 * command rules as the free 33.5 TSRR move in `moves.ts#tsrrMinorRailDecision`:
 * the minor must be controlled by the railing power and the counter must be an
 * army (not an EC/EF).  The action still costs the controller exactly 1 CP and
 * obeys the ordinary destination/path rules.  A US/Italian impulse may only
 * move that major's own units (26.3), so it never carries a minor.
 */
const commandsRailMinorArmy = (G: ImperialElegyState, power: Power, unit: Unit | undefined): unit is Unit => {
  if (!unit || isPower(unit.owner)) return false;
  if (gwAllyImpulseFor(G, power) !== null) return false;
  if (minorController(G, unit.owner) !== power) return false;
  return GW_MINOR_RAIL_ARMY_KINDS.includes(unit.kind);
};

/** Friendly for a maneuver: a player-friendly space, or the moving major's own. */
const maneuverFriendly = (G: ImperialElegyState, space: SpaceId, power: Power): boolean => {
  if (friendlySpace(G, space, power)) return true;
  const major = gwAllyImpulseFor(G, power);
  if (major === null) return false;
  const state = G.spaces[space];
  return Boolean(state) && (MAJOR_CONTROL[major].includes(String(state.control)) || state.occupiedBy === major);
};

const landSpace = (G: ImperialElegyState, space: SpaceId): boolean =>
  Boolean(G.spaces[space]) && !isNavalBox(space);

/**
 * 27.5.2: a drafted reduced army goes in a controlled home key with room under
 * 5.5.1 and without a trench battle marker.  `first` is excluded from the
 * second army's choices: "no more than one per space".
 */
const gwDraftSpaceAllowed = (
  G: ImperialElegyState,
  power: Power,
  space: SpaceId,
  first: SpaceId | null,
): boolean => {
  if (space === first) return false;
  const state = G.spaces[space];
  const type = SPACES[space]?.type;
  if (!state || type === undefined || isNavalBox(space)) return false;
  // "Home key": a printed key space (the German/Italian unification spaces are
  // key spaces without a printed key type, so `isKey` would wrongly skip them).
  if (type !== "key" && type !== "capital" && type !== "subcapital") return false;
  if (!ownsKey(G, space, power) || !isHomeSpace(G, space, power)) return false;
  if (state.trench) return false;
  return armyEndProblem(G, space, 1) === null;
};

/** 27.5.2: every legal space for a draft, in printed map order. */
export const gwDraftSpaces = (
  G: ImperialElegyState,
  power: Power,
  first: SpaceId | null = null,
): SpaceId[] => Object.keys(G.spaces).filter((space) => gwDraftSpaceAllowed(G, power, space, first));

/** 27.5.2 EF substitution: one drafted army may be replaced by an EF. */
export interface GwDraftEfChoice {
  space: SpaceId;
  kind: "expeditionary" | "eliteColonialEf";
}

/**
 * 27.5.2: "instead of placing two reduced armies they can substitute 1 EF for
 * an army.  That EF may be placed in a controlled home key or in a controlled
 * colonial home key with a LoC (in both cases the spaces cannot contain a
 * trench marker).  Players can also rebuild Elite Colonial EFs in this manner."
 *
 * The EF is the second placement (the first army is already down), and the
 * printed "no more than one per space" keeps it out of the first space.
 */
export const gwDraftEfChoices = (
  G: ImperialElegyState,
  power: Power,
  first: SpaceId | null = null,
): GwDraftEfChoice[] => {
  if (counterRemaining(G, power, "expeditionary") === 0) return [];
  const out: GwDraftEfChoice[] = [];
  for (const space of Object.keys(G.spaces).sort()) {
    const state = G.spaces[space];
    const def = SPACES[space];
    if (!state || !def || isNavalBox(space) || space === first || state.trench) continue;
    if (!ownsKey(G, space, power)) continue;
    const home = isHomeSpace(G, space, power);
    const colonial = effectiveKeyType(G, space) === "colonial" && hasLoc(G, power, space);
    if (home || colonial) out.push({space, kind: "expeditionary"});
    if (colonial) out.push({space, kind: "eliteColonialEf"});
  }
  return out;
};

/** Re-validate an EF substitution choice (the same rule the options use). */
const gwDraftEfAllowed = (
  G: ImperialElegyState,
  power: Power,
  space: SpaceId,
  first: SpaceId | null,
  kind: GwDraftEfChoice["kind"],
): boolean => gwDraftEfChoices(G, power, first).some(
  (choice) => choice.space === space && choice.kind === kind,
);

/**
 * 27.5.2: the second drafted reduced army.  A null `space` forfeits it (the
 * player declined, or there was nowhere legal to put it); the first army and
 * the single CP/manpower cost have already been applied by the draft action.
 */
export const resolveGwDraftSecond = (
  G: ImperialElegyState,
  _ctx: Ctx | undefined,
  pending: PendingDecision,
  choice: string | null,
): boolean => {
  const first = typeof pending.context?.space === "string" ? (pending.context.space as SpaceId) : null;
  if (choice === null) {
    G.pending = null;
    log(G, pending.power, "gwDraftSecondForfeited", {space: first, reason: "declined"});
    return true;
  }
  let space: SpaceId;
  let kind: "army" | "expeditionary" | "eliteColonialEf" = "army";
  if (choice.startsWith("ef:")) {
    space = choice.slice("ef:".length) as SpaceId;
    kind = "expeditionary";
    if (!gwDraftEfAllowed(G, pending.power, space, first, kind)) return false;
  } else if (choice.startsWith("eliteEf:")) {
    space = choice.slice("eliteEf:".length) as SpaceId;
    kind = "eliteColonialEf";
    if (!gwDraftEfAllowed(G, pending.power, space, first, kind)) return false;
  } else {
    space = choice as SpaceId;
    if (!gwDraftSpaceAllowed(G, pending.power, space, first)) return false;
  }
  const unit = placeUnit(G, pending.power, kind, space, 1);
  G.pending = null;
  log(G, pending.power, "gwDraftSecond", {space, unit: unit.id, first, kind});
  return true;
};

const moveUnit = (G: ImperialElegyState, unit: Unit, to: SpaceId): void => {
  const from = unit.space;
  if (from && G.spaces[from]) {
    G.spaces[from].units = G.spaces[from].units.filter((id) => id !== unit.id);
  }
  G.spaces[to].units.push(unit.id);
  unit.space = to;
};


/** BFS across friendly land spaces.  Rail movement is limited to that network. */
const friendlyLandPath = (
  G: ImperialElegyState,
  power: Power,
  from: SpaceId,
  to: SpaceId,
): boolean => {
  if (from === to) return false;
  if (!landSpace(G, from) || !landSpace(G, to)) return false;
  if (!railPassable(G, power, from) || !railPassable(G, power, to)) return false;
  const seen = new Set<SpaceId>([from]);
  const queue: SpaceId[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of neighboursOf(current)) {
      if (seen.has(next) || !landSpace(G, next)) continue;
      if (connectionBetween(current, next)?.type === "tsrr" && !tsrrConnectionUsable(G, power)) continue;
      if (!railPassable(G, power, next)) continue;
      if (next === to) return true;
      seen.add(next);
      queue.push(next);
    }
  }
  return false;
};

/**
 * 30.1: rail is limited to the friendly network, and a space formally
 * controlled by a departed power joins that network only once it is occupied
 * (including by that power's former allies).
 */
const railPassable = (G: ImperialElegyState, power: Power, space: SpaceId): boolean =>
  maneuverFriendly(G, space, power) ||
  (isFormerlyControlledSpace(G, space) && formerlyControlledRailAllowed(G, power, space));

/**
 * The same search with 30.1's occupation requirement set aside.  It is only
 * used to report that a failed rail path was blocked by an unoccupied formerly
 * controlled space rather than by the ordinary friendly-network rule.
 */
const railReachableIgnoringOccupation = (
  G: ImperialElegyState,
  power: Power,
  from: SpaceId,
  to: SpaceId,
): boolean => {
  if (from === to) return false;
  if (!landSpace(G, from) || !landSpace(G, to)) return false;
  const passable = (space: SpaceId): boolean =>
    railPassable(G, power, space) || formerlyControlledMarchAllowed(G, power, space);
  if (!passable(from) || !passable(to)) return false;
  const seen = new Set<SpaceId>([from]);
  const queue: SpaceId[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of neighboursOf(current)) {
      if (seen.has(next) || !landSpace(G, next)) continue;
      if (!passable(next)) continue;
      if (next === to) return true;
      seen.add(next);
      queue.push(next);
    }
  }
  return false;
};

/** 12.3: the printed reason a planned GW naval route was refused. */
const navalPathFailure = (reason: string): string => {
  switch (reason) {
    case "enemyPort":
      return "An enemy port needs a naval battle, not a maneuver";
    case "suezClosed":
    case "suezBlocked":
      return "The Suez Canal is closed to this move";
    case "dardanellesDenied":
      return "The Dardanelles controller is at war with the mover";
    case "notNavalSpace":
    case "unknownSpace":
      return "Naval units must end in a naval box or port";
    case "enemyBox":
      return "An enemy-occupied naval box is not a stepping stone";
    default:
      return "No legal naval route to that destination under one NMP";
  }
};

const navalDestinationAllowed = (
  G: ImperialElegyState,
  destinations: Power[],
  to: SpaceId,
): boolean => {
  if (!G.spaces[to]) return false;
  if (isNavalBox(to)) return true;
  return destinations.some((p) => friendlySpace(G, to, p));
};

// ------------------------------------------------------------------ planning

/**
 * Start (or restart) GW planning for the current `G.gw.turn`.
 *
 * This is deliberately idempotent enough to be called from the phase
 * `onBegin` hook and from `resolveGwWinter`:
 *   - existing held GW cards are kept, missing ones are dealt;
 *   - combat-typed cards are marked faceup for the turn;
 *   - every power's GW budget is recalculated (Second Empire France +1);
 *   - per-turn flags and bonus-impulse records are reset.
 *
 * It does not advance `G.gw.turn`; winter owns the turn advance.
 */
export const beginGwTurn = (G: ImperialElegyState, ctx: Ctx): GwBeginResult => {
  if (!G.gw?.active) return fail("noGreatWar", "The Great War is not active");
  const gw = G.gw;
  const turn = gw.turn;
  const dealt: Partial<Record<Power, CardId>> = {};
  const faceupCombat: FaceupCombatMap = {};
  const budgets: Partial<Record<Power, number>> = {};
  // The phase onBegin hook may run after `resolveGwWinter` already began this
  // planning step.  Budgets (and the one-shot bonus CP) are therefore only set
  // on the first pass for this GW turn; card dealing and trench placement stay
  // idempotent and always run.
  const firstBudgetPass = gw.budgetTurn !== turn;

  gw.bonusImpulses = [];
  G.flags.gwBonusImpulse = false;
  G.flags.gwAllyImpulse = "";
  // 26.2: the US has a 4 CP and Italy a 2 CP war budget every GW turn.
  gw.usBudget = 4;
  gw.italyBudget = 2;
  delete G.flags[FACEUP_COMBAT_FLAG];
  // 26.1: facedown GW combat cards are flipped faceup during planning and may
  // be used by the player they sit in front of this turn.
  flipFacedownGwCombatCards(G);
  for (const power of POWERS) {
    const p = G.powers[power];
    p.flags.passedGw = false;
    p.flags.gwActionsThisImpulse = 0;
    p.flags.gwCpTransferDone = false;
    // Clear markers written by older saves; the source of truth is G.flags.
    delete p.flags.gwFaceupCombat;
    // War budget is the GW budget; the limited-war budget is reset here.
    const secondEmpireBonus = power === "FR" && p.government === "secondEmpire" ? 1 : 0;
    if (firstBudgetPass) {
      // 29.1: never plan from industry above the (possibly reduced) maximum.
      p.industry = Math.min(p.industry, maxIndustryOf(G, power));
      const bonus = Number(gw.bonusCp?.[power] ?? 0);
      p.gwBudget = Math.max(2, p.industry) + secondEmpireBonus + (Number.isFinite(bonus) ? bonus : 0);
    }
    p.warBudget = 0;
    budgets[power] = p.gwBudget ?? 0;
  }
  if (firstBudgetPass) {
    gw.bonusCp = {};
    gw.budgetTurn = turn;
  }

  // 28.1: "At the start of GW turn 1 all keys automatically contain trenches."
  // Turn 0 is the outbreak turn and has none.  Idempotent: an existing trench
  // battle marker/terrain survives a repeated planning begin, so this can be
  // called from the phase hook as often as boardgame.io likes.
  if (turn >= 1) {
    let placed = 0;
    for (const def of Object.values(SPACES)) {
      // A printed key is any key/capital/subcapital, including minor-power
      // home keys (they have no player `keyType`).
      if (def.type !== "key" && def.type !== "capital" && def.type !== "subcapital") continue;
      const state = G.spaces[def.id];
      if (!state) continue;
      const hadLine = state.trenchLine === true;
      state.trenchLine = true;
      if (!hadLine) placed += 1;
      gw.trenches[def.id] = state.trench?.status ?? gw.trenches[def.id] ?? "deadlock";
    }
    if (placed > 0) log(G, undefined, "trenchesPlaced", {turn, count: placed});
  }

  // Clean any GW card that leaked into the action discard pile (older saves or
  // the generic GW-event path) into the GW discard pile.  The action discard
  // is reshuffled into the ACTION deck, so a GW card must never stay there.
  const greatWarIds = new Set(CARDS.greatWar.map((card) => card.id));
  const strayGw = G.discard.filter((id) => greatWarIds.has(id));
  if (strayGw.length > 0) {
    gw.discard = [...new Set([...(gw.discard ?? []), ...strayGw])];
    G.discard = G.discard.filter((id) => !greatWarIds.has(id));
  }
  // The card pool is the printed GW deck minus removed cards and cards still
  // held by a power.  A card held over from last turn is kept (not redrawn).
  const held = new Set<CardId>();
  // Cards in front of a player are out of the GW deck until played; never
  // deal a second copy while one sits on the table (26.1).
  for (const entry of gwCombatCardsInFront(G)) held.add(entry.cardId);
  // Cards in either discard pile are not dealt: a GW-05/GW-06 that was just
  // played must not be dealt straight back to a player.
  for (const id of gw.discard ?? []) held.add(id);
  for (const id of G.discard) if (greatWarIds.has(id)) held.add(id);
  for (const power of POWERS) {
    const p = G.powers[power];
    const card = p.gwCard;
    if (card === null || card === undefined) continue;
    // Defensive cleanup for older saves: removed or duplicated cards go back
    // to the pool instead of being kept faceup forever.
    if (G.removed.includes(card) || held.has(card)) {
      p.gwCard = null;
      continue;
    }
    held.add(card);
  }
  const pool = CARDS.greatWar
    .map((card) => card.id)
    .filter((id) => !G.removed.includes(id) && !held.has(id));

  for (const power of POWERS) {
    if (G.powers[power].eliminated) continue;
    const p = G.powers[power];
    if (!p.gwCard) {
      if (pool.length === 0) continue;
      const index = Math.max(0, Math.min(pool.length - 1, die(ctx, pool.length) - 1));
      const [card] = pool.splice(index, 1);
      p.gwCard = card;
      dealt[power] = card;
    }
  }
  // Only cards lying in front of a player are faceup combat cards (26.1).
  // Held GW cards (including GW-05) are not marked faceup; the planning step
  // has just flipped the in-front facedown cards above.  A holder may have
  // both GW-03 and GW-04.
  Object.assign(faceupCombat, faceupFromInFront(G));
  G.flags[FACEUP_COMBAT_FLAG] = serializeFaceupCombat(faceupCombat);

  // 33.2 Rapid Deployment: a UK that joins the Great War while neutral gets
  // the grant when the next planning step opens (the outbreak grants it when
  // the UK starts as a belligerent).
  if (gw.belligerents.includes("UK")) grantRapidDeployment(G, "gw");
  // 33.2 "Join Your Country's Army!": armies gained during the Outbreak Step
  // are placed in London during the Planning Step of GW turn 1, even if the UK
  // is neutral at this point.
  const joinArmies = placeJoinYourCountrysArmy(G);
  if (joinArmies > 0) log(G, "UK", "joinYourCountrysArmy", {armies: joinArmies});

  G.phase = "gwPlanning";
  G.cpRemaining = 0;
  G.impulseCard = null;
  const firstIndex = firstLivingOrderIndex(G);
  const firstPower = firstIndex >= 0 ? (gw.order[firstIndex] as Power) : null;
  if (firstPower) G.activePower = firstPower;
  G.turnIndex = firstIndex >= 0 ? firstIndex : 0;
  log(G, undefined, "gwPlanning", {turn});
  return {
    ok: true,
    turn,
    phase: "gwPlanning",
    dealt,
    faceupCombat,
    budgets,
    order: gw.order,
    firstPower,
    usIn: gw.usIn,
    italyIn: gw.italyIn,
  };
};

/**
 * 33.2 "Join Your Country's Army!" / 25.6.1: at the start of the Planning Step
 * of GW turn 1, place every army the UK gained during the Outbreak Step in
 * London, at full strength and without any manpower cost, and set the printed
 * reminder marker.  Idempotent and neutral-UK safe; returns the number placed.
 */
export const placeJoinYourCountrysArmy = (G: ImperialElegyState): number => {
  if (!G.gw?.active) return 0;
  if (G.gw.turn < 1) return 0;
  const pending = Number(G.powers.UK.flags.joinYourCountrysArmyPending ?? 0);
  if (!Number.isFinite(pending) || pending <= 0) return 0;
  const count = Math.floor(pending);
  delete G.powers.UK.flags.joinYourCountrysArmyPending;
  for (let i = 0; i < count; i += 1) {
    // Full-strength British armies; 33.2 says the free outbreak armies do not
    // cost manpower, so no manpower is charged here.
    placeUnit(G, "UK", "army", "london", 2);
  }
  // The printed reminder counter; it also records that the placement ran.
  G.powers.UK.flags.joinYourCountrysArmy = true;
  return count;
};

/** Leave planning and enter the maneuver step at the first living order slot. */
export const startGwManeuver = (G: ImperialElegyState, ctx: Ctx): GwManeuverBeginResult => {
  if (!G.gw?.active) return fail("noGreatWar", "The Great War is not active");
  if (G.phase !== "gwPlanning") return fail("wrongPhase", "Not in the GW planning step");
  if (G.pending !== null) return fail("pending", "A pending decision blocks the maneuver step");
  const index = firstLivingOrderIndex(G);
  const power = index >= 0 ? (G.gw.order[index] as Power) : null;
  if (!power) return fail("invalidOrder", "The GW order has no living power");
  for (const p of POWERS) G.powers[p].flags.passedGw = false;
  G.powers[power].flags.gwActionsThisImpulse = 0;
  // 15.2.3/29.3: the maneuver step begins a new impulse.
  clearDeployedThisImpulse(G);
  G.phase = "gwManeuver";
  G.cpRemaining = 0;
  G.activePower = power;
  G.turnIndex = index;
  G.flags.gwBonusImpulse = false;
  log(G, undefined, "gwManeuver", {turn: G.gw.turn});
  return {ok: true, power, index, order: G.gw.order};
};

/**
 * CP transfer during planning: one belligerent hands part of its GW budget to
 * an ally.  Once per planning step per donor, and only within the same side.
 */
export const transferGwBudget = (
  G: ImperialElegyState,
  ctx: Ctx,
  from: Power,
  to: Power,
  amount: number,
): GwTransferResult => {
  if (!G.gw?.active) return fail("noGreatWar", "The Great War is not active");
  if (G.phase !== "gwPlanning") return fail("wrongPhase", "CP can only be transferred in planning");
  if (from === to) return fail("invalidTarget", "A power cannot transfer CP to itself");
  if (!Number.isInteger(amount) || amount <= 0) return fail("invalidTarget", "Transfer must be a positive integer");
  if (!G.powers[from] || !G.powers[to]) return fail("invalidTarget", "Unknown power");
  if (G.powers[from].eliminated || G.powers[to].eliminated) return fail("eliminated", "Eliminated powers cannot transfer CP");
  if (!G.gw.belligerents.includes(from) || !G.gw.belligerents.includes(to)) {
    return fail("notBelligerent", "Both powers must be GW belligerents");
  }
  const sideFrom = sideOf(G, from);
  const sideTo = sideOf(G, to);
  if (sideFrom === null || sideFrom !== sideTo) return fail("notAllied", "CP can only be transferred to an ally");
  const p = G.powers[from];
  if (p.flags.gwCpTransferDone === true) return fail("alreadyUsed", "This power already transferred CP this turn");
  const fromBefore = p.gwBudget ?? 0;
  if (fromBefore < amount) return fail("insufficientBudget", "Not enough GW budget to transfer");
  const toBefore = G.powers[to].gwBudget ?? 0;
  p.gwBudget = fromBefore - amount;
  G.powers[to].gwBudget = toBefore + amount;
  p.flags.gwCpTransferDone = true;
  log(G, from, "gwCpTransfer", {to, amount});
  return {
    ok: true,
    from,
    to,
    amount,
    fromBefore,
    fromAfter: p.gwBudget,
    toBefore,
    toAfter: G.powers[to].gwBudget,
  };
};

/** Reveal this power's current GW card if it is a combat card. */
export const revealGwCombatCard = (G: ImperialElegyState, power: Power): GwRevealResult => {
  if (!G.gw?.active) return fail("noGreatWar", "The Great War is not active");
  const p = G.powers[power];
  if (!p) return fail("invalidTarget", `Unknown power ${power}`);
  const cardId = p.gwCard;
  if (!cardId) return fail("noCard", `${power} has no GW card`);
  // GW-03/GW-04 have the facedown in-front lifecycle (26.1); GW-06 is printed
  // as a response but is played as a combat card, so it may also be revealed
  // faceup.  GW-05's event mode flips another card instead of being revealed.
  if (cardId !== "IE-GW-03" && cardId !== "IE-GW-04" && cardId !== "IE-GW-06") {
    return fail("invalidCard", "Only GW combat cards can be faceup");
  }
  const cards = faceupCombatCards(G);
  cards[power] = cardId;
  G.flags[FACEUP_COMBAT_FLAG] = serializeFaceupCombat(cards);
  log(G, power, "gwCombatCardFaceup", {card: cardId});
  return {ok: true, power, cardId};
};

/** Faceup combat cards for the current turn, for display and validation. */
export const faceupCombatCards = (G: ImperialElegyState): FaceupCombatMap => {
  // `G.gw.combatCardsInFront` is authoritative (26.1): it changes immediately
  // when a card is placed or flipped, unlike the turn-start flag snapshot.
  // `playerView` calls this for legacy saves too, where the flag bag can still
  // be missing; read it through a local so the view hook never throws.
  const flags = G.flags as Record<string, boolean | number | string> | undefined;
  const live = faceupFromInFront(G);
  if (Object.keys(live).length > 0) {
    if (flags !== undefined && flags !== null) flags[FACEUP_COMBAT_FLAG] = serializeFaceupCombat(live);
    return live;
  }
  // Fallback for saves/tests that only seeded the public flag.
  return parseFaceupCombat(flags?.[FACEUP_COMBAT_FLAG]);
};

export interface GwCombatFlipSuccess {
  ok: true;
  /** Player the flipped card sits in front of (and now may use). */
  holder: Power;
  cardId: CardId;
}

export type GwCombatFlipResult = GwCombatFlipSuccess | GwFailure;

/**
 * GW-05 "Capable Commander" may also be played as a normal event/response at
 * the start of an impulse to flip one facedown GW combat card faceup (26.1).
 * `holder`/`cardId` select the card when more than one is facedown; without
 * them the first facedown card is flipped.  The caller owns consuming GW-05.
 */
export const flipFaceDownGwCombatCard = (
  G: ImperialElegyState,
  holder?: Power,
  cardId?: CardId,
): GwCombatFlipResult => {
  if (!G.gw?.active) return fail("noGreatWar", "The Great War is not active");
  if (facedownGwCombatCards(G).length === 0) {
    return fail("noCard", "No facedown GW combat card is available to flip");
  }
  const entry = flipGwCombatCardFaceup(G, holder, cardId);
  if (!entry) return fail("invalidCard", "That card is not a facedown GW combat card");
  log(G, entry.holder, "gwCombatCardFlipped", {card: entry.cardId});
  return {ok: true, holder: entry.holder, cardId: entry.cardId};
};

/**
 * GW-05's non-battle mode: choose one facedown in-front card and flip it
 * faceup through the shared lifecycle helper.  The caller (the GW event /
 * response handler) owns consuming GW-05 itself.
 */
export const chooseGw05FlipCard = (
  G: ImperialElegyState,
  cardId?: CardId,
): GwCombatFlipResult => {
  const facedown = facedownGwCombatCards(G);
  if (facedown.length === 0) {
    return fail("noCard", "No facedown GW combat card is available to flip");
  }
  const target = cardId === undefined
    ? facedown[0]
    : facedown.find((entry) => entry.cardId === cardId);
  if (!target) return fail("invalidCard", "That card is not a facedown GW combat card");
  return flipFaceDownGwCombatCard(G, target.holder, target.cardId);
};

// ------------------------------------------------------------------ impulses

/**
 * Advance one impulse slot in `G.gw.order`.
 *
 * The order may contain `"bonus"`, `"IT"`, `"US"` and `null` slots.  A
 * `"bonus"` slot is not a power: it grants an extra impulse to the alliance
 * with fewer living order slots, selected deterministically.  `"IT"`/`"US"`
 * slots do the same once that ally has entered the war.  Passed powers are
 * skipped, so the caller can loop until `kind === "end"`.
 *
 * The cursor is `G.turnIndex` rather than `order.indexOf(G.activePower)`:
 * a bonus impulse gives the SAME power a second consecutive slot, and an
 * index lookup by power name would jump back to its first slot.
 */
export const advanceGwImpulse = (G: ImperialElegyState, ctx: Ctx): GwImpulseResult => {
  if (!G.gw?.active) return fail("noGreatWar", "The Great War is not active");
  if (G.phase !== "gwManeuver") return fail("wrongPhase", "Not in the GW maneuver step");
  if (G.pending !== null) return fail("pending", "A pending decision blocks the next impulse");
  const order = G.gw.order;
  if (order.length === 0) return fail("invalidOrder", "The GW order is empty");
  let start = G.turnIndex;
  if (!Number.isInteger(start) || start < 0 || start >= order.length) {
    start = order.findIndex((slot) => isPower(slot) && slot === G.activePower);
  }
  // Once every belligerent has passed, the maneuver step is over; do not hand
  // out a bonus impulse from a stale order slot.
  const allPassedNow = G.gw.belligerents.every(
    (p) => !G.powers[p] || G.powers[p].eliminated || G.powers[p].flags.passedGw === true,
  );
  if (allPassedNow) {
    // 26.3: the US and then Italy act after all player powers.  Their slots
    // sit after the players' slots, so give each entered major that has not
    // yet acted this turn its impulse before the maneuver step ends.
    for (let index = start + 1; index < order.length; index += 1) {
      const slot = order[index];
      if (slot !== "IT" && slot !== "US") continue;
      if (!isEnteredAlly(G, slot) || G.gw.bonusImpulses.includes(slot)) continue;
      if (majorBudget(G, slot) < 1) continue;
      const side = allySide(G, slot);
      const controller = side ? pickSidePower(G, side) : null;
      if (!controller) continue;
      G.gw.bonusImpulses.push(slot);
      return activateImpulse(G, ctx, controller, index, true, "ally", slot);
    }
    G.flags.gwAllyImpulse = "";
    return {ok: true, kind: "end", index: start, allPassed: true};
  }
  for (let step = 1; step <= order.length; step += 1) {
    const index = (start + step) % order.length;
    const slot = order[index];
    if (slot === null || slot === undefined) continue;
    if (slot === "bonus") {
      const bonus = pickBonusPower(G);
      if (!bonus) continue;
      G.gw.bonusImpulses.push(bonus.power);
      return activateImpulse(G, ctx, bonus.power, index, true, "bonus", slot);
    }
    if (slot === "IT" || slot === "US") {
      if (!isEnteredAlly(G, slot)) continue;
      if (G.gw.bonusImpulses.includes(slot) || majorBudget(G, slot) < 1) continue;
      const side = allySide(G, slot);
      if (!side) continue;
      const controller = pickSidePower(G, side);
      if (!controller) continue;
      G.gw.bonusImpulses.push(slot);
      return activateImpulse(G, ctx, controller, index, true, "ally", slot);
    }
    if (isPower(slot)) {
      if (G.powers[slot].eliminated) continue;
      if (G.powers[slot].flags.passedGw === true) continue;
      return activateImpulse(G, ctx, slot, index, false, "power", slot);
    }
  }
  const allPassed = G.gw.belligerents.every(
    (p) => !G.powers[p] || G.powers[p].eliminated || G.powers[p].flags.passedGw === true,
  );
  if (allPassed) {
    return {ok: true, kind: "end", index: start, allPassed: true};
  }
  return fail("noEligibleImpulse", "No living, unpassed power left in the order");
};

// ------------------------------------------------------------------ maneuver

/**
 * 32.1: refuse a US army move that would leave the North America submap before
 * the enemy-held gate spaces (Mexico and/or Canada) are occupied.  Logs the
 * printed reason so the refusal is visible, then returns the flow failure.
 */
const usNorthAmericaExitGuard = (
  G: ImperialElegyState,
  power: Power,
  units: readonly Unit[],
  to: SpaceId,
): GwFailure | null => {
  const blocked = units.filter((unit) => !usArmyMayLeaveNorthAmerica(G, unit, to));
  if (blocked.length === 0) return null;
  const check = usCanLeaveNorthAmerica(G);
  log(G, power, "gwUsNorthAmericaBlocked", {
    unitIds: blocked.map((unit) => unit.id).join(","),
    to,
    required: check.required.join(","),
    unoccupied: check.unoccupied.join(","),
  });
  const missing = check.unoccupied.map((id) => SPACES[id]?.name ?? id).join(" and ");
  return fail(
    "invalidTarget",
    `32.1: US armies cannot leave North America until ${missing || "Mexico and Canada"} are occupied`,
  );
};

/**
 * Validate and resolve one GW maneuver action.  Each action costs exactly one
 * GW budget point and mutates only the units/spaces/budget it touches.
 *
 * `landBattle` delegates to the existing combat entry point, so the normal
 * support/card/loss/retreat prompts are unchanged.
 */
export const performGwManeuver = (
  G: ImperialElegyState,
  ctx: Ctx,
  request: GwManeuverRequest,
): GwManeuverResult => {
  const guard = requireManeuver(G, request.power);
  if ("ok" in guard) return guard;
  const power = request.power;
  const p = G.powers[power];
  const budget = guard.budget;
  // 5.5.3 / 5.5.4 / 28.1.5: movement-end stacking and trench-exit rules.
  const destinationProblem = maneuverDestinationProblem(G, power, request);
  if (destinationProblem !== null) return fail("invalidTarget", destinationProblem);
  const major = gwAllyImpulseFor(G, power);
  if (major !== null && !["landBattle", "march", "rail", "naval"].includes(request.kind)) {
    // A US/Italian impulse only moves and fights with that major's units;
    // reserves, drafting, refits and joint operations belong to the player.
    return fail("invalidTarget", `Only movement and battles are possible during the ${major} impulse`);
  }
  const finish = (payload: Partial<GwManeuverSuccess> = {}): GwManeuverSuccess => {
    // 15.3: every live land maneuver re-records occupation at the destination.
    // The origin keeps its marker (persistence), so the vacated space is not
    // reconciled here.
    if (request.kind === "march" || request.kind === "rail") {
      if (payload.to !== undefined) recordOccupation(G, payload.to);
    }
    if (major === "US" && G.gw) G.gw.usBudget = budget - 1;
    else if (major === "IT" && G.gw) G.gw.italyBudget = budget - 1;
    else p.gwBudget = budget - 1;
    p.flags.gwActionsThisImpulse = Number(p.flags.gwActionsThisImpulse ?? 0) + 1;
    // 30.1 safety net: a maneuver that leaves an enemy capital occupied (the
    // normal case is a battle advance through `finishBattle`, but a forced or
    // scripted occupation also passes here) surrenders its owner at once.
    resolveCapitalSurrenders(G, ctx);
    log(G, power, "gwManeuverAction", {kind: request.kind, ...payload, cost: 1});
    return {
      ok: true,
      kind: request.kind,
      power,
      cost: 1,
      budgetBefore: budget,
      budgetAfter: budget - 1,
      ...payload,
    };
  };

  switch (request.kind) {
    case "deploy": {
      if (!landSpace(G, request.space)) return fail("invalidTarget", "Deploy reserves needs a land space");
      if (!friendlySpace(G, request.space, power)) return fail("invalidTarget", "Deploy reserves needs a friendly space");
      if (!isHomeSpace(G, request.space, power) && !ownsKey(G, request.space, power)) {
        return fail("invalidTarget", "Deploy reserves must be in a home space or key you control");
      }
      const unitId = request.unitId ?? p.reserves[0];
      if (!unitId) return fail("noReserve", "No reserve army is available");
      const unit = G.units[unitId];
      if (!unit || unit.owner !== power || !p.reserves.includes(unitId)) {
        return fail("noReserve", "That unit is not in this power's reserve box");
      }
      // 5.5.3: a deploy still cannot end overstacked.
      if (movementEndProblem(G, request.space, [unit]) !== null) {
        return fail("invalidTarget", "That deploy would end overstacked (5.5.3)");
      }
      p.reserves = p.reserves.filter((id) => id !== unitId);
      unit.space = request.space;
      // 15.2.3: "An army that was placed using the deploy reserves action
      // cannot attack, support, or move during the impulse it was placed."
      unit.flags = {...(unit.flags ?? {}), deployedThisImpulse: true};
      G.spaces[request.space].units.push(unitId);
      return finish({to: request.space, unitIds: [unitId]});
    }
    case "draft": {
      // 27.5.2: drafted reduced armies "must be placed in controlled home
      // keys, no more than one per space", without a trench battle marker and
      // within the 5.5.1 stacking limit.
      if (!gwDraftSpaceAllowed(G, power, request.space, null)) {
        return fail(
          "invalidTarget",
          "A draft needs a controlled home key with room for one more army and no trench battle marker (27.5.2)",
        );
      }
      if (p.manpower < 1) return fail("noManpower", "Not enough manpower to draft");
      // 4.2: two reduced armies are two army counters (the second is forfeited
      // when there is nowhere legal to put it, but a full draft needs both).
      const remaining = counterRemaining(G, power, "army");
      if (remaining !== null && remaining < 2) {
        return fail("noCounter", `${power} does not have two more army counters`);
      }
      p.manpower -= 1;
      const first = placeUnit(G, power, "army", request.space, 1);
      const payload = finish({to: request.space, unitIds: [first.id]});
      // A capital surrender or another printed decision opened by `finish`
      // takes precedence; the second army is then forfeited rather than
      // stacking a second pending decision on top of it.
      if (G.pending === null) {
        const secondSpaces = gwDraftSpaces(G, power, request.space);
        const efChoices = gwDraftEfChoices(G, power, request.space);
        if (secondSpaces.length === 0 && efChoices.length === 0) {
          log(G, power, "gwDraftSecondForfeited", {space: request.space, reason: "noSpace"});
        } else {
          openDecision(G, ctx, {
            kind: "gwDraft",
            power,
            prompt: "Draft: choose the space for the second reduced army or an EF substitute",
            promptArgs: {power, first: request.space},
            options: [
              ...secondSpaces.map((space) => option(space, spaceLabel(space, "en"))),
              ...efChoices.map(({space, kind}) => option(
                `${kind === "expeditionary" ? "ef" : "eliteEf"}:${space}`,
                `${kind === "expeditionary" ? "EF" : "Elite colonial EF"} in ${spaceLabel(space, "en")}`,
                {kind, space},
                false,
                `${kind === "expeditionary" ? "远征军" : "精锐殖民远征军"}：${spaceLabel(space, "zh_CN")}`,
              )),
            ],
            context: {space: request.space, unitId: first.id},
            blocking: true,
          });
        }
      }
      return payload;
    }
    case "refit": {
      const unit = G.units[request.unitId];
      if (!unit || unit.owner !== power || unit.naval) return fail("invalidUnit", "Refit needs your land unit");
      if (!isArmyKind(unit.kind) || unit.elite) return fail("invalidUnit", "Only two-step land units can be refit");
      if (unit.steps >= 2) return fail("invalidUnit", "That unit is already at full strength");
      unit.steps = 2;
      return finish({unitIds: [unit.id]});
    }
    case "refitFleet": {
      const unit = G.units[request.unitId];
      if (!unit || unit.owner !== power || !unit.naval) return fail("invalidUnit", "Refit fleet needs your naval unit");
      if (!isNavalKind(unit.kind)) return fail("invalidUnit", "Only squadrons and dreadnoughts can be refit");
      if (unit.steps >= 2) return fail("invalidUnit", "That fleet is already at full strength");
      unit.steps = 2;
      return finish({unitIds: [unit.id]});
    }
    case "landBattle": {
      if (G.battle !== null) return fail("pending", "A battle is already in progress");
      if (!landSpace(G, request.from) || !landSpace(G, request.to)) {
        return fail("invalidTarget", "Land battles need land spaces");
      }
      // 32.1: a US army in the attacking space may not be carried out of
      // North America by the battle (or by an ally attacking with it).
      const usAttackers = landUnitsIn(G, request.from).filter((unit) => unit.owner === "US");
      const usBlocked = usNorthAmericaExitGuard(G, power, usAttackers, request.to);
      if (usBlocked) return usBlocked;
      const battle = beginLandBattle(G, ctx, power, request.from, request.to);
      if (!battle) return fail("invalidBattle", "No legal land battle from that space");
      return finish({
        from: request.from,
        to: request.to,
        battle: {
          kind: "land",
          attacker: battle.attacker,
          defender: battle.defender,
          from: battle.from,
          to: battle.to,
        },
      });
    }
    case "rail":
    case "march": {
      const unit = G.units[request.unitId];
      const commanded =
        commandsUnit(G, power, unit) ||
        (request.kind === "rail" && commandsRailMinorArmy(G, power, unit));
      if (!commanded || unit.naval || !unit.space) {
        return fail("invalidUnit", "That is not your land unit on the map");
      }
      // 15.2.3: a reserve army deployed this impulse cannot move.
      if (unit.flags?.deployedThisImpulse === true) {
        return fail("invalidTarget", "A unit deployed this impulse cannot move (15.2.3)");
      }
      // 30.1: a space formally controlled by an eliminated power is not
      // friendly, but other players may still march into (and out of) it.
      const freeMarchFrom = formerlyControlledMarchAllowed(G, power, unit.space);
      if (!maneuverFriendly(G, unit.space, power) && !freeMarchFrom) {
        return fail("invalidTarget", "The unit starts in an unfriendly space");
      }
      if (!landSpace(G, request.to)) return fail("invalidTarget", "Destination must be a land space");
      const friendlyDestination = maneuverFriendly(G, request.to, power);
      const freeMarchTo = formerlyControlledMarchAllowed(G, power, request.to);
      if (request.kind === "march") {
        if (!neighboursOf(unit.space).includes(request.to)) return fail("invalidTarget", "March is one adjacent space");
        if (!friendlyDestination && !freeMarchTo) {
          return fail("invalidTarget", "March destination must be friendly");
        }
      } else if (!friendlyLandPath(G, power, unit.space, request.to)) {
        // 30.1: "all spaces formally controlled by the eliminated power must be
        // occupied ... before players may rail through them."
        if (railReachableIgnoringOccupation(G, power, unit.space, request.to)) {
          return fail(
            "invalidTarget",
            "A space formerly controlled by an eliminated power must be occupied before rail may pass through it (30.1)",
          );
        }
        return fail("invalidTarget", "No friendly rail path to that space");
      }
      // 32.1: the US may not march or rail armies out of North America while
      // an enemy-held Mexico/Canada gate remains unoccupied.
      const usBlocked = usNorthAmericaExitGuard(G, power, [unit], request.to);
      if (usBlocked) return usBlocked;
      const from = unit.space;
      moveUnit(G, unit, request.to);
      if (request.kind === "march" && !friendlyDestination && freeMarchTo) {
        log(G, power, "gwFreeMarch", {
          from,
          to: request.to,
          control: formerlyControlledOwner(G, request.to) ?? "",
        });
      }
      // 28.1.5: a trench battle marker is removed when a side vacates the
      // space; the opposing side keeps control/occupation.
      pruneTrenchBattle(G, from);
      pruneTrenchBattle(G, request.to);
      return finish({from, to: request.to, unitIds: [unit.id]});
    }
    case "naval": {
      if (!Array.isArray(request.unitIds) || request.unitIds.length === 0) {
        return fail("invalidUnit", "Select at least one naval unit");
      }
      const units = request.unitIds.map((id) => G.units[id]);
      if (units.some((unit) => !commandsUnit(G, power, unit) || !unit.naval || !unit.space)) {
        return fail("invalidUnit", "Naval movement needs your naval units on the map");
      }
      const from = units[0]!.space!;
      if (units.some((unit) => unit!.space !== from)) return fail("invalidUnit", "All naval units must start together");
      if (from === request.to) return fail("invalidTarget", "Naval units are already in that space");
      // 19.0: a destination containing enemy ships is a contact battle, not an
      // illegal parking spot.
      const contact = navalUnitsIn(G, request.to).some((unit) => hostileOwner(G, power, unit.owner));
      // 12.3: the naval movement point allows unlimited movement through
      // European Waters, so the GW maneuver uses the same multi-box planner as
      // the wartime move (gates, port entry and NMP cost included).
      const plan = planNavalMove(G, power, from, request.to, {allowEnemyDestination: contact});
      if (!plan.ok) {
        // 3.4.1: a direct `performGwManeuver` caller gets the same permission
        // prompt as the live wrappers before the budget is spent.
        if (plan.reason === "dardanellesPermission") {
          const route = planNavalMove(G, power, from, request.to, {
            allowEnemyDestination: contact,
            ignoreDardanellesGate: true,
          });
          if (route.ok && requestDardanellesPassage(G, ctx, power, from, request.to, route.path)) {
            return fail("invalidTarget", "The Dardanelles controller's permission is required", true);
          }
        }
        return fail("invalidTarget", navalPathFailure(plan.reason));
      }
      if (!contact && !navalDestinationAllowed(G, [power], request.to) && !maneuverFriendly(G, request.to, power)) {
        return fail("invalidTarget", "Naval units must end in a naval box or friendly port");
      }
      // 5.5.4: at most four attacking ships against a port.
      if (contact && !isNavalBox(request.to) && units.length > PORT_NAVAL_LIMIT) {
        return fail("invalidTarget", "A port can be attacked with at most four naval units");
      }
      for (const unit of units) moveUnit(G, unit!, request.to);
      const result = finish({from, to: request.to, unitIds: [...request.unitIds]});
      if (contact) openNavalContactDecision(G, ctx, power, from, request.to, request.unitIds);
      return result;
    }
    case "jointNaval": {
      if (request.ally === power) return fail("invalidTarget", "Joint naval operations need two powers");
      if (!allied(G, power, request.ally)) return fail("notAllied", "The second power is not your ally");
      if (!G.gw!.belligerents.includes(request.ally)) return fail("notBelligerent", "The ally is not a GW belligerent");
      if (!Array.isArray(request.unitIds) || request.unitIds.length === 0) {
        return fail("invalidUnit", "Select at least one of your naval units");
      }
      if (!Array.isArray(request.allyUnitIds) || request.allyUnitIds.length === 0) {
        return fail("invalidUnit", "Select at least one allied naval unit");
      }
      const own = request.unitIds.map((id) => G.units[id]);
      const allies = request.allyUnitIds.map((id) => G.units[id]);
      if (own.some((unit) => !unit || unit.owner !== power || !unit.naval || !unit.space)) {
        return fail("invalidUnit", "Joint naval operation has an invalid unit of yours");
      }
      if (allies.some((unit) => !unit || unit.owner !== request.ally || !unit.naval || !unit.space)) {
        return fail("invalidUnit", "Joint naval operation has an invalid allied unit");
      }
      const from = own[0]!.space!;
      if ([...own, ...allies].some((unit) => unit!.space !== from)) {
        return fail("invalidUnit", "All joint naval units must start in the same box or port");
      }
      if (from === request.to) return fail("invalidTarget", "Joint naval units are already in that space");
      const contact = navalUnitsIn(G, request.to).some(
        (unit) => hostileOwner(G, power, unit.owner) || hostileOwner(G, request.ally, unit.owner),
      );
      // 15.2.2 + 12.3: both contingents trace the same NMP route; each side's
      // own gates (Suez, Dardanelles, enemy boxes) apply.
      const planBySide = [power, request.ally].map((side) => ({
        side,
        plan: planNavalMove(G, side, from, request.to, {allowEnemyDestination: contact}),
      }));
      const blocked = planBySide.find((entry) => !entry.plan.ok);
      if (blocked) {
        if (blocked.plan.reason === "dardanellesPermission") {
          const route = planNavalMove(G, blocked.side, from, request.to, {
            allowEnemyDestination: contact,
            ignoreDardanellesGate: true,
          });
          if (route.ok && requestDardanellesPassage(G, ctx, blocked.side, from, request.to, route.path)) {
            return fail("invalidTarget", "The Dardanelles controller's permission is required", true);
          }
        }
        return fail("invalidTarget", navalPathFailure(blocked.plan.reason));
      }
      if (!contact && !navalDestinationAllowed(G, [power, request.ally], request.to)) {
        return fail("invalidTarget", "Joint naval units must end in a naval box or a friendly port");
      }
      if (contact && !isNavalBox(request.to) && own.length + allies.length > PORT_NAVAL_LIMIT) {
        return fail("invalidTarget", "A port can be attacked with at most four naval units");
      }
      // 19.1: a joint naval operation enters every box on its 12.3 route in
      // turn, so an intermediate box connected to an enemy port interrupts the
      // move exactly like a single-power GW naval maneuver.  Park both
      // contingents in that box, spend the action once, and hand the mover the
      // typed transit cursor plus the interception window.
      const transitIndex = firstTransitInterceptHop(G, power, planBySide[0].plan.path);
      if (transitIndex > 0) {
        const hop = planBySide[0].plan.path[transitIndex];
        for (const unit of [...own, ...allies]) moveUnit(G, unit!, hop);
        const result = finish({
          from,
          to: hop,
          unitIds: [...request.unitIds, ...request.allyUnitIds],
          ally: request.ally,
        });
        G.navalTransit = {
          power,
          ally: request.ally,
          unitIds: [...request.unitIds, ...request.allyUnitIds],
          path: [...planBySide[0].plan.path],
          index: transitIndex,
        };
        openNavalTransitInterception(G, ctx);
        return result;
      }
      for (const unit of [...own, ...allies]) moveUnit(G, unit!, request.to);
      const result = finish({
        from,
        to: request.to,
        unitIds: [...request.unitIds, ...request.allyUnitIds],
        ally: request.ally,
      });
      if (contact) {
        openNavalContactDecision(G, ctx, power, from, request.to, [
          ...request.unitIds,
          ...request.allyUnitIds,
        ], {ally: request.ally});
      } else if (isNavalBox(request.to) && navalInterceptCandidates(G, power, request.to).length > 0) {
        // 19.1: a destination box with enemy ports but no enemy ships in it can
        // still be intercepted; the 19.2 avoidance chain only exists when there
        // is a fleet to fight.
        openNavalContactDecision(G, ctx, power, from, request.to, [
          ...request.unitIds,
          ...request.allyUnitIds,
        ], {ally: request.ally});
      }
      return result;
    }
    default: {
      const exhaustive: never = request;
      return fail("invalidTarget", `Unknown maneuver action ${JSON.stringify(exhaustive)}`);
    }
  }
};

// ------------------------------------------------------------------ winter

// ------------------------------------------------------------------ 29.2 colonial war

/** 29.2: the spaces of one colonial submap (units there provide the modifiers). */
const colonialRegionSpaces = (region: "africa" | "asia") =>
  Object.values(SPACES).filter((def) => def.submap === region);

/** 29.2: army counters that provide the "+1 per army on the continent". */
const COLONIAL_ARMY_KINDS: ReadonlySet<string> = new Set([
  "army",
  "reserveArmy",
  "minorArmy",
  "italianArmy",
  "usArmy",
]);

/** 29.2: the printed naval-supremacy boxes for each colonial war. */
export const COLONIAL_NAVAL_BOXES: Record<"africa" | "asia", readonly SpaceId[]> = {
  africa: ["south-atlantic", "indian-ocean"],
  asia: ["pacific-ocean", "indian-ocean"],
};

/** The GW side a unit fights for on a colonial submap, if any. */
const colonialUnitSide = (G: ImperialElegyState, unit: Unit, space: SpaceId): GwSide | null => {
  if (!G.gw) return null;
  if (isPower(unit.owner)) {
    if (G.powers[unit.owner]?.eliminated) return null;
    if (G.gw.te.includes(unit.owner)) return "te";
    if (G.gw.ta.includes(unit.owner)) return "ta";
    return null;
  }
  if (unit.owner === "US" || unit.owner === "IT") return gwMajorSide(G, unit.owner);
  // A minor power's units count for the alliance whose ally marker holds the
  // space (they are not the minor's own colonial war).
  const ally = G.spaces[space]?.ally ?? null;
  return isPower(ally) ? sideOf(G, ally) : null;
};

/**
 * 29.2: an alliance has naval supremacy when the printed boxes "only contain
 * units from their alliance".  A neutral or enemy ship breaks it, and the
 * alliance must actually be present in *both* boxes (a lone ship in one ocean
 * is not supremacy over the other).
 */
export const hasColonialNavalSupremacy = (
  G: ImperialElegyState,
  side: GwSide,
  region: "africa" | "asia",
): boolean => {
  for (const box of COLONIAL_NAVAL_BOXES[region]) {
    let friendly = 0;
    for (const id of G.spaces[box]?.units ?? []) {
      const unit = G.units[id];
      if (!unit || unit.naval !== true) continue;
      if (colonialUnitSide(G, unit, box) !== side) return false;
      friendly += 1;
    }
    if (friendly === 0) return false;
  }
  return true;
};

/** 29.2: modifiers for one side and the human-readable sources behind them. */
export const colonialWarModifiers = (
  G: ImperialElegyState,
  side: GwSide,
  region: "africa" | "asia",
): {mod: number; sources: string[]} => {
  let mod = 0;
  const sources: string[] = [];
  for (const def of colonialRegionSpaces(region)) {
    const state = G.spaces[def.id];
    if (!state) continue;
    for (const id of state.units) {
      const unit = G.units[id];
      if (!unit) continue;
      if (colonialUnitSide(G, unit, def.id) !== side) continue;
      if (unit.kind === "eliteColonialEf") {
        mod += 2;
        sources.push(`eliteColonialEf:${unit.owner}`);
      } else if (isEliteKind(unit.kind)) {
        mod += 1;
        sources.push(`elite:${unit.owner}`);
      } else if (unit.kind === "expeditionary") {
        mod += 1;
        sources.push(`ef:${unit.owner}`);
      } else if (COLONIAL_ARMY_KINDS.has(unit.kind)) {
        mod += 1;
        sources.push(`army:${unit.owner}`);
      }
    }
  }
  if (hasColonialNavalSupremacy(G, side, region)) {
    mod += 2;
    sources.push("navalSupremacy");
  }
  return {mod, sources};
};

/**
 * 29.2: which alliance controls every *counted* space on a colonial submap.
 * Neutral spaces are not counted (29.2.1): spaces controlled by a neutral
 * player, a minor power or nobody are ignored, so a belligerent's colonial
 * empire counts as controlled unless an enemy has taken one of its spaces.
 */
export const colonialSubmapControl = (
  G: ImperialElegyState,
  region: "africa" | "asia",
): GwSide | null => {
  if (!G.gw) return null;
  let side: GwSide | null = null;
  let counted = 0;
  for (const def of colonialRegionSpaces(region)) {
    const control = G.spaces[def.id]?.control;
    let controlSide: GwSide | null = null;
    if (isPower(control)) controlSide = sideOf(G, control);
    else if (control === "US" || control === "IT") controlSide = gwMajorSide(G, control);
    if (controlSide === null) continue;
    if (side === null) side = controlSide;
    else if (side !== controlSide) return null;
    counted += 1;
  }
  return counted > 0 ? side : null;
};

/** 29.2: eliminate a unit or take an army step on the losing submap. */
const applyColonialLoss = (
  G: ImperialElegyState,
  region: "africa" | "asia",
  side: GwSide,
  roll: GwColonialWarRoll,
): void => {
  const candidates = [
    ...colonialRegionSpaces(region).flatMap((def) =>
      (G.spaces[def.id]?.units ?? []).map((id) => ({id, space: def.id})),
    ),
  ]
    .map((entry) => ({...entry, unit: G.units[entry.id]}))
    .filter(
      (entry): entry is {id: string; space: SpaceId; unit: Unit} =>
        Boolean(entry.unit) &&
        isPower(entry.unit!.owner) &&
        colonialUnitSide(G, entry.unit!, entry.space) === side,
    )
    // Deterministic: single-step units are eliminated first, then full armies
    // take one step each; ties by owner then unit id.
    .sort(
      (a, b) =>
        (a.unit.steps <= 1 ? 0 : 1) - (b.unit.steps <= 1 ? 0 : 1) ||
        String(a.unit.owner).localeCompare(String(b.unit.owner)) ||
        a.id.localeCompare(b.id, "en", {numeric: true}),
    );
  const chosen = candidates[0];
  if (!chosen) return;
  const eliminated = chosen.unit.steps <= 1 || chosen.unit.elite === true;
  if (eliminated) removeUnit(G, chosen.id);
  else chosen.unit.steps -= 1;
  roll.losses.push({
    power: chosen.unit.owner as Power,
    unitId: chosen.id,
    kind: chosen.unit.kind,
    eliminated,
  });
  log(G, chosen.unit.owner as Power, "gwColonialLoss", {
    region,
    unit: chosen.id,
    kind: chosen.unit.kind,
    space: chosen.space,
    eliminated,
  });
};

/** 29.2: the first living ally that may take `space` (fort + LoC checks). */
export const colonialTransferTaker = (
  G: ImperialElegyState,
  side: GwSide,
  space: SpaceId,
): Power | null => {
  if (!G.gw) return null;
  const state = G.spaces[space];
  if (!state) return null;
  const roster: Power[] = side === "te" ? G.gw.te : G.gw.ta;
  for (const by of livingPowers(G, roster)) {
    // An enemy fort cannot simply be taken by a colonial-war result.
    if (state.fort && hostileOwner(G, by, state.fort.power)) continue;
    if (!hasLoc(G, by, space, {requireTwoSources: false, respectNavalGates: true})) continue;
    return by;
  }
  return null;
};

/**
 * 29.2: every unoccupied space on `region` that the winning alliance may take
 * (with a LoC from at least one living ally).  The printed order of the submap
 * is preserved so the deterministic fallback is stable.
 */
export const colonialTransferOptions = (
  G: ImperialElegyState,
  region: "africa" | "asia",
  side: GwSide,
): SpaceId[] => {
  const out: SpaceId[] = [];
  for (const def of colonialRegionSpaces(region)) {
    const state = G.spaces[def.id];
    if (!state || state.units.length > 0) continue;
    const control = state.control;
    const controlSide = isPower(control) ? sideOf(G, control) : null;
    // Already ours: nothing to take.
    if (controlSide === side) continue;
    // A neutral player's colony is not a colonial-war target.
    if (isPower(control) && controlSide === null) continue;
    if (state.rebellion) continue;
    if (colonialTransferTaker(G, side, def.id) === null) continue;
    out.push(def.id);
  }
  return out;
};

/** 29.2: apply one chosen transfer, with the 30.0 key-loss/recapture hook. */
export const applyColonialTransferTo = (
  G: ImperialElegyState,
  ctx: Ctx,
  region: "africa" | "asia",
  side: GwSide,
  by: Power,
  space: SpaceId,
  roll: GwColonialWarRoll,
): void => {
  const state = G.spaces[space];
  if (!state) return;
  const control = state.control;
  const previous = isPower(control) ? (control as Power) : null;
  // 30.0 key-loss / recapture: resolve against the old control first.
  if (previous) applyGwKeyCapture(G, space, previous, by, ctx);
  setSpaceControl(G, space, by, {clearInfluence: true, clearDiplomacy: true});
  state.ally = null;
  if (previous) applyGwKeyCapture(G, space, previous, by, ctx);
  roll.transfers.push({side, by, space, from: control === null ? null : String(control)});
  log(G, by, "gwColonialTransfer", {region, space, from: control === null ? "" : String(control)});
};

/** 29.2: the winning player takes one unoccupied space with a LoC. */
const applyColonialTransfer = (
  G: ImperialElegyState,
  ctx: Ctx,
  region: "africa" | "asia",
  side: GwSide,
  roll: GwColonialWarRoll,
): void => {
  if (!G.gw) return;
  const roster = side === "te" ? G.gw.te : G.gw.ta;
  for (const by of livingPowers(G, roster)) {
    for (const def of colonialRegionSpaces(region)) {
      const state = G.spaces[def.id];
      if (!state || state.units.length > 0) continue;
      const control = state.control;
      const controlSide = isPower(control) ? sideOf(G, control) : null;
      // Already ours: nothing to take.
      if (controlSide === side) continue;
      // A neutral player's colony is not a colonial-war target.
      if (isPower(control) && controlSide === null) continue;
      if (state.rebellion) continue;
      // An enemy fort cannot simply be taken by a colonial-war result.
      if (state.fort && hostileOwner(G, by, state.fort.power)) continue;
      if (!hasLoc(G, by, def.id, {requireTwoSources: false, respectNavalGates: true})) continue;
      applyColonialTransferTo(G, ctx, region, side, by, def.id, roll);
      return;
    }
  }
};

/** 29.2.1: UK loses 1 per lost colonial roll; RU loses 1 for two lost spaces. */
export const RU_COLONIAL_CHECK_SPACES: readonly SpaceId[] = [
  "central-asia",
  "qajar-persia",
  "manchuria",
];

const applyColonialStability = (
  G: ImperialElegyState,
  ctx: Ctx,
  africa: GwColonialWarRoll,
  asia: GwColonialWarRoll,
): {power: Power; delta: number; reason: string}[] => {
  if (!G.gw) return [];
  const changes: {power: Power; delta: number; reason: string}[] = [];
  const ukSide = sideOf(G, "UK");
  if (ukSide !== null && G.gw.belligerents.includes("UK") && !G.powers.UK.eliminated) {
    for (const [region, roll] of [
      ["africa", africa],
      ["asia", asia],
    ] as const) {
      if (roll.winner === null || roll.winner === ukSide) continue;
      const delta = changeStability(G, "UK", -1, ctx, {cause: "war"});
      if (delta === 0) continue;
      changes.push({power: "UK", delta, reason: `lost the ${region} colonial war`});
      log(G, "UK", "gwColonialStability", {delta, reason: `lost the ${region} colonial war`});
    }
  }
  const ruSide = sideOf(G, "RU");
  if (ruSide !== null && G.gw.belligerents.includes("RU") && !G.powers.RU.eliminated) {
    const enemyControlled = RU_COLONIAL_CHECK_SPACES.filter((spaceId) => {
      const state = G.spaces[spaceId];
      if (!state) return false;
      if (isPower(state.occupiedBy)) {
        const occupierSide = sideOf(G, state.occupiedBy);
        if (occupierSide !== null && occupierSide !== ruSide) return true;
      }
      if (!isPower(state.control)) return false;
      const controlSide = sideOf(G, state.control);
      return controlSide !== null && controlSide !== ruSide;
    }).length;
    if (enemyControlled >= 2) {
      const delta = changeStability(G, "RU", -1, ctx, {cause: "war"});
      if (delta !== 0) {
        const reason = `${enemyControlled} of Central Asia, Qajar Persia and Manchuria are enemy controlled`;
        changes.push({power: "RU", delta, reason});
        log(G, "RU", "gwColonialStability", {delta, reason});
      }
    }
  }
  return changes;
};

/**
 * 29.2.1: one bonus CP for controlling all counted spaces on one submap and
 * three for both.  The pool is split deterministically (round-robin in seat
 * order) amongst the alliance's living, non-blockaded members; if none is
 * eligible the bonus is lost and logged.
 */
const awardColonialBonusCp = (
  G: ImperialElegyState,
  winter: GwWinterState,
): void => {
  if (!G.gw) return;
  const control = {
    africa: colonialSubmapControl(G, "africa"),
    asia: colonialSubmapControl(G, "asia"),
  };
  for (const side of ["te", "ta"] as GwSide[]) {
    const regions = (Object.keys(control) as ("africa" | "asia")[]).filter(
      (region) => control[region] === side,
    );
    const pool = regions.length >= 2 ? 3 : regions.length === 1 ? 1 : 0;
    if (pool === 0) continue;
    const roster: Power[] = side === "te" ? G.gw.te : G.gw.ta;
    const eligible: Power[] = livingPowers(G, roster).filter((p) => !winter.blockaded.includes(p));
    if (eligible.length === 0) {
      log(G, undefined, "gwColonialBonusCp", {side, pool, regions: regions.join(","), recipients: "", lost: true});
      continue;
    }
    const recipients: Power[] = [];
    for (let i = 0; i < pool; i += 1) {
      const power = eligible[i % eligible.length];
      winter.bonusCp[power] = (winter.bonusCp[power] ?? 0) + 1;
      recipients.push(power);
    }
    log(G, undefined, "gwColonialBonusCp", {
      side,
      pool,
      regions: regions.join(","),
      recipients: recipients.join(","),
      lost: false,
    });
  }
};

/** 29.2: how `resolveColonialWar` handles the winner's territorial reward. */
export interface ColonialWarOptions {
  /**
   * Leave the transfer to the live `gwColonialTransfer` pending decision.  The
   * roll still records the losses; the caller applies each chosen space.  The
   * default (helpers, bots, the one-shot winter) applies the deterministic
   * first-legal-space transfer at once.
   */
  deferTransfers?: boolean;
}

/**
 * 29.2: resolve one opposed colonial-war roll.  Both alliances roll a die and
 * add the printed modifiers; an alliance controlling the whole submap makes the
 * other alliance's total count as 0 (the die is still rolled for the 29.2.1
 * stability effects).  The winning side then takes the printed losses and
 * unoccupied spaces.
 */
export const resolveColonialWar = (
  G: ImperialElegyState,
  ctx: Ctx,
  region: "africa" | "asia",
  options: ColonialWarOptions = {},
): GwColonialWarRoll => {
  const te = colonialWarModifiers(G, "te", region);
  const ta = colonialWarModifiers(G, "ta", region);
  const teRoll = die(ctx, 6);
  const taRoll = die(ctx, 6);
  const controllingSide = colonialSubmapControl(G, region);
  let teTotal = teRoll + te.mod;
  let taTotal = taRoll + ta.mod;
  if (controllingSide === "te") taTotal = 0;
  else if (controllingSide === "ta") teTotal = 0;
  const winner: GwSide | null = teTotal > taTotal ? "te" : taTotal > teTotal ? "ta" : null;
  const roll: GwColonialWarRoll = {
    region,
    te: teTotal,
    ta: taTotal,
    winner,
    teRoll,
    taRoll,
    teMod: te.mod,
    taMod: ta.mod,
    teModifiers: te.sources,
    taModifiers: ta.sources,
    controllingSide,
    losses: [],
    transfers: [],
  };
  const differential = Math.abs(teTotal - taTotal);
  if (winner !== null) {
    const losingSide: GwSide = winner === "te" ? "ta" : "te";
    const count = differential >= 4 ? 2 : 1;
    for (let i = 0; i < count; i += 1) applyColonialLoss(G, region, losingSide, roll);
    if (!options.deferTransfers) {
      for (let i = 0; i < count; i += 1) applyColonialTransfer(G, ctx, region, winner, roll);
    }
  }
  log(G, undefined, "colonialWar", {
    region,
    teRoll,
    taRoll,
    teTotal,
    taTotal,
    teMod: te.mod,
    taMod: ta.mod,
    winner,
    controlling: controllingSide ?? "",
  });
  return roll;
};

// ------------------------------------------------- 29.2 live winner choices

/** 29.2.1: the submaps a side currently controls, in printed order. */
const colonialControlRegions = (
  G: ImperialElegyState,
  side: GwSide,
): ("africa" | "asia")[] =>
  (["africa", "asia"] as const).filter((region) => colonialSubmapControl(G, region) === side);

/**
 * 29.2: the printed controller of a winning alliance's decisions.  The rules
 * name a single "winning player"; when the alliance has no live seat the
 * deterministic controller is the first non-blockaded living ally (falling
 * back to the first living ally, then nobody).
 */
export const colonialController = (
  G: ImperialElegyState,
  side: GwSide,
  blockaded: readonly Power[] = [],
): Power | null => {
  if (!G.gw) return null;
  const roster: Power[] = side === "te" ? G.gw.te : G.gw.ta;
  const living = livingPowers(G, roster);
  return living.find((power) => !blockaded.includes(power)) ?? living[0] ?? null;
};

/**
 * 29.2.1: deterministic pool split used by bots/helpers and when the alliance
 * has only one eligible member.  Round-robin in seat order, exactly as the
 * pre-choice engine did.
 */
const awardColonialBonusPool = (
  winter: GwWinterState,
  pool: number,
  eligible: readonly Power[],
): Power[] => {
  const recipients: Power[] = [];
  for (let i = 0; i < pool; i += 1) {
    const power = eligible[i % eligible.length];
    winter.bonusCp[power] = (winter.bonusCp[power] ?? 0) + 1;
    recipients.push(power);
  }
  return recipients;
};

/**
 * 29.2.1: build the live bonus-CP choices.  A pool that can only go to one
 * eligible ally is awarded deterministically; an ambiguous pool opens one
 * `gwColonialBonusCp` decision per CP so the players can agree or explicitly
 * lose the bonus.  Called after every territorial transfer has been applied, so
 * "controls all counted spaces" is evaluated on the final map.
 */
const planColonialBonusChoices = (G: ImperialElegyState, winter: GwWinterState): void => {
  if (!G.gw) return;
  const choices: GwColonialBonusChoice[] = winter.colonialBonus ?? [];
  for (const side of ["te", "ta"] as GwSide[]) {
    const regions = colonialControlRegions(G, side);
    const pool = regions.length >= 2 ? 3 : regions.length === 1 ? 1 : 0;
    if (pool === 0) continue;
    const roster: Power[] = side === "te" ? G.gw.te : G.gw.ta;
    const eligible: Power[] = livingPowers(G, roster).filter((power) => !winter.blockaded.includes(power));
    if (eligible.length === 0) {
      log(G, undefined, "gwColonialBonusCp", {
        side,
        pool,
        regions: regions.join(","),
        recipients: "",
        lost: true,
        reason: "blockaded",
      });
      continue;
    }
    if (eligible.length === 1) {
      const recipients = awardColonialBonusPool(winter, pool, eligible);
      log(G, undefined, "gwColonialBonusCp", {
        side,
        pool,
        regions: regions.join(","),
        recipients: recipients.join(","),
        lost: false,
      });
      continue;
    }
    choices.push({
      side,
      pool,
      by: eligible[0],
      eligible,
      remaining: pool,
      allocation: {},
      done: false,
    });
  }
  winter.colonialBonus = choices;
};

/** Open the next transfer decision, or apply/dismiss a forced one in place. */
const openColonialTransferDecision = (
  G: ImperialElegyState,
  ctx: Ctx,
  winter: GwWinterState,
  choice: GwColonialTransferChoice,
): boolean => {
  if (choice.remaining <= 0) {
    choice.done = true;
    return false;
  }
  const controller = G.powers[choice.by]?.eliminated ? colonialController(G, choice.side, winter.blockaded) : choice.by;
  if (controller === null) {
    log(G, choice.by, "gwColonialTransfer", {region: choice.region, space: "", skip: true});
    choice.done = true;
    return false;
  }
  choice.by = controller;
  const options = colonialTransferOptions(G, choice.region, choice.side);
  if (options.length === 0) {
    log(G, choice.by, "gwColonialTransfer", {
      region: choice.region,
      space: "",
      skip: true,
      remaining: choice.remaining,
    });
    choice.done = true;
    return false;
  }
  G.pending = null;
  const index = (winter.colonialTransfers ?? []).indexOf(choice);
  openDecision(G, ctx, {
    kind: "gwColonialTransfer",
    power: choice.by,
    prompt: "Colonial war: choose an unoccupied space to take",
    promptArgs: {region: choice.region, side: choice.side, remaining: choice.remaining},
    options: [
      ...options.map((space) => option(space, spaceLabel(space, "en"), {space})),
      option("skip", "Take no further space", undefined, false, "不再夺取空间"),
    ],
    context: {mode: "gwColonialChoice", choice: index, region: choice.region, side: choice.side},
    blocking: true,
  });
  return true;
};

/** Open the next bonus-CP decision (one CP at a time) or award a forced pool. */
const openColonialBonusDecision = (
  G: ImperialElegyState,
  ctx: Ctx,
  winter: GwWinterState,
  choice: GwColonialBonusChoice,
): boolean => {
  if (choice.remaining <= 0) {
    choice.done = true;
    return false;
  }
  if (choice.eligible.length === 0) {
    log(G, undefined, "gwColonialBonusCp", {
      side: choice.side,
      pool: choice.pool,
      regions: colonialControlRegions(G, choice.side).join(","),
      recipients: "",
      lost: true,
      reason: "blockaded",
    });
    choice.done = true;
    return false;
  }
  if (choice.eligible.length === 1) {
    const recipients = awardColonialBonusPool(winter, choice.remaining, choice.eligible);
    choice.allocation[choice.eligible[0]] = (choice.allocation[choice.eligible[0]] ?? 0) + choice.remaining;
    choice.remaining = 0;
    choice.done = true;
    log(G, undefined, "gwColonialBonusCp", {
      side: choice.side,
      pool: choice.pool,
      regions: colonialControlRegions(G, choice.side).join(","),
      recipients: recipients.join(","),
      lost: false,
    });
    return false;
  }
  G.pending = null;
  const index = (winter.colonialBonus ?? []).indexOf(choice);
  openDecision(G, ctx, {
    kind: "gwColonialBonusCp",
    power: choice.by,
    prompt: "Colonial bonus CP: allocate the next CP or reject the split",
    promptArgs: {side: choice.side, pool: choice.pool, remaining: choice.remaining},
    options: [
      ...choice.eligible.map((power) =>
        option(
          `power:${power}`,
          `Give 1 bonus CP to ${POWER_DEFS[power]?.name ?? power}`,
          {power},
          false,
          `给予${POWER_DEFS[power]?.nameZh ?? power} 1 点奖励 CP`,
        ),
      ),
      option("decline", "No agreement: all bonus CP are lost", undefined, false, "未能达成一致：所有奖励 CP 丢失"),
    ],
    context: {mode: "gwColonialChoice", choice: index, side: choice.side},
    blocking: true,
  });
  return true;
};

/**
 * 29.2: drive the live colonial choices.  Returns true when a pending decision
 * was opened; false when every transfer and bonus allocation is finished (the
 * caller then continues to 29.3 / closes the winter).
 */
export const advanceWinterColonialChoices = (
  G: ImperialElegyState,
  ctx: Ctx,
  winter: GwWinterState,
): boolean => {
  for (;;) {
    const transfer = (winter.colonialTransfers ?? []).find((choice) => !choice.done);
    if (transfer) {
      if (openColonialTransferDecision(G, ctx, winter, transfer)) return true;
      continue;
    }
    if (winter.colonialBonusPlanned !== true) {
      planColonialBonusChoices(G, winter);
      winter.colonialBonusPlanned = true;
    }
    const bonus = (winter.colonialBonus ?? []).find((choice) => !choice.done);
    if (bonus) {
      if (openColonialBonusDecision(G, ctx, winter, bonus)) return true;
      continue;
    }
    return false;
  }
};

/**
 * 29.2/29.2.1: answer one live colonial decision.  Returns false for an
 * illegal option so the move layer can return `INVALID_MOVE`.
 */
export const resolveGwColonialChoice = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: {kind: string; power: Power; options: {id: string}[]; context?: Record<string, unknown>},
  optionId: string,
): boolean => {
  const winter = G.gw?.winter;
  if (!G.gw || !winter) return false;
  if (!pending.options.some((entry) => entry.id === optionId)) return false;
  const index = Number(pending.context?.choice);
  if (!Number.isInteger(index) || index < 0) return false;

  if (pending.kind === "gwColonialTransfer") {
    const choice = winter.colonialTransfers?.[index];
    if (!choice || choice.done || choice.by !== pending.power) return false;
    if (optionId === "skip") {
      log(G, choice.by, "gwColonialTransfer", {
        region: choice.region,
        space: "",
        skip: true,
        remaining: choice.remaining,
      });
      choice.done = true;
    } else {
      const space = optionId as SpaceId;
      if (!colonialTransferOptions(G, choice.region, choice.side).includes(space)) return false;
      const by = colonialTransferTaker(G, choice.side, space);
      if (by === null) return false;
      applyColonialTransferTo(G, ctx, choice.region, choice.side, by, space, winter.colonialWar[choice.region]);
      choice.taken.push(space);
      choice.remaining = Math.max(0, choice.remaining - 1);
      if (choice.remaining === 0) choice.done = true;
    }
  } else if (pending.kind === "gwColonialBonusCp") {
    const choice = winter.colonialBonus?.[index];
    if (!choice || choice.done || choice.by !== pending.power) return false;
    if (optionId === "decline") {
      // "If players cannot come to an agreement, all bonus CP are lost": undo
      // the portion of this pool that was already assigned, keeping any CP from
      // another source untouched.
      for (const [power, amount] of Object.entries(choice.allocation) as [Power, number][]) {
        const left = (winter.bonusCp[power] ?? 0) - (amount ?? 0);
        if (left > 0) winter.bonusCp[power] = left;
        else delete winter.bonusCp[power];
      }
      choice.allocation = {};
      choice.remaining = 0;
      choice.done = true;
      log(G, undefined, "gwColonialBonusCp", {
        side: choice.side,
        pool: choice.pool,
        regions: colonialControlRegions(G, choice.side).join(","),
        recipients: "",
        lost: true,
        reason: "disagreement",
      });
    } else {
      if (!optionId.startsWith("power:")) return false;
      const power = optionId.slice("power:".length);
      if (!isPower(power) || !choice.eligible.includes(power)) return false;
      winter.bonusCp[power] = (winter.bonusCp[power] ?? 0) + 1;
      choice.allocation[power] = (choice.allocation[power] ?? 0) + 1;
      choice.remaining -= 1;
      if (choice.remaining <= 0) {
        choice.done = true;
        const recipients = choice.eligible.flatMap((entry) =>
          Array.from({length: choice.allocation[entry] ?? 0}, () => entry),
        );
        log(G, undefined, "gwColonialBonusCp", {
          side: choice.side,
          pool: choice.pool,
          regions: colonialControlRegions(G, choice.side).join(","),
          recipients: recipients.join(","),
          lost: false,
        });
      }
    }
  } else {
    return false;
  }

  G.pending = null;
  if (!advanceWinterColonialChoices(G, ctx, winter)) {
    continueWinterAfterColonial(G, ctx, winter);
  }
  return true;
};

// ------------------------------------------------------------------ 29.3 neutral entry

/** 29.3: living neutral player powers. */
export const livingNeutrals = (G: ImperialElegyState): Power[] =>
  G.gw ? livingPowers(G, [...G.gw.neutrals]) : [];

/** 29.3: player-power counts of each GW alliance. */
export const gwSideCounts = (G: ImperialElegyState): {te: number; ta: number} => ({
  te: G.gw ? livingPowers(G, G.gw.te).length : 0,
  ta: G.gw ? livingPowers(G, G.gw.ta).length : 0,
});

/**
 * 29.3: the alliances a neutral may shift into.  Two printed limits:
 *  - the 8.4 three-player cap.  It counts *living* alliance members: 30.1 says
 *    a player eliminated during the GW no longer counts as being in an
 *    alliance, so elimination can reopen a slot;
 *  - it cannot join an alliance that already contains more players than the
 *    opposing alliance.
 */
export const neutralEntrySides = (G: ImperialElegyState, power: Power): GwSide[] => {
  if (!G.gw) return [];
  if (!G.gw.neutrals.includes(power)) return [];
  const counts = gwSideCounts(G);
  const out: GwSide[] = [];
  for (const side of ["te", "ta"] as GwSide[]) {
    const mine = side === "te" ? counts.te : counts.ta;
    if (mine >= ALLIANCE_MAX_PLAYERS) continue;
    const other = side === "te" ? counts.ta : counts.te;
    if (mine > other) continue;
    out.push(side);
  }
  return out;
};

/** Insert a joining neutral in the next free GW order slot (29.3). */
export const insertNeutralOrderSlot = (G: ImperialElegyState, power: Power): number => {
  if (!G.gw) return -1;
  if (G.gw.order.includes(power)) return G.gw.order.indexOf(power);
  // The "next available spot" is the last player slot: the major slots (IT/US)
  // and the bonus slot stay at the end of the order.
  let index = 0;
  for (let i = 0; i < G.gw.order.length; i += 1) {
    const slot = G.gw.order[i];
    if (isPower(slot) && !G.powers[slot]?.eliminated) index = i + 1;
  }
  G.gw.order.splice(index, 0, power);
  return index;
};

/**
 * 29.3 / 25.7.1: keep the single bonus-impulse slot in step with the alliance
 * sizes.  The outnumbered alliance gets one bonus slot; equal alliances have
 * none.  Called after a neutral joins so the opposing alliance gains its bonus
 * impulse and a bonus the joined alliance no longer needs is removed.
 */
export const rebalanceBonusImpulse = (G: ImperialElegyState): void => {
  if (!G.gw) return;
  const counts = gwSideCounts(G);
  const existing = G.gw.order.filter((slot) => slot === "bonus").length;
  if (counts.te === counts.ta) {
    if (existing === 0) return;
    G.gw.order = G.gw.order.filter((slot) => slot !== "bonus");
    G.gw.bonusImpulseSide = null;
    log(G, undefined, "gwBonusImpulseRemoved", {te: counts.te, ta: counts.ta});
    return;
  }
  const side: GwSide = counts.te < counts.ta ? "te" : "ta";
  if (existing === 1) {
    // 29.3: a neutral may have pushed its alliance past the other side; the
    // printed marker belongs to whichever alliance is now outnumbered.
    G.gw.bonusImpulseSide = side;
    return;
  }
  G.gw.order = G.gw.order.filter((slot) => slot !== "bonus");
  let index = 0;
  for (let i = 0; i < G.gw.order.length; i += 1) {
    const slot = G.gw.order[i];
    if (isPower(slot) && !G.powers[slot]?.eliminated) index = i + 1;
  }
  G.gw.order.splice(index, 0, "bonus");
  G.gw.bonusImpulseSide = side;
  log(G, undefined, "gwBonusImpulse", {
    side,
    te: counts.te,
    ta: counts.ta,
  });
};

/**
 * 29.3: move a neutral's chit into `side`'s alliance and join the war.  The
 * printed 8.4/29.3 limits are validated here (not by callers).  The next free
 * order slot, the bonus-impulse rebalance and the alliance change are applied
 * immediately; the free redeployment/deploy-reserves are the caller's
 * follow-up decisions.
 */
export const joinNeutralAlliance = (
  G: ImperialElegyState,
  ctx: Ctx,
  power: Power,
  side: GwSide,
): boolean => {
  if (!G.gw) return false;
  if (!G.gw.neutrals.includes(power) || G.powers[power].eliminated) return false;
  if (!neutralEntrySides(G, power).includes(side)) {
    log(G, power, "gwNeutralEntryBlocked", {side, reason: "illegalAlliance"});
    return false;
  }
  G.powers[power].alliance = side === "te" ? "teCommitted" : "taCommitted";
  if (side === "te") G.gw.te.push(power);
  else G.gw.ta.push(power);
  G.gw.belligerents.push(power);
  G.gw.neutrals = G.gw.neutrals.filter((p) => p !== power);
  const slot = insertNeutralOrderSlot(G, power);
  rebalanceBonusImpulse(G);
  log(G, power, "gwNeutralEntry", {side, slot: slot + 1});
  ctx.events?.setActivePlayers?.({all: "play"});
  return true;
};

/**
 * 29.3: roll off for the neutral choice order.  Each neutral rolls once; the
 * highest roll chooses first, ties are rerolled among the tied neutrals.  The
 * returned `roll` is the initial face (the one printed on the table).
 */
export const rollOffNeutralOrder = (
  G: ImperialElegyState,
  ctx: Ctx,
  powers: readonly Power[] = livingNeutrals(G),
): {power: Power; roll: number}[] => {
  const initial = new Map<Power, number>();
  for (const power of powers) initial.set(power, die(ctx, 6));
  /** Break a group that all rolled the same value, highest reroll first. */
  const orderTied = (group: Power[]): Power[] => {
    if (group.length <= 1) return [...group];
    let remaining = [...group];
    const out: Power[] = [];
    let guard = 0;
    while (remaining.length > 0 && guard < 64) {
      guard += 1;
      if (remaining.length === 1) {
        out.push(remaining[0]);
        break;
      }
      const faces = new Map<Power, number>();
      for (const power of remaining) faces.set(power, die(ctx, 6));
      const best = Math.max(...[...faces.values()]);
      const winners = remaining.filter((power) => faces.get(power) === best);
      if (winners.length === remaining.length) {
        // Constant/again-equal dice: keep the printed seat order and stop.
        out.push(...remaining);
        break;
      }
      if (winners.length === 1) {
        out.push(winners[0]);
        remaining = remaining.filter((power) => power !== winners[0]);
        continue;
      }
      // The winners still tie for the top: they rank above the rest.
      out.push(...orderTied(winners));
      remaining = remaining.filter((power) => !winners.includes(power));
    }
    return out;
  };
  const values = [...new Set(initial.values())].sort((a, b) => b - a);
  const ordered: Power[] = [];
  for (const value of values) {
    const group = powers.filter((power) => initial.get(power) === value);
    ordered.push(...orderTied([...group]));
  }
  return ordered.map((power) => ({power, roll: initial.get(power) ?? 0}));
};

/** 29.3: free redeployment destinations (12.15 without the CP cost). */
const neutralRedeployDestinations = (
  G: ImperialElegyState,
  power: Power,
  unit: Unit,
): SpaceId[] => {
  const from = unit.space;
  if (!from) return [];
  const out: SpaceId[] = [];
  for (const to of Object.keys(G.spaces)) {
    if (to === from || isNavalBox(to)) continue;
    const state = G.spaces[to];
    if (!state) continue;
    const endsFriendly =
      friendlySpace(G, to, power) || (state.influence === power && state.control === null);
    if (!endsFriendly) continue;
    const occupied = state.units.some((id) => {
      const other = G.units[id];
      if (!other) return false;
      if (other.owner === power) return false;
      if (isPower(other.owner) && allied(G, other.owner, power)) return false;
      return true;
    });
    if (occupied) continue;
    if (state.fort && state.fort.power !== power && !(isPower(state.fort.power) && allied(G, state.fort.power, power))) continue;
    out.push(to);
  }
  return out;
};

/** 29.3: which of the neutral's land units can take the free redeployment. */
const neutralRedeployCandidates = (
  G: ImperialElegyState,
  power: Power,
  moved: readonly string[] = [],
): {unitId: string; destinations: SpaceId[]}[] =>
  Object.keys(G.units)
    .map((id) => G.units[id])
    .filter((unit) => unit.owner === power && unit.naval !== true && Boolean(unit.space) && !moved.includes(unit.id))
    .map((unit) => ({
      unitId: unit.id,
      destinations: neutralRedeployDestinations(G, power, unit),
    }))
    .filter((candidate) => candidate.destinations.length > 0)
    .sort((a, b) => a.unitId.localeCompare(b.unitId, "en", {numeric: true}));

/** 29.3: the free deploy-reserves allowance (15.2.3: half industry, 1..3). */
export const freeDeployAllowance = (G: ImperialElegyState, power: Power): number =>
  Math.min(3, Math.max(1, Math.floor(G.powers[power].industry / 2)));

/** 29.3: spaces for the free deploy-reserves action (15.2.3). */
const neutralDeploySpaces = (G: ImperialElegyState, power: Power): SpaceId[] => {
  const out: SpaceId[] = [];
  for (const def of Object.values(SPACES)) {
    // 15.2.3: reserve armies deploy to a controlled/occupied space on the main
    // map.  (The free deploy-reserves action reuses that restriction.)
    if (def.type === "navalBox" || def.submap !== "main") continue;
    const state = G.spaces[def.id];
    if (!state) continue;
    if (!friendlySpace(G, def.id, power)) continue;
    if (!isHomeSpace(G, def.id, power) && !ownsKey(G, def.id, power)) continue;
    out.push(def.id);
  }
  return out;
};

/**
 * 29.3: can the neutral trace a LoC to `target`'s capital for the bonus CP?
 * The trace is judged from the receiver's side (29.3: "enemy refers to the
 * enemies of the player receiving the CP"), through friendly spaces and naval
 * boxes without the receiver's enemies in them.
 */
export const neutralBonusCpLoc = (
  G: ImperialElegyState,
  neutral: Power,
  target: Power,
): boolean => {
  // 29.3 / 33.5: both ends use the live capital, so the Ottoman switch to
  // Ankara is honoured when a neutral traces to (or from) the Ottomans.
  const from = capitalOf(G, neutral);
  const to = capitalOf(G, target);
  if (!from || !to || !G.spaces[from] || !G.spaces[to]) return false;
  if (from === to) return true;
  const visited = new Set<SpaceId>([from]);
  const queue: SpaceId[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of neighboursOf(current)) {
      if (visited.has(next)) continue;
      const def = SPACES[next];
      if (!def) continue;
      if (def.type === "navalBox") {
        const enemyShip = (G.spaces[next]?.units ?? []).some((id) => {
          const unit = G.units[id];
          return Boolean(unit) && unit!.naval === true && hostileOwner(G, target, unit!.owner);
        });
        if (enemyShip) continue;
      } else {
        const friendlyToReceiver = friendlySpace(G, next, target);
        const neutralHome = G.spaces[next]?.control === neutral;
        if (!friendlyToReceiver && !neutralHome) continue;
      }
      if (next === to) return true;
      visited.add(next);
      queue.push(next);
    }
  }
  return false;
};

/** 29.3: legal bonus-CP recipients for a neutral that stays out. */
export const neutralBonusCpTargets = (G: ImperialElegyState, neutral: Power): Power[] => {
  if (!G.gw) return [];
  return POWERS.filter(
    (power) =>
      G.gw!.belligerents.includes(power) &&
      !G.powers[power].eliminated &&
      power !== neutral &&
      neutralBonusCpLoc(G, neutral, power),
  );
};

const openGwNeutralEntryDecision = (
  G: ImperialElegyState,
  ctx: Ctx,
  power: Power,
  sides: GwSide[],
): void => {
  G.pending = null;
  const options = sides.map((side) =>
    option(
      `join:${side}`,
      side === "te" ? "Join the Triple Entente" : "Join the Triple Alliance",
      {side},
      false,
      side === "te" ? "加入协约国" : "加入同盟国",
    ),
  );
  options.push(option("stay", "Stay neutral", undefined, false, "保持中立"));
  openDecision(G, ctx, {
    kind: "gwNeutralEntry",
    power,
    prompt: "Neutral player: join an alliance or stay out",
    promptArgs: {power, sides: sides.join(",")},
    options,
    context: {mode: "gwNeutralEntry"},
    blocking: true,
  });
};

const openGwNeutralActionDecision = (
  G: ImperialElegyState,
  ctx: Ctx,
  power: Power,
  joined: boolean,
  entry: GwNeutralEntryState,
): void => {
  G.pending = null;
  const options: {
    id: string;
    label: string;
    labelZh?: string;
    data?: Record<string, unknown>;
    secret?: boolean;
  }[] = [];
  // 12.15 / 29.3: one free redeployment action moves all of the power's land
  // units, so keep offering it while an unmoved unit has a legal destination.
  if (!entry.usedRedeploy && neutralRedeployCandidates(G, power, entry.redeployedUnits ?? []).length > 0) {
    options.push(option("redeploy", "Free redeployment", undefined, false, "免费重新部署"));
  }
  if (joined && !entry.usedDeploy && G.powers[power].reserves.length > 0 && neutralDeploySpaces(G, power).length > 0) {
    options.push(option("deploy", "Free deploy reserves", undefined, false, "免费部署预备军"));
  }
  if (!joined) {
    for (const target of neutralBonusCpTargets(G, power)) {
      options.push(
        option(
          `cp:${target}`,
          `Give 1 bonus CP to ${target}`,
          {target},
          false,
          `给予${POWER_DEFS[target]?.nameZh ?? target} 1 点奖励 CP`,
        ),
      );
    }
  }
  options.push(option("done", joined ? "Finish joining" : "Finish", undefined, false, joined ? "完成加入" : "完成"));
  openDecision(G, ctx, {
    kind: "gwNeutralAction",
    power,
    prompt: joined ? "Free actions after joining the war" : "Free actions while staying neutral",
    promptArgs: {power, joined},
    options,
    context: {mode: "gwNeutralAction"},
    blocking: true,
  });
};

/**
 * 29.3: advance the neutral-entry sequence.  Opens the next neutral's pending
 * decision when one is waiting; returns the current state.
 */
const advanceNeutralEntry = (G: ImperialElegyState, ctx: Ctx): void => {
  const gw = G.gw;
  const entry = gw?.neutralEntry;
  if (!gw || !entry) return;
  if (entry.current !== null && G.pending !== null) return;
  if (entry.current === null) {
    const next = entry.queue.shift() ?? null;
    if (next === null) return;
    entry.current = next;
    entry.choice = null;
    entry.usedRedeploy = false;
    entry.usedDeploy = false;
    entry.unitId = null;
    entry.redeployedUnits = [];
    const sides = neutralEntrySides(G, next);
    if (sides.length === 0) {
      log(G, next, "gwNeutralEntryBlocked", {side: "", reason: "noLegalAlliance"});
    }
    openGwNeutralEntryDecision(G, ctx, next, sides);
    return;
  }
  // A current neutral without an open decision (e.g. a reload) gets its menu
  // back instead of stalling the winter.
  const joined = entry.choice === "te" || entry.choice === "ta";
  openGwNeutralActionDecision(G, ctx, entry.current, joined, entry);
};

/** 29.3: finish the current neutral and move to the next one (or the turn). */
const finishCurrentNeutral = (G: ImperialElegyState, ctx: Ctx): void => {
  const gw = G.gw;
  const entry = gw?.neutralEntry;
  if (!gw || !entry) return;
  entry.current = null;
  entry.choice = null;
  entry.usedRedeploy = false;
  entry.usedDeploy = false;
  entry.unitId = null;
  entry.redeployedUnits = [];
  G.pending = null;
  if (entry.queue.length === 0) {
    if (gw.winter) finishGwWinter(G, ctx, gw.winter);
    return;
  }
  advanceNeutralEntry(G, ctx);
};

/**
 * 29.3: resolve one of the neutral-entry pending decisions.  Returns false for
 * an illegal option so the move layer can return `INVALID_MOVE`.
 */
export const resolveGwNeutralOption = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: {kind: string; power: Power; options: {id: string}[]},
  optionId: string,
): boolean => {
  const entry = G.gw?.neutralEntry;
  if (!G.gw || !entry || entry.current === null || entry.current !== pending.power) return false;
  if (!pending.options.some((o) => o.id === optionId)) return false;
  const power = pending.power;
  switch (pending.kind) {
    case "gwNeutralEntry": {
      if (optionId === "stay") {
        entry.choice = "stay";
        G.pending = null;
        log(G, power, "gwNeutralStayOut", {});
        openGwNeutralActionDecision(G, ctx, power, false, entry);
        return true;
      }
      if (!optionId.startsWith("join:")) return false;
      const side = optionId.slice(5);
      if (side !== "te" && side !== "ta") return false;
      if (!joinNeutralAlliance(G, ctx, power, side)) return false;
      entry.choice = side;
      if (G.gw.winter) G.gw.winter.joinedNeutrals.push({power, side});
      G.pending = null;
      openGwNeutralActionDecision(G, ctx, power, true, entry);
      return true;
    }
    case "gwNeutralAction": {
      if (optionId === "done") {
        finishCurrentNeutral(G, ctx);
        return true;
      }
      if (optionId === "redeploy") {
        if (entry.usedRedeploy) return false;
        const candidates = neutralRedeployCandidates(G, power, entry.redeployedUnits ?? []);
        if (candidates.length === 0) return false;
        G.pending = null;
        openDecision(G, ctx, {
          kind: "gwNeutralUnit",
          power,
          prompt: "Choose a unit for the free redeployment",
          promptArgs: {power},
          options: [
            ...candidates.map((candidate) =>
              option(`unit:${candidate.unitId}`, unitOptionLabel(G, candidate.unitId), {unitId: candidate.unitId}),
            ),
            option("skip", "Skip the free redeployment", undefined, false, "跳过免费重新部署"),
          ],
          context: {mode: "gwNeutralAction"},
          blocking: true,
        });
        return true;
      }
      if (optionId === "deploy") {
        if (entry.choice !== "te" && entry.choice !== "ta") return false;
        if (entry.usedDeploy) return false;
        const spaces = neutralDeploySpaces(G, power);
        if (G.powers[power].reserves.length === 0 || spaces.length === 0) return false;
        G.pending = null;
        openDecision(G, ctx, {
          kind: "gwNeutralDeploy",
          power,
          prompt: "Choose the space for the free deploy reserves",
          promptArgs: {power, count: freeDeployAllowance(G, power)},
          options: [
            ...spaces.map((space) => option(space, spaceLabel(space, "en"))),
            option("skip", "Skip the free deploy reserves", undefined, false, "跳过免费部署预备军"),
          ],
          context: {mode: "gwNeutralAction"},
          blocking: true,
        });
        return true;
      }
      if (optionId.startsWith("cp:")) {
        if (entry.choice !== "stay") return false;
        const target = optionId.slice(3);
        if (!isPower(target) || !neutralBonusCpTargets(G, power).includes(target)) return false;
        if (!G.gw.winter) return false;
        G.gw.winter.bonusCp[target] = (G.gw.winter.bonusCp[target] ?? 0) + 1;
        log(G, power, "gwNeutralBonusCp", {target});
        G.pending = null;
        finishCurrentNeutral(G, ctx);
        return true;
      }
      return false;
    }
    case "gwNeutralUnit": {
      const joined = entry.choice === "te" || entry.choice === "ta";
      if (optionId === "skip") {
        entry.usedRedeploy = true;
        G.pending = null;
        openGwNeutralActionDecision(G, ctx, power, joined, entry);
        return true;
      }
      if (!optionId.startsWith("unit:")) return false;
      const unitId = optionId.slice(5);
      const candidate = neutralRedeployCandidates(G, power, entry.redeployedUnits ?? []).find(
        (c) => c.unitId === unitId,
      );
      if (!candidate) return false;
      entry.unitId = unitId;
      G.pending = null;
      openDecision(G, ctx, {
        kind: "gwNeutralDestination",
        power,
        prompt: "Choose the free redeployment destination",
        promptArgs: {power, unit: unitId},
        options: candidate.destinations.map((space) => option(space, spaceLabel(space, "en"))),
        context: {mode: "gwNeutralAction", unitId},
        blocking: true,
      });
      return true;
    }
    case "gwNeutralDestination": {
      const unitId = entry.unitId;
      const unit = unitId ? G.units[unitId] : undefined;
      if (!unit || unit.owner !== power || !unit.space) return false;
      const destinations = neutralRedeployDestinations(G, power, unit);
      if (!destinations.includes(optionId)) return false;
      const from = unit.space;
      G.spaces[from].units = G.spaces[from].units.filter((id) => id !== unit.id);
      G.spaces[optionId].units.push(unit.id);
      unit.space = optionId;
      // 12.15: the one free redeployment action may move every land unit, each
      // once; keep the action open for the remaining units.
      entry.redeployedUnits = [...(entry.redeployedUnits ?? []), unit.id];
      entry.unitId = null;
      log(G, power, "gwNeutralRedeploy", {unit: unit.id, from, to: optionId});
      G.pending = null;
      const joined = entry.choice === "te" || entry.choice === "ta";
      openGwNeutralActionDecision(G, ctx, power, joined, entry);
      return true;
    }
    case "gwNeutralDeploy": {
      const joined = entry.choice === "te" || entry.choice === "ta";
      if (optionId === "skip") {
        entry.usedDeploy = true;
        G.pending = null;
        openGwNeutralActionDecision(G, ctx, power, joined, entry);
        return true;
      }
      if (!joined) return false;
      if (!neutralDeploySpaces(G, power).includes(optionId)) return false;
      const reserves = [...G.powers[power].reserves];
      const count = Math.min(reserves.length, freeDeployAllowance(G, power));
      const placed: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const unitId = reserves[i];
        const unit = G.units[unitId];
        if (!unit) continue;
        G.powers[power].reserves = G.powers[power].reserves.filter((id) => id !== unitId);
        unit.space = optionId;
        // 15.2.3/29.3: a reserve army placed by the free deploy cannot move in
        // the impulse it was placed (the typed marker is cleared when the next
        // impulse starts).
        unit.flags = {...(unit.flags ?? {}), deployedThisImpulse: true};
        G.spaces[optionId].units.push(unitId);
        placed.push(unitId);
      }
      entry.usedDeploy = true;
      log(G, power, "gwNeutralDeploy", {space: optionId, units: placed.join(",")});
      G.pending = null;
      openGwNeutralActionDecision(G, ctx, power, joined, entry);
      return true;
    }
    default:
      return false;
  }
};

const unitOptionLabel = (G: ImperialElegyState, unitId: string): string => {
  const unit = G.units[unitId];
  if (!unit) return unitId;
  return `${unit.kind} in ${spaceLabel(unit.space ?? "", "en")}`;
};

/** 29.2: flatten both rolls' applied transfers into one public result list. */
const winterColonialTransfers = (winter: GwWinterState): {
  region: "africa" | "asia";
  side: GwSide;
  by: Power;
  space: SpaceId;
  from: string | null;
}[] => [
  ...winter.colonialWar.africa.transfers.map((transfer) => ({...transfer, region: "africa" as const})),
  ...winter.colonialWar.asia.transfers.map((transfer) => ({...transfer, region: "asia" as const})),
];

/** 29.2/29.3: the shared "winter is waiting for an answer" result. */
const winterAwaitingResult = (
  G: ImperialElegyState,
  winter: GwWinterState,
  awaiting: "colonial" | "neutral",
): GwWinterSuccess => ({
  ok: true,
  turnBefore: winter.turn,
  turnAfter: G.gw?.turn ?? winter.turn,
  blockaded: winter.blockaded,
  industryLost: winter.industryLost,
  colonialWar: winter.colonialWar,
  joinedNeutrals: [...winter.joinedNeutrals],
  eliminated: [],
  ended: false,
  reason: null,
  result: G.result,
  politicalPressureLosses: [...winter.politicalPressureLosses],
  bonusCp: {...winter.bonusCp},
  usStabilityLoss: winter.usStabilityLoss,
  colonialStability: winter.colonialStability,
  colonialTransfers: winterColonialTransfers(winter),
  ...(awaiting === "colonial" ? {awaitingColonialChoices: true} : {awaitingNeutrals: true}),
  ...(awaiting === "neutral" && G.gw?.neutralEntry
    ? {neutralOrder: G.gw.neutralEntry.rolls.map((entry) => entry.power)}
    : {}),
});

/**
 * Close the winter: pay the pending bonus CP into the next planning step,
 * advance the GW turn, eliminate, check victory and begin the next planning.
 */
const finishGwWinter = (
  G: ImperialElegyState,
  ctx: Ctx,
  winter: GwWinterState,
): GwWinterSuccess => {
  const gw = G.gw!;
  const neutralOrder = gw.neutralEntry?.rolls.map((entry) => entry.power) ?? [];
  gw.bonusCp = {...winter.bonusCp};
  gw.neutralEntry = null;
  gw.winter = null;
  gw.turn += 1;
  const base = {
    ok: true as const,
    turnBefore: winter.turn,
    turnAfter: gw.turn,
    blockaded: winter.blockaded,
    industryLost: winter.industryLost,
    colonialWar: winter.colonialWar,
    joinedNeutrals: [...winter.joinedNeutrals],
    bonusCp: {...winter.bonusCp},
    usStabilityLoss: winter.usStabilityLoss,
    colonialStability: winter.colonialStability,
    neutralOrder,
    politicalPressureLosses: [...winter.politicalPressureLosses],
    colonialTransfers: winterColonialTransfers(winter),
  };
  if (gw.turn > 5) {
    endGreatWar(G, ctx, "turnLimit");
    return {...base, eliminated: [], ended: true, reason: "turnLimit", result: G.result};
  }
  // 32.2/30.2 safety net: reconcile Italy's home keys (lost/retaken stability
  // and an enemy-held Rome) before the winter elimination checks.
  syncItalianHomeKeys(G, ctx);
  const eliminated: Power[] = [];
  for (const power of POWERS) {
    if (G.powers[power].eliminated) continue;
    if (!gw.belligerents.includes(power)) continue;
    if (G.powers[power].stability > 0) continue;
    eliminatePower(G, power, ctx, "stability");
    eliminated.push(power);
  }
  // 30.1 safety net: an occupied capital surrenders immediately, but a save
  // that reached the winter with the occupation already in place (or an
  // occupation applied by a non-battle path) is caught here.
  for (const power of resolveCapitalSurrenders(G, ctx)) {
    if (!eliminated.includes(power)) eliminated.push(power);
  }
  // 30.1 safety net: sweep permanently eliminated minors and minors whose
  // commander left play, even when the elimination happened before this winter
  // (or through a non-GW path).  Idempotent, so the live elimination hooks and
  // this backstop never double-log a minor.
  sweepOrphanedMinorUnits(G);
  checkGwVictory(G, ctx);
  if (G.result) {
    return {...base, eliminated, ended: true, reason: "elimination", result: G.result};
  }
  beginGwTurn(G, ctx);
  if (G.phase === "gwPlanning") ctx.events?.setPhase?.("gwPlanning");
  return {...base, eliminated, ended: false, reason: null, result: G.result};
};

/**
 * Resolve the GW winter step (29.0):
 *   blockade -> colonial war -> neutral entry -> advance turn ->
 *   stability/elimination -> turn-5 limit -> the next planning step.
 *
 * 29.3 is a player decision: when living neutral players exist the winter
 * stops after the colonial war, opens the first neutral-entry pending decision
 * and returns `awaitingNeutrals: true`.  Each choice (join/stay, free
 * redeployment, free deploy reserves, bonus CP) is resolved through
 * `resolveGwNeutralOption`; the last one closes the winter.  With no neutrals
 * the step completes synchronously exactly as before.
 *
 * Turn 5 is the last GW turn: after its winter the turn counter advances to 6
 * and `endGreatWar(..., "turnLimit")` decides the game.  Victory by elimination
 * is delegated to `checkGwVictory`/`endGreatWar` so the existing scoring rules
 * remain authoritative.
 */

/** GW-08/09 Political Pressure: comma-separated pressured powers. */
export const POLITICAL_PRESSURE_KEY = "politicalPressure";
/** GW-08/09 Political Pressure: the GW turn the pressure applies to. */
export const POLITICAL_PRESSURE_TURN_KEY = "politicalPressureTurn";
/** GW-10 Exhaustion: "stability" or "vp" while it is active this GW turn. */
export const EXHAUSTION_KEY = "exhaustion";
/** Per-power flag: the GW turn in which that power made a land attack. */
export const LAND_ATTACK_TURN_FLAG = "landAttackTurn";

/**
 * GW-10 Exhaustion (27.3): "This event takes effect at the end of this
 * impulse and remains active for the remainder of the GW turn."
 *
 * The resolved card queues its mode here; `activateGwExhaustion` applies it
 * when the playing impulse ends (a pass or a maneuver-turn skip), so a battle
 * fought earlier in the same impulse is not retroactively affected.
 */
export const queueGwExhaustion = (
  G: ImperialElegyState,
  power: Power,
  mode: GwExhaustionMode,
): void => {
  if (!G.gw?.active) return;
  G.gw.exhaustionPending = {mode, power, turn: G.gw.turn};
};

/**
 * Activate the queued GW-10 mode at the end of the playing impulse.  Returns
 * the mode that became active, or null when nothing was queued (or the queue
 * belongs to another GW turn / turn 0, where the event never triggers).
 */
export const activateGwExhaustion = (G: ImperialElegyState): GwExhaustionMode | null => {
  const pending = G.gw?.exhaustionPending ?? null;
  if (!G.gw || pending === null) return null;
  G.gw.exhaustionPending = null;
  // A stale queue from another GW turn is inert.
  if (pending.turn !== G.gw.turn) return null;
  // "Neither event triggers on GW turn 0."
  if (gwExhaustionTurnZero(G)) {
    log(G, pending.power, "gwTurnZero", {card: EXHAUSTION_CARD});
    return null;
  }
  if (pending.mode === "vp") {
    for (const power of POWERS) {
      if (G.powers[power].eliminated) continue;
      if (!(G.gw.belligerents ?? []).includes(power)) continue;
      G.powers[power].vp -= 1;
    }
  }
  G.persistent[EXHAUSTION_KEY] = pending.mode;
  log(G, pending.power, "gwExhaustionActivated", {mode: pending.mode});
  return pending.mode;
};

/** Powers currently under GW-08/09 pressure this turn. */
export const pressuredPowers = (G: ImperialElegyState): Power[] =>
  String(G.persistent[POLITICAL_PRESSURE_KEY] ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is Power => isPower(part));

/** Record that `power` may not be pressured again until the list is cleared. */
export const addPressuredPower = (G: ImperialElegyState, power: Power): void => {
  const list = pressuredPowers(G).filter((p) => p !== power);
  list.push(power);
  G.persistent[POLITICAL_PRESSURE_KEY] = list.join(",");
  G.persistent[POLITICAL_PRESSURE_TURN_KEY] = G.gw?.turn ?? 0;
};

/**
 * GW-08/09: is `power` adjacent to an enemy army?  "a player not adjacent to
 * any enemy armies can neither be targeted nor affected", so both the card's
 * targeting and the end-of-turn check read this predicate.
 */
export const adjacentToEnemyArmies = (G: ImperialElegyState, power: Power): boolean => {
  for (const def of Object.values(SPACES)) {
    if (def.type === "navalBox") continue;
    const state = G.spaces[def.id];
    if (!state) continue;
    const ownArmy = landUnitsIn(G, def.id).some(
      (unit) =>
        isArmyKind(unit.kind) &&
        (unit.owner === power || (!isPower(unit.owner) && state.ally === power)),
    );
    if (!ownArmy) continue;
    for (const next of neighboursOf(def.id)) {
      if (!G.spaces[next]) continue;
      const enemyArmy = landUnitsIn(G, next).some(
        (unit) => isArmyKind(unit.kind) && isPower(unit.owner) && atWar(G, power, unit.owner),
      );
      if (enemyArmy) return true;
    }
  }
  return false;
};

/** 29.0 winter options; the live phase hook leaves the choice policy to ctx. */
export interface GwWinterOptions {
  /**
   * Force the interactive winner choices on/off.  When omitted, the live
   * `gwWinter` phase hook (`ctx.phase === "gwWinter"`) prompts and every direct
   * helper/bot call keeps the deterministic fallback.
   */
  promptChoices?: boolean;
}

/**
 * 29.3: run the neutral-entry stage and then close the winter.  Shared by the
 * first winter resolution and by the continuation after the 29.2 choices.
 */
const runNeutralEntry = (
  G: ImperialElegyState,
  ctx: Ctx,
  winter: GwWinterState,
): GwWinterResult => {
  const gw = G.gw!;
  if (!gw.neutralEntry) {
    const neutrals = livingNeutrals(G);
    if (neutrals.length === 0) return finishGwWinter(G, ctx, winter);
    const rolls = rollOffNeutralOrder(G, ctx, neutrals);
    gw.neutralEntry = {
      queue: rolls.map((entry) => entry.power),
      current: null,
      rolls,
      choice: null,
      usedRedeploy: false,
      usedDeploy: false,
      unitId: null,
      redeployedUnits: [],
    };
  }
  advanceNeutralEntry(G, ctx);
  if (G.pending !== null) return winterAwaitingResult(G, winter, "neutral");
  return finishGwWinter(G, ctx, winter);
};

/** Continue the winter once every 29.2 colonial choice is answered. */
const continueWinterAfterColonial = (G: ImperialElegyState, ctx: Ctx, winter: GwWinterState): void => {
  runNeutralEntry(G, ctx, winter);
};

export const resolveGwWinter = (
  G: ImperialElegyState,
  ctx: Ctx,
  options: GwWinterOptions = {},
): GwWinterResult => {
  if (!G.gw?.active) return fail("noGreatWar", "The Great War is not active");
  if (G.phase !== "gwWinter") return fail("wrongPhase", "Not in the GW winter step");
  if (G.pending !== null) return fail("pending", "A pending decision blocks the winter step");
  const gw = G.gw;
  const interactive = options.promptChoices ?? ctx.phase === "gwWinter";

  if (!gw.winter) {
    const turnBefore = gw.turn;
    // GW-08/09 Political Pressure: at the end of this GW turn a pressured
    // player that did not make a land attack loses one stability.  The flag is
    // cleared here so it can never leak into the next turn.
    const pressureTurn = Number(G.persistent[POLITICAL_PRESSURE_TURN_KEY] ?? -1);
    const pressureLosses: Power[] = [];
    if (pressureTurn === turnBefore) {
      for (const power of pressuredPowers(G)) {
        if (!G.powers[power] || G.powers[power].eliminated) continue;
        if (Number(G.powers[power].flags[LAND_ATTACK_TURN_FLAG] ?? -1) === turnBefore) continue;
        if (!adjacentToEnemyArmies(G, power)) continue;
        changeStability(G, power, -1, ctx);
        pressureLosses.push(power);
      }
    }
    delete G.persistent[POLITICAL_PRESSURE_KEY];
    delete G.persistent[POLITICAL_PRESSURE_TURN_KEY];
    for (const p of POWERS) delete G.powers[p].flags[LAND_ATTACK_TURN_FLAG];
    // GW-10 Exhaustion lasts only for the GW turn it was played in.  A queued
    // mode that never activated (stale save) is dropped with the turn.
    delete G.persistent[EXHAUSTION_KEY];
    gw.exhaustionPending = null;
    // Every "for the rest of the turn" card flag also ends with this GW turn.
    clearTurnDurationFlags(G);
    // Clear any winter continuation left by an older interrupted save.
    gw.neutralEntry = null;

    // 29.1: blockade (turn 0 is not a year).  The new set applies to the
    // coming turn; GW-07 reads "currently" and "last turn" from the two sets.
    const {blockaded, industryLost} = applyBlockade(G, turnBefore);
    gw.blockadedLastTurn = [...(gw.blockaded ?? [])];
    gw.blockaded = [...blockaded];
    // 29.1.1: enemy ships in the North Atlantic cost the US 1 stability.
    const usStabilityLoss = usNorthAtlanticCheck(G, ctx);
    // 29.2: the two opposed colonial-war rolls.  The live path defers the
    // territorial rewards to the winning alliances' pending decisions; every
    // other caller applies them deterministically below.
    const africa = resolveColonialWar(G, ctx, "africa", {deferTransfers: interactive});
    const asia = resolveColonialWar(G, ctx, "asia", {deferTransfers: interactive});
    gw.lastColonialWar = {africa: africa.winner ?? undefined, asia: asia.winner ?? undefined};
    const colonialStability = applyColonialStability(G, ctx, africa, asia);
    const winter: GwWinterState = {
      turn: turnBefore,
      blockaded,
      industryLost,
      colonialWar: {africa, asia},
      colonialStability,
      joinedNeutrals: [],
      bonusCp: {},
      usStabilityLoss,
      politicalPressureLosses: pressureLosses,
    };
    if (interactive) {
      // 29.2: one choice per winning roll, answered by the deterministic
      // controller of that alliance.  The bonus-CP choices are planned after
      // every transfer has been applied (control can change with them).
      const choices: GwColonialTransferChoice[] = [];
      for (const region of ["africa", "asia"] as const) {
        const roll = winter.colonialWar[region];
        if (roll.winner === null) continue;
        const count = Math.abs(roll.te - roll.ta) >= 4 ? 2 : 1;
        const by = colonialController(G, roll.winner, winter.blockaded);
        if (by === null) {
          log(G, undefined, "gwColonialTransfer", {region, space: "", skip: true, remaining: count});
          continue;
        }
        choices.push({region, side: roll.winner, by, remaining: count, taken: [], done: false});
      }
      winter.colonialTransfers = choices;
      winter.colonialBonus = [];
      winter.colonialBonusPlanned = false;
    } else {
      awardColonialBonusCp(G, winter);
    }
    gw.winter = winter;
  }
  const winter = gw.winter;

  if (interactive && advanceWinterColonialChoices(G, ctx, winter)) {
    return winterAwaitingResult(G, winter, "colonial");
  }
  return runNeutralEntry(G, ctx, winter);
};

// ------------------------------------------------------------------ US / Italy

/**
 * 25.3/26.3: an Italy that joined the war still on its own side — it entered
 * through the Outbreak Step (or the inciting incident) rather than through GW #2
 * "Major Power Entry", which puts it under a player's control.  Its units are
 * then the Kingdom of Italy's own.
 */
export const isIndependentItaly = (G: ImperialElegyState): boolean =>
  G.gw?.italyIn === true && G.persistent.italyIndependent === true && gwMajorSide(G, "IT") !== null;

/** Who commands Italy's units: its own sovereign name, or the led side's player. */
export const italyCommander = (G: ImperialElegyState): "IT" | Power | null => {
  if (G.gw?.italyIn !== true) return null;
  if (isIndependentItaly(G)) return "IT";
  const side = gwMajorSide(G, "IT");
  return side === null ? null : pickSidePower(G, side);
};

const ITALY_ARMY_KIND: Unit["kind"] = "italianArmy";

// The printed Italian totals and the 22.4 placement order live in rules.ts so
// the end-phase 20.3 rebuild can read them without an import cycle.  Re-export
// them here for the existing callers/tests.
export {ITALIAN_ARMY_COUNTER_MAX, ITALIAN_STANDING_ARMIES};

export interface ItalianRedeployResult {
  /** Units this call placed; `space: null` is the Minor Power Build Box. */
  placed: {space: SpaceId | null; unitId: string}[];
  /** Italian army counters in play (map + reserve) after the call. */
  armies: number;
  /** The port that received the naval grant, when this call placed it. */
  navalSpace: SpaceId | null;
}

/**
 * 22.4 Italian Military: the redeployment itself.
 *
 *  - "one Italian standing army is placed in Rome";
 *  - "the other two Italian standing armies are placed in spaces that are
 *    adjacent to player controlled spaces (usually Piedmont and Lombardy)";
 *  - "Italian naval units are always placed in Naples or Piedmont if Naples is
 *    not Italian controlled."
 *
 * The spaces come from the shared 22.4 plan in rules.ts.  The helper is
 * idempotent: it only
 * tops the standing armies back up to the 22.2 total, never double-places in a
 * space that already holds an Italian army, and never exceeds the five printed
 * Italian army counters (three standing plus the reserve armies 22.3.1 can
 * grant).  A granted reserve army stays in the Italian reserve holding box (a
 * unit with `space: null`); anything that cannot be placed goes to the Minor
 * Power Build Box, which 20.3 rebuilds.
 */
export const redeployItaly = (G: ImperialElegyState, ctx?: Ctx): ItalianRedeployResult => {
  const result: ItalianRedeployResult = {placed: [], armies: 0, navalSpace: null};
  if (G.persistent.italyUnified !== true) return result;
  const italianArmies = (): Unit[] =>
    Object.values(G.units).filter((unit) => unit.owner === "IT" && unit.kind === ITALY_ARMY_KIND);
  const hasArmy = (space: SpaceId): boolean => italianArmies().some((unit) => unit.space === space);
  const armiesBefore = italianArmies();
  const standing = armiesBefore.filter((unit) => unit.space !== null && unit.space !== undefined).length;
  // 22.2/22.3.1/4.2: three standing armies plus any reserve armies the Kingdom
  // of Italy table has permanently granted, never above the printed row of 5.
  const target = italianArmyTarget(G);
  let remaining = Math.max(
    0,
    Math.min(
      target - armiesBefore.length,
      // 4.2: the printed Italian army row is the hard ceiling; the 22.4
      // redeployment may never place a counter the chart does not have.
      nonPlayerCounterRemaining(G, "IT", "army") ?? 0,
    ),
  );
  // 22.4 only places standing armies on the map; a reserve army in the box
  // stays a reserve counter.
  const mapSlots = Math.max(0, Math.min(ITALIAN_STANDING_ARMIES - standing, remaining));
  const used: SpaceId[] = [];
  const placeArmy = (space: SpaceId): boolean => {
    const unit = placeNonPlayerCounter(G, "IT", ITALY_ARMY_KIND, space, 2);
    if (unit === null) return false;
    result.placed.push({space, unitId: unit.id});
    used.push(space);
    remaining -= 1;
    return true;
  };
  // 22.4: Rome first, then the frontier spaces, then any other Italian space
  // (shared with the 20.3 rebuild through `italianArmyDeploySpaces`).
  let placedOnMap = 0;
  for (const space of italianArmyDeploySpaces(G)) {
    if (placedOnMap >= mapSlots) break;
    if (used.includes(space) || hasArmy(space)) continue;
    if (placeArmy(space)) placedOnMap += 1;
  }
  // Last resort: the Minor Power Build Box ("Place destroyed Italian units in
  // the Minor Power Build Box space marked Italy", 22.4).  `placeUnit` with a
  // null space is the engine's off-map reserve counter.
  while (remaining > 0) {
    const unit = placeNonPlayerCounter(G, "IT", ITALY_ARMY_KIND, null, 2);
    if (unit === null) break;
    result.placed.push({space: null, unitId: unit.id});
    remaining -= 1;
  }
  // 22.2's single naval squadron.  Only the first redeployment creates it; the
  // end phase rebuilds destroyed naval units (20.3), not this helper.  Naples
  // and Piedmont are the only printed ports, so an occupied Naples falls back
  // to Piedmont.
  const hasNavy = Object.values(G.units).some((unit) => unit.owner === "IT" && unit.naval === true);
  if (!hasNavy && armiesBefore.length === 0 && nonPlayerHasCounterFor(G, "IT", "squadron")) {
    const navalSpace = italianNavalDeploySpace(G);
    if (navalSpace !== null) {
      const unit = placeNonPlayerCounter(G, "IT", "squadron", navalSpace, 2);
      if (unit !== null) {
        result.placed.push({space: navalSpace, unitId: unit.id});
        result.navalSpace = navalSpace;
      }
    }
  }
  result.armies = italianArmies().length;
  return result;
};

/**
 * Give a unified Italy its forces on the map when it takes the field, through
 * the printed 22.4 redeployment: one standing army in Rome, the other two next
 * to player-controlled spaces, and the naval grant in Naples (else Piedmont).
 * Italy's own control and ally markers clear out of its home keys, which is how
 * `checkGermanUnification` marks a unified nation's territory, and Italian
 * minor-power units give way to Italy's own armies.
 * Idempotent: a second call finds the redeployment already done and adds
 * nothing (and `redeployItaly` never exceeds the printed five army counters).
 */
export const establishItalianPresence = (G: ImperialElegyState, ctx?: Ctx): number => {
  if (G.persistent.italyUnified !== true) return 0;
  const homes = italianHomeKeys().filter((id) => {
    const state = G.spaces[id];
    if (!state) return false;
    if (state.occupiedBy !== null && state.occupiedBy !== undefined) return false;
    if (!isPower(state.control)) return state.control !== null && String(state.control) !== "IT";
    return String(state.control) === "IT";
  });
  for (const id of homes) {
    // A unified nation's minor states are its own territory, not dependencies.
    setSpaceControl(G, id, "IT", {clearInfluence: true, clearDiplomacy: true});
    G.spaces[id].ally = null;
  }
  for (const unitId of Object.keys(G.units)) {
    const unit = G.units[unitId];
    if (!unit.space || !homes.includes(unit.space)) continue;
    if (unit.owner === "Sardinia-Piedmont" || unit.owner === "Tuscany" || unit.owner === "Two Sicilies") removeUnit(G, unitId);
  }
  const redeploy = redeployItaly(G, ctx);
  if (G.persistent.italyUnifiedAt === undefined) G.persistent.italyUnifiedAt = G.turn;
  if (redeploy.placed.length > 0) {
    // The old log named the army spaces and the reserve remainder; keep that
    // shape (the naval grant is part of the redeployment, not an "army" space).
    const spaces = [
      ...new Set(
        redeploy.placed
          .filter((entry) => entry.space !== null && G.units[entry.unitId]?.kind === ITALY_ARMY_KIND)
          .map((entry) => entry.space as SpaceId),
      ),
    ];
    const reserve = redeploy.placed.filter((entry) => entry.space === null).length;
    log(G, undefined, "gwItalyPresence", {spaces: spaces.join(","), reserve});
    ctx?.events?.setActivePlayers?.({all: "play"});
  }
  return redeploy.placed.length;
};

/**
 * Put the US or Italy into the Great War on one side.
 *
 * Their order slots are `"US"`/`"IT"` (not `Power` values) and resolve as a
 * bonus impulse for the first living power on that side.  The side is kept in
 * `G.flags.usSide` / `G.flags.italySide`, which are existing serializable flag
 * slots; no new state shape is introduced.
 *
 * Italy reaches this function from three places: GW #2 (under the playing
 * power), 25.3 at the Outbreak Step, and the blamed-incident exception.  Pass
 * `independent: true` for the last two, so the Kingdom of Italy fights on its
 * own account instead of under a player's control.
 */
export const enterGwAlly = (
  G: ImperialElegyState,
  ctx: Ctx,
  ally: "IT" | "US",
  side: GwSide,
  options: {independent?: boolean} = {},
): GwAllyEntryResult => {
  if (!G.gw?.active) return fail("noGreatWar", "The Great War is not active");
  if (side !== "te" && side !== "ta") return fail("invalidEntry", "A side must be te or ta");
  if (ally === "US" && G.gw.usIn) return fail("alreadyEntered", "The US has already entered");
  if (ally === "IT" && G.gw.italyIn) return fail("alreadyEntered", "Italy has already entered");
  if (hasSurrendered(G, ally)) return fail("invalidEntry", `${ally === "US" ? "The US" : "Italy"} has surrendered`);
  if (ally === "US" && G.gw.usStability <= 0) return fail("invalidEntry", "US stability is exhausted");
  if (ally === "IT" && G.gw.italyStability <= 0) return fail("invalidEntry", "Italian stability is exhausted");
  if (ally === "US") {
    G.gw.usIn = true;
    G.flags.usSide = side;
  } else {
    G.gw.italyIn = true;
    G.flags.italySide = side;
    G.persistent.italyIndependent = options.independent === true;
  }
  if (ally === "US") {
    G.gw.order.push("US");
    // 26.3: the US always acts before Italy.
    reorderMajorSlots(G);
  } else {
    G.gw.order.push("IT");
    reorderMajorSlots(G);
    // 25.3 + 26.3: Italy joins with a fresh war budget and, while it is
    // fighting on its own account, the Kingdom of Italy holds the ground.
    G.gw.italyBudget = 2;
    if (G.persistent.italyIndependent === true) establishItalianPresence(G, ctx);
  }
  if (ally === "US") {
    // 32.1: three US armies and all four US naval units (two if Dreadnoughts
    // has not been played) enter in the South; only 1 CP on the entry turn.
    // 4.2: the printed US row is 3 armies / 2 squadrons / 2 dreadnoughts, so a
    // counter already in play (or a row that is already full) is logged and
    // skipped instead of over-placing the entry force.
    for (let i = 0; i < 3; i += 1) placeNonPlayerCounter(G, "US", "usArmy", US_ENTRY_SPACE, 2);
    placeNonPlayerCounter(G, "US", "squadron", US_ENTRY_SPACE, 2);
    placeNonPlayerCounter(G, "US", "squadron", US_ENTRY_SPACE, 2);
    if (G.persistent.dreadnoughts === true) {
      placeNonPlayerCounter(G, "US", "dreadnought", US_ENTRY_SPACE, 2);
      placeNonPlayerCounter(G, "US", "dreadnought", US_ENTRY_SPACE, 2);
    }
    G.gw.usBudget = 1;
  }
  // 32.2: home keys already in enemy hands at entry are the baseline; only
  // later losses cost Italy stability.  30.2: Rome is different — if it is
  // already taken when Italy enters, Italy surrenders immediately.
  if (ally === "IT") G.gw.italyLostKeys = enemyOccupiedItalianKeys(G);
  const orderIndex = G.gw.order.indexOf(ally);
  let budget = ally === "US" ? G.gw.usBudget : G.gw.italyBudget;
  log(G, undefined, "gwAllyEntry", {ally, side});
  if (ally === "IT") {
    // A pre-entry enemy occupation of Rome surrenders Italy at once (30.2);
    // the baseline above stops the other lost keys from charging stability.
    syncItalianHomeKeys(G, ctx);
    if (hasSurrendered(G, "IT")) budget = 0;
  }
  return {ok: true, ally, side, orderIndex, budget, bonusImpulse: true};
};

const US_ENTRY_SPACE: SpaceId = "the-south";

/** 26.3: the US always acts before Italy, whichever entered first. */
const reorderMajorSlots = (G: ImperialElegyState): void => {
  if (!G.gw) return;
  const usIndex = G.gw.order.indexOf("US");
  const itIndex = G.gw.order.indexOf("IT");
  if (usIndex >= 0 && itIndex >= 0 && itIndex < usIndex) {
    G.gw.order[itIndex] = "US";
    G.gw.order[usIndex] = "IT";
  }
};

/** 25.2: the US alliance chit's box (it starts in the neutral box). */
export const usAllianceBox = (G: ImperialElegyState): AllianceBox => {
  const raw = G.persistent.usAlliance;
  return isAllianceBox(raw) ? raw : "neutral";
};

/**
 * 25.3 / 25.7.1: the Outbreak Step leaves Italy where it stands.  It joins now
 * when it is committed to an alliance, joins on a 4+ from an aligned box (and
 * otherwise withdraws to neutral), and stays out from a neutral box — except
 * when the inciting incident is the one it is blamed for, which makes it join
 * at once from any box.  `isBlamedIncident` holds that Crisis Table exception.
 *
 * Must run after `formAlliances` (the player alliances are fixed first) and
 * before the GW turn order is built, so that Italy's slot lands correctly.
 */
export const resolveItalyAtOutbreak = (
  G: ImperialElegyState,
  ctx: Ctx,
  incident: string,
  actor: Power | null = null,
  /** The Crisis Table's real blame when the caller knows it (23.0–23.5). */
  crisis?: {blame?: Power | "IT" | null; label?: string},
): ItalyOutbreakPlan => {
  // 25.3: "if Italy is blamed for the inciting incident based on the Crisis
  // Table Result".  A crisis roll reports the actual blamed power (bordering
  // nation, target, losing power); only a caller that has no table context
  // falls back to the printed-card approximation below.
  const blamed = crisis !== undefined ? crisis.blame === "IT" : isBlamedIncident(incident);
  const plan = planItalyOutbreak(G, blamed, blamed ? 0 : die(ctx, 6));
  // A blamed Italy standing in the neutral box joins the alliance of the power
  // that played the incident (GE's side when the Crisis Table has no name on it).
  let side = plan.side;
  if (plan.outcome === "blamed" && side === null) {
    side = (actor !== null ? sideOf(G, actor) : null) ?? sideOf(G, "GE") ?? "ta";
    if (G.gw) G.gw.italyAlliance = side === "te" ? "teCommitted" : "taCommitted";
  }
  log(G, undefined, "gwItalyOutbreak", {
    outcome: plan.outcome,
    box: plan.box,
    side,
    roll: plan.roll,
    incident,
    by: plan.outcome === "blamed" ? actor : null,
    crisis: crisis?.label ?? "",
    blamed: crisis?.blame ?? "",
  });
  if (plan.outcome === "alignedWithdrew" && G.gw) G.gw.italyAlliance = "neutral";
  if ((plan.outcome === "alignedJoined" || plan.outcome === "committed" || plan.outcome === "blamed") && side) {
    enterGwAlly(G, ctx, "IT", side, {independent: true});
  }
  return {...plan, side};
};

/**
 * Fallback for callers that have no Crisis Table context (the 25.3 tests call
 * `outbreakGreatWar` with a card id, and an older save may not carry a blame).
 * The live crisis path passes the table's real blamed power instead, so this
 * approximation no longer decides an ordinary crisis.
 *
 * Printed "Blame" rows: Assassination! (A017), Powder Keg (A053) and The Black
 * Hand (A101); Moroccan Crisis (A102) sat in the old approximation because its
 * table cell names a "Losing Power".
 */
export const BLAMED_INCIDENT_CARDS: readonly CardId[] = ["IE-A017", "IE-A053", "IE-A101", "IE-A102"];

export const isBlamedIncident = (incident: string | null | undefined): boolean =>
  typeof incident === "string" && BLAMED_INCIDENT_CARDS.includes(incident as CardId);

/** Why GW #2 is being evaluated. */
export type MajorEntryMode =
  /** Is the card legal to play right now?  Italy needs the outbreak offer or GW turn 1+. */
  | "play"
  /** Which choices does an already-legal play offer?  The play has spent its flag. */
  | "resolve";

/**
 * GW #2 Major Power Entry: who can still join.
 *
 * A unified Italy that stood out of the war is the card's historical case.  The
 * card is printed "cannot be played on GW turn 0"; 25.3 decides the Outbreak
 * Step itself, and GW #2 is the one way to move an Italy that stayed neutral
 * when the war broke out.  That opening offer is therefore available once: the
 * card exists once in the deck and the outbreak flag is set by its play.
 */
export function majorEntryCandidates(G: ImperialElegyState, power: Power, mode: MajorEntryMode = "play"): ("IT" | "US")[] {
  if (!G.gw?.active) return [];
  if (sideOf(G, power) === null) return [];
  const turn = G.gw.turn ?? 0;
  const out: ("IT" | "US")[] = [];
  const italyAvailable =
    G.persistent.italyUnified === true &&
    !G.gw.italyIn &&
    G.persistent.italyIndependent !== true &&
    !hasSurrendered(G, "IT") &&
    G.gw.italyStability > 0;
  const italyOfferOpen = mode === "resolve" || turn > 0 || !gwCardPlayedThisOutbreak(G);
  if (italyAvailable && italyOfferOpen) out.push("IT");
  // "Cannot be played on GW turn 0": the US offer starts on GW turn 1.
  if (turn > 0 && !G.gw.usIn && !hasSurrendered(G, "US") && G.gw.usStability > 0) out.push("US");
  return out;
}

/**
 * GW #2's choices for the playing power.  Kept as the public name the card's
 * effect and the moves use; `mode` separates "may I play this" from "what may
 * I choose now that I have played it".
 */
export function majorEntryOptions(G: ImperialElegyState, power: Power): ("IT" | "US")[] {
  return majorEntryCandidates(G, power, "play");
}

/**
 * GW #2 exists once in a GW deck, so its turn-0 Italy offer belongs to the
 * opening only; a second copy (an older save, a test) cannot reopen it.
 */
function gwCardPlayedThisOutbreak(G: ImperialElegyState): boolean {
  return G.flags.gwMajorEntryOutbreak === true;
}

export interface MajorEntryOutcome {
  major: "IT" | "US";
  side: GwSide;
  roll: number | null;
  /** The US box after the shift; null for Italy (see `italyBox`). */
  usBox: AllianceBox | null;
  /** Italy's Alliance Track box after the shift. */
  italyBox: AllianceBox | null;
  entered: boolean;
}

/**
 * Resolve GW #2 for the chosen major, toward the playing power's alliance.
 *  - Italy: roll a die; on 4–6 Italy shifts into the chosen alliance (neutral ->
 *    aligned, aligned -> committed) and joins the GW.  A committed Italy joins
 *    automatically (25.3).
 *  - US: shift the US chit one box toward that alliance; it joins once it
 *    reaches the committed box.
 */
export const resolveMajorPowerEntry = (
  G: ImperialElegyState,
  ctx: Ctx,
  power: Power,
  major: "IT" | "US",
): MajorEntryOutcome | null => {
  // The play has already spent the outbreak allowance; resolve the choice it
  // opened against who can still join, without re-gating the card's timing.
  if (!majorEntryCandidates(G, power, "resolve").includes(major)) return null;
  const side = sideOf(G, power)!;
  if (major === "IT") {
    const roll = die(ctx, 6);
    const plan = italyGwCardEntryPlan(G, side as ItalySide, roll);
    const entered =
      (plan.outcome === "alignedJoined" || plan.outcome === "committed") &&
      enterGwAlly(G, ctx, "IT", side).ok;
    log(G, power, "gwMajorEntry", {major, side, roll, box: plan.box, entered});
    return {major, side, roll, usBox: null, italyBox: plan.box, entered};
  }
  const index = ALLIANCE_TRACK.indexOf(usAllianceBox(G));
  const next = ALLIANCE_TRACK[Math.max(0, Math.min(ALLIANCE_TRACK.length - 1, index + (side === "te" ? 1 : -1)))];
  G.persistent.usAlliance = next;
  const entered = isCommittedBox(next) && enterGwAlly(G, ctx, "US", side).ok;
  log(G, power, "gwMajorEntry", {major, side, box: next, entered});
  return {major, side, roll: null, usBox: next, italyBox: null, entered};
};

/**
 * GW #2's fallback: "remove from the game and draw another card if neither
 * Italy nor the US can join".  Deals the power a random GW card that is not
 * removed, discarded, held, in front of a player or currently resolving.
 */
export const drawReplacementGwCard = (G: ImperialElegyState, ctx: Ctx, power: Power): CardId | null => {
  if (!G.gw) return null;
  const unavailable = new Set<CardId>([...G.removed, ...(G.gw.discard ?? [])]);
  for (const entry of gwCombatCardsInFront(G)) unavailable.add(entry.cardId);
  for (const p of POWERS) {
    const card = G.powers[p].gwCard;
    if (card) unavailable.add(card);
  }
  if (G.resolvingCard) unavailable.add(G.resolvingCard);
  const pool = CARDS.greatWar.map((card) => card.id).filter((id) => !unavailable.has(id));
  if (pool.length === 0) return null;
  const card = pool[Math.max(0, Math.min(pool.length - 1, die(ctx, pool.length) - 1))];
  G.powers[power].gwCard = card;
  return card;
};

/**
 * Map a US/Italy entry slot back to the controlling major power.  Exposed for
 * the UI so it can label whose impulse an `"IT"`/`"US"` slot really is.
 */
export const allyImpulseController = (G: ImperialElegyState, ally: "IT" | "US"): Power | null => {
  if (!G.gw) return null;
  const side = allySide(G, ally);
  if (!side) return null;
  return pickSidePower(G, side);
};
