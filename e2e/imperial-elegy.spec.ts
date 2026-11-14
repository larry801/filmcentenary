import {expect, test, Page} from "@playwright/test";

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

async function finishPrep(page: Page) {
    for (const seat of SEATS) {
        await focusSeat(page, seat);
        const board = page.locator(`[data-testid="ie-seat-${seat}"]`);
        const ready = board.getByRole("button", {name: "准备完毕"}).first();
        if (await ready.count()) await ready.click();
        await page.waitForTimeout(250);
    }
}

async function chooseHomeCards(page: Page) {
    for (const seat of SEATS) {
        await focusSeat(page, seat);
        const board = page.locator(`[data-testid="ie-seat-${seat}"]`);
        const choose = board.getByRole("button", {name: "选择本土牌"}).first();
        if (await choose.count()) await choose.click();
        await page.waitForTimeout(250);
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
        const cpButtons = board.locator(".ie-card-actions button", {hasText: "作为 CP 打出"});
        let played = false;
        for (let i = 0; i < await cpButtons.count(); i += 1) {
            if (await cpButtons.nth(i).isEnabled()) {
                await cpButtons.nth(i).click();
                played = true;
                break;
            }
        }
        expect(played).toBe(true);
        await page.waitForTimeout(600);
        await board.locator('[data-testid="ie-space-berlin"]').click({force: true});
        await expect(board.locator('[data-testid="ie-space-detail"]')).toContainText("柏林");
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
        const cpButtons = board.locator(".ie-card-actions button", {hasText: "作为 CP 打出"});
        await expect(cpButtons.first()).toBeVisible();
        for (let i = 0; i < await cpButtons.count(); i += 1) {
            if (await cpButtons.nth(i).isEnabled()) { await cpButtons.nth(i).click(); break; }
        }
        await page.waitForTimeout(800);
        await board.locator('[data-testid="ie-space-berlin"]').click({force: true});
        await page.waitForTimeout(300);
        await board.getByRole("button", {name: "在此发动陆战"}).first().click();
        await page.waitForTimeout(250);
        await board.locator('[data-testid="ie-space-saxony"]').click({force: true});
        await expect.poll(async () => await board.locator('[data-testid="ie-pending"]').count()).toBeGreaterThan(0);
        await expect(board.locator('[data-testid="ie-pending"]')).toBeVisible();
        await expect(board.locator('[data-testid="ie-pending"]')).toContainText("支援");
        // Resolve the attacker's and defender's support windows.
        for (let i = 0; i < 4; i += 1) {
            const pending = board.locator('[data-testid="ie-pending"]');
            if (!(await pending.isVisible())) break;
            const options = pending.locator("button");
            if (await options.count()) await options.first().click();
            else break;
            await page.waitForTimeout(120);
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
        await expect.poll(async () => await board.locator('[data-testid="ie-log"]').innerText()).toContain("萨克森");
    });

    test("SVG cards switch language and expose the other translation without image requests", async ({page}) => {
        const cardImageRequests: string[] = [];
        page.on("request", (request) => {
            if (/\/imperial-elegy\/cards\/.*\.(png|jpe?g)(?:\?|$)/i.test(request.url())) cardImageRequests.push(request.url());
        });
        await openLocal(page);
        const board = page.locator('[data-testid="ie-seat-GE"]');
        const card = board.locator(".ie-hand .ie-card").first();
        const face = card.locator("svg.ie-card-face");
        const original = await face.getAttribute("data-card-id");
        await expect(face).toHaveAttribute("lang", "zh-CN");
        await expect(face.locator(".ie-card-rules")).toContainText(/[\u4e00-\u9fff]/);
        await expect(board.locator(".ie-card img, .ie-card image")).toHaveCount(0);
        await card.locator("summary").click();
        await expect(card.locator("details > div")).toBeVisible();
        await expect(card.locator("details > div")).toHaveAttribute("lang", "en");
        await page.locator(".MuiSwitch-input").click();
        await expect(page.getByRole("heading", {name: "Imperial Elegy — local hotseat"})).toBeVisible();
        await expect(face).toHaveAttribute("data-card-id", original!);
        await expect(face).toHaveAttribute("lang", "en");
        await expect(face.locator(".ie-card-rules")).toContainText(/[A-Za-z]/);
        await expect(card.locator("details > div")).toHaveAttribute("lang", "zh-CN");
        expect(cardImageRequests).toEqual([]);
    });

    test("an online match-creation page is reachable", async ({page}) => {
        await page.goto("/imperialElegy");
        await expect(page.getByText("Imperial Elegy 帝国挽歌").first()).toBeVisible();
    });
});
