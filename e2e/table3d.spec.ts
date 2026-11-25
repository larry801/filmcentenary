import {expect, test, type Page} from "@playwright/test";

/**
 * The 3D table, against the real renderer.
 *
 * CI runs Chromium's headless shell on SwiftShader, so these specs prove the
 * whole path — three.js chunk, WebGL context, the published map texture, the
 * marker/token layers and the pointer — not a mocked scene. The sheet stays the
 * default, so each spec opts in through the same control a player uses.
 */

// Only this file needs the software rasteriser, and only this one flag: forcing
// it for every spec would push the VQ boards' several thousand SVG nodes onto
// SwiftShader too and starve their 10 s timeouts.
test.use({launchOptions: {args: ["--enable-unsafe-swiftshader"]}});

const openTable = async (page: Page) => {
    await page.goto("/localIE");
    await expect(page.getByTestId("ie-map")).toBeVisible();
    await page.getByTestId("ie-map-view-table").click();
    const stage = page.locator(".ie-table-3d");
    await expect(stage).toBeVisible();
    // The renderer draws only after the published scan has decoded.
    await expect(stage).toHaveAttribute("data-sheet-texture", "loaded", {timeout: 30000});
    return stage;
};

test("the 3D table draws the board and picks a space", async ({page}) => {
    const stage = await openTable(page);

    // Every printed space has its live control plate, and the opening setup
    // puts counters on the table.
    await expect(stage).toHaveAttribute("data-markers", "145");
    expect(Number(await stage.getAttribute("data-tokens"))).toBeGreaterThan(0);
    // The standees wear the module's own counter faces; the drawn stand-in is
    // only the fallback until those images decode.
    await expect(stage).toHaveAttribute("data-faces", /^[1-9]\d*$/);
    // A browser with no WebGL would have fallen back to the sheet with a note.
    await expect(page.getByTestId("ie-table-3d-fallback")).toHaveCount(0);
    await expect(page.locator("canvas.ie-table-3d-canvas")).toBeVisible();

    // Clicking the table selects a space, exactly as clicking the sheet does:
    // the space card names it.
    const box = await stage.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width * 0.52, box!.y + box!.height * 0.45);
    // The card's title appears only once a space is selected; its hint line
    // always mentions clicking, so the title is the honest assertion.
    await expect(page.locator('[data-testid="ie-space-card"] .ie-space-card-title')).toBeVisible();

    // The camera orbits on a drag, and the canvas repaints.
    const before = await stage.screenshot();
    await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.6);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.5 + 180, box!.y + box!.height * 0.6 + 40, {steps: 12});
    await page.mouse.up();
    await page.waitForTimeout(700);
    const after = await stage.screenshot();
    expect(Buffer.compare(before, after)).not.toBe(0);
});

test("switching back to the sheet keeps the selection", async ({page}) => {
    const stage = await openTable(page);
    const box = await stage.boundingBox();
    await page.mouse.click(box!.x + box!.width * 0.52, box!.y + box!.height * 0.45);
    const card = page.getByTestId("ie-space-card");
    const selected = await card.innerText();

    await page.getByTestId("ie-map-view-sheet").click();
    await expect(page.getByTestId("ie-map")).toBeVisible();
    await expect(card).toHaveText(selected);

    // And the choice is remembered, so a reload comes back to the table.
    await page.getByTestId("ie-map-view-table").click();
    await expect(page.locator(".ie-table-3d")).toBeVisible();
    expect(await page.evaluate(() => window.localStorage.getItem("ie_map_view"))).toBe("table");
});

test("the table has two materials and remembers the chosen one", async ({page}) => {
    const stage = await openTable(page);
    await expect(stage).toHaveAttribute("data-art", "felt");
    await page.getByTestId("ie-table-art-paper").click();
    await expect(stage).toHaveAttribute("data-art", "paper");
    expect(await page.evaluate(() => window.localStorage.getItem("ie_table_art"))).toBe("paper");

    // The two materials are visibly different, not a class name only.
    const paper = await stage.screenshot();
    await page.getByTestId("ie-table-art-felt").click();
    await expect(stage).toHaveAttribute("data-art", "felt");
    await page.waitForTimeout(400);
    const felt = await stage.screenshot();
    expect(Buffer.compare(paper, felt)).not.toBe(0);
});

test("WASD walks the camera and stops when the key lifts", async ({page}) => {
    const stage = await openTable(page);
    const box = await stage.boundingBox();
    expect(box).not.toBeNull();
    // Clicking the table focuses it (it is one focus stop) and selects a space,
    // exactly as a keyboard player arrives on the board.
    await page.mouse.click(box!.x + box!.width * 0.5, box!.y + box!.height * 0.45);
    const before = await stage.screenshot();

    await page.keyboard.down("w");
    await page.waitForTimeout(600);
    await page.keyboard.up("w");
    await page.waitForTimeout(300);
    const walked = await stage.screenshot();
    expect(Buffer.compare(before, walked)).not.toBe(0);

    // The walk is a held movement, not a step: once the key is up the camera
    // settles, so two frames a moment apart are the same picture.
    const settled = await stage.screenshot();
    await page.waitForTimeout(400);
    expect(Buffer.compare(settled, await stage.screenshot())).toBe(0);

    // A/S/D walk the other way; the keyboard also never scrolls the page.
    await page.keyboard.down("s");
    await page.waitForTimeout(500);
    await page.keyboard.up("s");
    await page.waitForTimeout(300);
    expect(Buffer.compare(walked, await stage.screenshot())).not.toBe(0);
});

test("the printed sheet keeps drawing while the camera orbits", async ({page}) => {
    const stage = await openTable(page);
    const box = await stage.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width * 0.5;
    const cy = box!.y + box!.height * 0.45;

    // Frames are weighed rather than eyeballed: the sheet's cardboard edge used
    // to be coplanar with the printed sheet, so on some frames the plain edge
    // won the depth test and the whole map disappeared for that frame — the
    // board flashed blank under a drag.  A blank map compresses to well under
    // two thirds of a printed one, so the smallest frame is the check.
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    const sizes: number[] = [];
    for (let step = 1; step <= 16; step += 1) {
        await page.mouse.move(cx + step * 14, cy + step * 3);
        await page.waitForTimeout(120);
        sizes.push((await stage.screenshot()).length);
    }
    await page.mouse.up();

    const sorted = [...sizes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    for (const size of sizes) {
        expect(size).toBeGreaterThan(median * 0.7);
    }
});

test.describe("on a phone", () => {
    test.use({isMobile: true, hasTouch: true, viewport: {width: 412, height: 820}, deviceScaleFactor: 2});

    test("the stick walks the camera and never orbits the table under it", async ({page}) => {
        const stage = await openTable(page);
        const stick = page.getByTestId("ie-table-3d-joystick");
        await expect(stick).toBeVisible();
        const base = await stick.boundingBox();
        expect(base).not.toBeNull();
        // A thumb on the stick is a camera move, not a board gesture.  The
        // table's own pointer handling claims the pointer (`setPointerCapture`
        // on the stage) and would then orbit under the thumb; the stick claims
        // it first, so the stage must never take the capture.
        await page.evaluate(() => {
            const stage = document.querySelector(".ie-table-3d");
            // `gotpointercapture` bubbles from the stick too, so only a capture
            // the stage itself claims counts.
            stage?.addEventListener("gotpointercapture", (event) => {
                if (event.target === stage) window.__stageCapture += 1;
            });
        });
        await page.evaluate(() => { window.__stageCapture = 0; });
        const before = await stage.screenshot();

        // A thumb on the stick pushes it up: the camera walks up the table.
        const centre = {x: base!.x + base!.width / 2, y: base!.y + base!.height / 2};
        await page.mouse.move(centre.x, centre.y);
        await page.mouse.down();
        await page.mouse.move(centre.x, centre.y - 30, {steps: 4});
        await page.waitForTimeout(500);
        const knob = page.getByTestId("ie-table-3d-joystick-knob");
        await expect(knob).not.toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
        await page.mouse.up();
        await page.waitForTimeout(300);
        expect(Buffer.compare(before, await stage.screenshot())).not.toBe(0);
        // Released, the knob returns to the middle and the walk stops.
        await expect(knob).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
        expect(await page.evaluate(() => window.__stageCapture)).toBe(0);
        const settled = await stage.screenshot();
        await page.waitForTimeout(400);
        expect(Buffer.compare(settled, await stage.screenshot())).toBe(0);
    });
});
