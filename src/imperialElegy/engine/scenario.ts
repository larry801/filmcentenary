/**
 * Scenario rules — the live engine side of `IE_playbook.pdf`'s printed scenarios.
 *
 * `constant/scenarios/` owns the *data* (one module per scenario, transcribed
 * from the playbook pages).  This module owns the *rules* that differ between
 * scenarios, so no `if (scenario === …)` branch is scattered through the moves:
 *
 *  - the campaign window (`firstTurn`/`lastTurn`) that replaces the hard-coded
 *    "after turn 7" checks in the end phase and `endTurn`;
 *  - the decisive end-of-turn NG draws (campaign 1/3/5, 1870 3/5, 1880 4/6);
 *  - the opening `draw 3, keep 1` that the 1870/1880 scenarios print
 *    (rule 20.11's Play Note: "players start with 1 NG in the 1870 and 1880
 *    scenarios");
 *  - the 1880 "OT is dealt one additional card each prep phase";
 *  - Scenario 4's "No GW" victory-condition modifier;
 *  - the GW tutorial's "start at the maneuver step of GW turn 0" entry;
 *  - the alternate-GW build-point setup procedure.
 *
 * Everything here is pure or takes an explicit state, so a scenario rule can be
 * unit-tested without playing a match.
 */

import {Ctx} from "boardgame.io";
import {BuildPointState, ImperialElegyState, Power, POWERS, PowerOrMinor, SpaceId, Unit, UnitKind} from "../types";
import {scenarioById, scenarioOf} from "../constant/scenarios";
import type {ScenarioDef} from "../constant/scenarios/types";
import type {ScenarioId} from "../constant/scenarios/ids";
import {SPACES} from "../constant/spaces";
import {MINOR_POWER_HOMES} from "../constant/setup";
import {placeUnit} from "./effects";
import {isHomeSpace} from "./rules";
import {isArmyKind} from "./rules";

// ---------------------------------------------------------------------------
// The campaign window
// ---------------------------------------------------------------------------

/** The scenario's printed first/last campaign turn. */
export const campaignWindow = (G: ImperialElegyState): {first: number; last: number} => {
  const def = scenarioOf(G);
  return {first: def.firstTurn, last: def.lastTurn};
};

/**
 * True when `turn` is the scenario's final campaign turn.
 *
 * Replaces the campaign's hard-coded `>= 7` in `moves.ts#endPhaseTurn` and
 * `endTurn` so the two four-turn scenarios and the two-turn tutorial end on
 * their own printed turn.
 */
export const isFinalTurn = (G: ImperialElegyState, turn: number = G.turn): boolean =>
  turn >= campaignWindow(G).last;

/** Number of campaign turns the scenario plays. */
export const scenarioLength = (G: ImperialElegyState): number => {
  const {first, last} = campaignWindow(G);
  return Math.max(0, last - first + 1);
};

// ---------------------------------------------------------------------------
// National Goal draws
// ---------------------------------------------------------------------------

/** The turns whose end phase draws NGs in this scenario (20.11). */
export const ngDrawTurns = (G: ImperialElegyState): number[] => scenarioOf(G).special.ngDrawTurns;

/** True when this end phase draws National Goals. */
export const drawsNgsThisTurn = (G: ImperialElegyState): boolean =>
  ngDrawTurns(G).includes(G.turn);

/**
 * How many NGs a power draws in one of 20.11's windows.
 *
 * The print says "draw three NG cards, keep one"; the 1870/1880 scenarios print
 * "The GE player only draws 2 NGs", which is carried in `special.startingGoalDraw`
 * (the same table that seeds the opening draw), so a scenario only states the
 * count once.
 */
export const ngDrawCount = (G: ImperialElegyState, power: Power): number => {
  const special = scenarioOf(G).special;
  return special.ngDrawCount?.[power] ?? special.startingGoalDraw?.[power] ?? 3;
};

/**
 * How many NGs a power starts with before the first prep phase.
 *
 * Rule 20.11's Play Note: "Players do not start the campaign game with any NGs
 * (players start with 1 NG in the 1870 and 1880 scenarios)."  The 1870/1880
 * print expresses that as the opening "draw 3 NGs and pick one" (GE draws 2), so
 * the value stored in `startingGoalDraw` is the *number of cards drawn*; the
 * resulting hand size is always one.
 */
export const openingGoalDraw = (G: ImperialElegyState, power: Power): number =>
  scenarioOf(G).special.startingGoalDraw?.[power] ?? 0;

/** True when the scenario scores VPs at its end (the 1850 tutorial does not). */
export const countsVp = (G: ImperialElegyState): boolean => scenarioOf(G).special.countVp;

// ---------------------------------------------------------------------------
// Prep-phase extras
// ---------------------------------------------------------------------------

/** Extra cards a power is dealt in every prep phase (`1880`: OT one more). */
export const extraPrepCards = (G: ImperialElegyState, power: Power): number =>
  scenarioOf(G).special.extraPrepCards?.[power] ?? 0;

/** True when 33.1 Blood and Iron! applies (campaign only). */
export const hasBloodAndIron = (G: ImperialElegyState): boolean =>
  scenarioOf(G).special.bloodAndIron === true;

// ---------------------------------------------------------------------------
// Scenario 4 — No GW
// ---------------------------------------------------------------------------

/**
 * Scenario 4 (playbook p. 7) is a victory-condition modifier on any scenario.
 *
 * "If the GW does not start, resolve victory normally.  If the GW does start,
 * form alliances, reveal NGs, and count up VPs.  Total the VPs together for all
 * nations in each alliance.  The alliance with more collective VPs wins the
 * game.  In the case of a tie all players lose.  The difference in VPs between
 * the alliances is the margin of victory.  If there is a neutral player(s),
 * compare each neutral player's VP total to the margin of victory.  If the
 * neutral player(s) with the highest VP total has more VPs than the margin of
 * victory, they win the game.  Otherwise all members of the victorious alliance
 * in the war win the game.  In the case of a tie the neutral player(s) wins."
 */
export const isNoGwScenario = (G: ImperialElegyState): boolean => G.noGw === true;

export interface NoGwVictory {
  /** The winning powers. */
  winners: Power[];
  /** Why they won, for the log and the `G.result.reason`. */
  reason: "noGw:allianceVp" | "noGw:neutralVp" | "noGw:tie" | "noGw:single";
  /** The alliance totals that decided it. */
  te: number;
  ta: number;
  /** Margin between the two alliances. */
  margin: number;
  /** The best neutral total, when one was compared. */
  neutralBest: number | null;
}

/**
 * Scenario 4's alliance victory.
 *
 * `scores` is each power's final VP total (the same numbers `scoreGame`
 * computes).  Alliances come from the live GW rosters when the war started
 * (they are authoritative once formed) and from the Alliance Track otherwise.
 */
export const noGwVictory = (
  G: ImperialElegyState,
  scores: Record<Power, number>,
  sideOf: (G: ImperialElegyState, power: Power) => "te" | "ta" | null,
): NoGwVictory => {
  const sides = POWERS.map((power) => ({power, side: sideOf(G, power)}));
  const te = sides.filter((entry) => entry.side === "te");
  const ta = sides.filter((entry) => entry.side === "ta");
  const neutrals = sides.filter((entry) => entry.side === null);
  const sum = (entries: {power: Power}[]): number =>
    entries.reduce((total, entry) => total + (scores[entry.power] ?? 0), 0);
  const teTotal = sum(te);
  const taTotal = sum(ta);
  const margin = Math.abs(teTotal - taTotal);
  const bestSide = teTotal > taTotal ? te : taTotal > teTotal ? ta : [];
  const neutralBest =
    neutrals.length === 0 ? null : Math.max(...neutrals.map((entry) => scores[entry.power] ?? 0));
  // "In the case of a tie all players lose": an equal alliance total is nobody's
  // win, so `winners` is empty (boardgame.io reports no winner).
  if (bestSide.length === 0) {
    return {winners: [], reason: "noGw:tie", te: teTotal, ta: taTotal, margin, neutralBest};
  }
  if (neutralBest !== null && neutralBest >= margin) {
    // "If the neutral player(s) with the highest VP total has more VPs than the
    // margin of victory, they win the game ... In the case of a tie the neutral
    // player(s) wins."  An equal total is therefore a neutral win too.
    const winners = neutrals.filter((entry) => (scores[entry.power] ?? 0) === neutralBest).map((entry) => entry.power);
    return {winners, reason: "noGw:neutralVp", te: teTotal, ta: taTotal, margin, neutralBest};
  }
  const winners = bestSide.map((entry) => entry.power);
  return {
    winners,
    reason: "noGw:allianceVp",
    te: teTotal,
    ta: taTotal,
    margin,
    neutralBest,
  };
};

// ---------------------------------------------------------------------------
// Great War entrances
// ---------------------------------------------------------------------------

/** True when the scenario starts with the Great War already in progress. */
export const startsInGreatWar = (G: ImperialElegyState): boolean =>
  scenarioOf(G).special.gwTutorial !== undefined || scenarioOf(G).special.altGw !== undefined;

/**
 * The GW turn the scenario opens at, or null for a pre-war scenario.
 *
 * The Historical GW tutorial prints "start this scenario with the Maneuver Step
 * of GW turn 0"; the alternate setups are Great Wars from their first step too.
 */
export const startingGwTurn = (G: ImperialElegyState): number | null => {
  const def = scenarioOf(G);
  if (def.special.gwTutorial) return def.special.gwTutorial.turn;
  if (def.special.altGw) return 0;
  return null;
};

// ---------------------------------------------------------------------------
// Alternate GW build points
// ---------------------------------------------------------------------------

/** One way a build point may be spent (playbook p. 8, step 2). */
export type BuildPointSpend = BuildPointState["spends"][number]["field"];

/** Build points each power receives from the scenario's printed list. */
export const buildPointsFor = (def: ScenarioDef, power: Power): number =>
  def.special.altGw?.buildPoints?.[power] ?? 0;

/** Seed the build-point ledger for a scenario (empty for a non-alt setup). */
export const initialBuildPoints = (def: ScenarioDef): BuildPointState | undefined => {
  if (!def.special.altGw) return undefined;
  const remaining: Partial<Record<Power, number>> = {};
  const granted: Partial<Record<Power, number>> = {};
  for (const power of POWERS) {
    const points = buildPointsFor(def, power);
    if (points <= 0) continue;
    remaining[power] = points;
    granted[power] = points;
  }
  return {remaining, granted, spends: []};
};

/** True while a power still has build points to spend. */
export const buildPointsRemaining = (G: ImperialElegyState, power: Power): number =>
  G.buildPoints?.remaining?.[power] ?? 0;

// ---------------------------------------------------------------------------
// The GW tutorial's printed special rules (playbook p. 7)
// ---------------------------------------------------------------------------

/** True when the scenario prints "The UK cannot amphibiously assault GE home
 * spaces containing a GE naval unit(s)." */
export const ukNoAmphibiousGermanPorts = (G: ImperialElegyState): boolean =>
  scenarioOf(G).special.gwSpecial?.ukNoAmphibiousGermanPorts === true;

/**
 * The UK amphibious restriction in one predicate.
 *
 * "GE home spaces containing a GE naval unit(s)": the space is a German home
 * space — the engine's `isHomeSpace`, so a printed home, an annexed unification
 * space and a `homeOverride` all count — and a German naval unit is in it.  The
 * attacker must be the UK.  19.10 makes the home space's port the landing
 * target, so the naval unit is looked for in the port itself and in the naval
 * box it opens onto (a fleet at sea still guards its home port).
 */
export const blocksUkAmphibiousPort = (
  G: ImperialElegyState,
  power: Power,
  port: SpaceId,
): boolean => {
  if (power !== "UK") return false;
  const space = G.spaces[port];
  if (!space) return false;
  if (!isHomeSpace(G, port, "GE")) return false;
  return (space.units ?? []).some((id) => {
    const unit = G.units[id];
    return unit !== undefined && unit.owner === "GE" && unit.naval === true;
  });
};

/** True when the scenario prints "OT will join the Triple Alliance during the
 * winter step of GW turn 0." */
export const ottomanJoinsTaInWinter = (G: ImperialElegyState): boolean =>
  scenarioOf(G).special.gwSpecial?.ottomanJoinsTaInWinter === true;

/** True when the scenario prints "If AU does not launch a land battle against
 * Serbia on GW turn 0 they lose one stability." */
export const auSerbiaBattleOrStability = (G: ImperialElegyState): boolean =>
  scenarioOf(G).special.gwSpecial?.auSerbiaBattleOrStability === true;

/**
 * Apply the GW tutorial's AU/Serbia clause at the end of GW turn 0.
 *
 * "If AU does not launch a land battle against Serbia on GW turn 0 they lose one
 * stability."  The record of the battles fought is `G.gw.turnZeroBattles` (the
 * live battle path appends `{attacker, to}`); the clause is applied once.
 */
export const applyAuSerbiaClause = (
  G: ImperialElegyState,
  sawAustrianSerbianBattle: boolean,
  changeStability: (G: ImperialElegyState, power: Power, delta: number) => void,
): boolean => {
  if (!auSerbiaBattleOrStability(G)) return false;
  if (G.gw?.turn !== 0) return false;
  if (G.persistent.auSerbiaClauseApplied === true) return false;
  G.persistent.auSerbiaClauseApplied = true;
  if (sawAustrianSerbianBattle) return false;
  changeStability(G, "AU", -1);
  return true;
};

/**
 * Apply the GW tutorial's "OT joins the Triple Alliance during the winter step
 * of GW turn 0" clause.  Idempotent; only runs for the scenario that prints it.
 */
export const applyOttomanWinterJoin = (G: ImperialElegyState): boolean => {
  if (!ottomanJoinsTaInWinter(G)) return false;
  if (G.gw?.turn !== 0) return false;
  if (G.persistent.ottomanWinterJoinApplied === true) return false;
  G.persistent.ottomanWinterJoinApplied = true;
  if (!G.gw) return false;
  if (G.gw.belligerents.includes("OT")) return false;
  G.powers.OT.alliance = "taCommitted";
  G.gw.ta.push("OT");
  G.gw.neutrals = G.gw.neutrals.filter((power) => power !== "OT");
  G.gw.belligerents.push("OT");
  return true;
};

// ---------------------------------------------------------------------------
// Setup helpers shared with engine/setup.ts
// ---------------------------------------------------------------------------

/** The printed space of a minor power (falls back to the map's `minorHome`). */
export const minorHomeSpace = (minor: string): SpaceId | undefined => MINOR_POWER_HOMES[minor];

/**
 * Units an alternate-GW scenario still has to place.
 *
 * The printed procedure makes the *positions* a secret player choice ("players
 * will secretly write down the location of their starting units"), so the data
 * carries the inventory by kind and the game places it at the power's capital
 * and home keys, which is the legal deterministic default.
 */
export const altGwInventory = (
  def: ScenarioDef,
  power: Power | "Italy",
): {kind: UnitKind; count: number; flags?: {indian?: true; arab?: true; cw?: true}}[] =>
  def.special.altGw?.units?.[power] ?? [];

/** Reserved stack limit during the alternate setup: two armies per space. */
export const ALT_GW_SETUP_STACK_LIMIT = 2;

/**
 * Place an alternate-GW power's printed unit inventory.
 *
 * Deterministic default: reserve armies go to the holding box, the first army
 * goes to the capital and the rest fill the power's controlled home keys in
 * name order, two armies per space (the printed setup stack limit).  Naval
 * units go to the capital's port, else the first friendly port.  Returns the
 * units it placed so the setup can log them.
 */
export const placeAltGwInventory = (
  G: ImperialElegyState,
  owner: PowerOrMinor,
  inventory: {kind: UnitKind; count: number; flags?: {indian?: true; arab?: true; cw?: true}}[],
  // A scenario may print a minor-power fleet too, so the placement reads the
  // owner's own home keys; `Power` is the common case and stays first.
  power: Power | null = owner as Power,
): Unit[] => {
  const placed: Unit[] = [];
  const capitals: Record<Power, SpaceId> = {
    GE: "berlin",
    UK: "london",
    FR: "paris",
    AU: "vienna",
    RU: "st-petersburg",
    OT: "istanbul",
  };
  const capital: SpaceId | undefined =
    power === null ? undefined : capitals[power];
  const homeKeys = Object.values(SPACES)
    .filter((space) => space.home === power && G.spaces[space.id]?.control === power)
    .map((space) => space.id)
    .sort();
  const navalPort = (): SpaceId | null => {
    const port = capital === undefined ? undefined : SPACES[capital]?.ports?.[0];
    if (port !== undefined) return port;
    // A power whose capital has no port places its fleet in the first friendly
    // port it controls.
    const friendly = Object.values(SPACES)
      .filter((space) => space.ports !== undefined && G.spaces[space.id]?.control === power)
      .map((space) => space.id)
      .sort();
    const first = friendly[0];
    return first === undefined ? null : SPACES[first].ports?.[0] ?? null;
  };
  /**
   * The next space that can take another land unit.
   *
   * The printed setup limit is two armies per space, so the capital and the
   * home keys are filled in that order first.  A printed inventory larger than
   * the two-per-space allowance (the alternates print 5-6 armies per power)
   * then continues round-robin rather than dropping counters: dropping a unit
   * the scenario prints would silently change the position.  The excess is
   * recorded in `G.flags.altGwOverstacked` for the audit.
   */
  const landTargets = (relaxed: boolean): SpaceId | null => {
    const candidates: SpaceId[] = capital === undefined ? [...homeKeys] : [capital, ...homeKeys];
    for (const space of candidates) {
      if (SPACES[space] === undefined) continue;
      if (SPACES[space].type === "navalBox") continue;
      const armies = G.spaces[space].units
        .map((id) => G.units[id])
        .filter((unit) => unit !== undefined && isArmyKind(unit.kind)).length;
      if (relaxed || armies < ALT_GW_SETUP_STACK_LIMIT) return space;
    }
    return null;
  };
  for (const entry of inventory) {
    for (let i = 0; i < entry.count; i += 1) {
      const naval = entry.kind === "squadron" || entry.kind === "dreadnought";
      if (entry.kind === "reserveArmy") {
        const unit = placeUnit(G, owner, entry.kind, null, 2);
        if (power !== null) G.powers[power].reserves.push(unit.id);
        placed.push(unit);
        continue;
      }
      // Land units fill the printed two-per-space allowance first; an inventory
      // bigger than that continues at the capital so no printed counter is lost.
      const space = naval ? navalPort() : (landTargets(false) ?? landTargets(true));
      if (space === null) continue;
      if (!naval && landTargets(false) === null) {
        G.flags.altGwOverstacked = Number(G.flags.altGwOverstacked ?? 0) + 1;
      }
      const steps: 1 | 2 = entry.kind === "eliteCorps" || entry.kind === "expeditionary"
        || entry.kind === "zouave" || entry.kind === "eliteColonialEf" ? 1 : 2;
      const extra: Partial<Unit> = entry.flags === undefined ? {} : {flags: {...entry.flags}};
      const unit = placeUnit(G, owner, entry.kind, space, steps, extra);
      placed.push(unit);
    }
  }
  return placed;
};

// ---------------------------------------------------------------------------
// Convenience
// ---------------------------------------------------------------------------

/** The definition a live state is playing. */
export const scenarioDefOf = (G: ImperialElegyState): ScenarioDef => scenarioOf(G);

/** Look up a scenario by id (setup paths, tests, the lobby). */
export const scenarioDef = (id: ScenarioId): ScenarioDef => scenarioById(id);

/** Owner-agnostic label for a scenario, for logs. */
export const scenarioName = (G: ImperialElegyState): string => scenarioOf(G).name;

/** Every scenario id the engine can start. */
export type {ScenarioId};

/** The power a minor's units belong to for control purposes, or null. */
export const isPlayerOwned = (owner: PowerOrMinor): owner is Power =>
  (POWERS as readonly PowerOrMinor[]).includes(owner);

/** A freshly-dealt `ctx` for a scenario helper that needs dice. */
export type ScenarioCtx = Ctx;
