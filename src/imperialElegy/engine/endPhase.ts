/**
 * Imperial Elegy — pure planning helpers for the printed end-phase steps.
 *
 * The end phase (rule 20.0) runs twelve steps in a fixed order.  `resolveEnd`
 * in `moves.ts` walks `economy.ts#endPhaseOrder` and applies each step; this
 * module owns the *pure* decision logic for the steps that need board
 * inspection, so the printed cadence can be tested without mutating state:
 *
 *  - 20.1 Militarism: `militarismOptions` (one free army step under the 12.2
 *    rules, or protecting a fort of level 1-2 from the 20.2 degradation).
 *  - 20.3 Non-Player Power Build Step: `nonPlayerBuildPlan` / `italianRebuildPlan`
 *    (the End Phase Build Box bookkeeping + Italy's full-strength rebuild).
 *  - 20.4 Naval Units Go to Port: `navalReturnPlan` (nearest friendly port,
 *    four-unit port stacking, enemy-occupied ports excluded, elimination when
 *    the power controls no port).
 *  - 20.5 Set manpower: `manpowerExcess` (the standing armies over each
 *    manpower track after `recomputeTracks`).
 *  - 20.8 Progress Wars of Independence: `woiProgressPlan` (which +1 markers
 *    gain independence this phase and which 0 markers flip).
 *
 * `moves.ts` applies the plans and owns the side effects (placing/removing
 * units, displacement, stability, logs).
 */

import {ImperialElegyState, NonPlayerBuildBox, Power, PowerOrMinor, SpaceId, Unit} from "../types";
import {MINOR_POWER_HOMES, START_BUILD_BOX} from "../constant/setup";
import {SPACES, connectionsOf, isNavalBox, portBoxes, spaceLabel} from "../constant/spaces";
import {
  ITALIAN_MINOR_POWERS,
  ITALIAN_STANDING_ARMIES,
  allied,
  crossesSuez,
  hostileOwner,
  isArmyKind,
  isPower,
  italianArmyDeploySpaces,
  italianArmyTarget,
  italianNavalDeploySpace,
  landStackingLimit,
  landUnitsIn,
} from "./rules";
import {canRecruitIn, ottomanArmyTypeFor} from "./characteristics";
import {hasCounterFor, nonPlayerCounterPool, nonPlayerCounterRemaining, nonPlayerHasCounterFor} from "./counters";
import {reserveRemaining} from "./economy";
import {
  POLAND,
  POLISH_STANDING_COUNTERS,
  isPolandIndependent,
  polishArmyCap,
  polishArmyTotal,
  polishStandingArmies,
} from "./poland";

/** Rule 5.5.4: a port holds a maximum of four naval units. */
export const PORT_NAVAL_CAPACITY = 4;

// ---------------------------------------------------------------------------
// 20.1 — Militarism
// ---------------------------------------------------------------------------

/** The four printed Militarism benefits (rule 20.1). */
export type MilitarismBenefit = "army" | "reserve" | "fort" | "skip";

/** One legal 20.1 choice; the id doubles as the pending-decision option id. */
export interface MilitarismOption {
  id: string;
  benefit: MilitarismBenefit;
  /** The space for a standing army step or a protected fort. */
  space: SpaceId | null;
  label: string;
  /** Chinese display label for the pending-decision option. */
  labelZh: string;
}

/**
 * Rule 20.1: "Players gain one of the following benefits: gain one army step
 * (either reserve or standing) or prevent a fort from degrading in the next
 * step. Players cannot prevent level 3 forts from degrading."
 *
 * The army step is "a 1 CP recruitment action [12.2], applying all relevant
 * rules", so every standing option is passed through the live
 * `canRecruitIn` (home key, ownership, manpower/colonial/Arab pools, the UK's
 * Professional Army, OT Local Autonomy) plus the stacking and counter checks
 * the recruit move makes.  A reserve step needs room in the holding box and a
 * reserve counter.
 *
 * Defensive simplification: the printed text does not restrict which fort may
 * be protected, so every non-Indian fort of level 1-2 is offered (the Indian
 * fort never degrades, so protecting it would be a no-op).  The printed rule
 * gives no "skip" choice: it is only present when no benefit is legal, so a
 * player who can take a step must take one.
 */
export const militarismOptions = (G: ImperialElegyState, power: Power): MilitarismOption[] => {
  const options: MilitarismOption[] = [];
  if (G.powers[power].eliminated) return options;
  const spaces = Object.keys(SPACES).filter((space) => !isNavalBox(space)).sort();

  // Standing army step: one space per legal home key.
  for (const space of spaces) {
    if (G.spaces[space]?.control !== power) continue;
    const ottoman = power === "OT" ? ottomanArmyTypeFor(space) : undefined;
    const indian = power === "UK" ? space === "india" || space === "bengal" : undefined;
    if (!canRecruitIn(G, power, space, "army", {ottoman, indian}).allowed) continue;
    const ownArmies = landUnitsIn(G, space).filter((unit) => unit.owner === power && unit.kind === "army");
    const upgrade = ownArmies.some((unit) => unit.steps < 2);
    if (!upgrade) {
      const stacked = landUnitsIn(G, space).filter((unit) => isArmyKind(unit.kind)).length;
      if (stacked >= landStackingLimit(space)) continue;
      if (!hasCounterFor(G, power, "army")) continue;
    }
    options.push({
      id: `army:${space}`,
      benefit: "army",
      space,
      label: `Standing army step in ${spaceLabel(space, "en")}`,
      labelZh: `驻军整补：${spaceLabel(space, "zh_CN")}`,
    });
  }

  if (reserveRemaining(G, power) > 0 && hasCounterFor(G, power, "reserveArmy")) {
    options.push({
      id: "reserve",
      benefit: "reserve",
      space: null,
      label: "Reserve army step",
      labelZh: "预备军整补",
    });
  }

  // Fort protection: levels 1-2 degrade in 20.2; a level 3 fort cannot be protected.
  for (const space of spaces) {
    const fort = G.spaces[space]?.fort;
    if (!fort || fort.indian === true || fort.level > 2) continue;
    options.push({
      id: `fort:${space}`,
      benefit: "fort",
      space,
      label: `Protect the level ${fort.level} fort in ${spaceLabel(space, "en")}`,
      labelZh: `保护${spaceLabel(space, "zh_CN")}的 ${fort.level} 级要塞`,
    });
  }

  if (options.length === 0) {
    // Rule 20.1 has no optional "skip": it is only a deterministic fallback
    // for a player with no legal benefit at all.
    options.push({
      id: "skip",
      benefit: "skip",
      space: null,
      label: "No legal Militarism benefit",
      labelZh: "没有合法的军事主义收益",
    });
  }
  return options;
};

/** The deterministic one-shot default for 20.1: keep the pre-decision reserve growth. */
export const defaultMilitarismOption = (options: readonly MilitarismOption[]): MilitarismOption =>
  options.find((option) => option.benefit === "reserve") ??
  options.find((option) => option.benefit === "skip") ?? {
    id: "skip",
    benefit: "skip",
    space: null,
    label: "No legal Militarism benefit",
    labelZh: "没有合法的军事主义收益",
  };

// ---------------------------------------------------------------------------
// 20.5 — Set manpower (armies over the new limit)
// ---------------------------------------------------------------------------

/** One manpower track that is over its limit after 20.5 (UK/OT keep two tracks). */
export interface ManpowerExcessTrack {
  key: "primary" | "indian" | "arab";
  /** The final manpower value from `recomputeTracks` (the 20.5 limit). */
  limit: number;
  /** Standing armies on the map on this track. */
  count: number;
  /** The owner's elimination candidates, ordered by space then unit id. */
  candidates: string[];
}

const standingArmiesOnMap = (
  G: ImperialElegyState,
  power: Power,
  filter: (unit: Unit) => boolean = () => true,
): Unit[] =>
  Object.values(G.units)
    .filter(
      (unit) =>
        unit.owner === power &&
        unit.kind === "army" &&
        unit.space !== null &&
        unit.space !== undefined &&
        filter(unit),
    )
    .sort(
      (a, b) =>
        String(a.space ?? "").localeCompare(String(b.space ?? "")) || a.id.localeCompare(b.id),
    );

/**
 * Rule 20.5: "Players set their manpower based on how many keys they control
 * [7.2]. Armies in excess of a player's new manpower limit are eliminated."
 *
 * Only standing armies on the map count (reserve armies sit in the holding
 * box and are not eliminated by 20.5).  The UK's British/colonial armies and
 * the Ottomans' Turkish/Arab armies use their separate printed manpower tracks,
 * so each track is checked against its own final value from `recomputeTracks`.
 * 33.2.1 places Indian *and* Commonwealth armies on the colonial track.  The
 * printed 20.5 text does not ask the owner to choose which track's excess is
 * removed — every marker is set from its own keys, so each over-limit track is
 * trimmed separately (the owner only chooses which army inside that track).
 */
export const manpowerExcess = (G: ImperialElegyState, power: Power): ManpowerExcessTrack[] => {
  const p = G.powers[power];
  const tracks: {key: ManpowerExcessTrack["key"]; limit: number; units: Unit[]}[] = [];
  if (power === "UK") {
    // 33.2.1: British and colonial manpower are separate markers; Indian and
    // Commonwealth armies both draw on the colonial track, so neither belongs
    // to the British (primary) count.
    const colonial = (u: Unit): boolean => u.flags?.indian === true || u.flags?.cw === true;
    tracks.push({key: "primary", limit: p.manpower, units: standingArmiesOnMap(G, power, (u) => !colonial(u))});
    tracks.push({key: "indian", limit: p.secondaryManpower ?? 0, units: standingArmiesOnMap(G, power, colonial)});
  } else if (power === "OT") {
    tracks.push({key: "primary", limit: p.manpower, units: standingArmiesOnMap(G, power, (u) => u.flags?.arab !== true)});
    tracks.push({key: "arab", limit: p.secondaryManpower ?? 0, units: standingArmiesOnMap(G, power, (u) => u.flags?.arab === true)});
  } else {
    tracks.push({key: "primary", limit: p.manpower, units: standingArmiesOnMap(G, power)});
  }
  return tracks
    .filter((track) => track.units.length > track.limit)
    .map((track) => ({
      key: track.key,
      limit: track.limit,
      count: track.units.length,
      candidates: track.units.map((unit) => unit.id),
    }));
};


// ---------------------------------------------------------------------------
// 20.3 — Non-Player Power Build Step
// ---------------------------------------------------------------------------

/** The campaign's printed build box (playbook p. 3: Tuscany, Serbia, Bosnia, Bulgaria, Romania). */
export const initialNonPlayerBuildBox = (): NonPlayerBuildBox => ({
  minors: [...START_BUILD_BOX],
  italy: {italianArmy: 0, squadron: 0, dreadnought: 0},
});

/** The live build box, falling back to the printed campaign box for older saves. */
export const buildBoxOf = (G: ImperialElegyState): NonPlayerBuildBox =>
  G.nonPlayerBuildBox ?? initialNonPlayerBuildBox();

/** One minor-power build the 20.3 step should apply, in printed order. */
export interface NonPlayerBuildEntry {
  minor: string;
  /** The minor's home space (null when the data has no home for it). */
  home: SpaceId | null;
  /**
   * "promote" flips a reduced army to full; "placeReduced" puts a 1-step army
   * on the map; "placeReserve" puts a 1-step Polish reserve counter in the
   * Polish reserve armies holding box (22.5(1): the 4th/5th armies are reserve
   * counters and stay in the box during peacetime).
   */
  action: "promote" | "placeReduced" | "placeReserve";
  /** The army to flip for "promote". */
  unitId: string | null;
  /** The space the new army is placed in for "placeReduced" (null for "placeReserve"). */
  space: SpaceId | null;
}

/** Rule 22.5: an independent Poland builds two army steps instead of one. */
const BUILD_STEPS: Record<string, number> = {Poland: 2};

/**
 * The map space that shares a minor's name (20.3: "place the army in the space
 * that shares the name with the minor power").  The printed roster is fully
 * mapped in `MINOR_POWER_HOMES`; Poland gains independence during play and has
 * no entry there, so fall back to the space id / `minorHome` marker.
 */
const homeForMinor = (minor: string): SpaceId | null => {
  const mapped = MINOR_POWER_HOMES[minor];
  if (mapped !== undefined) return mapped;
  const direct = Object.values(SPACES).find((space) => space.minorHome === minor || space.id === minor.toLowerCase());
  return direct?.id ?? null;
};

/**
 * Rule 20.3: "give each independent minor power in the build box one army
 * step. Minor powers with no army on the map place the reduced army from the
 * box on the map. While minor powers with a reduced army flip that army to
 * full strength. ... This step increase cannot give a minor power more than 1
 * army (exception: Poland, rule 22.5)."
 *
 * The plan is deterministic: a reduced army is promoted before a new one is
 * placed, and the new army always appears on the space that shares the minor's
 * name (e.g. Serbian units are placed in Serbia, even when the space is
 * controlled by the Ottomans).
 *
 * 4.2/20.3: the ceiling is the minor's printed non-player "Armies" row, not a
 * universal 1 — Serbia, Greece, Romania and Bulgaria may each build up to two
 * armies.  Each end phase still adds at most one step (Poland: two), so the
 * counter mix only stops a build once the row is full.  Rows the chart does not
 * print keep the old conservative one-army ceiling rather than inventing a
 * larger pool; `nonPlayerHasCounterFor` is also consulted before every
 * placement so a full row can never be over-built.
 *
 * Poland is gated on rule 22.5: only an independent Poland build-box power
 * takes the two Polish steps.  Its allowance (Polish spaces + 1) counts the map
 * **and** the holding box, so once the three standing counters are on the map
 * the next step places a reduced reserve counter in the Polish reserve armies
 * holding box instead of a fourth standing army.
 */
export const nonPlayerBuildPlan = (G: ImperialElegyState): NonPlayerBuildEntry[] => {
  const box = buildBoxOf(G);
  const plan: NonPlayerBuildEntry[] = [];
  for (const minor of box.minors) {
    // 22.2: "All Italian minor powers cease to exist."  A unified Italy's
    // spaces must not receive a minor-power build step (the printed 20.3 minor
    // is no longer an independent power), so skip them for the 22.4 rebuild.
    if (G.persistent.italyUnified === true && ITALIAN_MINOR_POWERS.has(minor)) continue;
    const home = homeForMinor(minor);
    if (home === null || !G.spaces[home]) continue;
    if (minor === POLAND && !isPolandIndependent(G)) continue;
    const isPoland = minor === POLAND;
    const armies = Object.values(G.units)
      .filter((unit) => unit.owner === minor && isArmyKind(unit.kind))
      .sort((a, b) => a.id.localeCompare(b.id));
    const maxArmies = isPoland ? polishArmyCap(G) : nonPlayerCounterPool(minor)?.armies ?? 1;
    const steps = isPoland ? BUILD_STEPS[POLAND] : 1;
    const reduced = armies.filter((unit) => unit.steps < 2);
    let total = armies.length;
    // "army" is the printed Polish standing counter; a legacy save may still
    // hold a Polish counter created as a generic "minorArmy", which also uses
    // one of the three standing counters.
    let standingOnMap = armies.filter(
      (unit) =>
        (unit.kind === "army" || unit.kind === "minorArmy") &&
        unit.space !== null &&
        unit.space !== undefined,
    ).length;
    let remainingSteps = steps;
    while (remainingSteps > 0) {
      const promotable = reduced.shift();
      if (promotable) {
        plan.push({minor, home, action: "promote", unitId: promotable.id, space: promotable.space ?? null});
      } else if (total < maxArmies) {
        if (!nonPlayerHasCounterFor(G, minor, "army")) break;
        if (isPoland && standingOnMap >= POLISH_STANDING_COUNTERS) {
          plan.push({minor, home, action: "placeReserve", unitId: null, space: null});
          total += 1;
        } else {
          plan.push({minor, home, action: "placeReduced", unitId: null, space: home});
          total += 1;
          standingOnMap += 1;
        }
      } else {
        break;
      }
      remainingSteps -= 1;
    }
  }
  return plan;
};

/** One Italian unit the 20.3 step rebuilds after destruction (22.4). */
export interface ItalianRebuildEntry {
  kind: "italianArmy" | "squadron" | "dreadnought";
  /** `null` is the Italian reserve armies holding box (22.3.1 reserve army). */
  space: SpaceId | null;
}

export interface ItalianRebuildPlan {
  /** Reduced, on-map Italian units flipped to full strength. */
  promote: string[];
  /** Destroyed Italian units placed back on the map with Italian redeployment. */
  rebuild: ItalianRebuildEntry[];
  /**
   * 22.4 "Place destroyed Italian units in the Minor Power Build Box space
   * marked Italy": units with no legal redeployment space stay there for the
   * next end phase instead of being placed illegally.
   */
  heldBack: {italianArmy: number; squadron: number; dreadnought: number};
}

/**
 * Rule 20.3: "If Italy is unified they automatically rebuild all their units
 * at full strength and flip all reduced units to full strength. Then conduct
 * an Italian redeployment [22.4]."
 *
 * Returns null while Italy is not unified.  Destroyed Italian units are tracked
 * in the build box by `removeUnit`; they are placed back through the very same
 * 22.4 order the unification uses (Rome, then the frontier next to
 * player-controlled spaces, then any other Italian space; the naval units go to
 * Naples or Piedmont).  `italianArmyDeploySpaces`/`italianNavalDeploySpace` in
 * rules.ts are shared with `redeployItaly`, so the two paths cannot drift.
 *
 * The plan is idempotent: it only fills the spaces that do not already hold an
 * Italian army, never exceeds the three printed standing armies / four printed
 * army counters, and reports the units it could not place in `heldBack` (they
 * stay in the Italy box).
 */
export const italianRebuildPlan = (G: ImperialElegyState): ItalianRebuildPlan | null => {
  if (G.persistent.italyUnified !== true) return null;
  const promote: string[] = [];
  for (const unit of Object.values(G.units)) {
    if (unit.owner !== "IT") continue;
    const full = unit.elite === true ? 1 : 2;
    if (unit.steps < full) promote.push(unit.id);
  }
  const rebuild: ItalianRebuildEntry[] = [];
  const heldBack = {italianArmy: 0, squadron: 0, dreadnought: 0};
  const lost = buildBoxOf(G).italy;
  const armies = Object.values(G.units).filter((unit) => unit.owner === "IT" && unit.kind === "italianArmy");
  const standing = armies.filter((unit) => unit.space !== null && unit.space !== undefined).length;
  // 22.4 places one standing army in Rome and one in each frontier space; a
  // destroyed reserve counter (the 22.3.1 grant) returns to the reserve armies
  // holding box rather than becoming a fourth standing army.
  const target = italianArmyTarget(G);
  const totalRoom = Math.max(
    0,
    Math.min(
      target - armies.length,
      // 4.2: the printed non-player "Armies" row (5) is the hard ceiling; the
      // per-kind target above is the tighter Italian standing/reserve split.
      nonPlayerCounterRemaining(G, "IT", "army") ?? 0,
    ),
  );
  const cap = Math.min(totalRoom, ITALIAN_STANDING_ARMIES - standing, lost.italianArmy);
  const planned: SpaceId[] = [];
  let placedArmies = 0;
  for (const space of italianArmyDeploySpaces(G)) {
    if (placedArmies >= cap) break;
    if (planned.includes(space)) continue;
    if (armies.some((unit) => unit.space === space)) continue;
    rebuild.push({kind: "italianArmy", space});
    planned.push(space);
    placedArmies += 1;
  }
  // Only a granted reserve counter (target above the three standing armies) may
  // return to the reserve box; an unplaceable standing army stays in the Italy
  // build box for the next end phase.
  const reserveRoom = Math.max(
    0,
    Math.min(
      totalRoom - placedArmies,
      lost.italianArmy - placedArmies,
      target - ITALIAN_STANDING_ARMIES,
    ),
  );
  for (let i = 0; i < reserveRoom; i += 1) rebuild.push({kind: "italianArmy", space: null});
  heldBack.italianArmy = Math.max(0, lost.italianArmy - placedArmies - reserveRoom);
  const navalSpace = italianNavalDeploySpace(G);
  if (navalSpace !== null) {
    // 4.2: a destroyed counter returns to the pool, so the row remaining is the
    // number that may be rebuilt (3 squadrons / 1 dreadnought for Italy).
    const squadronRoom = Math.min(lost.squadron, nonPlayerCounterRemaining(G, "IT", "squadron") ?? 0);
    const dreadnoughtRoom = Math.min(lost.dreadnought, nonPlayerCounterRemaining(G, "IT", "dreadnought") ?? 0);
    for (let i = 0; i < squadronRoom; i += 1) rebuild.push({kind: "squadron", space: navalSpace});
    for (let i = 0; i < dreadnoughtRoom; i += 1) rebuild.push({kind: "dreadnought", space: navalSpace});
    heldBack.squadron = lost.squadron - squadronRoom;
    heldBack.dreadnought = lost.dreadnought - dreadnoughtRoom;
  } else {
    heldBack.squadron = lost.squadron;
    heldBack.dreadnought = lost.dreadnought;
  }
  return {promote, rebuild, heldBack};
};

// ---------------------------------------------------------------------------
// 20.4 — Naval Units Go to Port
// ---------------------------------------------------------------------------

export type NavalReturnReason =
  | "adjacentPort"
  | "nearestPort"
  | "portFull"
  | "portOccupied"
  | "noFriendlyPort"
  | "eliminated";

/** One unit's 20.4 resolution. */
export interface NavalReturnEntry {
  unitId: string;
  owner: PowerOrMinor;
  from: SpaceId;
  /** Destination port, or null when the unit stays at sea. */
  to: SpaceId | null;
  /** True when no friendly port exists and the unit is destroyed. */
  eliminate: boolean;
  reason: NavalReturnReason;
  /** Distance in naval-box hops to the port's box (0 = adjacent). */
  hops: number | null;
}

/** Friendly for 20.4: own control, an ally's port, or an uncontrolled port with the power's influence. */
const friendlyPortFor = (G: ImperialElegyState, owner: PowerOrMinor, space: SpaceId): boolean => {
  const state = G.spaces[space];
  if (!state) return false;
  if (state.control === owner) return true;
  if (isPower(owner)) {
    if (isPower(state.control) && allied(G, owner, state.control)) return true;
    if (!isPower(state.control) && state.control !== null && state.ally === owner) return true;
    // Rule 20.4: "Players may move into uncontrolled spaces where they have influence."
    if (state.control === null && state.influence === owner) return true;
    return false;
  }
  return state.control === owner;
};

const navalUnitsInSpace = (G: ImperialElegyState, space: SpaceId): Unit[] =>
  (G.spaces[space]?.units ?? [])
    .map((id) => G.units[id])
    .filter((unit): unit is Unit => unit !== undefined && unit.naval === true);

/**
 * Rule 20.4: a friendly-controlled port that contains enemy units is not a
 * legal destination "until the enemy units are dealt with".  Friendly means the
 * returning power's own units and the units of a minor power allied to it; a
 * rebel or unaligned minor counter blocks the port like a hostile power does.
 */
const portHasEnemyUnits = (G: ImperialElegyState, owner: PowerOrMinor, port: SpaceId): boolean => {
  const state = G.spaces[port];
  if (!state) return false;
  for (const id of state.units) {
    const unit = G.units[id];
    if (!unit || unit.owner === owner) continue;
    if (!isPower(owner)) return true;
    if (isPower(unit.owner) || unit.owner === "US" || unit.owner === "IT") {
      // `hostileOwner` resolves the Great War sides for the US/Italian majors
      // and limited wars for player powers.
      if (hostileOwner(G, owner, unit.owner)) return true;
      continue;
    }
    // An allied minor power's units are friendly; rebels and other minors block.
    if (state.ally === owner && state.control === unit.owner) continue;
    return true;
  }
  return false;
};

const portHasRoom = (G: ImperialElegyState, port: SpaceId, forNaval: boolean): boolean =>
  !forNaval || navalUnitsInSpace(G, port).length < PORT_NAVAL_CAPACITY;

/** Naval-box distance map from `start`, respecting the Suez Canal gate. */
const boxDistances = (G: ImperialElegyState, start: SpaceId): Map<SpaceId, number> => {
  const distance = new Map<SpaceId, number>();
  if (!isNavalBox(start)) return distance;
  distance.set(start, 0);
  const queue: SpaceId[] = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const conn of connectionsOf(current)) {
      if (conn.type !== "sea") continue;
      const next = conn.a === current ? conn.b : conn.a;
      if (!isNavalBox(next) || distance.has(next)) continue;
      if (crossesSuez(current, next) && G.persistent.suezCanal !== true) continue;
      distance.set(next, (distance.get(current) ?? 0) + 1);
      queue.push(next);
    }
  }
  return distance;
};

/**
 * Rule 20.4: every naval unit (and land unit at sea) returns to the nearest
 * friendly port; when possible that port must be adjacent to the naval box.
 * A port already holding four naval units cannot take another (5.5.4), so a
 * unit with no room stays at sea.  A power that controls no port at all loses
 * its naval units ("If a power does not control a port their naval units are
 * eliminated").
 *
 * The plan is deterministic: ports are tried in id order, adjacent boxes before
 * farther ones, and lower box distance before higher.
 */
export const navalReturnPlan = (G: ImperialElegyState): NavalReturnEntry[] => {
  const plan: NavalReturnEntry[] = [];
  for (const box of Object.values(SPACES)) {
    if (box.type !== "navalBox") continue;
    const state = G.spaces[box.id];
    if (!state) continue;
    for (const unit of [...state.units].map((id) => G.units[id]).filter((u): u is Unit => u !== undefined)) {
      // Only units actually at sea: naval units and land units on transports.
      const atSea = unit.naval === true || unit.kind === "army" || unit.kind === "minorArmy" || unit.kind === "italianArmy" || unit.kind === "usArmy" || unit.kind === "expeditionary";
      if (!atSea) continue;
      const owner = unit.owner;
      // Rule 20.4: a friendly port that contains enemy units is not a legal
      // destination "until the enemy units are dealt with", so it is skipped
      // in favour of the next nearest friendly port.
      const portCandidates = (space: SpaceId): SpaceId[] =>
        Object.values(SPACES)
          .filter((def) => def.ports?.includes(space))
          .map((def) => def.id)
          .filter((port) => friendlyPortFor(G, owner, port) && !portHasEnemyUnits(G, owner, port))
          .sort();
      let chosen: SpaceId | null = null;
      let chosenHops: number | null = null;
      const distances = boxDistances(G, box.id);
      const orderedBoxes = [...distances.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
      for (const [candidateBox, hops] of orderedBoxes) {
        const ports = portCandidates(candidateBox);
        const room = ports.find((port) => portHasRoom(G, port, unit.naval === true)) ?? null;
        if (room !== null) {
          chosen = room;
          chosenHops = hops;
          break;
        }
      }
      if (chosen !== null) {
        plan.push({
          unitId: unit.id,
          owner,
          from: box.id,
          to: chosen,
          eliminate: false,
          reason: chosenHops === 0 ? "adjacentPort" : "nearestPort",
          hops: chosenHops,
        });
        continue;
      }
      // No legal port with room.  Eliminate only when the owner controls no
      // port anywhere; otherwise the unit simply stays at sea.
      const controlsAPort = Object.values(SPACES).some(
        (def) => portBoxes(def.id).length > 0 && G.spaces[def.id]?.control === owner,
      );
      if (!controlsAPort) {
        plan.push({unitId: unit.id, owner, from: box.id, to: null, eliminate: true, reason: "eliminated", hops: null});
      } else {
        // Why the stay-at-sea: distinguish a full port from one whose enemy
        // garrison blocks it (20.4) and from "no friendly port at all".
        const friendlyPorts = orderedBoxes
          .flatMap(([candidateBox]) =>
            Object.values(SPACES)
              .filter((def) => def.ports?.includes(candidateBox))
              .map((def) => def.id)
              .filter((port) => friendlyPortFor(G, owner, port)),
          );
        const anyFriendly = friendlyPorts.length > 0;
        const anyOccupied = friendlyPorts.some((port) => portHasEnemyUnits(G, owner, port));
        plan.push({
          unitId: unit.id,
          owner,
          from: box.id,
          to: null,
          eliminate: false,
          reason: anyFriendly ? (anyOccupied ? "portOccupied" : "portFull") : "noFriendlyPort",
          hops: null,
        });
      }
    }
  }
  return plan;
};

// ---------------------------------------------------------------------------
// 20.8 — Progress Wars of Independence
// ---------------------------------------------------------------------------

export interface WoiIndependence {
  space: SpaceId;
  minor: string;
  /** The player who loses the space and its 1 stability (null for a non-player). */
  controller: Power | null;
}

export interface WoiProgressPlan {
  /** Spaces whose marker was on its +1 side when the step began. */
  independence: WoiIndependence[];
  /** Spaces whose 0 marker flips to +1. */
  advance: SpaceId[];
}

/**
 * Rule 20.8: "progress all WoIs on the map by one step. WoIs have two steps: 0
 * and +1. If a space contains a WoI marker that began this phase on its +1 side
 * that space gains independence. ... All 0 WoI markers are flipped to their +1
 * side."
 *
 * The marker is read before anything is flipped, so a marker created this turn
 * can never gain independence in the same phase.
 */
export const woiProgressPlan = (G: ImperialElegyState): WoiProgressPlan => {
  const independence: WoiIndependence[] = [];
  const advance: SpaceId[] = [];
  for (const [space, state] of Object.entries(G.spaces)) {
    const rebellion = state.rebellion;
    if (!rebellion) continue;
    if (rebellion.step === 1) {
      const controller = isPower(state.control) ? (state.control as Power) : null;
      independence.push({space, minor: rebellion.minor, controller});
    } else {
      advance.push(space);
    }
  }
  independence.sort((a, b) => a.space.localeCompare(b.space));
  advance.sort();
  return {independence, advance};
};

/**
 * The minor a unit belongs to, for 20.8's "all units, except those belonging to
 * the newly independent minor power, are immediately displaced".
 */
export const unitMinor = (owner: PowerOrMinor): string | null => {
  if (isPower(owner)) return null;
  return owner.startsWith("REBEL:") ? owner.slice("REBEL:".length) : owner;
};
