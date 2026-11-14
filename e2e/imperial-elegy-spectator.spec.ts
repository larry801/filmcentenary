import {expect, test, type BrowserContext, type Page} from "@playwright/test";
import {spawn, spawnSync, type ChildProcess} from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Imperial Elegy — online join/spectator browser spec.
 *
 * This spec is standalone: it starts a throw-away boardgame.io server on
 * :4004 (FlatFile storage under /tmp/ie/spectator-db) and a static
 * `vite preview` on :5202, then creates fresh six-player matches over the
 * Lobby HTTP API.
 *
 * The static preview (rather than the dev server) keeps HMR out of the test:
 * concurrent source edits cannot reload pages or reset a match mid-test.
 *
 * Split-origin note: the production join page talks to
 * `${window.location.protocol}//${window.location.host}` (see src/index.tsx),
 * and `yarn serve` normally serves the built frontend from the boardgame.io
 * server so that origin is also the game server.  Here the frontend is served
 * by Vite on :5202 while the game server is on :4004, so the spec bridges the
 * `/games/*` and `/socket.io/*` requests at the Playwright network layer.  That
 * mirrors the reverse proxy a split-origin deployment would need and keeps the
 * production code untouched.
 */

const REPO_ROOT = path.resolve(__dirname, "..");
const SERVER_ENTRY = path.join(REPO_ROOT, "build", "server.js");
const VITE_BIN = path.join(REPO_ROOT, "node_modules", "vite", "bin", "vite.js");
const DB_DIR = "/tmp/ie/spectator-db";
const FRONTEND_DIST = "/tmp/ie/spectator-dist";

const GAME_PORT = 4004;
const VITE_PORT = 5202;
const GAME_ORIGIN = `http://127.0.0.1:${GAME_PORT}`;
const VITE_ORIGIN = `http://127.0.0.1:${VITE_PORT}`;

const SEAT_LABELS = ["德国", "英国", "法国", "奥匈帝国", "俄国", "奥斯曼帝国"] as const;
const SPECTATOR = "观战者";
const PRIVATE_INFO = "私有: 隐藏. 观战者.";

let gameServer: ChildProcess | undefined;
let viteServer: ChildProcess | undefined;
let gameServerLog = "";
let viteServerLog = "";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function collectLog(current: string, chunk: Buffer | string): string {
    return (current + chunk.toString()).slice(-20_000);
}

/** True when *any* HTTP response comes back, including a 404. */
async function responds(url: string): Promise<boolean> {
    try {
        await fetch(url, {signal: AbortSignal.timeout(1500)});
        return true;
    } catch {
        return false;
    }
}

async function waitForHttp(
    url: string,
    label: string,
    child: ChildProcess | undefined,
    log: () => string,
    timeoutMs: number,
): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (child && child.exitCode !== null) {
            throw new Error(`${label} exited before becoming ready (code ${child.exitCode}).\n${log()}`);
        }
        try {
            const response = await fetch(url, {signal: AbortSignal.timeout(2000)});
            if (response.ok) return;
        } catch {
            // Not listening yet.
        }
        await sleep(250);
    }
    throw new Error(`${label} did not become ready at ${url}.\n${log()}`);
}

async function stopProcess(child: ChildProcess | undefined): Promise<void> {
    if (!child || child.exitCode !== null) return;
    const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
    child.kill("SIGTERM");
    const stopped = await Promise.race([exited.then(() => true), sleep(5000).then(() => false)]);
    if (!stopped) {
        child.kill("SIGKILL");
        await Promise.race([exited, sleep(2000)]);
    }
}

test.beforeAll(async () => {
    if (!fs.existsSync(SERVER_ENTRY)) {
        throw new Error(
            `Missing ${SERVER_ENTRY}. Build it before running this spec:\n` +
            "  ./node_modules/.bin/vite build\n" +
            "  ./node_modules/.bin/tsc -p tsconfig.server.json --module node16 --moduleResolution node16",
        );
    }
    if (!fs.existsSync(VITE_BIN)) {
        throw new Error(`Missing Vite CLI at ${VITE_BIN}. Run the package install first.`);
    }
    if (await responds(`${GAME_ORIGIN}/games`)) {
        throw new Error(`Port ${GAME_PORT} is already serving HTTP; refusing to reuse or kill it.`);
    }
    if (await responds(VITE_ORIGIN)) {
        throw new Error(`Port ${VITE_PORT} is already serving HTTP; refusing to reuse or kill it.`);
    }

    // Build a static snapshot of the frontend for this run.  Serving the build
    // (no HMR) keeps concurrent source edits from reloading pages mid-match.
    const build = spawnSync(
        process.execPath,
        [VITE_BIN, "build", "--outDir", FRONTEND_DIST, "--emptyOutDir"],
        {cwd: REPO_ROOT, encoding: "utf8", timeout: 180_000},
    );
    if (build.status !== 0) {
        throw new Error(`vite build failed (status ${build.status}):\n${build.stdout}\n${build.stderr}`);
    }
    if (!fs.existsSync(path.join(FRONTEND_DIST, "index.html"))) {
        throw new Error(`vite build produced no index.html in ${FRONTEND_DIST}`);
    }

    fs.rmSync(DB_DIR, {recursive: true, force: true});
    fs.mkdirSync(DB_DIR, {recursive: true});

    gameServer = spawn(process.execPath, [SERVER_ENTRY], {
        cwd: REPO_ROOT,
        env: {...process.env, PORT: String(GAME_PORT), DB_DIR},
        stdio: ["ignore", "pipe", "pipe"],
    });
    gameServer.stdout?.on("data", (chunk: Buffer) => { gameServerLog = collectLog(gameServerLog, chunk); });
    gameServer.stderr?.on("data", (chunk: Buffer) => { gameServerLog = collectLog(gameServerLog, chunk); });
    await waitForHttp(`${GAME_ORIGIN}/games`, "boardgame.io server", gameServer, () => gameServerLog, 30_000);

    viteServer = spawn(
        process.execPath,
        [VITE_BIN, "preview", "--host", "127.0.0.1", "--port", String(VITE_PORT), "--strictPort", "--outDir", FRONTEND_DIST],
        {
            cwd: REPO_ROOT,
            env: process.env,
            stdio: ["ignore", "pipe", "pipe"],
        },
    );
    viteServer.stdout?.on("data", (chunk: Buffer) => { viteServerLog = collectLog(viteServerLog, chunk); });
    viteServer.stderr?.on("data", (chunk: Buffer) => { viteServerLog = collectLog(viteServerLog, chunk); });
    await waitForHttp(`${VITE_ORIGIN}/`, "Vite preview server", viteServer, () => viteServerLog, 60_000);
});

test.afterAll(async () => {
    await stopProcess(viteServer);
    await stopProcess(gameServer);
    viteServer = undefined;
    gameServer = undefined;
    fs.rmSync(DB_DIR, {recursive: true, force: true});
    fs.rmSync(FRONTEND_DIST, {recursive: true, force: true});
});

/**
 * Forward the frontend's Lobby/Socket.IO calls from Vite :5202 to the game
 * server on :4004.  Socket.IO starts with HTTP long-polling, so routing the
 * HTTP transport is sufficient for the initial state sync the tests need.
 */
async function bridgeGameServer(context: BrowserContext): Promise<void> {
    const gamePath = new RegExp(`^${VITE_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(?:games|socket\\.io)(?:/|\\?|$)`);
    await context.route(gamePath, async (route) => {
        const target = new URL(route.request().url());
        target.protocol = "http:";
        target.hostname = "127.0.0.1";
        target.port = String(GAME_PORT);

        // Metadata GETs are safe to retry. A transient proxy abort on the
        // first read otherwise leaves JoinPage's error state sticky even
        // though the join itself succeeded. POST joins are not retried: a
        // retry could double-join or race the credential response.
        const attempts = route.request().method() === "GET" ? 3 : 1;
        let lastError: unknown;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            try {
                const response = await route.fetch({url: target.toString()});
                await route.fulfill({response});
                return;
            } catch (error) {
                lastError = error;
                const message = String(error);
                // Long-poll requests still in flight when a page closes cannot
                // be proxied; that is teardown noise, not a test failure.
                if (/Test ended|Target page, context or browser has been closed|browser has been closed/i.test(message)) {
                    await route.abort().catch(() => undefined);
                    return;
                }
                if (attempt + 1 < attempts) await sleep(150);
            }
        }

        console.warn(`[spectator spec] bridge failed for ${route.request().url()}: ${String(lastError)}`);
        await route.abort().catch(() => undefined);
    });
}

test.beforeEach(async ({context}) => {
    await bridgeGameServer(context);
});

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function createMatch(): Promise<string> {
    const response = await fetch(`${GAME_ORIGIN}/games/imperialElegy/create`, {
        method: "POST",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify({numPlayers: 6}),
    });
    if (!response.ok) {
        throw new Error(`create match failed: HTTP ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as {matchID?: unknown};
    if (typeof data.matchID !== "string") {
        throw new Error(`create match response has no matchID: ${JSON.stringify(data)}`);
    }
    return data.matchID;
}

interface MatchMetadata {
    players: Array<{id: number; name?: string; isConnected?: boolean}>;
}

async function readMatch(matchID: string): Promise<MatchMetadata> {
    const response = await fetch(`${GAME_ORIGIN}/games/imperialElegy/${encodeURIComponent(matchID)}`);
    if (!response.ok) {
        throw new Error(`read match failed: HTTP ${response.status} ${await response.text()}`);
    }
    return (await response.json()) as MatchMetadata;
}

async function handTitles(page: Page): Promise<string[]> {
    // Card faces are SVG (<text class="ie-card-title">), and SVG elements have
    // no innerText, so read textContent instead.
    const titles = await page.locator(".ie-hand .ie-card .ie-card-title").allTextContents();
    return titles.map((title) => title.trim()).filter(Boolean);
}

async function openSeat(page: Page, matchID: string, seat: number): Promise<void> {
    const label = SEAT_LABELS[seat];
    const heading = page.getByRole("heading", {name: new RegExp(`^手牌 · ${label}$`)});
    const documentResponse = await page.goto(`/join/imperialElegy/${matchID}/${seat}`, {
        waitUntil: "domcontentloaded",
    });
    expect(documentResponse, `join document for seat ${seat}`).not.toBeNull();
    expect(documentResponse!.ok(), `join document for seat ${seat}`).toBe(true);

    await expect(page).toHaveURL(new RegExp(`/join/imperialElegy/${escapeRegExp(matchID)}/${seat}/[^/]+$`));
    try {
        await expect(heading).toBeVisible({timeout: 10_000});
    } catch {
        // A transient bridge failure can leave JoinPage showing its error even
        // though the join credential was saved. One reload resumes the saved
        // seat; a real join failure simply fails again below.
        await page.reload({waitUntil: "domcontentloaded"});
        await expect(heading).toBeVisible({timeout: 30_000});
    }
    await expect(page.locator(".ie-hand .ie-card").first()).toBeVisible();
}

test.describe("Imperial Elegy online seats and spectators", () => {
    test("A: seat 0 join page loads with its hand and seat label", async ({page}) => {
        const matchID = await createMatch();
        await openSeat(page, matchID, 0);

        const titles = await handTitles(page);
        expect(titles.length, "seat 0 should have private hand cards").toBeGreaterThan(0);
        await expect(page.locator(".ie-status .ie-badge").filter({hasText: SEAT_LABELS[0]}).first()).toBeVisible();
        await expect(page.locator(".ie-hand")).toBeVisible();
        await expect(page.locator(".ie-hand .ie-card")).toHaveCount(titles.length);
    });

    test("B: spectator page shows spectator mode and no hand cards", async ({context}) => {
        // Some card titles coincide with public map/characteristic strings. A
        // fresh match is cheap, so retry until the dealt hand has at least one
        // title that cannot be explained by the public baseline view.
        let seatPage: Page | undefined;
        let spectator: Page | undefined;
        let visibleCandidates: string[] = [];
        let domCandidates: string[] = [];
        let dealtTitles: string[] = [];

        for (let attempt = 0; attempt < 3; attempt += 1) {
            const matchID = await createMatch();
            const candidateSpectator = await context.newPage();
            const candidateSeat = await context.newPage();

            // Capture the public spectator view first: map labels and the
            // collapsed national-characteristics text are legitimately public.
            await candidateSpectator.goto(`/join/imperialElegy/${matchID}/spectate`, {
                waitUntil: "domcontentloaded",
            });
            await expect(
                candidateSpectator.locator(".ie-status .ie-badge").filter({hasText: SPECTATOR}),
            ).toBeVisible({timeout: 30_000});
            const baselineText = await candidateSpectator.locator("body").innerText();
            const baselineHtml = await candidateSpectator.content();

            // Seat 0 joins in the same browser context, so a real private hand
            // exists while the spectator is looking at the match.
            await openSeat(candidateSeat, matchID, 0);
            const titles = await handTitles(candidateSeat);
            const visible = titles.filter((title) => !baselineText.includes(title));
            const dom = titles.filter((title) => !baselineHtml.includes(title));

            if (titles.length > 0 && visible.length > 0 && dom.length > 0) {
                seatPage = candidateSeat;
                spectator = candidateSpectator;
                visibleCandidates = visible;
                domCandidates = dom;
                dealtTitles = titles;
                break;
            }

            await candidateSeat.close();
            await candidateSpectator.close();
        }

        expect(
            seatPage,
            `could not create a match with a distinctive private hand title (last hand: ${dealtTitles.join(", ")})`,
        ).toBeDefined();
        expect(visibleCandidates.length).toBeGreaterThan(0);
        expect(domCandidates.length).toBeGreaterThan(0);

        await expect(spectator!.getByText(SPECTATOR, {exact: true}).first()).toBeVisible();
        await expect(spectator!.getByText(PRIVATE_INFO).first()).toBeVisible();
        await expect(spectator!.locator(".ie-hand")).toHaveCount(0);
        await expect(spectator!.locator(".ie-card")).toHaveCount(0);

        const visible = await spectator!.locator("body").innerText();
        const html = await spectator!.content();
        for (const title of visibleCandidates) {
            expect(visible, `visible spectator body leaked hand card "${title}"`).not.toContain(title);
        }
        for (const title of domCandidates) {
            expect(html, `spectator DOM leaked hand card "${title}"`).not.toContain(title);
        }

        // Named in the request as a known private title.  In this game
        // "Metternich's Legacy" is actually a public national characteristic
        // rendered inside a collapsed <details>, so this asserts its rendered
        // text is hidden from the spectator (it is present in raw HTML).
        expect(visible).not.toContain("梅特涅的遗产");
        expect(visible).not.toContain("Metternich's Legacy");

        // Keep the seat page alive until the end of the test so the hand is
        // genuinely in play while the spectator assertions above run.
        expect(await handTitles(seatPage!)).toEqual(dealtTitles);
    });

    test("C: seat 1 joins without displacing seat 0", async ({page, context}) => {
        const matchID = await createMatch();
        await openSeat(page, matchID, 0);
        const seat0TitlesBefore = await handTitles(page);

        const seat1 = await context.newPage();
        await openSeat(seat1, matchID, 1);

        // Seat 0 kept its own URL, label and private hand.
        await expect(page).toHaveURL(new RegExp(`/join/imperialElegy/${escapeRegExp(matchID)}/0/[^/]+$`));
        await expect(page.getByRole("heading", {name: new RegExp(`^手牌 · ${SEAT_LABELS[0]}$`)})).toBeVisible();
        expect(await handTitles(page)).toEqual(seat0TitlesBefore);

        // The server recorded both seats without replacing seat 0.
        await expect.poll(async () => (await readMatch(matchID)).players[0]?.name).toBe("P1");
        await expect.poll(async () => (await readMatch(matchID)).players[1]?.name).toBe("P2");
    });
});
