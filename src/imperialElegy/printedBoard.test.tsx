/**
 * The printed board is a static reference sheet, so these tests are about
 * coverage and self-containment: every space, every chart, and nothing that
 * would make the downloaded SVG depend on the network.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {PrintedBoard} from "./components/PrintedBoard";
import fs from "fs";
import path from "path";
import {SPACES, SPACE_IDS} from "./constant/spaces";

const html = renderToStaticMarkup(<PrintedBoard/>);
const count = (pattern: RegExp): number => (html.match(pattern) ?? []).length;

test("the sheet uses the printed board's own coordinate space", () => {
  expect(html).toContain('data-testid="ie-printed-board"');
  expect(html).toContain('viewBox="480 532 6693 4382"');
  expect(html).toContain("Imperial Elegy");
});

test("every land space is printed exactly once, and every naval box is a plate", () => {
  const land = SPACE_IDS.filter((id) => SPACES[id].type !== "navalBox");
  const naval = SPACE_IDS.filter((id) => SPACES[id].type === "navalBox");
  expect(count(/data-printed-space="/g)).toBe(land.length);
  expect(count(/data-printed-naval="/g)).toBe(naval.length);
  expect(html).toContain(`data-spaces="${land.length}"`);
  expect(html).toContain(`data-naval="${naval.length}"`);
  for (const id of ["berlin", "london", "istanbul", "south-africa", "india"]) {
    expect(html).toContain(`data-printed-space="${id}"`);
  }
});

test("the printed charts are all on the sheet", () => {
  for (const text of [
    "END PHASE BUILD BOX",
    "Turn Track",
    "Great War Turn Track",
    "World Tension Track",
    "Flashpoints",
    "VP and Power Projection Track",
    "The Alliance Track",
    "Wartime Initiative Order",
    "Imperial",
    "ELEGY",
  ]) {
    expect(html).toContain(text);
  }
  expect(html).toContain("1850&#x27;s");
  expect(html).toContain("1910&#x27;s");
  expect(html).toContain("Roll on the");
});

test("counters carry flags and nameplates, not raster art", () => {
  expect(count(/data-flag="/g)).toBeGreaterThan(90);
  expect(count(/<image/g)).toBe(0);
  expect(html).not.toContain("<img");
  expect(html).not.toContain("http://");
  expect(html).not.toContain("https://");
  expect(html).not.toContain("data:image");
  // Nameplates are vector text.  Spot-check the long names that wrap.
  expect(html).toContain("NORTHERN");
  expect(html).toContain("AUSTRALIA &amp;");
  expect(html).toContain("NEW ZEALAND");
});

test("the printed network is drawn in its four styles", () => {
  expect(count(/stroke="#3b2e20"/g)).toBeGreaterThan(100);
  expect(html).toContain("stroke-dasharray");
  expect(html).toContain("stroke=\"#c0392b\"");
});

test("the published SVG snapshot is vector-only and covers the same board", () => {
  const file = path.join(__dirname, "../../public/imperial-elegy/maps/imperial-elegy-board.svg");
  expect(fs.existsSync(file)).toBe(true);
  const snapshot = fs.readFileSync(file, "utf8");
  expect(snapshot.startsWith("<?xml")).toBe(true);
  expect(snapshot).toContain('viewBox="480 532 6693 4382"');
  expect(snapshot).not.toContain("<image");
  const land = SPACE_IDS.filter((id) => SPACES[id].type !== "navalBox");
  expect((snapshot.match(/data-printed-space="/g) ?? []).length).toBe(land.length);
  expect((snapshot.match(/data-printed-naval="/g) ?? []).length).toBe(SPACE_IDS.length - land.length);
});

test("the sheet says which sheet it is, and offers the export", () => {
  expect(html).toContain('data-testid="ie-printed-download"');
  expect(html).toContain("Download SVG");
  expect(html).toContain("1 board unit = 1 SVG unit");
});
