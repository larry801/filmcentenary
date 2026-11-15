/**
 * Seeded self-play sweep for Virgin Queen.
 *
 * Not part of `yarn test` (it lives under `tools/` and runs whole matches).
 *
 *   npx jest --testPathPatterns "tools/vq-sim" \
 *     --testPathIgnorePatterns "/node_modules/" --runInBand
 *   VQ_SEEDS=VQ-SIM-1,VQ-SIM-2 npx jest --testPathPatterns "tools/vq-sim" \
 *     --testPathIgnorePatterns "/node_modules/" --runInBand
 */
import {runSeededGame, SimResult} from "./harness";

jest.setTimeout(2400000);

const seeds = (process.env.VQ_SEEDS ?? "VQ-SIM-1,VQ-SIM-2,VQ-SIM-3").split(",");

interface Config {
    label: string;
    seed: string;
    scenario?: "campaign" | "tournament" | "tutorial";
    numPlayers?: number;
    chaos: number;
}

/** Every configuration, so the two-, three- and six-player rules all run. */
const CONFIGS: Config[] = seeds.flatMap((seed) => [
    {label: "campaign-6", seed: `${seed}-c6`, numPlayers: 6, chaos: 0},
    {label: "campaign-6-chaos", seed: `${seed}-c6x`, numPlayers: 6, chaos: 0.35},
    {label: "campaign-2", seed: `${seed}-c2`, numPlayers: 2, chaos: 0.35},
    {label: "campaign-4", seed: `${seed}-c4`, numPlayers: 4, chaos: 0.35},
    {label: "tournament-6", seed: `${seed}-t6`, scenario: "tournament", numPlayers: 6, chaos: 0.35},
    {label: "tutorial-2", seed: `${seed}-tut`, scenario: "tutorial", numPlayers: 2, chaos: 0.35},
]);

const summarise = (result: SimResult, label: string): string =>
    `${label} ${String(result.seed)}: steps=${result.steps} year=${result.year} `
    + `phase=${result.phase || "-"} finished=${result.finished} `
    + `gameover=${JSON.stringify(result.gameover)} issues=${result.issues.length}`;

test("seeded self-play: every scenario and player count", () => {
    const results: {config: Config; result: SimResult}[] = [];
    for (const config of CONFIGS) {
        results.push({config, result: runSeededGame({
            seed: config.seed, scenario: config.scenario, numPlayers: config.numPlayers,
            chaos: config.chaos, maxSteps: 20000,
        })});
    }
    for (const {config, result} of results) console.log(summarise(result, config.label));

    const issues = results.flatMap(({config, result}) => result.issues.map((issue) => ({
        ...issue, label: config.label, seed: result.seed,
    })));
    expect(issues.map((issue) =>
        `${issue.label}/${issue.seed}: ${issue.kind} ${issue.phase} t${issue.turn} y${issue.year} `
        + `${issue.power ?? "-"} ${issue.move ?? ""} ${JSON.stringify(issue.args ?? [])} :: ${issue.detail.slice(0, 300)}`,
    )).toEqual([]);

    // A match that never finishes means the flow lost the ability to end.
    const unfinished = results.filter(({result}) => !result.finished)
        .map(({config, result}) => `${config.label}/${String(result.seed)} (year ${result.year}, phase ${result.phase})`);
    expect(unfinished).toEqual([]);
});
