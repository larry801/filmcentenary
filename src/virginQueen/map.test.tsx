import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import {SPACE_POINTS, SPACES, SEA_ZONES, spacePoint} from "./mapData";
import {setupGame} from "./util";
import {VQMap, octagramPoints} from "./components/map";
import {clampView, INITIAL_VIEW, isMapDrag, MAP_EXTENT, mapProject, nearestMapTarget, placeMapLabels, project, relaxMapPoints, warpSvgPath, zoomView} from "./components/map-geometry";
import land from "./data/land-background.json";
import worldLand from "./data/world-background.json";
import {WORLD_MAP_HEIGHT, WORLD_MAP_LOCATIONS, WORLD_MAP_WIDTH, projectWorld} from "./data/world-map";

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

    it("magnifies crowded regions without changing the geographic source projection", () => {
        const trueAmsterdam = project(4.90, 52.37);
        const trueUtrecht = project(5.12, 52.09);
        const displayAmsterdam = mapProject(4.90, 52.37);
        const displayUtrecht = mapProject(5.12, 52.09);
        const trueDistance = Math.hypot(trueAmsterdam[0] - trueUtrecht[0], trueAmsterdam[1] - trueUtrecht[1]);
        const displayDistance = Math.hypot(displayAmsterdam[0] - displayUtrecht[0], displayAmsterdam[1] - displayUtrecht[1]);
        expect(displayDistance).toBeGreaterThan(trueDistance * 1.35);
        // The raw projection remains the canonical lon/lat mapping used by data
        // and by the coastline generator.
        expect(project(-13, 59)).toEqual([20, 20]);
        expect(warpSvgPath("M100,100L110,110Z")).not.toBe("M100,100L110,110Z");
    });

    it("relaxes local clusters while keeping distant points near their anchors", () => {
        const points = [
            {id: "a", x: 100, y: 100},
            {id: "b", x: 101, y: 101},
            {id: "c", x: 500, y: 300},
        ];
        const relaxed = relaxMapPoints(points, {minDistance: 34, iterations: 600});
        const distanceAB = Math.hypot(relaxed.a.x - relaxed.b.x, relaxed.a.y - relaxed.b.y);
        const distanceAC = Math.hypot(relaxed.a.x - relaxed.c.x, relaxed.a.y - relaxed.c.y);
        expect(distanceAB).toBeGreaterThan(16);
        expect(distanceAC).toBeGreaterThan(350);
        let closest = Infinity;
        const displayedPoints = Object.values(SPACE_POINTS);
        for (let i = 0; i < displayedPoints.length; i += 1) {
            for (let j = i + 1; j < displayedPoints.length; j += 1) {
                closest = Math.min(closest, Math.hypot(
                    displayedPoints[i].x - displayedPoints[j].x,
                    displayedPoints[i].y - displayedPoints[j].y,
                ));
            }
        }
        expect(closest).toBeGreaterThan(20);
        for (const [id] of Object.entries(SPACE_POINTS)) {
            expect(id).not.toBe("");
            const displayed = spacePoint(id);
            expect(displayed.x).toBeGreaterThan(0);
            expect(displayed.x).toBeLessThan(1000);
            expect(displayed.y).toBeGreaterThan(0);
            expect(displayed.y).toBeLessThan(620);
        }
    });

    it("puts crowded labels in separate callout slots", () => {
        const placements = placeMapLabels([
            {id: "one", x: 300, y: 200, text: "布鲁塞尔", priority: 600, visible: true},
            {id: "two", x: 304, y: 202, text: "安特卫普", priority: 500, visible: true},
            {id: "three", x: 301, y: 205, text: "阿姆斯特丹", priority: 400, visible: true},
        ]);
        const boxes = Object.values(placements).map((placement) => placement.box);
        expect(boxes.length).toBeGreaterThanOrEqual(2);
        for (let i = 0; i < boxes.length; i += 1) {
            for (let j = i + 1; j < boxes.length; j += 1) {
                const a = boxes[i];
                const b = boxes[j];
                const overlapWidth = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
                const overlapHeight = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
                expect(overlapWidth > 0 && overlapHeight > 0).toBe(false);
            }
        }
    });

    it("draws the printed World Map settlement triangles and overlays active colonies", () => {
        const G = setupGame({numPlayers: 6, random: {Die: () => 3, Shuffle: (a: unknown[]) => a}} as unknown as Ctx);
        G.worldColonies.florida = "england";
        G.worldControls.florida = "england";
        const html = renderToStaticMarkup(<VQMap G={G} onSelect={() => {}}/>);
        expect(html).toContain("世界地图");
        expect(html).toContain("1 个殖民地");
        expect(html).toContain("vq-world-colony");
        expect(html).toMatch(/aria-label="佛罗里达 · 英格兰 · 殖民地"/);
        expect(html).toContain("皇家查尔斯堡");
        expect(html).toContain("迪奥斯港/巴拿马");
        expect(worldLand.extent).toEqual([-180, 80, 180, -60]);
        expect(worldLand.width).toBe(WORLD_MAP_WIDTH);
        expect(worldLand.height).toBe(WORLD_MAP_HEIGHT);
        expect(WORLD_MAP_LOCATIONS.length).toBeGreaterThanOrEqual(25);
        for (const location of WORLD_MAP_LOCATIONS) {
            const [x, y] = projectWorld(location.lon, location.lat);
            expect(x).toBeGreaterThan(0);
            expect(x).toBeLessThan(WORLD_MAP_WIDTH);
            expect(y).toBeGreaterThan(0);
            expect(y).toBeLessThan(WORLD_MAP_HEIGHT);
        }
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

    it("builds the fortress octagram from two congruent squares crossed at 45 degrees", () => {
        const radius = 7;
        const a = radius / Math.SQRT2;
        const d = radius - a;
        const points = octagramPoints(0, 0, radius).split(" ").map((pair) => pair.split(",").map(Number));
        // Eight outer tips: four square corners and four diamond vertices.
        expect(points).toHaveLength(16);
        expect(points).toContainEqual([0, -radius]);
        expect(points).toContainEqual([radius, 0]);
        expect(points).toContainEqual([a, -a]);
        expect(points).toContainEqual([-a, a]);
        // Eight concave notches where a square edge meets a rotated edge.
        expect(points).toContainEqual([d, -a]);
        expect(points).toContainEqual([a, -d]);
        const radii = points.map(([x, y]) => Math.hypot(x, y));
        expect(radii.filter((r) => Math.abs(r - radius) < 1e-9)).toHaveLength(8);
        expect(radii.filter((r) => r < radius)).toHaveLength(8);
    });

    it("renders the octagram on fortress spaces and in the map legend", () => {
        const G = setupGame({numPlayers: 2, random: {Die: () => 3, Shuffle: (a: unknown[]) => a}} as unknown as Ctx);
        const html = renderToStaticMarkup(<VQMap G={G} onSelect={() => {}}/>);
        const polygons = [...html.matchAll(/<polygon data-marker="fortress" points="([^"]+)"/g)];
        // One marker per fortress space plus the compact legend swatch.
        expect(polygons.length).toBeGreaterThan(1);
        for (const [, points] of polygons) {
            expect(points.trim().split(/\s+/)).toHaveLength(16);
        }
        expect(html).toMatch(/vq-legend-swatch-fortress[\s\S]{0,200}<polygon data-marker="fortress"/);
    });
});
