/**
 * Batch statistics over many seeds.
 *
 * The single-seed sweep tests answer "did *this* game break?".  This answers the
 * questions a release decision needs:
 *
 *  - what fraction of games finish, and why do the rest stop?
 *  - which failure signatures repeat (deduplicated, so one noisy seed counts
 *    once per signature rather than once per step)?
 *  - which moves and phases never happen at all across the whole batch?
 *
 * Run with a larger N when hunting:
 *
 *   IE_BATCH=100 npx jest --testPathPatterns tools/ie-sim/batch --runInBand
 *
 * Deterministic: seeds are `IE-BATCH-<n>`, so a reported signature can be
 * reproduced with `IE_SEEDS=<seed>` on the matching single-mode suite.
 */
import {runSeededGame, SimIssue, SimResult} from "./harness";

jest.setTimeout(3600000);

const COUNT = Number(process.env.IE_BATCH ?? 12);
/** Round-robin the modes so one mode cannot dominate the statistics. */
const MODES: {name: string; opts: Parameters<typeof runSeededGame>[0] extends infer O ? Partial<O> : never}[] = [
  {name: "campaign", opts: {}},
  {name: "war", opts: {war: true}},
  {name: "navy", opts: {navy: true, war: true}},
  {name: "amphibious", opts: {navy: true, war: true, amphibious: true}},
  {name: "greatWar", opts: {greatWar: true, aggressive: true}},
  {name: "chaos", opts: {war: true, chaos: 0.5, rng: () => Math.random()}},
];

/** Stable identity for an issue, so one bug counts once. */
const signature = (issue: SimIssue): string => {
  const message = issue.detail.split("\n")[0].replace(/\d+/g, "#").slice(0, 120);
  return `${issue.kind} | ${issue.move ?? "-"} | ${issue.phase} | ${issue.power ?? "-"} | ${message}`;
};

interface Bucket {
  count: number;
  seeds: Set<string>;
  first: {seed: string; step: number; turn: number; detail: string};
}

test("batch statistics", () => {
  const results: (SimResult & {mode: string})[] = [];
  const started = Date.now();

  for (let i = 0; i < COUNT; i += 1) {
    for (const mode of MODES) {
      const seed = `IE-BATCH-${i}-${mode.name}`;
      const result = runSeededGame({seed, maxSteps: 20000, ...mode.opts});
      results.push({...result, mode: mode.name});
    }
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const total = results.length;
  const finished = results.filter((result) => result.finished);
  const unfinished = results.filter((result) => !result.finished);

  console.log(`\n=== ${total} games in ${elapsed}s (${(Number(elapsed) / total).toFixed(2)}s/game) ===`);
  console.log(`finished ${finished.length}/${total}`);

  // ---- results reached, by reason
  const reasons: Record<string, number> = {};
  for (const result of finished) {
    const reason = result.result?.reason ?? "no-result";
    reasons[reason] = (reasons[reason] ?? 0) + 1;
  }
  console.log("result reasons:", JSON.stringify(reasons, null, 0));

  // ---- per-mode completion
  console.log("\nmode            finished/total  avg steps  avg turn");
  for (const mode of MODES) {
    const subset = results.filter((result) => result.mode === mode.name);
    const done = subset.filter((result) => result.finished).length;
    const avgSteps = (subset.reduce((n, r) => n + r.steps, 0) / subset.length).toFixed(0);
    const avgTurn = (subset.reduce((n, r) => n + r.turn, 0) / subset.length).toFixed(1);
    console.log(`${mode.name.padEnd(15)} ${String(done).padStart(3)}/${String(subset.length).padEnd(12)} ${avgSteps.padStart(9)} ${avgTurn.padStart(9)}`);
  }

  // ---- deduplicated failure signatures (fatal kinds only)
  const FATAL = new Set(["stall", "invariant", "exception", "unfinished"]);
  const buckets = new Map<string, Bucket>();
  for (const result of results) {
    for (const issue of result.issues) {
      if (!FATAL.has(issue.kind)) continue;
      const key = signature(issue);
      const bucket = buckets.get(key) ?? {
        count: 0,
        seeds: new Set<string>(),
        first: {seed: String(result.seed), step: issue.step, turn: issue.turn, detail: issue.detail},
      };
      bucket.count += 1;
      bucket.seeds.add(String(result.seed));
      buckets.set(key, bucket);
    }
  }

  if (buckets.size === 0) {
    console.log("\nno fatal issues in the batch");
  } else {
    console.log(`\n${buckets.size} distinct fatal signature(s):`);
    const ranked = [...buckets.entries()].sort((a, b) => b[1].seeds.size - a[1].seeds.size);
    for (const [key, bucket] of ranked) {
      console.log(`\n  [${bucket.seeds.size} seed(s), ${bucket.count} occurrence(s)] ${key}`);
      console.log(`    first: ${bucket.first.seed} step=${bucket.first.step} turn=${bucket.first.turn}`);
      console.log(`    ${bucket.first.detail.split("\n")[0].slice(0, 200)}`);
      if (bucket.seeds.size <= 4) console.log(`    seeds: ${[...bucket.seeds].join(", ")}`);
    }
  }

  // ---- coverage: which moves/phases never happen
  const moves: Record<string, number> = {};
  const phases: Record<string, number> = {};
  for (const result of results) {
    for (const event of result.events) {
      moves[event.move] = (moves[event.move] ?? 0) + 1;
      phases[event.phase] = (phases[event.phase] ?? 0) + 1;
    }
  }
  console.log("\nphases:", JSON.stringify(phases));
  console.log("moves:", JSON.stringify(moves));

  // Every move the game def exposes should be reachable by *some* mode; report
  // the ones the batch never touched so dead paths are visible.
  const {ImperialElegyGameDef} = require("../../src/imperialElegy/game");
  const declared = Object.keys(ImperialElegyGameDef.moves ?? {});
  const never = declared.filter((name) => moves[name] === undefined);
  console.log(`\nmoves never exercised (${never.length}/${declared.length}): ${never.join(", ") || "(none)"}`);

  // ---- hard assertions: a batch must never crash, stall or lose a game.
  expect(unfinished.map((result) => `${result.seed}:${result.phase}:t${result.turn}`)).toEqual([]);
  const crashes = results.flatMap((result) => result.issues.filter((issue) => issue.kind === "exception"));
  expect(crashes.map((issue) => `${issue.move}: ${issue.detail.split("\n")[0]}`)).toEqual([]);
  const stalls = results.flatMap((result) => result.issues.filter((issue) => issue.kind === "stall"));
  expect(stalls.map((issue) => `${issue.seed ?? ""}${issue.move}: ${issue.detail.split("\n")[0]}`)).toEqual([]);
});
