/**
 * Invariant census — the CI gate for the structural (`A`) group.
 *
 * Runs real games through the real reducer and asserts that no `error`-severity
 * invariant breaks outside the recorded baseline.  Two rules keep the baseline
 * honest:
 *
 * 1. A code that breaks and is not in the baseline fails the run.
 * 2. A baselined code that no longer reproduces fails the run too, so fixing an
 *    engine bug forces its baseline entry to be deleted in the same change.
 *
 * `IE_SEEDS` selects seeds, `IE_MODES` a comma-separated subset of the six
 * modes (all of them by default),
 * `IE_CENSUS_DUMP=<path>` writes the full observation for triage.  `warn`
 * severities are reported but never gate (5.5.3 permits a transient overstack).
 */
import fs from "fs";
import path from "path";
import type {SimIssue, SimOptions, SimResult} from "./harness";
import {runSeededGame} from "./harness";
import {INVARIANTS} from "../../src/imperialElegy/testing/invariants";

interface Mode {
  name: string;
  options: Omit<SimOptions, "seed">;
}

interface BaselineEntry {
  code: string;
  rule: string;
  reason: string;
  ref: string;
  /** One seed/mode pair that still reproduces the break. */
  repro: {seed: string; mode: string}[];
}

interface Observation {
  count: number;
  sample: string;
  seed: string;
  mode: string;
}

const BASELINE_PATH = path.resolve(__dirname, "../../docs/imperial-elegy/invariants.baseline.json");

const readBaseline = (): BaselineEntry[] => {
  if (!fs.existsSync(BASELINE_PATH)) return [];
  return JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")) as BaselineEntry[];
};

const ALL_MODES: Mode[] = [
  {name: "campaign", options: {}},
  {name: "war", options: {war: true}},
  {name: "greatWar", options: {greatWar: true, aggressive: true}},
  {name: "navy", options: {navy: true}},
  {name: "amphibious", options: {amphibious: true}},
  {name: "chaos", options: {chaos: 0.5}},
];

/**
 * The gate runs the whole mode matrix by default: the three modes a first
 * version skipped (amphibious, navy, chaos) produced three of the first six
 * census findings, and the full set still costs under ten minutes in CI.
 * `IE_MODES=campaign,war` narrows it for a quick local loop.
 */
const modes = (): Mode[] => {
  const requested = process.env.IE_MODES;
  if (!requested || requested === "all") return ALL_MODES;
  const wanted = requested.split(",").map((name) => name.trim()).filter(Boolean);
  const picked = ALL_MODES.filter((mode) => wanted.includes(mode.name));
  if (picked.length !== wanted.length) {
    throw new Error(`IE_MODES names an unknown mode; known: ${ALL_MODES.map((mode) => mode.name).join(", ")}`);
  }
  return picked;
};

const seeds = (): string[] => {
  const raw = process.env.IE_SEEDS;
  if (!raw) return ["IE-SIM-1", "IE-SIM-2", "IE-SIM-3"];
  return raw.split(",").map((seed) => seed.trim()).filter(Boolean);
};

const severityOf = (code: string): string | undefined => INVARIANTS.find((invariant) => invariant.code === code)?.severity;

const errorCounts = (result: SimResult): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const issue of result.issues as SimIssue[]) {
    if (issue.kind !== "invariant") continue;
    for (const code of issue.codes ?? []) counts[code] = (counts[code] ?? 0) + 1;
  }
  return counts;
};

interface Census {
  observed: Map<string, Observation>;
  perRun: {seed: string; mode: string; errors: Record<string, number>; issues: SimIssue[]; steps: number; finished: boolean}[];
}

const runCensus = (chosenSeeds: string[], chosenModes: Mode[]): Census => {
  const observed = new Map<string, Observation>();
  const perRun: Census["perRun"] = [];
  for (const seed of chosenSeeds) {
    for (const mode of chosenModes) {
      const result = runSeededGame({seed, ...mode.options} as SimOptions);
      for (const [code, count] of Object.entries(result.invariantCounts)) {
        if (severityOf(code) !== "error") continue;
        const previous = observed.get(code);
        observed.set(code, {
          count: (previous?.count ?? 0) + count,
          sample: previous?.sample ?? result.invariantSamples[code] ?? "",
          seed: previous?.seed ?? seed,
          mode: previous?.mode ?? mode.name,
        });
      }
      perRun.push({
        seed,
        mode: mode.name,
        errors: errorCounts(result),
        issues: result.issues,
        steps: result.steps,
        finished: result.finished,
      });
    }
  }
  return {observed, perRun};
};

const table = (census: Census): string => {
  const header = "code rule      count seed        mode      sample";
  const lines = [...census.observed.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, observation]) => `${code}  ${(INVARIANTS.find((invariant) => invariant.code === code)?.rule ?? "").padEnd(9)} ${String(observation.count).padStart(5)} ${observation.seed.padEnd(11)} ${observation.mode.padEnd(9)} ${observation.sample}`);
  return [header, ...lines].join("\n");
};

describe("A-group invariant census", () => {
  jest.setTimeout(30 * 60 * 1000);

  const chosenSeeds = seeds();
  const chosenModes = modes();
  const baseline = readBaseline();
  let census: Census;

  beforeAll(() => {
    census = runCensus(chosenSeeds, chosenModes);
    if (process.env.IE_CENSUS_DUMP) {
      const dump = {
        seeds: chosenSeeds,
        modes: chosenModes.map((mode) => mode.name),
        observed: Object.fromEntries(census.observed),
        perRun: census.perRun.map((run) => ({seed: run.seed, mode: run.mode, errors: run.errors, steps: run.steps, finished: run.finished})),
      };
      fs.writeFileSync(process.env.IE_CENSUS_DUMP, JSON.stringify(dump, null, 2));
    }
  });

  test("no error-severity break outside the baseline", () => {
    const baselined = new Set(baseline.map((entry) => entry.code));
    const unexpected = [...census.observed.entries()].filter(([code]) => !baselined.has(code));
    const report = [
      `seeds: ${chosenSeeds.join(", ")}`,
      `modes: ${chosenModes.map((mode) => mode.name).join(", ")}`,
      census.observed.size === 0 ? "no error-severity breaks" : table(census),
    ].join("\n");
    if (unexpected.length > 0) {
      console.error(report);
      throw new Error(
        `unbaselined invariant breaks:\n${unexpected
          .map(([code, observation]) => `  ${code} (${severityOf(code)}): ${observation.sample} [${observation.seed} ${observation.mode}, ${observation.count} hits]`)
          .join("\n")}\nRecord each one in ${BASELINE_PATH} with a reason and a repro, or fix it.`,
      );
    }
    console.log(report);
  });

  test("the baseline holds no stale or warn-severity entry", () => {
    for (const entry of baseline) {
      expect({code: entry.code, known: severityOf(entry.code)}).toEqual({code: entry.code, known: "error"});
      expect(entry.reason.length).toBeGreaterThan(0);
      expect(entry.ref.length).toBeGreaterThan(0);
      expect(entry.repro.length).toBeGreaterThan(0);
    }
    const stale: string[] = [];
    for (const entry of baseline) {
      if (census.observed.has(entry.code)) continue;
      // Not seen in this slice: the recorded repro must still produce it,
      // otherwise the entry describes a break that no longer exists.
      const reproduced = entry.repro.some((repro) => {
        const mode = ALL_MODES.find((candidate) => candidate.name === repro.mode);
        if (!mode) throw new Error(`baseline ${entry.code} names unknown mode ${repro.mode}`);
        const result = runSeededGame({seed: repro.seed, ...mode.options} as SimOptions);
        return Object.keys(errorCounts(result)).includes(entry.code);
      });
      if (!reproduced) stale.push(entry.code);
    }
    if (stale.length > 0) {
      throw new Error(`baseline entries no longer reproduce (delete them): ${stale.join(", ")}`);
    }
  });

  test("no run hits the step cap", () => {
    const capped = census.perRun.filter((run) => run.steps >= 20000).map((run) => run.seed + " " + run.mode);
    expect(capped).toEqual([]);
  });
});
