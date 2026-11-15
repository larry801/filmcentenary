/**
 * The vector board background is generated from the printed scan by
 * `scripts/generate-ie-map.py`.  These assertions keep the checked-in vector in
 * step with the checked-in scan and with the space catalogue, because a traced
 * coastline that drifts from the spaces would put markers in the sea.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {SPACES, SPACE_IDS} from "./constant/spaces";

const ROOT = path.join(__dirname, "../../");
const SCAN = path.join(ROOT, "public/imperial-elegy/maps/world.jpg");
const BACKGROUND = path.join(__dirname, "data/map-background.json");

interface Region {
  id: string;
  box: [number, number, number, number];
  d: string;
  loops: number;
}

interface Background {
  source: string;
  sha256: string;
  viewBox: [number, number];
  paper: [number, number, number, number];
  regions: Region[];
}

const background: Background = JSON.parse(fs.readFileSync(BACKGROUND, "utf8"));

test("the vector background belongs to the shipped scan", () => {
  expect(fs.existsSync(SCAN)).toBe(true);
  const digest = crypto.createHash("sha256").update(fs.readFileSync(SCAN)).digest("hex");
  expect(background.sha256).toBe(digest);
  expect(background.source).toBe("public/imperial-elegy/maps/world.jpg");
});

test("the background is small enough to be worth replacing the scan", () => {
  const bytes = fs.statSync(BACKGROUND).size;
  // The scan is ~15 MB.  The traced paths are saved at a detail level that
  // keeps the coastlines honest (~120 KB); a regression here means a trace
  // parameter was loosened far past what the board needs.
  expect(bytes).toBeLessThan(400_000);
});

test("the paper sits inside the board coordinate space", () => {
  const [x0, y0, x1, y1] = background.paper;
  const [w, h] = background.viewBox;
  expect(x0).toBeGreaterThan(0);
  expect(y0).toBeGreaterThan(0);
  expect(x1).toBeLessThan(w);
  expect(y1).toBeLessThan(h);
  expect(x1 - x0).toBeGreaterThan(w * 0.5);
  expect(y1 - y0).toBeGreaterThan(h * 0.5);
});

test("every region has a closed path and sits inside its box", () => {
  expect(background.regions.length).toBe(3);
  const ids = background.regions.map((region) => region.id).sort();
  expect(ids).toEqual(["africa", "main", "northAmerica"]);
  for (const region of background.regions) {
    const [x0, y0, x1, y1] = region.box;
    expect(x1).toBeGreaterThan(x0);
    expect(y1).toBeGreaterThan(y0);
    // Every subpath must be closed: an open path would fill as a wedge.
    const starts = (region.d.match(/M/g) ?? []).length;
    const closes = (region.d.match(/Z/g) ?? []).length;
    expect(starts).toBeGreaterThan(0);
    expect(closes).toBe(starts);
    // Coordinates stay in the board space.
    const numbers = region.d.match(/-?\d+(?:\.\d+)?/g) ?? [];
    expect(numbers.length).toBeGreaterThan(20);
    for (const value of numbers) {
      const n = Number(value);
      expect(Number.isFinite(n)).toBe(true);
      expect(Math.abs(n)).toBeLessThan(10_000);
    }
  }
});

test("the main region frames the printed map, not the photographed table", () => {
  const main = background.regions.find((region) => region.id === "main");
  expect(main).toBeDefined();
  const [x0, y0, x1, y1] = main!.box;
  const [px0, py0, px1, py1] = background.paper;
  expect(x0).toBe(px0);
  expect(y0).toBe(py0);
  expect(x1).toBe(px1);
  expect(y1).toBe(py1);
});

test("the inset regions sit inside the main region, as they are printed", () => {
  const main = background.regions.find((region) => region.id === "main")!;
  for (const region of background.regions.filter((candidate) => candidate.id !== "main")) {
    // Inset panels are printed on top of the main map, so their boxes overlap.
    expect(region.box[0]).toBeGreaterThanOrEqual(main.box[0]);
    expect(region.box[1]).toBeGreaterThanOrEqual(main.box[1]);
    expect(region.box[2]).toBeLessThanOrEqual(main.box[2]);
    expect(region.box[3]).toBeLessThanOrEqual(main.box[3]);
  }
});

test("every space falls inside the board, so a marker never floats off-paper", () => {
  const [x0, y0, x1, y1] = background.paper;
  const outside = SPACE_IDS.filter((id) => {
    const space = SPACES[id];
    return space.x < x0 || space.y < y0 || space.x > x1 || space.y > y1;
  });
  expect(outside).toEqual([]);
});

test("the African and American panels frame their own spaces", () => {
  for (const [submap, regionId] of [["africa", "africa"], ["northAmerica", "northAmerica"]] as const) {
    const region = background.regions.find((candidate) => candidate.id === regionId)!;
    const own = SPACE_IDS.filter((id) => SPACES[id].submap === submap);
    expect(own.length).toBeGreaterThan(0);
    for (const id of own) {
      const space = SPACES[id];
      expect(space.x).toBeGreaterThan(region.box[0]);
      expect(space.x).toBeLessThan(region.box[2]);
      expect(space.y).toBeGreaterThan(region.box[1]);
      expect(space.y).toBeLessThan(region.box[3]);
    }
  }
});
