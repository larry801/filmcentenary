/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // The perf harness has its own config (perf/jest.config.js) and needs
  // jsdom + asset stubs, so it is kept out of the normal test run.
  // `.claude/worktrees/` holds local agent worktrees whose copies of `src/`
  // would otherwise be collected a second (and third) time.
  // `tools/ie-sim/` is the seeded self-play harness: several suites there run
  // real multi-thousand-step games (the batch statistics one takes ~20 minutes),
  // so it is run explicitly, never as part of `yarn test`.  See
  // `tools/ie-sim/README.md`.
  testPathIgnorePatterns: ["/node_modules/", "/perf/", "/e2e/", "/.claude/", "/tools/"],
  setupFilesAfterEnv: ["./config.js"]
};