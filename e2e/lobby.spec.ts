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

test("home page shows the game navigation instead of the film lobby", async ({page}) => {
    await page.goto("/");
    await expect(page.getByRole("heading", {name: "游戏中心"})).toBeVisible();
    // The "全局" group is gone; every game now has its own 卡表 link, while
    // 规则和帮助 stays a Film Centenary link.
    await expect(page.getByRole("group", {name: "全局"})).toHaveCount(0);
    const filmGroup = page.getByRole("group", {name: "电影百年"});
    await expect(filmGroup).toBeVisible();
    await expect(filmGroup.getByRole("link", {name: "卡表"})).toBeVisible();
    await expect(filmGroup.getByRole("link", {name: "规则和帮助"})).toBeVisible();
    for (const section of ["宋金战争", "Imperial Elegy 帝国挽歌", "Virgin Queen 童贞女王"]) {
        await expect(page.getByRole("group", {name: section}).getByRole("link", {name: "卡表"})).toBeVisible();
    }
    // The film lobby's own content must not be rendered on the landing page.
    await expect(page.getByRole("heading", {name: "公开对局"})).toHaveCount(0);
    await expect(page.getByRole("button", {name: "创建游戏"})).toHaveCount(0);
});

test("app bar home link returns to the landing page", async ({page}) => {
    await page.goto("/film");
    await page.getByRole("link", {name: "首页"}).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", {name: "游戏中心"})).toBeVisible();
});

test("home page links to the film lobby", async ({page}) => {
    await page.goto("/");
    await page.getByRole("group", {name: "电影百年"})
        .getByRole("link", {name: "多人 / 创建对局"}).click();
    await expect(page).toHaveURL(/\/film$/);
    await expect(page.getByRole("heading", {name: "电影百年"})).toBeVisible();
});

test("creates a match and navigates to the join page", async ({page}) => {
    await page.goto("/film");
    await expect(page.getByRole("heading", {name: "电影百年"})).toBeVisible();

    await page.getByRole("button", {name: "创建游戏"}).click();
    await expect(page).toHaveURL(/\/join\/film\/e2e-created-match\/0$/);
});

test("clicks a listed match and navigates to the join page", async ({page}) => {
    await page.goto("/film");

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
    await page.goto("/film");
    await expect(page.locator("#outlined-player-native-simple")).toBeVisible();

    await page.goto("/songJinn");
    await expect(page.locator("#outlined-player-native-simple")).toBeVisible();
});
