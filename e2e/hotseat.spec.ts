import {expect, test, type Page} from "@playwright/test";

const TITLE_ZH = "● Film Centenary · 轮到你选择";
const TITLE_EN = "● Film Centenary · your turn to choose";

const visibleText = (page: Page, text: string | RegExp) =>
    page.getByText(text).filter({visible: true});

/**
 * The hotseat shell mounts every seat board at once.  Each mounted board runs
 * the turn-notification hook, so this guards the shared document title against
 * accumulating suffixes or losing its attention bullet when seats alternate.
 */
test.describe("local hotseat turn notification", () => {
    test("keeps one suffix and the bullet while seats alternate", async ({page}) => {
        await page.goto("/localVQ/tutorial");
        await expect.poll(() => page.title()).toBe(TITLE_ZH);
        expect((await page.title()).match(/轮到你选择/g)).toHaveLength(1);

        await page.getByRole("button", {name: "确认奥斯曼帝国抽牌完成"}).click();
        await expect(visibleText(page, /切换到 P2 标签页/)).toBeVisible();
        await expect.poll(() => page.title()).toBe(TITLE_ZH);
        expect((await page.title()).match(/轮到你选择/g)).toHaveLength(1);

        const tabs = page.getByRole("tablist", {name: "本地玩家面板"});
        await tabs.getByRole("tab", {name: /P2 西班牙/}).click();
        await page.getByRole("button", {name: "确认西班牙抽牌完成"}).click();
        await expect(visibleText(page, /切换到 P1 标签页/)).toBeVisible();
        await expect.poll(() => page.title()).toBe(TITLE_ZH);
        expect((await page.title()).match(/轮到你选择/g)).toHaveLength(1);
    });

    test("replaces the old locale suffix instead of appending it", async ({page}) => {
        await page.goto("/localVQ/tutorial");
        await expect.poll(() => page.title()).toBe(TITLE_ZH);

        await page.getByText("English", {exact: true}).click();
        await expect.poll(() => page.title()).toBe(TITLE_EN);
        expect(await page.title()).not.toContain("轮到你选择");
    });

    test("shows the bullet for the first seat in a six-player campaign", async ({page}) => {
        await page.goto("/localVQ");
        await expect.poll(() => page.title()).toBe(TITLE_ZH);
        expect((await page.title()).match(/轮到你选择/g)).toHaveLength(1);
    });
});
