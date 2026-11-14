import {expect, test} from "@playwright/test";

// Each game owns a card list; the counts below are exactly the deck sizes
// asserted by the games' own data tests, plus one header row per table.
test("game hub links to the Song-Jinn card list", async ({page}) => {
    await page.goto("/");
    await page.getByRole("group", {name: "宋金战争"})
        .getByRole("link", {name: "卡表"}).click();
    await expect(page).toHaveURL(/\/cards\/songJinn$/);
    await expect(page.getByRole("heading", {name: "宋金战争 · 卡表"})).toBeVisible();
});

test("Song-Jinn card list renders 100 event cards and 24 plans", async ({page}) => {
    await page.goto("/cards/songJinn");
    await expect(page.getByRole("heading", {name: "宋金战争 · 卡表"})).toBeVisible();
    const events = page.getByRole("table", {name: "Song-Jinn event cards"});
    await expect(events.getByRole("row")).toHaveCount(101);
    await expect(events.getByRole("cell", {name: "建炎南渡", exact: true}).first()).toBeVisible();
    const plans = page.getByRole("table", {name: "Song-Jinn operation plans"});
    await expect(plans.getByRole("row")).toHaveCount(25);
    await expect(plans.getByRole("cell", {name: "早期京畿路", exact: true}).first()).toBeVisible();
});

test("Imperial Elegy card list renders every card group", async ({page}) => {
    await page.goto("/cards/imperialElegy");
    await expect(page.getByRole("heading", {name: "帝国挽歌 · 卡表"})).toBeVisible();
    await expect(page.getByRole("table", {name: "Imperial Elegy action cards"}).getByRole("row")).toHaveCount(101);
    await expect(page.getByRole("table", {name: "Imperial Elegy home cards"}).getByRole("row")).toHaveCount(13);
    await expect(page.getByRole("table", {name: "Imperial Elegy Great War cards"}).getByRole("row")).toHaveCount(11);
    await expect(page.getByRole("table", {name: "Imperial Elegy national goals"}).getByRole("row")).toHaveCount(50);
    await expect(page.getByRole("cell", {name: "殖民冲突", exact: true}).first()).toBeVisible();
});

test("Virgin Queen card list renders the official 112 cards", async ({page}) => {
    await page.goto("/cards/virginQueen");
    await expect(page.getByRole("heading", {name: "童贞女王 · 卡表"})).toBeVisible();
    const cards = page.getByRole("table", {name: "Virgin Queen official cards"});
    await expect(cards.getByRole("row")).toHaveCount(113);
    await expect(cards.getByRole("cell", {name: "大维齐尔", exact: true}).first()).toBeVisible();
});

test("card list headings and columns follow the locale switch", async ({page}) => {
    await page.goto("/cards/songJinn");
    await expect(page.getByRole("heading", {name: "宋金战争 · 卡表"})).toBeVisible();
    await page.locator('input[name="locale-switch"]').check({force: true});
    await expect(page.getByRole("heading", {name: "Song-Jinn War · Card list"})).toBeVisible();
    await expect(page.getByRole("table", {name: "Song-Jinn event cards"})
        .getByRole("columnheader", {name: "Name"})).toBeVisible();
});
