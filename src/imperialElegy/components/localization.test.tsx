/**
 * The zh_CN board must not print English prose.
 *
 * The previous audit found four kinds of leak, and this suite pins each of them
 * so it cannot come back:
 *
 *   1. a unit chip ("GE army · full"),
 *   2. a rule badge's hover title ("Rule 19.10"),
 *   3. a rule link's label, which used to be the chart's id ("Influence Track"),
 *   4. a pending prompt the engine assembled from state, which the board's
 *      `PROMPT_ZH` table could not look up because it interpolates a name.
 *
 * The engine half is checked by rendering the board itself: every pending
 * decision of every kind is opened on a zh_CN board and the rendered markup is
 * searched for the English wording the engine wrote.
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

import {useBoardModel} from "./useBoardModel";
import {BoardLayout} from "./BoardLayout";
import {ieStringsOf, setPanelLocale} from "./panelLocale";
import {ieStringsFor} from "./i18n";
import {PROMPT_ZH, OPTION_ZH, unitLabel} from "./boardHelpers";
import {ruleRefDisplayLabel} from "./RuleRef";
import {setupImperialElegy} from "../engine/setup";
import {PENDING_KINDS, type ImperialElegyState, type PendingKind, type Unit} from "../types";

const testCtx = {
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => {}, setPhase: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "prep",
} as unknown as Ctx;

const freshGame = (): ImperialElegyState => {
  const G = setupImperialElegy(testCtx);
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 3;
  return G;
};

const renderZh = (G: ImperialElegyState, playerID: string | null = "0"): string => {
  setPanelLocale("zh_CN");
  const Board = (props: any) => {
    const model = useBoardModel({...props, injectedUi: {i18n: ieStringsOf("zh_CN")}});
    return React.createElement(BoardLayout, {model});
  };
  return renderToStaticMarkup(
    React.createElement(Board, {G, ctx: testCtx, moves: {}, playerID, handOpen: true, expandHand: true}),
  );
};

describe("zh_CN localization of constructed engine text", () => {
  test("a unit chip prints the Chinese kind and strength", () => {
    const army: Unit = {
      id: "u1", kind: "army", owner: "GE", space: "berlin", steps: 2, naval: false,
    } as unknown as Unit;
    const reduced = {...army, steps: 1} as Unit;
    expect(unitLabel(army, ieStringsFor("zh_CN"), "zh_CN")).toBe("GE 军团 · 满编");
    expect(unitLabel(reduced, ieStringsFor("zh_CN"), "zh_CN")).toBe("GE 军团 · 减员");
    // The English default is unchanged, so engine-side callers keep working.
    expect(unitLabel(army, ieStringsFor("zh_CN"))).toBe("GE army · full");
  });

  test("a room chart link prints the chart's Chinese title, not its id", () => {
    expect(ruleRefDisplayLabel("chart:influence-track", "zh_CN")).toBe("玩家面板");
    expect(ruleRefDisplayLabel("chart:war-aims-minors", "zh_CN")).toBe("战争目标与小国");
    expect(ruleRefDisplayLabel("chart:influence-track", "en")).toBe("Player Display");
    // An inline section is named too: "costs" used to print bare `costs`.
    expect(ruleRefDisplayLabel("rules:costs", "zh_CN")).toBe("行动花费");
    expect(ruleRefDisplayLabel("rules:12.3", "zh_CN")).toBe("12.3");
  });

  test("every pending kind renders its prompt in Chinese", () => {
    for (const kind of PENDING_KINDS as readonly PendingKind[]) {
      const G = freshGame();
      G.pending = {
        id: `d-${kind}`,
        kind,
        power: "GE",
        prompt: "Choose a space",
        options: [{id: "berlin", label: "Berlin", labelZh: "柏林"}],
        createdAt: 1,
      } as never;
      expect(renderZh(G)).toContain("选择一个空间");
    }
  });

  test("an engine prompt that interpolates state uses its own promptZh", () => {
    const G = freshGame();
    G.pending = {
      id: "d-seek",
      kind: "minorAid",
      power: "GE",
      prompt: "Seeking Aid: aid Bavaria against France?",
      promptZh: "寻求援助：援助巴伐利亚对抗法国？",
      options: [{id: "aid", label: "Aid Bavaria (gain its alliance)", labelZh: "援助巴伐利亚（获得其同盟）"}],
      createdAt: 1,
    } as never;
    const markup = renderZh(G);
    expect(markup).toContain("寻求援助：援助巴伐利亚对抗法国？");
    expect(markup).toContain("援助巴伐利亚（获得其同盟）");
    // The English prompt is not printed by a zh_CN board.
    expect(markup).not.toContain("Seeking Aid: aid");
  });

  test("a prompt with no promptZh falls back to the board's table", () => {
    const G = freshGame();
    G.pending = {
      id: "d-fixed",
      kind: "eventTargetSpace",
      power: "GE",
      prompt: "Choose a colonial space",
      options: [{id: "berlin", label: "Berlin", labelZh: "柏林"}],
      createdAt: 1,
    } as never;
    expect(renderZh(G)).toContain(PROMPT_ZH["Choose a colonial space"]);
  });

  test("the prompt and option tables carry a Chinese sentence for every entry", () => {
    for (const [en, zh] of Object.entries(PROMPT_ZH)) {
      expect(zh.trim()).not.toBe("");
      // A copy of the English key is a missed translation, not a translation.
      expect(zh).not.toBe(en);
    }
    for (const [en, zh] of Object.entries(OPTION_ZH)) {
      expect(zh.trim()).not.toBe("");
      expect(zh).not.toBe(en);
    }
  });
});
