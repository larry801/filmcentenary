import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import {SPACES, SEA_ZONES} from "./mapData";
import {setupGame} from "./util";
import {VQMap} from "./components/map";
import {clampView, INITIAL_VIEW, isMapDrag, MAP_EXTENT, project, zoomView} from "./components/map-geometry";
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

    it("provides keyboard-selectable sea zones, zoom controls and tutorial exclusions", () => {
        const G = setupGame({numPlayers: 2, random: {Die: () => 3, Shuffle: (a: unknown[]) => a}} as unknown as Ctx, {scenario: "tutorial"});
        const html = renderToStaticMarkup(<VQMap G={G} selected="aegean" origin="istanbul" onSelect={() => {}}/>);
        expect(html).toMatch(/role="button" tabindex="0" aria-label="Aegean Sea · 海军 \d+" aria-pressed="true"/);
        expect(html).toContain('aria-label="放大地图"');
        expect(html).toContain('aria-label="复位地图"');
        expect(html).toContain("教学禁入");
        expect(html).not.toContain("<image");
    });
});
