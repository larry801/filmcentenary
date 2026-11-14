/**
 * Merge sharded batch dumps into one report.
 *
 *   node tools/ie-sim/batch-report.js /tmp/ie-batch/shard-*.json
 *
 * The batch test already prints a per-shard report; this aggregates the shards
 * so a 50-seed run reads like a single run.  It exits non-zero when the batch
 * contains a crash, a stall or an unfinished game.
 */
const fs = require("fs");

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node tools/ie-sim/batch-report.js <dump.json>...");
  process.exit(2);
}

const games = files.flatMap((file) => JSON.parse(fs.readFileSync(file, "utf8")));

/** Same normalisation as the jest test, so signatures line up across shards. */
const signature = (issue) => {
  const message = String(issue.detail).split("\n")[0].replace(/\d+/g, "#").slice(0, 120);
  return `${issue.kind} | ${issue.move ?? "-"} | ${issue.phase} | ${issue.power ?? "-"} | ${message}`;
};

const FATAL = new Set(["stall", "invariant", "exception", "unfinished"]);

const total = games.length;
const finished = games.filter((game) => game.finished);
const unfinished = games.filter((game) => !game.finished);

console.log(`\n=== ${total} games from ${files.length} shard(s) ===`);
console.log(`finished ${finished.length}/${total} (${((finished.length / total) * 100).toFixed(1)}%)`);

// ---- result reasons
const reasons = {};
for (const game of finished) {
  const reason = game.result?.reason ?? "no-result";
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}
console.log("\nresult reasons:");
for (const [reason, count] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(4)}  ${reason}`);
}

// ---- per-mode
const modes = [...new Set(games.map((game) => game.mode))];
console.log("\nmode            finished/total   avg steps  median  avg turn  max turn");
for (const mode of modes) {
  const subset = games.filter((game) => game.mode === mode);
  const done = subset.filter((game) => game.finished).length;
  const steps = subset.map((game) => game.steps).sort((a, b) => a - b);
  const avgSteps = (steps.reduce((n, s) => n + s, 0) / steps.length).toFixed(0);
  const median = steps[Math.floor(steps.length / 2)];
  const avgTurn = (subset.reduce((n, g) => n + g.turn, 0) / subset.length).toFixed(1);
  const maxTurn = Math.max(...subset.map((game) => game.turn));
  console.log(
    `${mode.padEnd(15)} ${String(done).padStart(4)}/${String(subset.length).padEnd(9)} `
    + `${avgSteps.padStart(9)} ${String(median).padStart(7)} ${avgTurn.padStart(9)} ${String(maxTurn).padStart(9)}`,
  );
}

// ---- step distribution: shows whether games converge or cluster at the cap
const buckets = { "<300": 0, "300-600": 0, "600-900": 0, "900-1200": 0, "1200-5000": 0, ">=5000": 0 };
for (const game of games) {
  const s = game.steps;
  if (s < 300) buckets["<300"] += 1;
  else if (s < 600) buckets["300-600"] += 1;
  else if (s < 900) buckets["600-900"] += 1;
  else if (s < 1200) buckets["900-1200"] += 1;
  else if (s < 5000) buckets["1200-5000"] += 1;
  else buckets[">=5000"] += 1;
}
console.log("\nsteps:", JSON.stringify(buckets));

// ---- deduplicated fatal signatures
const signatures = new Map();
for (const game of games) {
  for (const issue of game.issues ?? []) {
    if (!FATAL.has(issue.kind)) continue;
    const key = signature(issue);
    const entry = signatures.get(key) ?? {occurrences: 0, seeds: new Set(), first: {seed: game.seed, issue}};
    entry.occurrences += 1;
    entry.seeds.add(game.seed);
    signatures.set(key, entry);
  }
}

if (signatures.size === 0) {
  console.log("\nno fatal issues");
} else {
  console.log(`\n${signatures.size} distinct fatal signature(s), most widespread first:`);
  for (const [key, entry] of [...signatures.entries()].sort((a, b) => b[1].seeds.size - a[1].seeds.size)) {
    const share = ((entry.seeds.size / total) * 100).toFixed(1);
    console.log(`\n  ${entry.seeds.size}/${total} games (${share}%), ${entry.occurrences} occurrence(s)`);
    console.log(`  ${key}`);
    console.log(`    first: ${entry.first.seed} step=${entry.first.issue.step} turn=${entry.first.issue.turn}`);
    console.log(`    ${String(entry.first.issue.detail).split("\n")[0].slice(0, 200)}`);
  }
}

// ---- non-fatal issues are still interesting: they are refused moves
const nonFatal = {};
for (const game of games) {
  for (const issue of game.issues ?? []) {
    if (FATAL.has(issue.kind)) continue;
    const key = `${issue.kind} | ${issue.move ?? "-"}`;
    nonFatal[key] = (nonFatal[key] ?? 0) + 1;
  }
}
if (Object.keys(nonFatal).length > 0) {
  console.log("\nnon-fatal (refused moves, recorded once each):");
  for (const [key, count] of Object.entries(nonFatal).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)}  ${key}`);
  }
}

// ---- coverage across the merged batch
const moves = {};
const phases = {};
for (const game of games) {
  for (const [move, count] of Object.entries(game.eventCounts ?? {})) moves[move] = (moves[move] ?? 0) + count;
  for (const [phase, count] of Object.entries(game.phaseCounts ?? {})) phases[phase] = (phases[phase] ?? 0) + count;
}
console.log("\nphases:", JSON.stringify(phases));

// The declared move list is read from `game.ts` as text: node cannot require a
// TypeScript module here, and keeping the list in one place is worth the grep.
const gameSource = fs.readFileSync(require("path").join(__dirname, "../../src/imperialElegy/game.ts"), "utf8");
const block = gameSource.slice(
  gameSource.indexOf("const ALL_MOVES = {"),
  gameSource.indexOf("};", gameSource.indexOf("const ALL_MOVES = {")),
);
const declared = [...block.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*),$/gm)].map((match) => match[1]);
const never = declared.filter((name) => moves[name] === undefined);
console.log(`\nmoves exercised ${declared.length - never.length}/${declared.length}; never: ${never.join(", ") || "(none)"}`);

process.exit(unfinished.length > 0 || signatures.size > 0 ? 1 : 0);
