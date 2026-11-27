/**
 * 22.4 Italian Military — the lone-defender and one-industry clauses.
 *
 * The printed text is:
 *
 *   "In wartime, Italy is controlled by the allied player who is earliest in
 *    the wartime initiative order.  Treat Italy as though it has 1 industry for
 *    the purposes of rail movement and deploy reserves actions.
 *    If Italy is defending alone with no allies, their standing armies not in
 *    Rome automatically displace to the targeted war goal space(s) at the start
 *    of the war.  During the Italian impulse they will always deploy a reserve
 *    army to defend or support (in that order) the goal space(s)."
 *
 * These helpers are pure state transforms called from `moves.ts#startWarManeuver`
 * (limited war) and from the Great War's Italian impulse.  They deliberately
 * reuse the shared 22.4 plan in `rules.ts`, so the Italian army/naval placement
 * cannot drift from the unification redeployment.
 */
import {Ctx} from "boardgame.io";
import {ImperialElegyState, Power, SpaceId, Unit, WarState} from "../types";
import {isNavalBox, neighboursOf} from "../constant/spaces";
import {die, isArmyKind, isPower, landStackingLimit, landUnitsIn, log} from "./rules";

/** 22.4: Italy is treated as though it has 1 industry in wartime. */
export const ITALY_WARTIME_INDUSTRY = 1;

const ITALY_ARMY_KIND: Unit["kind"] = "italianArmy";

/** The side unified Italy fights on in this war, or null when it is not a belligerent. */
export const italyWarSide = (war: WarState | null | undefined): "attacker" | "defender" | null => {
  if (!war) return null;
  if (war.minorTarget?.minor === "Italy") return "defender";
  if (war.attackerMinors.includes("Italy")) return "attacker";
  if (war.defenderMinors.includes("Italy")) return "defender";
  return null;
};

/** True when unified Italy is a belligerent of this war. */
export const italyInvolvedInWar = (war: WarState | null | undefined): boolean =>
  italyWarSide(war) !== null;

/** The targeted war-goal spaces when the war is fought over Italy. */
export const italyWarGoals = (war: WarState | null | undefined): SpaceId[] => {
  if (!italyInvolvedInWar(war)) return [];
  return [...(war?.objectives ?? [])];
};

/**
 * 22.4: "Italy is controlled by the allied player who is earliest in the
 * wartime initiative order."  During `warAim`/`alliance` the initiative order
 * has not been rolled yet, so fall back to the printed side order; at/after
 * `startWarManeuver` the recorded initiative order decides.  An Italy with no
 * player ally is its own sovereign ("IT").
 */
export const italyWartimeCommander = (
  G: ImperialElegyState,
  war: WarState | null = G.war,
): "IT" | Power | null => {
  void G;
  const side = italyWarSide(war);
  if (war === null || side === null) return null;
  const players = side === "defender"
    ? [war.defender, ...war.defenderAllies].filter(isPower)
    : [war.attacker, ...war.attackerAllies].filter(isPower);
  if (players.length === 0) return "IT";
  // Only a player allied to Italy can command it.  `defenderAllies` is the
  // player side of a 13.4 declaration, so it already names the ally; a
  // multi-player side still uses the earliest initiative slot.
  const ordered = war.initiative.filter((seat) => players.includes(seat));
  return ordered[0] ?? players[0];
};

/** Italy's in-play standing armies, excluding those already off map. */
const standingItalianArmies = (G: ImperialElegyState): Unit[] =>
  Object.values(G.units).filter(
    (unit) => unit.owner === "IT" && unit.kind === ITALY_ARMY_KIND && unit.space !== null && unit.space !== undefined,
  );

/** Whether `space` has room for one more Italian army (5.5.1 stacking). */
const italyRoomIn = (G: ImperialElegyState, space: SpaceId): boolean => {
  const state = G.spaces[space];
  if (!state || isNavalBox(space)) return false;
  if (state.control !== "IT") return false;
  if (state.occupiedBy !== null && state.occupiedBy !== undefined && state.occupiedBy !== "IT") return false;
  if (!state.units.every((id) => G.units[id]?.owner === "IT")) return false;
  return landUnitsIn(G, space).filter((unit) => isArmyKind(unit.kind)).length < landStackingLimit(space);
};

const moveItalianArmy = (G: ImperialElegyState, unit: Unit, to: SpaceId): void => {
  if (unit.space) {
    const from = G.spaces[unit.space];
    if (from) from.units = from.units.filter((id) => id !== unit.id);
  }
  G.spaces[to].units.push(unit.id);
  unit.space = to;
};

/**
 * 22.4 lone defender: "their standing armies not in Rome automatically
 * displace to the targeted war goal space(s) at the start of the war."
 * Armies are distributed over the printed goals, never into Rome, respecting
 * stacking; an army that cannot fit stays where it is.
 */
export const displaceItalyForLoneDefense = (
  G: ImperialElegyState,
  war: WarState | null = G.war,
  ctx?: Ctx,
): {unitId: string; from: SpaceId; to: SpaceId}[] => {
  if (!G.persistent.italyUnified || war === null) return [];
  if (war.minorTarget?.minor !== "Italy" || war.minorTarget.ally !== null) return [];
  const goals = italyWarGoals(war).filter((goal) => goal !== "rome");
  if (goals.length === 0) return [];
  const displaced: {unitId: string; from: SpaceId; to: SpaceId}[] = [];
  for (const unit of standingItalianArmies(G)) {
    if (!unit.space || unit.space === "rome") continue;
    if (goals.includes(unit.space)) continue;
    // 22.4: "If Italy ever has to choose between two spaces, roll a die to
    // determine the space."  A ctx-less caller (tests) keeps the old
    // list-order fallback.
    const preferred = goals.filter(
      (goal) => italyRoomIn(G, goal) && !displaced.some((entry) => entry.to === goal),
    );
    const pool = preferred.length > 0 ? preferred : goals.filter((goal) => italyRoomIn(G, goal));
    const to = pickGoal(pool, ctx);
    if (to === undefined) continue;
    const from = unit.space;
    moveItalianArmy(G, unit, to);
    displaced.push({unitId: unit.id, from, to});
  }
  if (displaced.length > 0) {
    log(G, undefined, "italyLoneDisplacement", {
      spaces: displaced.map((entry) => entry.to).join(","),
      count: displaced.length,
    });
  }
  return displaced;
};

/**
 * 22.4: "During the Italian impulse they will always deploy a reserve army to
 * defend or support (in that order) the goal space(s)."
 *
 * A reserve army is an Italian army counter with no map space (the Minor
 * Power Build Box / reserve holding box).  The first goal with an enemy
 * adjacent (or enemy-held) is the "defend" target; otherwise the first goal
 * with room is the "support" target.  Returns the placed unit, or null.
 */
export const deployItalianReserveForGoal = (
  G: ImperialElegyState,
  war: WarState | null = G.war,
  ctx?: Ctx,
): {unitId: string; to: SpaceId} | null => {
  if (!G.persistent.italyUnified || war === null) return null;
  const side = italyWarSide(war);
  if (side === null) return null;
  const goals = italyWarGoals(war).filter((goal) => goal !== "rome");
  if (goals.length === 0) return null;
  const reserve = Object.values(G.units).find(
    (unit) => unit.owner === "IT" && unit.kind === ITALY_ARMY_KIND && (unit.space === null || unit.space === undefined),
  );
  if (!reserve) return null;
  // 22.4's defend/support order picks among several goal spaces by die when
  // more than one qualifies ("If Italy ever has to choose between two
  // spaces, roll a die to determine the space").
  const threatenedPool = goals.filter((goal) => {
    if (G.spaces[goal]?.occupiedBy !== null && G.spaces[goal]?.occupiedBy !== undefined) return true;
    return neighboursOf(goal).some((next) => {
      const state = G.spaces[next];
      if (!state) return false;
      return state.units.some((id) => {
        const unit = G.units[id];
        return unit !== undefined && !unit.naval && unit.owner !== "IT";
      });
    });
  });
  const pool = threatenedPool.length > 0 ? threatenedPool : goals.filter((goal) => italyRoomIn(G, goal));
  const to = pickGoal(pool, ctx);
  if (to === undefined) return null;
  moveItalianArmy(G, reserve, to);
  log(G, undefined, "italyReserveDeployed", {space: to, defend: threatenedPool.length > 0});
  return {unitId: reserve.id, to};
};

/** Run both 22.4 war-start clauses, in the printed order (displace, then deploy). */
export const applyItalyWarStartRules = (
  G: ImperialElegyState,
  war: WarState | null = G.war,
  ctx?: Ctx,
): void => {
  displaceItalyForLoneDefense(G, war, ctx);
  deployItalianReserveForGoal(G, war, ctx);
};

/** 22.4: one qualifying space by die; falls back to list order without a ctx. */
const pickGoal = <T>(pool: T[], ctx?: Ctx): T | undefined => {
  if (pool.length === 0) return undefined;
  if (pool.length === 1 || !ctx) return pool[0];
  return pool[die(ctx, pool.length) - 1];
};

