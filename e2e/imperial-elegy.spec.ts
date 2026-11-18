import {expect, test, Locator, Page} from "@playwright/test";


const SEATS = ["GE", "UK", "FR", "AU", "RU", "OT"] as const;

async function openLocal(page: Page) {
    await page.goto("/localIE");
    await expect(page.getByRole("heading", {name: "帝国挽歌 — 本地热座"})).toBeVisible();
    await expect(page.locator('[data-testid="ie-seat-GE"]')).toBeVisible();
}

async function focusSeat(page: Page, seat: string) {
    const index = SEATS.indexOf(seat as typeof SEATS[number]);
    await page.getByRole("tab", {name: new RegExp(`P${index + 1}`)}).click();
    // The seat is "shown" once its panel reports `data-active`; waiting for that
    // replaces a fixed 180 ms sleep, which the setup helpers repeat ~20 times
    // per test.
    await expect(page.locator(`[data-testid="ie-seat-${seat}"]`)).toHaveAttribute("data-active", "true");
}

/** Open a hand card's inspector (one tap on the row). */
async function openCard(card: Locator): Promise<Locator> {
    await card.locator(".ie-card-open").click();
    return card;
}

/**
 * Play the first legal card for CP.  The hand lists one row per card; a tap on
 * a row opens the inspector, where the operations live.
 *
 * Card play is arm-then-confirm (`ConfirmButton`, preference on by default):
 * the first click arms the button and the second one plays.  The button is
 * addressed by test id because the armed label replaces its text, so a text
 * filter would stop matching between the two clicks.
 *
 * A plain event card is preferred: every card is a CP card (12.0), but a
 * mandatory event played for CP also resolves its printed text, which can open
 * a decision or move the map under the caller's next click.
 *
 * The tray renders no cards while a decision is owed, so the cards are awaited
 * before concluding the hand is empty.
 */
async function playCardForCp(page: Page, board: Locator): Promise<boolean> {
    const cards = board.locator(".ie-hand .ie-card");
    await expect.poll(async () => await cards.count(), {timeout: 30_000}).toBeGreaterThan(0);
    const order: number[] = [];
    const events: number[] = [];
    for (let i = 0; i < await cards.count(); i += 1) {
        const type = await cards.nth(i).getAttribute("data-card-type");
        (type === "event" ? events : order).push(i);
    }
    for (const i of [...events, ...order]) {
        const card = await openCard(cards.nth(i));
        const inspector = board.locator('[data-testid="ie-card-inspector"]');
        const button = inspector.locator('[data-testid^="ie-play-cp-"]').first();
        const usable = await button.count() > 0 && await button.isEnabled();
        if (usable) {
            await button.click();
            await expect(button).toHaveAttribute("data-armed", "true");
            await button.click();
            // The card leaves the hand and the inspector closes itself; its
            // backdrop must be gone before the next map click.
            if (await inspector.count() > 0) await page.keyboard.press("Escape");
            await expect(inspector).toHaveCount(0);
            return true;
        }
        await page.keyboard.press("Escape");
        await expect(inspector).toHaveCount(0);
    }
    return false;
}

/**
 * Click a map space and wait for its detail panel to name it.
 *
 * The map sits under the hand tray, and playing a card folds/refolds that row,
 * which moves the SVG between the click and its dispatch.  `force: true` skips
 * Playwright's stability wait, so a single click can land on a space that has
 * already moved.  Retrying until the panel names the space removes the race and
 * still throws when the click never lands.
 */
async function clickSpace(board: Locator, spaceId: string, label: string) {
    const space = board.locator(`[data-testid="ie-space-${spaceId}"]`);
    const detail = board.locator('[data-testid="ie-space-detail"]');
    for (let attempt = 0; attempt < 3; attempt += 1) {
        await space.click({force: true});
        try {
            await expect(detail).toContainText(label, {timeout: 3_000});
            return;
        } catch {
            if (attempt === 2) throw new Error(`map click on ${spaceId} never selected it`);
        }
    }
}

async function finishPrep(page: Page) {
    for (const seat of SEATS) {
        await focusSeat(page, seat);
        const board = page.locator(`[data-testid="ie-seat-${seat}"]`);
        const ready = board.getByRole("button", {name: "准备完毕"}).first();
        if (!(await ready.count())) continue;
        await ready.click();
        // The button disappears once the seat is done; that is the real signal,
        // not a fixed 250 ms pause.
        await expect(ready).toHaveCount(0);
    }
}

async function chooseHomeCards(page: Page) {
    for (const seat of SEATS) {
        await focusSeat(page, seat);
        const board = page.locator(`[data-testid="ie-seat-${seat}"]`);
        const choose = board.locator('[data-testid^="ie-choose-home-"]').first();
        if (!(await choose.count())) continue;
        await choose.click();
        await expect(choose).toHaveCount(0);
    }
    await answerStartPending(page);
}

async function answerStartPending(page: Page) {
    // 33.4 Metternich's Legacy opens an AU decision at the end of turn-1
    // diplomacy; answer it (and the second pick) before playing.
    for (let round = 0; round < 6; round += 1) {
        let answered = false;
        for (const seat of SEATS) {
            await focusSeat(page, seat);
            const pending = page.locator(`[data-testid="ie-seat-${seat}"] [data-testid="ie-pending"]`);
            const options = pending.locator("button");
            if (!(await options.count())) continue;
            const before = await page.evaluate(() => (window as any).__IE_STATE__?.pending?.id ?? null);
            await options.first().click();
            // A follow-up decision (the second pick) replaces the pending
            // instead of clearing it, so wait for a different one rather than
            // sleeping a fixed 200 ms.
            await expect.poll(
                async () => await page.evaluate(() => (window as any).__IE_STATE__?.pending?.id ?? null),
                {timeout: 10_000},
            ).not.toBe(before);
            answered = true;
            break;
        }
        if (!answered) break;
    }
}

test.describe("Imperial Elegy local hotseat", () => {
    test("six seats switch without remounting and reach the action phase", async ({page}) => {
        await openLocal(page);
        await finishPrep(page);
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("diplomacy");
        await chooseHomeCards(page);
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("action");
    });

    test("map selection, card play and the public log", async ({page}) => {
        await openLocal(page);
        await finishPrep(page);
        await chooseHomeCards(page);
        await focusSeat(page, "GE");
        const board = page.locator('[data-testid="ie-seat-GE"]');
        expect(await playCardForCp(page, board)).toBe(true);
        await page.waitForTimeout(600);
        await clickSpace(board, "berlin", "柏林");
        await expect.poll(async () => await board.locator('[data-testid="ie-log"]').innerText()).toContain("打出");
    });

    test("a land battle opens a pending support decision", async ({page}) => {
        await openLocal(page);
        await finishPrep(page);
        await chooseHomeCards(page);
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("action");
        await focusSeat(page, "GE");
        await page.waitForTimeout(500);
        const board = page.locator('[data-testid="ie-seat-GE"]');
        expect(await playCardForCp(page, board)).toBe(true);
        await page.waitForTimeout(800);
        await clickSpace(board, "berlin", "柏林");
        await page.waitForTimeout(300);
        await board.getByRole("button", {name: "在此发动陆战"}).first().click();
        await page.waitForTimeout(250);
        await board.locator('[data-testid="ie-space-saxony"]').click({force: true});
        await expect.poll(async () => await board.locator('[data-testid="ie-pending"]').count()).toBeGreaterThan(0);
        await expect(board.locator('[data-testid="ie-pending"]')).toBeVisible();
        await expect(board.locator('[data-testid="ie-pending"]')).toContainText("支援");
        // Resolve each seat's support/card window deliberately. Choosing the
        // first random card could play A059, end the battle before dice and
        // immediately launch a decisive follow-up instead of producing a roll.
        for (let i = 0; i < 12; i += 1) {
            const state = await page.evaluate(() => {
                const G = (window as any).__IE_STATE__;
                return {
                    rolled: G.log.some((entry: any) => entry.key === "battleRoll" && entry.args?.to === "saxony"),
                    pending: G.pending && {id: G.pending.id, kind: G.pending.kind, power: G.pending.power},
                };
            });
            if (state.rolled) break;
            expect(state.pending).not.toBeNull();
            expect(["combatSupport", "combatCard"]).toContain(state.pending!.kind);
            await focusSeat(page, state.pending!.power);
            const decidingBoard = page.locator(`[data-testid="ie-seat-${state.pending!.power}"]`);
            await decidingBoard.getByTestId("ie-pending-option-done").click();
            await expect.poll(async () => page.evaluate(() => (window as any).__IE_STATE__.pending?.id ?? null))
                .not.toBe(state.pending!.id);
        }
        // The battle log line is outcome-independent (`在萨克森（自 柏林）交战：…`),
        // unlike `battleEnded`, which says either 赢得战斗 or 战败 depending on the dice.
        // Read the state log rather than the panel: the panel only renders the
        // last 80 entries, and a decisive victory appends follow-up lines that
        // can push the `battle` entry out of that window.
        await expect.poll(async () => await page.evaluate(() => {
            const G = (window as any).__IE_STATE__;
            return G.log.some((entry: any) => entry.key === "battleRoll" && entry.args?.to === "saxony");
        })).toBe(true);
        await focusSeat(page, "GE");
        await expect.poll(async () => await board.locator('[data-testid="ie-log"]').innerText()).toContain("萨克森");
    });

    test("the required card choices render the printed face, not just a title", async ({page}) => {
        await openLocal(page);
        await finishPrep(page);
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("diplomacy");
        await focusSeat(page, "GE");
        const board = page.locator('[data-testid="ie-seat-GE"]');
        const choice = board.locator('[data-testid="ie-home-card-choice"]');
        await expect(choice).toBeVisible({timeout: 15_000});
        // Each home card candidate is drawn as its SVG face with its own button.
        const card = choice.locator(".ie-choice-card").first();
        await expect(card.locator("svg.ie-card-face")).toBeVisible();
        await expect(card.locator(".ie-card-rules")).toContainText(/[\u4e00-\u9fff]/);
        const homeId = await card.locator("svg.ie-card-face").getAttribute("data-card-id");
        await expect(card.locator(`[data-testid="ie-choose-home-${homeId}"]`)).toBeVisible();
        await expect(choice.locator(".ie-card img, .ie-card image")).toHaveCount(0);
    });

    test("SVG cards switch language and expose the other translation without image requests", async ({page}) => {
        const cardImageRequests: string[] = [];
        page.on("request", (request) => {
            if (/\/imperial-elegy\/cards\/.*\.(png|jpe?g)(?:\?|$)/i.test(request.url())) cardImageRequests.push(request.url());
        });
        await openLocal(page);
        const board = page.locator('[data-testid="ie-seat-GE"]');
        await openCard(board.locator(".ie-hand .ie-card").first());
        const inspector = board.locator('[data-testid="ie-card-inspector"]');
        await expect(inspector).toBeVisible();
        const face = inspector.locator("svg.ie-card-face");
        const original = await face.getAttribute("data-card-id");
        await expect(face).toHaveAttribute("lang", "zh-CN");
        await expect(face.locator(".ie-card-rules")).toContainText(/[\u4e00-\u9fff]/);
        await expect(board.locator(".ie-card img, .ie-card image")).toHaveCount(0);
        // The inspector is the one place a card's face and text live; its
        // translation disclosure prints the other language.
        await inspector.locator(".ie-card-translation > summary").click();
        await expect(inspector.locator(".ie-card-translation > div")).toBeVisible();
        await expect(inspector.locator(".ie-card-translation > div")).toHaveAttribute("lang", "en");
        await page.locator(".MuiSwitch-input").click();
        await expect(page.getByRole("heading", {name: "Imperial Elegy — local hotseat"})).toBeVisible();
        await expect(face).toHaveAttribute("data-card-id", original!);
        await expect(face).toHaveAttribute("lang", "en");
        await expect(face.locator(".ie-card-rules")).toContainText(/[A-Za-z]/);
        await expect(inspector.locator(".ie-card-translation > div")).toHaveAttribute("lang", "zh-CN");
        expect(cardImageRequests).toEqual([]);
    });

    test("an online match-creation page is reachable", async ({page}) => {
        await page.goto("/imperialElegy");
        await expect(page.getByText("Imperial Elegy 帝国挽歌").first()).toBeVisible();
    });
});
