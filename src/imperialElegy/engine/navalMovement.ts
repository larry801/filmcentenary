/**
 * Imperial Elegy — naval movement points (rule 12.3).
 *
 * A naval movement action costs 1 CP and gives every activated naval unit one
 * Naval Movement Point (NMP).  With that single NMP:
 *
 *  - moving within European Waters is unlimited: "for one NMP, units can move
 *    an unlimited distance through European Waters";
 *  - entering a non-European box costs one NMP, and entering European Waters
 *    from a non-European box costs one NMP;
 *  - leaving a port to a naval box costs one NMP (the unit may keep moving when
 *    it enters a European box);
 *  - entering a naval box lets the unit move to one of that box's ports for
 *    free, so port entry costs nothing.
 *
 * `planNavalMove` is the pure planner used by `moves.ts#navalMove`: it returns
 * the cheapest legal path, its NMP cost and the reason a path was refused.  An
 * enemy-occupied box is never a stepping stone; with
 * `allowEnemyDestination` it may be the final contact destination (the live
 * 19.0/19.1/19.2 decision chain then runs).  The Dardanelles gate (3.4.1)
 * requires the controller's permission recorded on `G.dardanellesPassage`.
 */

import {Ctx} from "boardgame.io";
import {ImperialElegyState, NavalContinuationState, Power, PowerOrMinor, SpaceId, Unit} from "../types";
import {SPACES, connectionsOf, isNavalBox, portBoxes, spaceLabel} from "../constant/spaces";
import {
  atWar,
  crossesClosedSuez,
  crossesSuez,
  dardanellesController,
  friendlySpace,
  hasDardanellesPermission,
  isDardanellesCrossing,
  gwMajorSide,
  isArmyKind,
  isPower,
  log,
  movementEndProblem,
  spaceHostileTo,
  trenchExitBlocked,
} from "./rules";
import {decision, openDecision, option} from "./pending";

// The Suez / Dardanelles gate helpers live in `rules.ts` so LoC traces can use
// the same geography without importing the movement planner.  Re-export them
// for the existing naval-movement callers and tests.
export {crossesClosedSuez, dardanellesController, hasDardanellesPermission, isDardanellesCrossing} from "./rules";

/** Rule 12.3: one NMP per naval movement action. */
export const NAVAL_MOVEMENT_POINTS = 1;

/** Rule 3.2.9: the boxes marked with the yellow anchor. */
export const EUROPEAN_WATERS: readonly SpaceId[] = [
  "north-atlantic",
  "baltic-sea",
  "western-mediterranean",
  "eastern-mediterranean",
  "black-sea",
];

export const isEuropeanWaterBox = (space: SpaceId): boolean => EUROPEAN_WATERS.includes(space);

/** 19.1: a European-water naval box, or a port that touches one. */
export const isEuropeanWaterNavalSpace = (space: SpaceId): boolean =>
  isEuropeanWaterBox(space) || portBoxes(space).some((box) => isEuropeanWaterBox(box));

/**
 * 19.2: an avoiding force may not pass the straits of Gibraltar unless that
 * space is friendly controlled.  Returns true when the path crosses the gate
 * while it is not friendly.
 */
export const crossesHostileGibraltar = (
  G: ImperialElegyState,
  power: Power,
  path: readonly SpaceId[],
): boolean => {
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    const crosses =
      (a === "north-atlantic" && b === "western-mediterranean") ||
      (a === "western-mediterranean" && b === "north-atlantic");
    if (!crosses) continue;
    if (!friendlySpace(G, "gibraltar", power)) return true;
  }
  return false;
};

export type NavalPathReason =
  | "ok"
  | "unknownSpace"
  | "notNavalSpace"
  | "enemyBox"
  | "enemyPort"
  | "suezClosed"
  | "suezBlocked"
  | "dardanellesDenied"
  | "dardanellesPermission"
  | "disconnected";

export interface NavalMovePlan {
  ok: boolean;
  /** NMP spent (0 for a move that stays put, 1 for any real move). */
  cost: number;
  /** Space-by-space path, including the starting and ending spaces. */
  path: SpaceId[];
  reason: NavalPathReason;
}

export interface NavalMoveOptions {
  /**
   * 19.0: a naval move may end in a space containing enemy naval units; that
   * contact is a naval battle (with the defender's 19.2 avoid decision), not an
   * illegal move.  The enemy space is still never used as a stepping stone.
   */
  allowEnemyDestination?: boolean;
  /**
   * 3.4.1: plan the route as if the Dardanelles permission had been granted.
   * Used only to discover which crossing needs the controller's permission
   * before the live `dardanellesPassage` decision can be raised; the real
   * legality check always applies the gate.
   */
  ignoreDardanellesGate?: boolean;
}

const isNavalOrPort = (space: SpaceId): boolean =>
  isNavalBox(space) || portBoxes(space).length > 0;

/** Does `space` contain a unit hostile to `power`? */
const hasEnemyUnits = (G: ImperialElegyState, power: Power, space: SpaceId): boolean => {
  for (const id of G.spaces[space]?.units ?? []) {
    const unit = G.units[id];
    if (!unit) continue;
    if (isEnemyOwner(G, power, unit.owner)) return true;
  }
  return false;
};

const isEnemyOwner = (G: ImperialElegyState, power: Power, owner: PowerOrMinor): boolean => {
  if (isPower(owner)) return atWar(G, power, owner);
  if (owner === "IT" || owner === "US") {
    const side = gwMajorSide(G, owner);
    if (side === null || !G.gw?.active) return false;
    const mySide = G.gw.te.includes(power) ? "te" : G.gw.ta.includes(power) ? "ta" : null;
    return mySide !== null && mySide !== side;
  }
  return false;
};

/** Suez gate for one sea hop (rules 3.4 / 12.3). */
const suezGate = (G: ImperialElegyState, power: Power, a: SpaceId, b: SpaceId): NavalPathReason | null => {
  if (!crossesSuez(a, b)) return null;
  if (G.persistent.suezCanal !== true) return "suezClosed";
  const blockedBy = G.persistent.suezBlockedBy;
  if (typeof blockedBy === "string" && blockedBy !== power) return "suezBlocked";
  return null;
};

/**
 * The 3.4.1 gate for one sea hop.  Returns the refusal reason, or null when the
 * hop is not a Dardanelles crossing / passage is permitted.
 */
export const dardanellesGate = (
  G: ImperialElegyState,
  power: Power,
  a: SpaceId,
  b: SpaceId,
): NavalPathReason | null => {
  if (!isDardanellesCrossing(a, b)) return null;
  if (hasDardanellesPermission(G, power)) return null;
  const controller = dardanellesController(G);
  if (controller !== null && atWar(G, power, controller)) return "dardanellesDenied";
  return "dardanellesPermission";
};

/** Backwards-compatible name used by the planner. */
const crossesDeniedDardanelles = (
  G: ImperialElegyState,
  power: Power,
  a: SpaceId,
  b: SpaceId,
): NavalPathReason | null => dardanellesGate(G, power, a, b);

/** One sea hop of a planned route that crosses the Dardanelles. */
export interface DardanellesCrossing {
  from: SpaceId;
  to: SpaceId;
  reason: "dardanellesPermission" | "dardanellesDenied";
}

/**
 * 3.4.1 over a whole planned route.  A multi-box NMP move may cross the strait
 * on an intermediate hop, so the live prompt/move validation must inspect the
 * path, not just the origin and destination.
 */
export const dardanellesCrossingsOnPath = (
  G: ImperialElegyState,
  power: Power,
  path: readonly SpaceId[],
): DardanellesCrossing[] => {
  const out: DardanellesCrossing[] = [];
  for (let i = 1; i < path.length; i += 1) {
    const gate = dardanellesGate(G, power, path[i - 1], path[i]);
    if (gate === "dardanellesPermission" || gate === "dardanellesDenied") {
      out.push({from: path[i - 1], to: path[i], reason: gate});
    }
  }
  return out;
};

/** The first hop of `path` that needs the controller's permission, if any. */
export const firstDardanellesPermissionCrossing = (
  G: ImperialElegyState,
  power: Power,
  path: readonly SpaceId[],
): DardanellesCrossing | null =>
  dardanellesCrossingsOnPath(G, power, path).find((crossing) => crossing.reason === "dardanellesPermission") ??
  null;

/**
 * 3.4.1: raise the controller's permission decision when a planned route needs
 * it.  Shared by the live wrappers (`moves.ts#navalMove`/`gwJointNaval`), the
 * GW flow's direct `performGwManeuver` callers and the free naval moves, so
 * every path that crosses the strait asks the same question.  Returns true
 * when a decision was opened (the caller must then return without spending an
 * action).
 */
const requestDardanellesPassage = (
  G: ImperialElegyState,
  ctx: Ctx | undefined,
  power: Power,
  from: SpaceId,
  to: SpaceId,
  path?: readonly SpaceId[],
  resume?: Record<string, unknown>,
): boolean => {
  if (G.pending !== null || G.battle !== null) return false;
  const route = path && path.length > 1 ? path : [from, to];
  const crossing = firstDardanellesPermissionCrossing(G, power, route);
  if (crossing === null) return false;
  const controller = dardanellesController(G);
  if (controller === null || controller === power) return false;
  log(G, power, "dardanellesPassageRequested", {
    from: crossing.from,
    to: crossing.to,
    requestedFrom: from,
    requestedTo: to,
    controller,
  });
  openDecision(G, ctx, decision(
    "dardanellesPassage",
    controller,
    "Dardanelles passage: grant or refuse permission for the Black Sea / Eastern Mediterranean crossing",
    [option("grant", "Grant permission"), option("refuse", "Refuse permission")],
    {
      requesting: power,
      granting: controller,
      from: crossing.from,
      to: crossing.to,
      requestedFrom: from,
      requestedTo: to,
      ...(resume === undefined ? {} : resume),
    },
  ));
  return true;
};

export {requestDardanellesPassage};

/** Cost in NMP of one directed sea hop between two boxes. */
const seaHopCost = (from: SpaceId, to: SpaceId): number =>
  isEuropeanWaterBox(from) && isEuropeanWaterBox(to) ? 0 : 1;

interface Edge {
  to: SpaceId;
  cost: number;
  /** Why the hop is illegal, if it is. */
  denied: NavalPathReason | null;
}

const outgoingEdges = (
  G: ImperialElegyState,
  power: Power,
  space: SpaceId,
  options: NavalMoveOptions,
): Edge[] => {
  const edges: Edge[] = [];
  if (isNavalBox(space)) {
    // Entering the box's ports is free.
    for (const def of Object.values(SPACES)) {
      if (def.ports?.includes(space)) edges.push({to: def.id, cost: 0, denied: null});
    }
    for (const conn of connectionsOf(space)) {
      if (conn.type !== "sea") continue;
      const next = conn.a === space ? conn.b : conn.a;
      if (!isNavalBox(next)) continue;
      const suez = suezGate(G, power, space, next);
      const dardanelles = options.ignoreDardanellesGate
        ? null
        : crossesDeniedDardanelles(G, power, space, next);
      const enemy = hasEnemyUnits(G, power, next);
      edges.push({
        to: next,
        cost: seaHopCost(space, next),
        denied: suez ?? dardanelles ?? (enemy ? "enemyBox" : null),
      });
    }
    return edges;
  }
  // A port: leaving the port for a box costs one NMP only when the box is
  // outside European Waters; the European cruise itself is part of the action's
  // single NMP.
  for (const box of portBoxes(space)) {
    if (!isNavalBox(box)) continue;
    const suez = suezGate(G, power, space, box);
    const dardanelles = options.ignoreDardanellesGate
      ? null
      : crossesDeniedDardanelles(G, power, space, box);
    const enemy = hasEnemyUnits(G, power, box);
    edges.push({
      to: box,
      cost: isEuropeanWaterBox(box) ? 0 : 1,
      denied: suez ?? dardanelles ?? (enemy ? "enemyBox" : null),
    });
  }
  return edges;
};

/**
 * Plan a naval move under the printed NMP allowance.  Returns the cheapest
 * legal path; the caller applies it to every selected unit and charges the
 * action's 1 CP (not the NMP).
 */
export const planNavalMove = (
  G: ImperialElegyState,
  power: Power,
  from: SpaceId,
  to: SpaceId,
  options: NavalMoveOptions = {},
): NavalMovePlan => {
  if (!G.spaces[from] || !G.spaces[to]) return {ok: false, cost: 0, path: [], reason: "unknownSpace"};
  if (!isNavalOrPort(from) || !isNavalOrPort(to)) return {ok: false, cost: 0, path: [], reason: "notNavalSpace"};
  if (from === to) return {ok: true, cost: 0, path: [from], reason: "ok"};
  if (portBoxes(to).length > 0) {
    const control = G.spaces[to].control;
    const enemyControl = isPower(control) && atWar(G, power, control);
    const enemyShips = hasEnemyUnits(G, power, to);
    if (enemyControl || enemyShips) {
      // Ending in an enemy port is only legal when there is an enemy fleet there
      // to fight (19.0); an empty enemy port still needs an amphibious assault.
      if (!enemyShips) return {ok: false, cost: 0, path: [], reason: "enemyPort"};
      if (options.allowEnemyDestination !== true) {
        return {ok: false, cost: 0, path: [], reason: "enemyPort"};
      }
    }
  }

  // Dijkstra over (space) with 0/1 edge costs; the NMP budget is one, so a node
  // is only expanded while its best cost is within it.  A hostile space may be
  // the final destination (a contact battle) but never a stepping stone.
  const battleNodes = new Set<SpaceId>();
  const best = new Map<SpaceId, number>([[from, 0]]);
  const parent = new Map<SpaceId, SpaceId>();
  const queue: SpaceId[] = [from];
  let deniedReason: NavalPathReason | null = null;
  while (queue.length > 0) {
    // Deterministic: always expand the cheapest node, ties by space id.
    queue.sort((a, b) => (best.get(a) ?? Infinity) - (best.get(b) ?? Infinity) || a.localeCompare(b));
    const current = queue.shift()!;
    // Entering a port ends the movement: a port is a destination, not a
    // stepping stone to another box (otherwise Egypt/Dardanelles would bypass
    // the Suez and Dardanelles gates).  A contact space is equally terminal.
    if (current !== from && portBoxes(current).length > 0) continue;
    if (current !== from && battleNodes.has(current)) continue;
    const currentCost = best.get(current) ?? 0;
    for (const edge of outgoingEdges(G, power, current, options)) {
      const contactDestination =
        edge.denied === "enemyBox" &&
        options.allowEnemyDestination === true &&
        edge.to === to &&
        hasEnemyUnits(G, power, edge.to);
      if (edge.denied !== null && !contactDestination) {
        deniedReason = deniedReason ?? edge.denied;
        continue;
      }
      const nextCost = currentCost + edge.cost;
      if (nextCost > NAVAL_MOVEMENT_POINTS) continue;
      const known = best.get(edge.to);
      if (known !== undefined && known <= nextCost) continue;
      best.set(edge.to, nextCost);
      parent.set(edge.to, current);
      if (contactDestination) battleNodes.add(edge.to);
      queue.push(edge.to);
    }
  }

  const cost = best.get(to);
  if (cost === undefined) {
    return {ok: false, cost: 0, path: [], reason: deniedReason ?? "disconnected"};
  }
  const path: SpaceId[] = [to];
  let cursor: SpaceId | undefined = to;
  while (cursor !== undefined && cursor !== from) {
    cursor = parent.get(cursor);
    if (cursor !== undefined) path.unshift(cursor);
  }
  // Any real move spends the action's one NMP, even when the internal cost is
  // zero because the whole path stayed in European Waters.
  return {ok: true, cost: 1, path, reason: "ok"};
};


// ---------------------------------------------------------------------------
// 12.3 naval transport (one land unit with the fleet)
// ---------------------------------------------------------------------------

/**
 * Why a 12.3 land-unit transport is refused.
 *
 * Rule 12.3: "Each naval movement action allows a player to move all their
 * naval units plus one land unit by sea for 1 CP. The land unit can move
 * through naval boxes as if it was a naval unit (they are considered to be on
 * transports), and they are not required to be escorted by friendly naval
 * units."  19.10 keeps land units out of enemy controlled/occupied ports, so a
 * transport can only disembark at a non-hostile port; an assault stays the
 * separate `amphibiousAssault` action.
 */
export type NavalTransportReason =
  | "land-unit"
  | "land-kind"
  | "naval-unit"
  | "different-origin"
  | "origin-not-port"
  | "origin-hostile"
  | "same-space"
  | "target-not-port"
  | "target-hostile"
  | "path"
  | "army-stacking"
  | "port-capacity"
  | "trench-exit";

export interface NavalTransportPlan {
  ok: boolean;
  reason: NavalTransportReason | "ok";
  from: SpaceId | null;
  path: SpaceId[];
}

/**
 * The 12.3 transport plan for one already-commanded land unit and fleet.
 *
 * Ownership is validated by the live move layer (`commandsUnit`, which knows
 * about a US/Italian GW impulse); this pure function owns the geometry, the
 * 19.10 landing restriction and the 5.5.3/5.5.4 capacity checks.
 */
export const planNavalTransport = (
  G: ImperialElegyState,
  power: Power,
  land: Unit | undefined,
  naval: readonly (Unit | undefined)[],
  to: SpaceId,
): NavalTransportPlan => {
  const fail = (reason: NavalTransportReason, from: SpaceId | null = null): NavalTransportPlan =>
    ({ok: false, reason, from, path: []});
  if (!land) return fail("land-unit");
  if (!isArmyKind(land.kind)) return fail("land-kind");
  const from = land.space ?? null;
  if (from === null || !G.spaces[from]) return fail("land-unit");
  if (!isNavalBox(from) && portBoxes(from).length === 0) return fail("origin-not-port", from);
  if (naval.some((unit) => !unit || unit.naval !== true)) return fail("naval-unit", from);
  if (naval.some((unit) => unit!.space !== from)) return fail("different-origin", from);
  // A port is the loading point; no enemy port may load transports.
  if (!isNavalBox(from) && spaceHostileTo(G, power, from)) return fail("origin-hostile", from);

  const target = G.spaces[to];
  if (!target || isNavalBox(to) || portBoxes(to).length === 0) return fail("target-not-port", from);
  if (to === from) return fail("same-space", from);
  // 19.10: "Land units cannot move into enemy controlled (or occupied) ports
  // using naval movement."  An amphibious assault is the separate action.
  if (spaceHostileTo(G, power, to)) return fail("target-hostile", from);

  const plan = planNavalMove(G, power, from, to);
  if (!plan.ok) return fail("path", from);
  const arriving: Unit[] = [land, ...naval.filter((unit): unit is Unit => unit !== undefined)];
  const capacity = movementEndProblem(G, to, arriving);
  if (capacity === "armyStacking") return fail("army-stacking", from);
  if (capacity === "portCapacity") return fail("port-capacity", from);
  if (trenchExitBlocked(G, power, from, to)) return fail("trench-exit", from);
  return {ok: true, reason: "ok", from, path: plan.path};
};

// ---------------------------------------------------------------------------
// 19.1 Finish the interrupted naval movement
// ---------------------------------------------------------------------------

/**
 * 19.1: "The active player will be able to finish their naval movement after
 * the interception attempt and subsequent battle (if one occurs)" and "Units
 * using naval movement in European Waters that were intercepted may continuing
 * moving if they won the battle."
 *
 * The move already paid its action (CP or GW budget) before the interception
 * window opened, so finishing it never spends again.  The surviving ships are
 * in the interception box; the mover may pick any other legal final
 * destination reachable with the same NMP (including 19.8's adjacent friendly
 * port) or stop.  The caller (`combat.ts#finishBattle`) only offers this after
 * a won battle in a European Waters box.
 */
export const navalContinuationDestinations = (
  G: ImperialElegyState,
  continuation: NavalContinuationState,
): SpaceId[] => {
  const contact = continuation.contact;
  const units = continuation.unitIds
    .map((id) => G.units[id])
    .filter((unit) => Boolean(unit) && unit!.space === contact && unit!.steps > 0);
  if (units.length === 0) return [];
  const out: SpaceId[] = [];
  for (const dest of Object.keys(G.spaces).sort()) {
    if (dest === contact) continue;
    if (!planNavalMove(G, continuation.power, contact, dest).ok) continue;
    if (continuation.ally !== undefined && !planNavalMove(G, continuation.ally, contact, dest).ok) continue;
    if (movementEndProblem(G, dest, units) !== null) continue;
    out.push(dest);
  }
  return out;
};

/**
 * 19.1: open the mover's private "finish the naval movement" decision.  One
 * decision per interception: the options are the legal destinations plus
 * "stop"; declining/stopping keeps every ship where the battle left it.
 */
export const openNavalContinuationDecision = (
  G: ImperialElegyState,
  ctx: Ctx | undefined,
  continuation: NavalContinuationState,
): boolean => {
  if (ctx === undefined) return false;
  if (G.pending !== null || G.battle !== null) return false;
  if (!continuation.intercepted) return false;
  const contact = continuation.contact;
  const survivors = continuation.unitIds
    .map((id) => G.units[id])
    .filter((unit): unit is Unit => Boolean(unit) && unit!.space === contact && unit!.steps > 0)
    .map((unit) => unit.id);
  if (survivors.length === 0) return false;
  const live: NavalContinuationState = {...continuation, unitIds: survivors};
  const destinations = navalContinuationDestinations(G, live);
  if (destinations.length === 0) return false;
  const options = destinations.map((dest) =>
    option(dest, `Continue the naval move to ${spaceLabel(dest, "en")}`, {space: dest}),
  );
  options.push(option("stop", "Stop here (finish the movement)"));
  openDecision(G, ctx, decision(
    "navalContinuation",
    continuation.power,
    "19.1 interception won: finish the interrupted naval movement or stop here",
    options,
    {
      contact,
      unitIds: survivors,
      destinations,
      ...(continuation.ally === undefined ? {} : {ally: continuation.ally}),
    },
  ));
  return true;
};
