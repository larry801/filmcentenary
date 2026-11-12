import {defineConfig, devices} from "@playwright/test";

/**
 * Regression run of the original Imperial Elegy hotseat spec against a
 * production build served by `vite preview` on port 5203.
 *
 * The preview server is started by hand, so this config deliberately has no
 * `webServer` block.
 */
export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    workers: 1,
    timeout: 60_000,
    expect: {timeout: 10_000},
    reporter: "line",
    use: {
        baseURL: "http://127.0.0.1:5203",
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
