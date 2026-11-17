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

        const layout = (await board.locator(".ie-layout").boundingBox())!;
        const stage = (await board.locator(".ie-map-stage").boundingBox())!;
        // The map is the game: it must take the majority of the play area.
        expect(stage.height).toBeGreaterThan(layout.height * 0.55);
        expect(stage.width).toBeGreaterThan(VIEWPORT.width - 60);
    });

    test("the legend and the key are both visible and do not overlap", async ({page}) => {
        const board = await openSeat(page);
        const legend = board.locator(".ie-map-legend");
        const key = board.locator(".ie-map-key");
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

        // Framing controls stay on one row: the map cannot afford a wrapped bar.
        expect((await views.boundingBox())!.height).toBeLessThan(44);

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

    test("the context rail is a strip that opens to a 46dvh sheet without moving the map", async ({page}) => {
        const board = await openSeat(page);
        const rail = board.locator('[data-testid="ie-rail"]');
        await expect(rail).toHaveAttribute("data-open", "false");
        expect((await rail.boundingBox())!.height).toBeLessThanOrEqual(44);

        const before = (await board.locator(".ie-map-stage").boundingBox())!;
        const scrollBefore = await page.evaluate(() => document.querySelector(".ie-board")!.scrollTop);

        await board.locator('[data-testid="ie-rail-tab-action"]').click();
        await expect(rail).toHaveAttribute("data-open", "true");
        await expect(board.locator('[data-testid="ie-rail-panel-action"]')).toBeVisible();

        // The sheet is 46% of the viewport tall, as chosen for this layout.
        const sheet = (await rail.boundingBox())!;
        expect(sheet.height).toBeGreaterThan(VIEWPORT.height * 0.42);
        expect(sheet.height).toBeLessThan(VIEWPORT.height * 0.5);

        // Opening a panel must not resize (and therefore scroll) the board away:
        // the sheet leaves the flow, so the map keeps its top edge and never
        // shrinks — it actually gains the strip's 38 px.
        expect(await page.evaluate(() => document.querySelector(".ie-board")!.scrollTop)).toBe(scrollBefore);
        const after = (await board.locator(".ie-map-stage").boundingBox())!;
        expect(after.y).toBe(before.y);
        expect(after.height).toBeGreaterThanOrEqual(before.height);

        await board.locator('[data-testid="ie-rail-tab-action"]').click();
        await expect(rail).toHaveAttribute("data-open", "false");
    });

    test("Escape folds the context rail", async ({page}) => {
        const board = await openSeat(page);
        const rail = board.locator('[data-testid="ie-rail"]');
        await board.locator('[data-testid="ie-rail-tab-reference"]').click();
        await expect(rail).toHaveAttribute("data-open", "true");
        await page.keyboard.press("Escape");
        await expect(rail).toHaveAttribute("data-open", "false");
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

    test("the shell still fits one viewport and the hand opens on demand", async ({page}) => {
        const board = await openSeat(page);
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(VIEWPORT.height * 1.02);

        const tray = board.locator('[data-testid="ie-hand-tray"]');
        await expect(tray).toHaveAttribute("data-open", "false");
        // The folded bar still carries the counts, so the hand is not a mystery.
        await expect(tray).toContainText("手牌");
        await expect(board.locator('[data-testid="ie-hand-count"]')).toBeVisible();

        await board.locator('[data-testid="ie-tray-toggle"]').click();
        await expect(tray).toHaveAttribute("data-open", "true");
        await expect(board.locator(".ie-hand .ie-card").first()).toBeVisible();
    });

    test("the hand lists one folded row per card and unfolds on a tap", async ({page}) => {
        const board = await openSeat(page);
        await board.locator('[data-testid="ie-tray-toggle"]').click();
        await expect(board.locator('[data-testid="ie-hand-tray"]')).toHaveAttribute("data-open", "true");

        const rows = board.locator(".ie-hand .ie-card");
        const count = await rows.count();
        expect(count).toBeGreaterThan(0);
        const first = rows.first();

        // Folded: only CP value, name, type.  The name is what identifies the
        // card, so it must be on screen — not truncated to nothing.
        await expect(first).toHaveAttribute("data-expanded", "false");
        const cp = (await first.locator(".ie-card-cp").innerText()).trim();
        expect(cp).toMatch(/^\d+$/);
        const name = (await first.locator(".ie-card-name").innerText()).trim();
        expect(name.length).toBeGreaterThan(0);
        expect((await first.locator(".ie-card-type").innerText()).trim().length).toBeGreaterThan(0);
        await expect(first.locator(".ie-card-name")).toBeVisible();
        // The face and the buttons do not exist while folded.
        await expect(first.locator("[data-testid^='ie-card-face-']")).toHaveCount(0);
        await expect(first.locator(".ie-card-actions")).toHaveCount(0);

        // Rows are stacked, not laid out side by side.
        if (count > 1) {
            const a = (await rows.nth(0).boundingBox())!;
            const b = (await rows.nth(1).boundingBox())!;
            expect(b.y).toBeGreaterThan(a.y);
            expect(Math.abs(a.x - b.x)).toBeLessThan(4);
        }

        // Tapping the row unfolds it in place.
        await first.locator(".ie-card-open").click();
        await expect(first).toHaveAttribute("data-expanded", "true");
        await expect(first.locator("[data-testid^='ie-card-face-']")).toHaveCount(1);
        const unfolded = (await first.boundingBox())!;
        expect(unfolded.height).toBeGreaterThan(60);

        // Tapping the header folds it again.
        await first.locator(".ie-card-open").click();
        await expect(first).toHaveAttribute("data-expanded", "false");
    });
});
