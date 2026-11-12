import {defineConfig, devices} from "@playwright/test";

/**
 * Standalone config for the online/spectator Imperial Elegy browser spec.
 *
 * The spec starts its own boardgame.io server on :4004 and a static
 * `vite preview` on :5202, so this config deliberately has no `webServer`
 * block.  The shared test-results directory is avoided because other suites
 * can be running against the same checkout at the same time.
 */
export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    workers: 1,
    timeout: 60_000,
    expect: {timeout: 10_000},
    reporter: "list",
    outputDir: "/tmp/ie/spectator-test-results",
    use: {
        baseURL: "http://127.0.0.1:5202",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: {...devices["Desktop Chrome"], viewport: {width: 1440, height: 900}},
        },
    ],
});
