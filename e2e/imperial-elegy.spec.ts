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

/**
 * 9.1/11.0: negotiation comes first, so the home-card choice is a dialog the
 * seat opens itself.  `ie-open-home-card` is the dock button for the seat whose
 * diplomacy turn it is; the Deals page offers the same step.
 */
async function openHomeChoice(board: Locator): Promise<boolean> {
    const dock = board.locator('[data-testid="ie-open-home-card"]');
    if (await dock.count() > 0) {
        await dock.first().click();
        return true;
    }
    const deals = board.locator('[data-testid="ie-open-home-card-from-deals"]');
    if (await deals.count() === 0) return false;
    await deals.click();
    return true;
}

/**
 * 9.1: negotiation comes before the home-card step, and the whole table must
 * finish it.  Every seat carries the button (it is not turn-gated), so sweep
 * the strip once and wait for the engine to agree that no seat is left.
 */
async function finishNegotiating(page: Page) {
    for (const seat of SEATS) {
        await focusSeat(page, seat);
        const board = page.locator(`[data-testid="ie-seat-${seat}"]`);
        const finish = board.locator('[data-testid="ie-finish-negotiation"]');
        for (let attempt = 0; attempt < 3 && await finish.count() > 0; attempt += 1) {
            await finish.first().click().catch(() => undefined);
            // Wait for the local master to apply the move before re-clicking;
            // a fixed pause either raced the sync or sent a second, refused
            // finishNegotiation.
            await expect(finish).toHaveCount(0, {timeout: 3_000}).catch(() => undefined);
        }
        await expect(finish).toHaveCount(0, {timeout: 5_000});
    }
    await expect.poll(async () => await page.evaluate(() => {
        const G = (window as any).__IE_STATE__;
        return ["GE", "UK", "FR", "AU", "RU", "OT"].every((power) =>
            G.powers[power].eliminated === true || G.powers[power].flags.negotiationDone === true);
    }), {timeout: 15_000}).toBe(true);
}

async function chooseHomeCards(page: Page) {
    await finishNegotiating(page);
    // 9.1's diplomacy step advances one seat at a time, so only the seat whose
    // turn it is offers the choice; walk the strip and answer the one that does.
    for (let round = 0; round < SEATS.length; round += 1) {
        let answered = false;
        for (const seat of SEATS) {
            await focusSeat(page, seat);
            const board = page.locator(`[data-testid="ie-seat-${seat}"]`);
            if (!(await openHomeChoice(board))) continue;
            const choose = board.locator('[data-testid^="ie-choose-home-"]').first();
            if (await choose.count() === 0) {
                const close = board.locator('[data-testid="ie-choice-close"]');
                if (await close.count() > 0) await close.first().click();
                continue;
            }
            await choose.click();
            await expect(choose).toHaveCount(0);
            answered = true;
            break;
        }
        if (!answered) break;
        if (await page.evaluate(() => (window as any).__IE_STATE__.phase) !== "diplomacy") break;
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

    test("a neutral minor needs a declaration before a land battle (12.16)", async ({page}) => {
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

        // Saxony holds a neutral minor army next to Berlin.  Rules 12.16 and
        // 13.4 make a declaration the precondition for attacking it, so the
        // order is refused and no battle or pending window opens.  (This is the
        // reported defect: the battle went ahead against an undeclared minor.)
        const land = board.locator('[data-testid="ie-action-landBattle"]');
        await expect(land).toHaveAttribute("data-enabled", "false");
        await expect(land).toContainText("宣战");
        await expect(board.locator('[data-testid="ie-mode-pill"]')).toHaveCount(0);
        await expect(board.locator('[data-testid="ie-pending"]')).toHaveCount(0);
        const battle = await page.evaluate(() => (window as any).__IE_STATE__.battle ?? null);
        expect(battle).toBeNull();
    });

    test("the required card choices render the printed face, not just a title", async ({page}) => {
        await openLocal(page);
        await finishPrep(page);
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("diplomacy");
        await focusSeat(page, "GE");
        const board = page.locator('[data-testid="ie-seat-GE"]');
        // 9.1: negotiating comes first, so the choice is not raised by itself.
        await expect(board.locator('[data-testid="ie-choice-modal"]')).toHaveCount(0);
        await expect(board.locator('[data-testid="ie-deals"]')).toBeVisible();
        // 9.1: the home-card entry is not offered while the table is talking.
        await expect(board.locator('[data-testid="ie-open-home-card"]')).toHaveCount(0);
        await expect(board.locator('[data-testid="ie-finish-negotiation"]')).toBeVisible();
        await finishNegotiating(page);
        await focusSeat(page, "GE");
        await openHomeChoice(board);
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

    test("11.0 the show button asks whom and lists the private recipient", async ({page}) => {
        await openLocal(page);
        await finishPrep(page);
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("diplomacy");
        await focusSeat(page, "GE");
        const board = page.locator('[data-testid="ie-seat-GE"]');
        const show = board.locator('[data-testid^="ie-show-card-"]').first();
        await expect(show).toBeVisible();
        await expect(show).toContainText("向他人展示");
        await show.click();
        const picker = board.locator('[data-testid="ie-show-target-picker"]');
        await expect(picker).toBeVisible();
        // The table and every surviving power are one click away.
        await expect(board.locator('[data-testid="ie-show-target-table"]')).toBeVisible();
        await expect(board.locator('[data-testid="ie-show-target-FR"]')).toBeVisible();
        await board.locator('[data-testid="ie-show-target-FR"]').click();
        await expect(picker).toHaveCount(0);
        await expect(board.locator('[data-testid="ie-shown-cards"]')).toBeVisible();
        await expect(board.locator('[data-testid="ie-shown-cards"]')).toContainText("法国");
    });

    test("11.1 the deal form is a direction switch with a count dropdown", async ({page}) => {
        await openLocal(page);
        await finishPrep(page);
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("diplomacy");
        await focusSeat(page, "GE");
        const board = page.locator('[data-testid="ie-seat-GE"]');
        await board.locator('[data-testid="ie-orders-tab-deals"]').click();
        await expect(board.locator('[data-testid="ie-deals-direction"]')).toBeVisible();
        const give = board.locator('[data-testid="ie-deals-direction-give"]');
        const take = board.locator('[data-testid="ie-deals-direction-take"]');
        const count = board.locator('[data-testid="ie-deals-count"]');
        await expect(give).toHaveAttribute("aria-pressed", "true");
        await expect(take).toHaveAttribute("aria-pressed", "false");
        await expect(count).toHaveJSProperty("tagName", "SELECT");
        // The terms name one direction only; switching flips who gives.
        await expect(board.locator('[data-testid="ie-deals-terms"]')).toContainText("德国向英国随机转交");
        await take.click();
        await expect(take).toHaveAttribute("aria-pressed", "true");
        await expect(board.locator('[data-testid="ie-deals-terms"]')).toContainText("英国向德国随机转交");
        await expect(board.locator('[data-testid="ie-deals-terms"]')).not.toContainText("德国向英国随机转交");
        // The dropdown carries real counts (at least "1").
        await expect(count.locator("option")).not.toHaveCount(0);
    });

    test("the home-card dialog closes without answering and reopens later", async ({page}) => {
        await openLocal(page);
        await finishPrep(page);
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("diplomacy");
        await focusSeat(page, "GE");
        const board = page.locator('[data-testid="ie-seat-GE"]');
        await finishNegotiating(page);
        await focusSeat(page, "GE");
        await openHomeChoice(board);
        const dialog = board.locator('[data-testid="ie-choice-modal"]');
        await expect(dialog).toBeVisible();
        // The dialog is the player's own view of the choice, so it closes.
        await dialog.locator('[data-testid="ie-choice-close"]').click();
        await expect(dialog).toHaveCount(0);
        // Closing does not answer: the choice is still owed, and the step says
        // so.  The negotiation table is reachable again.
        await expect(board.locator('[data-testid="ie-dock-summary"]')).toContainText("尚未选择本土牌");
        await expect(board.locator('[data-testid="ie-deals"]')).toBeVisible();
        await finishNegotiating(page);
        await focusSeat(page, "GE");
        await openHomeChoice(board);
        await expect(dialog).toBeVisible();
    });

    test("the home-card dialog does not cover the hotseat seat strip", async ({page}) => {
        // A hotseat answers each player's choice by handing the device over, so
        // the seat strip must stay clickable while a choice is owed.  The dialog
        // is anchored to the board, not the viewport: a `position: fixed`
        // backdrop covered the strip and made every seat switch impossible.
        await openLocal(page);
        await finishPrep(page);
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("diplomacy");
        await finishNegotiating(page);

        // Walk to a seat that actually owes a home card, and open its dialog.
        let owing: string | null = null;
        for (const seat of SEATS) {
            await focusSeat(page, seat);
            const board = page.locator(`[data-testid="ie-seat-${seat}"]`);
            if (!(await openHomeChoice(board))) continue;
            const modal = board.locator('[data-testid="ie-choice-modal"]');
            if (await modal.count() > 0 && await modal.isVisible()) {
                owing = seat;
                break;
            }
        }
        expect(owing, "some seat owes a home-card choice in the diplomacy step").not.toBeNull();

        // The dialog is not a viewport overlay: while the seat is in front, its
        // box stays below the strip (measure before switching, because an
        // inactive seat is `display: none` and has no box to measure).
        const modalBox = (await page.locator(`[data-testid="ie-seat-${owing}"] [data-testid="ie-choice-modal"]`).boundingBox())!;
        const stripBox = (await page.locator('[data-testid="ie-seat-strip"]').boundingBox())!;
        expect(modalBox.y).toBeGreaterThanOrEqual(stripBox.y + stripBox.height - 1);

        // The strip is outside every board, so a switch must land even though a
        // modal is open (a fixed-position backdrop timed out here).
        const elsewhere = SEATS.find((seat) => seat !== owing)!;
        await focusSeat(page, elsewhere);
        await expect(page.locator(`[data-testid="ie-seat-${elsewhere}"]`)).toHaveAttribute("data-active", "true");
        await expect(page.locator(`[data-testid="ie-seat-${owing}"]`)).toHaveAttribute("data-active", "false");

        // Coming back shows the dialog again: switching seats never answers or
        // discards another player's choice.
        await focusSeat(page, owing!);
        await expect(page.locator(`[data-testid="ie-seat-${owing}"] [data-testid="ie-choice-modal"]`)).toBeVisible();
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
        // The inspector prints one language only: no translation disclosure
        // beside the face, and the printed English original is an explicit
        // button press rather than a second copy under the face.
        await expect(inspector.locator(".ie-card-translation")).toHaveCount(0);
        await page.locator(".MuiSwitch-input").click();
        await expect(page.getByRole("heading", {name: "Imperial Elegy — local hotseat"})).toBeVisible();
        await expect(face).toHaveAttribute("data-card-id", original!);
        await expect(face).toHaveAttribute("lang", "en");
        await expect(face.locator(".ie-card-rules")).toContainText(/[A-Za-z]/);
        await expect(inspector.locator(".ie-card-translation")).toHaveCount(0);
        // Switching language never pulls the English scan in on its own.
        await expect(inspector.locator('[data-testid="ie-card-inspector-image"]')).toHaveCount(0);
        expect(cardImageRequests).toEqual([]);
    });

    test("an online match-creation page is reachable", async ({page}) => {
        await page.goto("/imperialElegy");
        await expect(page.getByText("Imperial Elegy 帝国挽歌").first()).toBeVisible();
    });
});
