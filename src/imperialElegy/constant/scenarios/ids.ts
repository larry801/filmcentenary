/**
 * The scenario ids printed in `IE_playbook.pdf` pp. 3-10.
 *
 * This module deliberately has no imports so `types.ts` can widen
 * `ImperialElegyState.scenario` without creating a module cycle through the
 * scenario data (which imports `Power`, `AllianceBox`, … from `types.ts`).
 */
export const SCENARIO_IDS = [
  /** Playbook p. 3 — Scenario 1, seven-turn campaign 1850s-1910s. */
  "campaign",
  /** Playbook p. 3 — the two-turn 1850 tutorial (no VP counting). */
  "tutorial1850",
  /** Playbook p. 4 — Scenario 2, four turns starting at 1870s. */
  "s1870",
  /** Playbook p. 5 — Scenario 3, four turns starting at 1880s. */
  "s1880",
  /** Playbook p. 7 — Historical Great War tutorial (starts at GW turn 0 maneuver). */
  "gwTutorial",
  /** Playbook p. 8 — Alternate Great War Scenario 1. */
  "altGw1",
  /** Playbook p. 9 — Alternate Great War Scenario 2 (Independent Poland). */
  "altGw2",
  /** Playbook p. 10 — Alternate Great War Scenario 3 (Colonial War). */
  "altGw3",
] as const;

export type ScenarioId = (typeof SCENARIO_IDS)[number];

/**
 * Scenario 4 ("No GW", playbook p. 7) is a *modifier* on whichever scenario is
 * played, not a third setup: "Set up whichever scenario you wish to play and
 * modify the victory conditions as follows."  It therefore lives in
 * `setupData.noGw` next to the scenario id instead of in `SCENARIO_IDS`.
 */
export const NO_GW_SETUP_KEY = "noGw" as const;

export const isScenarioId = (value: unknown): value is ScenarioId =>
  typeof value === "string" && (SCENARIO_IDS as readonly string[]).includes(value);
