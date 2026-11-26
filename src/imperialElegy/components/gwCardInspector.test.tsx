/**
 * The Great War card's face lives in the seat's GW slot (`me.gwCard`), not in
 * the hand, so the tray's "a card that left the hand closes the inspector"
 * guard closed the GW card's dialog in the same commit that opened it — the
 * card flashed open and snapped shut.  Reported as "帝国挽歌 大战专用卡点不开
 * 弹出来一下马上缩回去了".
 *
 * Jest runs here without a DOM, so the tray is driven through the same kind of
 * stateful hook shim the board suites use — except that this one runs the
 * effects after each render, which is the only place the regression lives.
 */
const mockHookState: unknown[] = [];
const mockHookIndex = {value: 0};
const mockPendingEffects: Array<() => void> = [];
const mockStateChanged = {value: false};

jest.mock("react", () => {
  const actual = jest.requireActual("react");
  const useState = (initial: unknown) => {
    const index = mockHookIndex.value++;
    if (!(index in mockHookState)) {
      mockHookState[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
    }
    return [
      mockHookState[index],
      (value: unknown) => {
        mockHookState[index] = typeof value === "function"
          ? (value as (prev: unknown) => unknown)(mockHookState[index])
          : value;
        mockStateChanged.value = true;
      },
    ];
  };
  const useMemo = (fn: () => unknown) => fn();
  // The tray's guards only ever close a dialog, so running them on every render
  // is stricter than React's dependency lists and keeps the shim honest.
  const useEffect = (fn: () => void) => {
    mockPendingEffects.push(fn);
  };
  return {...actual, useState, useMemo, useEffect};
});

jest.mock("./theme", () => {
  const React = require("react");
  return {
    IEBadge: ({children}: any) => React.createElement("span", null, children),
    IEChip: ({children}: any) => React.createElement("span", null, children),
  };
});

jest.mock("../../constant/i18n", () => ({
  __esModule: true,
  default: {use: () => undefined, getLocaleName: () => "en", locale: async () => undefined},
}));

import React from "react";
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState} from "../types";
import {setupImperialElegy} from "../engine/setup";
import {HandTray} from "./HandTray";
import type {HandTrayProps} from "./HandTray";
import {CardInspector} from "./CardInspector";
import {ieT} from "./i18n";
import {CARD_BY_ID} from "../engine/deck";
import {CardFace} from "./CardFace";

const testCtx = {
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => undefined, setPhase: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "gwPlanning",
} as unknown as Ctx;

const GW_CARD = "IE-GW-03";

/** A GW planning seat holding `GW_CARD`, which is what the tray shows as 大战卡. */
const gwSeat = (): ImperialElegyState => {
  const G = setupImperialElegy(testCtx);
  const gw: GreatWarState = {
    active: true,
    turn: 1,
    order: ["GE"],
    belligerents: ["GE"],
    neutrals: ["UK", "FR", "AU", "RU", "OT"],
    te: [],
    ta: ["GE"],
    usIn: false,
    italyIn: false,
    usStability: 3,
    usManpower: 3,
    usBudget: 4,
    italyStability: 3,
    italyManpower: 3,
    italyBudget: 2,
    trenches: {},
    lastColonialWar: null,
    victor: null,
    outbreakDone: true,
    nationalWillDone: true,
    bonusImpulses: [],
  };
  G.gw = gw;
  G.phase = "gwPlanning";
  G.activePower = "GE";
  G.powers.GE.gwCard = GW_CARD;
  return G;
};

type MoveBag = Record<string, (...args: any[]) => void>;

const trayProps = (G: ImperialElegyState, moves: MoveBag = {}): HandTrayProps => ({
  G, viewer: "GE", me: G.powers.GE, locale: "zh_CN", t: ieT(),
  phase: G.phase, isActive: true, eliminated: false, pending: null,
  canActionCard: true, isBelligerent: true, war: null, forcedCardIds: [],
  hand: G.powers.GE.hand, saveList: [], shownCards: [], cardsShownToMe: [],
  responseInHand: false, responseWindow: false, chainNonEmpty: false, chainSpendable: 0,
  chainCap: 4, chainReady: false, chainDisabledReason: undefined,
  cpBudget: () => 3, doAction: (fn: () => void) => fn(), moves,
  handChoicesHint: null, cardFaceMode: "svg", open: true, onToggleOpen: () => undefined,
});

/**
 * Render the tray, then run its effects, re-rendering while any of them changed
 * state — the commit-and-rerender the real client performs.
 */
const render = (props: HandTrayProps): React.ReactElement => {
  let tree: React.ReactElement = React.createElement(React.Fragment);
  for (let pass = 0; pass < 8; pass += 1) {
    mockHookIndex.value = 0;
    mockPendingEffects.length = 0;
    mockStateChanged.value = false;
    tree = HandTray(props) as React.ReactElement;
    const effects = mockPendingEffects.splice(0);
    for (const effect of effects) effect();
    if (!mockStateChanged.value) break;
  }
  return tree;
};

/** Depth-first walk of the rendered host tree; components are not executed. */
const walk = (node: React.ReactNode, visit: (element: React.ReactElement<any>) => void): void => {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child as React.ReactNode, visit);
    return;
  }
  if (!React.isValidElement(node)) return;
  const element = node as React.ReactElement<any>;
  visit(element);
  const children = element.props?.children;
  if (children !== undefined) walk(children as React.ReactNode, visit);
};

const find = (node: React.ReactNode, match: (element: React.ReactElement<any>) => boolean): React.ReactElement<any> | undefined => {
  let found: React.ReactElement<any> | undefined;
  walk(node, (element) => {
    if (found === undefined && match(element)) found = element;
  });
  return found;
};

const byTestId = (node: React.ReactNode, testId: string): React.ReactElement<any> | undefined =>
  find(node, (element) => element.props?.["data-testid"] === testId);

/** The tray's dialogs are `CardInspector` elements; nothing below them is drawn here. */
const inspector = (node: React.ReactNode): React.ReactElement<any> | undefined =>
  find(node, (element) => element.type === CardInspector);

const openButton = (node: React.ReactNode, testId: string): React.ReactElement<any> => {
  const element = byTestId(node, testId);
  if (element === undefined) throw new Error(`missing ${testId}`);
  return element;
};

beforeEach(() => {
  mockHookState.length = 0;
  mockHookIndex.value = 0;
  mockPendingEffects.length = 0;
  mockStateChanged.value = false;
});

describe("the Great War card's inspector", () => {
  test("stays open when its face is tapped, because a GW card is not a hand card", () => {
    const G = gwSeat();
    const props = trayProps(G);
    // The card face the tray draws for `me.gwCard` is the GW block's opener.
    const before = render(props);
    expect(byTestId(before, `ie-gw-card-${GW_CARD}`)).toBeTruthy();
    openButton(before, `ie-open-gw-card-${GW_CARD}`).props.onClick();

    const after = render(props);
    const dialog = inspector(after);
    expect(dialog).toBeTruthy();
    expect(dialog!.props.face.card.id).toBe(GW_CARD);
    expect(dialog!.props.face).not.toHaveProperty("goal");
  });

  test("closes once the GW card is played, because the face has left its home", () => {
    const G = gwSeat();
    const props = trayProps(G);
    const before = render(props);
    openButton(before, `ie-open-gw-card-${GW_CARD}`).props.onClick();
    expect(inspector(render(props))).toBeTruthy();

    // `playGwCardMove` empties the slot; the dialog must not outlive the card.
    G.powers.GE.gwCard = null;
    expect(inspector(render(trayProps(G)))).toBeUndefined();
  });

  test("the inspector draws the GW card's own two plays, not the hand's controls", () => {
    const G = gwSeat();
    const props = trayProps(G);
    const before = render(props);
    openButton(before, `ie-open-gw-card-${GW_CARD}`).props.onClick();

    const dialog = inspector(render(props))!;
    const ids: string[] = [];
    walk(dialog.props.actions as React.ReactNode, (element) => {
      const testId = element.props?.["data-testid"];
      if (typeof testId === "string") ids.push(testId);
    });
    // 26.0/27.2: the card is played from `me.gwCard`, so the hand's CP,
    // event, industrialization, chain and Save controls belong to moves that
    // refuse it.  Reported as "大战卡牌无法打出 UI 上面显示 cp 事件 工业化
    // 跟普通卡牌一样".
    expect(ids).toEqual([`ie-gw-bonus-inspector-${GW_CARD}`, `ie-gw-event-inspector-${GW_CARD}`]);
  });

  test("the inspector's buttons play the GW slot's card, never a hand card", () => {
    const G = gwSeat();
    G.phase = "gwManeuver";
    G.gw!.impulse = {power: "GE", turn: 1, index: 0, serial: 1, acted: false};
    G.powers.GE.gwBudget = 3;
    const moves: MoveBag = {playGwCardMove: jest.fn(), playCard: jest.fn(), industrialize: jest.fn()};
    const props = trayProps(G, moves);
    const before = render(props);
    openButton(before, `ie-open-gw-card-${GW_CARD}`).props.onClick();

    const dialog = inspector(render(props))!;
    // GW-03 is a battle-window combat card: its event cannot be opened from
    // the impulse, and the button says why instead of silently refusing.
    const event = find(dialog.props.actions as React.ReactNode,
      (element) => element.props?.["data-testid"] === `ie-gw-event-inspector-${GW_CARD}`)!;
    expect(event.props.disabled).toBe(true);
    expect(event.props.title).toContain("战斗窗口");
    // The footer repeats the shut mode's reason: a touch reader has no tooltip.
    expect(dialog.props.unavailable).toEqual(["此牌事件须在规定的战斗窗口使用。"]);

    const bonus = find(dialog.props.actions as React.ReactNode,
      (element) => element.props?.["data-testid"] === `ie-gw-bonus-inspector-${GW_CARD}`)!;
    bonus.props.onClick();
    expect(moves.playGwCardMove).toHaveBeenCalledWith("cp");
    expect(moves.playCard).not.toHaveBeenCalled();
    expect(moves.industrialize).not.toHaveBeenCalled();
  });

  test("a mandatory GW event offers its one event control, not a duplicate bonus", () => {
    const G = gwSeat();
    G.powers.GE.gwCard = "IE-GW-10";
    const before = render(trayProps(G));
    openButton(before, "ie-open-gw-card-IE-GW-10").props.onClick();

    const dialog = inspector(render(trayProps(G)))!;
    const ids: string[] = [];
    walk(dialog.props.actions as React.ReactNode, (element) => {
      const testId = element.props?.["data-testid"];
      if (typeof testId === "string") ids.push(testId);
    });
    // 27.3: playing Exhaustion for CP *is* its event, so the two controls the
    // old block drew would do the same thing.
    expect(ids).toEqual(["ie-gw-event-inspector-IE-GW-10"]);
  });

  test("the tray block keeps its own two GW controls", () => {
    const G = gwSeat();
    const props = trayProps(G);
    const tree = render(props);
    expect(byTestId(tree, `ie-gw-bonus-${GW_CARD}`)).toBeTruthy();
    expect(byTestId(tree, `ie-gw-event-${GW_CARD}`)).toBeTruthy();
  });

  test("the bonus control's tooltip names 27.2's two restrictions", () => {
    const G = gwSeat();
    const bonus = byTestId(render(trayProps(G)), `ie-gw-bonus-${GW_CARD}`)!;
    // Reported as "增加悬停说明 不能重复本轮预算行动、本轮不能发动陆战": an
    // open button had no title at all, so neither printed restriction showed
    // on hover and only the engine's refusal taught them.
    expect(bonus.props.title).toContain("不能重复本轮预算行动");
    expect(bonus.props.title).toContain("本轮不能发动陆战");
  });

  test("a shut bonus control keeps its refusal in front of the rule line", () => {
    const G = gwSeat();
    G.phase = "gwManeuver";
    G.gw!.impulse = {power: "GE", turn: 1, index: 0, serial: 1, acted: true, budgetAction: "landBattle"};
    G.powers.GE.gwBudget = 3;
    const bonus = byTestId(render(trayProps(G)), `ie-gw-bonus-${GW_CARD}`)!;
    expect(bonus.props.disabled).toBe(true);
    expect(bonus.props.title).toContain("使用卡牌奖励行动的本轮不能发动陆战。");
    expect(bonus.props.title).toContain("不能重复本轮预算行动");
  });

  test("the tray block reads the card instead of drawing a thumbnail of it", () => {
    const G = gwSeat();
    const tree = render(trayProps(G));
    const card = CARD_BY_ID[GW_CARD];
    // Reported as "现有界面显示也有点模糊": the block used to draw the 300×380
    // face in a 126×118 box, which put the printed text on screen at 5 px.
    // The row now carries the CP, the title and the printed line, and the face
    // is the inspector's job.
    expect(byTestId(tree, `ie-gw-text-${GW_CARD}`)!.props.children).toBe(card.textZh);
    const section = byTestId(tree, `ie-gw-card-${GW_CARD}`)!;
    expect(section.props.className).toContain("ie-tray-gw");
    let faces = 0;
    walk(section.props.children, (element) => {
      if (element.type === CardFace) faces += 1;
    });
    expect(faces).toBe(0);
    // The whole row opens the inspector, exactly like a hand row does.
    expect(openButton(tree, `ie-open-gw-card-${GW_CARD}`).props["aria-haspopup"]).toBe("dialog");
  });

  test("a hand card's dialog still closes when the played card leaves the hand", () => {
    const G = gwSeat();
    const id = G.powers.GE.hand[0];
    const props = trayProps(G);
    const before = render(props);
    openButton(before, `ie-open-card-${id}`).props.onClick();
    expect(inspector(render(props))).toBeTruthy();

    G.powers.GE.hand = G.powers.GE.hand.filter((card) => card !== id);
    expect(inspector(render(trayProps(G)))).toBeUndefined();
  });

  test("GW #2's turn-0 event button follows the move's own offer", () => {
    // Reported as "HandTray 只用 gwCardProblem 判断 GW 卡按钮，所以 UI 同样会给出
    // 引擎会拒绝的 GW-02 as event": the tray has only `gwCardProblem` to go on,
    // so the card's play window must be that function's, not a second copy in
    // `playGwCardMove`.  GW #2 is the card with a turn-0 exception (25.3's
    // outbreak Italy), so it is the one that can disagree.
    const G = gwSeat();
    G.powers.GE.gwCard = "IE-GW-02";
    G.gw!.turn = 0;
    G.persistent.italyUnified = true;
    G.persistent.italyIndependent = false;
    G.gw!.italyIn = false;
    G.gw!.italySurrendered = false;
    G.gw!.italyStability = 3;
    G.flags.gwMajorEntryOutbreak = false;
    // A unified Italy outside the war is the one offer the card has on turn 0.
    expect(byTestId(render(trayProps(G)), "ie-gw-event-IE-GW-02")!.props.disabled).toBe(false);

    // Italy already joined (or the offer was spent): the move refuses, so the
    // button must be shut rather than offering a play that does nothing.
    G.gw!.italyIn = true;
    const shut = byTestId(render(trayProps(G)), "ie-gw-event-IE-GW-02")!;
    expect(shut.props.disabled).toBe(true);
    expect(shut.props.title).toBe("本轮卡牌窗口已关闭。");
  });
});
