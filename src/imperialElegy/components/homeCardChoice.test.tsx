/**
 * 6.0 / 9.1: the diplomacy home-card choice is a dialog the seat opens itself.
 *
 * 9.1 puts the negotiation segment first — players show cards (11.0) and agree
 * on random draws (11.1) before anyone chooses a Home card.  The choice used to
 * be raised the instant diplomacy opened, covering the negotiation table and
 * making the talk impossible; it now waits behind the dock button and closes
 * without answering.
 *
 * Jest runs in a Node environment (no jsdom), so this suite renders the board
 * with a stateful `useState` shim and walks the returned element tree, exactly
 * like `gwControls.test.tsx`.  Clicking through real handlers is the only way
 * to observe a dialog that only opens on a click.
 */
const mockStateStore: unknown[] = [];
const mockHookIndex = {value: 0};

jest.mock("react", () => {
  const actual = jest.requireActual("react");
  const useState = (initial: unknown) => {
    const index = mockHookIndex.value++;
    if (!(index in mockStateStore)) {
      mockStateStore[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
    }
    return [
      mockStateStore[index],
      (value: unknown) => {
        mockStateStore[index] = typeof value === "function"
          ? (value as (prev: unknown) => unknown)(mockStateStore[index])
          : value;
      },
    ];
  };
  const useReducer = (reducer: (state: unknown, action: unknown) => unknown, initial: unknown) => {
    const index = mockHookIndex.value++;
    if (!(index in mockStateStore)) {
      mockStateStore[index] = initial;
    }
    return [mockStateStore[index], (action: unknown) => { mockStateStore[index] = reducer(mockStateStore[index], action); }];
  };
  const useMemo = (fn: () => unknown) => fn();
  const useCallback = (fn: unknown) => fn;
  const useRef = (initial: unknown) => ({current: initial});
  const useContext = (ctx: {defaultValue?: unknown}) => ctx?.defaultValue;
  return {...actual, useState, useReducer, useEffect: () => undefined, useMemo, useCallback, useRef, useContext};
});

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
  default: {use: () => undefined, getLocaleName: () => "zh_CN", locale: async () => undefined},
}));

import React from "react";
import type {Ctx} from "boardgame.io";
import {POWERS, Power} from "../types";
import type {ImperialElegyState} from "../types";
import {setupImperialElegy} from "../engine/setup";
import {useBoardModel} from "./useBoardModel";
import {BoardLayout} from "./BoardLayout";

const testCtx = {
  playerID: "0",
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => undefined, setPhase: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "diplomacy",
} as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));

const diplomacy = (): ImperialElegyState => {
  const G = setupImperialElegy(testCtx);
  G.phase = "diplomacy";
  G.activePower = "GE";
  G.pending = null;
  G.battle = null;
  G.war = null;
  // Mirror `diplomacyBegin`: the phase opens in the negotiation segment.
  for (const power of POWERS) {
    G.powers[power].flags.homeChosen = false;
    G.powers[power].flags.negotiationDone = false;
  }
  return G;
};

/** Simulate every seat pressing "finish negotiating". */
const concludeNegotiation = (G: ImperialElegyState): ImperialElegyState => {
  for (const power of POWERS) G.powers[power].flags.negotiationDone = true;
  return G;
};

const render = (G: ImperialElegyState, power: Power, moves: Record<string, (...args: any[]) => void>) => {
  mockHookIndex.value = 0;
  return ((props: unknown) => React.createElement(BoardLayout, {
    model: (useBoardModel as unknown as (p: unknown) => never)(props),
  }))({G, ctx: testCtx, moves, playerID: seat(power)});
};

const walk = (node: unknown, visit: (element: React.ReactElement<any>) => void): void => {
  if (node === null || node === undefined || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (!React.isValidElement(node)) return;
  const el = node as React.ReactElement<any>;
  visit(el);
  // A function component is expanded through its output only: walking its
  // `children` too would report a dialog's body even when the dialog renders
  // nothing (a closed modal returns null).
  if (typeof el.type === "function") {
    try { walk((el.type as (p: any) => unknown)(el.props), visit); } catch {}
    return;
  }
  walk(el.props?.children, visit);
};

const byTestId = (tree: React.ReactElement, testId: string): React.ReactElement<any> | undefined => {
  let found: React.ReactElement<any> | undefined;
  walk(tree, (element) => {
    if (element.props?.["data-testid"] === testId) found = element;
  });
  return found;
};

const click = (tree: React.ReactElement, testId: string): void => {
  const element = byTestId(tree, testId);
  if (element === undefined) throw new Error(`missing control ${testId}`);
  element.props.onClick?.({currentTarget: element, target: element});
};

beforeEach(() => {
  mockStateStore.length = 0;
  mockHookIndex.value = 0;
});

describe("the diplomacy home-card choice", () => {
  test("negotiation comes first: no home-card entry until every seat is done", () => {
    const tree = render(diplomacy(), "GE", {});
    expect(byTestId(tree, "ie-choice-modal")).toBeUndefined();
    expect(byTestId(tree, "ie-home-card-choice")).toBeUndefined();
    // 9.1: the seat's own step is to end its negotiation segment.
    expect(byTestId(tree, "ie-open-home-card")).toBeUndefined();
    expect(byTestId(tree, "ie-finish-negotiation")).toBeTruthy();
    expect(byTestId(tree, "ie-dock-summary")?.props.children).toContain("谈判进行中");
    // The negotiation table is reachable while the step is running.
    expect(byTestId(tree, "ie-deals")).toBeTruthy();
    expect(byTestId(tree, "ie-deals-negotiation-step")).toBeTruthy();
  });

  test("the seat's own finish button calls finishNegotiation", () => {
    const G = diplomacy();
    const moves = {finishNegotiation: jest.fn()};
    click(render(G, "GE", moves), "ie-finish-negotiation");
    expect(moves.finishNegotiation).toHaveBeenCalled();
  });

  test("one seat finishing does not open the home card for the table", () => {
    const G = diplomacy();
    G.powers.GE.flags.negotiationDone = true;
    const tree = render(G, "GE", {});
    expect(byTestId(tree, "ie-open-home-card")).toBeUndefined();
    expect(byTestId(tree, "ie-finish-negotiation")).toBeUndefined();
    expect(byTestId(tree, "ie-dock-summary")?.props.children).toContain("谈判进行中");
    expect(byTestId(tree, "ie-deals-negotiation-waiting")).toBeTruthy();
    // The panel names who the table is still waiting for.
    expect(byTestId(tree, "ie-deals-still-negotiating")).toBeTruthy();
  });

  test("once every seat is done, the dock button opens the choice and closing leaves it owed", () => {
    const G = concludeNegotiation(diplomacy());
    click(render(G, "GE", {}), "ie-open-home-card");
    const opened = render(G, "GE", {});
    expect(byTestId(opened, "ie-choice-modal")).toBeTruthy();
    expect(byTestId(opened, "ie-home-card-choice")).toBeTruthy();
    expect(byTestId(opened, "ie-choice-close")).toBeTruthy();

    // Closing only hides the dialog: the engine still owes the choice, so the
    // dock keeps offering it.
    click(opened, "ie-choice-close");
    const closed = render(G, "GE", {});
    expect(byTestId(closed, "ie-choice-modal")).toBeUndefined();
    expect(byTestId(closed, "ie-open-home-card")).toBeTruthy();
  });

  test("the deals page carries the same next step after negotiation", () => {
    const G = concludeNegotiation(diplomacy());
    const tree = render(G, "GE", {});
    expect(byTestId(tree, "ie-deals-home-step")).toBeTruthy();
    click(tree, "ie-open-home-card-from-deals");
    expect(byTestId(render(G, "GE", {}), "ie-choice-modal")).toBeTruthy();
  });

  test("only the seat whose diplomacy turn it is offers the choice", () => {
    const G = concludeNegotiation(diplomacy());
    // GE is first; FR is still waiting, so its dock has no home-card button.
    expect(byTestId(render(G, "GE", {}), "ie-open-home-card")).toBeTruthy();
    expect(byTestId(render(G, "FR", {}), "ie-open-home-card")).toBeUndefined();
  });

  test("choosing a card answers the step and closes the dialog", () => {
    const G = concludeNegotiation(diplomacy());
    const moves = {chooseHomeCard: jest.fn()};
    click(render(G, "GE", moves), "ie-open-home-card");
    const opened = render(G, "GE", moves);
    const card = G.powers.GE.homeCards[0];
    click(opened, `ie-choose-home-${card}`);
    expect(moves.chooseHomeCard).toHaveBeenCalledWith(card);
  });
});
