import {expect, test} from "@playwright/test";

const listedMatch = {
    matchID: "e2e-listed-match",
    gameName: "film",
    players: [{id: 0}, {id: 1}],
    createdAt: Date.now(),
    updatedAt: Date.now(),
};

test.beforeEach(async ({page}) => {
    await page.route("**/games/film?*", (route) => route.fulfill({json: {matches: [listedMatch]}}));
    await page.route("**/games/film/create", (route) => route.fulfill({json: {matchID: "e2e-created-match"}}));
});

test("creates a match and navigates to the join page", async ({page}) => {
    await page.goto("/");
    await expect(page.getByRole("heading", {name: "电影百年"})).toBeVisible();

    await page.getByRole("button", {name: "创建游戏"}).click();
    await expect(page).toHaveURL(/\/join\/film\/e2e-created-match\/0$/);
});

test("clicks a listed match and navigates to the join page", async ({page}) => {
    await page.goto("/");

    const row = page.getByRole("row").filter({hasText: "e2e-listed-match"});
    await expect(row).toBeVisible();

    await row.getByRole("link", {name: "加入|1"}).click();
    await expect(page).toHaveURL(/\/join\/film\/e2e-listed-match\/0$/);
});
