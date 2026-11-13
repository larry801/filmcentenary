import {defineConfig, devices} from "@playwright/test";

/**
 * Regression run of the original Imperial Elegy hotseat spec against a
 * production build served by `vite preview` on port 5203.
 *
 * `webServer` runs `vite preview` over the `build/` directory (what
 * `yarn build` writes), so the spec needs no hand-started server.
 */
export default defineConfig({
    testDir: "./e2e",
    testMatch: ["**/imperial-elegy.spec.ts"],
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
    webServer: {
        command: "yarn vite preview --host 127.0.0.1 --port 5203 --strictPort",
        url: "http://127.0.0.1:5203",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
