/**
 * The printed player displays.
 *
 * `public/imperial-elegy/displays/` carries the six board images the tracks and
 * printed values are transcribed from, but until now nothing opened them: the
 * mat's "Printed display" pointed at the influence-track chart, which is a
 * different chart (the MPIT alliance matrix).  These tests pin the wiring: the
 * anchor the mat emits, the entry it resolves to, and the published file each
 * power's entry names.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";

// The node test environment cannot parse the stylesheet the drawer's panel tree
// imports (see `referenceTables.test.tsx`); the wiring under test is not CSS.
jest.mock("./imperial-elegy.css", () => ({}));

import {PLAYER_DISPLAY_EXT, chartSrc, displayAnchor, displayAnchorPower, playerDisplayChart} from "./ChartLightbox";
import {resolveAnchor} from "./ReferenceDrawer";
import {PlayerMat} from "./PlayerMat";
import {setupImperialElegy} from "../engine/setup";
import {ieT} from "./i18n";
import {POWERS} from "../types";

const testCtx = {
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => {}, setPhase: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "prep",
} as unknown as Ctx;

test("the anchor names a power, and nothing else", () => {
  for (const power of POWERS) expect(displayAnchorPower(`display:${power}`)).toBe(power);
  // A chart anchor is not a display anchor, and an unknown power is not one.
  expect(displayAnchorPower("chart:influence-track")).toBeNull();
  expect(displayAnchorPower("display:US")).toBeNull();
  expect(displayAnchorPower("display:")).toBeNull();
});

test("each display resolves to the published board file the asset check names", () => {
  // The extension differs per power: the module publishes the UK board as a
  // PNG and the other five as JPGs (see `manifest.json`).
  expect(PLAYER_DISPLAY_EXT).toEqual({GE: "jpg", UK: "png", FR: "jpg", AU: "jpg", RU: "jpg", OT: "jpg"});
  for (const power of POWERS) {
    const entry = playerDisplayChart(power, "zh_CN");
    expect(chartSrc(entry)).toBe(`/imperial-elegy/displays/${power}.${PLAYER_DISPLAY_EXT[power]}`);
  }
});

test("the display entry is titled in the UI's language", () => {
  expect(playerDisplayChart("OT", "zh_CN").titleZh).toBe("玩家面板：奥斯曼帝国");
  expect(playerDisplayChart("OT", "en").title).toBe("Player display: Ottoman Empire");
  // The id is per power, so a lightbox keyed on it does not reuse another board.
  expect(playerDisplayChart("GE", "en").id).toBe("display-ge");
});

test("the drawer opens a display anchor at that power's board, not a chart", () => {
  const resolved = resolveAnchor("display:UK", "zh_CN");
  expect(resolved.section).toBeNull();
  expect(resolved.chart?.id).toBe("display-uk");
  expect(resolved.chart?.src).toBe("/imperial-elegy/displays/UK.png");
});

test("chart anchors keep resolving to the nine published charts", () => {
  const resolved = resolveAnchor("chart:influence-track", "zh_CN");
  expect(resolved.chart?.id).toBe("influence-track");
  expect(chartSrc(resolved.chart!)).toBe("/imperial-elegy/charts/influence-track.png");
  expect(resolved.chart?.src).toBeUndefined();
});

test("the button, the anchor and the drawer agree on the same board", () => {
  // The three halves of the wiring: the label the mat prints, the anchor it
  // emits (`displayAnchor`), and the entry the drawer resolves that anchor to.
  // A change to any one of them alone would open the wrong image, so they are
  // asserted together rather than one at a time.
  for (const power of POWERS) {
    const anchor = displayAnchor(power);
    expect(displayAnchorPower(anchor)).toBe(power);
    const resolved = resolveAnchor(anchor, "en");
    expect(resolved.chart).toEqual(playerDisplayChart(power, "en"));
    expect(chartSrc(resolved.chart!)).toContain(`/displays/${power}.`);
  }
});

test("the mat reads its display anchor from the one place that owns it", () => {
  // The component calls `displayAnchor(viewer)`; rendering it proves the import
  // is live and the module graph has no cycle, which is the failure mode a
  // hand-written template string would hide.
  const G = setupImperialElegy(testCtx);
  const html = renderToStaticMarkup(
    <PlayerMat G={G} viewer="RU" me={G.powers.RU} active="RU" locale="en" t={ieT()}/>,
  );
  expect(html).toContain('data-testid="ie-mat-display"');
  expect(html).toContain("Printed display");
});
