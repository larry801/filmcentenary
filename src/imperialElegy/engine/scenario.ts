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
import {neighboursOf, SPACES} from "../constant/spaces";
import {MINOR_POWER_HOMES} from "../constant/setup";
import {placeUnit} from "./effects";
import {isHomeSpace} from "./rules";
import {
  capitalOf,
  isArmyKind,
  isPort,
  isPower,
  italianArmyDeploySpaces,
  italianNavalDeploySpace,
  landStackingLimit,
  landUnitsIn,
  log,
  navalUnitsIn,
  PORT_NAVAL_LIMIT,
  setSpaceControl,
} from "./rules";

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

/**
 * True when the scenario's own victory rule replaces 31.0's neutral-VP check.
 *
 * The alternate GW pages print: "Victory: In the Alternate Great War scenarios
 * the team that wins the GW wins the game, all other players lose."  That is
 * stricter than 31.0's "if neither alliance has won … the neutral player(s) with
 * the highest VP total wins", so a neutral cannot take an alternate game from
 * the alliance that won its Great War.
 */
export const altGwVictoryOnly = (G: ImperialElegyState): boolean =>
  scenarioOf(G).special.altGw !== undefined;

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

/** Printed setup cap: "A maximum of 2 naval units for each player can begin the
 * game deployed on a submap." */
export const ALT_GW_SETUP_NAVAL_PER_SUBMAP = 2;

/** Army counters that occupy a printed "2 armies per space" setup slot. */
const isSetupArmy = (kind: UnitKind): boolean =>
  kind === "army" || kind === "minorArmy" || kind === "italianArmy" || kind === "usArmy";

/** The land spaces an alternate setup may place `owner`'s printed units in. */
const altGwLandPool = (G: ImperialElegyState, owner: PowerOrMinor): SpaceId[] => {
  if (owner === "IT") {
    // 22.4 puts the Italian standing armies in Rome, then the frontier spaces,
    // then any other Italian-held unification space; a scenario that prints an
    // Italian inventory therefore uses the same printed order.
    const italian = italianArmyDeploySpaces(G);
    const controlled = Object.values(SPACES)
      .filter((space) => space.type !== "navalBox" && G.spaces[space.id]?.control === "IT")
      .map((space) => space.id)
      .sort();
    return [...new Set([...italian, ...controlled])];
  }
  const land = Object.values(SPACES).filter((space) => space.type !== "navalBox");
  if (!isPlayerOwned(owner)) {
    // A printed minor-power inventory (none is used today) stands in the
    // minor's own controlled spaces.
    return land
      .filter((space) => G.spaces[space.id]?.control === owner)
      .map((space) => space.id)
      .sort();
  }
  const capital = capitalOf(G, owner);
  const homes = land
    .filter((space) => space.home === owner && G.spaces[space.id]?.control === owner)
    .map((space) => space.id)
    .sort();
  const controlled = land
    .filter((space) => G.spaces[space.id]?.control === owner)
    .map((space) => space.id)
    .sort();
  return [...new Set([capital, ...homes, ...controlled])];
};

/** The ports an alternate setup may place `owner`'s printed naval units in. */
const altGwNavalPool = (G: ImperialElegyState, owner: PowerOrMinor): SpaceId[] => {
  if (owner === "IT") {
    // 22.4: "Italian naval units are always placed in Naples or Piedmont if
    // Naples is not Italian controlled."
    const naval = italianNavalDeploySpace(G);
    const ports = Object.values(SPACES)
      .filter((space) => isPort(space.id) && G.spaces[space.id]?.control === "IT")
      .map((space) => space.id)
      .sort();
    return [...new Set([...(naval === null ? [] : [naval]), ...ports])];
  }
  const ports = Object.values(SPACES)
    .filter((space) => isPort(space.id) && G.spaces[space.id]?.control === owner)
    .map((space) => space.id)
    .sort();
  if (!isPlayerOwned(owner)) return ports;
  const capital = capitalOf(G, owner);
  // The capital's own port first (London, Paris via Provence is not the capital,
  // so the fallback is the first friendly port in name order).
  return isPort(capital) ? [...new Set([capital, ...ports])] : ports;
};

/**
 * Place an alternate-GW power's printed unit inventory.
 *
 * The printed procedure makes the *positions* a secret player choice ("players
 * will secretly write down the location of their starting units"), so this is
 * the deterministic legal default:
 *
 *  - reserve armies go to the owner's reserve holding box;
 *  - land units fill the capital and the owner's controlled home keys in name
 *    order, at most two armies per space (the printed setup stack limit) and
 *    never above the normal per-space stacking limit;
 *  - naval units fill the capital's port first, then the owner's other ports,
 *    never above the printed port capacity of four and at most two naval units
 *    per non-main submap (the printed "maximum of 2 naval units ... deployed on
 *    a submap");
 *  - a unified Italy's printed inventory is placed through the 22.4 Italian
 *    deployment order (Rome/frontier armies, Naples fleet) instead of being
 *    treated like a player's home keys.
 *
 * Anything that cannot be placed legally stays in the last legal space and is
 * counted in `G.flags.altGwOverstacked` / `G.flags.altGwNavalOverstacked` so a
 * printed counter is never silently dropped.
 */
export const placeAltGwInventory = (
  G: ImperialElegyState,
  owner: PowerOrMinor,
  inventory: {kind: UnitKind; count: number; flags?: {indian?: true; arab?: true; cw?: true}}[],
): Unit[] => {
  const placed: Unit[] = [];
  const landPool = altGwLandPool(G, owner);
  const navalPool = altGwNavalPool(G, owner);
  const landTarget = (kind: UnitKind): SpaceId | null => {
    for (const space of landPool) {
      if (landUnitsIn(G, space).length >= landStackingLimit(space)) continue;
      if (isSetupArmy(kind) && landUnitsIn(G, space).filter((unit) => isSetupArmy(unit.kind)).length >= ALT_GW_SETUP_STACK_LIMIT) {
        continue;
      }
      return space;
    }
    return null;
  };
  const navalOnSubmap = (submap: string): number =>
    Object.values(G.units).filter(
      (unit) =>
        unit.owner === owner &&
        unit.naval === true &&
        unit.space !== null &&
        unit.space !== undefined &&
        SPACES[unit.space]?.submap === submap,
    ).length;
  const navalTarget = (): SpaceId | null => {
    for (const port of navalPool) {
      if (navalUnitsIn(G, port).length >= PORT_NAVAL_LIMIT) continue;
      const submap = SPACES[port]?.submap ?? "main";
      if (submap !== "main" && navalOnSubmap(submap) >= ALT_GW_SETUP_NAVAL_PER_SUBMAP) continue;
      return port;
    }
    return null;
  };
  for (const entry of inventory) {
    for (let i = 0; i < entry.count; i += 1) {
      const extra: Partial<Unit> = entry.flags === undefined ? {} : {flags: {...entry.flags}};
      if (entry.kind === "reserveArmy") {
        // The reserve-army holding box is a per-power record; Italy has no
        // player seat, so its printed reserve counter stays a space-less
        // non-player counter (the same shape the historical GW setup uses).
        const unit = placeUnit(G, owner, entry.kind, null, 2, extra);
        if (isPlayerOwned(owner)) G.powers[owner].reserves.push(unit.id);
        placed.push(unit);
        continue;
      }
      const naval = entry.kind === "squadron" || entry.kind === "dreadnought";
      const steps: 1 | 2 =
        entry.kind === "eliteCorps" || entry.kind === "expeditionary" || entry.kind === "zouave" || entry.kind === "eliteColonialEf"
          ? 1
          : 2;
      if (naval) {
        const target = navalTarget();
        const port = target ?? navalPool[0];
        if (port === undefined) continue;
        if (target === null) G.flags.altGwNavalOverstacked = Number(G.flags.altGwNavalOverstacked ?? 0) + 1;
        placed.push(placeUnit(G, owner, entry.kind, port, steps, extra));
        continue;
      }
      const target = landTarget(entry.kind);
      const space = target ?? landPool[0];
      if (space === undefined) continue;
      if (target === null) G.flags.altGwOverstacked = Number(G.flags.altGwOverstacked ?? 0) + 1;
      placed.push(placeUnit(G, owner, entry.kind, space, steps, extra));
    }
  }
  return placed;
};

/**
 * Alternate-GW setup step 3 — "Taking Control of Uncontrolled Spaces".
 *
 * "In turn order, players gain control of one controlled space.  Exception: the
 * UK gains control of 2 spaces each time they place markers during this step.
 * Players must be able to trace a LoC to the uncontrolled space in order to
 * place a control marker there."
 *
 * The printed positions are a player choice, so this applies the deterministic
 * legal default the same way the unit placement does: walk the Great War turn
 * order (every belligerent, then the neutral players in seat order), and give
 * each power the printed number of uncontrolled keys (split by the printed
 * Africa/Asia counts), preferring keys a LoC can reach through spaces the power
 * already controls (each marker therefore extends the reach for the next one).
 * With UK's printed 2-per-placement exception the UK takes up to two keys per
 * round.  The print only names counts, not spaces, and a key no LoC can reach is
 * skipped rather than invented.
 */
export const applyAltGwUncontrolledSpaces = (G: ImperialElegyState, def: ScenarioDef): number => {
  const alt = def.special.altGw;
  if (!alt || !G.gw) return 0;
  const order: Power[] = [
    ...G.gw.order.filter((slot): slot is Power => isPower(slot)),
  ];
  for (const power of G.gw.neutrals) if (!order.includes(power)) order.push(power);
  // 25.7 lists the belligerents' order; neutral players act after them in seat
  // order (27.4), so their printed control markers are taken at the end.
  for (const power of POWERS) if (G.gw.neutrals.includes(power) && !order.includes(power)) order.push(power);
  /** Keys reachable from a space the power already controls, by land or sea. */
  const reachable = (power: Power): Set<SpaceId> => {
    const seen = new Set<SpaceId>();
    const queue: SpaceId[] = [];
    for (const [id, state] of Object.entries(G.spaces)) {
      if (state.control === power || state.ally === power) {
        seen.add(id);
        queue.push(id);
      }
    }
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of neighboursOf(current)) {
        if (seen.has(next)) continue;
        if (!G.spaces[next]) continue;
        const def2 = SPACES[next];
        // A LoC may pass through friendly controlled spaces only; an
        // uncontrolled key is a valid *target*, not a stepping stone, so it is
        // recorded as reachable without being expanded.
        const passable = G.spaces[next].control === power
          || G.spaces[next].ally === power
          || (def2 !== undefined && def2.type === "navalBox");
        seen.add(next);
        if (passable) queue.push(next);
      }
    }
    return seen;
  };
  const continentOf = (space: SpaceId): string => SPACES[space]?.region ?? "";
  const candidates = (power: Power, region: "africa" | "asia"): SpaceId[] => {
    const reach = reachable(power);
    return Object.values(SPACES)
      .filter((space) => {
        if (space.type !== "key" && space.type !== "capital" && space.type !== "subcapital") return false;
        const state = G.spaces[space.id];
        if (!state || state.control !== null) return false;
        if (continentOf(space.id) !== region) return false;
        return reach.has(space.id);
      })
      .map((space) => space.id)
      .sort();
  };
  let applied = 0;
  for (const power of order) {
    const counts = alt.uncontrolledKeys[power];
    if (counts === undefined) continue;
    const remaining = {africa: counts.africa, asia: counts.asia};
    const perRound = power === "UK" ? 2 : 1;
    for (const region of ["africa", "asia"] as const) {
      let guard = 0;
      while (remaining[region] > 0 && guard < 64) {
        guard += 1;
        const picks = candidates(power, region).slice(0, Math.min(perRound, remaining[region]));
        if (picks.length === 0) break;
        for (const space of picks) {
          if (remaining[region] <= 0) break;
          setSpaceControl(G, space, power);
          log(G, power, "gwSetupControl", {space, region});
          remaining[region] -= 1;
          applied += 1;
        }
      }
      if (remaining[region] > 0) {
        log(G, power, "gwSetupControlShortfall", {region, missing: remaining[region]});
      }
    }
  }
  return applied;
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
