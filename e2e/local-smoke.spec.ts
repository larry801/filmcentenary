import {expect, test} from "@playwright/test";

for (const route of ["/local2p", "/local4p"]) {
    test.describe(`film hotseat ${route}`, () => {
        test("mounts the local hotseat board", async ({page}) => {
            await page.goto(route);
            await expect(page.getByRole("button", {name: "展示牌列"})).toBeVisible();
        });

        test("opens the buy-card dialog", async ({page}) => {
            await page.goto(route);
            await page.getByRole("button", {name: "展示牌列"}).click();

            const buyButton = page.getByRole("button", {name: /^购买/}).first();
            await expect(buyButton).toBeVisible();
            await buyButton.click();

            const dialog = page.getByRole("dialog");
            await expect(dialog).toBeVisible();
            await expect(dialog.getByRole("heading", {name: /费用/})).toBeVisible();

            await dialog.getByRole("button", {name: "取消"}).click();
            await expect(dialog).toBeHidden();
        });
    });
}
