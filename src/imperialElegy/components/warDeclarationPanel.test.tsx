/**
 * The War panel's declaration form.
 *
 * Declaring war used to need a map click: the Orders panel only showed the
 * form once the target's space was selected, and a home card opened a separate
 * target chooser.  The panel now asks all three questions itself, so these
 * tests drive the dropdowns and the chips and expect the exact `declareWar`
 * arguments — with no selection in sight.
 *
 * Jest runs without jsdom, so the component is called as a plain function and
 * the returned tree is walked; a stateful `useState` shim makes a dropdown
 * change survive the next call, which is what the real component does.
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
  const useMemo = (fn: () => unknown) => fn();
  const useCallback = (fn: unknown) => fn;
  const useRef = (initial: unknown) => ({current: initial});
  return {...actual, useState, useMemo, useCallback, useRef, useEffect: () => undefined};
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

import React from "react";
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "../types";
import {POWERS} from "../types";
import {setupImperialElegy} from "../engine/setup";
import {
  BISMARCK_HOME_CARD,
  JIHAD_HOME_CARD,
  RUSSO_TURKISH_WARS_HOME_CARD,
} from "../engine/rules";
import {playCard} from "../moves";
import {WarDeclarationPanel, type WarDeclarationPanelProps} from "./WarDeclarationPanel";
import {ieStringsFor} from "./i18n";

const makeCtx = (playerID: string | null = "0"): Ctx => ({
  playerID,
  random: {Die: () => 3},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 5,
  phase: "action",
} as unknown as Ctx);

const seat = (power: Power): string => String(POWERS.indexOf(power));

/** A power's action impulse after its home-card event resolved. */
const homeImpulse = (power: Power, card: string): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = power;
  G.turn = 5;
  G.powers[power].hand = [card];
  G.powers[power].selectedHomeCard = card;
  playCard(G, makeCtx(seat(power)), card, "event");
  return G;
};

const ordinaryImpulse = (power: Power = "GE"): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = power;
  G.turn = 5;
  G.cpRemaining = 4;
  return G;
};

interface Declared {
  target: unknown;
  aim: unknown;
  objectives: unknown;
  cp: unknown;
  options?: unknown;
}

const renderPanel = (
  G: ImperialElegyState,
  viewer: Power,
  over: Partial<WarDeclarationPanelProps> = {},
): {tree: React.ReactElement; declared: Declared[]; props: WarDeclarationPanelProps} => {
  const declared: Declared[] = [];
  const props: WarDeclarationPanelProps = {
    G,
    viewer,
    locale: "en",
    t: ieStringsFor("en"),
    homeCardTitle: (card) => card,
    canActionCard: true,
    cpRemaining: G.cpRemaining,
    confirmActions: false,
    doAction: (fn: () => void) => fn(),
    moves: {
      declareWar: (target: unknown, aim: unknown, objectives: unknown, cp: unknown, options?: unknown) => {
        declared.push({target, aim, objectives, cp, ...(options === undefined ? {} : {options})});
      },
    },
    ...over,
  };
  mockHookIndex.value = 0;
  const tree = WarDeclarationPanel(props) as unknown as React.ReactElement;
  return {tree, declared, props};
};

const rerender = (props: WarDeclarationPanelProps): React.ReactElement => {
  mockHookIndex.value = 0;
  return WarDeclarationPanel(props) as unknown as React.ReactElement;
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
  if (typeof el.type === "function") {
    try {
      walk((el.type as (p: unknown) => unknown)(el.props), visit);
    } catch {
      // A function component with a hook the shim does not cover is skipped.
    }
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

const allByTestId = (tree: React.ReactElement, testId: string): React.ReactElement<any>[] => {
  const found: React.ReactElement<any>[] = [];
  walk(tree, (element) => {
    if (element.props?.["data-testid"] === testId) found.push(element);
  });
  return found;
};

const textOf = (node: unknown): string => {
  if (node === null || node === undefined) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement(node)) return textOf((node as React.ReactElement<any>).props?.children);
  return "";
};

const optionsOf = (tree: React.ReactElement, testId: string): string[] => {
  const select = byTestId(tree, testId);
  if (select === undefined) throw new Error(`no element ${testId}`);
  const out: string[] = [];
  walk(select.props?.children, (element) => {
    if (element.type === "option") out.push(String(element.props?.value));
  });
  return out;
};

const change = (tree: React.ReactElement, testId: string, value: string): void => {
  const element = byTestId(tree, testId);
  if (element === undefined) throw new Error(`no element ${testId}`);
  element.props?.onChange?.({target: {value}});
};

const click = (tree: React.ReactElement, testId: string): void => {
  const element = byTestId(tree, testId);
  if (element === undefined) throw new Error(`no element ${testId}`);
  const onClick = element.props?.onClick;
  if (typeof onClick !== "function") throw new Error(`${testId} has no onClick`);
  onClick({currentTarget: {disabled: false}, detail: 0, preventDefault: () => undefined, stopPropagation: () => undefined, blur: () => undefined});
};

beforeEach(() => {
  mockStateStore.length = 0;
});

describe("the War panel's declaration form", () => {
  test("Bismarck locks its printed aim and CP and declares against a player power", () => {
    const G = homeImpulse("GE", BISMARCK_HOME_CARD);
    const {tree, declared, props} = renderPanel(G, "GE");
    // The card fixes the aim and the budget: no aim chips, no CP select.
    expect(byTestId(tree, "ie-war-declare-aim-locked")).toBeDefined();
    expect(textOf(byTestId(tree, "ie-war-declare-aim-locked"))).toBe("Unification");
    expect(textOf(byTestId(tree, "ie-war-declare-cp-locked"))).toBe("3 CP");
    expect(textOf(byTestId(tree, "ie-war-entitlement"))).toContain("Bismarck");

    change(tree, "ie-war-declare-defender", "FR");
    let next = rerender(props);
    change(next, "ie-war-declare-objective", "alsace-lorraine");
    next = rerender(props);
    click(next, "ie-declare-war");
    expect(declared).toEqual([{
      target: "FR",
      aim: "unification",
      objectives: ["alsace-lorraine"],
      cp: 3,
      options: undefined,
    }]);
  });

  test("a non-player power is a target: the declaration carries {minor}", () => {
    const G = homeImpulse("GE", BISMARCK_HOME_CARD);
    const {tree, declared, props} = renderPanel(G, "GE");
    // Independent minors are listed beside the players, keyed as `minor:<name>`.
    const defenders = optionsOf(tree, "ie-war-declare-defender");
    expect(defenders).toContain("minor:Denmark");

    change(tree, "ie-war-declare-defender", "minor:Denmark");
    let next = rerender(props);
    change(next, "ie-war-declare-objective", "schleswig-holstein");
    next = rerender(props);
    click(next, "ie-declare-war");
    expect(declared).toEqual([{
      target: {minor: "Denmark"},
      aim: "unification",
      objectives: ["schleswig-holstein"],
      cp: 3,
      options: undefined,
    }]);
  });

  test("Russo-Turkish Wars offers only the Ottomans and explains the rule", () => {
    const G = homeImpulse("RU", RUSSO_TURKISH_WARS_HOME_CARD);
    const {tree} = renderPanel(G, "RU");
    expect(optionsOf(tree, "ie-war-declare-defender")).toEqual(["OT"]);
    expect(textOf(byTestId(tree, "ie-war-target-rule"))).toContain("only declare war on the Ottomans");
  });

  test("Jihad keeps its open aim list but only two printed aims", () => {
    const G = homeImpulse("OT", JIHAD_HOME_CARD);
    const {tree} = renderPanel(G, "OT");
    expect(textOf(byTestId(tree, "ie-war-target-rule"))).toContain("Russia or a power controlling an Ottoman home space");
    const aims = allByTestId(tree, "ie-war-declare-aim-locked").length === 0
      ? ["conquest", "liberation", "unification"].filter((aim) => byTestId(tree, `ie-war-declare-aim-${aim}`) !== undefined)
      : [];
    expect(aims).toEqual(["conquest", "liberation"]);
  });

  test("Bismarck may name a second power and forbid player allies", () => {
    const G = homeImpulse("GE", BISMARCK_HOME_CARD);
    const {tree, declared, props} = renderPanel(G, "GE");
    change(tree, "ie-war-declare-defender", "FR");
    let next = rerender(props);
    change(next, "ie-war-declare-objective", "alsace-lorraine");
    next = rerender(props);
    change(next, "ie-war-second-power", "AU");
    next = rerender(props);
    expect(byTestId(next, "ie-war-primary-defender")).toBeDefined();

    // Bismarck's join ban is a checkbox; its change handler arms the option.
    const forbid = byTestId(next, "ie-war-forbid-join");
    const checkbox = (() => {
      let found: React.ReactElement<any> | undefined;
      walk(forbid, (element) => { if (element.type === "input") found = element; });
      return found;
    })();
    checkbox?.props?.onChange?.({target: {checked: true}});
    next = rerender(props);
    click(next, "ie-declare-war");
    expect(declared).toEqual([{
      target: "FR",
      aim: "unification",
      objectives: ["alsace-lorraine"],
      cp: 3,
      options: {secondTarget: "AU", primary: "FR", forbidPlayers: true},
    }]);
  });

  test("without an entitlement the ordinary aim/CP/defender pickers stay live", () => {
    const G = ordinaryImpulse();
    const {tree, declared, props} = renderPanel(G, "GE");
    expect(byTestId(tree, "ie-war-declare-aim-locked")).toBeUndefined();
    expect(byTestId(tree, "ie-war-declare-aim-conquest")).toBeDefined();
    expect(byTestId(tree, "ie-war-declare-cp")).toBeDefined();
    expect(optionsOf(tree, "ie-war-declare-defender")).toContain("FR");

    change(tree, "ie-war-declare-defender", "FR");
    let next = rerender(props);
    const objectives = optionsOf(next, "ie-war-declare-objective");
    expect(objectives.length).toBeGreaterThan(0);
    change(next, "ie-war-declare-objective", objectives[0]);
    next = rerender(props);
    change(next, "ie-war-declare-cp", "4");
    next = rerender(props);
    click(next, "ie-declare-war");
    expect(declared).toEqual([{
      target: "FR",
      aim: "conquest",
      objectives: [objectives[0]],
      cp: 4,
      options: undefined,
    }]);
  });

  test("outside the Action impulse it explains the phase without listing targets", () => {
    const G = ordinaryImpulse();
    const {tree} = renderPanel(G, "GE", {canActionCard: false});
    // Nothing is enumerated away from the action phase (the panel stays
    // mounted, hidden, alongside the Orders body), so no dead dropdowns exist.
    expect(byTestId(tree, "ie-war-declare-defender")).toBeUndefined();
    expect(textOf(byTestId(tree, "ie-war-declare-none"))).toContain("Action impulse");
  });

  test("no legal declaration says why instead of offering a dead button", () => {
    const G = ordinaryImpulse();
    G.wtt = 3;
    const {tree} = renderPanel(G, "GE");
    expect(byTestId(tree, "ie-war-declare-none")).toBeDefined();
    expect(byTestId(tree, "ie-declare-war")).toBeUndefined();
  });
});
