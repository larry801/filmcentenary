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
 * A large batch takes a while (a campaign game is ~700 steps and ~2s), so the
 * run is shardable: `IE_BATCH_SHARD=<i>/<n>` runs every n-th seed block, and
 * `IE_BATCH_DUMP=<file>` writes the raw per-game results as JSON so shards can
 * be merged and analysed afterwards.
 *
 *   IE_BATCH=50 IE_BATCH_SHARD=0/4 IE_BATCH_DUMP=/tmp/ie-0.json \
 *     npx jest --testPathPatterns "tools/ie-sim/batch" \
 *     --testPathIgnorePatterns "/node_modules/" --runInBand
 *
 * Deterministic: seeds are `IE-BATCH-<n>-<mode>`, so a reported signature can be
 * reproduced with `IE_SEEDS=IE-BATCH-<n>-<mode>` on the matching suite.
 */
import {writeFileSync} from "fs";
import {runSeededGame, SimIssue, SimResult} from "./harness";

jest.setTimeout(3600000);

const COUNT = Number(process.env.IE_BATCH ?? 12);
/** Optional `i/n` shard over the seed blocks. */
const SHARD = (() => {
  const raw = process.env.IE_BATCH_SHARD;
  if (!raw) return {index: 0, of: 1};
  const [index, of] = raw.split("/").map(Number);
  return Number.isFinite(index) && Number.isFinite(of) && of > 0 ? {index, of} : {index: 0, of: 1};
})();
/** Optional file to dump raw per-game results into. */
const DUMP = process.env.IE_BATCH_DUMP;
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
    // Shard over seed blocks so several jest processes can run in parallel.
    if (i % SHARD.of !== SHARD.index) continue;
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

  // Raw dump for merging shards.  `events` is dropped: it dominates the size
  // (~1k entries per game) and the analysis below only needs counts.
  if (DUMP) {
    const slim = results.map(({events, result: outcome, ...rest}) => ({
      ...rest,
      result: outcome,
      eventCounts: events.reduce<Record<string, number>>((acc, event) => {
        acc[event.move] = (acc[event.move] ?? 0) + 1;
        return acc;
      }, {}),
      phaseCounts: events.reduce<Record<string, number>>((acc, event) => {
        acc[event.phase] = (acc[event.phase] ?? 0) + 1;
        return acc;
      }, {}),
    }));
    writeFileSync(DUMP, JSON.stringify(slim));
    console.log(`dumped ${slim.length} games to ${DUMP}`);
  }

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
