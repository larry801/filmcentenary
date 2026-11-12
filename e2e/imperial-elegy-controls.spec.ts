import {expect, test, Page, Locator} from "@playwright/test";

const SEATS = ["GE", "UK", "FR", "AU", "RU", "OT"] as const;

async function openLocal(page: Page) {
    await page.goto("/localIE");
    await expect(page.getByRole("heading", {name: "帝国挽歌 — 本地热座"})).toBeVisible();
    await expect(page.locator('[data-testid="ie-seat-GE"]')).toBeVisible();
}

async function focusSeat(page: Page, seat: string) {
    const index = SEATS.indexOf(seat as typeof SEATS[number]);
    await page.getByRole("tab", {name: new RegExp(`P${index + 1}`)}).click();
    await page.waitForTimeout(180);
}

/**
 * Click a phase button and wait until the seat's client has caught up and
 * removed it. The local hotseat clients sync asynchronously, so a fixed short
 * wait can race the master and silently drop the action.
 */
async function clickUntilGone(page: Page, button: Locator, attempts = 4) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (await button.count() === 0) return;
        await button.click({timeout: 5_000}).catch(() => undefined);
        try {
            await expect(button).toHaveCount(0, {timeout: 3_000});
            return;
        } catch {
            await page.waitForTimeout(300);
        }
    }
    await expect(button).toHaveCount(0);
}

async function finishPrep(page: Page) {
    for (const seat of SEATS) {
        await focusSeat(page, seat);
        const board = page.locator(`[data-testid="ie-seat-${seat}"]`);
        const ready = board.getByRole("button", {name: "准备完毕"}).first();
        await expect(ready).toBeVisible({timeout: 15_000});
        await clickUntilGone(page, ready);
    }
}

async function chooseHomeCards(page: Page) {
    for (const seat of SEATS) {
        await focusSeat(page, seat);
        const board = page.locator(`[data-testid="ie-seat-${seat}"]`);
        const choose = board.getByRole("button", {name: "选择本土牌"}).first();
        await expect(choose).toBeVisible({timeout: 15_000});
        await clickUntilGone(page, choose);
    }
    await answerStartPending(page);
}

/** Reach the action phase in the same way as the existing hotseat spec. */
async function reachAction(page: Page) {
    await openLocal(page);
    await finishPrep(page);
    await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("diplomacy");
    await chooseHomeCards(page);
    await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("action");
    await focusSeat(page, "GE");
    await expect(boardFor(page, "GE").getByRole("button", {name: "结束行动轮"})).toBeVisible({timeout: 15_000});
}

function boardFor(page: Page, seat: string): Locator {
    return page.locator(`[data-testid="ie-seat-${seat}"]`);
}

/** Play the first legal card for CP so GE has an impulse and a CP budget. */
async function playCpCard(board: Locator) {
    const page = board.page();
    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining) > 0) return;
        const cpButtons = board.locator(".ie-card-actions button", {hasText: "作为 CP 打出"});
        await expect(cpButtons.first()).toBeVisible();
        let played = false;
        for (let i = 0; i < await cpButtons.count(); i += 1) {
            if (await cpButtons.nth(i).isEnabled()) {
                await cpButtons.nth(i).click();
                played = true;
                break;
            }
        }
        expect(played).toBe(true);
        try {
            await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining), {timeout: 5_000}).toBeGreaterThan(0);
            return;
        } catch {
            await page.waitForTimeout(300);
        }
    }
    expect(await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining)).toBeGreaterThan(0);
}

/** Find a hand card whose Save control is enabled (non-home, non-mandatory). */
async function findSavableCard(board: Locator): Promise<Locator | null> {
    const cards = board.locator(".ie-hand .ie-card");
    for (let i = 0; i < await cards.count(); i += 1) {
        const card = cards.nth(i);
        const save = card.getByRole("button", {name: "保留", exact: true});
        if (await save.count() && await save.isEnabled()) return card;
    }
    return null;
}

async function answerStartPending(page: Page) {
    // 33.4 Metternich's Legacy opens an AU decision at the end of turn-1
    // diplomacy; answer it (and the second pick) before playing.
    for (let round = 0; round < 6; round += 1) {
        let answered = false;
        for (const seat of SEATS) {
            await focusSeat(page, seat);
            const board = page.locator(`[data-testid="ie-seat-${seat}"]`);
            const pending = board.locator('[data-testid="ie-pending"]');
            if (!(await pending.count()) || !(await pending.isVisible())) continue;
            const options = pending.locator("button");
            if (!(await options.count())) continue;
            await options.first().click();
            await page.waitForTimeout(200);
            answered = true;
            break;
        }
        if (!answered) break;
    }
}

test.describe("Imperial Elegy new controls", () => {
    test("war declaration reveals aim, ally and maneuver controls", async ({page}) => {
        await reachAction(page);
        const board = boardFor(page, "GE");
        await playCpCard(board);

        // Berlin selects correctly, but it is German-controlled so it cannot be a
        // war objective. The declaration panel is offered for a space controlled
        // by another major power, so use Bohemia (Austria-Hungary) as the target.
        await board.locator('[data-testid="ie-space-berlin"]').click({force: true});
        await expect(board.locator('[data-testid="ie-space-detail"]')).toContainText("柏林");
        await expect(board.locator('[data-testid="ie-war-declare"]')).toHaveCount(0);

        await board.locator('[data-testid="ie-space-bohemia"]').click({force: true});
        await expect(board.locator('[data-testid="ie-space-detail"]')).toContainText("波希米亚");
        const declare = board.locator('[data-testid="ie-war-declare"]');
        await expect(declare).toBeVisible();
        await expect(declare).toContainText("奥匈帝国");

        // Use the smallest budget so the declaration is legal with any CP card.
        await declare.locator("select").nth(1).selectOption("1");
        await declare.getByRole("button", {name: "宣战"}).click();
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("wartime");

        const war = board.locator('[data-testid="ie-war"]');
        await expect(war).toBeVisible();
        await expect(war).toContainText("波希米亚");
        await expect(war.getByRole("button", {name: "征服"})).toBeVisible();
        await expect(war.getByRole("button", {name: "解放"})).toBeVisible();
        await expect(war.getByRole("button", {name: "统一"})).toBeVisible();
        await expect(war.getByRole("button", {name: "开始机动"})).toBeVisible();
        await expect(war.getByRole("button", {name: "召唤盟友"})).toBeVisible();
    });

    test("card economy controls render and Save toggles the card state", async ({page}) => {
        await reachAction(page);
        const board = boardFor(page, "GE");

        const card = await findSavableCard(board);
        expect(card).not.toBeNull();
        const testId = await card!.getAttribute("data-testid");
        const cardId = testId!.replace("ie-card-", "");

        const cardActions = board.locator(`[data-testid="ie-card-${cardId}"] .ie-card-actions`);
        const save = cardActions.getByRole("button", {name: "保留", exact: true});
        const industrialize = cardActions.getByRole("button", {name: "工业化", exact: true});
        const cpChain = cardActions.getByRole("button", {name: "CP 链", exact: true});

        await expect(save).toBeVisible();
        await expect(industrialize).toBeVisible();
        await expect(cpChain).toBeVisible();
        await expect(save).toBeEnabled();
        await expect(industrialize).toBeEnabled();
        await expect(cpChain).toBeEnabled();
        await expect(save).toHaveAttribute("aria-pressed", "false");

        await save.click();

        const unsave = cardActions.getByRole("button", {name: "取消保留", exact: true});
        await expect(unsave).toBeVisible();
        await expect(unsave).toHaveAttribute("aria-pressed", "true");
        await expect(board.locator(".ie-hand-meta")).toContainText("已保留的牌");
    });

    test("MPIT matrix renders and the GW panel is conditionally present", async ({page}) => {
        await reachAction(page);
        const board = boardFor(page, "GE");

        const mpit = board.locator('[data-testid="ie-mpit"]');
        await expect(board.getByRole("heading", {name: /MPIT · 影响力轨/})).toBeVisible();
        await expect(mpit).toBeVisible();
        await expect(mpit.locator(".ie-mpit-cell")).toHaveCount(6);
        await expect(mpit).toContainText("TE");
        await expect(mpit).toContainText("TA");
        await expect(mpit).toContainText("中立");

        const mpitControls = board.locator('[data-testid="ie-mpit-controls"]');
        await expect(mpitControls).toBeVisible();
        await expect(mpitControls.getByRole("button", {name: /放置大国影响力/})).toBeVisible();

        // The Great War starts only after an outbreak, so pre-outbreak the panel
        // must be absent; if a future setup does start the war, its order and
        // budget sections must be rendered.
        const gw = await page.evaluate(() => (window as any).__IE_STATE__.gw);
        const gwPanel = board.locator('[data-testid="ie-gw"]');
        if (gw) {
            await expect(gwPanel).toBeVisible();
            await expect(gwPanel.locator(".ie-gw-order")).toBeVisible();
            await expect(gwPanel.locator(".ie-budget-grid")).toBeVisible();
        } else {
            await expect(gwPanel).toHaveCount(0);
        }
    });
});
