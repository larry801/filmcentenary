/**
 * Seeded self-play sweep for Imperial Elegy.
 *
 * Drives the real boardgame.io engine (seeded random plugin, phase/turn flow,
 * move validation and `playerView` redaction) with the Rule 34 bot for every
 * seat, then asserts that no action was refused and that the structural
 * invariants in `harness.ts#checkInvariants` held throughout.
 *
 * Not part of `yarn test` (it lives under `tools/` and is slow).  Run it with:
 *
 *   npx jest --testPathPatterns tools/ie-sim --runInBand
 *   IE_SEEDS=A,B,C npx jest --testPathPatterns tools/ie-sim --runInBand
 *
 * Each seed runs twice: the 1850 campaign to the end of turn 7, then a match
 * that starts in the Great War with aggressive play, so the maneuver, battle,
 * winter and colonial/neutral decisions are all exercised.
 */
import {runSeededGame, SimResult} from "./harness";

jest.setTimeout(1800000);

const seeds = (process.env.IE_SEEDS ?? "IE-SIM-1,IE-SIM-2,IE-SIM-3").split(",");

const summarise = (result: SimResult): string => {
  const lines = [
    `${String(result.seed)}: steps=${result.steps} turn=${result.turn} phase=${result.phase} `
    + `finished=${result.finished} reason=${result.result?.reason ?? null} gw=${result.gw}`,
  ];
  for (const issue of result.issues) {
    lines.push(
      `   ${issue.kind} step=${issue.step} t${issue.turn} ${issue.phase} ${issue.power ?? "-"} `
      + `${issue.move ?? ""} ${JSON.stringify(issue.args ?? [])}: ${issue.detail.slice(0, 400)}`,
    );
  }
  return lines.join("\n");
};

test("seeded self-play: campaign and Great War", () => {
  const results: SimResult[] = [];
  for (const seed of seeds) {
    results.push(runSeededGame({seed, maxSteps: 20000}));
    // A Great War match gets its own seed so the two halves are independent.
    results.push(runSeededGame({seed: `${seed}-gw`, maxSteps: 20000, greatWar: true, aggressive: true}));
  }
  for (const result of results) console.log(summarise(result));

  const issues = results.flatMap((result) => result.issues);
  const unfinished = results.filter((result) => !result.finished);
  expect(issues).toEqual([]);
  expect(unfinished.map((result) => result.seed)).toEqual([]);
});
