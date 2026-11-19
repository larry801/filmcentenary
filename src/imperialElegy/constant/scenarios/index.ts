import type {Power} from "../../types";
import {POWERS} from "../../types";
import {SCENARIO_IDS, ScenarioId, isScenarioId} from "./ids";
import type {ScenarioDef, ScenarioPowerStart} from "./types";
import {CAMPAIGN_SCENARIO} from "./campaign";
import {S1870_SCENARIO} from "./s1870";
import {S1880_SCENARIO} from "./s1880";
import {GW_TUTORIAL_SCENARIO} from "./gwTutorial";
import {ALT_GW_SCENARIOS} from "./altGw";

/**
 * Every printed scenario, keyed by its `ScenarioId`.
 *
 * The playbook prints: Scenario 1 campaign + the 1850 tutorial (p. 3),
 * Scenario 2 1870 (p. 4), Scenario 3 1880 (p. 5), Scenario 4 No GW (p. 7, a
 * victory-condition modifier, see `configuration.ts#parseNoGw`), the Historical
 * Great War tutorial (p. 7) and Alternate Great War Scenarios 1-3 (pp. 8-10).
 */
export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  campaign: CAMPAIGN_SCENARIO,
  // The 1850 tutorial prints the identical setup as the campaign; only the
  // length (two turns) and "do not count VPs" differ, so it inherits the
  // campaign's units and overrides those two rules.
  tutorial1850: {
    ...CAMPAIGN_SCENARIO,
    id: "tutorial1850",
    name: "1850 Tutorial",
    nameZh: "1850 教学剧本",
    firstTurn: 1,
    lastTurn: 2,
    special: {
      ...CAMPAIGN_SCENARIO.special,
      // "Do not count VPs at the end of the tutorial scenario."  The tutorial
      // is a two-turn walk-through, so no NG draw and no Blood and Iron!.
      countVp: false,
      ngDrawTurns: [],
      bloodAndIron: false,
      allowsNoGw: false,
    },
    notes: [
      ...CAMPAIGN_SCENARIO.notes,
      "1850 Tutorial: turns 1-2 only (1850s-1860s).",
      "Do not count VPs at the end of the tutorial scenario (playbook p. 3).",
      "The tutorial uses Scenario 1's setup unchanged; it exists to teach the action, diplomacy and end phases.",
    ],
  },
  s1870: S1870_SCENARIO,
  s1880: S1880_SCENARIO,
  gwTutorial: GW_TUTORIAL_SCENARIO,
  altGw1: ALT_GW_SCENARIOS[0],
  altGw2: ALT_GW_SCENARIOS[1],
  altGw3: ALT_GW_SCENARIOS[2],
};

/** Resolve a scenario by id, falling back to the campaign. */
export const scenarioById = (id: unknown): ScenarioDef =>
  isScenarioId(id) ? SCENARIOS[id] : SCENARIO_IDS.includes(id as ScenarioId) ? SCENARIOS[id as ScenarioId] : CAMPAIGN_SCENARIO;

/** The scenario a live state is playing (older saves have no field => campaign). */
export const scenarioOf = (G: {scenario?: unknown} | null | undefined): ScenarioDef =>
  scenarioById(G?.scenario);

/**
 * Resolve a `setupData` scenario token.
 *
 * Accepts the id the lobby writes and the name a hand-written fixture may use;
 * anything unrecognised reads as the campaign rather than throwing, because a
 * stale client must still be able to open a match.
 */
export const scenarioFromSetupData = (value: unknown): ScenarioId => {
  if (isScenarioId(value)) return value;
  if (typeof value === "string") {
    const byName = SCENARIO_IDS.find((id) => SCENARIOS[id].name === value || SCENARIOS[id].nameZh === value);
    if (byName !== undefined) return byName;
  }
  return "campaign";
};

/**
 * The scenario's opening marker for one track of one power.
 *
 * `ScenarioPowerStart` may omit a track a scenario does not print (e.g. the
 * 1870 print lists no City of Light points for FR).  A tester comparing the
 * board to the printed display then needs an unambiguous "not printed" answer,
 * so the printed values live here and the *printed* totals are what the tests
 * assert against — the engine still derives board totals from control.
 */
export const printedStart = (def: ScenarioDef, power: Power): ScenarioPowerStart => def.powers[power];

/** Printed per-power track values, in seat order. */
export const scenarioPowerStarts = (def: ScenarioDef): {power: Power; start: ScenarioPowerStart}[] =>
  POWERS.map((power) => ({power, start: def.powers[power]}));

/** Scenario ids in printed order, for the lobby's picker. */
export const SCENARIO_OPTIONS: readonly {id: ScenarioId; name: string; nameZh: string}[] = SCENARIO_IDS.map((id) => {
  const def = SCENARIOS[id];
  return {id, name: def.name, nameZh: def.nameZh};
});

export * from "./ids";
export type {ScenarioDef, ScenarioPowerStart, ScenarioUnitSetup, ScenarioFortSetup, ScenarioTruce, ScenarioItalySetup, ScenarioSpecialRules, GwTutorialSetup, AltenateGwSetup} from "./types";
