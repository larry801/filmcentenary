/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // The perf harness has its own config (perf/jest.config.js) and needs
  // jsdom + asset stubs, so it is kept out of the normal test run.
  // `.claude/worktrees/` holds local agent worktrees whose copies of `src/`
  // would otherwise be collected a second (and third) time.
  // `tools/ie-sim/` and `tools/vq-sim/` are the seeded self-play harnesses:
  // several suites there run real multi-thousand-step games (the batch
  // statistics one takes ~20 minutes), so they are run explicitly, never as
  // part of `yarn test`.  See `tools/*/README.md`.
  // The entry is anchored with `<rootDir>`: a bare `/tools/` matches every path
  // whose ancestors include a `tools` directory, and a checkout under e.g.
  // `~/tools/` would silently exclude the whole repository.
  testPathIgnorePatterns: ["/node_modules/", "/perf/", "/e2e/", "/.claude/", "<rootDir>/tools/"],
  // Every file pays jest's own per-file start (~0.3 s here) plus the engine's
  // import, and no file is long, so the suite is throughput-bound rather than
  // tail-bound: on a 4-core box the default (cores - 1) measured 113.7 s and
  // four workers 83.0 s.  Six workers oversubscribed it back to 88.2 s, so the
  // ceiling is the core count.  `JEST_MAX_WORKERS` narrows it on a busy machine.
  maxWorkers: process.env.JEST_MAX_WORKERS ? Number(process.env.JEST_MAX_WORKERS) : "100%",
  setupFilesAfterEnv: ["./config.js"]
};
