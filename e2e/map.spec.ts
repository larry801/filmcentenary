import {expect, test} from "@playwright/test";

/** Every mounted board must own its paint servers.
 *
 * The hotseat shell mounts one board per seat and parks the inactive ones
 * behind `display: none`.  SVG paint servers (`url(#vq-board-land)` and
 * friends) resolve by id across the whole document, and Chrome ignores a paint
 * server that lives inside a hidden subtree — so while all six boards shared
 * `vq-board-land`, every seat but the first painted bare sea: no coastline, no
 * land, no power washes.  This pins the fix: paint-server ids must be unique
 * per board, so a hidden seat can never be the one that resolves. */
test("each hotseat seat owns its map paint servers", async ({page}) => {
    await page.goto("/localVQ");
    const tabs = page.getByRole("tablist", {name: "本地玩家面板"});
    await expect(tabs.getByRole("tab")).toHaveCount(6);

    const audit = () => page.evaluate(() => {
        const boards = Array.from(
            document.querySelectorAll("svg[aria-label='按实体棋盘重绘的完整游戏地图（含世界地图三角区）']"),
        );
        const counts = new Map<string, number>();
        for (const node of document.querySelectorAll("[id^='vq-board-']")) {
            counts.set(node.id, (counts.get(node.id) ?? 0) + 1);
        }
        return {
            boards: boards.length,
            duplicated: [...counts].filter(([, count]) => count > 1).map(([id]) => id),
            coasts: boards.map((svg) => {
                const land = svg.querySelector("path[fill^='url(#vq-board-land']");
                const id = land?.getAttribute("fill")?.replace(/^url\(#|\)$/g, "");
                const owners = id === undefined ? 0 : document.querySelectorAll(`[id="${id}"]`).length;
                return {fill: id ?? null, definitionOwners: owners};
            }),
        };
    });

    const report = await audit();
    expect(report.boards).toBe(6);
    // A shared id is exactly the bug: a hidden seat defines it first and wins.
    expect(report.duplicated).toEqual([]);
    for (const coast of report.coasts) {
        expect(coast.fill).not.toBeNull();
        expect(coast.definitionOwners).toBe(1);
    }

    // Switching seats does not reintroduce sharing.
    await tabs.getByRole("tab", {name: /P4/}).click();
    await expect(page.locator(".vq-board-surface svg").filter({visible: true}).first()).toBeVisible();
    expect((await audit()).duplicated).toEqual([]);
});

test("selects sea zones and cities on the rendered SVG map", async ({page}) => {
    await page.goto("/localVQ/tutorial");

    const aegean = page.getByRole("button", {name: /^爱琴海 · 海军 \d+$/});
    const venice = page.getByRole("button", {name: /^威尼斯 · 控制：/});
    await expect(aegean).toHaveAttribute("aria-pressed", "false");

    await aegean.click();
    await expect(aegean).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("region", {name: "选中海域详情"})).toBeVisible();

    await venice.click({force: true});
    await expect(venice).toHaveAttribute("aria-pressed", "true");
    await expect(aegean).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("region", {name: "选中地区详情"})).toBeVisible();
});
