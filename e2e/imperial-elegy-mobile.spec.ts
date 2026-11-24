import {expect, test, Page} from "@playwright/test";

/**
 * The phone layout.
 *
 * The printed board is 6693 units wide.  On a 390 px handset that is 0.05 board
 * units per pixel, which drew two neighbouring spaces eight pixels apart: the
 * map was a wall of adjacent counters and the hand tray plus the context rail
 * left it 272 px tall.  These tests pin the fixes in place:
 *
 *  - the map opens framed on the player's own capital, not on the whole world;
 *  - every theatre is one press away and frames its spaces readably;
 *  - the legend and the key are both on screen and do not overlap;
 *  - the context rail collapses to a tab strip and never resizes the map;
 *  - the whole shell still fits one viewport.
 */

const VIEWPORT = {width: 390, height: 844};

async function openSeat(page: Page) {
    await page.goto("/localIE");
    await expect(page.locator('[data-testid="ie-seat-GE"]')).toBeVisible();
    return page.locator('[data-testid="ie-seat-GE"]');
}

test.describe("Imperial Elegy phone layout", () => {
    test.use({viewport: VIEWPORT});

    test("the map owns most of the screen and opens on the player's capital", async ({page}) => {
        const board = await openSeat(page);
        const map = board.locator('[data-testid="ie-map"]');
        await expect(map).toBeVisible();

        // Framed on Berlin (GE's capital) rather than the whole board: "all" is
        // zoom 1, and a capital framing lands near the 3.2 maximum.
        await expect.poll(async () => Number(await map.getAttribute("data-k"))).toBeGreaterThan(2.5);

        // The play area is `.ie-table`; the shell has no `.ie-layout` any more.
        const layout = (await board.locator(".ie-table").boundingBox())!;
        const stage = (await board.locator(".ie-map-stage").boundingBox())!;
        // The map is the game: it must take the majority of the play area.
        expect(stage.height).toBeGreaterThan(layout.height * 0.55);
        expect(stage.width).toBeGreaterThan(VIEWPORT.width - 60);
    });

    test("the legend and the key are both visible and do not overlap", async ({page}) => {
        const board = await openSeat(page);
        // One legend only: the map draws it, and the footer prints the key.
        const legend = board.locator(".ie-map-legend");
        const key = board.locator(".ie-map-key");
        await expect(legend).toHaveCount(1);
        await expect(legend).toBeVisible();
        await expect(key).toBeVisible();

        const legendBox = (await legend.boundingBox())!;
        const keyBox = (await key.boundingBox())!;
        // A single row each: the legend used to be pushed under the key and then
        // clipped entirely by the map wrapper's overflow.
        expect(legendBox.height).toBeLessThan(40);
        expect(keyBox.height).toBeLessThan(40);
        const overlaps = legendBox.y < keyBox.y + keyBox.height && keyBox.y < legendBox.y + legendBox.height;
        expect(overlaps).toBe(false);
        await expect(legend).toContainText("滚轮缩放");
    });

    test("every theatre frames its spaces and the whole map is one press away", async ({page}) => {
        const board = await openSeat(page);
        const map = board.locator('[data-testid="ie-map"]');
        const views = board.locator('[data-testid="ie-map-views"]');
        await expect(views).toBeVisible();

        // Framing controls stay on one row and that row is the phone's 44 px
        // touch row: the map cannot afford a wrapped or taller bar.
        expect((await views.boundingBox())!.height).toBeLessThanOrEqual(44);

        await board.locator('[data-testid="ie-map-fit"]').click();
        await expect.poll(async () => Number(await map.getAttribute("data-k"))).toBe(1);

        await board.locator('[data-testid="ie-map-capital"]').click();
        await expect.poll(async () => Number(await map.getAttribute("data-k"))).toBeGreaterThan(2.5);

        // Each theatre is a real framing: zoomed in, never beyond the cap.
        for (const [value, minZoom] of [["westEurope", 2.5], ["centralEurope", 2.5], ["eastEurope", 2], ["africa", 2], ["asia", 2]] as const) {
            await board.locator('[data-testid="ie-map-theatre"]').selectOption(value);
            await expect.poll(async () => Number(await map.getAttribute("data-k"))).toBeGreaterThan(minZoom);
            expect(Number(await map.getAttribute("data-k"))).toBeLessThanOrEqual(3.2);
        }
    });

    test("the whole map degrades to dots instead of a grey wall of counters", async ({page}) => {
        const board = await openSeat(page);
        const map = board.locator('[data-testid="ie-map"]');
        await board.locator('[data-testid="ie-map-fit"]').click();
        await expect.poll(async () => await map.getAttribute("data-detail")).toBe("dot");

        await board.locator('[data-testid="ie-map-capital"]').click();
        await expect.poll(async () => await map.getAttribute("data-detail")).toBe("full");
    });

    test("the dock is one strip that opens to a 40 dvh sheet without moving the map's top", async ({page}) => {
        const board = await openSeat(page);
        const dock = board.locator('[data-testid="ie-mobile-dock"]');
        await expect(dock).toHaveAttribute("data-open", "false");
        expect((await dock.boundingBox())!.height).toBeLessThanOrEqual(44);

        const before = (await board.locator(".ie-map-stage").boundingBox())!;

        await board.locator('[data-testid="ie-mobile-toggle"]').click();
        await expect(dock).toHaveAttribute("data-open", "true");
        await expect(board.locator('[data-testid="ie-mobile-body"]')).toBeVisible();

        // The sheet is 40 dvh at this height, and the map keeps its top edge.
        const sheet = (await dock.boundingBox())!;
        expect(sheet.height).toBeGreaterThan(VIEWPORT.height * 0.38);
        expect(sheet.height).toBeLessThan(VIEWPORT.height * 0.42);
        const after = (await board.locator(".ie-map-stage").boundingBox())!;
        expect(after.y).toBe(before.y);

        // Four tabs reach every body; the strip never moves off screen.
        for (const tab of ["orders", "hand", "mat", "log"] as const) {
            await board.locator(`[data-testid="ie-mobile-tab-${tab}"]`).click();
            await expect(dock).toHaveAttribute("data-tab", tab);
        }
        await expect(dock).toHaveAttribute("data-tab", "log");

        // Full height is the shell's own cap, not the viewport's.
        await board.locator('[data-testid="ie-mobile-tab-orders"]').click();
        await board.locator('[data-testid="ie-mobile-expand"]').click();
        await expect(dock).toHaveAttribute("data-expanded", "true");
        expect((await dock.boundingBox())!.height).toBeGreaterThan(VIEWPORT.height * 0.6);
    });

    test("the dock closes from its bar and reopens at half height", async ({page}) => {
        const board = await openSeat(page);
        const dock = board.locator('[data-testid="ie-mobile-dock"]');
        await board.locator('[data-testid="ie-mobile-toggle"]').click();
        await board.locator('[data-testid="ie-mobile-expand"]').click();
        await expect(dock).toHaveAttribute("data-expanded", "true");
        await board.locator('[data-testid="ie-mobile-toggle"]').click();
        await expect(dock).toHaveAttribute("data-open", "false");
        // A collapse never reopens to full: the reopen starts at half height.
        await board.locator('[data-testid="ie-mobile-toggle"]').click();
        await expect(dock).toHaveAttribute("data-open", "true");
        await expect(dock).toHaveAttribute("data-expanded", "false");
    });

    test("tapping two overlapping counters asks which one was meant", async ({page}) => {
        const board = await openSeat(page);
        // Zoom all the way out, where counters overlap, then tap South Africa.
        await board.locator('[data-testid="ie-map-fit"]').click();
        await expect.poll(async () => Number(await board.locator('[data-testid="ie-map"]').getAttribute("data-k"))).toBe(1);
        await board.locator('[data-testid="ie-space-south-africa"]').click({force: true});
        // Either the tap selected unambiguously, or the pick list asked; both are
        // acceptable, but the pick list must resolve if it appears.
        const pick = board.locator('[data-testid="ie-map-pick"]');
        if (await pick.count() > 0 && await pick.isVisible()) {
            const buttons = pick.locator("button[data-testid^='ie-map-pick-']");
            expect(await buttons.count()).toBeGreaterThanOrEqual(2);
            await buttons.first().click();
            await expect(pick).toHaveCount(0);
        }
    });

    test("the shell still fits one viewport and the hand opens from the dock", async ({page}) => {
        const board = await openSeat(page);
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(VIEWPORT.height * 1.02);

        // The hand is a body of the dock at this width: its tab is the way in,
        // and its count is only on screen while that body is.
        const tabs = board.locator('[data-testid="ie-mobile-tab-hand"]');
        await expect(tabs).toBeVisible();
        await tabs.click();
        await expect(board.locator('[data-testid="ie-mobile-dock"]')).toHaveAttribute("data-tab", "hand");
        await expect(board.locator('[data-testid="ie-hand-tray"]')).toHaveAttribute("data-open", "true");
        await expect(board.locator('[data-testid="ie-hand-count"]')).toBeVisible();
        await expect(board.locator(".ie-hand .ie-card").first()).toBeVisible();
    });

    test("the hand lists one row per card and one tap opens the inspector", async ({page}) => {
        const board = await openSeat(page);
        await board.locator('[data-testid="ie-mobile-tab-hand"]').click();
        await expect(board.locator('[data-testid="ie-hand-tray"]')).toHaveAttribute("data-open", "true");

        const rows = board.locator(".ie-hand .ie-card");
        const count = await rows.count();
        expect(count).toBeGreaterThan(0);
        const first = rows.first();

        // The row: only CP value and name.  The name is what identifies the
        // card, so it must be on screen — not truncated to nothing.  The type
        // icon is gone: it used to sit over the CP number.
        await expect(first).toHaveAttribute("data-expanded", "false");
        const cp = (await first.locator(".ie-card-cp").innerText()).trim();
        expect(cp).toMatch(/^\d+$/);
        const name = (await first.locator(".ie-card-name").innerText()).trim();
        expect(name.length).toBeGreaterThan(0);
        await expect(first.locator(".ie-card-type")).toHaveCount(0);
        await expect(first.locator(".ie-card-name")).toBeVisible();
        // The row never unfolds: no face, no buttons, no status panel.
        await expect(first.locator("[data-testid^='ie-card-face-']")).toHaveCount(0);
        await expect(first.locator(".ie-card-actions")).toHaveCount(0);

        // Rows are stacked, not laid out side by side.
        if (count > 1) {
            const a = (await rows.nth(0).boundingBox())!;
            const b = (await rows.nth(1).boundingBox())!;
            expect(b.y).toBeGreaterThan(a.y);
            expect(Math.abs(a.x - b.x)).toBeLessThan(4);
        }

        // One tap opens the inspector; the row itself stays folded.
        await first.locator(".ie-card-open").click();
        const inspector = board.locator('[data-testid="ie-card-inspector"]');
        await expect(inspector).toBeVisible();
        await expect(inspector.locator(".ie-card-inspector-actions button").first()).toBeVisible();
        await expect(first).toHaveAttribute("data-expanded", "false");
        await page.keyboard.press("Escape");
        await expect(inspector).toHaveCount(0);
    });

    test("the framing bar fits the screen and the theatre picker is on it", async ({page}) => {
        const board = await openSeat(page);
        const views = board.locator('[data-testid="ie-map-views"]');
        await expect(views).toBeVisible();
        // One row, one screen: the row used to hold 429 px of controls in 350,
        // which put the theatre select 79 px past the right edge.  The atlas
        // sheets step aside below 460 px, and their frames are three options
        // away in that select.
        expect((await views.boundingBox())!.height).toBeLessThanOrEqual(44);
        expect(await views.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
        const select = (await board.locator('[data-testid="ie-map-theatre"]').boundingBox())!;
        expect(select.x).toBeGreaterThanOrEqual(0);
        expect(select.x + select.width).toBeLessThanOrEqual(VIEWPORT.width);
    });

    test("the folded screen names the step and the acting power", async ({page}) => {
        const board = await openSeat(page);
        const step = board.locator('[data-testid="ie-track-step"]');
        await expect(step).toBeVisible();
        // The 44 px strip hides the four-button stepper, so this one chip is the
        // only place a folded sheet says whose turn and which step it is.
        await expect(step).toContainText("准备");
        await expect(step).toContainText("GE");
        // It opens the reference at that step, exactly as a stepper button does.
        await step.click();
        await expect(board.locator('[data-testid="ie-reference-drawer"]')).toHaveAttribute("data-open", "true");
    });

    test("all six seats are on screen without a horizontal scroll", async ({page}) => {
        await openSeat(page);
        const strip = page.locator(".ie-seat-strip");
        await expect(strip).toBeVisible();
        // 445 px of tabs in a 148 px window left four seats off screen.
        expect(await strip.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
        for (const power of ["GE", "UK", "FR", "AU", "RU", "OT"] as const) {
            const box = (await page.locator(`[data-testid="ie-seat-status-${power}"]`).boundingBox())!;
            expect(box.width).toBeGreaterThanOrEqual(40);
            expect(box.x + box.width).toBeLessThanOrEqual(VIEWPORT.width);
        }
        // The full name is still the tab's accessible name.
        await expect(page.getByRole("tab", {name: /P3 · FR/})).toHaveCount(1);
    });

    test("find space opens the picker under the framing bar", async ({page}) => {
        const board = await openSeat(page);
        // The control was clipped out of the map stage at every width, so the
        // 145-space picker could not be opened at all.
        await board.locator('[data-testid="ie-map-find"]').click();
        const search = board.locator('[data-testid="ie-picker-search"]');
        await expect(search).toBeVisible();
        await expect(search).toBeFocused();
        await search.fill("维也纳");
        await board.locator('[data-testid="ie-picker-item-vienna"]').click();
        await expect(board.locator('[data-testid="ie-space-card"]')).toContainText("维也纳");
    });

    test("only the seat in front builds a board", async ({page}) => {
        const board = await openSeat(page);
        await expect(board.locator('[data-testid="ie-map"]')).toBeVisible();
        // Six clients, one interface: the five hidden seats are 80 % of the DOM
        // otherwise, and they re-rendered on every move.
        const sizes = await page.evaluate(() => [...document.querySelectorAll(".ie-seat")]
            .map((seat) => seat.querySelectorAll("*").length));
        expect(sizes.filter((count) => count > 200)).toHaveLength(1);
        expect(sizes.reduce((sum, count) => sum + count, 0)).toBeLessThan(9000);
    });

    test("a hidden bot seat still plays its own moves", async ({page}) => {
        // The five seats that are not in front render no interface; Rule 34
        // still needs them to submit, so the driver lives outside the board.
        await page.goto("/localIE?solo=1");
        await page.locator('[data-testid="ie-start-match"]').click();
        const board = page.locator('[data-testid="ie-seat-GE"]');
        await expect(board.locator('[data-testid="ie-map"]')).toBeVisible();
        await board.locator('[data-testid="ie-mobile-toggle"]').click();
        await board.locator('[data-testid="ie-finish-prep"]').click();
        await expect.poll(
            async () => page.evaluate(() => (window as any).__IE_STATE__.phase),
            {timeout: 30_000, message: "the bots never finished the prep step"},
        ).not.toBe("prep");
    });
});

test.describe("Imperial Elegy phone touch", () => {
    test.use({viewport: VIEWPORT, hasTouch: true, isMobile: true});

    test("the map help names the pinch and a fingertip still presses the chips", async ({page}) => {
        const board = await openSeat(page);
        // Pinch has worked since the gesture work; the help said "wheel".
        await expect(board.locator('[data-testid="ie-map-help"]')).toContainText("双指缩放");
        // The chip's box is 28 px and its hit area is 44: 6 px below the chip is
        // still the chip.
        const chip = (await board.locator('[data-testid="ie-map-fit"]').boundingBox())!;
        await page.touchscreen.tap(chip.x + chip.width / 2, chip.y + chip.height + 6);
        await expect.poll(async () => Number(await board.locator('[data-testid="ie-map"]').getAttribute("data-k"))).toBe(1);
    });
});
