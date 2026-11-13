/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // The perf harness has its own config (perf/jest.config.js) and needs
  // jsdom + asset stubs, so it is kept out of the normal test run.
  // `.claude/worktrees/` holds local agent worktrees whose copies of `src/`
  // would otherwise be collected a second (and third) time.
  testPathIgnorePatterns: ["/node_modules/", "/perf/", "/e2e/", "/.claude/"],
  setupFilesAfterEnv: ["./config.js"]
};