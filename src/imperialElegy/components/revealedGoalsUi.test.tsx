/**
 * Revealed National Goals UI (33.1 Blood and Iron!, 33.3 Napoleon's Legacy).
 *
 * `G.revealedGoals` is the public faceup record while each power's `goals` stay
 * private in `playerView`.  The display row must therefore be visible to every
 * seat and to spectators, with the localized goal title and owning power.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";

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

import {ImperialElegyBoard} from "./board";
import {ImperialElegyGameDef} from "../game";
import {setupImperialElegy} from "../engine/setup";
import {GOALS_BY_ID} from "../constant/goals";
import type {ImperialElegyState} from "../types";

const testCtx = {
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => undefined, setPhase: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "action",
} as unknown as Ctx;

const fresh = (): ImperialElegyState => {
  const G = setupImperialElegy(testCtx);
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 3;
  G.wtt = 2;
  return G;
};

const html = (G: ImperialElegyState, playerID: string | null): string =>
  renderToStaticMarkup(React.createElement(ImperialElegyBoard, {
    G,
    ctx: testCtx,
    moves: {},
    playerID,
  }));

describe("revealed National Goals are public", () => {
  test("the goals row renders localized titles and the owning power", () => {
    const G = fresh();
    G.revealedGoals = ["NG-08", "NG-24"];
    const markup = html(G, "1");

    expect(markup).toContain("data-testid=\"ie-revealed-goals\"");
    expect(markup).toContain("已公开的国家目标");
    expect(markup).toContain(GOALS_BY_ID["NG-08"].titleZh);
    expect(markup).toContain(GOALS_BY_ID["NG-24"].titleZh);
    expect(markup).toContain(`data-testid="ie-revealed-goal-NG-08"`);
    expect(markup).toContain(`data-testid="ie-revealed-goal-NG-24"`);
  });

  test("a spectator also sees the revealed goals", () => {
    const G = fresh();
    G.revealedGoals = ["NG-08"];
    const markup = html(G, null);
    expect(markup).toContain("data-testid=\"ie-revealed-goals\"");
    expect(markup).toContain(GOALS_BY_ID["NG-08"].titleZh);
  });

  test("playerView keeps the revealed list public for opponents", () => {
    const G = fresh();
    G.revealedGoals = ["NG-08"];
    const view = ImperialElegyGameDef.playerView!(G, testCtx, "1");
    expect(view.revealedGoals).toEqual(["NG-08"]);
  });

  test("no revealed goals shows the empty label", () => {
    const G = fresh();
    const markup = html(G, "0");
    expect(markup).toContain("data-testid=\"ie-revealed-goals\"");
    expect(markup).toContain("暂无公开目标");
  });
});
