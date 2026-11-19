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
 * Click a map space and wait for its detail panel to name it.
 *
 * The map sits under the hand tray, and playing a card folds/refolds that row,
 * which moves the SVG between the click and its dispatch.  `force: true` skips
 * Playwright's stability wait, so a single click can land on the space that
 * used to be under the cursor.  Retrying until the panel actually names the
 * space removes that race without hiding a real failure: the final attempt
 * still asserts.
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

/**
 * Give GE a CP budget by playing its first legal card for CP.
 *
 * Returns false when no card was playable (an impulse that cannot use a card at
 * all); callers that need the card must assert on the result.  Arm-then-confirm
 * is the default: the first click arms, the second plays.
 *
 * A plain event card is preferred: every card is a CP card (12.0), but a
 * mandatory event played for CP also resolves its printed text, which can open
 * a decision or move the map under the caller's next click.  The helper still
 * falls back to any other playable card so a deal without a plain event can
 * bank CP instead of skipping the test.
 *
 * The hand starts folded while a decision is owed (`decisionPeek`), and a
 * folded tray renders no card bodies at all.  The action phase can open with
 * another seat's bot decision still live (33.4 Metternich, answered by AU), so
 * the helper waits for the tray to carry cards before deciding there is none.
 */
async function playCpCard(board: Locator): Promise<boolean> {
    const page = board.page();
    const cards = board.locator(".ie-hand .ie-card");
    // Give the tray a moment to unfold and render: a bot decision from the
    // previous phase is answered asynchronously and hides the cards until then.
    await expect.poll(async () => await cards.count(), {timeout: 30_000}).toBeGreaterThan(0);
    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining) > 0) return true;
        // Arm-then-confirm: the first click arms (`data-armed`), the second
        // plays.  Addressed by test id because the armed label replaces the
        // text a name filter matches.  Each row opens the inspector, which is
        // where a card's buttons live; a plain event card is preferred so the
        // play does not resolve printed text under the next click.
        const order: number[] = [];
        const events: number[] = [];
        for (let i = 0; i < await cards.count(); i += 1) {
            const type = await cards.nth(i).getAttribute("data-card-type");
            (type === "event" ? events : order).push(i);
        }
        let played = false;
        for (const i of [...events, ...order]) {
            await openCard(cards.nth(i));
            const inspector = board.locator('[data-testid="ie-card-inspector"]');
            const button = inspector.locator('[data-testid^="ie-play-cp-"]').first();
            if (!(await button.count()) || !(await button.isEnabled())) {
                await page.keyboard.press("Escape");
                await expect(inspector).toHaveCount(0);
                continue;
            }
            await button.click();
            await expect(button).toHaveAttribute("data-armed", "true");
            await button.click();
            played = true;
            break;
        }
        if (!played) return false;
        try {
            await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining), {timeout: 5_000}).toBeGreaterThan(0);
            // The played card leaves the hand, and the inspector closes itself
            // once its card is gone.  Wait for that: its full-screen backdrop
            // would otherwise swallow the next map click (`force: true`
            // dispatches at a point, not to the element under the selector).
            const inspector = board.locator('[data-testid="ie-card-inspector"]');
            if (await inspector.count() > 0) await page.keyboard.press("Escape");
            await expect(inspector).toHaveCount(0);
            return true;
        } catch {
            await page.waitForTimeout(300);
        }
    }
    return await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining) > 0;
}

/** Open a hand card's inspector (one tap on the row). */
async function openCard(card: Locator): Promise<Locator> {
    await card.locator(".ie-card-open").click();
    return card;
}

/**
 * The action cards that exist only as reconstructed text cards.
 *
 * The module has no face image for card 21 (its slot holds a duplicate of 27)
 * or card 82, so the print-face assertion has to address a card that really has
 * a scan.  The hand is a folded list in printed order, so hand slot 0 can be one
 * of these.
 */
const TEXT_ONLY_CARDS = ["IE-A021", "IE-A082"];

/** First hand card in `board` that has a printed scan. */
async function firstCardWithPrintFace(board: Locator): Promise<Locator> {
    const cards = board.locator(".ie-hand .ie-card");
    for (let i = 0; i < await cards.count(); i += 1) {
        const card = cards.nth(i);
        const testId = await card.getAttribute("data-testid");
        if (testId !== null && TEXT_ONLY_CARDS.some((id) => testId.endsWith(id))) continue;
        return card;
    }
    throw new Error("no hand card has a printed face image");
}

/** Find a hand card whose Save control is enabled (non-home, non-mandatory). */
async function findSavableCard(board: Locator): Promise<Locator | null> {
    const page = board.page();
    const cards = board.locator(".ie-hand .ie-card");
    for (let i = 0; i < await cards.count(); i += 1) {
        const card = await openCard(cards.nth(i));
        // Every operation (play, Save, Industrialize, CP chain) lives in the
        // CardInspector, which the row opens.
        const inspector = board.locator('[data-testid="ie-card-inspector"]');
        const save = inspector.getByRole("button", {name: "保留", exact: true});
        const found = await save.count() > 0 && await save.isEnabled();
        await page.keyboard.press("Escape");
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

/**
 * `finishPrep` / `chooseHomeCards` for the phone shell.
 *
 * At 390 px the dock starts closed and a closed sheet hides its body
 * (`[data-open="false"] .ie-mobile-body { display: none }`), so the prep and
 * home-card buttons inside the Orders pane are not clickable until the sheet is
 * opened.  The sheet keeps its position across a seat switch (the `data-tab`
 * and `data-open` state live per mounted board), so one open per board is
 * enough — but every seat is its own board, so sweep them the same way the
 * desktop helpers do, opening the sheet first.
 */
async function openDock(page: Page, seat: string) {
    const dock = boardFor(page, seat).locator('[data-testid="ie-mobile-dock"]');
    if (await dock.getAttribute("data-open") !== "true") {
        await dock.locator('[data-testid="ie-mobile-tab-orders"]').click();
    }
    await expect(dock).toHaveAttribute("data-open", "true");
}

/**
 * A decision or a required card choice is a dialog over the board, so its
 * backdrop covers the dock: the sheet must not be opened first.  Return the
 * dialog when one is up, or `null` when the choice (if any) lives in the sheet
 * body.
 */
async function phoneDialog(page: Page, seat: string): Promise<Locator | null> {
    const board = boardFor(page, seat);
    for (const testId of ["ie-decision-modal", "ie-choice-modal"]) {
        const dialog = board.locator(`[data-testid="${testId}"]`);
        if (await dialog.count() > 0 && await dialog.isVisible()) return dialog;
    }
    return null;
}

async function phoneFinishPrep(page: Page) {
    for (const seat of SEATS) {
        await focusSeat(page, seat);
        await openDock(page, seat);
        const board = boardFor(page, seat);
        const ready = board.getByRole("button", {name: "准备完毕"}).first();
        await expect(ready).toBeVisible({timeout: 15_000});
        await clickUntilGone(page, ready);
    }
}

async function phoneChooseHomeCards(page: Page) {
    for (const seat of SEATS) {
        await focusSeat(page, seat);
        const board = boardFor(page, seat);
        // The home card is a dialog: it is up without the sheet being opened,
        // and its backdrop would swallow a tap on the dock.
        const dialog = board.locator('[data-testid="ie-choice-modal"]');
        if (await dialog.count() > 0 && await dialog.isVisible()) {
            const choose = dialog.locator('[data-testid^="ie-choose-home-"]').first();
            await clickUntilGone(page, choose);
            continue;
        }
        await openDock(page, seat);
        const choose = board.locator('[data-testid^="ie-choose-home-"]').first();
        await expect(choose).toBeVisible({timeout: 15_000});
        await clickUntilGone(page, choose);
    }
    await phoneAnswerStartPending(page);
}

/** `answerStartPending`, opening the seat's dock before reaching into it. */
async function phoneAnswerStartPending(page: Page) {
    for (let round = 0; round < 6; round += 1) {
        let answered = false;
        for (const seat of SEATS) {
            await focusSeat(page, seat);
            // A decision this seat owes is a dialog over the dock; another
            // seat's is the read-only panel inside the sheet.
            const dialog = await phoneDialog(page, seat);
            if (dialog === null) await openDock(page, seat);
            const pending = boardFor(page, seat).locator('[data-testid="ie-pending"]');
            const options = pending.locator("button");
            if (!(await options.count())) continue;
            const before = await page.evaluate(() => (window as any).__IE_STATE__?.pending?.id ?? null);
            await options.first().click();
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

/**
 * `playCpCard` for the phone: the hand rows only exist in the Hand pane, so
 * the sheet has to be switched over before the first row can be opened.
 */
async function phonePlayCpCard(page: Page, board: Locator): Promise<boolean> {
    const dock = board.locator('[data-testid="ie-mobile-dock"]');
    if (await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining) > 0) return true;
    await dock.locator('[data-testid="ie-mobile-tab-hand"]').click();
    await expect(dock).toHaveAttribute("data-tab", "hand");
    const played = await playCpCard(board);
    await dock.locator('[data-testid="ie-mobile-tab-orders"]').click();
    await expect(dock).toHaveAttribute("data-tab", "orders");
    return played;
}

/** `reachAction` for the phone: the same flow, dock opened for every seat. */
async function phoneReachAction(page: Page) {
    await openLocal(page);
    await phoneFinishPrep(page);
    await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("diplomacy");
    await phoneChooseHomeCards(page);
    await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("action");
    await focusSeat(page, "GE");
    await openDock(page, "GE");
    await expect(boardFor(page, "GE").locator('[data-testid="ie-pass"]')).toBeVisible({timeout: 15_000});
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

    test("the War panel declares a war without a map click", async ({page}) => {
        await reachAction(page);
        const board = boardFor(page, "GE");
        await playCpCard(board);

        // The War body is always present and is where a declaration is made.
        // No space is selected: defender, aim and objective are picked inside
        // the panel.
        await board.locator('[data-testid="ie-turn-tab-war"]').click();
        const declare = board.locator('[data-testid="ie-war-declare"]');
        await expect(declare).toBeVisible();
        await expect(declare.locator('[data-testid="ie-war-declare-defender"]')).toBeVisible();

        await declare.locator('[data-testid="ie-war-declare-defender"]').selectOption("AU");
        await declare.locator('[data-testid="ie-war-declare-objective"]').selectOption("bohemia");
        // Use the smallest budget so the declaration is legal with any CP card.
        await declare.locator('[data-testid="ie-war-declare-cp"]').selectOption("1");

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

        // The war panel is the turn panel's War tab, and declaring a war brings
        // it to the front by itself: the player must not have to hunt for the
        // tab after the declaration (reported as "俾斯麦选择目标之后没有开启战争
        // 界面").  Assert the tab is already selected before clicking anything.
        await expect(board.locator('[data-testid="ie-turn-tab-war"]')).toHaveAttribute("aria-selected", "true");
        const war = board.locator('[data-testid="ie-war"]');
        await expect(war).toBeVisible();
        await expect(war).toContainText("波希米亚");
        await expect(war.getByRole("button", {name: "征服"})).toBeVisible();
        await expect(war.getByRole("button", {name: "解放"})).toBeVisible();
        await expect(war.getByRole("button", {name: "统一"})).toBeVisible();
        await expect(war.getByRole("button", {name: "开始机动"})).toBeVisible();
        await expect(war.getByRole("button", {name: "召唤盟友"})).toBeVisible();
    });

    test("the Bismarck event opens the War panel's declaration and declares unification", async ({page}) => {
        await openLocal(page);
        await finishPrep(page);
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("diplomacy");
        // GE must pick Bismarck itself; the other seats keep the first choice.
        for (const seat of SEATS) {
            await focusSeat(page, seat);
            const board = boardFor(page, seat);
            const choose = seat === "GE"
                ? board.locator('[data-testid="ie-choose-home-IE-H-GE-1"]')
                : board.locator('[data-testid^="ie-choose-home-"]').first();
            await expect(choose).toBeVisible({timeout: 15_000});
            await clickUntilGone(page, choose);
        }
        await answerStartPending(page);
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.phase)).toBe("action");
        await focusSeat(page, "GE");
        const board = boardFor(page, "GE");

        // Play the home card as its event.  The card leaves the hand and the
        // declaration entitlement is granted; the War panel comes to the front
        // by itself, because that is where the declaration is completed.
        const card = board.locator('[data-testid="ie-card-IE-H-GE-1"]');
        await expect(card).toBeVisible({timeout: 15_000});
        await card.locator(".ie-card-open").click();
        const inspector = board.locator('[data-testid="ie-card-inspector"]');
        const event = inspector.locator('[data-testid="ie-play-event-IE-H-GE-1"]');
        await expect(event).toBeEnabled({timeout: 10_000});
        await event.click();
        await expect(event).toHaveAttribute("data-armed", "true");
        await event.click();
        await expect(inspector).toHaveCount(0, {timeout: 10_000});

        // No chooser dialog and no map click: the form itself carries the
        // card's locked aim and printed CP.
        await expect(board.locator('[data-testid="ie-war-target-dialog"]')).toHaveCount(0);
        await expect(board.locator('[data-testid="ie-turn-tab-war"]')).toHaveAttribute("aria-selected", "true", {timeout: 15_000});
        const declare = board.locator('[data-testid="ie-war-declare"]');
        await expect(declare).toBeVisible();
        await expect(declare.locator('[data-testid="ie-war-declare-aim-locked"]')).toContainText("统一");
        await expect(declare.locator('[data-testid="ie-war-declare-cp-locked"]')).toContainText("3 CP");

        // Both a player power and an independent minor are offered.  Alsace-
        // Lorraine is the French-held German objective: a unification war on
        // France.
        const defender = declare.locator('[data-testid="ie-war-declare-defender"]');
        await expect(defender.locator('option[value="FR"]')).toHaveCount(1);
        await expect(defender.locator('option[value="minor:Denmark"]')).toHaveCount(1);
        await defender.selectOption("FR");
        await declare.locator('[data-testid="ie-war-declare-objective"]').selectOption("alsace-lorraine");

        // Confirmed twice (arm, then declare).
        const button = declare.locator('[data-testid="ie-declare-war"]');
        await expect(button).toBeEnabled({timeout: 10_000});
        await button.click();
        await expect(button).toHaveAttribute("data-armed", "true");
        await button.click();
        await expect.poll(async () => await page.evaluate(() => {
            const G = (window as any).__IE_STATE__;
            return G.war === null
                ? null
                : {attacker: G.war.attacker, defender: G.war.defender, aim: G.war.warAim, objectives: G.war.objectives};
        })).toEqual({attacker: "GE", defender: "FR", aim: "unification", objectives: ["alsace-lorraine"]});

        // The declaration reached the war screen without a manual tab switch:
        // that missing hand-off is the reported bug ("俾斯麦选择目标之后没有开启
        // 战争界面").
        await expect(board.locator('[data-testid="ie-war"]')).toBeVisible({timeout: 15_000});
        await expect(board.locator('[data-testid="ie-turn-tab-war"]')).toHaveAttribute("aria-selected", "true");
    });

    test("card economy controls render on the row and Save toggles the card state", async ({page}) => {
        await reachAction(page);
        const board = boardFor(page, "GE");

        const card = await findSavableCard(board);
        expect(card).not.toBeNull();
        // On a desktop the row itself carries the economy controls; the
        // inspector repeats them.  Play the Save from the row, then confirm the
        // inspector shows the same state.
        const rowActions = card!.locator(".ie-card-row-actions");
        await expect(rowActions).toBeVisible();
        const save = rowActions.getByRole("button", {name: "保留", exact: true});
        const industrialize = rowActions.getByRole("button", {name: "工业化", exact: true});
        const cpChain = rowActions.getByRole("button", {name: "CP 链", exact: true});

        await expect(save).toBeVisible();
        await expect(industrialize).toBeVisible();
        await expect(cpChain).toBeVisible();
        await expect(save).toBeEnabled();
        await expect(industrialize).toBeEnabled();
        await expect(cpChain).toBeEnabled();
        await expect(save).toHaveAttribute("aria-pressed", "false");

        await save.click();
        await expect(board.locator(".ie-hand-meta")).toContainText("已保留的牌");

        // The inspector tells the same story: the same card reads 取消保留.
        await openCard(card!);
        const inspector = board.locator('[data-testid="ie-card-inspector"]');
        await expect(inspector).toBeVisible();
        const unsave = inspector.getByRole("button", {name: "取消保留", exact: true});
        await expect(unsave).toBeVisible();
        await expect(unsave).toHaveAttribute("aria-pressed", "true");
        await page.keyboard.press("Escape");
        await expect(inspector).toHaveCount(0);
    });

    test("MPIT matrix renders and the GW panel is conditionally present", async ({page}) => {
        await reachAction(page);
        const board = boardFor(page, "GE");

        // The MPIT matrix is an Orders action (8.0): it is in the turn panel
        // with the other things the player may do this impulse, not in the
        // reference drawer.  It has its own page of the Orders panel, so the
        // matrix is not competing with the space's action list.
        await board.locator('[data-testid="ie-orders-tab-influence"]').click();
        const mpit = board.locator('[data-testid="ie-mpit"]');
        await expect(board.getByText(/MPIT · 影响力轨/).first()).toBeVisible();
        await expect(mpit).toBeVisible();
        await expect(mpit.locator(".ie-mpit-cell")).toHaveCount(6);
        await expect(mpit).toContainText("TE");
        await expect(mpit).toContainText("TA");
        await expect(mpit).toContainText("中立");

        const mpitControls = board.locator('[data-testid="ie-mpit-controls"]');
        await expect(mpitControls).toBeVisible();
        // The matrix is the control: no target/track dropdowns, and one
        // placement button per power and track (6 x 3).
        await expect(mpit.locator("select")).toHaveCount(0);
        const placeButtons = mpit.getByTestId(/^ie-mpit-place-/);
        await expect(placeButtons).toHaveCount(18);
        await expect(placeButtons.first()).toBeVisible();

        // A placement is one button, armed-then-confirmed like every other
        // irreversible action: click the value that will change.
        expect(await playCpCard(board)).toBe(true);
        const before = await page.evaluate(() => (window as any).__IE_STATE__.powers.GE.mpit.te);
        const placeGeTe = mpit.getByTestId("ie-mpit-place-GE-te");
        await placeGeTe.click();
        await expect(placeGeTe).toHaveAttribute("data-armed", "true");
        await placeGeTe.click();
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.powers.GE.mpit.te)).toBe(before + 1);

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
        // Scope to the bot-seat list: the setup screen also carries round B's
        // Scenario 4 "No GW" checkbox (and any future setup toggle), so reading
        // every checkbox on the page would make this fixture depend on them.
        const checked = await page.getByTestId("ie-local-bot-seats").locator("input[type=checkbox]").evaluateAll(
            (boxes) => boxes.map((box) => (box as HTMLInputElement).checked),
        );
        expect(checked).toEqual([false, true, true, true, true, true]);

        // Any seat can be chosen, not only the tail: the setup lists a checkbox
        // per power and each one names who plays the seat.
        for (const power of ["GE", "UK", "FR", "AU", "RU", "OT"]) {
            await expect(page.getByTestId(`ie-local-bot-${power}`)).toBeVisible();
        }
        await expect(page.getByTestId("ie-local-bot-GE")).not.toBeChecked();
        await expect(page.getByTestId("ie-local-bot-OT")).toBeChecked();
        // Flipping the FIRST seat to a bot is the case the old tail-only default
        // could never produce.
        await page.getByTestId("ie-local-bot-GE").check();
        await expect(page.getByTestId("ie-local-bot-GE")).toBeChecked();
        await expect(page.getByTestId("ie-local-seat-summary")).toContainText("机器人 6");
        // Flipping it back leaves the human seat again.
        await page.getByTestId("ie-local-bot-GE").uncheck();
        await expect(page.getByTestId("ie-local-seat-summary")).toContainText("玩家 1");

        await start.click();
        await expect(page.locator('[data-testid="ie-seat-GE"]')).toBeVisible();

        // A bot seat drives itself, so the person at the keyboard may only watch.
        await page.getByRole("tab", {name: /P3/}).click();
        const botBoard = page.locator('[data-testid="ie-seat-FR"]');
        await expect(botBoard.locator(".ie-bot-banner")).toContainText("机器人");
        // Icon-only controls (the reference drawer's close) carry their name in
        // aria-label rather than in text, so read both.
        const clickable = await botBoard
            .locator(".ie-btn, .ie-card-actions button")
            .evaluateAll((buttons) => buttons
                .filter((button) => !(button as HTMLButtonElement).disabled)
                .map((button) => (button.getAttribute("aria-label") ?? button.textContent ?? "").trim()));
        // A bot seat has nothing to act with: the only controls it carries are
        // the drawer's close button and the Rule 34 take-back button.
        expect(clickable).toEqual(["收回席位", "关闭参考"]);

        // Rule 34 handover: the seat can be taken back and handed over again
        // without restarting the match.  Both flips are engine moves, so the
        // public `G.bots` list changes and the seat strip follows.
        await botBoard.getByTestId("ie-take-back-seat").click();
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.bots))
            .not.toContain("FR");
        await expect(botBoard.locator(".ie-bot-banner")).toHaveCount(0);
        await expect(page.locator('[data-testid="ie-seat-status-FR"]')).not.toContainText("机器人");
        await botBoard.getByTestId("ie-hand-over-seat").click();
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__.bots))
            .toContain("FR");
        await expect(botBoard.locator(".ie-bot-banner")).toContainText("机器人");
    });

    test("the scenario picker sets the printed setup of a hotseat match", async ({page}) => {
        // The playbook prints eight scenario setups (`IE_playbook.pdf` pp. 3-10)
        // and Scenario 4's "No GW" modifier.  The hotseat entrance offers them
        // and the chosen one must reach the engine: `Local()` never forwards
        // `setupData`, so a broken wiring here would silently play the campaign.
        const errors: string[] = [];
        page.on("console", (message) => {
            if (message.type() === "error") errors.push(message.text());
        });
        await page.goto("/localIE?solo=1");
        const select = page.getByTestId("ie-local-scenario");
        await expect(select).toBeVisible();
        // Every printed scenario is offered, in printed order.
        const options = await select.locator("option").evaluateAll(
            (nodes) => nodes.map((node) => (node as HTMLOptionElement).value),
        );
        expect(options).toEqual([
            "campaign",
            "tutorial1850",
            "s1870",
            "s1880",
            "gwTutorial",
            "altGw1",
            "altGw2",
            "altGw3",
        ]);
        // Scenario 4 is a modifier beside the picker, not a ninth option.
        await expect(page.getByTestId("ie-local-no-gw")).toBeVisible();

        // 1870: four turns starting at turn 3 (1870s).
        await select.selectOption("s1870");
        await expect(page.getByTestId("ie-local-scenario-summary")).toContainText("3-6");
        await page.getByTestId("ie-start-match").click();
        await expect(page.locator('[data-testid="ie-seat-GE"]')).toBeVisible();
        await expect.poll(async () => await page.evaluate(() => (window as any).__IE_STATE__?.scenario)).toBe("s1870");
        expect(await page.evaluate(() => (window as any).__IE_STATE__?.turn)).toBe(3);
        expect(await page.evaluate(() => (window as any).__IE_STATE__?.wtt)).toBe(1);
        // The 1870 display prints a different position, so a campaign marker must
        // not survive: FR starts with one City of Light point (the campaign
        // starts at 0) and Suez is printed complete (`persistent.suezCanal`).
        // `removed` itself is redacted by `playerView`; the public
        // `removedCount` is what a client may assert on.
        expect(await page.evaluate(() => (window as any).__IE_STATE__.powers.FR.cityOfLight)).toBe(1);
        expect(await page.evaluate(() => (window as any).__IE_STATE__.persistent.suezCanal)).toBe(true);
        // The 1870 print removes 8 cards.
        expect(await page.evaluate(() => (window as any).__IE_STATE__.removedCount)).toBe(8);
        expect(errors).toEqual([]);
    });

    test("a bot seat takes its impulse instead of stalling on an illegal move", async ({page}) => {
        // This case walks a whole turn: prep, home cards, one CP play, the
        // hand-over and then two bot impulses.  The default 60 s budget left the
        // final log poll (45 s) unreachable, so a slow runner failed on the
        // clock rather than on the behaviour it guards.
        test.setTimeout(150_000);
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
        // card.  Since 12.0 makes every card a CP card, `playCpCard` only fails
        // when the seat's hand is empty — a state the bot-transition bug cannot
        // hide, because the guard needs a played card as its precondition.
        const played = await playCpCard(board);
        test.skip(!played, "this seat has no card in hand to play");
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

        // 6. Every map-key swatch is a different colour.  "attack" and "rail"
        //    used to fall through to the same brass default, so two different
        //    targets were drawn identically; the stylesheet now gives each
        //    style its own swatch.
        const swatches = await board.locator(".ie-map-key .ie-key").evaluateAll((nodes) => nodes.map((node) => {
            const style = getComputedStyle(node, "::before");
            return `${style.borderTopColor}|${style.borderTopStyle}|${style.borderTopWidth}`;
        }));
        expect(swatches.length).toBeGreaterThanOrEqual(3);
        expect(new Set(swatches).size).toBe(swatches.length);
    });

    test("the printed player display closes with Esc and with the ✕", async ({page}) => {
        await openLocal(page);
        const board = boardFor(page, "GE");
        const display = board.locator('[data-testid="ie-mat-display"]');
        const drawer = board.locator('[data-testid="ie-reference-drawer"]');
        const lightbox = board.locator('[data-testid="ie-chart-lightbox"]');

        await display.click();
        await expect(lightbox).toBeVisible();
        await expect(lightbox).toHaveAttribute("data-chart", "display-ge");

        await page.keyboard.press("Escape");
        await expect(lightbox).toHaveCount(0);
        // Closing the chart leaves the reference drawer it was opened from;
        // its own ✕ still takes the reader back to the board.
        await expect(drawer).toBeVisible();
        await board.locator('[data-testid="ie-reference-close"]').click();
        await expect(drawer).toBeHidden();

        // The same chart's ✕ closes it too, without the effect opening it again.
        await display.click();
        await expect(lightbox).toBeVisible();
        await board.locator('[data-testid="ie-chart-close"]').click();
        await expect(lightbox).toHaveCount(0);
        await board.locator('[data-testid="ie-reference-close"]').click();
        await expect(drawer).toBeHidden();
    });

    test("the card inspector shows every operation and switches between SVG and print faces", async ({page}) => {
        await reachAction(page);
        const board = boardFor(page, "GE");
        const card = await openCard(await firstCardWithPrintFace(board));

        const inspector = board.locator('[data-testid="ie-card-inspector"]');
        await expect(inspector).toBeVisible();
        await expect(inspector).toHaveAttribute("data-face-mode", "svg");
        await expect(inspector.locator("svg.ie-card-face")).toBeVisible();
        // The printed scan is a folded reference: no image is fetched until a
        // reader asks for it, and the default text stays in the chosen language.
        const original = inspector.locator('[data-testid="ie-card-inspector-original"]');
        await expect(original).toBeVisible();
        expect(await original.evaluate(el => (el as HTMLDetailsElement).open)).toBe(false);
        await expect(original.locator("img")).toHaveCount(0);
        await original.locator("summary").click();
        expect(await original.evaluate(el => (el as HTMLDetailsElement).open)).toBe(true);
        await expect(original.locator('[data-testid="ie-card-inspector-original-image"]')).toBeVisible();
        // CP, event, industrialize, CP chain and save are all offered in place.
        expect(await inspector.locator(".ie-card-inspector-actions button").count()).toBeGreaterThanOrEqual(5);
        // A fully playable card has no aggregated reasons; a blocked one does.
        const unavailable = inspector.locator('[data-testid="ie-card-inspector-unavailable"]');
        if (await unavailable.count() > 0) await expect(unavailable).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(inspector).toHaveCount(0);

        // Switch the face preference, reopen, and see the scanned image.
        // The display preference lives in the strip's menu, under its own
        // "显示" disclosure.  The toggle writes React state, so wait for the
        // stored preference *and* for the reopened inspector to report print
        // mode before asking for the scan.
        await board.locator('[data-testid="ie-menu-toggle"]').click();
        await board.locator('[data-testid="ie-menu"] [data-testid="ie-display-menu"] > summary').click();
        await board.locator('[data-testid="ie-card-face-print"]').first().click();
        await expect.poll(async () => await page.evaluate(() => localStorage.getItem("ie_card_face"))).toBe("print");
        // One tap on the row reopens the inspector with the new face mode.
        await openCard(card);
        await expect(inspector).toHaveAttribute("data-face-mode", "print");
        await expect(inspector.locator('[data-testid="ie-card-inspector-image"]')).toBeVisible();
        // The scan is printed in English; the event text underneath follows the
        // board language so a zh_CN reader can still read what the card does.
        const eventText = inspector.locator('[data-testid="ie-card-inspector-text"]');
        await expect(eventText).toBeVisible();
        await expect(eventText).toHaveAttribute("lang", "zh-CN");
        await expect(eventText.locator(".ie-card-inspector-text-body")).toContainText(/[\u4e00-\u9fff]/);
        await page.keyboard.press("Escape");

        // Leave the default in place for the rest of the suite.  The menu keeps
        // its own state, so open the display disclosure rather than assuming it.
        if (!(await board.locator('[data-testid="ie-menu"]').count())) await board.locator('[data-testid="ie-menu-toggle"]').click();
        const display = board.locator('[data-testid="ie-menu"] [data-testid="ie-display-menu"]');
        if (!(await display.evaluate((el) => (el as HTMLDetailsElement).open))) await display.locator("> summary").click();
        await board.locator('[data-testid="ie-card-face-svg"]').first().click();
        await expect.poll(async () => await page.evaluate(() => localStorage.getItem("ie_card_face"))).toBe("svg");
    });

    test("a card named in the log is a CP chip that opens the inspector", async ({page}) => {
        await reachAction(page);
        const board = boardFor(page, "GE");

        await board.locator('[data-testid="ie-turn-tab-log"]').click();
        // The diplomacy step already logs each seat's home-card choice, so the
        // history names a card before anything is played.  Playing one is not
        // required and would make the test depend on the deal.
        const chip = board.locator('[data-testid="ie-turn-panel-log"] [data-testid^="ie-log-card-"]').first();
        await expect(chip).toBeVisible({timeout: 10_000});

        // The chip carries the printed CP and the title the player knows.
        const cardId = (await chip.getAttribute("data-testid"))!.replace("ie-log-card-", "");
        const chipTitle = (await chip.locator(".ie-log-card-name").innerText()).trim();
        const chipCp = (await chip.locator(".ie-log-card-cp").innerText()).trim();
        expect(chipCp).toMatch(/^\d+$/);
        expect(chipTitle.length).toBeGreaterThan(0);

        await chip.click();
        const inspector = board.locator('[data-testid="ie-card-inspector"]');
        await expect(inspector).toBeVisible();
        await expect(inspector.locator("svg.ie-card-face")).toHaveAttribute("data-card-id", cardId);
        // The inspector names the same card, with the CP the chip printed.
        await expect(inspector.locator(".ie-inspector-title")).toHaveText(chipTitle);
        await expect(inspector.locator(".ie-inspector-subtitle")).toContainText(`${chipCp} CP`);
        // A log card is a read-only copy: no play controls, just the note.
        await expect(inspector.locator('[data-testid="ie-log-card-note"]')).toBeVisible();
        expect(await inspector.locator('[data-testid^="ie-play-cp-"]').count()).toBe(0);

        // Esc closes it and leaves the log where it was.
        await page.keyboard.press("Escape");
        await expect(inspector).toHaveCount(0);
        await expect(board.locator('[data-testid="ie-log"]')).toBeVisible();
    });

    test("selecting a unit rings legal destinations and a ring click moves it", async ({page}) => {
        await reachAction(page);
        const board = boardFor(page, "GE");
        // A peacetime redeploy costs exactly 1 CP, so the impulse needs a card
        // banked for CP first; otherwise every ring would submit a move the
        // engine refuses and the unit would stay in Berlin.
        await expect(await playCpCard(board), "this deal has no card to bank CP with").toBe(true);

        await clickSpace(board, "berlin", "柏林");

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

        await clickSpace(board, "berlin", "柏林");
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
        await expect(await playCpCard(board), "this deal has no card to bank CP with").toBe(true);
        await clickSpace(board, "berlin", "柏林");

        // 12.16: Saxony holds a neutral minor army next to Berlin, and a
        // non-player power needs a declaration first, so the land-battle order
        // is refused (it used to enter targeting and let the player attack it).
        const land = board.locator('[data-testid="ie-action-landBattle"]');
        await expect(land).toHaveAttribute("data-enabled", "false");
        await expect(land).toContainText("宣战");

        // Move targeting still gives the mode its miss-and-Escape coverage:
        // selecting an own unit rings only its engine-legal destinations.
        const unitId = await page.evaluate((): string | null => {
            const G = (window as any).__IE_STATE__;
            const ids: string[] = (G.spaces.berlin.units ?? []).filter((id: string) =>
                G.units[id]?.owner === "GE" && !G.units[id]?.naval);
            return ids[0] ?? null;
        });
        if (unitId === null) throw new Error("Berlin holds no German land unit to select");
        await board.locator(`[data-testid="ie-unit-${unitId}"]`).click();
        await expect(board.locator('[data-testid="ie-mode-pill"]')).toBeVisible();
        await expect(board.locator('[data-testid="ie-mode-pill-targets"]')).toBeVisible();

        const before = await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining);

        // Esc leaves the mode without spending anything.
        await page.keyboard.press("Escape");
        await expect(board.locator('[data-testid="ie-mode-pill"]')).toHaveCount(0);
        expect(await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining)).toBe(before);

        // Re-enter targeting and click a space that is not a destination.
        // London is neither adjacent to Berlin nor a legal destination, so the
        // click only moves the selection: it must not spend CP.
        await clickSpace(board, "berlin", "柏林");
        await board.locator(`[data-testid="ie-unit-${unitId}"]`).click();
        await expect(board.locator('[data-testid="ie-mode-pill"]')).toBeVisible();
        await board.locator('[data-testid="ie-space-london"]').click({force: true});
        await page.waitForTimeout(250);
        expect(await page.evaluate(() => (window as any).__IE_STATE__.cpRemaining)).toBe(before);
        await expect(board.locator('[data-testid="ie-mode-pill"]')).toHaveCount(0);
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

        // War: always offered, because the declaration form lives there; a
        // fresh match has no war yet, so the body opens on that form.
        await dock.locator('[data-testid="ie-mobile-tab-war"]').click();
        await expect(dock).toHaveAttribute("data-tab", "war");
        await expect(body.locator('[data-testid="ie-turn-panel-war"]')).toBeVisible();
        await expect(body.locator('[data-testid="ie-war-declare"]')).toBeVisible();
    });

    /**
     * Every pane has to scroll when its content is taller than the sheet.
     *
     * The Orders pane is a column flex box with `overflow: auto`, but its
     * children used to be default flex items (`flex: 0 1 auto`): a child taller
     * than the sheet shrank to the leftover room — MPIT collapsed to a ~16 px
     * sliver, the space detail to ~3 px — and each panel's own `overflow:
     * hidden` clipped the rest.  The body therefore never overflowed and had
     * nothing to scroll, so the controls below the fold were unreachable on a
     * phone with no way to reveal them.  This pins the opposite contract: the
     * pane reports a real `scrollHeight`, is scrollable, and every visible child
     * keeps its natural height instead of being squashed.
     */
    test("every pane scrolls its overflow instead of squashing its panels", async ({page}) => {
        await openLocal(page);
        const dock = dockFor(page);
        const body = dock.locator('[data-testid="ie-mobile-body"]');
        await dock.locator('[data-testid="ie-mobile-tab-orders"]').click();
        await expect(dock).toHaveAttribute("data-open", "true");

        // Inspect every pane the sheet can show: the turn panel's three tabs
        // (Orders, Log — War joins only while a war runs) plus the hand and mat
        // bodies.  A pane is scrollable when its own content is taller than it;
        // a short pane is fine as long as nothing inside it is clipped.
        const readPane = async (name: "orders" | "log" | "hand" | "mat") => {
            await dock.locator(`[data-testid="ie-mobile-tab-${name}"]`).click();
            await expect(dock).toHaveAttribute("data-tab", name);
            return await body.evaluate((root, paneName) => {
                const scroller = root.querySelector(
                    paneName === "hand" ? ".ie-tray-scroll"
                        : paneName === "mat" ? ".ie-mat"
                            : paneName === "log" ? ".ie-log"
                                : ".ie-turn-body:not([hidden])",
                ) as HTMLElement | null;
                // The panel that owns the content (the Orders body is the pane
                // itself; the others are one level in).
                const pane = paneName === "orders" || paneName === "log"
                    ? root.querySelector(".ie-turn-body:not([hidden])") as HTMLElement | null
                    : scroller;
                const children = pane === null ? [] : [...pane.children].map((child) => {
                    const box = child.getBoundingClientRect();
                    const style = getComputedStyle(child);
                    return {
                        height: Math.round(box.height),
                        // A clipped child is one that has more content than the
                        // box it was squeezed into.
                        clipped: style.overflowY === "hidden" && child.scrollHeight > child.clientHeight + 4,
                    };
                });
                return {
                    hasScroller: scroller !== null,
                    scrollable: scroller !== null && scroller.scrollHeight > scroller.clientHeight + 1,
                    children,
                };
            }, name);
        };

        for (const name of ["orders", "hand", "mat", "log"] as const) {
            const pane = await readPane(name);
            expect(pane.hasScroller, `${name} pane has a scroll surface`).toBe(true);
            const squashed = pane.children.filter((child) => child.clipped);
            expect(
                squashed.map((child) => child.height),
                `${name} pane squashed ${squashed.length} clipped child(ren) instead of scrolling`,
            ).toEqual([]);
        }

        // The Orders body's own pages are the flex items that can be taller than
        // the half sheet; at least one must report its overflow and let the
        // reader reach it.  The influence page (the MPIT matrix, six cells of
        // three 44 px buttons) is reliably taller than 40 px of a half sheet.
        await dock.locator('[data-testid="ie-mobile-tab-orders"]').click();
        await expect(dock).toHaveAttribute("data-tab", "orders");
        const body_ = body.locator(".ie-turn-body:not([hidden])");
        await body_.locator('[data-testid="ie-orders-tab-influence"]').click();
        await expect(body_.locator('[data-testid="ie-orders-panel-influence"]')).toBeVisible();
        await expect.poll(async () => await body_.evaluate((pane) => pane.scrollHeight - pane.clientHeight))
            .toBeGreaterThan(40);

        // Scrolling the pane actually moves it, which is what a touch drag does.
        const before = await body_.evaluate((pane) => pane.scrollTop);
        await body_.evaluate((pane) => { pane.scrollTop = pane.scrollHeight; });
        await expect.poll(async () => await body_.evaluate((pane) => pane.scrollTop)).toBeGreaterThan(before);

        // Each Orders page keeps its own content at natural height too: the
        // pages are pinned, so a page taller than the sheet scrolls the body
        // rather than squeezing the page into a sliver.
        for (const page of ["actions", "space", "influence"] as const) {
            await body_.locator(`[data-testid="ie-orders-tab-${page}"]`).click();
            await expect(body_.locator(`[data-testid="ie-orders-panel-${page}"]`)).toBeVisible();
            const pageHeights = await body_.evaluate((root, key) => {
                const pane = root.querySelector(`[data-testid="ie-orders-panel-${key}"]`) as HTMLElement | null;
                if (pane === null) return {height: 0, natural: 0};
                return {height: Math.round(pane.getBoundingClientRect().height), natural: pane.scrollHeight};
            }, page);
            expect(pageHeights.height, `${page} page is not a sliver`).toBeGreaterThan(20);
            expect(pageHeights.natural, `${page} page keeps its content`).toBeGreaterThan(0);
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

    /**
     * MPIT is the densest control on the board, and at 390x844 the Orders pane
     * is a ~294 px scroll surface.  It used to be the last child of that pane
     * and every track value was a 26 px pill, so placing a marker meant
     * scrolling and then hitting a sub-fingertip target.  It has its own page of
     * the Orders panel now; this test pins that the page is one tap away, that
     * all 18 values are 44 px targets, and that arming one does not move it.
     */
    test("MPIT is one tap away on a phone and is a 44 px target", async ({page}) => {
        await phoneReachAction(page);
        const board = boardFor(page, "GE");
        const dock = dockFor(page);
        const body = dock.locator('[data-testid="ie-mobile-body"]');
        // A marker costs CP, so the seat needs a budget first (played through
        // the Hand pane and back).
        expect(await phonePlayCpCard(page, board), "GE could not play a card for CP").toBe(true);

        // The pane is in front and open at half height (no expand needed).
        await expect(dock).toHaveAttribute("data-open", "true");
        await expect(dock).toHaveAttribute("data-tab", "orders");

        // The Orders panel opens on its Actions page; the matrix is one tab away
        // and needs no scroll to reach.
        await expect(body.locator('[data-testid="ie-orders-panel-actions"]')).toBeVisible();
        await expect(body.locator('[data-testid="ie-orders-panel-influence"]')).toBeHidden();
        await body.locator('[data-testid="ie-orders-tab-influence"]').click();
        await expect(body.locator('[data-testid="ie-orders-panel-influence"]')).toBeVisible();
        await expect(body.locator('[data-testid="ie-orders-panel-actions"]')).toBeHidden();

        const mpit = body.locator('[data-testid="ie-mpit"]');
        await expect(mpit).toBeVisible();

        // The matrix is the page, ahead of the national actions.
        const order = await body.evaluate((root) => {
            const panel = root.querySelector('[data-testid="ie-mpit"]') as HTMLElement | null;
            const detail = root.querySelector('[data-testid="ie-space-detail"]') as HTMLElement | null;
            if (panel === null) return "missing";
            // The space detail lives on another page now, so it must not share
            // this one: the matrix has it to itself.
            if (detail !== null && detail.checkVisibility({checkVisibilityCSS: true})) return "detail-here";
            return "mpit-only";
        });
        expect(order).toBe("mpit-only");

        // Every placement value is a fingertip.  On the Influence page the
        // matrix is the content, so it may be taller than the half sheet: the
        // requirement is that scrolling reaches the last row, not that all 18
        // fit without a scroll.
        const tracks = mpit.locator('[data-testid^="ie-mpit-place-"]');
        await expect(tracks).toHaveCount(18);
        for (let i = 0; i < 18; i += 1) {
            const box = (await tracks.nth(i).boundingBox())!;
            expect(box.height, `track ${i} height`).toBeGreaterThanOrEqual(44);
            expect(box.width, `track ${i} width`).toBeGreaterThanOrEqual(44);
        }
        // The page scrolls the matrix rather than clipping it: the last row is
        // reachable, and the body reports real overflow.
        const pane = body.locator(".ie-turn-body:not([hidden])");
        await expect.poll(async () => await pane.evaluate((el) => el.scrollHeight - el.clientHeight))
            .toBeGreaterThan(40);
        await tracks.nth(17).scrollIntoViewIfNeeded();
        const lastBox = (await tracks.nth(17).boundingBox())!;
        const bodyBox = (await body.boundingBox())!;
        expect(lastBox.y).toBeGreaterThanOrEqual(bodyBox.y - 1);
        expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(bodyBox.y + bodyBox.height + 1);
        // And the first row is reachable too, by scrolling back up.
        await tracks.nth(0).scrollIntoViewIfNeeded();
        const firstBox = (await mpit.getByTestId("ie-mpit-place-GE-te").boundingBox())!;
        expect(firstBox.y).toBeGreaterThanOrEqual(bodyBox.y - 1);

        // Arm-then-confirm must not reflow the grid: the armed label is longer
        // than the plain one, and the second tap has to land on the same box.
        const placeGeTe = mpit.getByTestId("ie-mpit-place-GE-te");
        const before = await page.evaluate(() => (window as any).__IE_STATE__.powers.GE.mpit.te);
        // Measure the button's offset *inside its cell*: clicking can scroll the
        // pane, so viewport coordinates move for reasons that have nothing to do
        // with reflow.
        const geometry = async () => await page.evaluate(() => {
            const grid = document.querySelector('.ie-mobile-dock [data-testid="ie-mpit"] .ie-mpit-grid') as HTMLElement;
            const button = document.querySelector('[data-testid="ie-mpit-place-GE-te"]') as HTMLElement;
            const cell = button.closest(".ie-mpit-cell") as HTMLElement;
            const d = document.querySelector('[data-testid="ie-mobile-dock"]') as HTMLElement;
            return {
                gridHeight: grid.getBoundingClientRect().height,
                buttonTop: button.getBoundingClientRect().top - cell.getBoundingClientRect().top,
                buttonHeight: button.getBoundingClientRect().height,
                buttonWidth: button.getBoundingClientRect().width,
                dockHeight: d.getBoundingClientRect().height,
            };
        });
        const beforeGeometry = await geometry();

        await placeGeTe.click();
        await expect(placeGeTe).toHaveAttribute("data-armed", "true");
        const armedGeometry = await geometry();
        expect(Math.abs(armedGeometry.gridHeight - beforeGeometry.gridHeight)).toBeLessThanOrEqual(1);
        expect(Math.abs(armedGeometry.buttonTop - beforeGeometry.buttonTop)).toBeLessThanOrEqual(1);
        expect(Math.abs(armedGeometry.buttonHeight - beforeGeometry.buttonHeight)).toBeLessThanOrEqual(1);
        expect(Math.abs(armedGeometry.buttonWidth - beforeGeometry.buttonWidth)).toBeLessThanOrEqual(1);
        expect(Math.abs(armedGeometry.dockHeight - beforeGeometry.dockHeight)).toBeLessThanOrEqual(1);

        await placeGeTe.click();
        await expect.poll(async () => page.evaluate(() => (window as any).__IE_STATE__.powers.GE.mpit.te))
            .toBe(before + 1);
    });
});
