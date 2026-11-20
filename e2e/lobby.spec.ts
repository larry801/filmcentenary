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
    // 规则和帮助, 使用手册 and 对局统计 stay Film Centenary links, nested in
    // the Film group instead of a separate "对局数据" group.
    await expect(page.getByRole("group", {name: "全局"})).toHaveCount(0);
    await expect(page.getByRole("group", {name: "对局数据"})).toHaveCount(0);
    const filmGroup = page.getByRole("group", {name: "电影百年"});
    await expect(filmGroup).toBeVisible();
    await expect(filmGroup.getByRole("link", {name: "卡表"})).toBeVisible();
    await expect(filmGroup.getByRole("link", {name: "规则和帮助"})).toBeVisible();
    await expect(filmGroup.getByRole("link", {name: "使用手册"})).toBeVisible();
    await expect(filmGroup.getByRole("link", {name: "对局统计"})).toBeVisible();
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

test("the drawer footer shows the build time and commit", async ({page}) => {
    await page.goto("/");
    // The menu button is labelled by the active locale (导航 in zh_CN), so the
    // test addresses it by its stable test id rather than an English name.
    await page.getByTestId("drawer-open").click();
    const buildInfo = page.getByTestId("drawer-build-info");
    await expect(buildInfo).toBeVisible();
    // Both values come from `define` in vite.config.mts, so they are present in
    // dev as well: a `YYYY-MM-DD HH:mm` timestamp and a short commit hash.
    await expect(buildInfo).toContainText(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
    await expect(buildInfo).toContainText(/commit [0-9a-f]{7,}/);
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

test("Imperial Elegy offers 2-6 humans and shows the bot seats", async ({page}) => {
    let body: any = null;
    await page.route("**/games/imperialElegy/create", async (route) => {
        body = route.request().postDataJSON();
        await route.fulfill({json: {matchID: "e2e-created-ie-bots-match"}});
    });
    await page.goto("/imperialElegy");

    // Six seats, all human by default: no bots on a full table.
    const humanSelect = page.locator("#outlined-ie-humans");
    await expect(humanSelect).toBeVisible();
    await expect(humanSelect.locator("option")).toHaveCount(5);
    await expect(humanSelect.locator("option").first()).toHaveAttribute("value", "2");
    await expect(humanSelect.locator("option").last()).toHaveAttribute("value", "6");
    await expect(page.getByTestId("ie-lobby-seats")).toContainText("6 名人类 + 0 名机器人");
    for (const power of ["GE", "UK", "FR", "AU", "RU", "OT"]) {
        await expect(page.getByTestId(`ie-lobby-seat-${power}`)).not.toContainText("🤖");
    }

    // Two humans: the four tail seats become Rule 34 bots, and the create call
    // still asks for all six boardgame.io seats.
    await humanSelect.selectOption("2");
    await expect(page.getByTestId("ie-lobby-seats")).toContainText("2 名人类 + 4 名机器人");
    for (const power of ["GE", "UK"]) {
        await expect(page.getByTestId(`ie-lobby-seat-${power}`)).not.toContainText("🤖");
    }
    for (const power of ["FR", "AU", "RU", "OT"]) {
        await expect(page.getByTestId(`ie-lobby-seat-${power}`)).toContainText("🤖");
    }

    // Any seat can be a bot, not only the tail.  First free a slot by returning
    // a tail seat to a human...
    await page.getByTestId("ie-lobby-seat-OT").click();
    await expect(page.getByTestId("ie-lobby-seats")).toContainText("3 名人类 + 3 名机器人");
    // ...then hand the *first* seat (Germany) to the bot, which the old
    // tail-only count could never do.
    await page.getByTestId("ie-lobby-seat-GE").click();
    await expect(page.getByTestId("ie-lobby-seat-GE")).toContainText("🤖");
    await expect(page.getByTestId("ie-lobby-seats")).toContainText("2 名人类 + 4 名机器人");

    // A fifth bot would leave one human, which the lobby refuses: the chip is
    // disabled (its MUI class marks the whole roster as un-clickable) and the
    // roster is unchanged.
    await expect(page.getByTestId("ie-lobby-seat-UK")).toHaveClass(/Mui-disabled/);
    await expect(page.getByTestId("ie-lobby-seats")).toContainText("2 名人类 + 4 名机器人");

    await page.getByRole("button", {name: "创建游戏"}).click();
    // The invite lands on the first human seat, which is no longer seat 0.
    await expect(page).toHaveURL(/\/join\/imperialElegy\/e2e-created-ie-bots-match\/1$/);
    expect(body).toMatchObject({numPlayers: 6, setupData: {bots: ["GE", "FR", "AU", "RU"]}});
});

test("film and Song Jinn keep the start-player choice", async ({page}) => {
    await page.goto("/film");
    await expect(page.locator("#outlined-player-native-simple")).toBeVisible();

    await page.goto("/songJinn");
    await expect(page.locator("#outlined-player-native-simple")).toBeVisible();
});
