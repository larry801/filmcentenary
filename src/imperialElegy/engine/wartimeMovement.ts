/**
 * 15.2.4 March and 15.2.5 Rail Movement — the two wartime land moves.
 *
 * The live wartime move used to be the peacetime 12.15 redeployment: unlimited
 * distance along controlled/influenced land, ending in a friendly space.  That
 * is the *action phase* rule.  In a war the printed actions are different:
 *
 *   March: 1 CP.  "The active player can move all land units they control two
 *   spaces, if both spaces have clear connections, or 1 space via difficult or
 *   severe connections.  Players cannot march into spaces containing enemy land
 *   units, an enemy fort, or neutral spaces; but players can march through enemy
 *   spaces that do not contain enemy land units (or fort)."
 *
 *   Rail: 1 CP.  "Players can move armies equal to half their industry (round
 *   up) an unlimited distance by land to friendly controlled (or occupied)
 *   spaces.  Units using rail movement cannot move through enemy or neutral
 *   spaces."
 *
 * Both are pure here so the move layer, the map's target rings and the Rule 34
 * bot can share one answer instead of three approximations.  The module owns the
 * distance, the pass-through rule and the rail budget; the CP charge stays in
 * `moves.ts` with every other action cost.
 */
import type {ImperialElegyState, Power, SpaceId, Unit} from "../types";
import {ITALY_WARTIME_INDUSTRY} from "./italyMilitary";
import {SPACES, connectionBetween, isNavalBox, neighboursOf} from "../constant/spaces";
import {allied, atWar, commandsAlliedMinor, friendlySpace, isArmyKind, isPower, minorController} from "./rules";

/** Which of the two printed wartime land actions a move is. */
export type WartimeMoveKind = "march" | "rail";

export interface WartimeMovePlan {
  ok: boolean;
  kind: WartimeMoveKind;
  /** Printed reason when the move is refused. */
  reason?:
    | "not-commanded"
    | "not-land"
    | "no-origin"
    | "same-space"
    | "no-connection"
    | "too-far"
    | "enemy-units"
    | "enemy-fort"
    | "neutral"
    | "no-rail-path"
    | "rail-allowance";
  /** The spaces the unit passes through, origin first. */
  path: SpaceId[];
}

/**
 * 15.2.4: a neutral space is one controlled/occupied by a non-player power that
 * is not a belligerent on either side of the running war.  A space with no
 * marker at all is *not* neutral — it is uncontrolled, and the printed clause
 * only bars neutral territory.
 */
export const isNeutralLandSpace = (G: ImperialElegyState, power: Power, space: SpaceId): boolean => {
  const state = G.spaces[space];
  if (!state) return false;
  const owners = [state.occupiedBy, state.control].filter(
    (owner): owner is NonNullable<typeof owner> => owner !== null && owner !== undefined,
  );
  for (const owner of owners) {
    if (isPower(owner)) {
      if (owner === power || allied(G, power, owner)) continue;
      if (atWar(G, power, owner)) continue;
      return true;
    }
    // A minor's space is neutral for this power unless the minor is its ally or
    // is controlled by a belligerent.
    const controller = minorController(G, owner);
    if (controller !== null && (controller === power || allied(G, power, controller) || atWar(G, power, controller))) {
      continue;
    }
    if (state.ally === power || (isPower(state.ally) && allied(G, power, state.ally))) continue;
    return true;
  }
  return false;
};

/** Armies (including controlled allied-minor armies) a power may move. */
export const commandsLandUnit = (G: ImperialElegyState, power: Power, unit: Unit | undefined): boolean => {
  if (!unit) return false;
  if (unit.owner === power) return true;
  return commandsAlliedMinor(G, power, unit.owner);
};

/**
 * 15.2.4: can the march *enter* `space`?  An enemy land unit, an enemy fort or
 * neutral territory stops it.  Enemy ships do not ("If players enter a space
 * containing enemy naval units, the naval units immediately displace").
 *
 * "Players cannot march into spaces containing enemy land units, an enemy fort,
 * or neutral spaces; but players can march through enemy spaces that do not
 * contain enemy land units (or fort)."  The pass-through exception is printed
 * for *enemy* spaces only, so a neutral space blocks both hops and `terminal` is
 * not used to relax it.  It stays a parameter because the middle hop of a march
 * never has to satisfy the destination-only checks (none today, but keeping the
 * distinction explicit stops a future edit from silently widening it).
 */
type EnterProblem = "enemy-units" | "enemy-fort" | "neutral";

const marchEnterProblem = (
  G: ImperialElegyState,
  power: Power,
  space: SpaceId,
  _terminal: boolean,
): EnterProblem | null => {
  const state = G.spaces[space];
  if (!state) return "enemy-units";
  const enemyLand = state.units.some((id) => {
    const unit = G.units[id];
    if (!unit || unit.naval === true || unit.steps <= 0) return false;
    if (!isArmyKind(unit.kind) && unit.kind !== "eliteCorps" && unit.kind !== "expeditionary") return true;
    return unitHostile(G, power, unit);
  });
  if (enemyLand) return "enemy-units";
  if (state.fort && fortHostile(G, power, state.fort.power)) return "enemy-fort";
  if (isNeutralLandSpace(G, power, space)) return "neutral";
  return null;
};

const unitHostile = (G: ImperialElegyState, power: Power, unit: Unit): boolean => {
  if (unit.owner === power) return false;
  if (isPower(unit.owner)) return atWar(G, power, unit.owner) && !allied(G, power, unit.owner);
  const controller = minorController(G, unit.owner);
  if (controller !== null) return atWar(G, power, controller) && !allied(G, power, controller);
  // A rebel or independent force is hostile to everyone; it stops a march.
  return true;
};

const fortHostile = (G: ImperialElegyState, power: Power, owner: Power | string | undefined): boolean => {
  if (owner === undefined) return false;
  if (owner === power) return false;
  if (isPower(owner)) return atWar(G, power, owner) && !allied(G, power, owner);
  const controller = minorController(G, owner);
  if (controller !== null) return atWar(G, power, controller) && !allied(G, power, controller);
  return true;
};

/** Every printed connection is clear unless it says otherwise. */
const isDifficult = (from: SpaceId, to: SpaceId): boolean => {
  const connection = connectionBetween(from, to);
  return connection !== undefined && (connection.type === "difficult" || connection.type === "severe");
};

/**
 * 15.2.4 march: one space, or two when both hops are clear connections.
 *
 * The first hop may pass *through* an enemy space with no enemy land unit/fort
 * (that is the printed exception), but the unit can never *end* there.
 */
export const planMarch = (
  G: ImperialElegyState,
  power: Power,
  unitId: string,
  to: SpaceId,
): WartimeMovePlan => {
  const unit = G.units[unitId];
  const fail = (reason: NonNullable<WartimeMovePlan["reason"]>, path: SpaceId[] = []): WartimeMovePlan =>
    ({ok: false, kind: "march", reason, path});
  if (!unit || !commandsLandUnit(G, power, unit)) return fail("not-commanded");
  if (unit.naval === true) return fail("not-land");
  const from = unit.space ?? null;
  if (from === null || !G.spaces[from]) return fail("no-origin");
  if (from === to) return fail("same-space");
  if (isNavalBox(to) || !SPACES[to]) return fail("no-connection");

  // One-hop march.
  if (neighboursOf(from).includes(to) && connectionBetween(from, to)?.type !== "sea") {
    const problem = marchEnterProblem(G, power, to, true);
    if (problem !== null) return fail(problem, [from, to]);
    return {ok: true, kind: "march", path: [from, to]};
  }

  // Two-hop march: both connections must be clear, and the middle space only
  // has to be *passable* (it may be enemy-held but empty).
  let best: SpaceId[] | null = null;
  for (const middle of neighboursOf(from)) {
    if (isNavalBox(middle) || !G.spaces[middle]) continue;
    const first = connectionBetween(from, middle);
    if (!first || first.type === "sea" || first.type === "difficult" || first.type === "severe") continue;
    if (isDifficult(from, middle)) continue;
    if (!neighboursOf(middle).includes(to)) continue;
    const second = connectionBetween(middle, to);
    if (!second || second.type === "sea" || isDifficult(middle, to)) continue;
    if (marchEnterProblem(G, power, to, true) !== null) continue;
    // The middle space must be traversable: no enemy land unit and no enemy
    // fort.  It is only *passed through*, so the neutral bar does not apply.
    const middleProblem = marchEnterProblem(G, power, middle, false);
    if (middleProblem !== null) continue;
    best = [from, middle, to];
    break;
  }
  if (best === null) return fail("too-far");
  return {ok: true, kind: "march", path: best};
};

/**
 * 15.2.5: the rail allowance is half the power's industry, rounded up, never
 * less than one.  Italy counts as 1 industry and a controlled minor rails on
 * its controller's allowance (15.4 / 15.2.5).
 */
export const railAllowance = (G: ImperialElegyState, power: Power | "IT"): number =>
  Math.max(1, Math.ceil((power === "IT" ? ITALY_WARTIME_INDUSTRY : (G.powers[power]?.industry ?? 1)) / 2));

/** Armies already railed this impulse (0 when no rail has run). */
export const wartimeRailed = (G: ImperialElegyState, power: Power): number =>
  Number(G.powers[power]?.flags.wartimeRailedThisImpulse ?? 0);

/**
 * 15.2.5 rail: an unlimited land path over friendly controlled (or occupied)
 * spaces.  "Units using rail movement cannot move through enemy or neutral
 * spaces" — so the whole path must be friendly, and the destination must be
 * friendly too.
 */
export const planRail = (
  G: ImperialElegyState,
  power: Power,
  unitId: string,
  to: SpaceId,
): WartimeMovePlan => {
  const unit = G.units[unitId];
  const fail = (reason: NonNullable<WartimeMovePlan["reason"]>, path: SpaceId[] = []): WartimeMovePlan =>
    ({ok: false, kind: "rail", reason, path});
  if (!unit || !commandsLandUnit(G, power, unit)) return fail("not-commanded");
  if (unit.naval === true) return fail("not-land");
  const from = unit.space ?? null;
  if (from === null || !G.spaces[from]) return fail("no-origin");
  if (from === to) return fail("same-space");
  if (isNavalBox(to) || !SPACES[to]) return fail("no-connection");
  // 22.4: an Italian unit rails on Italy's own 1-industry allowance even when
  // an allied player commands it; a normal unit uses its controller's.
  const allowance = unit.owner === "IT" ? railAllowance(G, "IT") : railAllowance(G, power);
  if (wartimeRailed(G, power) >= allowance) return fail("rail-allowance");
  // The railing power may not rail a unit out of an unfriendly start either:
  // the network is traced from a friendly space.
  if (!friendlySpace(G, from, power)) return fail("no-rail-path");
  if (!friendlySpace(G, to, power)) return fail("no-rail-path");
  const path = friendlyRailPath(G, power, from, to);
  if (path === null) return fail("no-rail-path");
  return {ok: true, kind: "rail", path};
};

/** BFS over the friendly land network; `null` when no route exists. */
const friendlyRailPath = (
  G: ImperialElegyState,
  power: Power,
  from: SpaceId,
  to: SpaceId,
): SpaceId[] | null => {
  const previous = new Map<SpaceId, SpaceId | null>([[from, null]]);
  const queue: SpaceId[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) {
      const path: SpaceId[] = [];
      let cursor: SpaceId | null = current;
      while (cursor !== null) {
        path.unshift(cursor);
        cursor = previous.get(cursor) ?? null;
      }
      return path;
    }
    for (const next of neighboursOf(current)) {
      if (previous.has(next) || isNavalBox(next) || !SPACES[next]) continue;
      const connection = connectionBetween(current, next);
      if (!connection || connection.type === "sea") continue;
      if (!friendlySpace(G, next, power)) continue;
      previous.set(next, current);
      queue.push(next);
    }
  }
  return null;
};

/**
 * The single answer a move layer or a map ring needs: try the printed march
 * first (it is the shorter, cheaper-to-describe action), then rail.
 */
export const planWartimeLandMove = (
  G: ImperialElegyState,
  power: Power,
  unitId: string,
  to: SpaceId,
): WartimeMovePlan => {
  const march = planMarch(G, power, unitId, to);
  if (march.ok) return march;
  const rail = planRail(G, power, unitId, to);
  if (rail.ok) return rail;
  // Report the march reason when neither applies: it is the action the player
  // was most likely attempting.
  return march;
};
