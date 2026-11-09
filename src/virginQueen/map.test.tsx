import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import {SPACES, SEA_ZONES} from "./mapData";
import {setupGame} from "./util";
import {VQMap} from "./components/map";
import {clampView, INITIAL_VIEW, isMapDrag, MAP_EXTENT, nearestMapTarget, project, zoomView} from "./components/map-geometry";
import land from "./data/land-background.json";

describe("offline geographic map", () => {
    it("uses the same projection extent as the generated coastline", () => {
        expect(land.extent).toEqual([...MAP_EXTENT]);
        expect(project(-13, 59)).toEqual([20, 20]);
        expect(project(37, 30)).toEqual([980, 600]);
        expect(land.path).not.toMatch(/NaN|Infinity/);
        const coordinates = [...land.path.matchAll(/([\d.]+),([\d.]+)/g)];
        expect(coordinates.length).toBeGreaterThan(1000);
        for (const [, x, y] of coordinates) {
            expect(Number(x)).toBeGreaterThanOrEqual(20);
            expect(Number(x)).toBeLessThanOrEqual(980);
            expect(Number(y)).toBeGreaterThanOrEqual(20);
            expect(Number(y)).toBeLessThanOrEqual(600);
        }
    });

    it("keeps every city and sea destination inside the initial view", () => {
        const points = [...SPACES.map(({lon, lat}) => [lon, lat]), ...SEA_ZONES.map(({label}) => label)];
        for (const [lon, lat] of points) {
            const [x, y] = project(lon, lat);
            expect(x).toBeGreaterThan(0);
            expect(x).toBeLessThan(1000);
            expect(y).toBeGreaterThan(0);
            expect(y).toBeLessThan(620);
        }
    });

    it("zooms around the requested anchor and can return to the complete map", () => {
        const zoomed = zoomView(INITIAL_VIEW, 2, [300, 200]);
        expect((300 - zoomed.x) / zoomed.scale).toBe(300);
        expect((200 - zoomed.y) / zoomed.scale).toBe(200);
        expect(zoomView(zoomed, 0.5, [300, 200])).toEqual(INITIAL_VIEW);
    });

    it("limits extreme pinch/drag values so the map cannot disappear", () => {
        expect(zoomView(INITIAL_VIEW, 100, [500, 310]).scale).toBe(4);
        expect(zoomView(INITIAL_VIEW, 0.001, [500, 310])).toEqual(INITIAL_VIEW);
        expect(clampView({scale: 2, x: -99999, y: 99999})).toEqual({scale: 2, x: -1000, y: 0});
        expect(isMapDrag(Math.hypot(20, 15))).toBe(true);
        expect(isMapDrag(Math.hypot(2, 1))).toBe(false);
    });

    it("selects the closest marker when neighbouring hit areas overlap", () => {
        const [veniceX, veniceY] = project(12.33, 45.44);
        const [paduaX, paduaY] = project(11.88, 45.41);
        const spaces = [
            {id: "venice", x: veniceX, y: veniceY},
            {id: "padua", x: paduaX, y: paduaY},
        ];
        expect(nearestMapTarget(veniceX, veniceY, spaces, [])).toBe("venice");
        expect(nearestMapTarget(paduaX, paduaY, spaces, [])).toBe("padua");
        expect(nearestMapTarget(veniceX + 40, veniceY + 40, spaces, [])).toBeUndefined();
    });

    it("falls back to a sea zone only when no marker is within reach", () => {
        const [zoneX, zoneY] = project(25.2, 38.4);
        const zones = [{id: "aegean", x: zoneX, y: zoneY}];
        expect(nearestMapTarget(zoneX, zoneY, [], zones)).toBe("aegean");
        expect(nearestMapTarget(zoneX + 60, zoneY + 30, [], zones)).toBeUndefined();
        expect(nearestMapTarget(zoneX + 4, zoneY, [{id: "city", x: zoneX, y: zoneY}], zones)).toBe("city");
    });

    it("provides keyboard-selectable sea zones, zoom controls and tutorial exclusions", () => {
        const G = setupGame({numPlayers: 2, random: {Die: () => 3, Shuffle: (a: unknown[]) => a}} as unknown as Ctx, {scenario: "tutorial"});
        const html = renderToStaticMarkup(<VQMap G={G} selected="aegean" origin="istanbul" onSelect={() => {}}/>);
        expect(html).toMatch(/role="button" tabindex="0" aria-label="爱琴海 · 海军 \d+" aria-pressed="true"/);
        expect(html).toContain('aria-label="放大地图"');
        expect(html).toContain('aria-label="复位地图"');
        expect(html).toContain("教学禁入");
        expect(html).not.toContain("<image");
    });

    it("marks legal targets with a ring and dims the rest only when highlights are supplied", () => {
        const G = setupGame({numPlayers: 2, random: {Die: () => 3, Shuffle: (a: unknown[]) => a}} as unknown as Ctx);
        const plain = renderToStaticMarkup(<VQMap G={G} onSelect={() => {}}/>);
        expect(plain).not.toContain("vq-legal-target");
        expect(plain).not.toContain("vq-legal-ring");
        expect(plain).not.toContain("vq-dim");

        const html = renderToStaticMarkup(
            <VQMap G={G} selected="venice" origin="aegean" onSelect={() => {}} highlights={new Set(["venice", "aegean"])}/>,
        );
        expect(html).toMatch(/class="vq-map-node vq-legal-target" role="button" tabindex="0" aria-label="威尼斯 · [^"]*合法目标"/);
        expect(html).toMatch(/class="vq-map-node vq-dim" role="button" tabindex="0" aria-label="帕多瓦/);
        expect(html).toMatch(/class="vq-map-node vq-legal-target" role="button" tabindex="0" aria-label="爱琴海 · [^"]*合法目标"/);
        expect(html).toContain('class="vq-legal-ring" cx=');
        expect(html).toContain('class="vq-legal-ring" x=');
        expect(html).toContain('fill="#f2d59188"');

        const undimmed = renderToStaticMarkup(
            <VQMap G={G} onSelect={() => {}} highlights={new Set(["venice"])} dimUnavailable={false}/>,
        );
        expect(undimmed).not.toContain("vq-dim");
        expect(undimmed).toContain("vq-legal-target");
    });

    it("renders the compact legend with swatches for every map marker", () => {
        const G = setupGame({numPlayers: 2, random: {Die: () => 3, Shuffle: (a: unknown[]) => a}} as unknown as Ctx);
        const html = renderToStaticMarkup(<VQMap G={G} onSelect={() => {}}/>);
        expect(html).toContain('class="vq-map-legend"');
        expect(html).toContain("<summary>图例</summary>");
        expect(html).toContain("关键城市");
        expect(html).toContain("要塞");
        expect(html).toContain("开放城市");
        expect(html).toContain("J = 耶稣会士");
        expect(html).toContain("动荡圈");
        expect(html).toContain("围困圈");
        expect(html).toContain("禁入（教学）");
        for (const kind of ["key", "fortress", "open", "jesuits", "unrest", "siege", "closed"]) {
            expect(html).toContain(`vq-legend-swatch-${kind}`);
        }
    });
});
