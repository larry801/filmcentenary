/**
 * Agent 2 round 7 — 16.2.3 war-reparation card markers held by a non-player
 * power.  Players track `cardMarkers` on their power display; a minor has no
 * display of its own, so the bookkeeping in `G.minorCardMarkers` is surfaced
 * in the player-displays panel, bilingual.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";

let mockLocale = "en";

jest.mock("./theme", () => {
  const React = require("react");
  return {
    IESurface: ({children, className}: any) => React.createElement("div", {className}, children),
    IEPanel: ({title, children, actions}: any) => React.createElement("section", null, React.createElement("h3", null, title), actions, children),
    IEBadge: ({children}: any) => React.createElement("span", null, children),
    IEChip: ({children}: any) => React.createElement("span", null, children),
  };
});

jest.mock("./map", () => {
  const React = require("react");
  return {IEMap: () => React.createElement("svg", {"data-testid": "ie-map"})};
});

jest.mock("../../constant/i18n", () => ({
  __esModule: true,
  default: {use: () => undefined, getLocaleName: () => mockLocale, locale: async () => undefined},
}));

import {ImperialElegyBoard} from "./board";
import {setupImperialElegy} from "../engine/setup";
import type {ImperialElegyState} from "../types";

const testCtx = {
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => {}, setPhase: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "prep",
} as unknown as Ctx;

const fresh = (): ImperialElegyState => {
  const G = setupImperialElegy(testCtx);
  G.phase = "action";
  G.activePower = "GE";
  G.pending = null;
  G.battle = null;
  G.war = null;
  return G;
};

const html = (G: ImperialElegyState): string =>
  renderToStaticMarkup(React.createElement(ImperialElegyBoard, {
    G,
    ctx: testCtx,
    moves: {},
    playerID: "0",
  }));

afterEach(() => {
  mockLocale = "en";
});

describe("16.2.3 minor card markers on the player displays", () => {
  test("lists each minor with its marker count", () => {
    const G = fresh();
    G.minorCardMarkers = {Denmark: 2, Serbia: 1};

    const markup = html(G);
    expect(markup).toContain('data-testid="ie-minor-card-markers"');
    expect(markup).toContain("War reparation markers (16.2.3)");
    expect(markup).toContain("Denmark · 2");
    expect(markup).toContain("Serbia · 1");
  });

  test("is bilingual", () => {
    mockLocale = "zh_CN";
    const G = fresh();
    G.minorCardMarkers = {Denmark: 2};

    const markup = html(G);
    expect(markup).toContain("战争赔款标记（16.2.3）");
    expect(markup).toContain("丹麦 · 2");
  });

  test("maps a non-player control id to its printed name", () => {
    const G = fresh();
    G.minorCardMarkers = {IT: 1};

    expect(html(G)).toContain("Italy · 1");
  });

  test("shows an empty readout and hides zero-count bookkeeping", () => {
    const empty = fresh();
    const emptyMarkup = html(empty);
    expect(emptyMarkup).toContain('data-testid="ie-minor-card-markers"');
    expect(emptyMarkup).toContain(">None<");

    const zero = fresh();
    zero.minorCardMarkers = {Denmark: 0};
    expect(html(zero)).not.toContain('data-testid="ie-minor-marker-Denmark"');
  });
});
