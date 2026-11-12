/**
 * Agent 2 round 7 — rule 15.4.2 lone non-player defender war panel.
 *
 * A lone non-player war stores the non-player's control id in
 * `WarState.defender` (typed `Power`), so the old `t.seats[war.defender]`
 * lookup rendered a blank name and an unnamed 0 CP budget row.  These tests
 * render the board markup and assert the name resolves through the
 * minor-power / space-label helpers while player wars stay unchanged.
 *
 * Jest runs in a Node environment (no jsdom), so the board is rendered with
 * `renderToStaticMarkup` and the theme/map/i18n modules are stubbed exactly as
 * `board.test.tsx` does.
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
import {createWarState} from "../engine/limitedWar";
import type {ImperialElegyState, Power, WarState} from "../types";

const testCtx = {
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => {}, setPhase: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "prep",
} as unknown as Ctx;

const fresh = (): ImperialElegyState => {
  const G = setupImperialElegy(testCtx);
  G.phase = "wartime";
  G.activePower = "GE";
  G.pending = null;
  G.battle = null;
  G.war = null;
  return G;
};

const loneWar = (G: ImperialElegyState, minor: string, controlId = minor): WarState =>
  createWarState(G, "GE", controlId as Power, "conquest", ["schleswig-holstein"], 2, {
    minor: {minor, ally: null},
  });

const html = (G: ImperialElegyState): string =>
  renderToStaticMarkup(React.createElement(ImperialElegyBoard, {
    G,
    ctx: testCtx,
    moves: {},
    playerID: "0",
  }));

/** Inner markup of the first element carrying the test id, up to its close. */
const contentOf = (markup: string, testId: string): string => {
  const needle = `data-testid="${testId}"`;
  const start = markup.indexOf(needle);
  if (start === -1) return "";
  const rest = markup.slice(start + needle.length);
  const end = rest.indexOf("</div>");
  return end === -1 ? rest : rest.slice(0, end);
};

afterEach(() => {
  mockLocale = "en";
});

describe("15.4.2 lone non-player war panel", () => {
  test("names the non-player defender and hides its unnamed 0 budget row", () => {
    const G = fresh();
    G.war = loneWar(G, "Denmark");

    const markup = html(G);
    const defender = contentOf(markup, "ie-war-defender");
    expect(defender).toContain("Denmark");

    const budgets = contentOf(markup, "ie-war-budgets");
    expect(budgets).toContain("Germany");
    expect(budgets).not.toContain("Denmark");
    expect(budgets).not.toContain(" 0");

    // The lone defender is not repeated as a minor ally.
    expect(markup).not.toContain("ie-war-defender-minors");
    expect(markup).not.toContain("Minor allies");
  });

  test("maps the non-player control id IT to Italy", () => {
    const G = fresh();
    G.war = loneWar(G, "Italy", "IT");

    const defender = contentOf(html(G), "ie-war-defender");
    expect(defender).toContain("Italy");
    expect(defender).not.toContain("IT");
  });

  test("a player-defended war keeps both budget rows and adds minor allies", () => {
    const G = fresh();
    G.war = createWarState(G, "GE", "FR", "conquest", ["picardy"], 2);
    G.war.defenderMinors = ["Bavaria"];

    const markup = html(G);
    expect(contentOf(markup, "ie-war-defender")).toContain("France");
    const budgets = contentOf(markup, "ie-war-budgets");
    expect(budgets).toContain("Germany");
    expect(budgets).toContain("France");
    // 16.2 / 13.4: the minor ally is publicly named.
    expect(contentOf(markup, "ie-war-defender-minors")).toContain("Bavaria");
  });

  test("renders the non-player defender bilingually", () => {
    mockLocale = "zh_CN";
    const G = fresh();
    G.war = loneWar(G, "Denmark");

    const markup = html(G);
    expect(contentOf(markup, "ie-war-defender")).toContain("丹麦");
    const budgets = contentOf(markup, "ie-war-budgets");
    expect(budgets).not.toContain("丹麦");
    expect(markup).toContain("防守方");
  });
});
