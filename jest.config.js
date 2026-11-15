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
  setupFilesAfterEnv: ["./config.js"]
};
