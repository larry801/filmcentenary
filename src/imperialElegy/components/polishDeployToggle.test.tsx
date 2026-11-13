/**
 * 22.5(2) Polish reserve decline toggle and the English revealed-goals row.
 *
 * The board's deploy-reserves control deploys the controller's own reserve
 * armies plus (by default) one Polish reserve army.  The printed rule says the
 * Polish army is optional ("may also deploy"), so the control exposes a
 * bilingual checkbox; this suite checks the default-auto state and the
 * `{polishReserve:false}` hand-off to `moves.deployReserves`.
 */
jest.mock("react", () => {
  const actual = jest.requireActual("react");
  let call = 0;
  (globalThis as unknown as {__resetBoardHooks: () => void}).__resetBoardHooks = () => {
    call = 0;
  };
  const useState = (initial: unknown) => {
    const index = call++;
    let value: unknown = initial;
    // The first hook is the selected space; pick Berlin so the deploy panel
    // renders.  The only boolean-true hook is the Polish reserve checkbox.
    if (index === 0 && initial === null) value = "berlin";
    if (initial === true) value = (globalThis as unknown as {__polishReserveDefault?: boolean}).__polishReserveDefault ?? true;
    return [typeof initial === "function" ? (initial as () => unknown)() : value, () => undefined];
  };
  const useMemo = (fn: () => unknown) => fn();
  const useCallback = (fn: unknown) => fn;
  const useRef = (initial: unknown) => ({current: initial});
  return {...actual, useState, useEffect: () => undefined, useMemo, useCallback, useRef};
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
  default: {use: () => undefined, getLocaleName: () => "en", locale: async () => undefined},
}));

import React from "react";
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "../types";
import {POWERS} from "../types";
import {setupImperialElegy} from "../engine/setup";
import {placeUnit, registerPolishIndependence} from "../engine/effects";
import {createWarState} from "../engine/limitedWar";
import {polishReserveDeployer, polishReserveIds} from "../engine/poland";
import {ImperialElegyBoard} from "./board";

const testCtx = {
  playerID: "0",
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => undefined, setPhase: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "action",
} as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));

type MoveBag = Record<string, (...args: any[]) => void>;

const moveBag = (...names: string[]): MoveBag =>
  Object.fromEntries(names.map((name) => [name, jest.fn()]));

/** A wartime GE that controls independent Poland, with one own reserve army. */
const polishWar = (): ImperialElegyState => {
  const G = setupImperialElegy(testCtx);
  G.phase = "wartime";
  G.activePower = "GE";
  G.cpRemaining = 4;
  G.pending = null;
  G.battle = null;
  G.war = createWarState(G, "GE", "FR", "conquest", ["paris"], 2);
  G.war.status = "maneuver";
  G.war.budgets.GE = 4;
  const reserve = placeUnit(G, "GE", "reserveArmy", null, 2);
  G.powers.GE.reserves = [reserve.id];
  G.spaces.poland.control = "Poland";
  G.spaces.poland.ally = "GE";
  registerPolishIndependence(G);
  // 22.5(1): independence opens the box empty; the 4th/5th counters are built
  // later.  Seed the two reserve counters this fixture exercises.
  const box = G.nonPlayerBuildBox!;
  box.poland = {reserveArmies: []};
  for (let i = 0; i < 2; i += 1) {
    const polish = placeUnit(G, "Poland", "reserveArmy", null, 2);
    box.poland.reserveArmies.push(polish.id);
  }
  return G;
};

const renderTree = (G: ImperialElegyState, power: Power, moves: MoveBag): React.ReactElement => {
  (globalThis as unknown as {__resetBoardHooks: () => void}).__resetBoardHooks();
  return (ImperialElegyBoard as unknown as (props: unknown) => React.ReactElement)({
    G,
    ctx: testCtx,
    moves,
    playerID: seat(power),
  });
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
  // Expand function components so sub-panels are visible to byTestId
  if (typeof el.type === "function") {
    try { walk((el.type as (p: any) => unknown)(el.props), visit); } catch {}
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
  let out = "";
  const collect = (value: unknown): void => {
    if (typeof value === "string" || typeof value === "number") out += String(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (React.isValidElement(value)) collect((value as React.ReactElement<any>).props?.children);
  };
  collect(node);
  return out;
};

const buttonByText = (tree: React.ReactElement, text: string): React.ReactElement<any> | undefined => {
  let found: React.ReactElement<any> | undefined;
  walk(tree, (element) => {
    if (found || String(element.type) !== "button") return;
    if (textOf(element).includes(text)) found = element;
  });
  return found;
};

const checkboxIn = (label: React.ReactElement<any> | undefined): React.ReactElement<any> | undefined => {
  if (!label) return undefined;
  let found: React.ReactElement<any> | undefined;
  walk(label, (element) => {
    if (element.props?.type === "checkbox") found = element;
  });
  return found;
};

describe("22.5(2) Polish reserve decline toggle", () => {
  test("the deploy control defaults to auto-deploying the Polish reserve army", () => {
    const G = polishWar();
    expect(polishReserveDeployer(G)).toBe("GE");
    expect(polishReserveIds(G)).toHaveLength(2);
    const moves = moveBag("deployReserves");
    const tree = renderTree(G, "GE", moves);

    const toggle = byTestId(tree, "ie-polish-reserve-toggle");
    expect(toggle).toBeDefined();
    expect(textOf(toggle)).toContain("Also deploy 1 Polish reserve army");
    const checkbox = checkboxIn(toggle);
    expect(checkbox).toBeDefined();
    expect(checkbox!.props.checked).toBe(true);

    const deploy = buttonByText(tree, "Deploy reserves");
    expect(deploy).toBeDefined();
    deploy!.props.onClick();
    expect(moves.deployReserves).toHaveBeenCalledWith("berlin", expect.any(Number), {polishReserve: true});
  });

  test("declining the toggle passes {polishReserve:false}", () => {
    (globalThis as unknown as {__polishReserveDefault?: boolean}).__polishReserveDefault = false;
    const G = polishWar();
    const moves = moveBag("deployReserves");
    const tree = renderTree(G, "GE", moves);

    const toggle = byTestId(tree, "ie-polish-reserve-toggle");
    const checkbox = checkboxIn(toggle);
    expect(checkbox).toBeDefined();
    expect(checkbox!.props.checked).toBe(false);

    const deploy = buttonByText(tree, "Deploy reserves");
    expect(deploy).toBeDefined();
    deploy!.props.onClick();
    expect(moves.deployReserves).toHaveBeenCalledWith("berlin", expect.any(Number), {polishReserve: false});
    (globalThis as unknown as {__polishReserveDefault?: boolean}).__polishReserveDefault = undefined;
  });

  test("the toggle is absent when the viewer does not control Poland", () => {
    const G = polishWar();
    G.spaces.poland.ally = null;
    const tree = renderTree(G, "GE", moveBag("deployReserves"));
    expect(byTestId(tree, "ie-polish-reserve-toggle")).toBeUndefined();
  });
});

describe("revealed goals row renders in English", () => {
  test("the public row uses the localized title", () => {
    const G = polishWar();
    G.revealedGoals = ["NG-24"];
    const tree = renderTree(G, "GE", moveBag("deployReserves"));
    const row = byTestId(tree, "ie-revealed-goals");
    expect(row).toBeDefined();
    expect(textOf(row)).toContain("Revealed National Goals");
    expect(textOf(row)).toContain("Napoleon's Legacy");
  });
});
