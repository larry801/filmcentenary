import {defineConfig, devices} from "@playwright/test";

/**
 * The phone layout spec, against a production build.
 *
 * `vite preview` serves `build/` on :5204, so the spec needs no hand-started
 * server.  The viewport is set per describe block inside the spec (the phone
 * layout is the whole point), and `Desktop Chrome` only supplies the browser
 * flags: no touch emulation is applied, because the layout under test responds
 * to width, and `pointer: coarse` styles are exercised separately.
 */
export default defineConfig({
    testDir: "./e2e",
    testMatch: ["**/imperial-elegy-mobile.spec.ts"],
    fullyParallel: false,
    workers: 1,
    timeout: 60_000,
    expect: {timeout: 10_000},
    reporter: "list",
    outputDir: "test-results/ie-mobile",
    use: {
        baseURL: "http://127.0.0.1:5204",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        {
            name: "phone",
            use: {...devices["Desktop Chrome"], viewport: {width: 390, height: 844}},
        },
    ],
    webServer: {
        command: "yarn vite preview --host 127.0.0.1 --port 5204 --strictPort",
        url: "http://127.0.0.1:5204",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
