import {defineConfig, devices} from "@playwright/test";

/**
 * Browser suite against the Vite dev server.
 *
 * The three Imperial Elegy specs are excluded on purpose: they need a
 * production build on a fixed port, and they own that port (see
 * `playwright.ie-*.config.ts` and `yarn test:e2e:ie`).  Letting the default
 * glob pick them up ran them against :5173 instead of their own origin, which
 * is why every one of them failed.
 */
export default defineConfig({
    testDir: "./e2e",
    testIgnore: [
        "**/imperial-elegy.spec.ts",
        "**/imperial-elegy-controls.spec.ts",
        "**/imperial-elegy-spectator.spec.ts",
    ],
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? [["list"], ["html", {open: "never"}]] : "list",
    timeout: 60_000,
    expect: {timeout: 10_000},
    use: {
        baseURL: "http://127.0.0.1:5173",
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
        command: "yarn start -- --host 127.0.0.1 --port 5173",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
