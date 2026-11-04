import {expect, test} from "@playwright/test";

test("selects sea zones and cities on the rendered SVG map", async ({page}) => {
    await page.goto("/localVQ/tutorial");

    const aegean = page.getByRole("button", {name: /^Aegean Sea · 海军 \d+$/});
    const venice = page.getByRole("button", {name: /^Venice · 控制：/});
    await expect(aegean).toHaveAttribute("aria-pressed", "false");

    await aegean.click();
    await expect(aegean).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("region", {name: "选中海域详情"})).toBeVisible();

    await venice.click({force: true});
    await expect(venice).toHaveAttribute("aria-pressed", "true");
    await expect(aegean).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("region", {name: "选中地区详情"})).toBeVisible();
});
