import {defineConfig, devices} from "@playwright/test";

/**
 * Standalone config for the online/spectator Imperial Elegy browser spec.
 *
 * The spec starts its own boardgame.io server on :4004 and a static
 * `vite preview` on :5202, so this config deliberately has no `webServer`
 * block.  Its output goes to a dedicated directory so it never collides with
 * the plain suite's `test-results/`; CI uploads both.
 */
export default defineConfig({
    testDir: "./e2e",
    testMatch: ["**/imperial-elegy-spectator.spec.ts"],
    fullyParallel: false,
    workers: 1,
    timeout: 60_000,
    expect: {timeout: 10_000},
    reporter: "list",
    outputDir: "test-results/ie-spectator",
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
