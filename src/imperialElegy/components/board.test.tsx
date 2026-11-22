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
      "data-legal": (props.targets ?? []).map((target: {id: string}) => target.id).join(","),
    }),
  };
});

import {useBoardModel} from "./useBoardModel";
import {BoardLayout} from "./BoardLayout";
import {ieStringsOf, setPanelLocale} from "./panelLocale";

/**
 * Whole-hook board for static markup: the five `useContext` hooks the board
 * reads are not part of React's identity, so calling the hook from a renderer
 * is safe, and the layout regions are the same components the host renders.
 */
// The suite runs the zh_CN UI: pin the locale and hand the board the real
// sentence table, so every assertion below is unambiguous.
const Board = (props: Parameters<typeof useBoardModel>[0]) => {
  setPanelLocale("zh_CN");
  // `injectedUi` on the props wins: the decade test asks for English.
  const model = useBoardModel({...props, injectedUi: props.injectedUi ?? {i18n: ieStringsOf("zh_CN")}});
  return React.createElement(BoardLayout, {model});
};
import {PendingPanel, TargetDock} from "./PendingPanel";
import {DecisionDock} from "./DecisionDock";
import {PhaseActions} from "./PhaseActions";
import {CardChoiceModal} from "./CardChoiceModal";
import {HandChoices} from "./HandChoices";
import {ieT} from "./i18n";
import {ImperialElegyGameDef} from "../game";
import {setupImperialElegy} from "../engine/setup";
import {CARDS} from "../constant/cards.data";
import {CARD_BY_ID} from "../engine/deck";
import {createWarState} from "../engine/limitedWar";
import {resolveWar, surrender} from "../moves";
import {advanceGwImpulse} from "../engine/greatWarFlow";
import {scoreGame} from "../engine/victory";
import {resolveAnchor} from "./ReferenceDrawer";
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
  renderToStaticMarkup(React.createElement(Board, {
    G,
    ctx: testCtx,
    moves: {},
    playerID,
    // These suites assert on the hand panel's contents (CP chain, card
    // transfers, save buttons), and the tray only renders them while open.
    handOpen: true,
      expandHand: true,
  }));

const buttonTag = (markup: string, testId: string): string =>
  markup.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>[\\s\\S]*?</button>`))?.[0] ?? "";

const divTag = (markup: string, testId: string): string =>
  markup.match(new RegExp(`<div[^>]*data-testid="${testId}"[^>]*>[\\s\\S]*?</div>`))?.[0] ?? "";

describe("Imperial Elegy board controls", () => {
  test("score breakdown opens from the command menu and prints on game over", () => {
    // The command menu is behind the track strip's toggle in static markup.
    expect(html(freshGame(), "0")).toContain('data-testid="ie-menu-toggle"');
    expect(resolveAnchor("rules:scores").section).toBe("scores");

    const done = freshGame();
    done.powers.GE.goals = ["NG-01"];
    const {scores, breakdown} = scoreGame(done);
    done.result = {winners: ["GE"], reason: "test", scores, breakdown};
    const markup = html(done, "0");
    expect(markup).toContain('data-testid="ie-final-score"');
    expect(markup).toContain('data-testid="ie-score-panel"');
    expect(markup).toContain('data-testid="ie-score-GE"');
  });

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
      treaties: ["territorialCession", "warReparations"],
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
    // 13.6: only the defender may concede before maneuver; 15.5 opens the
    // attacker's offer at a wartime impulse boundary.
    expect(buttonTag(belligerent, "ie-surrender")).toBe("");
    expect(buttonTag(html(G, "2"), "ie-surrender")).not.toBe("");
    // 16.2: the war panel shows human treaty labels, never the stored keys.
    // This suite renders the zh_CN UI, so the printed Chinese label is expected.
    expect(belligerent).toContain("领土割让");
    expect(belligerent).toContain("战争赔款");
    expect(belligerent).not.toContain("territorialCession");
    expect(belligerent).not.toContain("warReparations");

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

  test("engine-supplied pending option text renders in Chinese, with no decorated id", () => {
    const G = freshGame();
    G.pending = {
      id: "d-treaty",
      kind: "treatyOption",
      power: "GE",
      prompt: "Choose a treaty option",
      options: [{
        id: "territorialCession@UK#AU",
        label: "Territorial Cession (Germany) — Austria-Hungary",
        labelZh: "领土割让（德国）— 奥匈帝国",
      }],
      createdAt: 1,
    };

    const markup = html(G, "0");
    const option = buttonTag(markup, "ie-pending-option-territorialCession@UK#AU");
    const label = option.slice(option.indexOf(">") + 1, option.lastIndexOf("<"));
    expect(label).toBe("领土割让（德国）— 奥匈帝国");
    // Only the label is visible; the decorated id stays an internal handle.
    expect(label).not.toContain("territorialCession");
    expect(label).not.toContain("Territorial Cession");
  });

  test("the live righteous-defense liberation choice renders its nationality in the treaty panel", () => {
    const G = freshGame();
    G.phase = "wartime";
    G.activePower = "FR";
    G.war = createWarState(G, "AU", "FR", "conquest", ["provence"], 2);
    G.war.victor = "defender";
    G.spaces.bohemia.occupiedBy = "FR";
    expect(resolveWar(G, {...testCtx, playerID: "2"})).toBeUndefined();
    const markup = html(G, "2");
    const button = buttonTag(markup, "ie-pending-option-righteousDefense:liberate:bohemia:Czechs");
    expect(button).toContain("正义防御：解放波希米亚的捷克民族");
    expect(button).not.toContain("disabled");
  });

  test("the live bonus-impulse chooser renders bilingual player and skip buttons for the deciding seat", () => {
    const G = freshGame();
    G.gw = greatWarState();
    G.gw.te = ["UK", "FR"];
    G.gw.ta = ["GE", "AU", "RU"];
    G.gw.belligerents = ["GE", "UK", "FR", "AU", "RU"];
    G.gw.order = ["GE", "UK", "AU", "FR", "RU", "bonus"];
    G.gw.bonusImpulseSide = "te";
    // 25.7.1: the chooser only opens for allies that still have a GW budget;
    // the live flow grants this in beginGwTurn, which a board fixture skips.
    for (const power of ["UK", "FR"] as const) G.powers[power].gwBudget = 2;
    G.phase = "gwManeuver";
    G.activePower = "RU";
    G.turnIndex = 4;
    expect(advanceGwImpulse(G, testCtx)).toMatchObject({kind: "choice"});
    const markup = html(G, "1");
    expect(markup).toContain("奖励行动轮：选择一位联盟成员行动，或跳过");
    expect(buttonTag(markup, "ie-pending-option-FR")).toContain("由法国行动");
    expect(buttonTag(markup, "ie-pending-option-skip")).toContain("跳过本次奖励行动轮");
    expect(buttonTag(html(G, "4"), "ie-pending-option-FR")).toBe("");
  });

  test("the surrender control opens the defending seat's accept/refuse choices", () => {
    const G = freshGame();
    G.phase = "wartime";
    G.war = createWarState(G, "GE", "FR", "conquest", ["alsace-lorraine"], 2);
    G.war.status = "maneuver";
    expect(buttonTag(html(G, "0"), "ie-surrender")).not.toBe("");
    expect(surrender(G, {...testCtx, playerID: "0"})).toBeUndefined();
    const defender = html(G, "2");
    expect(buttonTag(defender, "ie-pending-option-accept")).toContain("接受投降（重大胜利）");
    expect(buttonTag(defender, "ie-pending-option-refuse")).toContain("拒绝投降，继续战争");
    expect(defender).toContain("接受进攻方投降，还是继续战争？");
    expect(buttonTag(html(G, "0"), "ie-pending-option-accept")).toBe("");
    expect(buttonTag(defender, "ie-surrender")).toBe("");
  });

  test("the pending decision is docked above the layout so it cannot scroll out of view", () => {
    const G = freshGame();
    G.pending = {
      id: "d-dock",
      kind: "eventTargetSpace",
      power: "GE",
      prompt: "Choose a space",
      options: [{id: "berlin", label: "Berlin"}],
      createdAt: 1,
    };
    const markup = html(G, "0");
    // The decision this seat owes is a dialog over the board, not a panel in the
    // Orders body: it is a blocker, and inline it pushed the action list below
    // the fold.
    const modal = markup.indexOf("data-testid=\"ie-decision-modal\"");
    expect(modal).toBeGreaterThan(-1);
    expect(markup).toContain("data-testid=\"ie-decision-modal-backdrop\"");
    expect(markup.indexOf("data-testid=\"ie-pending-option-berlin\"")).toBeGreaterThan(modal);
    // It cannot be dismissed: the step cannot continue without an answer.
    expect(markup).toContain('data-dismissible="false"');
    expect(markup).not.toContain("data-testid=\"ie-choice-close\"");
    expect(markup).not.toContain("data-testid=\"ie-dock-toggle\"");
    // The Orders body is still there behind the dialog, so the tab strip and
    // the space's actions survive the decision.
    expect(markup).toContain("data-testid=\"ie-turn-panel-action\"");
  });

  test("another seat's decision stays a read-only panel, not a dialog", () => {
    const G = freshGame();
    G.pending = {
      id: "d-other",
      kind: "eventTargetSpace",
      power: "FR",
      prompt: "Choose a space",
      options: [{id: "berlin", label: "Berlin"}],
      createdAt: 1,
    };
    // GE is the active seat; the decision belongs to FR, so GE is only told
    // about it.  A dialog here would cover a board its reader cannot answer.
    const markup = html(G, "0");
    expect(markup).not.toContain("data-testid=\"ie-decision-modal\"");
    expect(markup).toContain("data-testid=\"ie-pending\"");
    expect(markup).toContain("等待");
  });

  test("the dock is the control bar for the active seat and is absent for a spectator", () => {
    // Phase buttons now live in the dock, so a seat with something to press
    // always gets one; a spectator has nothing to press and gets none.
    const active = html(freshGame(), "0");
    expect(active).toContain("data-testid=\"ie-dock\"");
    expect(active).toContain("data-testid=\"ie-phase-actions\"");

    // A spectator keeps the panel (orders explain why nothing may be done,
    // and the log works) but never gets a private action control.
    const spectator = html(freshGame(), null);
    expect(spectator).toContain("data-testid=\"ie-dock\"");
    expect(spectator).toContain("data-testid=\"ie-turn-panel-log\"");
    expect(spectator).not.toContain("data-testid=\"ie-mpit-controls\"");
  });

  test("the phase buttons render in the dock bar, not the hand panel header", () => {
    const G = freshGame();
    G.phase = "action";
    G.activePower = "GE";
    G.cpRemaining = 0;
    const markup = html(G, "0");
    const dock = markup.indexOf("data-testid=\"ie-dock\"");
    const layout = markup.indexOf("class=\"ie-table\"");
    expect(dock).toBeGreaterThan(-1);
    // The phase buttons sit once, in the turn panel head next to the CP
    // readout: the strip above reports the position and nothing else, so the
    // same test id is never rendered twice.
    const first = markup.indexOf("data-testid=\"ie-impulse-actions\"");
    expect(first).toBeGreaterThan(layout);
    expect(markup.indexOf("data-testid=\"ie-impulse-actions\"", first + 1)).toBe(-1);
    // 12.0 has one exit, not two: the dock shows a single button whose label
    // follows the impulse state, and the separate end-impulse button is gone.
    expect(buttonTag(markup, "ie-pass")).toContain("停牌");
    expect(markup).not.toContain("ie-end-impulse");
    expect(markup).not.toContain("ie-hand-panel-actions");
  });

  test("the single exit is relabelled once the seat has acted", () => {
    const G = freshGame();
    G.phase = "action";
    G.activePower = "GE";
    // A fresh impulse (no CP banked, no card played) reads as 停牌 …
    G.cpRemaining = 0;
    expect(buttonTag(html(G, "0"), "ie-pass")).toContain("停牌");

    // … and a used one (a card was played) reads as 结束行动轮.
    G.cpRemaining = 1;
    G.powers.GE.flags.actionCpSpentThisImpulse = true;
    const used = buttonTag(html(G, "0"), "ie-pass");
    expect(used).toContain("结束行动轮");
    expect(used).not.toContain("disabled");
  });

  test("a collapsed DecisionDock keeps the summary and phase buttons but hides the body", () => {
    const summary = "你的行动轮 · 剩余 3 CP";
    const open = renderToStaticMarkup(React.createElement(DecisionDock, {
      summary,
      collapsed: false,
      onToggleCollapsed: () => undefined,
      locale: "zh_CN" as const,
      actions: React.createElement(PhaseActions, {
        title: "行动",
        locale: "zh_CN" as const,
        actions: [{key: "pass", label: "停牌", testId: "ie-pass", onClick: () => undefined}],
      }),
      children: React.createElement("div", {"data-testid": "ie-dock-child"}, "body"),
    }));
    expect(open).toContain("data-testid=\"ie-dock-child\"");

    const collapsed = renderToStaticMarkup(React.createElement(DecisionDock, {
      summary,
      collapsed: true,
      onToggleCollapsed: () => undefined,
      locale: "zh_CN" as const,
      actions: React.createElement(PhaseActions, {
        title: "行动",
        locale: "zh_CN" as const,
        actions: [{key: "pass", label: "停牌", testId: "ie-pass", onClick: () => undefined}],
      }),
      children: React.createElement("div", {"data-testid": "ie-dock-child"}, "body"),
    }));
    expect(collapsed).toContain("data-testid=\"ie-dock-summary\"");
    expect(collapsed).toContain(summary);
    expect(collapsed).toContain("aria-expanded=\"false\"");
    expect(collapsed).toContain("展开");
    // Collapsing must not take the phase buttons with it.
    expect(collapsed).toContain("data-testid=\"ie-pass\"");
    expect(collapsed).not.toContain("data-testid=\"ie-dock-child\"");
  });

  test("a pending decision keeps its options in the turn panel", () => {    const G = freshGame();
    G.pending = {
      id: "d-expanded",
      kind: "eventTargetSpace",
      power: "GE",
      prompt: "Choose a space",
      options: [{id: "berlin", label: "Berlin"}],
      createdAt: 1,
    };
    const markup = html(G, "0");
    expect(markup).toContain("data-testid=\"ie-dock\"");
    expect(markup).toContain("data-testid=\"ie-pending-option-berlin\"");
    expect(markup).toContain("data-testid=\"ie-turn-tab-action\"");
  });

  test("the target instruction strip renders the prompt and a cancel button", () => {
    const stripe = renderToStaticMarkup(React.createElement(TargetDock, {
      title: "选择战斗目标",
      body: "从柏林出击：在地图上点击高亮的相邻空间。",
      cancelLabel: "取消",
      onCancel: () => undefined,
    }));
    expect(stripe).toContain("data-testid=\"ie-dock-target\"");
    expect(stripe).toContain("选择战斗目标");
    expect(stripe).toContain("从柏林出击");
    expect(buttonTag(stripe, "ie-dock-target-cancel")).toContain("取消");
  });

  test("the home-card choice waits behind the negotiation table instead of popping up", () => {
    const G = freshGame();
    G.phase = "diplomacy";
    G.activePower = "GE";
    const markup = html(G, "0");
    // 9.1: negotiation comes first.  The choice must not cover the table the
    // instant diplomacy opens, or talking (11.0) and dealing (11.1) is
    // impossible.
    expect(markup).not.toContain("data-testid=\"ie-choice-modal\"");
    // The step is still owed, and says so in the dock and in the hand tray.
    expect(markup).toContain("尚未选择本土牌");
    expect(markup).toContain("data-testid=\"ie-hand-choices-hint\"");
    expect(markup).toContain("先进行谈判");
    // The seat opens it from the dock, and the Deals page offers the same step.
    expect(markup).toContain("data-testid=\"ie-open-home-card\"");
    expect(markup).toContain("data-testid=\"ie-deals-home-step\"");
    expect(markup).toContain("data-testid=\"ie-open-home-card-from-deals\"");
    // The hand panel does not duplicate the card buttons.
    expect(markup.match(/data-testid="ie-home-card-choice"/g)).toBeNull();
  });

  test("the home-card dialog is dismissible: the choice stays owed when it is closed", () => {
    // The dialog itself is opened by the reader, so it must be closable; the
    // engine still refuses `endDiplomacy` until a card is chosen.
    const html = renderToStaticMarkup(
      React.createElement(CardChoiceModal, {
        open: true,
        dismissible: true,
        locale: "zh_CN" as const,
        title: "选择本土牌",
        continueLabel: "暂时关闭——稍后再选",
        onClose: () => undefined,
        children: React.createElement("p", {"data-testid": "choice-body"}, "cards"),
      }),
    );
    expect(html).toContain('data-dismissible="true"');
    expect(html).toContain('data-testid="ie-choice-close"');
    expect(html).toContain("暂时关闭——稍后再选");
  });

  test("a home-card choice renders the printed face, not just its title", () => {
    const G = freshGame();
    G.phase = "diplomacy";
    G.activePower = "GE";
    const home = G.powers.GE.homeCards[0];
    // The face carries the card id and the rules text; the button stays bare.
    const markup = renderToStaticMarkup(React.createElement(HandChoices, {
      viewer: "GE",
      me: G.powers.GE,
      locale: "zh_CN",
      t: ieT(),
      phase: "diplomacy",
      canPhaseAct: true,
      hand: G.powers.GE.hand,
      ngChoices: [],
      doAction: (fn: () => void) => fn(),
      moves: {},
    }));
    expect(markup).toContain(`data-card-id="${home}"`);
    const face = markup.match(new RegExp(`<article[^>]*data-testid="ie-home-card-${home}"[\\s\\S]*?</article>`))?.[0] ?? "";
    expect(face).toContain("<svg");
    expect(face).toContain(CARD_BY_ID[home].titleZh);
    expect(face).toContain(`data-testid="ie-choose-home-${home}"`);
  });

  test("the end-phase National Goal pick shows each candidate's face", () => {
    const G = freshGame();
    G.phase = "end";
    const drawn = G.powers.GE.goalDeck.slice(0, 3);
    G.powers.GE.flags.ngChoices = drawn.join(",");
    const markup = html(G, "0");
    for (const id of drawn) {
      expect(markup).toContain(`data-testid="ie-ng-card-${id}"`);
      expect(markup).toContain(`data-testid="ie-choose-goal-${id}"`);
    }
    const first = markup.match(new RegExp(`<article[^>]*data-testid="ie-ng-card-${drawn[0]}"[\\s\\S]*?</article>`))?.[0] ?? "";
    expect(first).toContain("<svg");
  });

  test("the stability discard shows a random-draw control, not a card pick", () => {
    const G = freshGame();
    G.phase = "prep";
    G.activePower = "GE";
    G.powers.GE.flags.prepStability = false;
    const markup = html(G, "0");
    // The card is drawn at random, so the dock must never render a per-card
    // choice (that would let the player pick the card).
    expect(markup).toContain(`data-testid="ie-discard-random"`);
    expect(markup).not.toMatch(/data-testid="ie-discard-card-/);
    expect(markup).not.toMatch(/data-testid="ie-discard-IE-/);
  });

  test("a pending decision that names a card renders its face with the option button", () => {
    const G = freshGame();
    const card = CARDS.actions.find((entry) => entry.kind === "action" && entry.type !== "combat")!;
    G.pending = {
      id: "d-card",
      kind: "combatDiscard",
      power: "GE",
      prompt: "At Any Cost: discard a card to play it from the discard pile",
      options: [{id: card.id, label: card.title, data: {card: card.id}}],
      createdAt: 1,
    };
    const markup = html(G, "0");
    expect(markup).toContain("data-testid=\"ie-pending-cards\"");
    expect(markup).toContain(`data-testid="ie-pending-card-${card.id}"`);
    // The existing option selector still resolves the move.
    expect(markup).toContain(`data-testid="ie-pending-option-${card.id}"`);
    const face = markup.match(new RegExp(`<article[^>]*data-testid="ie-pending-card-${card.id}"[\\s\\S]*?</article>`))?.[0] ?? "";
    expect(face).toContain("<svg");
    expect(face).toContain(card.titleZh);
  });

  test("a goal option in a pending decision renders the Goal face", () => {
    const G = freshGame();
    const goal = G.powers.GE.goalDeck[0];
    G.pending = {
      id: "d-goal",
      kind: "goalChoice",
      power: "GE",
      prompt: "Draw three National Goals and keep one",
      options: [{id: goal, label: "Goal"}],
      createdAt: 1,
    };
    const markup = html(G, "0");
    expect(markup).toContain(`data-testid="ie-pending-card-${goal}"`);
    const face = markup.match(new RegExp(`<article[^>]*data-testid="ie-pending-card-${goal}"[\\s\\S]*?</article>`))?.[0] ?? "";
    expect(face).toContain("<svg");
  });

  test("a face-down auction bid shows its face to the bidder but stays hidden from others", () => {
    const G = freshGame();
    const card = CARDS.actions.find((entry) => entry.kind === "action")!;
    G.pending = {
      id: "d-auction",
      kind: "eventChoice",
      power: "GE",
      prompt: "Moroccan Crisis: play a card face down",
      options: [
        {id: `card:${card.id}`, label: card.title, data: {card: card.id}, secret: true},
        {id: "pass", label: "Play no card"},
      ],
      createdAt: 1,
    };
    // The deciding seat must recognise the card it is bidding.
    const own = html(G, "0");
    expect(own).toContain(`data-testid="ie-pending-card-${card.id}"`);

    // An opponent (or spectator) never sees which card is hidden: no options
    // at all, and therefore no face.
    for (const playerID of ["1", null]) {
      const markup = html(G, playerID);
      expect(markup).not.toContain("data-testid=\"ie-pending-cards\"");
      const dock = markup.slice(markup.indexOf("data-testid=\"ie-dock\""), markup.indexOf("class=\"ie-table\""));
      expect(dock).not.toContain(`data-card-id="${card.id}"`);
      expect(dock).not.toContain(card.titleZh);
    }
  });

  test("spaces, powers and units keep plain option buttons", () => {
    const G = freshGame();
    G.pending = {
      id: "d-space",
      kind: "eventTargetSpace",
      power: "GE",
      prompt: "Choose a space",
      options: [{id: "berlin", label: "Berlin"}],
      createdAt: 1,
    };
    const markup = html(G, "0");
    expect(markup).not.toContain("data-testid=\"ie-pending-cards\"");
    expect(markup).toContain("data-testid=\"ie-pending-option-berlin\"");
  });

  test("the end-phase National Goal pick is raised as a dismissible dialog", () => {
    const G = freshGame();
    G.phase = "end";
    G.powers.GE.flags.ngChoices = "G1,G2,G3";
    const markup = html(G, "0");
    const modal = markup.indexOf("data-testid=\"ie-choice-modal\"");
    const choice = markup.indexOf("data-testid=\"ie-goal-choice\"");
    expect(choice).toBeGreaterThan(-1);
    expect(choice).toBeGreaterThan(modal);
    expect(markup.match(/data-testid="ie-goal-choice"/g)).toHaveLength(1);
    // Continue-with-the-first-Goal is legal, so this one may be closed.
    expect(markup).toContain('data-dismissible="true"');
    expect(markup).toContain("data-testid=\"ie-choice-close\"");
    expect(markup).toContain("继续（保留第一张目标）");
  });

  test("the prep-phase stability discard is one line at the top of the Actions page", () => {
    const G = freshGame();
    G.phase = "prep";
    G.flags = {...G.flags};
    G.powers.GE.flags.prepStability = false;
    const markup = html(G, "0");
    // A skippable choice is not a blocker: it stays inline, above the action
    // list, and never becomes a dialog.
    expect(markup).toContain("data-testid=\"ie-stability-discard\"");
    expect(markup.match(/data-testid="ie-stability-discard"/g)).toHaveLength(1);
    expect(markup).not.toContain("data-testid=\"ie-choice-modal\"");
    const discard = markup.indexOf("data-testid=\"ie-stability-discard\"");
    const actions = markup.indexOf("data-testid=\"ie-orders-panel-actions\"");
    expect(actions).toBeGreaterThan(-1);
    expect(discard).toBeGreaterThan(actions);
  });

  test("the stability discard is marked optional and says it may be skipped", () => {
    const G = freshGame();
    G.phase = "prep";
    G.activePower = "GE";
    G.powers.GE.flags.prepStability = false;
    const markup = html(G, "0");
    // A dashed frame and an "optional" tag distinguish it from a blocker.
    expect(markup).toContain("ie-dock-choice-optional");
    expect(markup).toContain(`data-testid="ie-stability-discard-optional"`);
    expect(markup).toContain("可选");
    // The hint names the way out: press Ready without discarding.
    const hint = markup.slice(
      markup.indexOf(`data-testid="ie-stability-discard-hint"`),
      markup.indexOf(`data-testid="ie-stability-discard-hint"`) + 400,
    );
    expect(hint).toContain("也可跳过");
    expect(hint).toContain("准备完毕");
    // The dock summary must not claim a choice is required.
    expect(markup).toContain("可选：随机弃牌换稳定");
    expect(markup).not.toContain("需要选择卡牌");
    // The ready button is right there to continue without discarding.
    expect(buttonTag(markup, "ie-finish-prep")).toContain("准备完毕");
  });

  test("the mandatory home card and Goal choices are not marked optional", () => {
    const home = freshGame();
    home.phase = "diplomacy";
    home.activePower = "GE";
    const homeMarkup = html(home, "0");
    // 9.1: the home card is still required, but the dock reports the step it
    // owes rather than a dialog that has already covered the table.
    expect(homeMarkup).toContain("尚未选择本土牌");
    expect(homeMarkup).not.toContain("ie-dock-choice-optional");
    expect(homeMarkup).not.toContain(`data-testid="ie-stability-discard-optional"`);

    const goal = freshGame();
    goal.phase = "end";
    goal.powers.GE.flags.ngChoices = goal.powers.GE.goalDeck.slice(0, 3).join(",");
    const goalMarkup = html(goal, "0");
    expect(goalMarkup).toContain("需要选择卡牌");
    expect(goalMarkup).not.toContain("ie-dock-choice-optional");
  });

  test("the discard is only offered when a legal card is in hand", () => {
    const G = freshGame();
    G.phase = "prep";
    G.activePower = "GE";
    G.powers.GE.flags.prepStability = false;
    G.powers.GE.hand = [];
    const markup = html(G, "0");
    // Nothing to discard means no empty optional section in the dock.
    expect(markup).not.toContain("data-testid=\"ie-stability-discard\"");
    expect(markup).not.toContain("可选：随机弃牌换稳定");
  });

  test("an already-used stability discard stops being offered", () => {
    const G = freshGame();
    G.phase = "prep";
    G.activePower = "GE";
    G.powers.GE.flags.prepStability = true;
    const markup = html(G, "0");
    expect(markup).not.toContain("data-testid=\"ie-stability-discard\"");
  });

  test("11.0 shows a card from the hand and the deals page owns the offers", () => {
    const G = freshGame();
    G.phase = "diplomacy";
    G.activePower = "GE";
    G.powers.GE.hand = ["IE-A018", "IE-A019"];
    const markup = html(G, "0");

    // 11.0: "Players are allowed to show other players their action cards."
    // The row offers the public show; no card face is previewed, because the
    // show is the player's own choice and the card is already in hand.
    expect(markup).toContain('data-testid="ie-show-card-IE-A018"');
    expect(markup).toContain('data-testid="ie-show-card-IE-A019"');

    // 11.1's formal agreement is not a hand-panel button any more: the offer
    // form lives on the Orders panel's deals page, where both counts and the
    // promises are entered.
    expect(markup).not.toContain('data-testid="ie-give-card"');
    expect(markup).toContain('data-testid="ie-orders-tab-deals"');
    expect(markup).toContain('data-testid="ie-deals-form"');
  });

  test("every move the board calls is registered on the game definition", () => {
    // The deploy-reserves control calls `moves.deployReserves`; a missing entry
    // in ALL_MOVES makes that button throw at runtime.
    expect(typeof (ImperialElegyGameDef.moves as unknown as Record<string, unknown>).deployReserves).toBe("function");
  });
});

describe("Imperial Elegy decade header", () => {
  // The decade moved from the board header into the track strip's second
  // line (`<span class="ie-track-decade-label ie-sub">…</span>`).
  const header = (markup: string): string =>
    markup.match(/class="ie-track-decade-label ie-sub">([^<]*)</)?.[1] ?? "";

  afterEach(async () => {
    await i18n.locale("zh_CN");
  });

  test("localizes the 1860s and 1910s values instead of printing the raw decade", async () => {
    for (const [decade, zh] of [["1860s", "1860年代"], ["1910s", "1910年代"]] as const) {
      const G = freshGame();
      G.decade = decade;

      const chinese = header(html(G, "0"));
      expect(chinese).toContain(zh);
      expect(chinese).not.toContain(decade);

      // The English side: the board reads the module's locale unless a suite
      // pins one, so render through a wrapper that says "en" for this step.
      const english = header(renderToStaticMarkup(React.createElement(Board, {
        G, ctx: testCtx, moves: {}, playerID: "0",
        injectedUi: {i18n: ieStringsOf("en"), locale: {current: "en"}},
      } as never)));
      expect(english).toContain(decade);
      expect(english).not.toContain("年代");
    }
  });
});

describe("Rule 34 handover control", () => {
  // The board sends the engine's `setSeatBot` move; the static renderer only
  // needs the move bag to contain that name for the control to appear.
  const withMove = (markup: string) => markup.includes('data-testid="ie-hand-over-seat"');

  test("a human seat offers the handover control when the move exists", () => {
    const markup = renderToStaticMarkup(React.createElement(Board, {
      G: freshGame(), ctx: testCtx, playerID: "0",
      moves: {setSeatBot: () => undefined} as never,
    }));
    expect(withMove(markup)).toBe(true);
    expect(markup).toContain("交给机器人托管");
  });

  test("a board that opts out (the solo page) renders no handover control", () => {
    const markup = renderToStaticMarkup(React.createElement(Board, {
      G: freshGame(), ctx: testCtx, playerID: "0", allowSeatHandover: false,
      moves: {setSeatBot: () => undefined} as never,
    }));
    expect(withMove(markup)).toBe(false);
  });

  test("a board without the move renders no handover control", () => {
    const markup = renderToStaticMarkup(React.createElement(Board, {
      G: freshGame(), ctx: testCtx, playerID: "0", moves: {},
    }));
    expect(withMove(markup)).toBe(false);
  });

  test("an open decision hides the control", () => {
    // Handing a seat over mid-question would leave the question with a
    // controller that cannot see it, so the control is withheld instead.
    const G = freshGame();
    G.pending = {
      id: "d1",
      createdAt: 1,
      kind: "confirm",
      power: "GE",
      prompt: "Confirm?",
      options: [{id: "yes", label: "Yes"}],
    } as never;
    const markup = renderToStaticMarkup(React.createElement(Board, {
      G, ctx: testCtx, playerID: "0",
      moves: {setSeatBot: () => undefined} as never,
    }));
    expect(withMove(markup)).toBe(false);
  });

  test("a bot seat shows the take-back control instead", () => {
    const G = freshGame();
    G.bots = ["GE"];
    const markup = renderToStaticMarkup(React.createElement(Board, {
      G, ctx: testCtx, playerID: "0",
      moves: {setSeatBot: () => undefined} as never,
    }));
    expect(withMove(markup)).toBe(false);
    expect(markup).toContain('data-testid="ie-bot-banner"');
    expect(markup).toContain('data-testid="ie-take-back-seat"');
    expect(markup).toContain("收回席位");
  });
});

describe("the public battle result dialog", () => {
  const withReport = (): ImperialElegyState => {
    const G = freshGame();
    G.battle = null;
    G.battleReport = {
      id: "battle-1-7-land-saxony",
      kind: "land",
      from: "berlin",
      to: "saxony",
      attacker: "GE",
      defender: "FR",
      winner: "attacker",
      decisive: false,
      attackerRoll: 4,
      defenderRoll: 4,
      differential: 0,
      attackerDrm: 0,
      defenderDrm: 0,
      attackerLosses: 1,
      defenderLosses: 1,
      attackerUnits: [{unitId: "u-ge-1", owner: "GE", kind: "army", steps: 1, eliminated: false}],
      defenderUnits: [{unitId: "u-fr-1", owner: "FR", kind: "army", steps: 1, eliminated: false}],
      mines: 0,
      trench: false,
      noRetreat: false,
      turn: 1,
    } as never;
    return G;
  };

  test("opens for the attacker and for the defender alike", () => {
    const G = withReport();
    for (const playerID of ["0", "1"]) {
      const markup = html(G, playerID);
      expect(markup).toContain('data-testid="ie-battle-result-modal"');
      expect(markup).toContain('data-testid="ie-battle-result-damage"');
    }
  });

  test("stays closed while a new battle owns the board", () => {
    const G = withReport();
    G.battle = {
      kind: "land",
      attacker: "GE",
      defender: "FR",
      from: "berlin",
      to: "saxony",
      mainAttack: [],
      mainDefense: [],
      supportAttack: [],
      supportDefense: [],
      stage: "roll",
      supportSide: "attacker",
      attackerDrm: 0,
      defenderDrm: 0,
      attackerLosses: 0,
      defenderLosses: 0,
      decisive: false,
      notes: [],
    } as never;
    expect(html(G, "0")).not.toContain('data-testid="ie-battle-result-modal"');
  });
});
