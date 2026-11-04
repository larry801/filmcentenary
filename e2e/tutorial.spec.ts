import {expect, test, type Page} from "@playwright/test";

const visibleText = (page: Page, text: string | RegExp) =>
    page.getByText(text).filter({visible: true});

test.describe("two-player tutorial hotseat", () => {
    test.beforeEach(async ({page}) => {
        await page.goto("/localVQ/tutorial");
    });

    test("mounts the tutorial on the first step", async ({page}) => {
        await expect(page.getByRole("heading", {level: 1, name: "Virgin Queen"})).toBeVisible();
        await expect(visibleText(page, "双人教学模式 · 勒班陀海战").first()).toBeVisible();
        await expect(visibleText(page, "第 1 步：确认手牌").first()).toBeVisible();
        await expect(visibleText(page, "轮到你操作。").first()).toBeVisible();

        const tabs = page.getByRole("tablist", {name: "本地玩家面板"});
        await expect(tabs.getByRole("tab", {name: /P1 奥斯曼帝国/})).toHaveAttribute("aria-selected", "true");
        await expect(tabs.getByRole("tab", {name: /P2 西班牙/})).toHaveAttribute("aria-selected", "false");
        await expect(page.getByRole("button", {name: "确认奥斯曼帝国抽牌完成"})).toBeEnabled();
    });

    test("switches the hotseat panel between P1 and P2", async ({page}) => {
        const tabs = page.getByRole("tablist", {name: "本地玩家面板"});
        await tabs.getByRole("tab", {name: /P2 西班牙/}).click();

        await expect(tabs.getByRole("tab", {name: /P2 西班牙/})).toHaveAttribute("aria-selected", "true");
        await expect(tabs.getByRole("tab", {name: /P1 奥斯曼帝国/})).toHaveAttribute("aria-selected", "false");
        await expect(visibleText(page, "等待对方操作；本地热座请切换到 P1 标签页。").first()).toBeVisible();

        await tabs.getByRole("tab", {name: /P1 奥斯曼帝国/}).click();
        await expect(visibleText(page, "轮到你操作。").first()).toBeVisible();
    });

    test("advances through the first two tutorial steps", async ({page}) => {
        await page.getByRole("button", {name: "确认奥斯曼帝国抽牌完成"}).click();
        await expect(visibleText(page, "等待对方操作；本地热座请切换到 P2 标签页。").first()).toBeVisible();

        const tabs = page.getByRole("tablist", {name: "本地玩家面板"});
        await tabs.getByRole("tab", {name: /P2 西班牙/}).click();
        await expect(visibleText(page, "轮到你操作。").first()).toBeVisible();

        await page.getByRole("button", {name: "确认西班牙抽牌完成"}).click();
        await expect(visibleText(page, "第 2 步：春季部署").first()).toBeVisible();
        await expect(page.getByRole("button", {name: "结束春季部署"})).toBeVisible();
    });
});
