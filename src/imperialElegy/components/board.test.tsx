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
  return {
    IEMap: (props: any) => React.createElement("svg", {
      "data-testid": "ie-map",
      "data-move": (props.moveTargets ?? []).join(","),
      "data-battle": (props.battleTargets ?? []).join(","),
      "data-legal": (props.legalTargets ?? []).join(","),
    }),
  };
});

import {ImperialElegyBoard} from "./board";
import {setupImperialElegy} from "../engine/setup";
import {CARDS} from "../constant/cards.data";
import {GreatWarState, ImperialElegyState} from "../types";
import i18n from "../../constant/i18n";

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
  G.wtt = 2;
  return G;
};

const greatWarState = (
  combatCardsInFront: GreatWarState["combatCardsInFront"] = [],
): GreatWarState => ({
  active: true,
  turn: 2,
  order: ["GE", "UK", "FR", "AU", "RU", "OT"],
  belligerents: ["GE", "FR"],
  neutrals: [],
  te: ["GE"],
  ta: ["FR"],
  usIn: false,
  italyIn: false,
  usStability: 0,
  usManpower: 0,
  usBudget: 0,
  italyStability: 0,
  italyManpower: 0,
  italyBudget: 0,
  trenches: {},
  lastColonialWar: {africa: "te", asia: "ta"},
  victor: null,
  outbreakDone: true,
  nationalWillDone: false,
  bonusImpulses: [],
  combatCardsInFront,
});

const html = (G: ImperialElegyState, playerID: string | null): string =>
  renderToStaticMarkup(React.createElement(ImperialElegyBoard, {
    G,
    ctx: testCtx,
    moves: {},
    playerID,
  }));

const buttonTag = (markup: string, testId: string): string =>
  markup.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>[\\s\\S]*?</button>`))?.[0] ?? "";

const divTag = (markup: string, testId: string): string =>
  markup.match(new RegExp(`<div[^>]*data-testid="${testId}"[^>]*>[\\s\\S]*?</div>`))?.[0] ?? "";

describe("Imperial Elegy board controls", () => {
  test("active player sees impulse, card and MPIT controls", () => {
    const markup = html(freshGame(), "0");
    expect(markup).toContain("data-testid=\"ie-impulse-actions\"");
    expect(markup).toContain("data-testid=\"ie-mpit-controls\"");
    expect(markup).toContain("作为 CP 打出");
    expect(markup).toContain("放置大国影响力（1 CP）");
    expect(markup).toContain("data-testid=\"ie-mpit\"");
    expect(markup).not.toContain("data-testid=\"ie-pending\"");
    expect(markup).toContain("战役开始");
  });

  test("spectators and non-active seats do not receive private action controls", () => {
    const spectator = html(freshGame(), null);
    expect(spectator).toContain("观战者");
    expect(spectator).not.toContain("data-testid=\"ie-mpit-controls\"");
    expect(spectator).not.toContain("data-testid=\"ie-impulse-actions\"");

    const otherSeat = html(freshGame(), "1");
    expect(otherSeat).not.toContain("data-testid=\"ie-mpit-controls\"");
    expect(otherSeat).not.toContain("data-testid=\"ie-impulse-actions\"");
  });

  test("pending decision renders options and highlights legal spaces", () => {
    const G = freshGame();
    G.pending = {
      id: "d1",
      kind: "eventTargetSpace",
      power: "GE",
      prompt: "Choose a space",
      options: [{id: "berlin", label: "Berlin"}],
      createdAt: 1,
    };
    const markup = html(G, "0");
    expect(markup).toContain("data-testid=\"ie-pending\"");
    expect(markup).toContain("data-testid=\"ie-pending-option-berlin\"");
    expect(markup).toContain("data-legal=\"berlin\"");
    expect(markup).toContain("选择一个空间");
  });

  test("limited-war panel exposes aim, ally and maneuver controls only to a belligerent", () => {
    const G = freshGame();
    G.phase = "wartime";
    G.war = {
      attacker: "GE",
      defender: "FR",
      attackerAllies: [],
      defenderAllies: [],
      attackerMinors: [],
      defenderMinors: [],
      warAim: "conquest",
      objectives: ["berlin"],
      status: "warAim",
      budgets: {GE: 5, FR: 3},
      initiative: [],
      treaties: [],
      victor: null,
      truceTurns: 2,
      passed: [],
      startedTurn: 1,
    };
    const belligerent = html(G, "0");
    expect(belligerent).toContain("data-testid=\"ie-war\"");
    expect(belligerent).toContain("开始机动");
    expect(belligerent).toContain("召唤盟友");
    expect(belligerent).toContain("设定战争目标");
    expect(belligerent).toContain("投降");

    const spectator = html(G, null);
    expect(spectator).toContain("data-testid=\"ie-war\"");
    expect(spectator).not.toContain("开始机动");
    expect(spectator).not.toContain("召唤盟友");
  });

  test("Great War panel shows order, budgets and draft control on the active impulse", () => {
    const G = freshGame();
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.powers.GE.gwBudget = 3;
    G.gw = greatWarState();
    const markup = html(G, "0");
    expect(markup).toContain("data-testid=\"ie-gw\"");
    expect(markup).toContain("data-testid=\"ie-gw-draft\"");
    expect(markup).toContain("data-testid=\"ie-gw-pass\"");
    expect(markup).toContain("data-testid=\"ie-gw-winter\"");
    expect(markup).toContain("TE:");
    expect(markup).toContain("TA:");

    const spectator = html(G, null);
    expect(spectator).not.toContain("data-testid=\"ie-gw-draft\"");
  });

  test("Great War panel shows US/Italian stability and a surrender", () => {
    const G = freshGame();
    G.phase = "gwManeuver";
    G.gw = greatWarState();
    expect(html(G, "0")).not.toContain("data-testid=\"ie-gw-majors\"");

    G.gw.usIn = true;
    G.gw.usStability = 2;
    G.gw.usBudget = 4;
    G.gw.italySurrendered = true;
    const markup = html(G, "0");
    expect(markup).toContain("data-testid=\"ie-gw-majors\"");
    expect(markup).toContain("data-testid=\"ie-gw-major-US\" data-surrendered=\"false\"");
    expect(markup).toContain("2/3");
    expect(markup).toContain("data-testid=\"ie-gw-major-IT\" data-surrendered=\"true\"");
  });

  test("25.3: the Great War panel shows a unified Italy still outside the war", () => {
    const G = freshGame();
    G.phase = "gwManeuver";
    G.gw = greatWarState();
    // Not unified: 25.3 does not apply and there is nothing to show.
    expect(html(G, "0")).not.toContain("data-testid=\"ie-gw-italy-track\"");

    G.persistent.italyUnified = true;
    G.gw.italyAlliance = "teAligned";
    const aligned = html(G, "0");
    expect(aligned).toContain("data-testid=\"ie-gw-italy-track\" data-box=\"teAligned\"");
    expect(aligned).toContain("4–6");

    // A committed Italy joins automatically, so the panel says so.
    G.gw.italyAlliance = "taCommitted";
    expect(html(G, "0")).toContain("data-box=\"taCommitted\"");

    // Once Italy is in the war the readout becomes the stability/budget line.
    G.gw.italyIn = true;
    const joined = html(G, "0");
    expect(joined).not.toContain("data-testid=\"ie-gw-italy-track\"");
    expect(joined).toContain("data-testid=\"ie-gw-major-IT\"");
  });

  test("Great War panel shows an in-front combat card face down and another face up", () => {    const G = freshGame();
    G.phase = "gwManeuver";
    G.gw = greatWarState([
      {holder: "GE", cardId: "IE-GW-03", faceup: false},
      {holder: "FR", cardId: "IE-GW-04", faceup: true},
    ]);

    const markup = html(G, "0");
    expect(markup).toContain("data-testid=\"ie-gw-combat-cards-in-front\"");

    const facedown = divTag(markup, "ie-gw-in-front-IE-GW-03");
    expect(facedown).toContain("data-holder=\"GE\"");
    expect(facedown).toContain("data-faceup=\"false\"");
    expect(facedown).toContain("技术恐怖");
    expect(facedown).toContain("暗置");

    const faceup = divTag(markup, "ie-gw-in-front-IE-GW-04");
    expect(faceup).toContain("data-holder=\"FR\"");
    expect(faceup).toContain("data-faceup=\"true\"");
    expect(faceup).toContain("现代战争黎明");
    expect(faceup).toContain("明置");
  });

  test("Great War panel shows both in-front combat cards held by one power", () => {
    const G = freshGame();
    G.phase = "gwManeuver";
    // The legacy partial map is not the source of truth: the array holds both
    // cards (GW-03 and GW-04 may sit in front of the same power).
    G.flags.gwFaceupCombat = "GE:IE-GW-03";
    G.gw = greatWarState([
      {holder: "FR", cardId: "IE-GW-03", faceup: false},
      {holder: "FR", cardId: "IE-GW-04", faceup: true},
    ]);

    const markup = html(G, "0");
    const cards = [...markup.matchAll(/data-testid="ie-gw-in-front-(IE-GW-\d+)"/g)].map((match) => match[1]);
    expect(cards).toEqual(["IE-GW-03", "IE-GW-04"]);

    const first = divTag(markup, "ie-gw-in-front-IE-GW-03");
    expect(first).toContain("data-holder=\"FR\"");
    expect(first).toContain("data-faceup=\"false\"");
    expect(first).toContain("法国");
    expect(first).toContain("技术恐怖");

    const second = divTag(markup, "ie-gw-in-front-IE-GW-04");
    expect(second).toContain("data-holder=\"FR\"");
    expect(second).toContain("data-faceup=\"true\"");
    expect(second).toContain("法国");
    expect(second).toContain("现代战争黎明");
  });

  test("CP chain control is enabled only for a fresh impulse with chained cards", () => {
    const G = freshGame();
    const [first, second] = CARDS.actions;
    G.powers.GE.cpChain = [first.id, second.id];
    G.cpRemaining = 0;

    const ready = html(G, "0");
    const readyButton = buttonTag(ready, "ie-use-cp-chain");
    expect(readyButton).toContain("使用 CP 链");
    expect(readyButton).not.toContain("disabled");
    expect(ready).toContain("data-testid=\"ie-cp-chain\"");
    expect(ready).toContain(`data-testid="ie-cp-chain-total">${Math.min(first.cp + second.cp, 4)}/4`);
    expect(ready).toContain(first.titleZh);
    expect(ready).not.toContain("data-testid=\"ie-cp-chain-reason\"");

    // A half-spent impulse cannot start a chain-funded action.
    G.cpRemaining = 2;
    const halfSpent = html(G, "0");
    expect(buttonTag(halfSpent, "ie-use-cp-chain")).toContain("disabled");
    expect(halfSpent).toContain("请先结束本次行动");

    // Once used, the chain stays disabled for the rest of the action phase,
    // although the faceup cards remain visible until the phase ends.
    G.cpRemaining = 0;
    G.flags.cpChainSpent = true;
    const used = html(G, "0");
    expect(buttonTag(used, "ie-use-cp-chain")).toContain("disabled");
    expect(used).toContain("本行动阶段已使用");
    expect(used).toContain(first.titleZh);

    // A non-active seat cannot draw on its own (empty) chain.
    G.flags.cpChainSpent = false;
    const inactive = html(G, "1");
    expect(inactive).toContain("data-testid=\"ie-cp-chain\"");
    expect(buttonTag(inactive, "ie-use-cp-chain")).toContain("disabled");
  });
});

describe("Imperial Elegy decade header", () => {
  const header = (markup: string): string =>
    markup.match(/<div class="ie-sub">([^<]*)<\/div>/)?.[1] ?? "";

  afterEach(async () => {
    await i18n.locale("zh_CN");
  });

  test("localizes the 1860s and 1910s values instead of printing the raw decade", async () => {
    for (const [decade, zh] of [["1860s", "1860 年代"], ["1910s", "1910 年代"]] as const) {
      const G = freshGame();
      G.decade = decade;

      const chinese = header(html(G, "0"));
      expect(chinese).toContain(zh);
      expect(chinese).not.toContain(decade);

      await i18n.locale("en");
      const english = header(html(G, "0"));
      expect(english).toContain(decade);
      expect(english).not.toContain("年代");

      await i18n.locale("zh_CN");
    }
  });
});
