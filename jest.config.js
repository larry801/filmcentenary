/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // The perf harness has its own config (perf/jest.config.js) and needs
  // jsdom + asset stubs, so it is kept out of the normal test run.
  testPathIgnorePatterns: ["/node_modules/", "/perf/"],
  setupFilesAfterEnv: ["./config.js"]
};