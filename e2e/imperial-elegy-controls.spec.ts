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
    // Wait for the seat to really be the shown one instead of sleeping a fixed
    // 180 ms.  `reachAction` focuses a seat ~24 times, so the old sleep alone
    // cost ~4.3 s of every test in this spec.
    await expect(page.locator(`[data-testid="ie-seat-${seat}"]`)).toHaveAttribute("data-active", "true");
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
    // A fresh impulse shows 12.0's single exit as 停牌; it becomes 结束行动轮
    // once GE plays a card.  Wait for the button, not for one of the two labels.
    await expect(boardFor(page, "GE").locator('[data-testid="ie-pass"]')).toBeVisible({timeout: 15_000});
}

function boardFor(page: Page, seat: string): Locator {
    return page.locator(`[data-testid="ie-seat-${seat}"]`);
}

/**
 * Give GE a CP budget by playing its first legal card for CP.
 *
 * Returns false when no card was playable (an impulse that cannot use a card at
 * all); callers that need the card must assert on the result.  Arm-then-confirm
 * is the default: the first click arms, the second plays.
 */
async function playCpCard(board: Locator): Promise<boolean> {
    const page = board.page();
    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining) > 0) return true;
        // Arm-then-confirm: the first click arms (`data-armed`), the second
        // plays.  Addressed by test id because the armed label replaces the
        // text a name filter matches.
        const cpButtons = board.locator('[data-testid^="ie-play-cp-"]');
        await expect(cpButtons.first()).toBeVisible();
        let played = false;
        for (let i = 0; i < await cpButtons.count(); i += 1) {
            const button = cpButtons.nth(i);
            if (!(await button.isEnabled())) continue;
            await button.click();
            await expect(button).toHaveAttribute("data-armed", "true");
            await button.click();
            played = true;
            break;
        }
        if (!played) return false;
        try {
            await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining), {timeout: 5_000}).toBeGreaterThan(0);
            return true;
        } catch {
            await page.waitForTimeout(300);
        }
    }
    return await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining) > 0;
}

/** Unfold one hand card so its face and its buttons exist. */
async function openCard(card: Locator): Promise<Locator> {
    if (await card.getAttribute("data-expanded") === "true") return card;
    await card.locator(".ie-card-open").click();
    await expect(card).toHaveAttribute("data-expanded", "true");
    return card;
}

/** Find a hand card whose Save control is enabled (non-home, non-mandatory). */
async function findSavableCard(board: Locator): Promise<Locator | null> {
    const cards = board.locator(".ie-hand .ie-card");
    for (let i = 0; i < await cards.count(); i += 1) {
        const card = await openCard(cards.nth(i));
        // Secondary operations (Save, Industrialize, CP chain) live in the
        // CardInspector, which opens from the unfolded card's face.
        await card.locator(".ie-card-face-button").click();
        const inspector = board.locator('[data-testid="ie-card-inspector"]');
        const save = inspector.getByRole("button", {name: "保留", exact: true});
        const found = await save.count() > 0 && await save.isEnabled();
        await board.page().keyboard.press("Escape");
        await expect(inspector).toHaveCount(0);
        if (found) return card;
    }
    return null;
}

async function answerStartPending(page: Page) {
    // 33.4 Metternich's Legacy opens an AU decision at the end of turn-1
    // diplomacy; answer it (and the second pick) before playing.
    //
    // Every seat is swept in rulebook order, exactly as before: `playerView`
    // strips another seat's option ids, so the option can only be clicked on
    // the deciding seat's own panel.  What is gone is the fixed `waitForTimeout`
    // after each click; the sweep waits for the decision to actually change.
    // That alone was most of a ~7 s setup in every test that reached the action
    // phase.
    for (let round = 0; round < 6; round += 1) {
        let answered = false;
        for (const seat of SEATS) {
            await focusSeat(page, seat);
            const pending = boardFor(page, seat).locator('[data-testid="ie-pending"]');
            const options = pending.locator("button");
            if (!(await options.count())) continue;
            const before = await page.evaluate(() => (window as any).__IE_STATE__?.pending?.id ?? null);
            await options.first().click();
            // A follow-up decision (the second pick) replaces the pending
            // instead of clearing it, so wait for it to become a different one.
            await expect.poll(
                async () => await page.evaluate(() => (window as any).__IE_STATE__?.pending?.id ?? null),
                {timeout: 10_000},
            ).not.toBe(before);
            answered = true;
            break;
        }
        if (!answered) return;
    }
}

test.describe("Imperial Elegy new controls", () => {
    test("phase buttons live in the collapsible dock and survive collapsing", async ({page}) => {
        await reachAction(page);
        const board = boardFor(page, "GE");
        const dock = board.locator('[data-testid="ie-dock"]');
        await expect(dock).toBeVisible();
        await expect(dock).toHaveAttribute("data-collapsed", "false");

        // 12.0 has one exit, not two: the dock shows a single button (停牌 on a
        // fresh impulse, 结束行动轮 once the seat has played a card).
        const exit = dock.locator('[data-testid="ie-pass"]');
        await expect(exit).toBeVisible();
        await expect(exit).toHaveText("停牌");
        await expect(dock.getByRole("button", {name: "结束行动轮"})).toHaveCount(0);

        // The turn panel replaces the collapsible overlay dock: there is no
        // collapse toggle any more, and the head stays on screen at 1440x900.
        expect(await dock.locator('[data-testid="ie-dock-toggle"]').count()).toBe(0);
        const dockBox = (await dock.boundingBox())!;
        expect(dockBox.y).toBeGreaterThanOrEqual(0);
        expect(dockBox.y + dockBox.height).toBeLessThanOrEqual(900);

        // The one exit is rendered once: it used to be duplicated in the strip
        // and the panel head, which made every address ambiguous.
        await expect(board.locator('[data-testid="ie-pass"]')).toHaveCount(1);
    });

    test("the optional stability discard is labelled and can be skipped", async ({page}) => {
        await openLocal(page);

        // Prep deals are random, and a power whose whole opening hand is
        // mandatory events has nothing legal to discard — that seat correctly
        // gets no discard section.  Walk the prep order and run the assertions
        // on the first seat that actually holds a discardable card, instead of
        // assuming GE always does (it drew three mandatory events once and made
        // this test flaky).
        let tested = false;
        for (const seat of SEATS) {
            await focusSeat(page, seat);
            const board = boardFor(page, seat);
            const dock = board.locator('[data-testid="ie-dock"]');
            const discard = dock.locator('[data-testid="ie-stability-discard"]');

            if (await discard.count() > 0 && await discard.isVisible()) {
                // It reads as optional, not as a blocker.
                await expect(dock).toHaveAttribute("data-collapsed", "false");
                await expect(dock.locator('[data-testid="ie-dock-summary"]')).toContainText("可选");
                await expect(discard.locator('[data-testid="ie-stability-discard-optional"]')).toBeVisible();
                await expect(discard.locator('[data-testid="ie-stability-discard-hint"]')).toBeVisible();
                expect(await dock.locator('[data-testid="ie-dock-summary"]').innerText()).not.toContain("需要选择卡牌");
                // The card is a random draw, so the dock offers one button and
                // must never render a per-card choice.
                await expect(dock.locator('[data-testid="ie-discard-random"]')).toBeVisible();
                await expect(dock.locator('[data-testid^="ie-discard-card-"]')).toHaveCount(0);

                // Skipping is legal: press Ready without discarding and the turn
                // passes to the next seat while the hand keeps its cards.
                // (`prepDone` is a private flag that `playerView` strips, so
                // assert on the hand and the handover instead.)
                const index = SEATS.indexOf(seat as typeof SEATS[number]);
                const handBefore = await page.evaluate(
                    (power) => (window as any).__IE_STATE__.powers[power].hand.length,
                    seat,
                );
                const ready = dock.getByRole("button", {name: "准备完毕"}).first();
                await clickUntilGone(page, ready);
                await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.activePower))
                    .toBe(SEATS[(index + 1) % SEATS.length]);
                expect(await page.evaluate(
                    (power) => (window as any).__IE_STATE__.powers[power].hand.length,
                    seat,
                )).toBe(handBefore);
                tested = true;
                break;
            }

            // No legal discard for this seat: finish its prep and move on.
            const ready = dock.getByRole("button", {name: "准备完毕"}).first();
            await clickUntilGone(page, ready);
        }

        expect(tested).toBe(true);
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
        // Declaring a war is irreversible: the first click arms the button,
        // the second one declares.  Addressed by test id across both clicks
        // because the armed label replaces the plain name the role filter
        // matched.  `data-armed` alone could be a stale attribute, so the
        // confirmation label is asserted too.
        const warButton = declare.locator('[data-testid="ie-declare-war"]');
        await expect(warButton).toBeEnabled({timeout: 15_000});
        await warButton.click();
        await expect(warButton).toHaveAttribute("data-armed", "true");
        await expect(warButton).toContainText("确认");
        await warButton.click();
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("wartime");

        // The war panel is the turn panel's War tab.
        await board.locator('[data-testid="ie-turn-tab-war"]').click();
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
        // The economy controls live in the CardInspector.
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

        // The MPIT matrix is an Orders action (8.0): it is in the turn panel
        // with the other things the player may do this impulse, not in the
        // reference drawer.
        const mpit = board.locator('[data-testid="ie-mpit"]');
        await expect(board.getByText(/MPIT · 影响力轨/).first()).toBeVisible();
        await expect(mpit).toBeVisible();
        await expect(mpit.locator(".ie-mpit-cell")).toHaveCount(6);
        await expect(mpit).toContainText("TE");
        await expect(mpit).toContainText("TA");
        await expect(mpit).toContainText("中立");

        const mpitControls = board.locator('[data-testid="ie-mpit-controls"]');
        await expect(mpitControls).toBeVisible();
        await expect(mpitControls.getByRole("button", {name: /放置大国影响力/})).toBeVisible();

        // The drawer still opens on "?" and closes on Escape.
        await board.locator('[data-testid="ie-open-reference"]').click();
        await expect(board.locator('[data-testid="ie-reference-drawer"]')).toBeVisible();
        await page.keyboard.press("Escape");
        // The drawer is kept mounted with `hidden` so the anchor survives.
        await expect(board.locator('[data-testid="ie-reference-drawer"]')).toBeHidden();
        // The Great War panel is the turn panel's War tab; before an outbreak
        // that tab does not exist, so open it only when a war is running.
        const gw = await page.evaluate(() => (window as any).__IE_STATE__.gw);
        if (gw) await board.locator('[data-testid="ie-turn-tab-war"]').click();
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
        // A bot seat has nothing to act with; the drawer's close button is the
        // only enabled control the board still carries for it.
        expect(clickable).toEqual(["✕"]);
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
        // The bots finish their own prep, so GE's Ready can land while the turn
        // is already moving; the phase poll below is the real precondition.
        await clickUntilGone(page, board.getByRole("button", {name: "准备完毕"}).first());
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("diplomacy");
        // GE may be a bot seat in this fixture; if it is, it picks its own home
        // card and there is nothing to click here.
        const choose = board.locator('[data-testid^="ie-choose-home-"]').first();
        if (await choose.count()) await clickUntilGone(page, choose);
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("action");

        // Play one card for CP and hand the impulse over.  The bug this guards
        // was the bot re-sending `chooseHomeCard` forever once its home card had
        // been played, which froze the match on this exact transition.
        //
        // This fixture is "P2-P6 are bots", so GE is the human seat and plays a
        // card; `playCpCard` only pauses when no card can be played at all.
        const played = await playCpCard(board);
        // A deal can hold no card that may bank CP (shared combat/mandatory
        // cards).  12.0 then leaves only the unused-impulse pass, and that pass
        // is itself restricted, so this spec cannot hand the impulse over: the
        // bot-transition bug it guards needs a played card as its precondition.
        test.skip(!played, "this deal has no card that can be played for CP");
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining)).toBeGreaterThan(0);
        await expect.poll(async () => await board.locator('[data-testid="ie-pass"]').innerText()).toBe("结束行动轮");
        // 12.0: the single exit reads 结束行动轮 once a card has been played.
        // The exit already reads 结束行动轮 in the failure screenshot, so the
        // click is what lags: retry until the seat really hands over instead of
        // assuming one click lands inside the 30 s window.
        if (played) {
            await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining)).toBeGreaterThan(0);
            await expect.poll(async () => await board.locator('[data-testid="ie-pass"]').innerText()).toBe("结束行动轮");
        }

        // 33.4 Metternich's Legacy opens a decision for AU (a bot seat) at the
        // end of turn-1 diplomacy, and bots resolve their own pendings while GE
        // is still to act.  `pass` refuses to run while any decision is open,
        // so wait for the decision to clear before handing over; clicking into
        // that window burned the click and left the match on GE forever.
        await expect.poll(
            async () => await page.evaluate(() => (window as any).__IE_STATE__.pending === null),
            {timeout: 30_000},
        ).toBe(true);

        // Hand the impulse over exactly once through the same 12.0 button
        // (结束行动轮 after a card, 停牌 on an unused impulse).  Re-clicking a
        // stale button would send a second `pass` after the seat is no longer
        // active and produce an `invalid move` that has nothing to do with the bot.
        const endImpulse = board.locator('[data-testid="ie-pass"]').first();
        await expect(endImpulse).toBeVisible();
        await expect(endImpulse).toHaveText("结束行动轮");
        for (let attempt = 0; attempt < 4; attempt += 1) {
            if (await page.evaluate(() => (window as any).__IE_STATE__.activePower) !== "GE") break;
            await endImpulse.click({timeout: 5_000}).catch(() => undefined);
            await page.waitForTimeout(600);
        }
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

        // 3. Exactly one CP readout is on screen (the strip keeps a second,
        //    hidden one for phones).
        const cpReadouts = board.locator('[data-testid="ie-command-cp"]');
        expect(await cpReadouts.count()).toBeGreaterThan(0);
        const onScreen = await cpReadouts.evaluateAll((els) => els
            .filter((el) => (el as HTMLElement).checkVisibility({checkVisibilityCSS: true, checkOpacity: true})).length);
        expect(onScreen).toBe(1);
        await expect(cpReadouts.filter({visible: true}).first()).toContainText("CP");

        // 4. The panel's Log tab fits the same screen (it replaces the rail).
        await board.locator('[data-testid="ie-turn-tab-log"]').click();
        const logBox = (await board.locator('[data-testid="ie-log"]').boundingBox())!;
        expect(logBox.height).toBeGreaterThan(0);
        expect(logBox.y + logBox.height).toBeLessThanOrEqual(900);
        await board.locator('[data-testid="ie-turn-tab-action"]').click();

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
            // SVG labels are artwork, not body copy: the counters' "R"/"+N"
            // marks and the map names scale with the fit zoom, so their
            // computed size legitimately dips below 12 px on a smaller map
            // viewport (it did on the Linux runner while passing on macOS).
            // The audit is about UI text a reader must be able to read.
            const small = [...root.querySelectorAll("*")].filter((el) =>
                visible(el) && el.children.length === 0 && (el.textContent ?? "").trim().length > 0 &&
                el.closest(".ie-rule-ref") === null && el.closest("svg") === null &&
                parseFloat(getComputedStyle(el).fontSize) < 12);
            const inline = [...root.querySelectorAll("[style]")].filter((el) =>
                !svgTags.has(el.tagName.toLowerCase()));
            return {small: small.length, inline: inline.length};
        });
        expect(audit.small, "visible text under 12 px").toBe(0);
        expect(audit.inline, "inline styles outside SVG").toBe(0);
    });

    test("the card inspector shows every operation and switches between SVG and print faces", async ({page}) => {
        await reachAction(page);
        const board = boardFor(page, "GE");
        const card = await openCard(board.locator(".ie-hand .ie-card").first());
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
        // The display preference lives in the strip's menu, under its own
        // "显示" disclosure.
        await board.locator('[data-testid="ie-menu-toggle"]').click();
        await board.locator('[data-testid="ie-menu"] [data-testid="ie-display-menu"] > summary').click();
        await board.locator('[data-testid="ie-card-face-print"]').first().click();
        await expect.poll(async () => await page.evaluate(() => localStorage.getItem("ie_card_face"))).toBe("print");
        await card.locator(".ie-card-open").click();
        await expect(inspector).toHaveAttribute("data-face-mode", "print");
        await expect(inspector.locator('[data-testid="ie-card-inspector-image"]')).toBeVisible();
        await page.keyboard.press("Escape");

        // Leave the default in place for the rest of the suite.  The menu keeps
        // its own state, so open the display disclosure rather than assuming it.
        if (!(await board.locator('[data-testid="ie-menu"]').count())) await board.locator('[data-testid="ie-menu-toggle"]').click();
        const display = board.locator('[data-testid="ie-menu"] [data-testid="ie-display-menu"]');
        if (!(await display.evaluate((el) => (el as HTMLDetailsElement).open))) await display.locator("> summary").click();
        await board.locator('[data-testid="ie-card-face-svg"]').first().click();
        await expect.poll(async () => await page.evaluate(() => localStorage.getItem("ie_card_face"))).toBe("svg");
    });

    test("selecting a unit rings legal destinations and a ring click moves it", async ({page}) => {
        await reachAction(page);
        const board = boardFor(page, "GE");
        // A peacetime redeploy costs exactly 1 CP, so the impulse needs a card
        // banked for CP first; otherwise every ring would submit a move the
        // engine refuses and the unit would stay in Berlin.
        await expect(await playCpCard(board), "this deal has no card to bank CP with").toBe(true);

        await board.locator('[data-testid="ie-space-berlin"]').click({force: true});
        await expect(board.locator('[data-testid="ie-space-detail"]')).toContainText("柏林");

        // `__IE_STATE__` is a player view: `spaces.<id>.units` and `units` are
        // public, so the ids are the same on every seat's board.
        const unitId = await page.evaluate((): string | null => {
            const G = (window as any).__IE_STATE__;
            const ids: string[] = (G.spaces.berlin.units ?? []).filter((id: string) =>
                G.units[id]?.owner === "GE" && !G.units[id]?.naval);
            return ids[0] ?? null;
        });
        if (unitId === null) throw new Error("Berlin holds no German land unit to select");
        const before = await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining);

        // Selecting an own unit enters soft targeting by itself: no Orders
        // button is needed, and the rings name every engine-legal destination.
        await board.locator(`[data-testid="ie-unit-${unitId}"]`).click();
        await expect(board.locator('[data-testid="ie-mode-pill"]')).toBeVisible();
        await expect(board.locator('[data-testid="ie-mode-pill-targets"]')).toBeVisible();

        // The map publishes the ringed spaces in `data-targets`, and each ring
        // is drawn inside its own `ie-space-<id>` group.  Pick a target whose
        // ring centre still reaches the map itself, so a floating control (the
        // mode pill, the find button) cannot swallow the click.  Scoped to this
        // seat: the other five boards are mounted and draw their own maps.
        const destination = await board.evaluate((root): string | null => {
            const map = root.querySelector('[data-testid="ie-map"]');
            if (map === null) return null;
            for (const id of (map.getAttribute("data-targets") ?? "").split(",")) {
                if (id === "" || id === "berlin") continue;
                const ring = root.querySelector(`[data-testid="ie-space-${id}"] .ie-target-ring`);
                // A pending decision's ring is drawn too; clicking it would
                // answer the decision instead of moving the selected unit.
                if (ring === null || ring.classList.contains("ie-target-pending")) continue;
                const box = ring.getBoundingClientRect();
                const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
                if (hit === null || !map.contains(hit)) continue;
                return id;
            }
            return null;
        });
        if (destination === null) throw new Error(`no clickable legal destination ring for ${unitId}`);

        // One click on the ring is one map click: a single redeploy, one CP.
        const ring = board.locator(`[data-testid="ie-space-${destination}"] .ie-target-ring`);
        await expect(ring).toHaveCount(1);
        await ring.click({force: true});

        // One consistent snapshot: the unit is at the destination and no
        // longer in Berlin, so it really moved rather than being copied.
        await expect.poll(
            async () => await page.evaluate(({id, to}: {id: string; to: string}) => {
                const G = (window as any).__IE_STATE__;
                return {
                    space: G.units[id]?.space ?? null,
                    inBerlin: (G.spaces.berlin.units ?? []).includes(id),
                };
            }, {id: unitId, to: destination}),
            {message: `the unit moves from Berlin to the ringed space ${destination}`},
        ).toEqual({space: destination, inBerlin: false});
        // Poll the CP too: a just-moved state can be read from another seat's
        // view, and a one-shot read would race that view.
        await expect.poll(
            async () => await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining),
            {message: "a peacetime redeploy spends exactly 1 CP"},
        ).toBe(before - 1);
        await expect(board.locator('[data-testid="ie-mode-pill"]')).toHaveCount(0);
    });

    test("keyboard: arrows walk the legal targets and Enter moves the unit", async ({page}) => {
        await reachAction(page);
        const board = boardFor(page, "GE");
        await expect(await playCpCard(board), "this deal has no card to bank CP with").toBe(true);

        await board.locator('[data-testid="ie-space-berlin"]').click({force: true});
        const unitId = await page.evaluate(() => {
            const G = (window as any).__IE_STATE__;
            const ids: string[] = G.spaces.berlin.units.filter((id: string) =>
                G.units[id]?.owner === "GE" && !G.units[id]?.naval);
            return ids[0] ?? null;
        });
        expect(unitId).not.toBeNull();
        await board.locator(`[data-testid="ie-unit-${unitId}"]`).click();
        await expect(board.locator('[data-testid="ie-mode-pill"]')).toBeVisible();
        const before = await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining);

        // The map is one tab stop while legal targets exist; arrows move the
        // focused target (the space card tags it), Enter submits exactly what a
        // click would.
        const map = board.locator('[data-testid="ie-map"]');
        await expect(map).toHaveAttribute("tabindex", "0");
        await map.focus();
        await page.keyboard.press("ArrowRight");
        await expect(board.locator('[data-testid="ie-space-card-tag"]')).toContainText("聚焦目标");
        await page.keyboard.press("Enter");
        await expect.poll(async () => page.evaluate((id) => (window as any).__IE_STATE__.units[id]?.space, unitId))
            .not.toBe("berlin");
        expect(await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining)).toBe(before - 1);
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

// The dock is the phone shell: one bottom sheet holding the orders, hand, mat,
// log and war panes behind a single tab strip.  This project runs at 1440x900
// for the desktop shell, so the phone viewport is set for this block only.
test.describe("Imperial Elegy mobile drawer", () => {
    test.use({viewport: {width: 390, height: 844}});

    const dockFor = (page: Page, seat = "GE") =>
        boardFor(page, seat).locator('[data-testid="ie-mobile-dock"]');
    const heightOf = async (locator: Locator) => (await locator.boundingBox())!.height;
    // Heights follow a state flip and may animate, so a single sample can catch
    // the sheet mid-flight.  Wait for two identical samples that are already
    // inside the expected range before returning the height.
    const settledHeight = async (page: Page, locator: Locator, within: (height: number) => boolean) => {
        let previous = -1;
        for (let attempt = 0; attempt < 60; attempt += 1) {
            const height = await heightOf(locator);
            if (height === previous && within(height)) return height;
            previous = height;
            await page.waitForTimeout(50);
        }
        throw new Error(`the dock height never settled in range (last ${previous}px)`);
    };

    test("starts closed on Orders with the map visible above the peek bar", async ({page}) => {
        await openLocal(page);
        const board = boardFor(page, "GE");
        const dock = dockFor(page);
        await expect(dock).toBeVisible();

        // Closed: only the tab strip is on screen and Orders is the default tab.
        await expect(dock).toHaveAttribute("data-open", "false");
        await expect(dock).toHaveAttribute("data-tab", "orders");
        await expect(dock).not.toHaveAttribute("data-expanded", "true");
        const peek = await settledHeight(page, dock, (height) => height >= 40 && height <= 80);
        expect(peek).toBeGreaterThanOrEqual(40);
        expect(peek).toBeLessThanOrEqual(80);

        // The sheet is pinned to the bottom edge and the map owns the screen
        // above it; the sheet never overflows the 844 px viewport.
        const dockBox = (await dock.boundingBox())!;
        expect(dockBox.y).toBeGreaterThan(0);
        expect(dockBox.y + dockBox.height).toBeLessThanOrEqual(844 + 1);
        await expect(board.locator('[data-testid="ie-map"]')).toBeVisible();
        // The map keeps a band at least 100 px tall above the sheet, and the
        // middle of that band hits the map rather than the sheet (whether the
        // sheet is laid out under the map or floats over its bottom edge).
        const mapBand = async () => await board.evaluate((root) => {
            const dockNode = root.querySelector('[data-testid="ie-mobile-dock"]') as HTMLElement | null;
            const mapNode = root.querySelector('[data-testid="ie-map"]') as HTMLElement | null;
            if (dockNode === null || mapNode === null) return {height: 0, hitsMap: false};
            const sheet = dockNode.getBoundingClientRect();
            const map = mapNode.getBoundingClientRect();
            const top = Math.max(map.top, 0);
            const bottom = Math.min(map.bottom, sheet.top, innerHeight);
            const hit = document.elementFromPoint(map.left + map.width / 2, (top + bottom) / 2);
            return {height: bottom - top, hitsMap: hit !== null && mapNode.contains(hit)};
        });
        await expect.poll(async () => (await mapBand()).hitsMap).toBe(true);
        expect((await mapBand()).height).toBeGreaterThan(100);

        // `data-decision` gates the closed sheet's one-line decision peek: no
        // decision is owed when the match opens, so no peek row is shown.
        const decision = await dock.getAttribute("data-decision");
        expect(decision, "the dock publishes its decision state").not.toBeNull();
        const decisionPeek = dock.locator('[data-testid="ie-mobile-decision-peek"]');
        if (decision === "true") await expect(decisionPeek).toBeVisible();
        else await expect(decisionPeek).toBeHidden();
    });

    test("the Hand tab opens the sheet and every tab shows its own pane", async ({page}) => {
        await openLocal(page);
        const dock = dockFor(page);
        const body = dock.locator('[data-testid="ie-mobile-body"]');

        // Hand: the closed bar's tab strip opens the sheet onto the cards, at
        // half height so the map keeps the top of the screen.
        await expect(dock).toHaveAttribute("data-open", "false");
        await dock.locator('[data-testid="ie-mobile-tab-hand"]').click();
        await expect(dock).toHaveAttribute("data-open", "true");
        await expect(dock).toHaveAttribute("data-tab", "hand");
        const half = await settledHeight(page, dock, (height) => height > 100 && height < 844 * 0.55);
        expect(half).toBeGreaterThan(100);
        expect(half).toBeLessThan(844 * 0.55);
        await expect(body.locator(".ie-hand .ie-card").first()).toBeVisible();
        // The decision peek belongs to the closed sheet only.
        await expect(dock.locator('[data-testid="ie-mobile-decision-peek"]')).toBeHidden();

        // Mat: the player mat's figure readouts (the grid, a single figure or
        // the phone chip row carries the same numbers).
        await dock.locator('[data-testid="ie-mobile-tab-mat"]').click();
        await expect(dock).toHaveAttribute("data-tab", "mat");
        const mat = body.locator('[data-testid="ie-mat"]');
        await expect(mat).toBeVisible();
        await expect.poll(async () => await mat.evaluate((el) => [...el.querySelectorAll(
            '[data-testid="ie-mat-figures"], [data-testid="ie-mat-stability"], [data-testid="ie-mat-chips"]',
        )].some((node) => (node as HTMLElement).checkVisibility({checkVisibilityCSS: true, checkOpacity: true})))).toBe(true);

        // Log: the public history, full width of the sheet.
        await dock.locator('[data-testid="ie-mobile-tab-log"]').click();
        await expect(dock).toHaveAttribute("data-tab", "log");
        await expect(body.locator('[data-testid="ie-log"]')).toBeVisible();

        // Orders: the turn panel's action pane (the phase buttons).
        await dock.locator('[data-testid="ie-mobile-tab-orders"]').click();
        await expect(dock).toHaveAttribute("data-tab", "orders");
        await expect(body.locator('[data-testid="ie-turn-panel-action"]')).toBeVisible();

        // The War tab only exists while a war or the Great War is running; a
        // fresh match has neither, and no assertion is needed when it is absent.
        const warTab = dock.locator('[data-testid="ie-mobile-tab-war"]');
        if (await warTab.count() > 0) {
            const warRunning = await page.evaluate(() => {
                const G = (window as any).__IE_STATE__;
                return Boolean(G.war || G.gw);
            });
            expect(warRunning, "a War tab is only offered while a war is running").toBe(true);
        }
    });

    test("expand grows the sheet to full and the toggle folds it back to peek", async ({page}) => {
        await openLocal(page);
        const dock = dockFor(page);

        // Start from the half sheet, opened through the tab strip.
        await dock.locator('[data-testid="ie-mobile-tab-hand"]').click();
        await expect(dock).toHaveAttribute("data-open", "true");
        await expect(dock).toHaveAttribute("data-tab", "hand");
        const half = await settledHeight(page, dock, (height) => height > 100 && height < 844 * 0.55);
        expect(half).toBeGreaterThan(100);
        expect(half).toBeLessThan(844 * 0.55);

        // Full: the expand control in the sheet head grows it beyond half while
        // staying inside the viewport.
        await dock.locator('[data-testid="ie-mobile-expand"]').click();
        await expect(dock).toHaveAttribute("data-expanded", "true");
        const full = await settledHeight(page, dock, (height) => height > half);
        expect(full).toBeGreaterThan(half);
        const fullBox = (await dock.boundingBox())!;
        expect(fullBox.y).toBeGreaterThanOrEqual(0);
        expect(fullBox.y + fullBox.height).toBeLessThanOrEqual(844 + 1);

        // A second press returns the sheet to the half position (a few pixels
        // of slack absorbs sub-pixel rounding, not a different height).
        await dock.locator('[data-testid="ie-mobile-expand"]').click();
        await expect(dock).not.toHaveAttribute("data-expanded", "true");
        await settledHeight(page, dock, (height) => Math.abs(height - half) <= 5);

        // The toggle closes the sheet back to the peek bar instead of hiding
        // the dock: the tab strip stays available for the next tap.
        await dock.locator('[data-testid="ie-mobile-toggle"]').click();
        await expect(dock).toHaveAttribute("data-open", "false");
        const peek = await settledHeight(page, dock, (height) => height >= 40 && height < 80);
        expect(peek).toBeGreaterThanOrEqual(40);
        expect(peek).toBeLessThan(80);
    });

    // A phone has no Esc key, so the ✕ is the only way out of the reference.
    // The drawer is a fixed overlay whose head sat under the page's sticky app
    // bar (z-index 1100), which swallowed the click on the ✕ at every width;
    // on a phone, where the drawer is the full width, that trapped the reader
    // on the reference panel with no way back to the board.
    test("the reference drawer's close button is clickable and closes it", async ({page}) => {
        await openLocal(page);
        const board = boardFor(page, "GE");
        await board.locator('[data-testid="ie-open-reference"]').click();
        const drawer = board.locator('[data-testid="ie-reference-drawer"]');
        await expect(drawer).toBeVisible();

        // Clicking the ✕ must reach it: a covering element makes this throw.
        await board.locator('[data-testid="ie-reference-close"]').click();
        await expect(drawer).toBeHidden();

        // The same head holds the chart lightbox's close; it must work too.
        await board.locator('[data-testid="ie-open-reference"]').click();
        await expect(drawer).toBeVisible();
        await board.locator(".ie-chart-open").first().click();
        const lightbox = board.locator('[data-testid="ie-chart-lightbox"]');
        await expect(lightbox).toBeVisible();
        await board.locator('[data-testid="ie-chart-close"]').click();
        await expect(lightbox).toHaveCount(0);
        await board.locator('[data-testid="ie-reference-close"]').click();
        await expect(drawer).toBeHidden();
    });
});
