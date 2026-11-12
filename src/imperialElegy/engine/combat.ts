import {Ctx} from "boardgame.io";
import {BattleState, ImperialElegyState, NavalTransitState, PendingDecision, Power, POWERS, SpaceId, Unit} from "../types";
import {SPACES, connectionsOf, isNavalBox, neighboursOf, portBoxes, spaceLabel} from "../constant/spaces";
import {POWER_DEFS} from "../constant/powers";
import {endlessSpaceSupport, landBattleModifier} from "./characteristics";
import {
  allied,
  atWar,
  brokenLoc,
  die,
  friendlySpace,
  gwAllyImpulseFor,
  hostileOwner,
  isArmyKind,
  isEliteKind,
  isNavalKind,
  isPower,
  isMinorPowerOwner,
  landStackingLimit,
  landUnitsIn,
  log,
  minorBrokenLoc,
  minorUpkeepPower,
  movementEndProblem,
  navalUnitsIn,
  spaceHostileTo,
  PORT_NAVAL_LIMIT,
  unitById,
  unitsIn,
  recordOccupation,
  recomputeTracks,
  refreshPowerProjection,
  changeStability,
  resolveCapitalSurrenders,
} from "./rules";
import {decision, openDecision, option} from "./pending";
import {
  crossesHostileGibraltar,
  isEuropeanWaterNavalSpace,
  openNavalContinuationDecision,
  planNavalMove,
} from "./navalMovement";
import {CARD_BY_ID, cardById, discardCard, drawCards} from "./deck";
import {damageUnit, removeUnit} from "./effects";
import {applyGwMajorDecisiveDefeat, forceLeader, forceLeaderFromOwners, syncItalianHomeKeys} from "./gwMajors";
import {
  COMBAT_CARD_BY_ID,
  a043DiscardCostCards,
  applyCombatCardModeToBattle,
  applyCombatCardToBattle,
  availableCombatCardModes,
  availableCombatCards,
  canPlayA043FromDiscard,
  combatCardModes,
  isCombatCardId,
  placeGwCombatCardFaceDown,
  removeGwCombatCardInFront,
  supportDenySpaces,
} from "./combatCards";
import type {CombatCardMode} from "./combatCards";
import {applyGwKeyCapture, checkGwVictory, keyHolder} from "./greatWar";

export {supportDenySpaces} from "./combatCards";

/** 28.1.1 trench-battle marker statuses. */
export type TrenchStatus = "attacker" | "deadlock" | "defender";

/**
 * Rule 28.1.1: "If either the Attacker or Defender force the other to retreat
 * by launching a successful attack, the status is shifted in favor of their
 * side.  An unsuccessful attack does not alter the status ... A Deadlock occurs
 * when the power/s who had the advantage are forced to retreat."
 *
 * So a side that already holds the advantage keeps it by winning; the other
 * side's win shifts the marker to them, except that forcing the advantaged
 * side to retreat produces a deadlock instead.
 */
export const nextTrenchStatus = (
  current: TrenchStatus,
  winner: "attacker" | "defender",
): TrenchStatus => {
  if (winner === "attacker") return current === "defender" ? "deadlock" : "attacker";
  return current === "attacker" ? "deadlock" : "defender";
};

/** Place / update the 28.1.1 trench battle marker on a space. */
export const setTrenchBattleMarker = (
  G: ImperialElegyState,
  space: SpaceId,
  status: TrenchStatus,
  turn: number,
): void => {
  if (!G.spaces[space]) return;
  G.spaces[space].trench = {status, turn};
  G.spaces[space].trenchLine = true;
  if (G.gw) G.gw.trenches[space] = status;
};

/** Remove a trench battle marker (the 28.1.1 terrain remains). */
export const clearTrenchBattleMarker = (G: ImperialElegyState, space: SpaceId): void => {
  if (!G.spaces[space]) return;
  G.spaces[space].trench = null;
  if (G.gw) delete G.gw.trenches[space];
};

/**
 * 28.1.5: "When a side completely vacates a trench battle space, the trench
 * battle marker is removed and the opposing player immediately occupies (or
 * retains control of) the space."  A trench battle exists only while two
 * hostile forces share the space.  Returns true when the marker was removed.
 */
export const pruneTrenchBattle = (G: ImperialElegyState, space: SpaceId): boolean => {
  const state = G.spaces[space];
  if (!state || !state.trench) return false;
  // Map every unit to the side it fights for: player units to their power,
  // minor units to their controlling ally (or to their own minor power).
  const sides = [...new Set(
    landUnitsIn(G, space)
      .filter((unit) => unit.steps > 0)
      .map((unit) => {
        if (isPower(unit.owner)) return unit.owner as string;
        if (isPower(state.ally)) return String(state.ally);
        return `minor:${unit.owner}`;
      }),
  )];
  const playerSides = sides.filter((side): side is Power => isPower(side));
  let contested = false;
  if (playerSides.length >= 2) {
    contested = playerSides.some((power) => atWar(G, playerSides[0], power));
  } else if (playerSides.length === 1) {
    contested = sides.length > 1;
  } else {
    contested = sides.length >= 2;
  }
  if (contested) return false;
  clearTrenchBattleMarker(G, space);
  if (playerSides.length === 1) state.occupiedBy = playerSides[0];
  log(G, playerSides[0], "trenchBattleLifted", {space});
  return true;
};

export interface CrtResult {
  attackerLosses: number;
  defenderLosses: number;
  victor: "attacker" | "defender";
  decisive: boolean;
  star: boolean;
  doubleStar: boolean;
}

/** Combat Results Table (18.4). */
export const crt = (differential: number): CrtResult => {
  if (differential >= 4) return {attackerLosses: 0, defenderLosses: 2, victor: "attacker", decisive: true, star: true, doubleStar: false};
  if (differential === 3) return {attackerLosses: 1, defenderLosses: 2, victor: "attacker", decisive: false, star: true, doubleStar: false};
  if (differential === 2) return {attackerLosses: 1, defenderLosses: 1, victor: "attacker", decisive: false, star: true, doubleStar: false};
  if (differential >= 0) return {attackerLosses: 1, defenderLosses: 1, victor: "attacker", decisive: false, star: false, doubleStar: true};
  if (differential === -1) return {attackerLosses: 1, defenderLosses: 1, victor: "defender", decisive: false, star: false, doubleStar: true};
  if (differential === -2) return {attackerLosses: 1, defenderLosses: 1, victor: "defender", decisive: false, star: true, doubleStar: false};
  if (differential === -3) return {attackerLosses: 2, defenderLosses: 1, victor: "defender", decisive: false, star: true, doubleStar: false};
  return {attackerLosses: 2, defenderLosses: 0, victor: "defender", decisive: true, star: true, doubleStar: false};
};

export const unitFp = (u: Unit, opponentHasDreadnought = false, versusEf = false): number => {
  if (u.kind === "army" || u.kind === "reserveArmy" || u.kind === "minorArmy" || u.kind === "italianArmy" || u.kind === "usArmy") {
    return u.steps >= 2 ? 2 : 1;
  }
  if (u.kind === "rebelArmy") return u.steps >= 2 ? 2 : 1;
  if (u.kind === "eliteCorps" || u.kind === "zouave" || u.kind === "eliteColonialEf") return 0;
  if (u.kind === "expeditionary") return versusEf ? 2 : 0;
  if (u.kind === "squadron") {
    const base = u.steps >= 2 ? 2 : 1;
    return opponentHasDreadnought ? Math.floor(base / 2) : base;
  }
  if (u.kind === "dreadnought") return u.steps >= 2 ? 3 : 2;
  return 0;
};

const isReducedOnly = (units: Unit[]): boolean =>
  units.filter((u) => isArmyKind(u.kind) || isNavalKind(u.kind)).every((u) => u.steps <= 1);

const stabilityDrm = (G: ImperialElegyState, power: Power): number => {
  const p = G.powers[power];
  const def = POWER_DEFS[power];
  if (!p || !def) return 0;
  const table = def.stability;
  const effect = table[Math.max(0, Math.min(table.length - 1, p.stability))];
  return effect?.bm ?? 0;
};

/**
 * 27.5: "if a player's manpower reaches zero it becomes exhausted.  A player
 * with exhausted manpower ... receives a permanent -1 modifier for both land
 * and naval battles for the rest of the GW."  The GW-only guard keeps the
 * pre-war games (which have no manpower exhaustion clause) unaffected.
 */
export const manpowerExhausted = (G: ImperialElegyState, power: Power): boolean =>
  G.gw?.active === true && isPower(power) && (G.powers[power]?.manpower ?? 0) <= 0;

/**
 * The player who controls the defending side of a battle, or null for a minor
 * defending alone.  A player main defender, a player-controlled space and a
 * minor's controlling ally all count; the attacker is never a defender.
 */
export const defenderSupportPower = (
  G: ImperialElegyState,
  battle: BattleState,
): Power | null => {
  // `beginLandBattle`/`beginNavalBattle` set the real main defender (a player
  // unit owner or a minor's controlling ally).  Trust it first: scanning the
  // space for any player unit would also pick up a neutral/allied bystander
  // that is not part of the main defense force.
  if (battle.defender !== battle.attacker) return battle.defender;
  const state = G.spaces[battle.to];
  if (!state) return null;
  if (isPower(state.control)) return state.control === battle.attacker ? null : state.control;
  if (isPower(state.ally)) return state.ally === battle.attacker ? null : state.ally;
  return null;
};

/** A defending side that has a player (or controlling ally) making choices. */
export const defenderHasPlayer = (G: ImperialElegyState, battle: BattleState): boolean =>
  defenderSupportPower(G, battle) !== null;

/**
 * A unit may support a side only when it belongs to that side.  For a
 * minor-held space the defender side is the minor (or its controlling ally),
 * never the attacker: the previous blanket filter admitted every player unit,
 * which leaked the attacker's own units into the defender's support list.
 */
const unitCanSupportSide = (
  G: ImperialElegyState,
  battle: BattleState,
  side: "attacker" | "defender",
  space: SpaceId,
  unit: Unit,
): boolean => {
  const leader = side === "attacker" ? battle.attacker : defenderSupportPower(G, battle);
  if (isPower(unit.owner)) {
    if (side === "attacker") {
      return unit.owner === battle.attacker || allied(G, unit.owner, battle.attacker);
    }
    if (leader === null || unit.owner === battle.attacker) return false;
    return unit.owner === leader || allied(G, unit.owner, leader);
  }
  const controller = G.spaces[space]?.ally ?? null;
  if (side === "attacker") return controller === battle.attacker;
  if (leader === null) {
    // A minor defending alone can only be supported by other non-player units
    // in independent (non-player-controlled) spaces.
    return controller === null;
  }
  // A minor-led defense may be supported by other minor powers' armies; those
  // units are halved unless they belong to the defending minor itself.  A
  // player-led defense only admits minor units controlled by that player.
  if (battle.notes.includes("minorDefender") && controller === null) return true;
  return controller === leader;
};

/**
 * The power (or minor power) whose units count as "the same power" for the
 * half-support rule (18.3.2).  For a minor-led defense this is the DEFENDING
 * MINOR, not the player controlling it: the controller's own armies and every
 * other minor's armies are a different power and therefore halved.
 */
const supportLeader = (
  G: ImperialElegyState,
  battle: BattleState,
  side: "attacker" | "defender",
): string | null => {
  if (side === "attacker") return battle.attacker;
  if (battle.notes.includes("minorDefender")) {
    const control = G.spaces[battle.to]?.control;
    if (control && !isPower(control)) return control;
    const minor = battle.mainDefense
      .map((id) => unitById(G, id))
      .find((unit): unit is Unit => Boolean(unit) && !isPower(unit!.owner));
    if (minor) return minor.owner;
  }
  return battle.defender;
};

/** One side's committed support spaces (maximum two, never a duplicate). */
export const committedSupport = (
  battle: BattleState,
  side: "attacker" | "defender",
): {space: SpaceId; units: string[]; fp: number}[] =>
  side === "attacker" ? battle.supportAttack : battle.supportDefense;

export const MAX_SUPPORT_SPACES = 2;

/**
 * 5.6.2 (3): an army with a broken LoC cannot provide support.  Player armies
 * trace as before; 5.6.1/5.6.2 also apply to a non-player (minor) power's
 * armies, which trace to their own home key or to an allied player's supply
 * source.  Rebels, US and Italian units are not minor powers and keep their
 * previous behaviour.
 */
const locBlocksSupport = (G: ImperialElegyState, space: SpaceId, unit: Unit): boolean => {
  if (G.war === null && !G.gw?.active) return false;
  if (isPower(unit.owner)) return brokenLoc(G, unit.owner, space);
  if (isMinorPowerOwner(unit.owner)) return minorBrokenLoc(G, unit.owner, space);
  return false;
};

export const supportCandidates = (G: ImperialElegyState, _power: Power, battle: BattleState, side: "attacker" | "defender"): {space: SpaceId; units: string[]; fp: number}[] => {
  const target = side === "attacker" ? battle.to : battle.from;
  const other = side === "attacker" ? battle.from : battle.to;
  const out: {space: SpaceId; units: string[]; fp: number}[] = [];
  // A062 can deny support from a space for the rest of the battle.
  const denied = new Set(battle.supportDenied ?? []);
  // 18.3.1: supporting armies adjacent to BOTH battle spaces may all support;
  // armies adjacent to only one provide a single army.  Red (`severe`)
  // connections never provide support.
  const leader = supportLeader(G, battle, side);
  // RU Endless Space (33.5): support into or out of a Russian home space is
  // halved.  The characteristic helper owns the from/to space check.
  const endlessSpace = endlessSpaceSupport(G, [battle.from, battle.to]);
  // 19.10.1: in an amphibious assault the attacker's space is the naval box,
  // so only armies adjacent to the defended port can support.
  const supportSource = battle.amphibious && side === "attacker" ? battle.to : side === "attacker" ? battle.from : battle.to;
  for (const adjacent of neighboursOf(supportSource)) {
    if (adjacent === target || adjacent === other) continue;
    if (isNavalBox(adjacent)) continue;
    if (denied.has(adjacent)) continue;
    const units = landUnitsIn(G, adjacent).filter(
      (u) =>
        isArmyKind(u.kind) &&
        // 15.2.3: armies placed by deploy reserves cannot support in the
        // impulse they were placed.
        u.flags?.deployedThisImpulse !== true &&
        // 5.6.2: a broken LoC forbids support.
        !locBlocksSupport(G, adjacent, u) &&
        unitCanSupportSide(G, battle, side, adjacent, u),
    );
    if (units.length === 0) continue;
    // 18.3.1: a supporting space linked only by red/severe connections cannot
    // support at all; a sea link is not a land support route either.
    const landLinks = connectionsOf(adjacent)
      .map((c) => ({to: c.a === adjacent ? c.b : c.a, type: c.type}))
      .filter((link) => link.to === battle.from || link.to === battle.to)
      .filter((link) => link.type !== "sea" && link.type !== "severe");
    if (landLinks.length === 0) continue;
    let adjFrom = landLinks.some((link) => link.to === battle.from);
    let adjTo = landLinks.some((link) => link.to === battle.to);
    if (!adjFrom && !adjTo) continue;
    // GW trench battle (28.1.3): every supporting unit in a trench battle is
    // treated as adjacent to both forces because both occupy the same space.
    const supportingTrench =
      Boolean(G.gw?.active) &&
      !battle.notes.includes("cancelTrenches") &&
      Boolean(G.spaces[adjacent]?.trench);
    if (supportingTrench) {
      adjFrom = true;
      adjTo = true;
    }
    const allowed = battle.amphibious && side === "attacker" ? 1 : adjFrom && adjTo ? units.length : 1;
    // Half support conditions (18.3.2).  Only a space whose usable links are
    // ALL difficult is halved; clear + difficult is explicitly not halved.
    let halved = landLinks.length > 0 && landLinks.every((link) => link.type === "difficult");
    // Different power (or different minor) than the side's leader.
    if (leader !== null && units.some((unit) => unit.owner !== leader)) halved = true;
    if (endlessSpace.halvesSupport) halved = true;
    // Only a supporting space that is itself in a trench battle is halved;
    // merely attacking into a trench space does not halve adjacent support.
    if (supportingTrench) halved = true;
    let fp = units.slice(0, allowed).reduce((sum, u) => sum + unitFp(u), 0);
    if (halved) fp = Math.ceil(fp / 2);
    out.push({space: adjacent, units: units.slice(0, allowed).map((u) => u.id), fp});
  }
  return out;
};

/**
 * Candidates this side may still commit: at most two spaces, and never a space
 * that already supports this battle.  Used both for the decision options and
 * for validating a `chooseSupport` call.
 */
export const availableSupportCandidates = (
  G: ImperialElegyState,
  power: Power,
  battle: BattleState,
  side: "attacker" | "defender",
): {space: SpaceId; units: string[]; fp: number}[] => {
  const committed = committedSupport(battle, side);
  if (committed.length >= MAX_SUPPORT_SPACES) return [];
  const used = new Set(committed.map((entry) => entry.space));
  return supportCandidates(G, power, battle, side).filter((entry) => !used.has(entry.space));
};

const openSupportWindow = (
  G: ImperialElegyState,
  ctx: Ctx,
  battle: BattleState,
  side: "attacker" | "defender",
  power: Power,
): boolean => {
  const candidates = availableSupportCandidates(G, power, battle, side);
  if (candidates.length === 0) return false;
  openDecision(G, ctx, decision(
    "combatSupport",
    power,
    side === "attacker"
      ? "Declare attacking support or pass"
      : "Declare defending support or pass",
    candidates.map((s) => ({id: s.space, label: `${spaceLabel(s.space, "en")} (+${s.fp} FP)`}))
      .concat([{id: "done", label: "No more support"}]),
    {battle: true, supportSide: side},
  ));
  return true;
};

/**
 * Recompute already-committed support FPs after a battle-wide modifier changes
 * (GW-03/GW-04 cancelling trenches).  Support was declared before the card
 * window, so the stored `fp` values include the trench halving that the card
 * has just removed.
 */
export const recomputeBattleSupport = (G: ImperialElegyState, battle: BattleState): void => {
  const unitFpOf = (id: string): number => {
    const unit = unitById(G, id);
    return unit ? unitFp(unit) : 0;
  };
  for (const side of ["attacker", "defender"] as const) {
    const power = side === "attacker"
      ? battle.attacker
      : defenderSupportPower(G, battle) ?? battle.attacker;
    const entries = side === "attacker" ? battle.supportAttack : battle.supportDefense;
    if (entries.length === 0) continue;
    const candidates = supportCandidates(G, power, battle, side);
    for (const entry of entries) {
      const candidate = candidates.find((item) => item.space === entry.space);
      // Restore the full FP of every army that was already allowed to support.
      // The committed `units` remain authoritative for "allowed armies": GW-03
      // cancels the trench restrictions, it does not retroactively reduce a
      // declared support space.
      const ids = entry.units.length > 0 ? entry.units : candidate?.units ?? [];
      const full = ids.reduce((sum, id) => sum + unitFpOf(id), 0);
      if (!candidate) {
        entry.fp = full;
        continue;
      }
      const candidateFull = candidate.units.reduce((sum, id) => sum + unitFpOf(id), 0);
      // The candidate's fp/full ratio carries any remaining half condition
      // (different power, difficult-only link, Endless Space) with the trench
      // halving already removed.
      const ratio = candidateFull > 0 ? candidate.fp / candidateFull : 1;
      entry.fp = Math.ceil(full * ratio);
    }
  }
};

export const beginLandBattle = (
  G: ImperialElegyState,
  ctx: Ctx,
  actor: Power,
  from: SpaceId,
  to: SpaceId,
  amphibious = false,
): BattleState | null => {
  const allyImpulse = gwAllyImpulseFor(G, actor);
  const attackUnits = landUnitsIn(G, from).filter(
    (u) =>
      (u.owner === actor ||
        // 26.3: the controller attacks with US/Italian units during their impulse.
        (allyImpulse !== null && u.owner === allyImpulse) ||
        (!isPower(u.owner) && G.spaces[from].ally === actor)) &&
      // 15.2.3: a unit deployed this impulse cannot attack.
      u.flags?.deployedThisImpulse !== true,
  );
  const defendUnits = landUnitsIn(G, to).filter((u) => hostileOwner(G, actor, u.owner));
  if (attackUnits.length === 0 || (defendUnits.length === 0 && !G.spaces[to].fort)) {
    return null;
  }
  // 28.1.2: "Only units in a given trench battle space can initiate a land
  // battle in that space.  Adjacent armies cannot initiate a battle in trench
  // battle spaces."  So a marker space is attacked only from inside it, and a
  // same-space battle is only legal while the marker is present.
  const trenchMarker = Boolean(G.spaces[to].trench);
  if (trenchMarker && from !== to) return null;
  if (from === to && !trenchMarker) return null;
  // 28.1: trenches exist in every key from GW turn 1.  Only a force with a
  // full-strength army in its main attack force may attack a trench space.
  const trenchTerrain =
    Boolean(G.gw?.active) &&
    (G.spaces[to].trenchLine === true || Boolean(G.spaces[to].trench));
  if (trenchTerrain && !attackUnits.some((u) => isArmyKind(u.kind) && u.steps >= 2)) {
    return null;
  }
  // 5.5.3: an overstacked stack that is attacked contributes FP with at most
  // the space's stacking limit.  The engine keeps the strongest defenders.
  const defenderLimit = landStackingLimit(to);
  const overstackedDefence = defendUnits.length > defenderLimit;
  const defenceCandidates = overstackedDefence
    ? [...defendUnits].sort((a, b) => (b.steps - a.steps) || a.id.localeCompare(b.id)).slice(0, defenderLimit)
    : defendUnits;
  const playerDefender = defenceCandidates.find((u) => isPower(u.owner))?.owner as Power | undefined;
  const controlDefender = isPower(G.spaces[to].control) ? G.spaces[to].control : undefined;
  // A minor's controlling ally defends with the minor (15.4).  The ally is a
  // real player for support/card decisions, so it takes precedence over the
  // `actor` fallback used only for a minor defending completely alone.
  const allyDefender =
    isPower(G.spaces[to].ally) && G.spaces[to].ally !== actor
      ? G.spaces[to].ally
      : undefined;
  const defender = playerDefender ?? controlDefender ?? allyDefender ?? actor;
  // `defender` still falls back to the attacker when no player controls the
  // minor, so the battle has a power for the loss/retreat helpers.  The
  // defender support/card windows are gated on `defenderSupportPower`, not on
  // the presence of this note, so they are never offered to the attacker.
  const defenderMinor = playerDefender === undefined && controlDefender === undefined;
  const battle: BattleState = {
    kind: "land",
    attacker: actor,
    defender,
    from,
    to,
    mainAttack: attackUnits.map((u) => u.id),
    mainDefense: defenceCandidates.map((u) => u.id),
    forceOwners: {attacker: attackUnits.map((u) => u.owner), defender: defenceCandidates.map((u) => u.owner)},
    supportAttack: [],
    supportDefense: [],
    stage: "support",
    supportSide: "attacker",
    attackerDrm: 0,
    defenderDrm: 0,
    attackerLosses: 0,
    defenderLosses: 0,
    decisive: false,
    winner: undefined,
    amphibious,
    trench: trenchTerrain,
    notes: [],
  };
  if (defenderMinor) battle.notes.push("minorDefender");
  if (overstackedDefence) battle.notes.push("overstackedDefence");
  // GW-08/09 Political Pressure: record that this power made a land attack in
  // the current GW turn (the end-of-turn check reads `landAttackTurn`).
  if (G.gw?.active) G.powers[actor].flags.landAttackTurn = G.gw.turn;
  // Modifiers.
  if (amphibious) battle.attackerDrm -= 1;
  const attackerStability = stabilityDrm(G, actor);
  const defenderStability = stabilityDrm(G, defender);
  battle.attackerDrm += attackerStability;
  battle.defenderDrm += defenderStability;
  // 18.2.1: "Manpower exhausted (GW only): -1" is part of the printed land
  // battle modifier list, not only the 19.5 naval one.  Supporting armies never
  // suffer it (the rule applies to units in the main attack/defense), so the
  // side's leader is charged exactly once.
  if (manpowerExhausted(G, actor)) {
    battle.attackerDrm -= 1;
    battle.notes.push("manpowerExhaustedAttacker");
  }
  const landDefenderLeader = defenderSupportPower(G, battle);
  if (landDefenderLeader !== null && manpowerExhausted(G, landDefenderLeader)) {
    battle.defenderDrm -= 1;
    battle.notes.push("manpowerExhaustedDefender");
  }
  if (isReducedOnly(attackUnits)) battle.attackerDrm -= 1;
  if (isReducedOnly(defenceCandidates) && !G.spaces[to].fort) battle.defenderDrm -= 1;
  // National characteristics (1st Army, Indian armies, Zouaves, Prussian
  // Military Tradition): route the helper's DRM by the side it reports.
  const attackerCharacteristic = landBattleModifier(G, actor, battle);
  if (attackerCharacteristic.side === "attacker") battle.attackerDrm += attackerCharacteristic.drm;
  const defenderCharacteristic = landBattleModifier(G, defender, battle);
  if (defenderCharacteristic.side === "defender") battle.defenderDrm += defenderCharacteristic.drm;
  const conn = connectionsOf(from).find((c) => (c.a === from ? c.b : c.a) === to);
  if (conn && (conn.type === "difficult" || conn.type === "severe")) battle.attackerDrm -= 1;
  if (G.flags.warLandDrm && G.war) battle.attackerDrm += Number(G.flags.warLandDrm);
  if (G.flags.combatDrm) battle.attackerDrm += Number(G.flags.combatDrm);
  if (G.flags.enemyLandDrm) battle.defenderDrm += Number(G.flags.enemyLandDrm);
  if (G.flags.gwCombatDrm) battle.attackerDrm += Number(G.flags.gwCombatDrm);
  if (G.persistent.machineGuns) battle.notes.push("machineGuns");
  if (G.persistent.hydraulicRecoil) battle.notes.push("hydraulicRecoil");
  // 18.2.1 / 5.6.2: a force whose armies have a broken LoC suffers -1.  A unit
  // at sea (amphibious assault) is out of the land LoC network and is not
  // charged twice; the amphibious -1 above already models the landing.
  if (G.war !== null || G.gw?.active) {
    // 5.6.2: the force itself suffers -1 when out of supply, and so do the
    // minor armies fighting in it (their own 5.6.1 trace).
    const attackerOutOfSupply =
      (!isNavalBox(from) && brokenLoc(G, actor, from)) ||
      attackUnits.some((u) => isMinorPowerOwner(u.owner) && minorBrokenLoc(G, u.owner, from));
    if (attackerOutOfSupply) {
      battle.attackerDrm -= 1;
      battle.notes.push("brokenLocAttacker");
    }
    const defenderLeader = defenderSupportPower(G, battle);
    const defenderOutOfSupply =
      (defenderLeader !== null && !isNavalBox(to) && brokenLoc(G, defenderLeader, to)) ||
      defenceCandidates.some((u) => isMinorPowerOwner(u.owner) && minorBrokenLoc(G, u.owner, to));
    if (defenderOutOfSupply) {
      battle.defenderDrm -= 1;
      battle.notes.push("brokenLocDefender");
    }
  }
  G.battle = battle;
  battle.supportSide = "attacker";
  if (!openSupportWindow(G, ctx, battle, "attacker", actor)) {
    // No legal attacker support: go straight to the defender's stage.
    chooseSupport(G, ctx, "done");
  }
  return battle;
};

/** The deciding power for a support/card window on `side`, or null. */
const supportDecisionPower = (
  G: ImperialElegyState,
  battle: BattleState,
  side: "attacker" | "defender",
): Power | null => (side === "attacker" ? battle.attacker : defenderSupportPower(G, battle));

export const chooseSupport = (G: ImperialElegyState, ctx: Ctx, spaceOrDone: string): void => {
  const battle = G.battle;
  if (!battle) return;
  // A062's "choose a space that cannot support" uses the same combatSupport
  // pending kind so the generic pending resolver can drive it; the battle flag
  // tells this helper which sub-decision is active.
  if (battle.pendingSupportDeny) {
    chooseSupportDeny(G, ctx, spaceOrDone);
    return;
  }
  // GW-05's "choose which side rerolls" also rides the combatSupport kind.
  if (battle.rerollPending) {
    chooseGwReroll(G, ctx, spaceOrDone);
    return;
  }
  if (battle.stage !== "support") return;
  const side = battle.supportSide;
  const decisionPower = supportDecisionPower(G, battle, side);
  if (spaceOrDone !== "done") {
    const candidates = availableSupportCandidates(
      G,
      side === "attacker" ? battle.attacker : decisionPower ?? battle.attacker,
      battle,
      side,
    );
    const chosen = candidates.find((c) => c.space === spaceOrDone);
    if (!chosen) {
      // Illegal, duplicate or third-space choice: keep the same side's window
      // open instead of silently advancing the battle.
      const power = decisionPower ?? battle.attacker;
      if (!openSupportWindow(G, ctx, battle, side, power)) {
        // Nothing legal remains; continue the sequence.
      } else {
        return;
      }
    } else {
      committedSupport(battle, side).push(chosen);
      // 18.3 allows up to two supporting spaces per side, attacker first; keep
      // the same side's window open while another legal space remains.
      const power = decisionPower ?? battle.attacker;
      if (openSupportWindow(G, ctx, battle, side, power)) return;
    }
  }
  if (side === "attacker") {
    const defenderDecisionPower = defenderSupportPower(G, battle);
    battle.supportSide = "defender";
    // A minor defending alone has no player to make the choice: commit every
    // legal support (or none) and move on, never opening a window to the
    // attacker.  A minor with a controlling ally is represented by that ally
    // and gets the normal window.
    if (defenderDecisionPower !== null) {
      if (openSupportWindow(G, ctx, battle, "defender", defenderDecisionPower)) return;
    } else {
      for (const candidate of availableSupportCandidates(G, battle.attacker, battle, "defender")) {
        battle.supportDefense.push(candidate);
      }
      if (battle.supportDefense.length > 0) battle.notes.push("minorAutoSupport");
    }
  }
  battle.stage = "cards";
  openCombatCardWindow(G, ctx, battle, "attacker");
};

/**
 * A defender-side window is safe only when a player controls the minor (or a
 * normal defender exists).  `battle.defender` may be the attacker fallback, so
 * checking that field alone is not enough.
 */
const hasDefenderPlayer = (G: ImperialElegyState, battle: BattleState): boolean =>
  defenderHasPlayer(G, battle);

/**
 * A played GW card is no longer faceup.  The flag is a public
 * `POWER:cardId,...` string in top-level `G.flags`; drop only this power's
 * entry so other powers' faceup combat cards stay visible.
 */
const clearFaceupCombat = (G: ImperialElegyState, power: Power): void => {
  const raw = G.flags.gwFaceupCombat;
  if (typeof raw !== "string" || raw.length === 0) return;
  G.flags.gwFaceupCombat = raw
    .split(",")
    .filter((entry) => entry.split(":")[0] !== power)
    .join(",");
};

export const openCombatCardWindow = (G: ImperialElegyState, ctx: Ctx, battle: BattleState, side: "attacker" | "defender"): void => {
  battle.cardSide = side;
  const power = side === "attacker" ? battle.attacker : defenderSupportPower(G, battle);
  if (!power || (side === "defender" && power === battle.attacker) || !G.powers[power]) {
    afterCombatCardWindow(G, ctx);
    return;
  }
  // Availability (side, land/naval, GW era, Dreadnoughts, before/after dice)
  // and the printed alternatives are owned by the data-driven helpers; the
  // window only formats one option per playable (card, mode) pair.
  const modes = availableCombatCardModes(G, power, battle);
  // IE-A043 may also be played from the discard pile (special clause); that is
  // a separate source option, not a printed mode of the card.
  const discardA043 = canPlayA043FromDiscard(G, power, battle);
  if (modes.length === 0 && !discardA043) {
    afterCombatCardWindow(G, ctx);
    return;
  }
  const choices = modes.map(({cardId, mode}) => {
    // Only a synthesized single default mode keeps the historical
    // `card:<id>` option id; cards with printed alternatives carry the mode
    // in both the id and the label.
    const singleMode = mode.id === "default" && combatCardModes(COMBAT_CARD_BY_ID[cardId]).length === 1;
    const id = singleMode ? `card:${cardId}` : `card:${cardId}:${mode.id}`;
    return option(id, `Play ${mode.label}`);
  });
  if (discardA043) {
    choices.push(option(
      "card:IE-A043:discard",
      "Play At Any Cost from the discard pile",
      {card: "IE-A043", fromDiscard: true},
    ));
  }
  choices.push(option("done", "Continue"));
  openDecision(G, ctx, decision(
    "combatCard",
    power,
    "Play a combat card or continue",
    choices,
    {battle: true},
  ));
};

/**
 * Open the first post-dice combat-card window (GW-05/GW-06) for `side`, if that
 * side has one.  Returns true when a decision was opened.
 */
const openAfterDiceWindow = (G: ImperialElegyState, ctx: Ctx, battle: BattleState, side: "attacker" | "defender"): boolean => {
  const power = side === "attacker" ? battle.attacker : defenderSupportPower(G, battle);
  if (!power || (side === "defender" && power === battle.attacker)) return false;
  if (!G.powers[power]) return false;
  if (availableCombatCards(G, power, battle).length === 0) return false;
  openCombatCardWindow(G, ctx, battle, side);
  return true;
};

/** Open A062's explicit "choose a space that cannot support" decision. */
export const openSupportDenyDecision = (
  G: ImperialElegyState,
  ctx: Ctx,
  battle: BattleState,
  power: Power,
): boolean => {
  const spaces = supportDenySpaces(G, battle).filter(
    (space) => !(battle.supportDenied ?? []).includes(space),
  );
  if (spaces.length === 0) return false;
  battle.pendingSupportDeny = true;
  openDecision(G, ctx, decision(
    "combatSupport",
    power,
    "Miscommunication: choose a space that cannot provide support",
    spaces.map((space) => option(space, spaceLabel(space, "en"))),
    {battle: true, supportDeny: true, promptKind: "miscommunication"},
  ));
  return true;
};

/** Resolve A062's denied space and continue the battle card sequence once. */
export const chooseSupportDeny = (G: ImperialElegyState, ctx: Ctx, space: SpaceId): void => {
  const battle = G.battle;
  if (!battle || !battle.pendingSupportDeny) return;
  if (!supportDenySpaces(G, battle).includes(space)) {
    // A062's choice is mandatory: a decline must not silently pick the first
    // offered space.  Reopen the decision if the pending wrapper cleared it.
    if (G.pending === null) {
      const power = battle.cardSide === "defender"
        ? defenderSupportPower(G, battle) ?? battle.attacker
        : battle.attacker;
      openSupportDenyDecision(G, ctx, battle, power);
    }
    return;
  }
  battle.supportDenied = [...new Set([...(battle.supportDenied ?? []), space])];
  // If support was already declared (the normal engine order is support then
  // cards), the denied space loses that support too.
  battle.supportAttack = battle.supportAttack.filter((entry) => entry.space !== space);
  battle.supportDefense = battle.supportDefense.filter((entry) => entry.space !== space);
  // A recorded BDRM total must drop the denied FP as well.  Normally the card
  // resolves before the dice, so this is a no-op, but it keeps the invariant
  // true for direct/test callers.
  refreshBattleDrmTotals(G, battle);
  battle.pendingSupportDeny = false;
  if (G.pending?.context?.supportDeny === true) G.pending = null;
  log(G, battle.cardSide === "defender" ? battle.defender : battle.attacker, "supportDenied", {
    space,
    battle: battle.to,
  });
  afterCombatCardWindow(G, ctx);
};

const openGwRerollChoice = (
  G: ImperialElegyState,
  ctx: Ctx,
  battle: BattleState,
  power: Power,
): void => {
  battle.rerollPending = true;
  const defender = defenderSupportPower(G, battle) ?? battle.defender;
  openDecision(G, ctx, decision(
    "combatSupport",
    power,
    "Choose which side rerolls its battle die",
    [
      option("attacker", `Attacker (${battle.attacker}) rerolls`),
      option("defender", `Defender (${defender}) rerolls`),
    ],
    {battle: true, gwReroll: true},
  ));
};

/** Current FP totals for each side, including fort FP and committed support. */
const battleFpTotals = (
  G: ImperialElegyState,
  battle: BattleState,
): {attackFp: number; defenceFp: number} => {
  const attackFp = battle.mainAttack.reduce((sum, id) => {
    const u = unitById(G, id);
    return sum + (u ? unitFp(u) : 0);
  }, 0) + battle.supportAttack.reduce((sum, s) => sum + s.fp, 0);
  const attackHasDreadnought = battle.mainAttack.some((id) => unitById(G, id)?.kind === "dreadnought");
  const defenceFp = battle.mainDefense.reduce((sum, id) => {
    const u = unitById(G, id);
    return sum + (u ? unitFp(u, attackHasDreadnought) : 0);
  }, 0)
    + battle.supportDefense.reduce((sum, s) => sum + s.fp, 0)
    + (G.spaces[battle.to].fort?.level ?? 0);
  return {attackFp, defenceFp};
};

/** Re-derive the recorded BDRM totals after support changes (A062). */
const refreshBattleDrmTotals = (G: ImperialElegyState, battle: BattleState): void => {
  if (battle.attackDrmTotal === undefined && battle.defenceDrmTotal === undefined) return;
  const {attackFp, defenceFp} = battleFpTotals(G, battle);
  battle.attackDrmTotal = battle.attackerDrm + Math.max(0, attackFp - defenceFp);
  battle.defenceDrmTotal = battle.defenderDrm + Math.max(0, defenceFp - attackFp);
};

/** "The majority (more than half)" of `n` losses is `floor(n/2) + 1`. */
const majorityOf = (losses: number): number => (losses <= 0 ? 0 : Math.floor(losses / 2) + 1);

/** Dreadnought steps still present in a main force (19.4/19.6 availability). */
const dreadnoughtStepsIn = (G: ImperialElegyState, ids: readonly string[]): number =>
  ids.reduce((sum, id) => {
    const unit = unitById(G, id);
    return sum + (unit && unit.kind === "dreadnought" && unit.steps > 0 ? unit.steps : 0);
  }, 0);

/**
 * 19.4/19.6: fix the dreadnought-loss quota once the battle losses are known.
 *
 * "Dreadnought Losses: the majority (more than half) of step losses from mines
 * must be taken by dreadnoughts if any are present" (19.4) and "the majority
 * (more than half) of step losses in naval battles must be taken by
 * dreadnoughts if any are present" (19.6).  Mine hits are part of the
 * attacker's loss total, so the quota is the larger of the two printed
 * majorities, capped by the dreadnought steps actually available.  The
 * allocation helpers then restrict the owner's choice until it is met.
 */
const recordDreadnoughtRequirement = (G: ImperialElegyState, battle: BattleState): void => {
  if (battle.kind !== "naval") return;
  const mines = Math.max(0, battle.mines ?? 0);
  const battleLosses = Math.max(0, battle.attackerLosses - mines);
  battle.dreadnoughtRequired = {
    attacker: Math.min(
      dreadnoughtStepsIn(G, battle.mainAttack),
      Math.max(majorityOf(battleLosses), majorityOf(mines)),
    ),
    defender: Math.min(
      dreadnoughtStepsIn(G, battle.mainDefense),
      majorityOf(battle.defenderLosses),
    ),
  };
  if (battle.dreadnoughtLosses === undefined) battle.dreadnoughtLosses = {attacker: 0, defender: 0};
};

/** Dreadnought steps this side still owes before other units may take losses. */
const dreadnoughtQuotaRemaining = (battle: BattleState, side: "attacker" | "defender"): number => {
  if (battle.kind !== "naval" || battle.dreadnoughtRequired === undefined) return 0;
  const required = battle.dreadnoughtRequired[side] ?? 0;
  const taken = battle.dreadnoughtLosses?.[side] ?? 0;
  return Math.max(0, required - taken);
};

/**
 * 19.4/19.6: while a side still owes dreadnought step losses, only its
 * dreadnoughts may take the next loss.  Once the quota is met the normal 18.6
 * candidate order (player units first) governs the remainder.
 */
const withDreadnoughtPriority = (
  battle: BattleState,
  side: "attacker" | "defender",
  candidates: Unit[],
): Unit[] => {
  if (dreadnoughtQuotaRemaining(battle, side) <= 0) return candidates;
  const dreadnoughts = candidates.filter((unit) => unit.kind === "dreadnought");
  return dreadnoughts.length > 0 ? dreadnoughts : candidates;
};

/** Record the CRT result from the two recorded dice and the resolved BDRMs. */
const recomputeBattleResult = (G: ImperialElegyState, battle: BattleState): void => {
  const a = battle.attackerRoll ?? 1;
  const d = battle.defenderRoll ?? 1;
  const attackDrm = battle.attackDrmTotal ?? battle.attackerDrm;
  const defenceDrm = battle.defenceDrmTotal ?? battle.defenderDrm;
  const differential = a + attackDrm - (d + defenceDrm);
  battle.diff = differential;
  const result = crt(differential);
  let attackerLosses = result.attackerLosses;
  let defenderLosses = result.defenderLosses;
  // 18.8: decisive naval battles double only the losing side's CRT losses.
  if (result.decisive && battle.kind === "naval") {
    if (result.victor === "attacker") defenderLosses *= 2;
    else attackerLosses *= 2;
  }
  // 19.4: mine hits are added after the decisive doubling (and never trigger
  // the trench penalty), exactly as in `rollBattleDice`.  Adding them before
  // the doubling made a GW-05 reroll double the mine hits.
  attackerLosses += battle.trench ? 1 : 0;
  if (!battle.notes.includes("noMines")) attackerLosses += Math.max(0, battle.mines ?? 0);
  battle.attackerLosses = attackerLosses;
  battle.defenderLosses = defenderLosses;
  battle.decisive = result.decisive;
  battle.winner = result.victor;
  recordDreadnoughtRequirement(G, battle);
};

/**
 * GW-05 "Capable Commander": reroll one battle die, recompute the differential
 * and CRT losses from the recorded dice/BDRMs, then resume the battle once.
 */
export const chooseGwReroll = (
  G: ImperialElegyState,
  ctx: Ctx,
  side: "attacker" | "defender" | string,
): void => {
  const battle = G.battle;
  if (!battle || !battle.rerollPending) return;
  if (side !== "attacker" && side !== "defender") {
    // GW-05 forces a side choice; declining must not auto-pick attacker.
    if (G.pending === null) {
      const power = battle.cardSide === "defender"
        ? defenderSupportPower(G, battle) ?? battle.attacker
        : battle.attacker;
      openGwRerollChoice(G, ctx, battle, power);
    }
    return;
  }
  let roll = die(ctx, 6);
  if (G.persistent.machineGuns === true) roll = Math.max(3, roll);
  if (side === "attacker") battle.attackerRoll = roll;
  else battle.defenderRoll = roll;
  battle.rerollPending = false;
  battle.rerollUsed = true;
  if (!battle.notes.includes("gwReroll")) battle.notes.push("gwReroll");
  recomputeBattleResult(G, battle);
  log(G, battle.attacker, "battleReroll", {
    side,
    attackerRoll: battle.attackerRoll,
    defenderRoll: battle.defenderRoll,
    differential: battle.diff,
    attackerLosses: battle.attackerLosses,
    defenderLosses: battle.defenderLosses,
  });
  if (G.pending?.context?.gwReroll === true) G.pending = null;
  afterCombatCardWindow(G, ctx);
};

export const afterCombatCardWindow = (G: ImperialElegyState, ctx: Ctx): void => {
  const battle = G.battle;
  if (!battle) return;
  // GW-05/GW-06 are printed "after dice"; resolveBattleRoll opens their window
  // while the battle is already at the losses stage.
  if (battle.stage === "lossesAttack" && battle.attackerRoll !== undefined) {
    const completed = battle.cardSide;
    battle.cardSide = undefined;
    if (completed === "attacker" && openAfterDiceWindow(G, ctx, battle, "defender")) return;
    applyLosses(G, ctx, "attacker");
    return;
  }
  if (battle.cardSide === "attacker") {
    openCombatCardWindow(G, ctx, battle, "defender");
    return;
  }
  battle.stage = "roll";
  resolveBattleRoll(G, ctx);
};

export const playCombatCard = (G: ImperialElegyState, ctx: Ctx, selection: string): void => {
  const battle = G.battle;
  const pending = G.pending;
  if (!battle || !pending || pending.kind !== "combatCard") return;
  // moves.ts strips only the `card:` prefix, so an offered mode arrives as
  // `<cardId>:<modeId>`.  Card ids never contain a colon.
  const separator = selection.indexOf(":");
  const cardId = separator === -1 ? selection : selection.slice(0, separator);
  const modeId = separator === -1 ? undefined : selection.slice(separator + 1);
  if (!isCombatCardId(cardId)) return;
  const def = COMBAT_CARD_BY_ID[cardId];
  const side = battle.cardSide ?? "attacker";
  const power = side === "attacker"
    ? battle.attacker
    : defenderSupportPower(G, battle) ?? battle.defender;
  // IE-A043's special discard-pile play.  It is not a printed mode: reserve
  // the choice of which hand card to discard, then resolve after that choice.
  if (modeId === "discard") {
    if (cardId !== "IE-A043") return;
    if (power !== "GE" || !canPlayA043FromDiscard(G, power, battle)) return;
    const costs = a043DiscardCostCards(G, power);
    if (costs.length === 0) return;
    G.pending = null;
    openDecision(G, ctx, decision(
      "combatDiscard",
      power,
      "At Any Cost: discard a card to play it from the discard pile",
      costs.map((id) => {
        const cost = cardById(id);
        return option(id, cost.title, {card: id});
      }),
      {battle: true, playCard: "IE-A043"},
    ));
    return;
  }
  let mode: CombatCardMode | undefined;
  if (modeId !== undefined) {
    // Only a mode this power is currently offered may be played.  Validate the
    // pair against the same helper that built the window, then resolve the
    // canonical mode object from the card definition.
    const offered = availableCombatCardModes(G, power, battle).some(
      (entry) => entry.cardId === cardId && entry.mode.id === modeId,
    );
    if (!offered) return;
    mode = combatCardModes(def).find((entry) => entry.id === modeId);
    if (!mode) return;
  } else if (!availableCombatCards(G, power, battle).includes(cardId)) {
    // A bare card id stays valid (legacy callers and single-mode cards), but it
    // must still be offered for this side, battle kind, era and timing.
    return;
  }
  const card = CARD_BY_ID[cardId];
  const cardHolder = G.powers[power];
  if (def.source === "greatWar") {
    // GW cards are played from the GW slot or from the faceup cards in front
    // of the power, never from the hand.
    if (cardHolder && cardHolder.gwCard === cardId) cardHolder.gwCard = null;
    else removeGwCombatCardInFront(G, power, cardId);
    clearFaceupCombat(G, power);
  } else {
    cardHolder.hand = cardHolder.hand.filter((id) => id !== cardId);
  }
  // GW-03/GW-04 are never discarded: after the battle they go facedown in
  // front of the opponent (26.1), handled by `finishBattle`.  Every other GW
  // combat card (GW-05/GW-06) goes to the GW discard pile, NEVER the action
  // discard: that pile is reshuffled into the action deck.
  const faceDownAfterBattle = cardId === "IE-GW-03" || cardId === "IE-GW-04";
  if (card?.remove) G.removed.push(cardId);
  else if (def.source === "greatWar") {
    if (!faceDownAfterBattle) {
      G.gw!.discard = [...(G.gw!.discard ?? []), cardId];
    }
  } else if (!faceDownAfterBattle) {
    G.discard.push(cardId);
  }
  // Apply the selected printed mode to a copy, then make it the live battle.
  // The helper reads `battle.cardSide` for the DRM target and `G.gw.turn` for
  // the GW-03/GW-04 trench clause.  A bare card id keeps the combined legacy
  // effect (notably IE-A061's printed +2 and no-mines clauses together).
  const next = mode
    ? applyCombatCardModeToBattle(battle, def, mode, G.gw?.turn ?? 0)
    : applyCombatCardToBattle(battle, def, G.gw?.turn ?? 0);
  if (faceDownAfterBattle) {
    const opponent = side === "attacker"
      ? defenderSupportPower(G, battle) ?? battle.defender
      : battle.attacker;
    next.faceDownCards = [...(next.faceDownCards ?? []), {cardId, holder: opponent}];
  }
  // The A058/A059/A062 and A043 "draw an additional card at the end of the
  // battle" clause is queued once, when the card resolves.  A043's discard-pile
  // play explicitly does NOT draw (handled in `resolveCombatDiscard`).
  if (cardId === "IE-A043" || cardId === "IE-A058" || cardId === "IE-A059" || cardId === "IE-A062") {
    next.extraDraws = [...(next.extraDraws ?? []), power];
  }
  G.battle = next;
  // Fort reduction (A058) and the pre-dice step loss (A059) take effect before
  // any dice are rolled.  `resolveBattleRoll` calls this again defensively;
  // the applied notes make it idempotent.
  applyPreDiceCardEffects(G, next, ctx);
  // GW-03/GW-04 cancelled the trench after support was declared: recompute the
  // stored support FPs without the trench halving.
  if (next.notes.includes("cancelTrenches")) recomputeBattleSupport(G, next);
  log(G, power, "combatCardPlayed", {card: cardId, space: next.to});
  G.pending = null;
  if (cardId === "IE-A062" && openSupportDenyDecision(G, ctx, next, power)) return;
  if (cardId === "IE-GW-05") {
    openGwRerollChoice(G, ctx, next, power);
    return;
  }
  afterCombatCardWindow(G, ctx);
  maybeOpenDecisiveFollowUp(G, ctx);
};

/**
 * Resolve IE-A043's discard-pile special after its controller chose the card
 * to discard.  The discarded card pays the cost; the A043 stays in the discard
 * pile (it was played from there), gives its +1 and, per the printed special,
 * does NOT draw an additional card.
 */
export const resolveCombatDiscard = (G: ImperialElegyState, ctx: Ctx, cardId: string): boolean => {
  const pending = G.pending;
  if (!pending || pending.kind !== "combatDiscard") return false;
  const battle = G.battle;
  if (!battle) {
    G.pending = null;
    return false;
  }
  const power = pending.power;
  if (pending.context?.playCard !== "IE-A043") return false;
  if (!a043DiscardCostCards(G, power).includes(cardId)) return false;
  discardCard(G, power, cardId, "atAnyCostDiscard");
  const def = COMBAT_CARD_BY_ID["IE-A043"];
  const next = applyCombatCardToBattle(battle, def, G.gw?.turn ?? 0);
  G.battle = next;
  log(G, power, "combatCardPlayed", {
    card: "IE-A043",
    space: next.to,
    fromDiscard: true,
    discarded: cardId,
  });
  G.pending = null;
  applyPreDiceCardEffects(G, next, ctx);
  afterCombatCardWindow(G, ctx);
  maybeOpenDecisiveFollowUp(G, ctx);
  return true;
};

export const resolveBattleRoll = (G: ImperialElegyState, ctx: Ctx): void => {
  const battle = G.battle;
  if (!battle) return;
  // A058's fort reduction and A059's step loss happen before the dice.  They
  // are normally applied when the card resolves; this is the idempotent
  // fallback for direct/test callers that only set the battle note.
  applyPreDiceCardEffects(G, battle, ctx);
  // A058/A059 can win the battle before any die is rolled.
  if (G.battle !== battle) return;
  // 19.3: "Follow these steps to resolve a naval battle 1. Check for Mines!"
  // The 19.4 mine dice come first, before the BDRM and the battle dice.
  rollMines(G, ctx, battle);
  // 19.4: "after suffering the first two hits the attacker may ignore any
  // remaining hits if they choose to immediately retreat."  The choice is
  // offered as soon as the mine dice are known, so a retreat consumes no
  // battle dice at all.  A caller that cannot open decisions (or an attacker
  // with no retreat route) keeps the deterministic full-hit resolution.
  if (openMineRetreatDecision(G, ctx, battle)) {
    battle.stage = "roll";
    return;
  }
  rollBattleDice(G, ctx, battle);
};

/**
 * 19.3 step 1 / 19.4: roll the defending port's mines.  Every port key has a
 * minefield; the defender rolls one die per current game turn and each 4+
 * inflicts one hit on the attacker.  `noMines` (IE-A061/IE-A066) cancels the
 * roll before any die is consumed.  `minesRolled` makes the step idempotent for
 * callers that re-enter the battle (for example after a reload).
 */
const rollMines = (G: ImperialElegyState, ctx: Ctx, battle: BattleState): void => {
  if (battle.minesRolled === true) return;
  battle.minesRolled = true;
  if (!battle.notes.includes("minefield")) return;
  if (battle.notes.includes("noMines")) {
    battle.mines = 0;
    return;
  }
  let mines = 0;
  for (let i = 0; i < G.turn; i += 1) if (die(ctx, 6) >= 4) mines += 1;
  battle.mines = mines;
};

/**
 * 19.3 steps 2-5 / 19.5: calculate the BDRM, roll one die per side and apply
 * the CRT.  The 19.4 mine hits are added after the CRT because decisive naval
 * victories double only the CRT losses; the mine hits themselves are never
 * doubled.
 */
const rollBattleDice = (G: ImperialElegyState, ctx: Ctx, battle: BattleState): void => {
  const {attackFp, defenceFp} = battleFpTotals(G, battle);
  const attackDrm = battle.attackerDrm + Math.max(0, attackFp - defenceFp);
  const defenceDrm = battle.defenderDrm + Math.max(0, defenceFp - attackFp);
  battle.attackDrmTotal = attackDrm;
  battle.defenceDrmTotal = defenceDrm;
  let a = die(ctx, 6);
  let d = die(ctx, 6);
  if (G.persistent.machineGuns === true) {
    a = Math.max(3, a);
    d = Math.max(3, d);
  }
  battle.attackerRoll = a;
  battle.defenderRoll = d;
  const differential = (a + attackDrm) - (d + defenceDrm);
  battle.diff = differential;
  const result = crt(differential);
  battle.attackerLosses = result.attackerLosses;
  battle.defenderLosses = result.defenderLosses;
  battle.decisive = result.decisive;
  battle.winner = result.victor;
  // 18.8: a decisive naval victory doubles the losing side's losses.
  if (result.decisive && battle.kind === "naval") {
    if (result.victor === "attacker") battle.defenderLosses *= 2;
    else battle.attackerLosses *= 2;
  }
  if (battle.trench) {
    battle.attackerLosses += 1;
  }
  // 19.4: the mine hits are part of the attacker's loss total, but they are
  // never doubled by a decisive result and never trigger the trench penalty.
  if (!battle.notes.includes("noMines")) battle.attackerLosses += Math.max(0, battle.mines ?? 0);
  resolveRollOutcome(G, ctx, battle);
};

/** 19.4: an attacker retreating from mines still suffers this many hits. */
export const MINE_RETREAT_HITS = 2;

/**
 * 19.4: open the attacker's "retreat after two mine hits" choice when three or
 * more mines hit.  Options are private to the attacking seat.  The printed
 * choice is unconditional; when the attacked-from box holds a hostile fleet
 * the retreating force simply cannot retreat, so 19.7 eliminates it instead of
 * the choice being withheld.
 */
const openMineRetreatDecision = (
  G: ImperialElegyState,
  ctx: Ctx,
  battle: BattleState,
): boolean => {
  if (G.pending !== null || G.battle !== battle) return false;
  if (!isPower(battle.attacker)) return false;
  const mines = Math.max(0, battle.mines ?? 0);
  if (mines <= MINE_RETREAT_HITS) return false;
  openDecision(G, ctx, decision(
    "mineRetreat",
    battle.attacker,
    "19.4 mines: take all mine hits and fight on, or retreat after the first two hits",
    [
      option("continue", `Take all ${mines} mine hits and continue the battle`),
      option("retreat", `Retreat now and take only the first ${MINE_RETREAT_HITS} mine hits`),
    ],
    {battle: true, space: battle.to, mines},
  ));
  return true;
};

/**
 * 19.4: resolve the mine-retreat choice.  "continue" keeps every mine hit and
 * then rolls the battle dice; "retreat" caps the mines at two, cancels the
 * battle and sends the attacker home through the ordinary lost-battle path
 * without ever rolling a battle die.  Returns false for a stale option so the
 * decision stays open.
 */
export const resolveMineRetreat = (G: ImperialElegyState, ctx: Ctx, optionId: string): boolean => {
  const battle = G.battle;
  const pending = G.pending;
  if (!battle || !pending || pending.kind !== "mineRetreat") return false;
  if (!pending.options.some((entry) => entry.id === optionId)) return false;
  G.pending = null;
  if (optionId === "retreat") {
    const total = Math.max(0, battle.mines ?? 0);
    const ignored = Math.max(0, total - MINE_RETREAT_HITS);
    battle.mines = MINE_RETREAT_HITS;
    // The battle never happens: only the two mine hits stand, and the attack
    // is a loss (`finishBattle` retreats the surviving ships to `from`).
    battle.attackerLosses = MINE_RETREAT_HITS;
    battle.defenderLosses = 0;
    battle.winner = "defender";
    battle.decisive = false;
    battle.diff = undefined;
    if (!battle.notes.includes("mineRetreat")) battle.notes.push("mineRetreat");
    recordDreadnoughtRequirement(G, battle);
    log(G, battle.attacker, "mineRetreat", {
      from: battle.from,
      space: battle.to,
      hits: battle.mines,
      ignored,
    });
    battle.stage = "lossesAttack";
    applyLosses(G, ctx, "attacker");
    return true;
  }
  // "Continue" fights on: the battle dice were deliberately not rolled while
  // the choice was open (19.3 step 1), so roll them now.
  if (battle.attackerRoll === undefined || battle.defenderRoll === undefined) {
    rollBattleDice(G, ctx, battle);
  } else {
    resolveRollOutcome(G, ctx, battle);
  }
  return true;
};

/**
 * Complete a naval/land roll once mines and any mine-retreat choice are fixed:
 * set the dreadnought quota, publish the dice, open the GW-05/GW-06 windows and
 * start the loss step.  Shared by `resolveBattleRoll` and the 19.4 "continue"
 * path so the two can never diverge.
 */
const resolveRollOutcome = (G: ImperialElegyState, ctx: Ctx, battle: BattleState): void => {
  recordDreadnoughtRequirement(G, battle);
  log(G, battle.attacker, "battleRoll", {
    from: battle.from,
    to: battle.to,
    attackerRoll: battle.attackerRoll,
    defenderRoll: battle.defenderRoll,
    attackDrm: battle.attackDrmTotal,
    defenceDrm: battle.defenceDrmTotal,
    differential: battle.diff,
    mines: battle.mines,
    attackerLosses: battle.attackerLosses,
    defenderLosses: battle.defenderLosses,
    winner: battle.winner,
  });
  battle.stage = "lossesAttack";
  // GW-05/GW-06 are played after the dice; open their response windows before
  // any losses are taken so `noRetreat` can still affect the retreat step.
  if (openAfterDiceWindow(G, ctx, battle, "attacker")) return;
  if (openAfterDiceWindow(G, ctx, battle, "defender")) return;
  applyLosses(G, ctx, "attacker");
};

/**
 * Units that may take a step loss on `side`.  The first loss must come from
 * the main attack/defense force (18.6 priority 1); subsequent losses may be
 * applied to supporting armies, so `includeSupport` adds the armies recorded
 * in this battle's committed support spaces.
 */
const lossCandidates = (
  G: ImperialElegyState,
  battle: BattleState,
  side: "attacker" | "defender",
  includeSupport: boolean,
): Unit[] => {
  const ids = side === "attacker" ? battle.mainAttack : battle.mainDefense;
  const main = ids.map((id) => unitById(G, id)).filter((u): u is Unit => u !== undefined && u.steps > 0);
  const support: Unit[] = [];
  if (includeSupport) {
    const entries = side === "attacker" ? battle.supportAttack : battle.supportDefense;
    for (const entry of entries) {
      for (const id of entry.units) {
        const unit = unitById(G, id);
        if (!unit || unit.steps <= 0) continue;
        if (!isArmyKind(unit.kind)) continue;
        if (support.some((u) => u.id === unit.id)) continue;
        support.push(unit);
      }
    }
  }
  const sort = (a: Unit, b: Unit): number => {
    if (a.steps !== b.steps) return a.steps - b.steps;
    return a.id.localeCompare(b.id);
  };
  return [...main.sort(sort), ...support.sort(sort)];
};

const firstLossTaken = (battle: BattleState, side: "attacker" | "defender"): boolean =>
  side === "attacker" ? battle.firstLossAttack === true : battle.firstLossDefense === true;

const markFirstLoss = (battle: BattleState, side: "attacker" | "defender"): void => {
  if (side === "attacker") battle.firstLossAttack = true;
  else battle.firstLossDefense = true;
};

const applyOneLoss = (
  G: ImperialElegyState,
  battle: BattleState,
  side: "attacker" | "defender",
  unitId?: string,
  includeSupport = false,
): void => {
  const candidates = lossCandidates(G, battle, side, includeSupport);
  if (candidates.length === 0) return;
  // 19.4/19.6: a side with dreadnoughts must take the majority of its step
  // losses on them.  A player-supplied id stays authoritative (chooseLoss
  // validates it against the same restriction), while the deterministic
  // fallback draws only from the permitted pool.
  const pool = withDreadnoughtPriority(battle, side, candidates);
  let target = unitId ? candidates.find((u) => u.id === unitId) : undefined;
  if (!target) {
    // Player units first; non-player units cannot be eliminated until all
    // player units in the stack are reduced (18.6).
    const playerUnits = pool.filter((u) => isPower(u.owner));
    target = (playerUnits.length > 0 ? playerUnits : pool)[0];
  }
  if (!target) return;
  markFirstLoss(battle, side);
  if (battle.kind === "naval" && target.kind === "dreadnought") {
    const counts = battle.dreadnoughtLosses ?? {attacker: 0, defender: 0};
    counts[side] += 1;
    battle.dreadnoughtLosses = counts;
  }
  if (target.kind === "eliteCorps" || target.kind === "expeditionary" || target.kind === "eliteColonialEf" || target.kind === "zouave") {
    removeUnit(G, target.id);
    return;
  }
  damageUnit(G, target.id, 1);
  if (!G.units[target.id]) {
    // 30.0: a dreadnought eliminated in battle costs its owner 1 stability.
    // Record the owner here (the unit is already gone) and charge it when the
    // battle's other effects are resolved.
    if (battle.kind === "naval" && target.kind === "dreadnought") {
      battle.dreadnoughtsSunk = [...(battle.dreadnoughtsSunk ?? []), String(target.owner)];
    }
    // An eliminated army also eliminates an attached EC (18.6.2).
    const ec = isEliteKind(target.kind) ? undefined : Object.values(G.units).find((u) => u.kind === "eliteCorps" && u.space === target.space && u.owner === target.owner);
    if (ec) removeUnit(G, ec.id);
  }
};

/** End a battle straight away when the last defender is removed pre-dice. */
const finishBattleBeforeDice = (
  G: ImperialElegyState,
  ctx: Ctx | undefined,
  battle: BattleState,
  decisive: boolean,
): boolean => {
  battle.winner = "attacker";
  battle.decisive = decisive;
  if (decisive) G.flags.decisiveBattle = battle.to;
  if (!ctx) return false;
  if (!battle.notes.includes(decisive ? "decisiveVictory" : "battleWonBeforeDice")) {
    battle.notes.push(decisive ? "decisiveVictory" : "battleWonBeforeDice");
  }
  finishBattle(G, ctx);
  return true;
};

/**
 * Units that still have steps in the battle space.  ECs/EFs/Zouaves have no
 * steps (18.6.2/18.6.3), so A059's "last step in the space" check must ignore
 * them or a lone EC floating over an eliminated army would suppress the
 * decisive win.
 */
const stepUnitsIn = (G: ImperialElegyState, space: SpaceId): Unit[] =>
  landUnitsIn(G, space).filter(
    (unit) =>
      (isArmyKind(unit.kind) || isNavalKind(unit.kind)) &&
      !isEliteKind(unit.kind) &&
      unit.kind !== "expeditionary" &&
      unit.steps > 0,
  );

/**
 * Resolve the printed pre-dice clauses of A058/A059 before any die is rolled.
 * The applied notes make repeated calls harmless (playCombatCard applies them
 * immediately, and resolveBattleRoll calls this again as a safety net).
 *
 * A058 reduces the enemy fort by two levels.  A059 puts one step loss on a
 * main-defense ARMY (never an EC/EF) and, if that removes the last step in the
 * space, wins the battle decisively before the dice (not a war-level "major
 * victory", which only a capital/surrender can trigger).
 */
export const applyPreDiceCardEffects = (
  G: ImperialElegyState,
  battle: BattleState,
  ctx?: Ctx,
): void => {
  if (battle.notes.includes("siegeGuns") && !battle.notes.includes("siegeGunsApplied")) {
    const fort = G.spaces[battle.to]?.fort;
    if (fort) {
      const level = fort.level - 2;
      if (level < 1) G.spaces[battle.to].fort = null;
      else fort.level = Math.min(3, level) as 1 | 2 | 3;
    }
    battle.notes.push("siegeGunsApplied");
    // A fort that was the battle space's only defender and is now gone ends
    // the battle without dice (there is nothing left to defend).
    const remainingDefenders = landUnitsIn(G, battle.to).filter((u) =>
      hostileOwner(G, battle.attacker, u.owner),
    );
    if (!G.spaces[battle.to]?.fort && remainingDefenders.length === 0) {
      finishBattleBeforeDice(G, ctx, battle, false);
    }
  }
  if (battle.notes.includes("flankAttack") && !battle.notes.includes("flankAttackApplied")) {
    const target = lossCandidates(G, battle, "defender", false).find((unit) => isArmyKind(unit.kind));
    if (target) {
      applyOneLoss(G, battle, "defender", target.id, false);
      // A059's pre-dice step loss does not satisfy 18.6's "first CRT loss from
      // the main force" priority; reset the marker for the dice losses.
      battle.firstLossDefense = false;
    }
    battle.notes.push("flankAttackApplied");
    // "If this eliminates the last step in a space it triggers a decisive
    // victory."  A 1-CP card cannot end a war, so finish the battle rather
    // than writing a war-level victory that classifyVictory would treat as a
    // capital fall/surrender.  ECs/EFs are not steps and cannot keep the
    // battle alive.
    const remainingDefenders = stepUnitsIn(G, battle.to);
    if (target && remainingDefenders.length === 0) {
      finishBattleBeforeDice(G, ctx, battle, true);
    }
  }
};

const applyLosses = (G: ImperialElegyState, ctx: Ctx, side: "attacker" | "defender"): void => {
  const battle = G.battle;
  if (!battle) return;
  const losses = side === "attacker" ? battle.attackerLosses : battle.defenderLosses;
  const firstDone = firstLossTaken(battle, side);
  const includeSupport = firstDone;
  // 19.4/19.6: while a dreadnought quota is outstanding, only dreadnoughts are
  // legal targets; afterwards the normal 18.6 candidates apply.
  const candidates = withDreadnoughtPriority(battle, side, lossCandidates(G, battle, side, includeSupport));
  const allCandidates = withDreadnoughtPriority(battle, side, lossCandidates(G, battle, side, true));
  if (losses <= 0 || candidates.length === 0) {
    if (side === "attacker") {
      battle.stage = "lossesDefense";
      applyLosses(G, ctx, "defender");
    } else {
      finishBattle(G, ctx);
    }
    return;
  }
  if (allCandidates.length <= 1 || losses >= allCandidates.length) {
    // Every loss can be applied without a real choice: take the first from the
    // main force, then allow supporting armies for the remainder.
    let allowSupport = includeSupport;
    for (let i = 0; i < losses; i += 1) {
      applyOneLoss(G, battle, side, undefined, allowSupport);
      allowSupport = true;
    }
    if (side === "attacker") applyLosses(G, ctx, "defender");
    else finishBattle(G, ctx);
    return;
  }
  // A minor defending alone has no player to pick a loss target; apply the
  // engine's priority order instead of offering the choice to the attacker.
  if (side === "defender" && !hasDefenderPlayer(G, battle)) {
    let allowSupport = includeSupport;
    for (let i = 0; i < losses; i += 1) {
      applyOneLoss(G, battle, side, undefined, allowSupport);
      allowSupport = true;
    }
    finishBattle(G, ctx);
    return;
  }
  // Let the side choose which unit takes the next loss.  The first loss is
  // restricted to the main force; later losses may hit supporting armies.
  const lossKindZh: Record<string, string> = {
    army: "军团",
    reserveArmy: "预备军团",
    eliteCorps: "精英军",
    expeditionary: "远征军",
    squadron: "分舰队",
    dreadnought: "无畏舰",
  };
  openDecision(G, ctx, decision(
    "combatLosses",
    side === "attacker" ? battle.attacker : defenderSupportPower(G, battle) ?? battle.defender,
    includeSupport
      ? "Choose a unit (main force or a supporting army) to take a step loss"
      : "Choose a unit in the main force to take a step loss",
    candidates.map((u) => {
      const isSupport =
        includeSupport && !(side === "attacker" ? battle.mainAttack : battle.mainDefense).includes(u.id);
      return {
        id: u.id,
        label: `${u.kind} (${u.steps} step${u.steps > 1 ? "s" : ""})${isSupport ? " · support" : ""}`,
        labelZh: `${lossKindZh[u.kind] ?? u.kind}（${u.steps} 步骤）${isSupport ? " · 支援" : ""}`,
      };
    }),
    {battle: true, side, remaining: losses, includeSupport},
  ));
};

export const chooseLoss = (G: ImperialElegyState, ctx: Ctx, unitId: string): void => {
  const battle = G.battle;
  const pending = G.pending;
  if (!battle || !pending || pending.kind !== "combatLosses") return;
  const side = (pending.context?.side as "attacker" | "defender") ?? "attacker";
  const includeSupport = pending.context?.includeSupport === true || firstLossTaken(battle, side);
  const candidates = withDreadnoughtPriority(battle, side, lossCandidates(G, battle, side, includeSupport));
  if (!candidates.some((unit) => unit.id === unitId)) return;
  applyOneLoss(G, battle, side, unitId, includeSupport);
  const remaining = Number(pending.context?.remaining ?? 1) - 1;
  battle[pending.context?.side === "attacker" ? "attackerLosses" : "defenderLosses"] -= 1;
  G.pending = null;
  if (remaining > 0) {
    applyLosses(G, ctx, side);
    return;
  }
  if (side === "attacker") applyLosses(G, ctx, "defender");
  else finishBattle(G, ctx);
};

const moveUnitTo = (G: ImperialElegyState, unit: Unit, to: SpaceId): void => {
  const from = unit.space;
  if (from && G.spaces[from]) {
    G.spaces[from].units = G.spaces[from].units.filter((id) => id !== unit.id);
  }
  const state = G.spaces[to];
  if (!state) return;
  if (!state.units.includes(unit.id)) state.units.push(unit.id);
  unit.space = to;
};

const isPortSpace = (space: SpaceId): boolean => portBoxes(space).length > 0;

const enemyNavalIn = (G: ImperialElegyState, space: SpaceId, power: Power): boolean =>
  navalUnitsIn(G, space).some((unit) => isPower(unit.owner) && atWar(G, power, unit.owner));

/**
 * 19.7: a defeated naval force retreats to an adjacent friendly port or an
 * adjacent naval box that does not contain enemy units, and "defending units
 * cannot retreat to a naval box that the attacker attacked from".  Land units
 * carried in the stack retreat with it.  Port overstacking is allowed (19.7
 * lets retreats overstack; the owner then pays the 5.5.3 step at the next
 * impulse).
 */
const navalRetreatDestinations = (
  G: ImperialElegyState,
  power: Power,
  from: SpaceId,
  attackerFrom?: SpaceId,
): SpaceId[] => {
  const out: SpaceId[] = [];
  for (const id of neighboursOf(from)) {
    const state = G.spaces[id];
    if (!state) continue;
    if (isNavalBox(id)) {
      if (id === attackerFrom) continue;
      if (!enemyNavalIn(G, id, power)) out.push(id);
      continue;
    }
    if (!isPortSpace(id)) continue;
    if (!friendlySpace(G, id, power)) continue;
    if (enemyNavalIn(G, id, power)) continue;
    out.push(id);
  }
  return out;
};

/** 19.7: the deterministic first legal retreat space for one naval force. */
const navalRetreatTarget = (
  G: ImperialElegyState,
  power: Power,
  from: SpaceId,
  attackerFrom?: SpaceId,
): SpaceId | null => navalRetreatDestinations(G, power, from, attackerFrom)[0] ?? null;

/**
 * The player deciding the naval loser's retreat: the owner of a defending
 * player ship, else the space's controlling player/ally.  `battle.defender`
 * can be the attacker fallback for a minor-held space, so it is not enough.
 */
const navalRetreatPower = (G: ImperialElegyState, battle: BattleState): Power | undefined =>
  (battle.mainDefense
    .map((id) => unitById(G, id))
    .find((unit): unit is Unit => Boolean(unit) && isPower(unit!.owner))?.owner as Power | undefined)
  ?? defenderSupportPower(G, battle)
  ?? undefined;

/**
 * Queue 18.8's follow-up for a decisive land victory.  The actual decision is
 * opened once the current card/loss resolution has cleared `G.pending`, so it
 * can never be swallowed by an enclosing combat-card move.
 */
const queueDecisiveFollowUp = (
  G: ImperialElegyState,
  battle: BattleState,
  advancedUnitIds: string[],
): void => {
  if (battle.kind !== "land") return;
  if (!battle.decisive) return;
  if (battle.trench) return;
  if (advancedUnitIds.length === 0) return;
  if (G.flags.decisiveBonusUsed === true) return;
  if (battle.notes.includes("decisiveFollowUpBattle")) return;
  G.flags.decisiveFollowUp = JSON.stringify({
    space: battle.to,
    power: battle.attacker,
    unitIds: advancedUnitIds,
  });
};

/**
 * Open the 18.8 choice ("another land battle action or move one additional
 * space for free") for a queued decisive victory.  Safe to call after any move
 * that may have finished a battle: it does nothing while a decision or battle
 * is still open.
 */
export const maybeOpenDecisiveFollowUp = (G: ImperialElegyState, ctx: Ctx | undefined): boolean => {
  if (!ctx || G.pending !== null || G.battle !== null) return false;
  const raw = G.flags.decisiveFollowUp;
  if (typeof raw !== "string" || raw.length === 0) return false;
  delete G.flags.decisiveFollowUp;
  let data: {space?: SpaceId; power?: Power; unitIds?: string[]};
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    return false;
  }
  const space = data.space;
  const power = data.power;
  if (!space || !power || !G.spaces[space] || !G.powers[power]) return false;
  const unitIds = (data.unitIds ?? []).filter((id) => {
    const unit = G.units[id];
    return Boolean(unit) && unit!.space === space && !unit!.naval;
  });
  if (unitIds.length === 0) return false;
  const options = [];
  for (const id of neighboursOf(space)) {
    const state = G.spaces[id];
    if (!state || isNavalBox(id)) continue;
    const defenders = landUnitsIn(G, id).filter((unit) =>
      hostileOwner(G, power, unit.owner),
    );
    if (defenders.length > 0 || state.fort) {
      options.push(option(`battle:${id}`, `Another battle: ${spaceLabel(id, "en")}`, {action: "battle", space: id}));
      continue;
    }
    if (friendlySpace(G, id, power) || (state.control === null && state.influence === power)) {
      options.push(option(`move:${id}`, `Move one space: ${spaceLabel(id, "en")}`, {action: "move", space: id}));
    }
  }
  if (options.length === 0) return false;
  options.push(option("done", "Decline the decisive-battle bonus"));
  openDecision(G, ctx, decision(
    "decisiveBattle",
    power,
    "Decisive victory: take another land battle action or move one additional space for free",
    options,
    {battle: true, space, power, unitIds},
  ));
  return true;
};

/**
 * Resolve the 18.8 follow-up.  Returns false when the option is stale or
 * illegal (the decision is left open so the player can choose again).
 */
export const resolveDecisiveFollowUp = (G: ImperialElegyState, ctx: Ctx, optionId: string): boolean => {
  const pending = G.pending;
  if (!pending || pending.kind !== "decisiveBattle") return false;
  if (!pending.options.some((entry) => entry.id === optionId)) return false;
  const space = pending.context?.space as SpaceId | undefined;
  const power = pending.context?.power as Power | undefined;
  const unitIds = Array.isArray(pending.context?.unitIds) ? (pending.context?.unitIds as string[]) : [];
  if (!space || !power) return false;
  G.pending = null;
  G.flags.decisiveBonusUsed = true;
  if (optionId === "done") return true;
  const separator = optionId.indexOf(":");
  const action = separator === -1 ? optionId : optionId.slice(0, separator);
  const target = separator === -1 ? "" : optionId.slice(separator + 1);
  if (!target || !G.spaces[target]) return true;
  if (action === "battle") {
    const battle = beginLandBattle(G, ctx, power, space, target);
    if (!battle) {
      log(G, power, "decisiveFollowUpFailed", {space: target});
      return true;
    }
    if (!battle.notes.includes("decisiveFollowUpBattle")) battle.notes.push("decisiveFollowUpBattle");
    log(G, power, "decisiveFollowUpBattle", {from: space, to: target});
    return true;
  }
  if (action === "move") {
    const moving = unitIds.filter((id) => {
      const unit = G.units[id];
      return Boolean(unit) && unit!.space === space && unit!.owner === power && !unit!.naval;
    });
    for (const id of moving) moveUnitTo(G, G.units[id], target);
    log(G, power, "decisiveFollowUpMove", {from: space, to: target, count: moving.length});
    return true;
  }
  return true;
};

/**
 * 18.7 / 28.1.5 / 28.1.1: every legal adjacent retreat space for a defeated
 * land force, in the printed connection order (so the deterministic fallback is
 * unchanged).  A trench battle space may be entered even when it is enemy
 * controlled/occupied (28.1.5's exception for the first space left).
 */
const landRetreatDestinations = (
  G: ImperialElegyState,
  space: SpaceId,
  retreatPower: Power | null,
): SpaceId[] => {
  const targetState = G.spaces[space];
  // 28.1.5's exception only applies when the force is leaving a trench battle
  // space; an ordinary retreat still needs a friendly adjacent space.
  const leavingTrench = Boolean(targetState?.trench);
  return neighboursOf(space).filter((id) => {
    if (isNavalBox(id)) return false;
    if (leavingTrench && G.spaces[id]?.trench) return true;
    if (retreatPower) return friendlySpace(G, id, retreatPower);
    const state = G.spaces[id];
    return Boolean(state) &&
      state.control === targetState?.control &&
      state.ally === targetState?.ally;
  });
};

/** 18.7 / 28.1.1: the first adjacent space a defeated land force retreats to. */
const landRetreatTarget = (
  G: ImperialElegyState,
  space: SpaceId,
  retreatPower: Power | null,
): SpaceId | null => landRetreatDestinations(G, space, retreatPower)[0] ?? null;

/**
 * 18.7 / 28.1.1: a mixed force may contain units of different powers (a minor
 * ally's army, an ally's corps), and each unit can only retreat to a space
 * friendly to *it*.  A player unit therefore uses its own seat; a non-player
 * minor uses the battle side's power.
 */
const unitRetreatPower = (unit: Unit, sidePower: Power | null): Power | null =>
  isPower(unit.owner) ? unit.owner : sidePower;

/** 18.7 / 28.1.1: one legal retreat assignment for part of a defeated force. */
export interface RetreatAssignment {
  unitId: string;
  space: SpaceId;
}

const encodeRetreatAssignments = (assignments: readonly RetreatAssignment[]): string =>
  `split:${assignments.map((entry) => `${entry.unitId}@${entry.space}`).join("|")}`;

const decodeRetreatAssignments = (optionId: string): RetreatAssignment[] | null => {
  if (!optionId.startsWith("split:")) return null;
  const out: RetreatAssignment[] = [];
  for (const part of optionId.slice("split:".length).split("|")) {
    if (part === "") continue;
    const at = part.indexOf("@");
    if (at <= 0 || at === part.length - 1) return null;
    out.push({unitId: part.slice(0, at), space: part.slice(at + 1)});
  }
  return out.length > 0 ? out : null;
};

/**
 * 18.7 / 19.7: "Units do not have to retreat to the same space."  The printed
 * choice is one destination per unit, so the live decision should list every
 * distinct split assignment.  This bound only keeps a pathological force from
 * producing an unusable option list: realistic forces (a three-army land stack
 * with its ECs/EFs, or a port's four ships) are below it and enumerate
 * completely.  Above it the deterministic single-divergence cover is used
 * instead of silently truncating the depth-first order (see
 * `enumerateRetreatSplits`).
 */
export const SPLIT_RETREAT_OPTION_LIMIT = 512;

/**
 * Every distinct per-unit retreat assignment (at least two different spaces),
 * or -- when the cartesian product exceeds `limit` -- a deterministic covering
 * set in which exactly one unit diverges from its first legal space.  The
 * covering set still offers every single-unit divergence and never depends on
 * enumeration order.
 */
export const enumerateRetreatSplits = (
  unitIds: readonly string[],
  unitDestinations: ReadonlyMap<string, readonly SpaceId[]>,
  limit = SPLIT_RETREAT_OPTION_LIMIT,
): RetreatAssignment[][] => {
  if (unitIds.length <= 1) return [];
  const firsts = unitIds.map((id) => (unitDestinations.get(id) ?? [])[0]);
  let product = 1;
  for (const id of unitIds) {
    const count = (unitDestinations.get(id) ?? []).length;
    if (count === 0) return [];
    product *= count;
    if (product > limit) break;
  }
  if (product <= limit) {
    const out: RetreatAssignment[][] = [];
    const current: RetreatAssignment[] = [];
    const walk = (index: number): void => {
      if (index === unitIds.length) {
        if (new Set(current.map((entry) => entry.space)).size <= 1) return;
        out.push([...current]);
        return;
      }
      for (const space of unitDestinations.get(unitIds[index]) ?? []) {
        current.push({unitId: unitIds[index], space});
        walk(index + 1);
        current.pop();
      }
    };
    walk(0);
    return out;
  }
  const out: RetreatAssignment[][] = [];
  const seen = new Set<string>();
  for (let index = 0; index < unitIds.length; index += 1) {
    for (const space of unitDestinations.get(unitIds[index]) ?? []) {
      const assignment = unitIds.map((unitId, position) => ({
        unitId,
        space: position === index ? space : firsts[position],
      }));
      if (new Set(assignment.map((entry) => entry.space)).size <= 1) continue;
      const key = encodeRetreatAssignments(assignment);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(assignment);
    }
  }
  return out;
};

/**
 * 28.1.1/18.7: build the live retreat choices.  Group destinations (legal for
 * every unit in the force) come first and keep the plain space id, so the
 * legacy behaviour and the deterministic fallback are unchanged.  When the
 * units have different legal spaces, per-unit "split" assignments are appended
 * (deterministically, complete within `SPLIT_RETREAT_OPTION_LIMIT`) so one
 * decision still covers the whole force.
 */
const retreatChoiceOptions = (
  G: ImperialElegyState,
  units: readonly Unit[],
  unitDestinations: ReadonlyMap<string, SpaceId[]>,
  common: readonly SpaceId[],
): {id: string; label: string; assignments: RetreatAssignment[]}[] => {
  const out: {id: string; label: string; assignments: RetreatAssignment[]}[] = [];
  for (const spaceValue of common) {
    out.push({
      id: spaceValue,
      label: spaceLabel(spaceValue, "en"),
      assignments: units.map((unit) => ({unitId: unit.id, space: spaceValue})),
    });
  }
  for (const assignments of enumerateRetreatSplits(units.map((unit) => unit.id), unitDestinations)) {
    out.push({
      id: encodeRetreatAssignments(assignments),
      label: `Split: ${assignments
        .map((entry) => {
          const unit = G.units[entry.unitId];
          return `${unit ? unit.kind : entry.unitId}→${spaceLabel(entry.space, "en")}`;
        })
        .join(", ")}`,
      assignments,
    });
  }
  return out;
};

/** Destinations legal for every unit in the force (group choices preserved). */
const commonDestinations = (
  units: readonly Unit[],
  unitDestinations: ReadonlyMap<string, SpaceId[]>,
): SpaceId[] => {
  if (units.length === 0) return [];
  const first = unitDestinations.get(units[0].id) ?? [];
  return first.filter((candidate) =>
    units.every((unit) => (unitDestinations.get(unit.id) ?? []).includes(candidate)),
  );
};

/**
 * 18.7/19.7: whether the defeated units really have *different* legal
 * destinations.  The per-unit choice is only raised for a divergent force; a
 * homogeneous force keeps the deterministic first-space fallback (and group
 * choices stay available once a decision is open).
 */
const destinationSetsDiffer = (
  units: readonly Unit[],
  unitDestinations: ReadonlyMap<string, SpaceId[]>,
): boolean => {
  if (units.length <= 1) return false;
  const keys = units.map((unit) => (unitDestinations.get(unit.id) ?? []).join("|"));
  return new Set(keys).size > 1;
};

/**
 * 18.7/28.1.1: move every defeated unit out with its chosen (or deterministic
 * first legal) destination; a unit with no legal space is eliminated.  Returns
 * the number of units that actually retreated.
 */
const applyRetreatAssignments = (
  G: ImperialElegyState,
  battle: BattleState,
  units: readonly Unit[],
  sidePower: Power | null,
  fallbackToControl = false,
): number => {
  const chosen = new Map((battle.retreatAssignments ?? []).map((entry) => [entry.unitId, entry.space]));
  let moved = 0;
  for (const unit of units) {
    if (unit.kind === "rebelArmy") {
      removeUnit(G, unit.id);
      continue;
    }
    const power = unitRetreatPower(unit, sidePower);
    // A per-unit assignment list is authoritative: an uncovered unit (no legal
    // space of its own) is eliminated instead of being dragged to another
    // contingent's group destination.  Legacy callers that only set
    // `retreatTo` still move the whole force there.
    const legacyGroup = battle.retreatAssignments === undefined ? battle.retreatTo : undefined;
    // A minor defender alone has no player seat: an ordinary 18.7 retreat
    // falls back to the neighbours with the same control/ally (the pre-existing
    // `landRetreatTarget(..., null)` behaviour).
    const fallback = power === null && !fallbackToControl
      ? null
      : landRetreatTarget(G, battle.to, power);
    const space = chosen.get(unit.id) ?? legacyGroup ?? fallback;
    if (space === null) {
      removeUnit(G, unit.id);
      continue;
    }
    moveUnitTo(G, unit, space);
    moved += 1;
  }
  return moved;
};

/**
 * 19.8: "After the loser retreats, if the active player won the naval battle,
 * the active player may move any of their units that participated in the naval
 * battle (including an accompanying land unit) into an adjacent friendly port
 * space(s)."  This is the port-only counterpart of 19.1's "finish the
 * interrupted naval movement" (which may also end in a naval box).
 */
export interface NavalPortContinuationPlan {
  /** The naval box the winning fleet occupies. */
  space: SpaceId;
  /** Surviving participating units: the ships plus any accompanying land unit. */
  unitIds: string[];
  /** Adjacent friendly ports that can hold the whole force together. */
  destinations: SpaceId[];
  /**
   * 19.8 "space(s)": each participating unit's own legal adjacent ports (5.5.4
   * capacity checked for that unit alone).  A split assignment uses these, so a
   * force can divide across ports or leave part of the fleet at sea.
   */
  unitDestinations: Record<string, SpaceId[]>;
  /** The attacker and any joint-operation power that took part. */
  powers: Power[];
}

/** One unit's 19.8 destination; `null` means the unit stays at sea. */
interface NavalPortSplitAssignment {
  unitId: string;
  space: SpaceId | null;
}

/** 19.8: the winning fleet's legal adjacent friendly ports (port-only). */
const navalPortContinuationPlan = (
  G: ImperialElegyState,
  battle: BattleState,
): NavalPortContinuationPlan | null => {
  if (battle.kind !== "naval") return null;
  // `finishBattle` treats an unrecorded winner as the attacker's; keep the two
  // in step for direct callers.
  if ((battle.winner ?? "attacker") !== "attacker") return null;
  // A port victory displaces the attackers back to the sea (19.9); the printed
  // 19.8 move is the post-battle move of a fleet that fought in a naval box.
  if (!isNavalBox(battle.to)) return null;
  const ships = battle.mainAttack
    .map((id) => G.units[id])
    .filter((unit): unit is Unit =>
      Boolean(unit) && unit!.naval === true && unit!.steps > 0 && unit!.space === battle.to,
    );
  if (ships.length === 0) return null;
  const powers = new Set<Power>([battle.attacker]);
  for (const owner of battle.forceOwners?.attacker ?? []) if (isPower(owner)) powers.add(owner);
  const powerOrder = [...powers].sort((a, b) => POWERS.indexOf(a) - POWERS.indexOf(b));
  const effectivePower = (unit: Unit): Power =>
    isPower(unit.owner) ? unit.owner : battle.attacker;
  const land = unitsIn(G, battle.to).filter(
    (unit) => unit.naval !== true && powers.has(effectivePower(unit)),
  );
  const movers = [...ships, ...land];
  const adjacentPorts = Object.values(SPACES)
    .filter(
      (def) =>
        def.ports?.includes(battle.to) === true &&
        !isNavalBox(def.id) &&
        Boolean(G.spaces[def.id]),
    )
    .map((def) => def.id);
  // Per-unit destinations: friendly to the unit's own power, no hostile
  // occupants, and the unit alone fits (5.5.4 / 5.5.3).
  const unitDestinations: Record<string, SpaceId[]> = {};
  for (const unit of movers) {
    const power = effectivePower(unit);
    const allowed = adjacentPorts.filter((port) => {
      if (!friendlySpace(G, port, power)) return false;
      if (navalUnitsIn(G, port).some((other) => hostileOwner(G, power, other.owner))) return false;
      if (landUnitsIn(G, port).some((other) => hostileOwner(G, power, other.owner))) return false;
      return movementEndProblem(G, port, [unit]) === null;
    });
    allowed.sort((a, b) => a.localeCompare(b, "en"));
    unitDestinations[unit.id] = allowed;
  }
  // Whole-force destinations keep the original group choice and its stricter
  // "friendly to every participating power" test.
  const destinations: SpaceId[] = [];
  for (const port of adjacentPorts) {
    if (!powerOrder.every((power) => friendlySpace(G, port, power))) continue;
    const hostileShips = navalUnitsIn(G, port).some((unit) =>
      powerOrder.some((power) => hostileOwner(G, power, unit.owner)),
    );
    if (hostileShips) continue;
    const hostileLand = landUnitsIn(G, port).some((unit) =>
      powerOrder.some((power) => hostileOwner(G, power, unit.owner)),
    );
    if (hostileLand) continue;
    // 5.5.4: this is a movement, not a retreat, so the port capacity is real.
    if (movementEndProblem(G, port, movers) !== null) continue;
    destinations.push(port);
  }
  destinations.sort((a, b) => a.localeCompare(b, "en"));
  return {
    space: battle.to,
    unitIds: movers.map((unit) => unit.id),
    destinations,
    unitDestinations,
    powers: powerOrder,
  };
};

/** Does this concrete per-unit assignment violate 5.5.3/5.5.4 at any port? */
const navalPortSplitProblem = (
  G: ImperialElegyState,
  movers: readonly Unit[],
  assignments: readonly {unitId: string; space: SpaceId}[],
  unitDestinations: Readonly<Record<string, readonly SpaceId[]>>,
): boolean => {
  const groups = new Map<SpaceId, Unit[]>();
  for (const entry of assignments) {
    const unit = movers.find((candidate) => candidate.id === entry.unitId);
    if (!unit) return true;
    if (!(unitDestinations[entry.unitId] ?? []).includes(entry.space)) return true;
    const group = groups.get(entry.space) ?? [];
    if (group.some((candidate) => candidate.id === unit.id)) return true;
    group.push(unit);
    groups.set(entry.space, group);
  }
  for (const [space, units] of groups) {
    if (movementEndProblem(G, space, units) !== null) return true;
  }
  return false;
};

/**
 * 19.8: keep the single port-continuation decision's option list usable.  At or
 * below this many per-unit assignments the full list is offered; above it the
 * complete per-unit chooser is used instead of a lossy covering set.
 */
export const NAVAL_PORT_SPLIT_OPTION_LIMIT = 512;

/**
 * 19.8: every distinct split assignment (at least one unit moves to a port, and
 * the assignment is neither "all stay" nor a whole-force group move, which the
 * plain destination options already cover).  The full product is enumerated up
 * to `NAVAL_PORT_SPLIT_OPTION_LIMIT`; above it the caller switches to the
 * per-unit chooser instead of dropping legal combinations behind a
 * deterministic cover.  A cover can never represent every legal split (for
 * example, two units swapping ports), so it is not used as a fallback.
 */
const enumerateNavalPortSplits = (
  G: ImperialElegyState,
  movers: readonly Unit[],
  unitDestinations: Readonly<Record<string, readonly SpaceId[]>>,
  limit = NAVAL_PORT_SPLIT_OPTION_LIMIT,
): NavalPortSplitAssignment[][] => {
  const ids = movers.map((unit) => unit.id);
  if (ids.length === 0) return [];
  const valid = (assignment: readonly NavalPortSplitAssignment[]): boolean => {
    const assigned = assignment.filter(
      (entry): entry is {unitId: string; space: SpaceId} => entry.space !== null,
    );
    if (assigned.length === 0) return false;
    // All units moving to one port is the plain group option, not a split.
    if (assigned.length === ids.length && new Set(assigned.map((entry) => entry.space)).size === 1) {
      return false;
    }
    return !navalPortSplitProblem(G, movers, assigned, unitDestinations);
  };
  let product = 1;
  for (const id of ids) {
    product *= (unitDestinations[id] ?? []).length + 1; // + "stay at sea"
    if (product > limit) break;
  }
  if (product <= limit) {
    const out: NavalPortSplitAssignment[][] = [];
    const current: NavalPortSplitAssignment[] = [];
    const walk = (index: number): void => {
      if (index === ids.length) {
        if (valid(current)) out.push([...current]);
        return;
      }
      const destinations = unitDestinations[ids[index]] ?? [];
      for (const space of [...destinations, null] as (SpaceId | null)[]) {
        current.push({unitId: ids[index], space});
        walk(index + 1);
        current.pop();
      }
    };
    walk(0);
    return out;
  }
  // Too many combinations for a single option list: the caller opens the
  // complete per-unit chooser instead (never a lossy deterministic cover).
  return [];
};

/** 19.8: number of per-unit assignments the complete chooser would enumerate. */
const navalPortSplitProduct = (
  movers: readonly Unit[],
  unitDestinations: Readonly<Record<string, readonly SpaceId[]>>,
): number => {
  let product = 1;
  for (const unit of movers) {
    product *= (unitDestinations[unit.id] ?? []).length + 1;
    if (!Number.isFinite(product)) return Number.MAX_SAFE_INTEGER;
  }
  return product;
};

/** 19.8 split option label, grouped per port and deterministic. */
const navalPortSplitLabel = (
  assignments: readonly NavalPortSplitAssignment[],
  movers: readonly Unit[],
): string => {
  const counts = new Map<SpaceId, number>();
  for (const entry of assignments) {
    if (entry.space === null) continue;
    counts.set(entry.space, (counts.get(entry.space) ?? 0) + 1);
  }
  const parts = [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "en"))
    .map(([space, count]) => `${count}→${spaceLabel(space, "en")}`);
  const staying = movers.length - [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (staying > 0) parts.push(`${staying} staying at sea`);
  return `Split: ${parts.join(", ")} (19.8)`;
};

/**
 * 19.8: open the active player's port-only continuation.  `continuation` marks
 * whether a 19.1 "finish the interrupted movement" decision is waiting behind
 * this choice (offered again if the player stays at sea).  Returns false when
 * the battle was not a won naval-box battle or no participating unit can reach
 * an adjacent friendly port.
 */
export const openNavalPortContinuationDecision = (
  G: ImperialElegyState,
  ctx: Ctx | undefined,
  battle: BattleState,
  continuation = false,
): boolean => {
  if (ctx === undefined) return false;
  if (G.pending !== null || G.battle !== null) return false;
  const plan = navalPortContinuationPlan(G, battle);
  if (plan === null) return false;
  const movers = plan.unitIds
    .map((id) => G.units[id])
    .filter((unit): unit is Unit => Boolean(unit) && unit!.space === plan.space && unit!.steps > 0);
  const splits = enumerateNavalPortSplits(G, movers, plan.unitDestinations);
  const custom = navalPortSplitProduct(movers, plan.unitDestinations) > NAVAL_PORT_SPLIT_OPTION_LIMIT;
  if (plan.destinations.length === 0 && splits.length === 0 && !custom) return false;
  const options = plan.destinations.map((dest) =>
    option(dest, `Move into the friendly port ${spaceLabel(dest, "en")} (19.8)`, {space: dest}),
  );
  for (const assignments of splits) {
    options.push(
      option(`split:${assignments
        .filter((entry) => entry.space !== null)
        .map((entry) => `${entry.unitId}@${entry.space}`)
        .join("|")}`, navalPortSplitLabel(assignments, movers), {assignments}),
    );
  }
  if (custom) {
    options.push(option("custom", "Choose each unit's port individually (complete 19.8 split)"));
  }
  options.push(option("stay", "Stay at sea (finish the battle here)"));
  openDecision(G, ctx, decision(
    "navalPortContinuation",
    battle.attacker,
    "19.8: move any participating units into adjacent friendly port space(s), or stay at sea",
    options,
    {
      space: plan.space,
      unitIds: plan.unitIds,
      destinations: plan.destinations,
      unitDestinations: plan.unitDestinations,
      powers: plan.powers,
      continuation,
    },
  ));
  return true;
};

/**
 * 19.8: one step of the complete per-unit chooser used when the cartesian
 * product would exceed `NAVAL_PORT_SPLIT_OPTION_LIMIT`.  It asks for the next
 * unit's port (or "sea") and keeps a running assignment list, so every legal
 * split remains reachable without a lossy covering set.  "stay" leaves the
 * whole force at sea as the ordinary `stay` option does.
 */
const openNavalPortUnitStep = (
  G: ImperialElegyState,
  ctx: Ctx,
  power: Power,
  context: Record<string, unknown>,
  index: number,
  assignments: readonly NavalPortSplitAssignment[],
): boolean => {
  const unitIds = Array.isArray(context.unitIds)
    ? (context.unitIds as unknown[]).filter((id): id is string => typeof id === "string")
    : [];
  const unitId = unitIds[index];
  const unit = unitId === undefined ? undefined : G.units[unitId];
  if (!unit || unit.space !== context.space || unit.steps <= 0) return false;
  const raw = context.unitDestinations;
  const unitDestinations = raw !== null && typeof raw === "object" ? (raw as Record<string, SpaceId[]>) : {};
  const options = [];
  const assignedUnitsAt = (port: SpaceId): Unit[] =>
    assignments
      .filter((entry) => entry.space === port)
      .map((entry) => G.units[entry.unitId])
      .filter((candidate): candidate is Unit => Boolean(candidate));
  for (const port of unitDestinations[unit.id] ?? []) {
    if (movementEndProblem(G, port, [...assignedUnitsAt(port), unit]) !== null) continue;
    options.push(option(`to:${port}`, `Move ${unit.id} into the friendly port ${spaceLabel(port, "en")}`));
  }
  options.push(option("sea", "Leave this unit at sea"));
  options.push(option("stay", "Leave the whole force at sea"));
  openDecision(G, ctx, decision(
    "navalPortContinuation",
    power,
    `19.8 complete split: choose a port for ${unit.id} (${index + 1}/${unitIds.length})`,
    options,
    {...context, stage: "unit", index, assignments: [...assignments]},
  ));
  return true;
};

/**
 * 19.8: resolve the port-only continuation.  "stay" keeps the fleet in the box
 * and hands over to the 19.1 continuation when one is waiting.  Any unit not
 * named by a split assignment stays at sea; a partial move therefore leaves
 * those units in the interrupted movement, and only a move of the whole force
 * consumes the 19.1 continuation.
 */
export const resolveNavalPortContinuation = (
  G: ImperialElegyState,
  ctx: Ctx,
  optionId: string,
): boolean => {
  const pending = G.pending;
  if (!pending || pending.kind !== "navalPortContinuation") return false;
  if (!pending.options.some((entry) => entry.id === optionId)) return false;
  const context = pending.context ?? {};
  const space = typeof context.space === "string" ? (context.space as SpaceId) : "";
  const destinations = Array.isArray(context.destinations)
    ? (context.destinations as unknown[]).filter((id): id is SpaceId => typeof id === "string")
    : [];
  const unitIds = Array.isArray(context.unitIds)
    ? (context.unitIds as unknown[]).filter((id): id is string => typeof id === "string")
    : [];
  const rawUnitDestinations = context.unitDestinations;
  const unitDestinations: Record<string, SpaceId[]> | undefined =
    rawUnitDestinations !== null && typeof rawUnitDestinations === "object"
      ? Object.fromEntries(
        Object.entries(rawUnitDestinations as Record<string, unknown>).map(([unitId, value]) => [
          unitId,
          Array.isArray(value) ? value.filter((id): id is SpaceId => typeof id === "string") : [],
        ]),
      )
      : undefined;
  if (space === "" || !G.spaces[space]) return false;
  const units = unitIds
    .map((id) => G.units[id])
    .filter((unit): unit is Unit => Boolean(unit) && unit!.space === space && unit!.steps > 0);
  const baseContext: Record<string, unknown> = {
    ...context,
    space,
    destinations,
    unitIds,
    unitDestinations: unitDestinations ?? {},
  };

  const applyStay = (): boolean => {
    G.pending = null;
    const continuation = context.continuation === true ? G.navalContinuation ?? null : null;
    G.navalContinuation = continuation;
    log(G, pending.power, "navalPortContinuation", {
      from: space,
      stopped: true,
      units: units.length,
    });
    if (continuation !== null) openNavalContinuationDecision(G, ctx, continuation);
    // A stale continuation (no legal destination left) is consumed rather than
    // parked for a later battle.
    if (G.pending === null) G.navalContinuation = null;
    return true;
  };

  const applyAssignments = (parsed: readonly {unitId: string; space: SpaceId}[]): boolean => {
    if (parsed.length === 0) return applyStay();
    const byId = new Map(units.map((unit) => [unit.id, unit]));
    const seen = new Set<string>();
    for (const entry of parsed) {
      if (seen.has(entry.unitId)) return false;
      seen.add(entry.unitId);
      if (!byId.has(entry.unitId)) return false;
      if (!(unitDestinations?.[entry.unitId] ?? []).includes(entry.space)) return false;
    }
    const movers = parsed
      .map((entry) => byId.get(entry.unitId))
      .filter((unit): unit is Unit => unit !== undefined);
    if (navalPortSplitProblem(G, movers, parsed, unitDestinations ?? {})) return false;
    G.pending = null;
    for (const entry of parsed) {
      const unit = byId.get(entry.unitId);
      if (unit) moveUnitTo(G, unit, entry.space);
    }
    // 19.1: "The active player will be able to finish their naval movement."
    // Only the units that entered a port give up the interrupted movement; a
    // partial 19.8 move leaves the rest at sea still able to finish it.
    const remaining = units.filter((unit) => unit.space === space && unit.steps > 0);
    const waitingContinuation = context.continuation === true ? G.navalContinuation ?? null : null;
    G.navalContinuation = waitingContinuation === null || remaining.length === 0
      ? null
      : {...waitingContinuation, unitIds: remaining.map((unit) => unit.id)};
    const distinct = [...new Set(parsed.map((entry) => entry.space))].sort((a, b) =>
      a.localeCompare(b, "en"),
    );
    log(G, pending.power, "navalPortContinuation", {
      from: space,
      to: distinct[0],
      destinations: distinct.join(","),
      units: parsed.length,
      split: true,
    });
    if (G.navalContinuation !== null) {
      openNavalContinuationDecision(G, ctx, G.navalContinuation);
      // A stale continuation (no legal destination left) is consumed rather
      // than parked for a later battle.
      if (G.pending === null) G.navalContinuation = null;
    }
    return true;
  };

  if (context.stage === "unit") {
    if (optionId === "stay") return applyStay();
    const index = Number(context.index);
    if (!Number.isInteger(index) || index < 0 || index >= unitIds.length) return false;
    const unit = units.find((candidate) => candidate.id === unitIds[index]);
    if (!unit) return false;
    const assignments = Array.isArray(context.assignments)
      ? (context.assignments as NavalPortSplitAssignment[]).filter(
        (entry) => entry !== null && typeof entry === "object" && typeof entry.unitId === "string",
      )
      : [];
    let next: NavalPortSplitAssignment[];
    if (optionId === "sea") {
      next = [...assignments, {unitId: unit.id, space: null}];
    } else if (optionId.startsWith("to:")) {
      const port = optionId.slice("to:".length) as SpaceId;
      if (!(unitDestinations?.[unit.id] ?? []).includes(port)) return false;
      const already = assignments
        .filter((entry) => entry.space === port)
        .map((entry) => G.units[entry.unitId])
        .filter((candidate): candidate is Unit => Boolean(candidate));
      if (movementEndProblem(G, port, [...already, unit]) !== null) return false;
      next = [...assignments, {unitId: unit.id, space: port}];
    } else {
      return false;
    }
    G.pending = null;
    if (index + 1 < unitIds.length) {
      return openNavalPortUnitStep(G, ctx, pending.power, baseContext, index + 1, next);
    }
    const moved = next.filter(
      (entry): entry is {unitId: string; space: SpaceId} => entry.space !== null,
    );
    return applyAssignments(moved);
  }

  if (optionId === "custom") {
    G.pending = null;
    return openNavalPortUnitStep(G, ctx, pending.power, baseContext, 0, []);
  }

  if (optionId.startsWith("split:")) {
    const parsed = decodeRetreatAssignments(optionId);
    if (!parsed || parsed.length === 0) return false;
    return applyAssignments(parsed);
  }

  const to = optionId === "stay" ? null : (optionId as SpaceId);
  if (to === null) return applyStay();
  if (!destinations.includes(to)) return false;
  if (movementEndProblem(G, to, units) !== null) return false;
  G.pending = null;
  for (const unit of units) moveUnitTo(G, unit, to);
  G.navalContinuation = null;
  log(G, pending.power, "navalPortContinuation", {from: space, to, units: units.length});
  return true;
};

/**
 * Finish a battle.  Land battles use 18.7's retreat/advance; naval battles use
 * 19.7/19.8/19.9 (loser retreats to a friendly port or empty naval box, the
 * attacker displaces back to its origin when the battle was in a port, and a
 * fort is eliminated when the port's defender loses).  GW-06's `noRetreat`
 * applies to both kinds.
 */
export const finishBattle = (G: ImperialElegyState, ctx: Ctx): void => {
  const battle = G.battle;
  if (!battle) return;
  const winner = battle.winner ?? "attacker";
  const loser = winner === "attacker" ? "defender" : "attacker";
  const noRetreat = battle.notes.includes("noRetreat");
  // 28.1.2: a trench battle fought from inside the space has from === to.
  const intraSpace = battle.kind === "land" && battle.from === battle.to;
  // 18.7 / 19.7: when the defeated force is mixed and its units have different
  // legal retreat spaces, one `combatRetreat` decision covers the whole force.
  // A divergent force with only one possible assignment stays deterministic.
  if (!noRetreat && battle.retreatAssignments === undefined && G.pending === null) {
    if (battle.kind === "naval" && winner === "attacker") {
      const retreatPower = navalRetreatPower(G, battle);
      const ships = battle.mainDefense
        .map((id) => unitById(G, id))
        .filter((unit): unit is Unit => Boolean(unit) && unit!.naval === true && unit!.steps > 0);
      const unitDestinations = new Map<string, SpaceId[]>();
      for (const unit of ships) {
        const power = unitRetreatPower(unit, retreatPower ?? null);
        unitDestinations.set(
          unit.id,
          power === null ? [] : navalRetreatDestinations(G, power, battle.to, battle.from),
        );
      }
      const movableShips = ships.filter((unit) => (unitDestinations.get(unit.id) ?? []).length > 0);
      if (retreatPower !== undefined && destinationSetsDiffer(movableShips, unitDestinations)) {
        const common = commonDestinations(movableShips, unitDestinations);
        const choices = retreatChoiceOptions(G, movableShips, unitDestinations, common);
        if (choices.length > 1) {
          battle.stage = "retreat";
          openDecision(G, ctx, decision(
            "combatRetreat",
            retreatPower,
            "Naval retreat: choose the space(s) the defeated fleet retreats to",
            choices.map((choice) =>
              choice.id.startsWith("split:")
                ? option(choice.id, choice.label, {assignments: choice.assignments})
                : option(choice.id, choice.label, {space: choice.id}),
            ),
            {
              battle: true,
              space: battle.to,
              side: "defender",
              destinations: common,
              unitIds: movableShips.map((unit) => unit.id),
              unitDestinations: Object.fromEntries([...unitDestinations.entries()]),
            },
          ));
          return;
        }
        if (choices.length === 1) battle.retreatAssignments = choices[0].assignments;
      }
    } else if (battle.kind === "land" && !intraSpace && !battle.trench && winner === "attacker") {
      const retreatPower = defenderSupportPower(G, battle);
      const losers = landUnitsIn(G, battle.to).filter((unit) => hostileOwner(G, battle.attacker, unit.owner));
      const unitDestinations = new Map<string, SpaceId[]>();
      for (const unit of losers) {
        const power = unitRetreatPower(unit, retreatPower);
        unitDestinations.set(unit.id, landRetreatDestinations(G, battle.to, power));
      }
      const movable = losers.filter((unit) => (unitDestinations.get(unit.id) ?? []).length > 0);
      if (retreatPower !== null && destinationSetsDiffer(movable, unitDestinations)) {
        const common = commonDestinations(movable, unitDestinations);
        const choices = retreatChoiceOptions(G, movable, unitDestinations, common);
        if (choices.length > 1) {
          battle.stage = "retreat";
          openDecision(G, ctx, decision(
            "combatRetreat",
            retreatPower,
            "Retreat: choose the space(s) the defeated force retreats to",
            choices.map((choice) =>
              choice.id.startsWith("split:")
                ? option(choice.id, choice.label, {assignments: choice.assignments})
                : option(choice.id, choice.label, {space: choice.id}),
            ),
            {
              battle: true,
              space: battle.to,
              side: "defender",
              destinations: common,
              unitIds: movable.map((unit) => unit.id),
              unitDestinations: Object.fromEntries([...unitDestinations.entries()]),
            },
          ));
          return;
        }
        if (choices.length === 1) battle.retreatAssignments = choices[0].assignments;
      }
    }
  }
  // 28.1.1/18.7: the side forced out of a shared trench battle space chooses
  // its retreat destination when more than one legal space exists.  The
  // decision is opened before any retreat/advance mutation so the battle state
  // is untouched until the player answers; `battle.retreatTo` records the pick
  // and the second finishBattle pass applies it.
  if (intraSpace && !noRetreat && battle.retreatAssignments === undefined && G.pending === null) {
    const retreatPower = winner === "attacker"
      ? defenderSupportPower(G, battle)
      : battle.attacker;
    const losers = winner === "attacker"
      ? landUnitsIn(G, battle.to).filter((unit) => hostileOwner(G, battle.attacker, unit.owner))
      : battle.mainAttack
        .map((id) => G.units[id])
        .filter((unit): unit is Unit => Boolean(unit) && unit!.space === battle.to && !unit!.naval);
    const unitDestinations = new Map<string, SpaceId[]>();
    for (const unit of losers) {
      const power = unitRetreatPower(unit, retreatPower);
      unitDestinations.set(unit.id, power === null ? [] : landRetreatDestinations(G, battle.to, power));
    }
    const movable = losers.filter((unit) => (unitDestinations.get(unit.id) ?? []).length > 0);
    const common = movable.length === 0
      ? []
      : (unitDestinations.get(movable[0].id) ?? []).filter((candidate) =>
        movable.every((unit) => (unitDestinations.get(unit.id) ?? []).includes(candidate)),
      );
    const choices = retreatChoiceOptions(G, movable, unitDestinations, common);
    if (choices.length > 1 && movable.length > 0) {
      battle.stage = "retreat";
      openDecision(G, ctx, decision(
        "combatRetreat",
        retreatPower ?? battle.attacker,
        "Trench battle: choose the space the defeated force retreats to",
        choices.map((choice) =>
          choice.id.startsWith("split:")
            ? option(choice.id, choice.label, {assignments: choice.assignments})
            : option(choice.id, choice.label, {space: choice.id}),
        ),
        {
          battle: true,
          space: battle.to,
          side: winner === "attacker" ? "defender" : "attacker",
          destinations: common,
          unitIds: movable.map((unit) => unit.id),
          unitDestinations: Object.fromEntries([...unitDestinations.entries()]),
        },
      ));
      return;
    }
  }
  let advancedUnitIds: string[] = [];
  if (battle.kind === "naval") {
    // Prefer the actual owner of a defending ship; `battle.defender` can be the
    // attacker fallback for a minor-held space.
    const defenderPower = battle.mainDefense
      .map((id) => unitById(G, id))
      .find((unit): unit is Unit => Boolean(unit) && isPower(unit!.owner))?.owner as Power | undefined
      ?? defenderSupportPower(G, battle);
    if (winner === "attacker") {
      const port = !isNavalBox(battle.to);
      const navalDefenders = battle.mainDefense
        .map((id) => unitById(G, id))
        .filter((unit): unit is Unit => Boolean(unit) && unit!.naval === true && unit!.steps > 0);
      const landDefenders = landUnitsIn(G, battle.to).filter((unit) =>
        hostileOwner(G, battle.attacker, unit.owner),
      );
      if (!noRetreat) {
        // 19.7: each ship may have its own legal space (a mixed player fleet);
        // retreatAssignments carries the owner's per-unit choice, and an
        // uncovered unit falls back to its own deterministic first space.
        const assignments = new Map(
          (battle.retreatAssignments ?? []).map((entry) => [entry.unitId, entry.space]),
        );
        const surviving = navalDefenders.filter((unit) => Boolean(G.units[unit.id]));
        let fleetSpace: SpaceId | null = null;
        for (const unit of surviving) {
          const power = unitRetreatPower(unit, defenderPower ?? null);
          const chosen = assignments.get(unit.id);
          const legacyGroup = battle.retreatAssignments === undefined ? battle.retreatTo : undefined;
          const retreat = chosen ??
            legacyGroup ??
            (battle.retreatAssignments === undefined && power !== null
              ? navalRetreatTarget(G, power, battle.to, battle.from)
              : null);
          if (retreat === null || retreat === undefined) {
            removeUnit(G, unit.id);
            continue;
          }
          moveUnitTo(G, G.units[unit.id], retreat);
          if (fleetSpace === null) fleetSpace = retreat;
        }
        if (fleetSpace !== null) {
          // 19.6.1: the carried land units retreat with their naval escort.
          for (const unit of landDefenders) moveUnitTo(G, unit, fleetSpace);
        } else {
          // No retreat route, or no naval escort for the land units (19.6.1).
          for (const unit of landDefenders) removeUnit(G, unit.id);
        }
      }
      // 19.9: losing a port battle eliminates the port's fort.
      if (port && G.spaces[battle.to].fort) G.spaces[battle.to].fort = null;
      // 19.8: attacking naval units displace back to the box they attacked from
      // when the battle was in a port.  In a naval box they occupy the box
      // unless GW-06 kept the defeated defenders there.
      const defendersRemain = unitsIn(G, battle.to).some((unit) =>
        hostileOwner(G, battle.attacker, unit.owner),
      );
      if (!port && (!noRetreat || !defendersRemain)) {
        for (const id of battle.mainAttack) {
          const unit = G.units[id];
          if (unit && unit.space === battle.from) moveUnitTo(G, unit, battle.to);
        }
        G.spaces[battle.to].occupiedBy = battle.attacker;
      }
      if (port) {
        // 19.9/19.8: "victorious attacking naval units will always displace back
        // to the naval box they attacked from".  A naval move that ended in the
        // port put them there; a separate port attack left them at sea.
        for (const id of battle.mainAttack) {
          const unit = G.units[id];
          if (unit && unit.space === battle.to && battle.from !== battle.to) {
            moveUnitTo(G, unit, battle.from);
          }
        }
      }
    } else {
      // The attacker loses: it falls back to the space it attacked from.  The
      // engine keeps attacking units there, so no displacement is needed
      // unless GW-06's no-retreat clause is in effect (they remain in place).
      if (!noRetreat) {
        for (const id of battle.mainAttack) {
          const unit = G.units[id];
          if (!unit) continue;
          if (unit.space !== battle.from) {
            if (G.spaces[battle.from] && !enemyNavalIn(G, battle.from, battle.attacker)) {
              moveUnitTo(G, unit, battle.from);
            } else {
              removeUnit(G, unit.id);
            }
          }
        }
      }
      // 19.6.1: "land units retreat with their accompanying naval units" when
      // the fleet is forced to retreat, and are eliminated when all of the
      // naval units accompanying their stack are eliminated (or they cannot
      // retreat).  A 12.3 transport carries its land unit into the battle.
      const attackerOwners = new Set<string>([battle.attacker, ...(battle.forceOwners?.attacker ?? [])]);
      const carriedLand = unitsIn(G, battle.to).filter(
        (unit) => unit.naval !== true && attackerOwners.has(unit.owner),
      );
      if (carriedLand.length > 0) {
        const escort = battle.mainAttack
          .map((id) => G.units[id])
          .find((unit): unit is Unit =>
            Boolean(unit) && unit!.naval === true && unit!.steps > 0 && unit!.space !== undefined,
          );
        for (const unit of carriedLand) {
          if (escort?.space) moveUnitTo(G, unit, escort.space);
          else removeUnit(G, unit.id);
        }
      }
    }
  } else if (winner === "attacker") {
    // 18.7: defender retreats unless a trench or GW-06 negates it.
    const defenderUnits = landUnitsIn(G, battle.to);
    const trenchDefence = Boolean(battle.trench);
    let retreated = false;
    if (intraSpace) {
      // 28.1.1: in a trench battle the side that loses a battle must retreat
      // from the shared space; a side that cannot retreat is eliminated.  The
      // defeated force may be mixed (allied contingents), so each unit uses its
      // own chosen/legal space.
      const retreatPower = defenderSupportPower(G, battle);
      const losers = defenderUnits.filter((u) => hostileOwner(G, battle.attacker, u.owner));
      retreated = applyRetreatAssignments(G, battle, losers, retreatPower) > 0;
    } else if (trenchDefence) {
      // 28.1.1: the defender does not retreat; if it survives, the attacker
      // advances into the space and a trench battle marker is placed on the
      // attacker's stack.  The marker update happens below, after the retreat
      // step, so it can see whether any defender remains.
    } else if (!noRetreat) {
      // 18.7: "units do not have to retreat to the same space".  A mixed force
      // uses its per-unit assignments; otherwise each unit falls back to its
      // own deterministic first legal space (a minor defending alone uses the
      // same-control neighbour rule).
      const retreatPower = defenderSupportPower(G, battle);
      retreated = applyRetreatAssignments(G, battle, defenderUnits, retreatPower, true) > 0;
    }
    // 18.7: a fort is eliminated only when the defender is forced to retreat
    // out of its space.  GW-06 (no retreat) and an eliminated garrison leave
    // the fort in place.
    if (retreated && G.spaces[battle.to].fort) G.spaces[battle.to].fort = null;
    // GW-06 only blocks the advance while a defeated defender actually remains
    // in the space.  If every defender was eliminated, the attacker advances.
    const defenderSurvives = landUnitsIn(G, battle.to).length > 0;
    if (trenchDefence) {
      if (defenderSurvives) {
        // 28.1.1: marker on the attacker's stack, flipped to attacker advantage
        // (or deadlocked when the advantaged defender was thrown back).
        const current = G.spaces[battle.to].trench?.status ?? "deadlock";
        const status = nextTrenchStatus(current, "attacker");
        setTrenchBattleMarker(G, battle.to, status, G.gw?.turn ?? 0);
        log(G, battle.attacker, "trenchBattle", {space: battle.to, status, turn: G.gw?.turn ?? 0});
      } else {
        // 28.1.4 exception: wiping out the main defence turns it into a normal
        // capture and allows the usual decisive-battle bonus.
        clearTrenchBattleMarker(G, battle.to);
        battle.trench = false;
      }
    }
    const attackerUnit = landUnitsIn(G, battle.from).find((u) => u.owner === battle.attacker);
    if (attackerUnit && (!noRetreat || !defenderSurvives)) {
      const previousHolder = keyHolder(G, battle.to);
      moveUnitTo(G, attackerUnit, battle.to);
      G.spaces[battle.to].occupiedBy = battle.attacker;
      // 30.0: GW key loss (−1, RU Scorched Earth absorbs the first) and
      // recapture (+1).  Inert outside the Great War.
      applyGwKeyCapture(G, battle.to, previousHolder, battle.attacker, ctx);
      advancedUnitIds = [attackerUnit.id];
    }
    if (battle.decisive) {
      G.flags.decisiveBattle = battle.to;
      queueDecisiveFollowUp(G, battle, advancedUnitIds);
    }
  } else {
    // Land attacker loses; no retreat (18.7).  If a trench battle marker is
    // present, the defender's successful attack shifts it (28.1.1), and in a
    // same-space trench battle the beaten attacker must leave the space.
    if (intraSpace) {
      const losers = battle.mainAttack
        .map((id) => G.units[id])
        .filter((unit): unit is Unit => Boolean(unit) && unit!.space === battle.to && !unit!.naval);
      applyRetreatAssignments(G, battle, losers, battle.attacker);
    }
    if (battle.trench) {
      const current = G.spaces[battle.to].trench?.status;
      if (current) {
        const status = nextTrenchStatus(current, "defender");
        setTrenchBattleMarker(G, battle.to, status, G.gw?.turn ?? 0);
        log(G, battle.defender, "trenchBattle", {space: battle.to, status, turn: G.gw?.turn ?? 0});
      }
    }
  }
  // 32.2 / 30.2: Italian home keys lost or retaken (and Rome taken) by this
  // battle's advance.  Inert unless Italy is fighting.
  if (G.gw?.active && battle.kind === "land") syncItalianHomeKeys(G, ctx);
  // Stability losses for decisive battles (GW).
  if (G.gw?.active && battle.decisive) {
    // A minor defending alone has no stability track to lose; use the
    // controlling ally when there is one instead of the attacker fallback.
    const loserPower = loser === "attacker"
      ? battle.attacker
      : defenderSupportPower(G, battle);
    const units = loser === "attacker" ? battle.mainAttack : battle.mainDefense;
    // 32.1 / 32.2: a US- or Italian-led force charges that major's own track
    // rather than its controlling player's.  The leader is read from the
    // battle's recorded owners because eliminated units are already gone.
    const leader = battle.forceOwners
      ? forceLeaderFromOwners(battle.forceOwners[loser])
      : forceLeader(G, units);
    // GW-10 Exhaustion (stability mode): a major defeat costs 2 stability
    // instead of 1 for the remainder of the GW turn.
    const lossSteps = G.persistent.exhaustion === "stability" ? 2 : 1;
    // 30.0 footnote: "at least 2 armies (including supporting armies) or 2
    // naval units".  The defeated force is the main force plus the armies that
    // supported it, so a one-army main force with a supporting army still
    // triggers the loss.
    const support = loser === "attacker" ? battle.supportAttack : battle.supportDefense;
    const forceSize = units.length + support.reduce((count, entry) => count + entry.units.length, 0);
    if (forceSize >= 2) {
      for (let step = 0; step < lossSteps; step += 1) {
        if (leader) applyGwMajorDecisiveDefeat(G, leader, battle.to, ctx);
        else if (loserPower) changeStability(G, loserPower, -1, ctx);
      }
    }
  }
  // 30.0: "Losing a dreadnought in battle: -1 stability."  One loss for each
  // dreadnought eliminated (recorded while the losses were applied).  The US
  // and Italy have their own 32.1/32.2 lists, so only player powers are
  // charged here.
  for (const owner of battle.dreadnoughtsSunk ?? []) {
    if (G.gw?.active && isPower(owner) && !G.powers[owner].eliminated) {
      changeStability(G, owner, -1, ctx, {cause: "battle"});
    }
  }
  // 30.1: an advance that occupies an enemy capital surrenders that player at
  // once (both capital and subcapital for AU/RU/OT; Ankara after the 33.5
  // switch).  Italy's Rome path is handled by `syncItalianHomeKeys` above.
  // Resolved after the battle's own stability effects so an eliminated power
  // is never charged for a battle it no longer fights.
  if (G.gw?.active && battle.kind === "land") resolveCapitalSurrenders(G, ctx);
  log(G, battle.attacker, "battleEnded", {to: battle.to, winner, decisive: battle.decisive});
  // 28.1.5: a trench battle ends when one side no longer holds the space.
  if (battle.kind === "land") pruneTrenchBattle(G, battle.to);
  // A043/A058/A059/A062's "draw an additional card at the end of this battle".
  for (const power of battle.extraDraws ?? []) {
    if (G.powers[power]) drawCards(G, ctx, power, 1);
  }
  // GW-03/GW-04 are placed facedown in front of the opponent after the battle
  // (26.1); they never enter the discard pile.
  for (const entry of battle.faceDownCards ?? []) {
    placeGwCombatCardFaceDown(G, entry.holder, entry.cardId);
  }
  G.battle = null;
  G.flags.combatDrm = 0;
  G.flags.enemyLandDrm = 0;
  G.flags.gwCombatDrm = 0;
  // 19.8 / 19.1: the winner's post-battle movement.  19.8's port-only move is a
  // separate choice from 19.1's "finish the interrupted naval movement"; when
  // both apply the port decision comes first and the general continuation is
  // kept for the "stay at sea" answer, so a battle can never grant two moves.
  if (battle.kind === "naval") {
    const continuation = G.navalContinuation;
    const continuationApplies =
      continuation !== null &&
      continuation !== undefined &&
      winner === "attacker" &&
      continuation.contact === battle.to &&
      continuation.power === battle.attacker &&
      continuation.intercepted &&
      isEuropeanWaterNavalSpace(continuation.contact) &&
      isEuropeanWaterNavalSpace(continuation.from);
    const portOpened =
      winner === "attacker" &&
      openNavalPortContinuationDecision(G, ctx, battle, continuationApplies);
    if (!portOpened) {
      G.navalContinuation = null;
      if (continuationApplies && continuation) openNavalContinuationDecision(G, ctx, continuation);
    } else if (!continuationApplies) {
      // Nothing to chain; the port decision owns the end of the battle.
      G.navalContinuation = null;
    }
  }
  // 3.3.1: a battle can capture ports and eliminate ships, both of which move
  // power projection.  Refresh the cached track once the battle's own effects
  // are settled; the next key recompute would otherwise be the end phase.
  refreshPowerProjection(G);
  // 31.0: the Great War ends immediately when an alliance is defeated, so a
  // battle that eliminates the last-but-one power of an alliance (or its last
  // power) closes the war here rather than waiting for the winter step.
  if (G.gw?.active) checkGwVictory(G, ctx);
  // Open 18.8's follow-up now when nothing else owns the decision; otherwise
  // the enclosing move calls `maybeOpenDecisiveFollowUp` after it clears the
  // card/loss decision.
  if (!G.result) maybeOpenDecisiveFollowUp(G, ctx);
};

/**
 * 28.1.1/18.7: resolve the losing side's `combatRetreat` choice and finish the
 * battle with that destination.  Returns false for a stale/illegal option so
 * the decision stays open.
 */
export const resolveCombatRetreat = (
  G: ImperialElegyState,
  ctx: Ctx,
  optionId: string,
): boolean => {
  const battle = G.battle;
  const pending = G.pending;
  if (!battle || !pending || pending.kind !== "combatRetreat") return false;
  const destinations = Array.isArray(pending.context?.destinations)
    ? (pending.context.destinations as unknown[]).filter((id): id is SpaceId => typeof id === "string")
    : [];
  const rawUnitDestinations = pending.context?.unitDestinations;
  const unitDestinations: Record<string, SpaceId[]> | undefined =
    rawUnitDestinations !== null && typeof rawUnitDestinations === "object"
      ? Object.fromEntries(
        Object.entries(rawUnitDestinations as Record<string, unknown>).map(([unitId, value]) => [
          unitId,
          Array.isArray(value) ? value.filter((id): id is SpaceId => typeof id === "string") : [],
        ]),
      )
      : undefined;
  const unitIds = Array.isArray(pending.context?.unitIds)
    ? (pending.context.unitIds as unknown[]).filter((id): id is string => typeof id === "string")
    : [];
  if (!pending.options.some((entry) => entry.id === optionId)) return false;
  let assignments: RetreatAssignment[];
  if (optionId.startsWith("split:")) {
    const parsed = decodeRetreatAssignments(optionId);
    if (!parsed || unitIds.length === 0) return false;
    const seen = new Set<string>();
    for (const entry of parsed) {
      if (seen.has(entry.unitId)) return false;
      seen.add(entry.unitId);
      if (!unitIds.includes(entry.unitId)) return false;
      const allowed = unitDestinations?.[entry.unitId] ?? destinations;
      if (!allowed.includes(entry.space)) return false;
    }
    if (seen.size !== unitIds.length) return false;
    assignments = parsed;
  } else {
    if (!destinations.includes(optionId as SpaceId)) return false;
    // A group choice is stored as one assignment per unit so the second
    // finishBattle pass is uniform.
    assignments = unitIds.map((unitId) => ({unitId, space: optionId as SpaceId}));
    if (assignments.length === 0) assignments = [{unitId: "", space: optionId as SpaceId}];
  }
  G.pending = null;
  battle.retreatAssignments = assignments;
  battle.retreatTo = assignments[0]?.space;
  const distinct = [...new Set(assignments.map((entry) => entry.space))];
  log(G, pending.power, "combatRetreat", {
    space: battle.to,
    to: distinct[0],
    ...(distinct.length > 1 ? {destinations: distinct.join(",")} : {}),
  });
  finishBattle(G, ctx);
  return true;
};

export interface NavalBattleOptions {
  /**
   * Interception (19.1): the defending ships may have moved into the battle
   * space, so they are supplied explicitly instead of being read from `to`.
   */
  defenderUnits?: string[];
  /**
   * 19.0: a naval move ends with the active player's ships already in the
   * contacted space, so the main attack force is supplied explicitly instead of
   * being read from `from` (which is still the origin for retreat purposes).
   */
  attackerUnits?: string[];
  /** 19.5 footnote: the adjacent box the attacker chose for a port battle. */
  portBox?: SpaceId;
}

// ---------------------------------------------------------------------------
// 19.1 Naval interception
// ---------------------------------------------------------------------------

export interface InterceptionResult {
  roll: number;
  drm: number;
  total: number;
  success: boolean;
  notes: string[];
  battle: BattleState | null;
}

/**
 * 19.1.1 interception DRMs.  The intercepting player needs a 5+ on one die.
 */
export const interceptionModifiers = (
  G: ImperialElegyState,
  mover: Power,
  interceptor: Power,
  box: SpaceId,
): {drm: number; notes: string[]} => {
  const notes: string[] = [];
  let drm = 0;
  const ports = Object.values(SPACES).filter((def) => def.ports?.includes(box));
  if (ports.filter((def) => friendlySpace(G, def.id, interceptor)).length >= 3) {
    drm += 1;
    notes.push("threeFriendlyPorts");
  }
  if (!ports.some((def) => friendlySpace(G, def.id, mover))) {
    drm += 1;
    notes.push("moverNoFriendlyPorts");
  }
  if (navalUnitsIn(G, box).some((unit) => unit.owner === interceptor)) {
    drm += 1;
    notes.push("friendlyShipsInBox");
  }
  if (interceptor === "UK" && box === "north-atlantic") {
    drm += 1;
    notes.push("ukNorthAtlantic");
  }
  return {drm, notes};
};

/**
 * Resolve one port's interception attempt: roll 19.1.1, and on success move
 * the intercepting ships into the box and start a naval battle with the active
 * player as the attacker (19.1).  Returns the structured roll for the log/tests.
 */
export const attemptInterception = (
  G: ImperialElegyState,
  ctx: Ctx,
  mover: Power,
  interceptor: Power,
  port: SpaceId,
  box: SpaceId,
): InterceptionResult => {
  const {drm, notes} = interceptionModifiers(G, mover, interceptor, box);
  const roll = die(ctx, 6);
  const total = roll + drm;
  if (total < 5) {
    log(G, interceptor, "navalInterception", {roll, drm, total, success: false, port, box});
    return {roll, drm, total, success: false, notes, battle: null};
  }
  const ships = navalUnitsIn(G, port).filter((unit) => unit.owner === interceptor);
  if (ships.length === 0) {
    log(G, interceptor, "navalInterception", {roll, drm, total, success: false, port, box, reason: "noShips"});
    return {roll, drm, total, success: false, notes, battle: null};
  }
  for (const ship of ships) moveUnitTo(G, ship, box);
  // 19.1: the reactive `navalIntercept` move is a separate entry point, so
  // record the interrupted movement before the battle (which may auto-resolve)
  // so the mover can finish it after winning.  The live contact window already
  // recorded the richer state (origin + joint ally).
  const priorContinuation = G.navalContinuation;
  if (priorContinuation === null || priorContinuation === undefined) {
    G.navalContinuation = {
      power: mover,
      from: box,
      contact: box,
      unitIds: navalUnitsIn(G, box)
        .filter((unit) => unit.owner === mover && unit.steps > 0)
        .map((unit) => unit.id),
      intercepted: true,
    };
  }
  // The successful interceptor joins any fleet already contacted in the box;
  // the battle is against every hostile ship there (the default defence list),
  // so the contacted defender and the interceptor fight together.
  const battle = beginNavalBattle(G, ctx, mover, box, box);
  if (battle === null) G.navalContinuation = priorContinuation ?? null;
  log(G, interceptor, "navalInterception", {
    roll,
    drm,
    total,
    success: battle !== null,
    port,
    box,
    ships: ships.map((ship) => ship.id),
  });
  return {roll, drm, total, success: battle !== null, notes, battle};
};

/** 19.1: one adjacent port whose ships may attempt to intercept. */
export interface NavalInterceptCandidate {
  power: Power;
  port: SpaceId;
}

/**
 * 19.1: "when the active player's units move into a naval box that is connected
 * to a port containing enemy naval units, those enemy naval units may attempt
 * to intercept".  Multiple players and spaces may intercept the same move; each
 * port makes its own roll.  Candidates are ordered deterministically by power
 * seat then port id so the interception window is stable across clients.
 */
export const navalInterceptCandidates = (
  G: ImperialElegyState,
  mover: Power,
  box: SpaceId,
): NavalInterceptCandidate[] => {
  const out: NavalInterceptCandidate[] = [];
  if (!isNavalBox(box)) return out;
  for (const def of Object.values(SPACES)) {
    if (!def.ports?.includes(box)) continue;
    if (!G.spaces[def.id]) continue;
    const owners = [
      ...new Set(
        navalUnitsIn(G, def.id)
          .filter((unit) => unit.steps > 0 && isPower(unit.owner) && atWar(G, mover, unit.owner))
          .map((unit) => unit.owner as Power),
      ),
    ];
    for (const owner of owners) {
      if (!friendlySpace(G, def.id, owner)) continue;
      out.push({power: owner, port: def.id});
    }
  }
  return out.sort(
    (a, b) =>
      POWERS.indexOf(a.power) - POWERS.indexOf(b.power) ||
      a.port.localeCompare(b.port, "en"),
  );
};

const encodeInterceptCandidate = (candidate: NavalInterceptCandidate): string =>
  `${candidate.power}|${candidate.port}`;

const decodeInterceptCandidates = (value: unknown): NavalInterceptCandidate[] => {
  if (!Array.isArray(value)) return [];
  const out: NavalInterceptCandidate[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const [power, port] = entry.split("|");
    if (!isPower(power) || typeof port !== "string" || port === "") continue;
    out.push({power, port});
  }
  return out;
};

/**
 * 19.1 transit candidates: ports adjacent to an intermediate box.  A fleet in
 * the move's final destination port is not an interceptor — the normal
 * 19.0/19.1/19.2 contact chain at that destination handles it — so it is
 * excluded here to avoid double-counting the same contact.
 */
const transitInterceptCandidates = (
  G: ImperialElegyState,
  mover: Power,
  hop: SpaceId,
  destination: SpaceId,
): NavalInterceptCandidate[] =>
  navalInterceptCandidates(G, mover, hop).filter((candidate) => candidate.port !== destination);

/**
 * 19.1: after an interception window exhausts at an intermediate box, resume
 * the interrupted naval movement (a transit hop) instead of opening 19.2
 * avoidance — there are no enemy ships in the box to fight.  Every other
 * window still hands over to avoidance/battle at its destination.
 */
function resumeInterruptedNavalMove(
  G: ImperialElegyState,
  ctx: Ctx,
  attacker: Power,
  from: SpaceId,
  to: SpaceId,
  attackerUnits: readonly string[],
): boolean {
  const transit = G.navalTransit;
  if (transit !== null && transit !== undefined && transit.power === attacker && transit.path[transit.index] === to) {
    G.navalContinuation = null;
    return advanceNavalTransit(G, ctx);
  }
  return openNavalAvoidOrBattle(G, ctx, attacker, from, to, attackerUnits);
}

/**
 * 19.1: open the interception window at the box a transit move currently
 * occupies.  A won interception is handed to the normal 19.1 continuation
 * (`navalContinuation`), so the mover can finish the move without spending
 * another action.
 */
function beginTransitWindow(G: ImperialElegyState, ctx: Ctx, transit: NavalTransitState): boolean {
  const hop = transit.path[transit.index];
  const from = transit.path[transit.index - 1];
  const destination = transit.path[transit.path.length - 1];
  if (hop === undefined || from === undefined) return false;
  const candidates = transitInterceptCandidates(G, transit.power, hop, destination);
  if (candidates.length === 0) return advanceNavalTransit(G, ctx);
  G.navalContinuation = {
    power: transit.power,
    from,
    contact: hop,
    unitIds: [...transit.unitIds],
    ...(transit.ally === undefined ? {} : {ally: transit.ally}),
    intercepted: true,
  };
  return openNavalInterceptionWindow(G, ctx, transit.power, from, hop, transit.unitIds, candidates);
}

/**
 * 19.1 transit interception: a multi-box naval move enters each box in turn, so
 * a box connected to an enemy port can be intercepted even when it is not the
 * final destination.  `navalMove` parks the fleet in the first such box and
 * opens the window; when every attempt fails (or is declined) this helper
 * walks on to the next interceptable box, or finishes the movement at the
 * planned destination and runs the normal 19.0/19.2 contact chain there.
 */
export function advanceNavalTransit(G: ImperialElegyState, ctx: Ctx): boolean {
  const transit = G.navalTransit;
  if (transit === null || transit === undefined) return false;
  if (G.pending !== null || G.battle !== null) return false;
  const current = transit.path[transit.index];
  const units = transit.unitIds
    .map((id) => G.units[id])
    .filter((unit): unit is Unit => Boolean(unit) && unit!.space === current && unit!.steps > 0);
  if (units.length === 0) {
    G.navalTransit = null;
    return false;
  }
  const destination = transit.path[transit.path.length - 1];
  for (let index = transit.index + 1; index < transit.path.length - 1; index += 1) {
    const hop = transit.path[index];
    if (!isNavalBox(hop)) continue;
    if (transitInterceptCandidates(G, transit.power, hop, destination).length === 0) continue;
    for (const unit of units) moveUnitTo(G, unit, hop);
    const next: NavalTransitState = {...transit, index, unitIds: units.map((unit) => unit.id)};
    G.navalTransit = next;
    return beginTransitWindow(G, ctx, next);
  }
  const to = transit.path[transit.path.length - 1];
  const from = current;
  G.navalTransit = null;
  const defenders = navalUnitsIn(G, to).filter((unit) => hostileOwner(G, transit.power, unit.owner));
  if (defenders.length === 0 && movementEndProblem(G, to, units) !== null) {
    // The destination would end overstacked (it cannot happen for a route the
    // planner already validated with the same units, but never park illegally).
    log(G, transit.power, "navalContinuation", {from, stopped: true, units: units.length});
    return true;
  }
  for (const unit of units) moveUnitTo(G, unit, to);
  // 12.3/15.3: a transported land unit that completes an interrupted move can
  // occupy the destination port; a pure naval move leaves occupation alone.
  if (units.some((unit) => unit.naval !== true)) recordOccupation(G, to);
  log(G, transit.power, "navalContinuation", {from, to, units: units.length});
  const interceptAtDestination =
    isNavalBox(to) && navalInterceptCandidates(G, transit.power, to).length > 0;
  if ((defenders.length > 0 || interceptAtDestination) && G.battle === null) {
    openNavalContactDecision(G, ctx, transit.power, from, to, units.map((unit) => unit.id), {
      ...(transit.ally === undefined ? {} : {ally: transit.ally}),
    });
  }
  return true;
}

/**
 * 19.1: the first intermediate box of a planned route that is connected to an
 * enemy port whose ships could intercept.  Deterministic: the earliest hop on
 * the printed path wins, matching the order in which the move enters the boxes.
 */
export const firstTransitInterceptHop = (
  G: ImperialElegyState,
  mover: Power,
  path: readonly SpaceId[],
): number => {
  const destination = path[path.length - 1];
  for (let index = 1; index < path.length - 1; index += 1) {
    const hop = path[index];
    if (!isNavalBox(hop)) continue;
    if (transitInterceptCandidates(G, mover, hop, destination).length > 0) return index;
  }
  return -1;
};

/** 19.1: open a transit window for the move parked by `navalMove`. */
export const openNavalTransitInterception = (G: ImperialElegyState, ctx: Ctx): boolean => {
  const transit = G.navalTransit;
  if (transit === null || transit === undefined) return false;
  if (G.pending !== null || G.battle !== null) return false;
  return beginTransitWindow(G, ctx, transit);
};

/**
 * 19.1: open the interception window for the first eligible port's controller
 * before any 19.2 avoidance decision.  The deciding seat only sees its own
 * ports; when it declines or fails, the window continues with the remaining
 * ports/players and finally hands over to avoidance.
 */
const openNavalInterceptionWindow = (
  G: ImperialElegyState,
  ctx: Ctx,
  attacker: Power,
  from: SpaceId,
  to: SpaceId,
  attackerUnits: readonly string[],
  candidates: readonly NavalInterceptCandidate[],
): boolean => {
  const live = candidates.filter((candidate) =>
    navalInterceptCandidates(G, attacker, to).some(
      (entry) => entry.power === candidate.power && entry.port === candidate.port,
    ),
  );
  if (live.length === 0) {
    return resumeInterruptedNavalMove(G, ctx, attacker, from, to, attackerUnits);
  }
  const power = live[0].power;
  const options = live
    .filter((candidate) => candidate.power === power)
    .map((candidate) =>
      option(`intercept:${candidate.port}`, `Intercept from ${spaceLabel(candidate.port, "en")}`, {
        port: candidate.port,
      }),
    );
  // Declining is always available, so the window can never deadlock.
  options.push(option("skip", "Do not intercept"));
  openDecision(G, ctx, decision(
    "navalInterception",
    power,
    "Naval interception: a port may attempt to intercept the move before the defender decides whether to avoid battle",
    options,
    {
      attacker,
      from,
      to,
      attackerUnits: [...attackerUnits],
      candidates: live.map(encodeInterceptCandidate),
    },
  ));
  return true;
};

/**
 * 19.1/19.2: resolve one interception window.  A successful interception starts
 * the battle immediately (intercepted/intercepting ships cannot avoid); a
 * failure continues with the remaining ports, then opens avoidance.
 */
export const resolveNavalInterception = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): boolean => {
  if (pending.kind !== "navalInterception") return false;
  const context = pending.context ?? {};
  const attacker = isPower(context.attacker) ? context.attacker : null;
  const from = typeof context.from === "string" ? context.from : "";
  const to = typeof context.to === "string" ? context.to : "";
  const attackerUnits = Array.isArray(context.attackerUnits)
    ? (context.attackerUnits as unknown[]).filter((id): id is string => typeof id === "string")
    : [];
  const candidates = decodeInterceptCandidates(context.candidates);
  if (attacker === null || from === "" || to === "") return false;
  if (!pending.options.some((entry) => entry.id === optionId)) return false;
  G.pending = null;
  const continueWindow = (remaining: NavalInterceptCandidate[]): boolean =>
    remaining.length === 0
      ? resumeInterruptedNavalMove(G, ctx, attacker, from, to, attackerUnits)
      : openNavalInterceptionWindow(G, ctx, attacker, from, to, attackerUnits, remaining);
  if (optionId === "skip") {
    // Commit the decline even if nothing further opens (the roll/decision must
    // not be rolled back by an INVALID_MOVE return).
    continueWindow(candidates.filter((candidate) => candidate.power !== pending.power));
    return true;
  }
  if (!optionId.startsWith("intercept:")) return false;
  const port = optionId.slice("intercept:".length);
  if (!candidates.some((candidate) => candidate.power === pending.power && candidate.port === port)) {
    return false;
  }
  const result = attemptInterception(G, ctx, attacker, pending.power, port, to);
  const remaining = candidates.filter(
    (candidate) => !(candidate.power === pending.power && candidate.port === port),
  );
  if (result.success && result.battle !== null) {
    // A battle interrupts the movement: the 19.1 continuation (on a win) owns
    // how the move finishes, so the transit cursor is no longer needed.
    G.navalTransit = null;
    return true;
  }
  continueWindow(remaining);
  return true;
};

/** 19.1/19.2/19.0: hand a contacted move to avoidance, or straight to battle. */
const openNavalAvoidOrBattle = (
  G: ImperialElegyState,
  ctx: Ctx,
  attacker: Power,
  from: SpaceId,
  to: SpaceId,
  attackerUnits: readonly string[],
): boolean => {
  if (G.pending !== null || G.battle !== null) return false;
  // 19.3: a naval battle exists only when hostile units share the space.  A box
  // whose adjacent enemy ports declined/failed to intercept leaves nothing to
  // fight, so the move simply finishes there.
  const defendersPresent = navalUnitsIn(G, to).some((unit) => hostileOwner(G, attacker, unit.owner));
  if (!defendersPresent) return false;
  const defender = navalDefenderPower(G, to);
  if (defender !== null && defender !== attacker) {
    return openNavalAvoidDecision(G, ctx, attacker, defender, from, to, attackerUnits);
  }
  return beginNavalBattle(G, ctx, attacker, from, to, {
    attackerUnits: attackerUnits.length > 0 ? [...attackerUnits] : undefined,
  }) !== null;
};

/**
 * 19.0/19.1/19.2: the live contact chain for a naval move that ends in a space
 * containing enemy ships — interception first, then the defender's avoidance
 * decision, then battle.
 */
export const openNavalContactDecision = (
  G: ImperialElegyState,
  ctx: Ctx,
  attacker: Power,
  from: SpaceId,
  to: SpaceId,
  attackerUnits: readonly string[],
  options: {ally?: Power} = {},
): boolean => {
  if (G.pending !== null || G.battle !== null) return false;
  G.navalContinuation = null;
  if (isNavalBox(to)) {
    const candidates = navalInterceptCandidates(G, attacker, to);
    if (candidates.length > 0) {
      // 19.1: the interception interrupts the naval movement.  Record the
      // interrupted move now so `finishBattle` can offer the winner the
      // printed right to finish it without spending another action.
      G.navalContinuation = {
        power: attacker,
        from,
        contact: to,
        unitIds: [...attackerUnits],
        ...(options.ally === undefined ? {} : {ally: options.ally}),
        intercepted: true,
      };
      return openNavalInterceptionWindow(G, ctx, attacker, from, to, attackerUnits, candidates);
    }
  }
  return openNavalAvoidOrBattle(G, ctx, attacker, from, to, attackerUnits);
};

/** 19.5: the port-count battle DRMs for each side, in one place. */
export interface NavalPortBattleModifiers {
  attackerDrm: number;
  defenderDrm: number;
  notes: string[];
}

/**
 * 19.5's port-count BDRMs (distinct from 19.2's avoid-roll DRMs):
 *
 *   - "No friendly ports adjacent to embattled area: -2" (per side);
 *   - ">= 2 more ports than your opponent adjacent to embattled area: +1".
 *
 * The footnote treats a port battle as taking place in an adjacent naval box;
 * when the port touches two boxes the attacker's `portBox` choice supplies the
 * only box that counts, with the deterministic union fallback for direct
 * callers that never made the choice.
 */
export const navalPortBattleModifiers = (
  G: ImperialElegyState,
  attacker: Power,
  defender: Power,
  space: SpaceId,
  box?: SpaceId,
): NavalPortBattleModifiers => {
  const boxes = isNavalBox(space)
    ? [space]
    : box !== undefined && portBoxes(space).includes(box)
      ? [box]
      : portBoxes(space);
  const adjacentPorts = Object.values(SPACES).filter(
    (def) => def.ports !== undefined && boxes.some((entry) => def.ports!.includes(entry)),
  );
  const count = (power: Power): number =>
    adjacentPorts.filter((def) => friendlySpace(G, def.id, power)).length;
  const attackerPorts = count(attacker);
  const defenderPorts = count(defender);
  const notes: string[] = [];
  let attackerDrm = 0;
  let defenderDrm = 0;
  if (attackerPorts === 0) {
    attackerDrm -= 2;
    notes.push("attackerNoPortsBattle");
  } else if (attackerPorts - defenderPorts >= 2) {
    attackerDrm += 1;
    notes.push("attackerPortAdvantageBattle");
  }
  if (defenderPorts === 0) {
    defenderDrm -= 2;
    notes.push("defenderNoPortsBattle");
  } else if (defenderPorts - attackerPorts >= 2) {
    defenderDrm += 1;
    notes.push("defenderPortAdvantageBattle");
  }
  return {attackerDrm, defenderDrm, notes};
};

export const beginNavalBattle = (
  G: ImperialElegyState,
  ctx: Ctx,
  actor: Power,
  from: SpaceId,
  to: SpaceId,
  options: NavalBattleOptions = {},
): BattleState | null => {
  // The active player attacks with their own ships and controlled minor
  // squadrons, never with a neutral or allied player's fleet sharing the box.
  const explicitAttack = options.attackerUnits
    ?.map((id) => unitById(G, id))
    .filter((unit): unit is Unit => Boolean(unit) && unit!.naval === true && unit!.steps > 0);
  const rawAttack = explicitAttack ?? navalUnitsIn(G, from).filter(
    (unit) => unit.owner === actor || (!isPower(unit.owner) && G.spaces[from].ally === actor),
  );
  const explicitDefence = options.defenderUnits
    ?.map((id) => unitById(G, id))
    .filter((unit): unit is Unit => Boolean(unit) && unit!.naval === true && unit!.steps > 0);
  const rawDefence = explicitDefence ?? navalUnitsIn(G, to).filter((u) => hostileOwner(G, actor, u.owner));
  // 5.5.4 / 19.7: a port can be attacked with at most four naval units, and an
  // overstacked port contributes at most four.  Keep the strongest ships
  // deterministically.
  const byStrength = (a: Unit, b: Unit): number => (b.steps - a.steps) || a.id.localeCompare(b.id);
  const portBattle = !isNavalBox(to);
  const attackUnits = portBattle && rawAttack.length > PORT_NAVAL_LIMIT
    ? [...rawAttack].sort(byStrength).slice(0, PORT_NAVAL_LIMIT)
    : rawAttack;
  const defendUnits = portBattle && rawDefence.length > PORT_NAVAL_LIMIT
    ? [...rawDefence].sort(byStrength).slice(0, PORT_NAVAL_LIMIT)
    : rawDefence;
  if (attackUnits.length === 0) return null;
  const defender = (defendUnits.find((u) => isPower(u.owner))?.owner as Power) ?? (G.spaces[to].control as Power) ?? actor;
  const battle: BattleState = {
    kind: "naval",
    attacker: actor,
    defender,
    from,
    to,
    mainAttack: attackUnits.map((u) => u.id),
    mainDefense: defendUnits.map((u) => u.id),
    forceOwners: {attacker: attackUnits.map((u) => u.owner), defender: defendUnits.map((u) => u.owner)},
    supportAttack: [],
    supportDefense: [],
    stage: "roll",
    supportSide: "attacker",
    attackerDrm: 0,
    defenderDrm: 0,
    attackerLosses: 0,
    defenderLosses: 0,
    decisive: false,
    notes: [],
  };
  // 19.4: "All keys that are ports inherently have mines.  During naval
  // battles in keys that are ports, the defending player will roll for mines."
  // The minefield is therefore a property of the port, not of a fort.  The
  // actual roll is step 1 of 19.3, made at the start of `resolveBattleRoll`
  // (before the dice); deferring it to that point only lets the pre-dice card
  // window cancel it with IE-A061/IE-A066 (`noMines`).
  if (!isNavalBox(to)) {
    battle.notes.push("minefield");
    battle.mines = 0;
  }
  // 19.5 footnote: remember the adjacent box the attacker chose for a port
  // battle and use it for the printed port-count BDRMs.
  if (!isNavalBox(to) && options.portBox !== undefined) battle.portBox = options.portBox;
  // 19.5: apply the port-count battle DRMs (the 19.2 avoid roll keeps its own
  // printed +1/-1 list in `navalAvoidanceModifiers`).
  const portBattleMods = navalPortBattleModifiers(G, battle.attacker, defender, to, battle.portBox);
  battle.attackerDrm += portBattleMods.attackerDrm;
  battle.defenderDrm += portBattleMods.defenderDrm;
  battle.notes.push(...portBattleMods.notes);
  // 19.5: the remaining printed naval battle modifiers.  Stability comes from
  // each side's display (the defender uses its deciding player, never a
  // minor-standing-alone fallback); "only reduced units in battle" and the
  // GW-only exhausted-manpower penalty apply per side.
  const attackerStability = stabilityDrm(G, battle.attacker);
  if (attackerStability !== 0) {
    battle.attackerDrm += attackerStability;
    battle.notes.push("stabilityAttacker");
  }
  const defenderLeader = defenderSupportPower(G, battle);
  const defenderStability = defenderLeader === null ? 0 : stabilityDrm(G, defenderLeader);
  if (defenderLeader !== null && defenderStability !== 0) {
    battle.defenderDrm += defenderStability;
    battle.notes.push("stabilityDefender");
  }
  if (isReducedOnly(attackUnits)) {
    battle.attackerDrm -= 1;
    battle.notes.push("reducedOnlyAttacker");
  }
  if (defendUnits.length > 0 && isReducedOnly(defendUnits)) {
    battle.defenderDrm -= 1;
    battle.notes.push("reducedOnlyDefender");
  }
  if (manpowerExhausted(G, battle.attacker)) {
    battle.attackerDrm -= 1;
    battle.notes.push("manpowerExhaustedAttacker");
  }
  if (defenderLeader !== null && manpowerExhausted(G, defenderLeader)) {
    battle.defenderDrm -= 1;
    battle.notes.push("manpowerExhaustedDefender");
  }
  G.battle = battle;
  battle.stage = "cards";
  openCombatCardWindow(G, ctx, battle, "attacker");
  return battle;
};

// ---------------------------------------------------------------------------
// 19.2 Avoiding naval battle
// ---------------------------------------------------------------------------

/** Non-ocean naval boxes (19.2): the four seas named in the rule. */
const NON_OCEAN_BOXES: readonly SpaceId[] = [
  "western-mediterranean",
  "eastern-mediterranean",
  "baltic-sea",
  "black-sea",
];

export interface NavalAvoidanceModifiers {
  drm: number;
  notes: string[];
}

/**
 * 19.2 avoidance DRMs.  The avoiding player needs a modified 5+ on one die.
 * When the battle is in a port the embattled area is treated as an adjacent
 * naval box for the port-count DRMs (19.5's stated port convention).  A port
 * adjacent to two boxes uses the box the attacker chose in the live
 * `navalPortBox` decision; direct callers that pass no box keep the
 * deterministic union fallback.
 */
export const navalAvoidanceModifiers = (
  G: ImperialElegyState,
  attacker: Power,
  defender: Power,
  space: SpaceId,
  box?: SpaceId,
): NavalAvoidanceModifiers => {
  const notes: string[] = [];
  let drm = 0;
  const oceanBox = isNavalBox(space) && !NON_OCEAN_BOXES.includes(space);
  if (oceanBox) {
    drm += 1;
    notes.push("oceanBox");
  }
  // 19.5 footnote: a port battle is treated as taking place in an adjacent
  // naval box.  When the attacker chose the box (two-box port), only that
  // box's ports count; the union fallback below is for direct callers.
  const boxes = isNavalBox(space)
    ? [space]
    : box !== undefined && portBoxes(space).includes(box)
      ? [box]
      : portBoxes(space);
  const adjacentPorts = Object.values(SPACES).filter(
    (def) => def.ports !== undefined && boxes.some((entry) => def.ports!.includes(entry)),
  );
  const attackerPorts = adjacentPorts.filter((def) => friendlySpace(G, def.id, attacker)).length;
  const defenderPorts = adjacentPorts.filter((def) => friendlySpace(G, def.id, defender)).length;
  if (attackerPorts === 0) {
    drm += 1;
    notes.push("attackerNoPorts");
  }
  if (attackerPorts - defenderPorts >= 2) {
    drm -= 1;
    notes.push("attackerPortAdvantage");
  }
  return {drm, notes};
};

/**
 * The player who decides on behalf of the naval defenders, or null when only
 * independently controlled non-player ships are present.
 */
export const navalDefenderPower = (G: ImperialElegyState, space: SpaceId): Power | null => {
  const player = navalUnitsIn(G, space).find((unit) => isPower(unit.owner))?.owner;
  if (isPower(player)) return player;
  const control = G.spaces[space]?.control;
  if (isPower(control)) return control;
  const ally = G.spaces[space]?.ally;
  return isPower(ally) ? ally : null;
};

/** One legal 19.2 destination: a naval box, or one or more ports. */
export interface NavalAvoidPlan {
  /** The chosen space (a naval box, or the primary port). */
  space: SpaceId;
  /** Ports the fleet is split across (empty for a naval box). */
  ports: SpaceId[];
}

/**
 * 19.2: the defensive fleet chooses a destination before rolling.  Legal
 * destinations are friendly ports or naval boxes that do not contain enemy
 * units and were not the space the attack came from.  The route must be a legal
 * naval move (12.3 gates) and may not cross a hostile Gibraltar (19.2).  When a
 * port's capacity of four would be exceeded, the plan splits the fleet across
 * further friendly ports; one die roll still decides.
 */
export const navalAvoidPlans = (
  G: ImperialElegyState,
  attacker: Power,
  defender: Power,
  space: SpaceId,
  attackedFrom: SpaceId,
): NavalAvoidPlan[] => {
  // The defending fleet is exactly the block beginNavalBattle treats as the
  // main defence: every ship hostile to the attacker (including a controlled
  // minor's squadrons).
  const ships = unitsIn(G, space).filter(
    (unit) => unit.naval === true && unit.steps > 0 && hostileOwner(G, attacker, unit.owner),
  );
  if (ships.length === 0) return [];
  const single: {space: SpaceId; ports: SpaceId[]}[] = [];
  const portCandidates: SpaceId[] = [];
  for (const def of Object.values(SPACES)) {
    if (def.id === space || def.id === attackedFrom) continue;
    const state = G.spaces[def.id];
    if (!state) continue;
    const isBox = def.type === "navalBox";
    const isPort = (def.ports?.length ?? 0) > 0;
    if (!isBox && !isPort) continue;
    if (isPort && !friendlySpace(G, def.id, defender)) continue;
    // "Players cannot avoid battle into a naval box containing enemy units."
    // Side-aware: a friendly minor's squadron in the box is not an enemy.
    if (spaceHostileTo(G, defender, def.id)) continue;
    const plan = planNavalMove(G, defender, space, def.id);
    if (!plan.ok) continue;
    if (crossesHostileGibraltar(G, defender, plan.path)) continue;
    if (isBox) {
      single.push({space: def.id, ports: []});
      continue;
    }
    portCandidates.push(def.id);
    const capacity = PORT_NAVAL_LIMIT - navalUnitsIn(G, def.id).length;
    if (capacity >= ships.length) single.push({space: def.id, ports: [def.id]});
  }
  // Split into two or more ports when the first port cannot hold the fleet.
  for (const primary of portCandidates) {
    if (single.some((plan) => plan.space === primary)) continue;
    const ports = [primary];
    let room = PORT_NAVAL_LIMIT - navalUnitsIn(G, primary).length;
    for (const other of portCandidates) {
      if (room >= ships.length) break;
      if (other === primary) continue;
      const free = PORT_NAVAL_LIMIT - navalUnitsIn(G, other).length;
      if (free <= 0) continue;
      ports.push(other);
      room += free;
    }
    if (room >= ships.length) single.push({space: primary, ports});
  }
  return single;
};

/**
 * 19.2: open the naval defender's avoid/fight decision.  The attacker is always
 * the active player; the decision belongs to the defending player.
 *
 * 19.5 footnote: "if the battle is in a port, treat the embattled area as
 * taking place in an adjacent naval box ... if the port is adjacent to two
 * naval boxes the attacker chooses the naval box".  The attacker is offered
 * that choice first; the chosen box is then used for the port-count DRMs (both
 * the 19.5 list and the 19.2 avoid roll).  Direct callers that pass no box keep
 * the deterministic union fallback.
 */
export const openNavalAvoidDecision = (
  G: ImperialElegyState,
  ctx: Ctx,
  attacker: Power,
  defender: Power,
  from: SpaceId,
  to: SpaceId,
  unitIds: readonly string[],
  box?: SpaceId,
): boolean => {
  if (G.pending !== null || G.battle !== null) return false;
  const boxes = isNavalBox(to) ? [] : portBoxes(to);
  if (boxes.length > 1 && box === undefined) {
    openDecision(G, ctx, decision(
      "navalPortBox",
      attacker,
      "Port battle adjacent to two naval boxes: the attacker chooses the box used for the 19.5 port-count DRMs",
      boxes.map((candidate) =>
        option(
          `box:${candidate}`,
          `Treat the battle as being in ${spaceLabel(candidate, "en")}`,
          {box: candidate},
        ),
      ),
      {attacker, defender, from, to, attackerUnits: [...unitIds]},
    ));
    return true;
  }
  const plans = navalAvoidPlans(G, attacker, defender, to, from);
  const options = plans.map((plan) =>
    option(
      `avoid:${plan.space}`,
      plan.ports.length > 1
        ? `Avoid battle to ${spaceLabel(plan.space, "en")} (split across ${plan.ports.length} ports)`
        : `Avoid battle to ${spaceLabel(plan.space, "en")}`,
      {space: plan.space, ports: plan.ports},
    ),
  );
  // A "fight" option is always available, so the decision can never deadlock.
  options.push(option("fight", "Fight the naval battle"));
  openDecision(G, ctx, decision(
    "navalAvoid",
    defender,
    box === undefined
      ? "Naval battle: attempt to avoid battle (choose the destination before rolling) or fight"
      : `Naval battle at ${spaceLabel(to, "en")} (treated as ${spaceLabel(box, "en")} for port DRMs): attempt to avoid battle or fight`,
    options,
    {
      battle: true,
      attacker,
      from,
      to,
      defender,
      attackerUnits: [...unitIds],
      ...(box === undefined ? {} : {box}),
    },
  ));
  return true;
};

/**
 * 19.5 footnote: resolve the attacker's adjacent-box choice for a port battle
 * that touches two boxes.  The choice re-opens the defender's avoid decision,
 * now using that box for the port-count DRMs.
 */
export const resolveNavalPortBox = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): boolean => {
  if (pending.kind !== "navalPortBox") return false;
  const context = pending.context ?? {};
  const attacker = isPower(context.attacker) ? context.attacker : null;
  const defender = isPower(context.defender) ? context.defender : null;
  const from = typeof context.from === "string" ? context.from : "";
  const to = typeof context.to === "string" ? context.to : "";
  const attackerUnits = Array.isArray(context.attackerUnits)
    ? (context.attackerUnits as unknown[]).filter((id): id is string => typeof id === "string")
    : [];
  if (attacker === null || defender === null || from === "" || to === "") return false;
  if (!pending.options.some((entry) => entry.id === optionId)) return false;
  if (!optionId.startsWith("box:")) return false;
  const box = optionId.slice("box:".length);
  if (!portBoxes(to).includes(box)) return false;
  G.pending = null;
  log(G, attacker, "navalPortBoxChoice", {port: to, box});
  if (G.battle !== null) return true;
  const liveDefender = navalDefenderPower(G, to) ?? defender;
  return openNavalAvoidDecision(G, ctx, attacker, liveDefender, from, to, attackerUnits, box);
};

export interface NavalAvoidanceResult {
  roll: number;
  drm: number;
  total: number;
  success: boolean;
  notes: string[];
  destination: SpaceId;
}

/**
 * Resolve a 19.2 avoid attempt.  On success every defending unit moves to the
 * chosen destination (ships split across the planned ports first, land units
 * travel with the first port/box), and no battle is fought.  The caller starts
 * the battle with the printed "failure to avoid battle" -1 on a failure.
 */
export const attemptNavalAvoidance = (
  G: ImperialElegyState,
  ctx: Ctx,
  attacker: Power,
  defender: Power,
  space: SpaceId,
  plan: NavalAvoidPlan,
  box?: SpaceId,
): NavalAvoidanceResult => {
  const {drm, notes} = navalAvoidanceModifiers(G, attacker, defender, space, box);
  const roll = die(ctx, 6);
  const total = roll + drm;
  const success = total >= 5;
  if (success) {
    const defenders = unitsIn(G, space).filter(
      (unit) => unit.steps > 0 && hostileOwner(G, attacker, unit.owner),
    );
    const ships = defenders.filter((unit) => unit.naval === true);
    const land = defenders.filter((unit) => unit.naval !== true);
    if (plan.ports.length === 0) {
      for (const unit of [...ships, ...land]) moveUnitTo(G, unit, plan.space);
    } else {
      let index = 0;
      for (const port of plan.ports) {
        let room = PORT_NAVAL_LIMIT - navalUnitsIn(G, port).length;
        while (room > 0 && index < ships.length) {
          moveUnitTo(G, ships[index], port);
          index += 1;
          room -= 1;
        }
      }
      for (const unit of land) moveUnitTo(G, unit, plan.ports[0]);
    }
  }
  log(G, defender, "navalAvoidance", {
    roll,
    drm,
    total,
    success,
    space,
    to: plan.space,
    ports: plan.ports.join(","),
  });
  return {roll, drm, total, success, notes, destination: plan.space};
};
