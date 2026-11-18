/**
 * Rule 34.4.5 — Free Bot Redeployment (as amended by the March 2026 errata).
 *
 *   "At the beginning of the maneuver step of a war, or the GW, bots receive a
 *   free redeployment action based on their difficulty:
 *     Easy: redeploy 1 army
 *     Normal: redeploy 1/2 of all their armies
 *     Hard: redeploy all armies
 *   Treat this action as if it were taken during peacetime, in other words the
 *   bot's units can only move through spaces they control."
 *
 * The bot PAC does not say where the armies go, and 34.2's standing instruction
 * for anything the PAC leaves open is "roll a die to determine the result".
 * This implementation keeps the engine deterministic (every other bot branch is)
 * by sending the armies toward the nearest enemy along controlled land: each
 * selected army moves to the reachable controlled space with the smallest land
 * distance to an enemy-occupied space, and only when that is a strict
 * improvement over where it stands.
 */

import {Ctx} from "boardgame.io";
import {ImperialElegyState, Power, POWERS, SpaceId} from "../types";
import {connectionBetween, isNavalBox, neighboursOf} from "../constant/spaces";
import {botDifficultyOf, isBotPower} from "../configuration";
import {
  hostileOwner,
  isArmyKind,
  isPower,
  landUnitsIn,
  log,
  movementEndProblem,
} from "./rules";

/** Human names for the printed levels, used in the log line. */
const DIFFICULTY_LABEL: Record<"easy" | "normal" | "hard", string> = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
};

/** 34.1/34.4.5: how many of `armies` the difficulty lets the bot redeploy. */
export const botRedeployCount = (
  difficulty: "easy" | "normal" | "hard",
  armies: number,
): number => {
  if (armies <= 0) return 0;
  if (difficulty === "easy") return 1;
  // "1/2 of all their armies": rounded up, the same way the engine rounds the
  // other "half" quantities (15.2.3's reserve deployment).
  if (difficulty === "normal") return Math.ceil(armies / 2);
  return armies;
};

/** True when the seat is driven by rule 34 in either match mode. */
const isBotSeat = (G: ImperialElegyState, power: Power): boolean =>
  isBotPower(G, power) || G.powers[power]?.flags?.isBot === true;

/** The power's own armies (never an ally's contingent sharing the space). */
const botArmies = (G: ImperialElegyState, power: Power) =>
  Object.values(G.units).filter(
    (unit) =>
      unit.owner === power &&
      unit.steps > 0 &&
      !unit.naval &&
      isArmyKind(unit.kind) &&
      unit.space !== undefined &&
      unit.space !== null,
  );

/**
 * The errata's narrower path rule: every hop, and the destination, must be a
 * land space the bot controls.  This is deliberately stricter than 12.15,
 * which also allows influence in an uncontrolled space.
 */
const controlledLandPath = (
  G: ImperialElegyState,
  power: Power,
  from: SpaceId,
  to: SpaceId,
): boolean => {
  if (from === to) return false;
  if (isNavalBox(from) || isNavalBox(to)) return false;
  const controlled = (id: SpaceId): boolean => G.spaces[id]?.control === power;
  const passable = (id: SpaceId): boolean =>
    controlled(id) &&
    !landUnitsIn(G, id).some((unit) => hostileOwner(G, power, unit.owner));
  if (!passable(to)) return false;
  const seen = new Set<SpaceId>([from]);
  const queue: SpaceId[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of neighboursOf(current)) {
      if (seen.has(next)) continue;
      const connection = connectionBetween(current, next);
      if (!connection || connection.type === "sea") continue;
      seen.add(next);
      if (next === to) return true;
      if (!passable(next)) continue;
      queue.push(next);
    }
  }
  return false;
};

/**
 * Land distance from every space to the nearest space holding a unit hostile to
 * `power`.  Uniform-cost BFS over land connections; naval boxes are never part
 * of the walk, so a bot cannot "redeploy" across water.
 */
const distanceToEnemy = (G: ImperialElegyState, power: Power): Map<SpaceId, number> => {
  const distance = new Map<SpaceId, number>();
  const queue: SpaceId[] = [];
  for (const space of Object.keys(G.spaces)) {
    if (isNavalBox(space)) continue;
    const hostile = landUnitsIn(G, space).some((unit) => hostileOwner(G, power, unit.owner));
    if (hostile) {
      distance.set(space, 0);
      queue.push(space);
    }
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    const from = distance.get(current) ?? 0;
    for (const next of neighboursOf(current)) {
      if (isNavalBox(next) || distance.has(next)) continue;
      const connection = connectionBetween(current, next);
      if (!connection || connection.type === "sea") continue;
      distance.set(next, from + 1);
      queue.push(next);
    }
  }
  return distance;
};

/**
 * The best controlled destination for one army: strictly closer to an enemy
 * than its current space, reachable through controlled land, and able to take
 * the army without overstacking.  Ties break on the space id so the sweep is
 * reproducible across saves.
 */
const botRedeployDestination = (
  G: ImperialElegyState,
  power: Power,
  distance: ReadonlyMap<SpaceId, number>,
  unitId: string,
): SpaceId | null => {
  const unit = G.units[unitId];
  if (!unit?.space) return null;
  const from = unit.space;
  const current = distance.get(from);
  if (current === undefined) return null;
  let best: {space: SpaceId; distance: number} | null = null;
  for (const space of Object.keys(G.spaces).sort()) {
    if (space === from || isNavalBox(space)) continue;
    const to = distance.get(space);
    if (to === undefined || to >= current) continue;
    if (!controlledLandPath(G, power, from, space)) continue;
    if (movementEndProblem(G, space, [unit]) !== null) continue;
    if (best === null || to < best.distance) best = {space, distance: to};
  }
  return best?.space ?? null;
};

/**
 * Run 34.4.5 for one maneuver-step start.  Returns the number of armies moved.
 *
 * `stamp` identifies the step (the war, or the GW turn) so a repeated phase
 * hook cannot grant the redeployment twice.  The caller passes the phase's own
 * identity, and the guard lives on `G.flags`.
 */
export const botFreeRedeployment = (
  G: ImperialElegyState,
  ctx: Ctx | undefined,
  powers: readonly Power[],
  stamp: string,
): number => {
  const flag = `botRedeploy:${stamp}`;
  if (G.flags[`${flag}Done`] === true) return 0;
  G.flags[`${flag}Done`] = true;
  let moved = 0;
  const difficulty = botDifficultyOf(G);
  for (const power of POWERS) {
    if (!powers.includes(power) || G.powers[power]?.eliminated) continue;
    if (!isBotSeat(G, power)) continue;
    const armies = botArmies(G, power);
    const count = botRedeployCount(difficulty, armies.length);
    if (count <= 0) continue;
    const distance = distanceToEnemy(G, power);
    // Closest-first: the armies already nearest the front are the ones a
    // redeployment helps most, and the order keeps the result deterministic.
    const ordered = [...armies].sort((a, b) => {
      const da = distance.get(a.space as SpaceId) ?? Number.MAX_SAFE_INTEGER;
      const db = distance.get(b.space as SpaceId) ?? Number.MAX_SAFE_INTEGER;
      return da - db || a.id.localeCompare(b.id);
    });
    let used = 0;
    for (const unit of ordered) {
      if (used >= count) break;
      const from = unit.space as SpaceId;
      const to = botRedeployDestination(G, power, distance, unit.id);
      if (to === null) continue;
      // Move through the engine's own space bookkeeping so occupation and the
      // space `units` lists stay in step.
      G.spaces[from].units = G.spaces[from].units.filter((id) => id !== unit.id);
      G.spaces[to].units.push(unit.id);
      unit.space = to;
      used += 1;
      moved += 1;
    }
    if (used > 0) {
      log(G, power, "botFreeRedeploy", {
        difficulty: DIFFICULTY_LABEL[difficulty],
        armies: armies.length,
        count: used,
      });
    } else if (count > 0) {
      // Nothing improved: record that the entitlement was used and had no
      // legal move, so the status document can tell "no move" from "not run".
      log(G, power, "botFreeRedeploy", {
        difficulty: DIFFICULTY_LABEL[difficulty],
        armies: armies.length,
        count: 0,
      });
    }
  }
  return moved;
};

/** Rule 34.4.5's bot participants in a limited war. */
export const warBotPowers = (G: ImperialElegyState): Power[] => {
  const war = G.war;
  if (!war) return [];
  const out: Power[] = [];
  const all = [
    war.attacker,
    ...war.attackerAllies,
    war.defender,
    ...war.defenderAllies,
  ];
  for (const power of all) {
    if (isPower(power) && !out.includes(power)) out.push(power);
  }
  return out;
};

/** Rule 34.4.5's bot participants in the Great War. */
export const gwBotPowers = (G: ImperialElegyState): Power[] => {
  if (!G.gw) return [];
  return [...new Set([...G.gw.te, ...G.gw.ta])].filter((power) => isPower(power));
};
