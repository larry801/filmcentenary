/**
 * The live map is drawn in the printed sheet's language: paper counters,
 * national flags and nameplates.  This suite pins that layer without a DOM.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import {IEMap} from "./components/map";
import {setupImperialElegy} from "./engine/setup";

const ctx = {
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => {}, setPhase: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "prep",
} as unknown as Ctx;

const render = (locale: "en" | "zh_CN" = "zh_CN", selected: string | null = null): string => renderToStaticMarkup(
  <IEMap G={setupImperialElegy(ctx)} selected={selected} onSelect={() => {}} locale={locale}/>,
);

test("the live map prints flags on every controlled counter", () => {
  const html = render();
  expect(html).toContain('data-testid="ie-map"');
  expect(html).toContain('data-flag="GE"');
  expect(html).toContain('data-flag="UK"');
  expect(html).toContain('data-flag="FR"');
  expect((html.match(/data-flag="/g) ?? []).length).toBeGreaterThan(100);
});

test("the live map uses printed nameplates instead of free-floating labels", () => {
  const html = render("zh_CN", "malta");
  expect((html.match(/data-testid="ie-printed-nameplate"/g) ?? []).length).toBeGreaterThan(8);
  expect(html).toContain("马耳他");
});

test("naval boxes are plates, one per printed box", () => {
  const html = render();
  expect((html.match(/data-testid="ie-naval-plate"/g) ?? []).length).toBe(9);
});

test("the printed map still renders in English", () => {
  const html = render("en", "malta");
  expect(html).toContain("MALTA");
});
