/**
 * Rule 30.2 / 32.1 / 32.2 / 29.1.1: stability and surrender of the two
 * non-player major powers (the US and a unified Italy) during the Great War.
 *
 *  - Both start at 3 stability and surrender when it reaches 0.
 *  - US: −1 whenever a US army is eliminated, a US-led force suffers a
 *    decisive defeat, or enemy naval units are in the North Atlantic box at
 *    the winter step.
 *  - Italy: −1 whenever an enemy power occupies an Italian home key or an
 *    Italian-led force suffers a decisive defeat; +1 when a friendly power
 *    retakes an Italian home key.  Italy also surrenders if Rome is taken.
 *  - Surrender is immediate and removes all of that major's units from play.
 *
 * This module only reads and writes `G`; it deliberately does not import the
 * unit helpers in `effects.ts` (which call back into it from `removeUnit`).
 */
import {Ctx} from "boardgame.io";
import {ImperialElegyState, SpaceId, Unit} from "../types";
import {SPACES} from "../constant/spaces";
import {
  displaceAlliedUnitsInTerritory,
  gwMajorSide,
  isArmyKind,
  isPower,
  log,
  occupyingOwners,
  removeAllUnitsOf,
  removeGwSurrenderMarkers,
  sweepOrphanedMinorUnits,
} from "./rules";

export type GwMajor = "US" | "IT";

/** Printed maximum (and starting value) of the US/Italian stability tracks. */
export const GW_MAJOR_MAX_STABILITY = 3;

/** 29.1.1 / 32.1: the naval box whose enemy occupation costs the US stability. */
export const US_BLOCKADE_BOX: SpaceId = "north-atlantic";

/**
 * 30.2: "Italy also surrenders if Rome is taken."  Rome is the star-shaped
 * capital of the Papal States (3.2.2); once Italy unifies it is the Kingdom of
 * Italy's capital as well.
 */
export const ITALIAN_CAPITAL: SpaceId = "rome";

const US_ARMY_KINDS: ReadonlySet<Unit["kind"]> = new Set(["usArmy", "army"]);

const isKeyType = (type: string | undefined): boolean =>
  type === "key" || type === "capital" || type === "subcapital";

/**
 * 32.2: Italy's home keys — the Italian-flashpoint keys that are not a player
 * power's home (Lombardy stays an AU home key), plus Rome when it exists.
 */
export const italianHomeKeys = (): SpaceId[] =>
  Object.values(SPACES)
    .filter(
      (def) =>
        (def.flashpoints?.includes("italy") === true && isKeyType(def.type) && !def.home) ||
        def.id === ITALIAN_CAPITAL,
    )
    .map((def) => def.id);

const stabilityOf = (G: ImperialElegyState, major: GwMajor): number =>
  major === "US" ? G.gw?.usStability ?? 0 : G.gw?.italyStability ?? 0;

const setStability = (G: ImperialElegyState, major: GwMajor, value: number): void => {
  if (!G.gw) return;
  if (major === "US") G.gw.usStability = value;
  else G.gw.italyStability = value;
};

export const hasSurrendered = (G: ImperialElegyState, major: GwMajor): boolean =>
  major === "US" ? G.gw?.usSurrendered === true : G.gw?.italySurrendered === true;

/** Whether `major` is currently fighting in the Great War. */
export const gwMajorFighting = (G: ImperialElegyState, major: GwMajor): boolean =>
  G.gw?.active === true && !hasSurrendered(G, major) && gwMajorSide(G, major) !== null;

/** Whether a power/major owner is an enemy of `major`'s GW side. */
const enemyOfMajor = (G: ImperialElegyState, major: GwMajor, owner: unknown): boolean => {
  const side = gwMajorSide(G, major);
  if (!G.gw || side === null) return false;
  if (isPower(owner)) {
    if (G.powers[owner]?.eliminated) return false;
    const other = side === "te" ? G.gw.ta : G.gw.te;
    return other.includes(owner);
  }
  if (owner === "US" || owner === "IT") {
    if (owner === major) return false;
    const otherSide = gwMajorSide(G, owner);
    return otherSide !== null && otherSide !== side;
  }
  return false;
};

const friendOfMajor = (G: ImperialElegyState, major: GwMajor, owner: unknown): boolean => {
  const side = gwMajorSide(G, major);
  if (!G.gw || side === null) return false;
  if (owner === major) return true;
  if (isPower(owner)) return (side === "te" ? G.gw.te : G.gw.ta).includes(owner);
  if (owner === "US" || owner === "IT") return gwMajorSide(G, owner) === side;
  return false;
};

/**
 * Change the US/Italian GW stability by `delta`, clamped to 0..3.  Reaching 0
 * surrenders the major immediately (30.2).  Returns the delta actually applied.
 * Inert when the major is not fighting.
 */
export const changeGwMajorStability = (
  G: ImperialElegyState,
  major: GwMajor,
  delta: number,
  cause: string,
  ctx?: Ctx,
  args: Record<string, unknown> = {},
): number => {
  if (!gwMajorFighting(G, major) || delta === 0) return 0;
  const before = stabilityOf(G, major);
  const after = Math.max(0, Math.min(GW_MAJOR_MAX_STABILITY, before + delta));
  if (after === before) return 0;
  setStability(G, major, after);
  log(G, undefined, "gwMajorStability", {major, delta: after - before, stability: after, cause, ...args});
  if (after <= 0) surrenderGwMajor(G, major, "stability", ctx);
  return after - before;
};

/**
 * 30.2: the major surrenders.  All its units leave play, it stops taking
 * impulses (its CP budget is emptied and it no longer counts as entered), and
 * it can never re-enter.  The side flag is kept for the log/history.
 */
export const surrenderGwMajor = (
  G: ImperialElegyState,
  major: GwMajor,
  reason: "stability" | "capital",
  _ctx?: Ctx,
): void => {
  if (!G.gw || hasSurrendered(G, major)) return;
  // Capture the side before `usIn`/`italyIn` is cleared (gwMajorSide reads it).
  const side = gwMajorSide(G, major);
  if (major === "US") {
    G.gw.usSurrendered = true;
    G.gw.usIn = false;
    G.gw.usBudget = 0;
  } else {
    G.gw.italySurrendered = true;
    G.gw.italyIn = false;
    G.gw.italyBudget = 0;
  }
  // 30.1: the same unit-removal helper `eliminatePower` uses for player powers.
  const removed = removeAllUnitsOf(G, major);
  // 30.1: the same marker bookkeeping too — Italy's Alliance Track chit and the
  // major's initiative slot become the alliance's bonus impulse, and the
  // one-marker/compaction rule applies exactly as for a player elimination.
  removeGwSurrenderMarkers(G, major, side);
  // 15.6: "when a player ally (or Italy) is knocked out, displace any allied
  // units in their territory" — the same 5.7 displacement a player elimination
  // runs, with the side captured before the chit is cleared.
  displaceAlliedUnitsInTerritory(G, major, side);
  // 30.1/15.6: the same permanent-minor / orphan-commander sweep a player
  // elimination runs.  A surrendered US/Italy cannot leave a permanently
  // eliminated minor's counters on the map merely because the elimination did
  // not pass through `eliminatePower`.
  sweepOrphanedMinorUnits(G, {leaving: major});
  log(G, undefined, "gwMajorSurrender", {major, side, reason, removed});
};

/**
 * 32.1: called by `removeUnit` before a unit is deleted.  An eliminated US
 * army costs the US 1 stability.  Surrender clean-up deletes units directly,
 * so it never reaches here.
 */
export const noteGwUnitEliminated = (G: ImperialElegyState, unit: Unit): void => {
  if (unit.owner !== "US" || !US_ARMY_KINDS.has(unit.kind)) return;
  changeGwMajorStability(G, "US", -1, "usArmyEliminated", undefined, {space: unit.space ?? null});
};

/**
 * Who led a battle force, from the owners of its main units: a major leads
 * when its units are the majority of the main force; otherwise the player
 * power leads.
 */
export const forceLeaderFromOwners = (owners: readonly string[]): GwMajor | null => {
  const counts = {US: 0, IT: 0, other: 0};
  for (const owner of owners) {
    if (owner === "US" || owner === "IT") counts[owner] += 1;
    else counts.other += 1;
  }
  if (counts.US > counts.other + counts.IT) return "US";
  if (counts.IT > counts.other + counts.US) return "IT";
  return null;
};

/** `forceLeaderFromOwners` for units that are still on the board. */
export const forceLeader = (G: ImperialElegyState, unitIds: readonly string[]): GwMajor | null =>
  forceLeaderFromOwners(
    unitIds.map((id) => G.units[id]?.owner).filter((owner): owner is string => typeof owner === "string"),
  );

/**
 * 32.1 / 32.2: a decisive defeat of a US- or Italian-led force.  The 30.0
 * footnote's size threshold (at least two units) is checked by the caller.
 */
export const applyGwMajorDecisiveDefeat = (
  G: ImperialElegyState,
  major: GwMajor,
  space: SpaceId,
  ctx?: Ctx,
): number => changeGwMajorStability(G, major, -1, "decisiveDefeat", ctx, {space});

const enemyOccupies = (G: ImperialElegyState, major: GwMajor, spaceId: SpaceId): boolean =>
  // 15.3 occupation (marker or land unit) through the shared helper so the
  // major's Rome path and the 30.1 player path agree on what "occupied" means.
  occupyingOwners(G, spaceId).some((owner) => enemyOfMajor(G, major, owner));

const friendRetook = (G: ImperialElegyState, spaceId: SpaceId): boolean => {
  const state = G.spaces[spaceId];
  if (!state) return false;
  if (friendOfMajor(G, "IT", state.occupiedBy)) return true;
  return state.units.some((id) => {
    const unit = G.units[id];
    return Boolean(unit) && unit!.naval !== true && friendOfMajor(G, "IT", unit!.owner);
  });
};

/** Italian home keys an enemy currently occupies (for the entry baseline). */
export const enemyOccupiedItalianKeys = (G: ImperialElegyState): SpaceId[] =>
  italianHomeKeys().filter((id) => enemyOccupies(G, "IT", id));

/**
 * Reconcile Italy's home keys after a capture (32.2 / 30.2):
 *  - each newly enemy-occupied home key costs 1 stability;
 *  - each previously lost key now held by a friendly power gives +1;
 *  - an enemy in Rome makes Italy surrender at once.
 * Lost keys are tracked in `G.gw.italyLostKeys` so a key costs stability once
 * per loss.  Safe to call after any GW move; inert while Italy is not fighting.
 */
export const syncItalianHomeKeys = (G: ImperialElegyState, ctx?: Ctx): void => {
  if (!G.gw || !gwMajorFighting(G, "IT")) return;
  const lost = new Set(G.gw.italyLostKeys ?? []);
  for (const spaceId of italianHomeKeys()) {
    if (!gwMajorFighting(G, "IT")) break;
    if (enemyOccupies(G, "IT", spaceId)) {
      if (spaceId === ITALIAN_CAPITAL) {
        lost.add(spaceId);
        G.gw.italyLostKeys = [...lost];
        log(G, undefined, "gwItalyCapitalTaken", {space: spaceId, by: G.spaces[spaceId]?.occupiedBy ?? null});
        surrenderGwMajor(G, "IT", "capital", ctx);
        return;
      }
      if (lost.has(spaceId)) continue;
      lost.add(spaceId);
      G.gw.italyLostKeys = [...lost];
      changeGwMajorStability(G, "IT", -1, "homeKeyLost", ctx, {space: spaceId});
    } else if (lost.has(spaceId) && friendRetook(G, spaceId)) {
      lost.delete(spaceId);
      G.gw.italyLostKeys = [...lost];
      changeGwMajorStability(G, "IT", 1, "homeKeyRetaken", ctx, {space: spaceId});
    }
  }
  if (G.gw) G.gw.italyLostKeys = [...lost];
};

/** 29.1.1 / 32.1: enemy naval units in the North Atlantic at the winter step. */
export const usNorthAtlanticCheck = (G: ImperialElegyState, ctx?: Ctx): number => {
  if (!gwMajorFighting(G, "US")) return 0;
  const state = G.spaces[US_BLOCKADE_BOX];
  if (!state) return 0;
  const enemyNaval = state.units.some((id) => {
    const unit = G.units[id];
    return Boolean(unit) && unit!.naval === true && enemyOfMajor(G, "US", unit!.owner);
  });
  if (!enemyNaval) return 0;
  return changeGwMajorStability(G, "US", -1, "northAtlantic", ctx, {space: US_BLOCKADE_BOX});
};

/** Player powers are never majors; exported for callers that branch on it. */
export const isGwMajor = (owner: unknown): owner is GwMajor => owner === "US" || owner === "IT";

// ---------------------------------------------------------------------------
// 32.1 US armies in North America
// ---------------------------------------------------------------------------

/**
 * 32.1: "If Mexico and/or Canada are now enemies of the US, the US (or US
 * allies) must first occupy both Mexico and Canada (or one of them if only one
 * is enemy controlled) before US armies can leave the North America submap."
 */
export interface NorthAmericaExitCheck {
  /** True when no enemy-held space still has to be occupied. */
  allowed: boolean;
  /** Enemy-controlled spaces that must be occupied first (Mexico and/or Canada). */
  required: SpaceId[];
  /** The subset of `required` without a US or US-allied land unit in it. */
  unoccupied: SpaceId[];
}

/** The two North America submap spaces the printed rule names. */
export const NORTH_AMERICA_GATE_SPACES: readonly SpaceId[] = ["mexico", "canada"];

/** Whether an owner belongs to the US's Great War side (US or an ally). */
const usSideOwner = (G: ImperialElegyState, owner: unknown): boolean => {
  if (owner === "US" || owner === "United States") return true;
  if (owner === "IT") {
    const usSide = gwMajorSide(G, "US");
    return usSide !== null && gwMajorSide(G, "IT") === usSide;
  }
  if (!isPower(owner)) return false;
  const side = gwMajorSide(G, "US");
  if (side === null || !G.gw) return false;
  return (side === "te" ? G.gw.te : G.gw.ta).includes(owner);
};

/** Enemy (or hostile minor) control, occupation or land unit in a gate space. */
const usEnemyHolds = (G: ImperialElegyState, space: SpaceId): boolean => {
  const state = G.spaces[space];
  if (!state) return false;
  const hostileOwner = (owner: unknown): boolean => {
    if (owner === null || owner === undefined) return false;
    if (usSideOwner(G, owner)) return false;
    if (isPower(owner)) {
      // A player power is an enemy only when it is a belligerent on the other
      // side; a neutral power is not at war with the US (32.3).
      return G.gw?.te.includes(owner) === true || G.gw?.ta.includes(owner) === true;
    }
    if (owner === "IT") {
      const side = gwMajorSide(G, "IT");
      return side !== null && side !== gwMajorSide(G, "US");
    }
    // An independent minor power is hostile unless it is allied to the US side.
    return !(state.ally !== null && state.ally !== undefined && usSideOwner(G, state.ally));
  };
  if (hostileOwner(state.control)) return true;
  if (hostileOwner(state.occupiedBy)) return true;
  return state.units.some((id) => {
    const unit = G.units[id];
    return Boolean(unit) && unit!.naval !== true && hostileOwner(unit!.owner);
  });
};

/** Whether the US or one of its allies occupies `space` with a land unit. */
const usSideOccupies = (G: ImperialElegyState, space: SpaceId): boolean => {
  const state = G.spaces[space];
  if (!state) return false;
  if (state.occupiedBy !== null && state.occupiedBy !== undefined && usSideOwner(G, state.occupiedBy)) {
    return true;
  }
  return state.units.some((id) => {
    const unit = G.units[id];
    return Boolean(unit) && unit!.naval !== true && usSideOwner(G, unit!.owner);
  });
};

/**
 * 32.1 gate for the US's GW maneuver: the enemy-held gate spaces (Mexico
 * and/or Canada) the US or its allies still have to occupy.  Evaluated live so
 * a gate space that changes hands stops blocking immediately.
 */
export const usCanLeaveNorthAmerica = (G: ImperialElegyState): NorthAmericaExitCheck => {
  if (!G.gw?.active || G.gw.usIn !== true || gwMajorSide(G, "US") === null) {
    return {allowed: true, required: [], unoccupied: []};
  }
  const required = NORTH_AMERICA_GATE_SPACES.filter((space) => usEnemyHolds(G, space));
  const unoccupied = required.filter((space) => !usSideOccupies(G, space));
  return {allowed: unoccupied.length === 0, required: [...required], unoccupied};
};

/**
 * 32.1 for a single unit: only a US army that starts inside the North America
 * submap and would end outside it is restricted.  Fleets, US units already on
 * the main map, and movements inside North America (including into Canada and
 * Mexico) are never blocked.
 */
export const usArmyMayLeaveNorthAmerica = (G: ImperialElegyState, unit: Unit, to: SpaceId): boolean => {
  if (unit.owner !== "US" || !isArmyKind(unit.kind)) return true;
  if (!unit.space) return true;
  if (SPACES[unit.space]?.submap !== "northAmerica") return true;
  if (SPACES[to]?.submap === "northAmerica") return true;
  return usCanLeaveNorthAmerica(G).allowed;
};
