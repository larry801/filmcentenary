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
    // Every spec drives its own page against the shared dev server; nothing
    // mutates server state, so the files can run concurrently.  One worker on
    // CI made 273 s of test time take 3.2 min serially.
    //
    // Three is the ceiling, not four: a `ubuntu-24.04` runner reports four
    // vCPUs but is two physical cores.  With 4 workers every test ran 30-40 %
    // slower (diplomacy 27 s → 41 s, 6-player campaign 37 s → 53 s) and the
    // suite took 3.0 min against 2.8 min with 3, so the fourth browser only
    // competed for the same cores.  `E2E_WORKERS` overrides this for a bigger
    // machine.
    workers: Number(process.env.E2E_WORKERS) || (process.env.CI ? 3 : undefined),
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
