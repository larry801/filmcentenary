/**
 * 12.11 Pacification — the printed legality and marker lifecycle.
 *
 * The move and the Orders panel used to disagree with the rulebook in four
 * ways, and every one of them was reachable from the hotseat board:
 *
 *  - **the retry was forbidden forever.**  The once-per-attempt guard was a
 *    `pacified_<space>` flag on the power that nothing ever cleared, so one
 *    failed roll locked that space for the rest of the game.  12.11 prints
 *    "Pacification actions can only be taken once per space, per impulse;
 *    meaning if the attempt fails you must wait until a future impulse to roll
 *    again in that space."  The limit is now an impulse-scoped flag, cleared by
 *    `clearPacificationImpulse` when the impulse passes.
 *  - **no land unit was required.**  12.11 prints "Players must have a land
 *    unit in a space to pacify it"; the move only checked the influence marker,
 *    so a seat could pacify a space its armies had never reached.
 *  - **a rebel army did not block the roll.**  12.12.1 prints "If a rebel army
 *    occupies a space with a pacification marker, it must first be eliminated
 *    in a land battle before a pacification roll can be attempted."
 *  - **the marker outlived the last unit.**  12.11 prints "If all a player's
 *    units leave an uncontrolled space with a pacification marker, remove the
 *    pacification marker."  `removeOrphanedPacificationMarkers` runs at the
 *    start of each impulse, so the map never keeps a marker with no force on it.
 *
 * The same helper is read by `moves.ts#pacify` and
 * `components/actionAvailability.ts`, so a disabled row and a refused move can
 * never disagree again.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power, SpaceId} from "../types";
import {SPACES, isNavalBox} from "../constant/spaces";
import {isIndependentIndia, pacificationModifier} from "./characteristics";
import {die, isArmyKind, isPower, landUnitsIn, log, navalUnitsIn, setSpaceControl} from "./rules";

/** Why 12.11's pacification action cannot be taken here, or null when it can. */
export type PacificationProblem =
  | "unknown-space"
  /** 33.2.2: independent India takes no influence, marker or pacification. */
  | "independent-india"
  | "naval-box"
  /** Influence is what 12.11 replaces with a control marker. */
  | "no-influence"
  /** 12.11: "Players must have a land unit in a space to pacify it." */
  | "no-land-unit"
  /** 12.12.1: the rebel army has to be beaten first. */
  | "rebel-present"
  /** 12.11: once per space, per impulse. */
  | "already-this-impulse";

/** The impulse-scoped "already attempted here" flag (12.11). */
const attemptFlag = (space: SpaceId): string => `pacifiedThisImpulse:${space}`;

/** True when this power already rolled for `space` during the current impulse. */
export const pacifiedThisImpulse = (G: ImperialElegyState, power: Power, space: SpaceId): boolean =>
  G.powers[power]?.flags[attemptFlag(space)] === true;

/** Record this impulse's attempt (12.11's once-per-space limit). */
export const notePacificationAttempt = (G: ImperialElegyState, power: Power, space: SpaceId): void => {
  G.powers[power].flags[attemptFlag(space)] = true;
};

/**
 * Drop every impulse-scoped attempt flag when the impulse passes.  12.11's
 * limit is per impulse, so a failure in one impulse must be retryable in the
 * next; the old permanent flag is what made a bad roll final.
 */
export const clearPacificationImpulse = (G: ImperialElegyState): void => {
  for (const power of Object.keys(G.powers) as Power[]) {
    const flags = G.powers[power]?.flags;
    if (!flags) continue;
    for (const key of Object.keys(flags)) {
      if (key.startsWith("pacifiedThisImpulse:")) delete flags[key];
      // Legacy saves carry the pre-fix permanent flag; drop it so an existing
      // match is unlocked too.
      if (key.startsWith("pacified_")) delete flags[key];
    }
  }
};

/** True when a rebel army still holds the space (12.12.1). */
const rebelPresent = (G: ImperialElegyState, space: SpaceId): boolean =>
  landUnitsIn(G, space).some((unit) => unit.kind === "rebelArmy" && unit.steps > 0);

/**
 * 12.11 legality for `power`'s pacification action in `space`.
 *
 * The printed order is: the space must be pacifiable at all (land, not
 * independent India), the acting power's influence marker is what the
 * successful roll replaces, a land unit must stand there, a rebel army blocks
 * the roll until it is beaten, and the action runs once per space per impulse.
 */
export const pacificationProblem = (
  G: ImperialElegyState,
  power: Power,
  space: SpaceId,
): PacificationProblem | null => {
  if (SPACES[space] === undefined || G.spaces[space] === undefined) return "unknown-space";
  if (isIndependentIndia(G, space)) return "independent-india";
  if (isNavalBox(space)) return "naval-box";
  const state = G.spaces[space];
  if (state.influence !== power) return "no-influence";
  // 12.11: a land unit must be in the space.  Any of the actor's own land
  // units counts; an allied minor's army does not pacify on its own.
  if (!landUnitsIn(G, space).some((unit) => unit.owner === power && isArmyKind(unit.kind))) {
    return "no-land-unit";
  }
  if (rebelPresent(G, space)) return "rebel-present";
  if (pacifiedThisImpulse(G, power, space)) return "already-this-impulse";
  return null;
};

/**
 * 12.11's marker lifecycle, reconciled once per impulse.
 *
 * Printed:
 *  - "When a land unit is placed in (or moved to) an uncontrolled space, a 0
 *    pacification marker is also placed in that space if it did not already
 *    contain one. Exception: if the space is a naval base, place a 2
 *    pacification marker instead."
 *  - "If all a player's units leave an uncontrolled space with a pacification
 *    marker, remove the pacification marker."
 *
 * Both halves are stated as consequences of movement, and movement reaches the
 * map through many different moves (redeploy, march, rail, naval transport,
 * event placement, combat advance).  Reconciling at the impulse boundary
 * covers every one of them with a single rule instead of a hook on each move:
 * an uncontrolled space holding land units keeps (or gains) its printed entry
 * marker, and one with no land units loses it.
 *
 * Controlled spaces are left alone: 12.11's "certain events will cause
 * pacification markers to be placed in player controlled spaces" is a
 * different marker with a different lifecycle (it reduces the owner's keys).
 */
export const reconcilePacificationMarkers = (G: ImperialElegyState): void => {
  for (const [space, state] of Object.entries(G.spaces)) {
    if (!state) continue;
    if (isNavalBox(space)) continue;
    // A controlled space's marker comes from an event, not from a force.
    if (state.control !== null) continue;
    const occupied = landUnitsIn(G, space as SpaceId).length > 0;
    if (occupied) {
      if ((state.pacification ?? 0) <= 0) state.pacification = pacificationEntryValue(space as SpaceId);
      continue;
    }
    if ((state.pacification ?? 0) > 0) state.pacification = 0;
  }
};

/** Kept for callers that only need the "last unit left" half of 12.11. */
export const removeOrphanedPacificationMarkers = (G: ImperialElegyState): number => {
  let removed = 0;
  for (const [space, state] of Object.entries(G.spaces)) {
    if (!state) continue;
    if (state.control !== null) continue;
    if ((state.pacification ?? 0) <= 0) continue;
    if (isNavalBox(space)) continue;
    if (landUnitsIn(G, space as SpaceId).length > 0) continue;
    state.pacification = 0;
    removed += 1;
  }
  return removed;
};

/**
 * 12.11's marker value when a land unit first enters an uncontrolled space:
 * "place a 0 pacification marker … Exception: if the space is a naval base,
 * place a 2 pacification marker instead."
 *
 * The marker lifecycle itself (`reconcilePacificationMarkers`) lives in
 * `rules.ts`, because it has to run from the impulse-upkeep pass that both the
 * move layer and the Great War flow call, and `rules.ts` cannot import this
 * module without an import cycle.
 */
export const pacificationEntryValue = (space: SpaceId): number =>
  SPACES[space]?.type === "navalBase" ? 2 : 0;

/** True when `power` has a naval unit in a box adjacent to `space` (12.11's +1). */
const hasAdjacentNaval = (G: ImperialElegyState, power: Power, space: SpaceId): boolean =>
  (SPACES[space]?.ports ?? []).some((box) => navalUnitsIn(G, box).some((unit) => unit.owner === power));

/**
 * 12.11's printed two-dice pacification roll, shared by the normal action
 * (`moves.ts#pacify`) and card effects such as A25 Divide and Conquer.
 *
 * The caller is responsible for the printed modifiers that happen before the
 * roll (A25 adds 2 to the marker value first); this helper only adds the
 * marker's value, the adjacent-naval +1 and the national-characteristic DRMs,
 * then applies the success (control) or failure (marker +1) result.
 */
export const attemptPacification = (
  G: ImperialElegyState,
  ctx: Ctx,
  power: Power,
  space: SpaceId,
  cost = 0,
): void => {
  const state = G.spaces[space];
  if (!state) return;
  const value = state.pacification ?? 0;
  const modifier = pacificationModifier(G, power, space);
  const roll =
    die(ctx, 6) + die(ctx, 6) + value + (hasAdjacentNaval(G, power, space) ? 1 : 0) + modifier.drm;
  notePacificationAttempt(G, power, space);
  if (roll >= 10) {
    setSpaceControl(G, space, power, {clearInfluence: true});
    state.pacification = 0;
    log(G, power, "pacified", {space, roll, cost});
  } else {
    state.pacification = value + 1;
    log(G, power, "pacificationFailed", {space, roll, cost});
  }
};
