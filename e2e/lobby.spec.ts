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
    await page.route("**/games/songJinn?*", (route) => route.fulfill({json: {matches: []}}));
    await page.route("**/games/virginQueen?*", (route) => route.fulfill({json: {matches: []}}));
    await page.route("**/games/virginQueen/create", (route) => route.fulfill({json: {matchID: "e2e-created-vq-match"}}));
    await page.route("**/games/imperialElegy?*", (route) => route.fulfill({json: {matches: []}}));
    await page.route("**/games/imperialElegy/create", (route) => route.fulfill({json: {matchID: "e2e-created-ie-match"}}));
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

// VQ and Imperial Elegy fix the first player by scenario, so their lobbies
// must not offer the "起手玩家" (start as player) choice.
test("Virgin Queen hides the start-player choice", async ({page}) => {
    await page.goto("/virginQueen");
    await expect(page.getByRole("heading", {name: "Virgin Queen"})).toBeVisible();
    await expect(page.locator("#outlined-player-native-simple")).toHaveCount(0);
    await expect(page.getByText("起手玩家")).toHaveCount(0);
});

test("Virgin Queen creates a match with the fixed first player", async ({page}) => {
    await page.goto("/virginQueen");
    await page.getByRole("button", {name: "创建游戏"}).click();
    await expect(page).toHaveURL(/\/join\/virginQueen\/e2e-created-vq-match\/0$/);
});

test("Imperial Elegy hides the start-player choice", async ({page}) => {
    await page.goto("/imperialElegy");
    await expect(page.getByRole("heading", {name: "Imperial Elegy 帝国挽歌"})).toBeVisible();
    await expect(page.locator("#outlined-player-native-simple")).toHaveCount(0);
    await expect(page.getByText("起手玩家")).toHaveCount(0);
});

test("Imperial Elegy creates a match with the fixed first player", async ({page}) => {
    await page.goto("/imperialElegy");
    await page.getByRole("button", {name: "创建游戏"}).click();
    await expect(page).toHaveURL(/\/join\/imperialElegy\/e2e-created-ie-match\/0$/);
});

test("film and Song Jinn keep the start-player choice", async ({page}) => {
    await page.goto("/");
    await expect(page.locator("#outlined-player-native-simple")).toBeVisible();

    await page.goto("/songJinn");
    await expect(page.locator("#outlined-player-native-simple")).toBeVisible();
});
