/**
 * Which spaces a selected unit may legally move to.
 *
 * The map used to highlight "a friendly neighbour", a heuristic that offered
 * moves the engine refuses (an overstacked destination, a redeploy that cannot
 * trace a supply path, a Great War march into hostile ground) and hid legal
 * ones (12.15 redeploy reaches any friendly space after a land/rail path, and
 * in wartime every friendly space).  This module mirrors the engine's own
 * predicates instead:
 *
 *   redeployLandPath, movementEndProblem, maneuverDestinationProblem (rules.ts)
 *   planNavalMove (navalMovement.ts)
 *   gwLandMoveProblem (greatWarFlow.ts)
 *
 * It is still the engine that decides: a target listed here can be refused
 * (the move reports why), but a target that is *not* listed would be refused
 * every time, which is what keeps the rings honest.
 */
import type {ImperialElegyState, Power, SpaceId, Unit} from "../types";
import {SPACES, isNavalBox} from "../constant/spaces";
import {
  friendlySpace, isArmyKind, maneuverDestinationProblem, movementEndProblem, redeployLandPath,
} from "../engine/rules";
import {planNavalMove, specialRedeployPath} from "../engine/navalMovement";
import {planWartimeLandMove} from "../engine/wartimeMovement";
import {gwLandMoveProblem} from "../engine/greatWarFlow";

export type LandMoveKind = "redeploy" | "march" | "rail";

export interface LegalTargetsInput {
  G: ImperialElegyState;
  power: Power;
  /** The unit under the selection, already checked as commanded by `power`. */
  unit: Unit;
  /** The game phase, so the Great War ladder is used where the engine uses it. */
  phase: string;
}

/** The eight board intents, as the interaction state names them. */
export type UnitIntent = "redeploy" | "gwMarch" | "gwRail";

const landTargets = (input: LegalTargetsInput, kind: LandMoveKind): SpaceId[] => {
  const {G, power, unit} = input;
  const from = unit.space;
  if (!from) return [];
  return Object.keys(G.spaces).filter((id) => {
    const to = id as SpaceId;
    if (to === from || isNavalBox(to) || !SPACES[to]) return false;
    if (kind === "redeploy") {
      // 15.2.4/15.2.5: a wartime land move is a march or a rail, so the ring
      // must come from the same planner the move uses — not from the peacetime
      // 12.15 route.  The planner already covers an unlimited rail path.
      if (G.phase === "wartime" && G.war !== null) return planWartimeLandMove(G, power, unit.id, to).ok;
      // 12.15: a land/rail path through owned or influenced spaces, ending in
      // one; the stacking rules still apply at the destination.  Special
      // Redeployment (ECs / elite colonial EFs / Zouaves) may instead trace a
      // naval-box route if it ends stacked with a friendly army.
      if (!redeployLandPath(G, power, from, to) && !specialRedeployPath(G, power, unit, to)) return false;
      return movementEndProblem(G, to, [unit]) === null &&
        maneuverDestinationProblem(G, power, {kind: "redeploy", unitId: unit.id, to}) === null;
    }
    // The Great War ladder: the engine's own march/rail test, run without
    // mutating anything (it is pure until the move is committed).
    return gwLandMoveProblem(G, power, unit.id, to, kind) === null;
  }) as SpaceId[];
};

const navalTargets = (input: LegalTargetsInput): SpaceId[] => {
  const {G, power, unit} = input;
  const from = unit.space;
  if (!from) return [];
  return Object.keys(G.spaces).filter((id) => {
    const to = id as SpaceId;
    if (to === from) return false;
    const plan = planNavalMove(G, power, from, to);
    // 19.0: a contact with enemy ships is a battle, which the naval-battle
    // intent offers; the plain move only lists spaces the fleet can reach.
    return plan.ok;
  }) as SpaceId[];
};

/**
 * Every legal destination of the selected unit, with the intents that apply
 * there.  One destination may carry two intents (a Great War land unit can
 * march or rail to the same space), which is what the chooser resolves.
 */
export const legalUnitTargets = (input: LegalTargetsInput): Map<SpaceId, UnitIntent[]> => {
  const {unit, phase} = input;
  const out = new Map<SpaceId, UnitIntent[]>();
  const add = (id: SpaceId, intent: UnitIntent) => {
    const list = out.get(id) ?? [];
    if (!list.includes(intent)) list.push(intent);
    out.set(id, list);
  };
  if (!unit.space) return out;
  const gwLadder = phase === "gwManeuver";
  // Outside the Great War, 12.15/16.1 move the seat's own counters only.  A
  // 15.4 controlled minor is selectable (and fights from the Orders battle
  // row) but has no move rings the engine would accept.
  if (!gwLadder && unit.owner !== input.power) return out;
  if (unit.naval) {
    for (const id of navalTargets(input)) add(id, "redeploy");
    return out;
  }
  if (!isArmyKind(unit.kind) && unit.kind !== "expeditionary" && unit.kind !== "eliteColonialEf"
    && unit.kind !== "zouave" && unit.kind !== "eliteCorps") {
    return out;
  }
  if (gwLadder && unit.owner !== "US" && unit.owner !== "IT") {
    for (const id of landTargets(input, "march")) add(id, "gwMarch");
    for (const id of landTargets(input, "rail")) add(id, "gwRail");
    return out;
  }
  for (const id of landTargets(input, "redeploy")) add(id, "redeploy");
  return out;
};

/**
 * The ring a target's intents earn on the map: an attack-capable target is
 * drawn as an attack, a rail-only one as rail, everything else as a move.
 */
export const intentStyle = (intents: UnitIntent[]): "move" | "rail" | "choice" => {
  if (intents.length > 1) return "choice";
  if (intents[0] === "gwRail") return "rail";
  return "move";
};

/** A destination's friendly status, for the map's "would this be a move" tie-break. */
export const destinationIsFriendly = (G: ImperialElegyState, to: SpaceId, power: Power): boolean =>
  friendlySpace(G, to, power);
