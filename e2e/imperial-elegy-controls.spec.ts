import {expect, test, Page, Locator} from "@playwright/test";

const SEATS = ["GE", "UK", "FR", "AU", "RU", "OT"] as const;

/**
 * The hand tray starts collapsed (the map needs the height).  Every card
 * interaction lives inside it, so the specs open it first.
 */
/** Open one card's row so its face and its buttons exist. */
async function openCard(card: Locator) {
    if (await card.getAttribute("data-expanded") === "true") return card;
    await card.locator(".ie-card-open").click();
    await expect(card).toHaveAttribute("data-expanded", "true");
    return card;
}

async function openHand(board: Locator) {
    const tray = board.locator('[data-testid="ie-hand-tray"]');
    if (await tray.getAttribute("data-open") === "false") {
        await board.locator('[data-testid="ie-tray-toggle"]').click();
        await expect(tray).toHaveAttribute("data-open", "true");
    }
    return board;
}

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
        // The home card is chosen by clicking a specific card's face, so each
        // choice is explicit rather than an auto-pick of the first card.
        const choose = board.locator('[data-testid^="ie-choose-home-"]').first();
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
    await openHand(board);
    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining) > 0) return;
        const cards = board.locator(".ie-hand .ie-card");
        let played = false;
        for (let i = 0; i < await cards.count() && !played; i += 1) {
            const card = cards.nth(i);
            // Only an unfolded card renders its buttons.
            if (await card.getAttribute("data-expanded") !== "true") await openCard(card);
            const cp = card.locator('[data-testid^="ie-play-cp-"]').first();
            if (await cp.count() && await cp.isEnabled()) {
                await cp.click();
                played = true;
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
    await openHand(board);
    const cards = board.locator(".ie-hand .ie-card");
    for (let i = 0; i < await cards.count(); i += 1) {
        const card = cards.nth(i);
        await openCard(card);
        // Secondary operations (Save, Industrialize, CP chain) live in the
        // CardInspector, which opens from the unfolded card's face.
        await card.locator(".ie-card-face-button").click();
        const save = board.locator('[data-testid="ie-card-inspector"]')
            .getByRole("button", {name: "保留", exact: true});
        const found = await save.count() > 0 && await save.isEnabled();
        await board.page().keyboard.press("Escape");
        if (found) return card;
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
    test("phase buttons live in the collapsible dock and survive collapsing", async ({page}) => {
        await reachAction(page);
        const board = boardFor(page, "GE");
        const dock = board.locator('[data-testid="ie-dock"]');
        await expect(dock).toBeVisible();
        await expect(dock).toHaveAttribute("data-collapsed", "false");

        // The action-phase buttons are in the dock, not the hand panel.
        const pass = dock.getByRole("button", {name: "停牌", exact: true});
        const endImpulse = dock.getByRole("button", {name: "结束行动轮"});
        await expect(pass).toBeVisible();
        await expect(endImpulse).toBeVisible();

        // Collapsing hides the bulky body but keeps the bar and its buttons.
        await dock.locator('[data-testid="ie-dock-toggle"]').click();
        await expect(dock).toHaveAttribute("data-collapsed", "true");
        await expect(dock.locator('[data-testid="ie-dock-toggle"]')).toHaveAttribute("aria-expanded", "false");
        await expect(pass).toBeVisible();
        await expect(endImpulse).toBeVisible();

        // The 56 px command bar stays put; collapsing removes the bulky body
        // (which overlays the map) rather than resizing the whole bar.
        await expect(dock.locator(".ie-dock-body")).toHaveCount(0);
        await dock.locator('[data-testid="ie-dock-toggle"]').click();
        await expect(dock).toHaveAttribute("data-collapsed", "false");
        await expect(dock.locator(".ie-dock-body")).toBeVisible();
    });

    test("the optional stability discard is labelled and can be skipped", async ({page}) => {
        await openLocal(page);
        await focusSeat(page, "GE");
        const board = boardFor(page, "GE");
        const dock = board.locator('[data-testid="ie-dock"]');

        const discard = dock.locator('[data-testid="ie-stability-discard"]');
        await expect(discard).toBeVisible({timeout: 15_000});
        // It reads as optional, not as a blocker.
        await expect(dock).toHaveAttribute("data-collapsed", "false");
        await expect(dock.locator('[data-testid="ie-dock-summary"]')).toContainText("可选");
        await expect(discard.locator('[data-testid="ie-stability-discard-optional"]')).toBeVisible();
        await expect(discard.locator('[data-testid="ie-stability-discard-hint"]')).toBeVisible();
        expect(await dock.locator('[data-testid="ie-dock-summary"]').innerText()).not.toContain("需要选择卡牌");

        // Skipping is legal: press Ready without discarding and the turn passes
        // to the next seat while the hand keeps its cards.  (`prepDone` is a
        // private flag that `playerView` strips, so assert on the hand and the
        // handover instead.)
        const handBefore = await page.evaluate(() => (window as any).__IE_STATE__.powers.GE.hand.length);
        await dock.getByRole("button", {name: "准备完毕"}).click();
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.activePower)).not.toBe("GE");
        expect(await page.evaluate(() => (window as any).__IE_STATE__.powers.GE.hand.length)).toBe(handBefore);
    });

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
        const board = await openHand(boardFor(page, "GE"));

        const card = await findSavableCard(board);
        expect(card).not.toBeNull();

        // The economy controls live in the CardInspector, reached from the
        // unfolded card's face.
        await card!.locator(".ie-card-face-button").click();
        const inspector = board.locator('[data-testid="ie-card-inspector"]');
        await expect(inspector).toBeVisible();

        const save = inspector.getByRole("button", {name: "保留", exact: true});
        const industrialize = inspector.getByRole("button", {name: "工业化", exact: true});
        const cpChain = inspector.getByRole("button", {name: "CP 链", exact: true});

        await expect(save).toBeVisible();
        await expect(industrialize).toBeVisible();
        await expect(cpChain).toBeVisible();
        await expect(save).toBeEnabled();
        await expect(industrialize).toBeEnabled();
        await expect(cpChain).toBeEnabled();
        await expect(save).toHaveAttribute("aria-pressed", "false");

        await save.click();

        const unsave = inspector.getByRole("button", {name: "取消保留", exact: true});
        await expect(unsave).toBeVisible();
        await expect(unsave).toHaveAttribute("aria-pressed", "true");
        await page.keyboard.press("Escape");
        await expect(board.locator(".ie-hand-meta")).toContainText("已保留的牌");
    });

    test("MPIT matrix renders and the GW panel is conditionally present", async ({page}) => {
        await reachAction(page);
        const board = boardFor(page, "GE");

        // The context rail has three tabs; the MPIT matrix lives in Reference.
        await board.locator('[data-testid="ie-rail-tab-reference"]').click();

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

test.describe("Imperial Elegy solo vs bot", () => {
    test("the solo entrance starts a match with P2-P6 as read-only bot seats", async ({page}) => {
        await page.goto("/localIE?solo=1");
        // The seat-setup screen only appears on the explicit solo entrance; the
        // plain hotseat link keeps starting straight on the board.
        const start = page.getByTestId("ie-start-match");
        await expect(start).toBeVisible();
        const checked = await page.locator(".ie-local input[type=checkbox]").evaluateAll(
            (boxes) => boxes.map((box) => (box as HTMLInputElement).checked),
        );
        expect(checked).toEqual([false, true, true, true, true, true]);

        await start.click();
        await expect(page.locator('[data-testid="ie-seat-GE"]')).toBeVisible();

        // A bot seat drives itself, so the person at the keyboard may only watch.
        await page.getByRole("tab", {name: /P3/}).click();
        const botBoard = page.locator('[data-testid="ie-seat-FR"]');
        await expect(botBoard.locator(".ie-bot-banner")).toContainText("机器人");
        const clickable = await botBoard
            .locator(".ie-btn, .ie-card-actions button")
            .evaluateAll((buttons) => buttons
                .filter((button) => !(button as HTMLButtonElement).disabled)
                .map((button) => (button.textContent ?? "").trim()));
        // Only the shared read-only header buttons stay usable.
        expect(clickable).toEqual(["参考图表", "规则与来源"]);
    });

    test("a bot seat takes its impulse instead of stalling on an illegal move", async ({page}) => {
        const errors: string[] = [];
        page.on("console", (message) => {
            if (message.type() === "error") errors.push(message.text());
        });

        await page.goto("/localIE?solo=1");
        await page.getByTestId("ie-start-match").click();
        await expect(page.locator('[data-testid="ie-seat-GE"]')).toBeVisible();

        const board = boardFor(page, "GE");
        await clickUntilGone(page, board.getByRole("button", {name: "准备完毕"}).first());
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("diplomacy");
        await clickUntilGone(page, board.locator('[data-testid^="ie-choose-home-"]').first());
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("action");

        // Play one card for CP and hand the impulse over.  The bug this guards
        // was the bot re-sending `chooseHomeCard` forever once its home card had
        // been played, which froze the match on this exact transition.
        const cpButtons = board.locator(".ie-card-actions button", {hasText: "作为 CP 打出"});
        for (let i = 0; i < await cpButtons.count(); i += 1) {
            if (await cpButtons.nth(i).isEnabled()) { await cpButtons.nth(i).click(); break; }
        }
        await page.waitForTimeout(600);

        // 33.4 Metternich's Legacy opens a decision for AU (a bot seat) at the
        // end of turn-1 diplomacy, and bots resolve their own pendings while GE
        // is still to act.  `endImpulse` refuses to run while any decision is
        // open, so wait for the decision to clear before handing over; clicking
        // into that window burned the click and left the match on GE forever.
        await expect.poll(
            async () => await page.evaluate(() => (window as any).__IE_STATE__.pending === null),
            {timeout: 30_000},
        ).toBe(true);

        // Hand the impulse over exactly once.  Re-clicking a stale button would
        // send a second `endImpulse` after the seat is no longer active and
        // produce an `invalid move` that has nothing to do with the bot.
        const endImpulse = board.getByRole("button", {name: "结束行动轮"}).first();
        await expect(endImpulse).toBeVisible();
        await endImpulse.click();
        await expect.poll(
            async () => await page.evaluate(() => (window as any).__IE_STATE__.activePower),
            {timeout: 30_000},
        ).not.toBe("GE");

        // The bots must actually take their impulses: two more powers must
        // write to the public log after the hand-over.  Counting log entries is
        // dice-independent, unlike asserting on CP or on battle outcomes.
        const botEntries = async () => await page.evaluate(() => {
            const G = (window as any).__IE_STATE__;
            return G.log.filter((entry: any) => entry.power && entry.power !== "GE").length;
        });
        const before = await botEntries();
        await expect.poll(botEntries, {timeout: 45_000}).toBeGreaterThanOrEqual(before + 2);

        // The regression this guards: the bot re-sent `chooseHomeCard` (an
        // illegal move outside diplomacy) forever once its home card had been
        // played, which froze the match on exactly this transition.
        expect(errors.filter((text) => /invalid move/.test(text))).toEqual([]);
    });
});

test.describe("Imperial Elegy one-screen acceptance", () => {
    test("the 1440x900 shell does not scroll and keeps CP, fonts and inline styles in budget", async ({page}) => {
        await reachAction(page);
        const board = boardFor(page, "GE");

        // 1. The whole hotseat shell is exactly one viewport tall.
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(900);
        expect(await page.evaluate(() => document.body.scrollHeight)).toBe(900);

        // 2. The hand tray is at most 230 px and is actually on screen.
        const tray = board.locator('[data-testid="ie-hand-tray"]');
        await expect(tray).toBeVisible();
        const trayBox = (await tray.boundingBox())!;
        expect(trayBox.height).toBeLessThanOrEqual(230);
        expect(trayBox.y + trayBox.height).toBeLessThanOrEqual(901);

        // 3. The CP readout exists exactly once on the board.
        await expect(board.locator('[data-testid="ie-command-cp"]')).toHaveCount(1);
        expect(await board.locator('[data-testid="ie-command-cp"]').innerText()).toContain("CP");

        // 4. The context rail fits the same screen.
        const railBox = (await board.locator(".ie-rail").boundingBox())!;
        expect(railBox.height).toBeLessThanOrEqual(900);

        // 5. No body-size leaf text under 12 px and no non-SVG inline styles in
        //    the active board (the map's inline cursor styles were removed too).
        const audit = await page.evaluate(() => {
            const svgTags = new Set(["svg", "g", "path", "circle", "rect", "text", "tspan", "polygon", "ellipse", "line", "defs", "pattern", "lineargradient", "stop"]);
            const inClosedDetails = (el: Element) => {
                const d = el.closest("details:not([open])");
                return d !== null && el.closest("summary") === null;
            };
            const visible = (el: Element) => {
                if (inClosedDetails(el)) return false;
                if ((el as HTMLElement).checkVisibility &&
                    !(el as HTMLElement).checkVisibility({checkOpacity: true, checkVisibilityCSS: true})) return false;
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
            };
            const root = document.querySelector('[data-testid="ie-seat-GE"]')!;
            const small = [...root.querySelectorAll("*")].filter((el) =>
                visible(el) && el.children.length === 0 && (el.textContent ?? "").trim().length > 0 &&
                el.closest(".ie-rule-ref") === null &&
                parseFloat(getComputedStyle(el).fontSize) < 12);
            const inline = [...root.querySelectorAll("[style]")].filter((el) =>
                !svgTags.has(el.tagName.toLowerCase()));
            return {small: small.length, inline: inline.length};
        });
        expect(audit.small).toBe(0);
        expect(audit.inline).toBe(0);
    });

    test("the card inspector shows every operation and switches between SVG and print faces", async ({page}) => {
        await reachAction(page);
        const board = await openHand(boardFor(page, "GE"));
        const card = await openCard(board.locator(".ie-hand .ie-card").first());
        // The inspector opens from the unfolded card's face.
        await card.locator(".ie-card-face-button").click();

        const inspector = board.locator('[data-testid="ie-card-inspector"]');
        await expect(inspector).toBeVisible();
        await expect(inspector).toHaveAttribute("data-face-mode", "svg");
        await expect(inspector.locator("svg.ie-card-face")).toBeVisible();
        // CP, event, industrialize, CP chain and save are all offered in place.
        expect(await inspector.locator(".ie-card-inspector-actions button").count()).toBeGreaterThanOrEqual(5);
        // A fully playable card has no aggregated reasons; a blocked one does.
        const unavailable = inspector.locator('[data-testid="ie-card-inspector-unavailable"]');
        if (await unavailable.count() > 0) await expect(unavailable).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(inspector).toHaveCount(0);

        // Switch the face preference, reopen, and see the scanned image.
        await board.locator('[data-testid="ie-display-menu"] > summary').click();
        await board.locator('[data-testid="ie-card-face-print"]').click();
        await expect.poll(async () => await page.evaluate(() => localStorage.getItem("ie_card_face"))).toBe("print");
        await card.locator(".ie-card-face-button").click();
        await expect(inspector).toHaveAttribute("data-face-mode", "print");
        await expect(inspector.locator('[data-testid="ie-card-inspector-image"]')).toBeVisible();
        await page.keyboard.press("Escape");

        // Leave the default in place for the rest of the suite.
        await board.locator('[data-testid="ie-display-menu"] > summary').click();
        await board.locator('[data-testid="ie-card-face-svg"]').click();
        await expect.poll(async () => await page.evaluate(() => localStorage.getItem("ie_card_face"))).toBe("svg");
    });

    test("a miss while targeting spends no CP, and Esc leaves the mode", async ({page}) => {
        await reachAction(page);
        const board = boardFor(page, "GE");
        await playCpCard(board);
        await board.locator('[data-testid="ie-space-berlin"]').click({force: true});
        const land = board.getByRole("button", {name: "在此发动陆战"}).first();
        await expect(land).toBeEnabled();
        await land.click();
        await expect(board.locator('[data-testid="ie-mode-pill"]')).toBeVisible();
        await expect(board.locator('[data-testid="ie-mode-pill-targets"]')).toBeVisible();

        const before = await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining);
        // London is neither adjacent to Berlin nor a legal battle target.
        await board.locator('[data-testid="ie-space-london"]').click({force: true});
        await page.waitForTimeout(250);
        expect(await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining)).toBe(before);
        await expect(board.locator('[data-testid="ie-mode-pill"]')).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(board.locator('[data-testid="ie-mode-pill"]')).toHaveCount(0);
        expect(await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining)).toBe(before);
    });
});

test.describe("Imperial Elegy mobile drawer", () => {
    test.use({viewport: {width: 390, height: 844}});

    test("starts at the peek position and opens to half and full height", async ({page}) => {
        await openLocal(page);
        const board = boardFor(page, "GE");
        const tray = board.locator('[data-testid="ie-hand-tray"]');
        await expect(tray).toHaveAttribute("data-open", "false");
        await expect.poll(async () => await page.evaluate(() => document.documentElement.scrollHeight))
            .toBeLessThanOrEqual(844 * 1.2);

        await board.locator('[data-testid="ie-tray-toggle"]').click();
        await expect(tray).toHaveAttribute("data-open", "true");
        const half = (await tray.boundingBox())!.height;
        expect(half).toBeGreaterThan(100);
        expect(half).toBeLessThan(844 * 0.8);

        await board.locator('[data-testid="ie-tray-expand"]').click();
        await expect(tray).toHaveAttribute("data-expanded", "true");
        const full = (await tray.boundingBox())!.height;
        expect(full).toBeGreaterThan(half);

        await board.locator('[data-testid="ie-tray-toggle"]').click();
        await expect(tray).toHaveAttribute("data-open", "false");
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844 * 1.2);
    });
});
