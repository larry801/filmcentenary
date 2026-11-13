import {defineConfig, devices} from "@playwright/test";

/**
 * `vite preview` over the `build/` directory on :5201 for the new-controls
 * spec.  `webServer` starts it, so no manual preview is needed.
 */
export default defineConfig({
    testDir: "./e2e",
    testMatch: ["**/imperial-elegy-controls.spec.ts"],
    timeout: 60_000,
    expect: {timeout: 10_000},
    reporter: "list",
    use: {
        baseURL: "http://127.0.0.1:5201",
        trace: "on-first-retry",
        screenshot: "only-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: {...devices["Desktop Chrome"], viewport: {width: 1440, height: 900}},
        },
    ],
    webServer: {
        command: "yarn vite preview --host 127.0.0.1 --port 5201 --strictPort",
        url: "http://127.0.0.1:5201",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
