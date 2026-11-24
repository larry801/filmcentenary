/**
 * Property-based (seeded, generative) simulation suite for Virgin Queen.
 *
 * `sweep.test.ts` asks whether the engine accepts the board's decisions.
 * This suite asks the rulebook question instead: after every action of every
 * generated match, is the whole board still legal?
 *
 *   A-tier violation  -> test failure, with the seed and the first bad action.
 *   B-tier rule audit -> printed for the report, never fails (the engine's
 *                        state model is intentionally looser than the printed
 *                        rule in those places).
 *
 * Each generated match is also checked for three properties the online board
 * depends on but the rules do not mention:
 *
 *   serialisable state  — boardgame.io only syncs JSON (`JSON.stringify` trip)
 *   replay determinism  — the same seed must produce the same trace
 *   `playerView` privacy — hands, the deck, the face-down pool and private
 *                          negotiations never reach another client
 *
 * Budget: one seed runs four scenario/player-count/chaos configurations.  The
 * CI job raises `VQ_PROPERTY_SEEDS`; locally one seed is enough for a smoke run.
 *
 *   VQ_PROPERTY_SEEDS=VQ-PROP-1,VQ-PROP-2 npx jest \
 *     --testPathPatterns "tools/vq-sim/property" \
 *     --testPathIgnorePatterns "/node_modules/" --runInBand
 */
import {PropertyConfig, PropertyRun, experimentId, runProperty, shrinkFailure} from "./properties";

jest.setTimeout(1800000);

const seeds = (process.env.VQ_PROPERTY_SEEDS ?? "VQ-PROP-1").split(",").filter((seed) => seed !== "");
/**
 * Step budget per configuration.  These matches are driven through the real
 * boardgame.io reducer, which deep-clones the state on every action: roughly
 * 200 ms per action on a laptop, so one seed of this matrix is ~8 minutes.  The
 * budgets are therefore sized to cover many full years (not every last Winter):
 * this suite is about invariant coverage, while `sweep.test.ts` is the one that
 * insists every match reaches a result.  `VQ_PROPERTY_STEPS` overrides every
 * configuration for a longer soak.
 */
const budget = (fallback: number): number => Number(process.env.VQ_PROPERTY_STEPS ?? fallback);

/** One configuration per interesting flow: full table, reduced table, knockout, tutorial. */
const CONFIGS: PropertyConfig[] = seeds.flatMap((seed) => [
    {label: "campaign-6", seed: `${seed}-c6`, numPlayers: 6, chaos: 0, maxSteps: budget(500), sampleEvery: 249},
    {label: "campaign-4-chaos", seed: `${seed}-c4x`, numPlayers: 4, chaos: 0.5, maxSteps: budget(350), sampleEvery: 174},
    {label: "tournament-2-chaos", seed: `${seed}-t2x`, scenario: "tournament", numPlayers: 2, chaos: 0.5, maxSteps: budget(350), sampleEvery: 174},
    {label: "tutorial-2", seed: `${seed}-tut`, scenario: "tutorial", numPlayers: 2, chaos: 0.35, maxSteps: budget(300), sampleEvery: 149},
]);

let runs: PropertyRun[];

beforeAll(() => {
    runs = CONFIGS.map(runProperty);
    for (const run of runs) {
        console.log(
            `${experimentId(run.config)}: steps=${run.result.steps} year=${run.result.year} `
            + `finished=${run.result.finished} gameover=${JSON.stringify(run.result.gameover)} `
            + `violations=${run.violations.length} audits=${run.audits.length} `
            + `privacy=${run.privacy.length} roundTrip=${run.roundTrip.length}`,
        );
    }
});

const describeViolation = (run: PropertyRun, step: number, entries: string[]): string =>
    `${experimentId(run.config)} step ${step}/${run.result.steps}: ${entries.join("; ")}`;

test("no A-tier rule invariant is violated by any generated match", () => {
    const failures: string[] = [];
    for (const run of runs) {
        for (const {step, violations} of run.violations) {
            // The first failing action is already the shortest failing prefix
            // because the run is deterministic; re-running it proves that and
            // hands the reader a minimal reproduction.
            let shrunk = "";
            try {
                const replay = shrinkFailure(run.config, step);
                const reproduced = replay.violations.some((entry) =>
                    entry.step === step && entry.violations.map((violation) => violation.id).join(",") ===
                        violations.map((violation) => violation.id).join(","));
                shrunk = reproduced
                    ? ` (reproduced with maxSteps=${step + 1}, seed="${run.config.seed}")`
                    : " (WARNING: not reproducible on replay)";
            } catch (error) {
                shrunk = ` (replay threw: ${String((error as Error)?.message ?? error)})`;
            }
            failures.push(describeViolation(run, step, violations.map((violation) =>
                `[rule ${violation.rule}${violation.tier === "B" ? " audit" : ""}] ${violation.id}: ${violation.detail}`)) + shrunk);
        }
    }
    expect(failures).toEqual([]);
});

test("every intermediate state survives a JSON round-trip", () => {
    const failures = runs.flatMap((run) =>
        run.roundTrip.map((entry) => describeViolation(run, entry.step, [entry.detail])));
    expect(failures).toEqual([]);
});

test("playerView never leaks hidden information", () => {
    const failures = runs.flatMap((run) =>
        run.privacy.map((entry) => describeViolation(run, entry.step, [`viewer=${entry.viewer ?? "spectator"}`, entry.detail])));
    expect(failures).toEqual([]);
});

test("no generated match stalls before its step budget", () => {
    // A run that used its whole budget is simply long, not stuck.  What must not
    // happen is a run that stops early (`finished=false` while `steps` is well
    // below `maxSteps`): that means the flow lost the ability to continue, which
    // is exactly the deadlock class the sweep hunts.
    const budget = (run: PropertyRun): number => run.config.maxSteps ?? 4000;
    const stalled = runs.filter((run) => !run.result.finished && run.result.steps < budget(run) - 1)
        .map((run) => `${experimentId(run.config)} stopped at year ${run.result.year} `
            + `phase ${run.result.phase} after ${run.result.steps}/${budget(run)} steps `
            + `(issues: ${run.result.issues.map((issue) => issue.detail.slice(0, 120)).join("; ") || "none"})`);
    expect(stalled).toEqual([]);
    const capped = runs.filter((run) => !run.result.finished && run.result.steps >= budget(run) - 1)
        .map((run) => `${experimentId(run.config)} used its ${budget(run)}-step budget at year ${run.result.year}`);
    for (const entry of capped) console.log(`BUDGET ${entry}`);
});

test("the recorded gameover satisfies rule 25", () => {
    const failures = runs.flatMap((run) =>
        run.outcome.map((detail) => `${experimentId(run.config)} ${JSON.stringify(run.result.gameover)}: ${detail}`));
    expect(failures).toEqual([]);
});

test("the same seed replays to the same trace and the same state", () => {
    // The smallest configuration keeps this cheap; determinism is a property of
    // the harness (seeded RNG + pure reducer), not of a particular match.
    const config = CONFIGS[CONFIGS.length - 1];
    const first = runs[runs.length - 1];
    const replay = runProperty(config);
    expect(replay.trace).toEqual(first.trace);
    expect(replay.samples.map((sample) => sample.state))
        .toEqual(first.samples.map((sample) => sample.state));
    expect(replay.result.gameover).toEqual(first.result.gameover);
});

test("B-tier rule audits are reported for the record", () => {
    const audits = runs.flatMap((run) => run.audits.map((entry) =>
        describeViolation(run, entry.step, entry.violations.map((violation) =>
            `[rule ${violation.rule}] ${violation.id}: ${violation.detail}`))));
    for (const audit of audits) console.log(`AUDIT ${audit}`);
    // Audits are informational: each entry must still name the printed rule it
    // audits, so the report can be traced back to a paragraph.
    for (const run of runs) {
        for (const {violations} of run.audits) {
            for (const violation of violations) {
                expect(violation.rule.length).toBeGreaterThan(0);
                expect(violation.detail.length).toBeGreaterThan(0);
            }
        }
    }
});
