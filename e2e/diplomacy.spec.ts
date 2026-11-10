import {expect, test, type Page} from "@playwright/test";

const tabs = (page: Page) => page.getByRole("tablist", {name: "本地玩家面板"});

const confirmDraw = async (page: Page): Promise<void> => {
    for (let seat = 0; seat < 6; seat += 1) {
        await tabs(page).getByRole("tab").nth(seat).click();
        await page.getByRole("button", {name: /^确认.*抽牌完成$/}).first().click();
    }
};

/**
 * The local hotseat mounts one board per seat.  An idle seat has to say which
 * tab to open next, and diplomacy actions have to be filtered by the real
 * rules (not just "are we at war") so a click never becomes a silent
 * boardgame.io `invalid move`.
 */
test.describe("VQ hotseat diplomacy", () => {
    test.beforeEach(async ({page}) => {
        await page.goto("/localVQ");
        await confirmDraw(page);
    });

    test("tells an idle seat which tab to switch to", async ({page}) => {
        await tabs(page).getByRole("tab", {name: /P2 西班牙/}).click();
        await expect(page.getByText(/等待 奥斯曼帝国 行动。.*请切换到 P1 标签页/).first()).toBeVisible();
    });

    test("blocks the Spain-Protestant alliance and declares war without invalid moves", async ({page}) => {
        const errors: string[] = [];
        page.on("console", (message) => {
            if (message.type() === "error" && message.text().includes("invalid move")) errors.push(message.text());
        });

        await tabs(page).getByRole("tab", {name: /P1 奥斯曼帝国/}).click();
        await page.getByRole("button", {name: "结束外交回合"}).click();

        await tabs(page).getByRole("tab", {name: /P2 西班牙/}).click();
        await page.locator('[aria-labelledby="vq-diplo"]:visible').click();
        await page.getByRole("option", {name: "新教联盟"}).click();

        await expect(page.getByRole("button", {name: "结盟"})).toBeDisabled();
        await expect(page.getByText("西班牙与新教联盟永远不能结盟")).toBeVisible();

        // Rule 9.2 forbids the alliance only; the war itself is legal.
        await page.getByRole("button", {name: /^宣战/}).click();
        await expect(page.getByRole("button", {name: "议和"})).toBeEnabled();
        expect(errors).toEqual([]);
    });

    test("flags England-Spain as impossible to end by agreement", async ({page}) => {
        const errors: string[] = [];
        page.on("console", (message) => {
            if (message.type() === "error" && message.text().includes("invalid move")) errors.push(message.text());
        });

        await tabs(page).getByRole("tab", {name: /P1 奥斯曼帝国/}).click();
        await page.getByRole("button", {name: "结束外交回合"}).click();
        await tabs(page).getByRole("tab", {name: /P2 西班牙/}).click();

        await page.locator('[aria-labelledby="vq-diplo"]:visible').click();
        await page.getByRole("option", {name: "英格兰"}).click();
        await page.getByRole("button", {name: /^宣战/}).click();

        await expect(page.getByRole("button", {name: "议和"})).toBeDisabled();
        await expect(page.getByRole("button", {name: "结盟"})).toBeDisabled();
        await expect(page.getByText("西班牙与英格兰永远不能议和")).toBeVisible();
        expect(errors).toEqual([]);
    });
});
