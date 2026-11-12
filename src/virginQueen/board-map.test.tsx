import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import i18n from "../constant/i18n";
import {VQMap} from "./components/map";
import {SPACES, SEA_ZONES} from "./mapData";
import {WORLD_MAP_LOCATIONS} from "./data/world-map";
import {
    BOARD_HEIGHT,
    BOARD_REGIONS,
    BOARD_SEA_POINTS,
    BOARD_SPACE_POINTS,
    BOARD_SPLIT_GRADIENTS,
    BOARD_WIDTH,
    BOARD_WORLD_POINTS,
    BOARD_WORLD_STRIP,
    boardSpacePoint,
    boardWarpPath,
    cachedBoardWarpPath,
} from "./data/board-layout";
import land from "./data/land-background.json";
import {setupGame} from "./util";

const G = () => setupGame({numPlayers: 2, random: {Die: () => 3, Shuffle: (a: unknown[]) => a}} as unknown as Ctx);

describe("printed-board vector map (VQ.png redraw)", () => {
    it("places every land space and sea zone inside the board view", () => {
        expect(Object.keys(BOARD_SPACE_POINTS)).toHaveLength(SPACES.length);
        for (const space of SPACES) {
            const point = boardSpacePoint(space.id);
            expect(point.x).toBeGreaterThan(0);
            expect(point.x).toBeLessThan(BOARD_WIDTH);
            expect(point.y).toBeGreaterThan(0);
            expect(point.y).toBeLessThan(BOARD_HEIGHT);
        }
        expect(Object.keys(BOARD_SEA_POINTS)).toHaveLength(SEA_ZONES.length);
        for (const zone of SEA_ZONES) {
            const point = BOARD_SEA_POINTS[zone.id];
            expect(point.x).toBeGreaterThan(0);
            expect(point.x).toBeLessThan(BOARD_WIDTH);
            expect(point.y).toBeGreaterThan(0);
            expect(point.y).toBeLessThan(BOARD_HEIGHT);
        }
    });

    it("puts every colony triangle inside the printed L-shaped strip", () => {
        expect(Object.keys(BOARD_WORLD_POINTS)).toHaveLength(WORLD_MAP_LOCATIONS.length);
        const {left, bottom} = BOARD_WORLD_STRIP;
        for (const point of Object.values(BOARD_WORLD_POINTS)) {
            const inLeft = point.x >= left.x0 && point.x <= left.x1 && point.y >= left.y0 && point.y <= left.y1;
            const inBottom = point.x >= bottom.x0 && point.x <= bottom.x1 && point.y >= bottom.y0 && point.y <= bottom.y1;
            expect(inLeft || inBottom).toBe(true);
        }
    });

    it("keeps traced markers from collapsing on top of each other", () => {
        const points = Object.values(BOARD_SPACE_POINTS);
        let closest = Infinity;
        for (let i = 0; i < points.length; i += 1) {
            for (let j = i + 1; j < points.length; j += 1) {
                closest = Math.min(closest, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
            }
        }
        expect(closest).toBeGreaterThan(5);
    });

    it("reuses the warped coastline between renders", () => {
        const path = "M100,100L110,110L120,105Z";
        expect(cachedBoardWarpPath(path)).toBe(boardWarpPath(path));
        expect(cachedBoardWarpPath(land.path)).toBe(boardWarpPath(land.path));
        // A cache hit must not recompute the warp.
        const start = Date.now();
        for (let render = 0; render < 20; render += 1) expect(cachedBoardWarpPath(land.path)).toBe(cachedBoardWarpPath(land.path));
        expect(Date.now() - start).toBeLessThan(100);
    });

    it("warps the coastline into the same cartogram without invalid coordinates", () => {
        expect(boardWarpPath("M100,100L110,110Z")).not.toBe("M100,100L110,110Z");
        const warped = boardWarpPath(land.path);
        expect(warped).not.toMatch(/NaN|Infinity/);
        const coordinates = [...warped.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)];
        expect(coordinates.length).toBeGreaterThan(1000);
        for (const [, x, y] of coordinates) {
            expect(Number.isFinite(Number(x))).toBe(true);
            expect(Number.isFinite(Number(y))).toBe(true);
        }
        expect(BOARD_REGIONS.length).toBeGreaterThan(8);
        for (const region of BOARD_REGIONS) {
            for (const point of region.points) {
                expect(Number.isFinite(point.x)).toBe(true);
                expect(Number.isFinite(point.y)).toBe(true);
            }
        }
        expect(BOARD_SPLIT_GRADIENTS.length).toBeGreaterThan(0);
    });

    it("renders one board surface with the printed background and offers a switch back", () => {
        const html = renderToStaticMarkup(<VQMap G={G()} onSelect={() => {}} defaultMapStyle="board"/>);
        expect(html).toContain('class="vq-map vq-board-map"');
        expect(html).toContain('aria-label="按实体棋盘重绘的完整游戏地图（含世界地图三角区）"');
        expect(html).toContain('aria-label="切换到地理版地图"');
        expect(html).toContain('class="vq-board-surface"');
        expect(html).toContain('viewBox="0 0 1000 620"');
        expect(html).toContain("vq-board-split-0");
        expect(html).toContain("vq-board-region-0");
        expect(html).toContain("vq-board-speckle");
        expect(html).toContain("vq-board-land");
        expect(html).toContain("Virgin Queen");
        expect(html).toContain("ENGLAND");
        expect(html).toContain("OTTOMAN");
        expect(html).toContain('aria-label="放大地图"');
        // It is a vector redraw, not the photo, and not the geographic view.
        expect(html).not.toContain("<image");
        expect(html).not.toContain("EUROPA");
        const polygons = [...html.matchAll(/<polygon data-marker="fortress" points="([^"]+)"/g)];
        expect(polygons.length).toBeGreaterThan(1);
    });

    it("draws the colony triangles on the same surface instead of a world inset", () => {
        const state = G();
        state.worldColonies.florida = "england";
        state.worldControls.florida = "england";
        const html = renderToStaticMarkup(<VQMap G={state} onSelect={() => {}} defaultMapStyle="board"/>);
        const triangles = [...html.matchAll(/class="vq-board-triangle/g)];
        expect(triangles.length).toBeGreaterThanOrEqual(25);
        expect(html).toContain("vq-board-colony");
        expect(html).toContain('aria-label="佛罗里达 · 英格兰 · 殖民地"');
        expect(html).toContain("皇家查尔斯堡");
        expect(html).toContain("迪奥斯港/巴拿马");
        expect(html).toContain('▲ 殖民地（世界地图三角区）');
        expect(html).toContain("vq-board-region-0");
        // No Europe/world switch, no separate WorldMapInset, no primary-view flip.
        expect(html).not.toContain('aria-label="切换到世界地图"');
        expect(html).not.toContain('aria-label="切换到欧洲地图"');
        expect(html).not.toContain("vq-world-map");
        expect(html).not.toContain("vq-europe-inset");
        expect(html).not.toContain("vq-map-world-primary");
    });

    it("ignores the Europe/world primary option in the board view", () => {
        const html = renderToStaticMarkup(
            <VQMap G={G()} onSelect={() => {}} defaultMapStyle="board" defaultPrimaryMap="world"/>,
        );
        expect(html).toContain('class="vq-board-surface"');
        expect(html).not.toContain("vq-map-world-primary");
        expect(html).toContain("vq-board-triangle");
    });

    it("keeps selection, legal targets and dimming on the board markers", () => {
        const html = renderToStaticMarkup(
            <VQMap G={G()} selected="venice" origin="aegean" onSelect={() => {}}
                   highlights={new Set(["venice", "aegean"])} defaultMapStyle="board"/>,
        );
        expect(html).toContain("vq-legal-target");
        expect(html).toContain("vq-dim");
        expect(html).toContain('class="vq-legal-ring" cx=');
        expect(html).toContain("vq-board-node");
        expect(html).toMatch(/aria-label="威尼斯 · [^"]*合法目标"/);
        expect(html).toMatch(/aria-label="爱琴海 · [^"]*合法目标"/);
    });

    it("keeps every user-visible string localised in English mode", async () => {
        await i18n.locale("en");
        try {
            const html = renderToStaticMarkup(<VQMap G={G()} onSelect={() => {}} defaultMapStyle="board"/>);
            const text = html.replace(/<[^>]+>/g, " ");
            expect(/[一-鿿　-〿＀-￯]/.test(text)).toBe(false);
            expect(html).toContain('aria-label="Switch to geographic map"');
            expect(html).toContain("N. ATLANTIC");
        } finally {
            await i18n.locale("zh_CN");
        }
    });

    it("is the default map style and can be switched back to the geographic view", () => {
        const board = renderToStaticMarkup(<VQMap G={G()} onSelect={() => {}}/>);
        expect(board).toContain('class="vq-map vq-board-map"');
        expect(board).toContain('aria-label="切换到地理版地图"');
        expect(board).not.toContain('aria-label="切换到棋盘版地图"');
        const geographic = renderToStaticMarkup(
            <VQMap G={G()} onSelect={() => {}} defaultMapStyle="geographic"/>,
        );
        expect(geographic).not.toContain("vq-board-map");
        expect(geographic).toContain('aria-label="切换到棋盘版地图"');
    });
});
