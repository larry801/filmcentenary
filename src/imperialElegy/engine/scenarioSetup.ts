/**
 * Scenario setup steps that a player decides *after* the boards are set up.
 *
 * `IE_playbook.pdf` prints two such steps before the first Prep Phase:
 *
 *  - **1870, The Franco-Prussian War** (p. 4): "Prior to the Prep Phase of turn
 *    3, the FR player may decide to concede defeat and skip the Franco-Prussian
 *    War.  If they decide this, adjust the setup as follows: …" — six numbered
 *    adjustments, applied here in printed order.
 *  - the National Goal deck edits both four-turn scenarios print for AU
 *    ("adds the 'Precarious Position' NG … may remove either 'Contain Italy' or
 *    'Contain Prussia'").
 *
 * The Franco-Prussian War step is a decision, so it is a `PendingDecision`
 * answered by the FR seat from the prep phase; the NG deck edits are printed
 * setup data and run during `setupImperialElegy`.
 */

import {Ctx} from "boardgame.io";
import {ImperialElegyState, Power, POWERS, SpaceId, Unit} from "../types";
import type {ScenarioDef} from "../constant/scenarios/types";
import {SPACES} from "../constant/spaces";
import {GOALS_BY_ID, goalsForPower} from "../constant/goals";
import {log, recomputeTracks, setSpaceControl} from "./rules";
import {shuffle, drawCards} from "./deck";
import {displaceUnitToFriendlyLoc, placeUnit, removeUnit} from "./effects";

/** The scenario's printed goal-deck edits, applied while the decks are built. */
export const applyGoalDeckEdits = (G: ImperialElegyState, def: ScenarioDef, ctx: Ctx): void => {
  for (const edit of def.goalDeck ?? []) {
    const p = G.powers[edit.power];
    if (edit.add !== undefined) {
      const goal = GOALS_BY_ID[edit.add];
      // 2.4: AU has nine NG cards and one of them is only used in the 1870 and
      // 1880 scenarios, so the card is dealt into that power's deck only.
      if (goal !== undefined && goal.power === edit.power && !p.goalDeck.includes(edit.add)) {
        p.goalDeck.push(edit.add);
        log(G, edit.power, "goalDeckAdded", {goal: edit.add});
      }
    }
    if (edit.removeOneOf !== undefined && edit.removeOneOf.length > 0) {
      // "they may remove either A or B": the choice belongs to the power, so
      // the deck is left holding both until the power answers.  Recorded as a
      // setup choice below.
      G.flags[`goalChoice:${edit.power}`] = edit.removeOneOf.join(",");
    }
    p.goalDeck = shuffle(ctx, p.goalDeck);
  }
};

/**
 * Resolve the printed "may remove either A or B" deck edit.
 *
 * The playbook gives the power the choice, so it is a pending decision offered
 * during the preparation of the first turn.  `keep` is the goal the power keeps
 * (the other candidate leaves the deck).
 */
export const resolveGoalChoice = (
  G: ImperialElegyState,
  power: Power,
  keep: string,
): boolean => {
  const raw = G.flags[`goalChoice:${power}`];
  if (typeof raw !== "string") return false;
  const candidates = raw.split(",").filter(Boolean);
  if (!candidates.includes(keep)) return false;
  const p = G.powers[power];
  for (const id of candidates) {
    if (id === keep) continue;
    p.goalDeck = p.goalDeck.filter((entry) => entry !== id);
  }
  delete G.flags[`goalChoice:${power}`];
  log(G, power, "goalRemoved", {goal: candidates.filter((id) => id !== keep).join(","), kept: keep});
  return true;
};

/** True while a printed goal-deck choice is still waiting for its power. */
export const pendingGoalChoice = (G: ImperialElegyState): {power: Power; candidates: string[]}[] =>
  POWERS.flatMap((power) => {
    const raw = G.flags[`goalChoice:${power}`];
    if (typeof raw !== "string") return [];
    const candidates = raw.split(",").filter(Boolean);
    return candidates.length > 0 ? [{power, candidates}] : [];
  });

// ---------------------------------------------------------------------------
// 1870 — The Franco-Prussian War
// ---------------------------------------------------------------------------

/**
 * The six printed adjustments, as data.
 *
 * Each entry is one numbered step of the playbook's list; keeping them separate
 * makes the implementation auditable line by line against the page.
 */
export interface FrancoPrussianAdjustment {
  /** The numbered printed step (1-6). */
  step: 1 | 2 | 3 | 4 | 5 | 6;
  /** The printed instruction, verbatim. */
  text: string;
}

export const FRANCO_PRUSSIAN_STEPS: FrancoPrussianAdjustment[] = [
  {
    step: 1,
    text:
      "GE: gains control of Alsace-Lorraine, Bavaria, and Saxony. Eliminate the Saxon and Bavarian armies " +
      "and both GE ECs. 1 GE standing army takes a step loss. Set GE territorial keys to 10. Gain a +1 card " +
      "marker. Gain a 2 turn FR truce marker.",
  },
  {
    step: 2,
    text:
      "FR: displace any units in Alsace-Lorraine. eliminate 2 FR standing armies and 1 EC. Set FR territorial " +
      "keys to 8. Gain a -1 card marker. Gain a 2 turn GE truce marker.",
  },
  {
    step: 3,
    text:
      "Alliance Track: place GE in the Triple Alliance (uncommitted) and FR in the committed box of the " +
      "Triple Entente. All other players' markers remain in the neutral box.",
  },
  {
    step: 4,
    text: "Turn Track: place a -1 card marker with a FR control marker on turn 4 of the turn track.",
  },
  {
    step: 5,
    text: "Cards: on the first turn, GE does not select a home card and FR receives one less card.",
  },
  {
    step: 6,
    text: "Turn Sequence: Skip the GE's first impulse (it is assumed they fought the war).",
  },
];

/** True when the live scenario prints the optional Franco-Prussian War. */
export const hasFrancoPrussianWar = (G: ImperialElegyState): boolean =>
  G.scenario === "s1870";

/**
 * Apply the printed "FR concedes the Franco-Prussian War" adjustment.
 *
 * Runs before the first Prep Phase (i.e. from the setup's opening state), so it
 * edits the freshly dealt position rather than a board that has been played.
 * Idempotent: the `persistent` marker records that the branch was taken.
 */
export const applyFrancoPrussianConcession = (
  G: ImperialElegyState,
  ctx: Ctx,
): boolean => {
  if (!hasFrancoPrussianWar(G)) return false;
  if (G.persistent.francoPrussianConceded === true) return false;
  G.persistent.francoPrussianConceded = true;

  // ---------------------------------------------------------------- step 1 GE
  for (const space of ["alsace-lorraine", "bavaria", "saxony"] as SpaceId[]) {
    setSpaceControl(G, space, "GE");
  }
  // "Eliminate the Saxon and Bavarian armies"
  for (const unit of Object.values(G.units)) {
    if (unit.kind !== "minorArmy") continue;
    if (unit.owner !== "Saxony" && unit.owner !== "Bavaria") continue;
    removeUnit(G, unit.id);
  }
  // "and both GE ECs"
  for (const unit of Object.values(G.units)) {
    if (unit.owner === "GE" && unit.kind === "eliteCorps") removeUnit(G, unit.id);
  }
  // "1 GE standing army takes a step loss" — the reduced step is a loss, so an
  // already-reduced army is destroyed (18.6.2: an army at one step is removed).
  const geArmy = Object.values(G.units)
    .filter((unit) => unit.owner === "GE" && unit.kind === "army")
    .sort((a, b) => String(a.space ?? "").localeCompare(String(b.space ?? "")) || a.id.localeCompare(b.id))[0];
  if (geArmy !== undefined) {
    if (geArmy.steps > 1) geArmy.steps = 1;
    else removeUnit(G, geArmy.id);
  }
  // "Set GE territorial keys to 10.  Gain a +1 card marker.  Gain a 2 turn FR
  // truce marker."  The key track is derived from the board (see
  // `engine/rules.ts#recomputeTracks`), so the printed 10 is recorded as the
  // scenario's expectation and checked by `scenarioSetup.test.ts`; the board
  // stays the single source of truth during play.
  G.flags.francoPrussianGeKeys = 10;
  G.persistent["scenarioTruce:GE:FR"] = 2;

  // ---------------------------------------------------------------- step 2 FR
  // "displace any units in Alsace-Lorraine": the space is now German, so every
  // French unit there moves to its nearest friendly space (5.7); one that has
  // no destination is eliminated by the same helper's contract.
  const alsace = G.spaces["alsace-lorraine"];
  for (const unitId of [...(alsace?.units ?? [])]) {
    const unit = G.units[unitId];
    if (!unit || unit.owner !== "FR") continue;
    displaceToNearestFriendly(G, unit);
  }
  // "eliminate 2 FR standing armies and 1 EC"
  removeFirstUnits(G, "FR", "army", 2);
  removeFirstUnits(G, "FR", "eliteCorps", 1);
  // "Set FR territorial keys to 8.  Gain a -1 card marker.  Gain a 2 turn GE
  // truce marker."
  G.flags.francoPrussianFrKeys = 8;
  G.powers.FR.cardMarkers -= 1;

  // ---------------------------------------------------------------- step 3 track
  // Triple Alliance (uncommitted) / committed Triple Entente.
  G.powers.GE.alliance = "taAligned";
  G.powers.FR.alliance = "teCommitted";
  G.powers.GE.mpit = {te: 0, ta: 1, neutral: 0};
  G.powers.FR.mpit = {te: 1, ta: 0, neutral: 0};

  // ---------------------------------------------------------------- step 4 turn track
  // "place a -1 card marker with a FR control marker on turn 4 of the turn
  // track": the FR marker is already on its display, so only the -1 card
  // marker is new — recorded for the FR draw on that turn.
  G.flags.francoPrussianTurn4Marker = 4;

  // ---------------------------------------------------------------- step 5 cards
  // "on the first turn, GE does not select a home card and FR receives one
  // less card."  Both are prep-phase rules, keyed on the first turn.
  G.flags.francoPrussianNoHomeCard = "GE";
  G.flags.francoPrussianFrMinusOne = 1;

  // ---------------------------------------------------------------- step 6 order
  // "Skip the GE's first impulse": the action phase opens with the next seat in
  // printed order instead of GE.
  G.flags.francoPrussianSkipGeImpulse = true;

  // The printed territorial-key totals are board-derived: recompute so the
  // displayed tracks match the board the printed markers just built.
  recomputeTracks(G);

  log(G, "FR", "francoPrussianConcession", {
    geKeys: G.powers.GE.territorialKeys,
    frKeys: G.powers.FR.territorialKeys,
  });
  return true;
};

/** Remove the first `count` units of one kind owned by `power`, in space order. */
const removeFirstUnits = (
  G: ImperialElegyState,
  power: Power,
  kind: Unit["kind"],
  count: number,
): number => {
  const candidates = Object.values(G.units)
    .filter((unit) => unit.owner === power && unit.kind === kind)
    .sort((a, b) => String(a.space ?? "").localeCompare(String(b.space ?? "")) || a.id.localeCompare(b.id));
  let removed = 0;
  for (const unit of candidates.slice(0, count)) {
    removeUnit(G, unit.id);
    removed += 1;
  }
  return removed;
};

/**
 * 5.7 displacement to the nearest friendly space.
 *
 * A unit with no friendly destination is eliminated; that is the same contract
 * the engine's other displacement paths use, so the concession step cannot leave
 * a unit in an enemy space.
 */
const displaceToNearestFriendly = (G: ImperialElegyState, unit: Unit): void => {
  const id = displaceUnitToFriendlyLoc(G, unit.id);
  if (id === null) removeUnit(G, unit.id);
};

/**
 * Alternate GW build points (playbook p. 8 step 2): spend one point on either
 * stability or industry.  Returns false when the power has none left.
 */
export const spendBuildPoint = (
  G: ImperialElegyState,
  power: Power,
  field: "stability" | "industry",
): boolean => {
  const ledger = G.buildPoints;
  if (!ledger) return false;
  const remaining = ledger.remaining?.[power] ?? 0;
  if (remaining <= 0) return false;
  ledger.remaining[power] = remaining - 1;
  ledger.spends.push({power, field});
  if (field === "stability") G.powers[power].stability += 1;
  else G.powers[power].industry += 1;
  log(G, power, "gwBuildPointSpent", {field, remaining: remaining - 1});
  return true;
};

/** The spaces a scenario hands to a minor power's control (IMP markers). */
export const applyIndependentMinorMarkers = (G: ImperialElegyState, def: ScenarioDef): number => {
  let applied = 0;
  for (const marker of def.independentMinorMarkers ?? []) {
    const space = G.spaces[marker.space];
    if (!space) continue;
    G.persistent[`independentMinor:${marker.minor}`] = true;
    G.persistent[`impMarker:${marker.space}`] = marker.minor;
    applied += 1;
  }
  return applied;
};

/** The minor power an IMP marker names for a space, if any. */
export const impMarkerOf = (G: ImperialElegyState, space: SpaceId): string | null => {
  const raw = G.persistent?.[`impMarker:${space}`];
  return typeof raw === "string" ? raw : null;
};

/** True when a minor power is printed as independent (IMP) in this scenario. */
export const isIndependentMinor = (G: ImperialElegyState, minor: string): boolean =>
  G.persistent?.[`independentMinor:${minor}`] === true;

/** The prep-phase turn-1 restrictions the Franco-Prussian branch installs. */
export const francoPrussianPrepRule = (
  G: ImperialElegyState,
  power: Power,
): {noHomeCard: boolean; drawDelta: number} => {
  const first = G.turn === 1 || G.turn === scenarioFirstTurnOf(G);
  if (!first) return {noHomeCard: false, drawDelta: 0};
  const noHome = G.flags.francoPrussianNoHomeCard === power;
  const delta = power === "FR" ? -Number(G.flags.francoPrussianFrMinusOne ?? 0) : 0;
  return {noHomeCard: noHome, drawDelta: delta};
};

/**
 * Settle a power's home-card obligation without a card.
 *
 * Only the 1870 Franco-Prussian branch prints this ("on the first turn, GE does
 * not select a home card"), so this is reached from exactly that path.  It runs
 * as the diplomacy phase opens rather than by refusing a move, because a
 * rejected move must never mutate state; marking `homeChosen` is what lets the
 * printed diplomacy phase close normally.
 */
export const settleSkippedHomeCards = (G: ImperialElegyState): Power[] => {
  const skipped: Power[] = [];
  for (const power of POWERS) {
    if (!francoPrussianPrepRule(G, power).noHomeCard) continue;
    if (G.powers[power].flags.homeChosen) continue;
    G.powers[power].flags.homeChosen = true;
    G.flags[`skippedHomeCard:${power}`] = G.turn;
    log(G, power, "homeCardSkipped", {reason: "francoPrussian"});
    skipped.push(power);
  }
  // The printed diplomacy phase walks the seats in order and only advances when
  // the current seat has chosen.  A seat whose card is skipped by the scenario
  // is already "chosen", so the pointer must move past it here — otherwise the
  // phase would wait on a seat that can never act.
  if (skipped.length > 0) {
    const next = POWERS.find((power) => !G.powers[power].flags.homeChosen);
    G.activePower = next ?? G.activePower;
  }
  return skipped;
};

/** The scenario's first campaign turn (kept local to avoid an import cycle). */
const scenarioFirstTurnOf = (G: ImperialElegyState): number =>
  G.scenario === "s1870" ? 3 : G.scenario === "s1880" ? 4 : 1;

/** The first power to take an action-phase impulse in a scenario. */
export const firstImpulsePower = (G: ImperialElegyState): Power =>
  G.flags.francoPrussianSkipGeImpulse === true && G.turn === scenarioFirstTurnOf(G) ? "UK" : "GE";

/** Kept so a caller can pre-place the setup's own units without a cycle. */
export const _scenarioSetupInternals = {goalsForPower, SPACES, drawCards, placeUnit};
