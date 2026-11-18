/**
 * The Orders panel's declare-war block with a home-card entitlement.
 *
 * Bismarck's event leaves a declaration entitlement (see `bismarckWar.test.ts`
 * for the engine side): the block must show the card's fixed aim and CP, allow
 * a non-player war target (the actual unification objectives are German minor
 * spaces), and send the printed arguments to `declareWar`.
 *
 * Jest runs without jsdom, so the component is called as a plain function with
 * React's hooks stubbed and the returned element tree walked — the same
 * technique as `boardActions2.test.tsx`.
 */
jest.mock("react", () => {
  const actual = jest.requireActual("react");
  const useState = (initial: unknown) => [
    typeof initial === "function" ? (initial as () => unknown)() : initial,
    () => undefined,
  ];
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
import type {ImperialElegyState, Power, SpaceId} from "../types";
import {POWERS} from "../types";
import {setupImperialElegy} from "../engine/setup";
import {BISMARCK_HOME_CARD, warDeclarationEntitlement} from "../engine/rules";
import {playCard} from "../moves";
import {SpaceActionsPanel} from "./SpacePanel";
import {ieStringsFor} from "./i18n";

const makeCtx = (playerID: string | null = "0"): Ctx => ({
  playerID,
  random: {Die: () => 3},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 5,
  phase: "action",
} as unknown as Ctx);

const seat = (power: Power): string => String(POWERS.indexOf(power));

/** GE's action impulse after the Bismarck event resolved. */
const bismarckImpulse = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = "GE";
  G.turn = 5;
  G.powers.GE.hand = [BISMARCK_HOME_CARD];
  G.powers.GE.selectedHomeCard = BISMARCK_HOME_CARD;
  playCard(G, makeCtx(seat("GE")), BISMARCK_HOME_CARD, "event");
  return G;
};

interface Declared {
  target: unknown;
  aim: unknown;
  objectives: unknown;
  cp: unknown;
}

const renderPanel = (
  G: ImperialElegyState,
  options: {
    selected: SpaceId;
    warTargetControl: Power | null;
    warMinorTarget?: string | null;
    targetControlledSpaces: SpaceId[];
    canDeclareWar: boolean;
  },
): {tree: React.ReactElement; declared: Declared[]} => {
  const declared: Declared[] = [];
  const entitlement = warDeclarationEntitlement(G, "GE");
  const tree = React.createElement(SpaceActionsPanel, {
    G,
    selected: options.selected,
    viewer: "GE" as Power,
    me: G.powers.GE,
    locale: "en" as const,
    t: ieStringsFor("en"),
    phase: "action",
    canAct: true,
    rows: [],
    cpRemaining: 0,
    canActionCard: true,
    war: null,
    warAim: "conquest" as const,
    setWarAim: () => undefined,
    warCp: 2,
    setWarCp: () => undefined,
    secondObjective: "" as const,
    setSecondObjective: () => undefined,
    targetControlledSpaces: options.targetControlledSpaces,
    warTargetControl: options.warTargetControl,
    warMinorTarget: options.warMinorTarget ?? null,
    warEntitlement: entitlement,
    canDeclareWar: options.canDeclareWar,
    polishReserve: false,
    setPolishReserve: () => undefined,
    selectedUnitDef: undefined,
    setSelectedUnit: () => undefined,
    battleFrom: null,
    setBattleFrom: () => undefined,
    navalFrom: null,
    setNavalFrom: () => undefined,
    confirmActions: false,
    doAction: (fn: () => void) => fn(),
    moves: {
      declareWar: (target: unknown, aim: unknown, objectives: unknown, cp: unknown) => {
        declared.push({target, aim, objectives, cp});
      },
    },
  });
  return {tree, declared};
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
      // A function component with a hook the stub does not cover is skipped.
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

const textOf = (node: unknown): string => {
  if (node === null || node === undefined) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement(node)) return textOf((node as React.ReactElement<any>).props?.children);
  return "";
};

const click = (tree: React.ReactElement, testId: string): void => {
  const element = byTestId(tree, testId);
  if (element === undefined) throw new Error(`no element ${testId}`);
  const onClick = element.props?.onClick;
  if (typeof onClick !== "function") throw new Error(`${testId} has no onClick`);
  onClick({currentTarget: {disabled: false}, detail: 0, preventDefault: () => undefined, stopPropagation: () => undefined});
};

describe("Bismarck's declaration block", () => {
  test("locks the printed aim and CP and declares against a player power", () => {
    const G = bismarckImpulse();
    const {tree, declared} = renderPanel(G, {
      selected: "alsace-lorraine",
      warTargetControl: "FR",
      targetControlledSpaces: ["alsace-lorraine"],
      canDeclareWar: true,
    });
    const block = byTestId(tree, "ie-war-declare");
    expect(block).toBeDefined();
    const text = textOf(block);
    // The target, the card's fixed aim and its printed CP are on screen.
    expect(text).toContain("France");
    expect(text).toContain("Unification");
    expect(text).toContain("3 CP");
    // The entitlement explains where the budget comes from.
    expect(textOf(byTestId(tree, "ie-war-entitlement"))).toContain("Bismarck");
    click(tree, "ie-declare-war");
    expect(declared).toEqual([{target: "FR", aim: "unification", objectives: ["alsace-lorraine"], cp: 3}]);
  });

  test("a non-player power is a target: the declaration carries {minor}", () => {
    const G = bismarckImpulse();
    const {tree, declared} = renderPanel(G, {
      selected: "schleswig-holstein",
      warTargetControl: null,
      warMinorTarget: "Denmark",
      targetControlledSpaces: ["schleswig-holstein"],
      canDeclareWar: true,
    });
    const block = byTestId(tree, "ie-war-declare");
    expect(block).toBeDefined();
    expect(textOf(block)).toContain("Denmark");
    click(tree, "ie-declare-war");
    expect(declared).toEqual([{
      target: {minor: "Denmark"},
      aim: "unification",
      objectives: ["schleswig-holstein"],
      cp: 3,
    }]);
  });

  test("without an entitlement the ordinary aim/CP pickers stay live", () => {
    const G = setupImperialElegy(makeCtx());
    G.phase = "action";
    G.activePower = "GE";
    G.turn = 5;
    G.cpRemaining = 4;
    const {tree} = renderPanel(G, {
      selected: "alsace-lorraine",
      warTargetControl: "FR",
      targetControlledSpaces: ["alsace-lorraine"],
      canDeclareWar: false,
    });
    const block = byTestId(tree, "ie-war-declare");
    expect(block).toBeDefined();
    // The ordinary aim and CP selects are live; no locked badges.
    let selects = 0;
    walk(block!, (element) => {
      if (element.type === "select") selects += 1;
    });
    expect(selects).toBe(2);
    expect(textOf(block)).not.toContain("Bismarck funds");
  });
});
