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
