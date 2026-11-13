/**
 * Board controls for the round-1 engine moves that had no buttons:
 * 33.4 auAction, 33.3 rebuildZouave, 33.5 tsrrRailMove, 33.6 useJihad.
 *
 * Jest runs in a Node environment with no jsdom, so the existing board tests
 * inspect static markup.  To exercise the handlers as well, this suite renders
 * the component with the two React hooks it uses stubbed, walks the returned
 * element tree, and invokes the button's `onClick` against a mocked `moves`
 * object (exactly the boardgame.io move bag the real client passes in).
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
import type {BattleState, ImperialElegyState, Power} from "../types";
import {POWERS} from "../types";
import {setupImperialElegy} from "../engine/setup";
import {placeUnit, removeUnit} from "../engine/effects";
import {ImperialElegyBoard} from "./board";

const testCtx = {
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => undefined, setPhase: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "action",
} as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (active: Power, cp = 3): ImperialElegyState => {
  const G = setupImperialElegy(testCtx);
  G.phase = "action";
  G.activePower = active;
  G.cpRemaining = cp;
  G.pending = null;
  G.battle = null;
  return G;
};

const battleState = (): BattleState => ({
  kind: "land",
  attacker: "RU",
  defender: "OT",
  from: "ankara",
  to: "istanbul",
  mainAttack: [],
  mainDefense: [],
  supportAttack: [],
  supportDefense: [],
  stage: "cards",
  supportSide: "attacker",
  attackerDrm: 0,
  defenderDrm: 0,
  attackerLosses: 0,
  defenderLosses: 0,
  decisive: false,
  notes: [],
});

type MoveBag = Record<string, (...args: any[]) => void>;

const moveBag = (...names: string[]): MoveBag =>
  Object.fromEntries(names.map((name) => [name, jest.fn()]));

const renderTree = (G: ImperialElegyState, power: Power, moves: MoveBag): React.ReactElement => {
  const tree = (ImperialElegyBoard as unknown as (props: unknown) => React.ReactElement)({
    G,
    ctx: testCtx,
    moves,
    playerID: seat(power),
  });
  return tree;
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

const click = (tree: React.ReactElement, testId: string): void => {
  const element = byTestId(tree, testId);
  if (element === undefined) throw new Error(`no element ${testId}`);
  const onClick = element.props?.onClick;
  if (typeof onClick !== "function") throw new Error(`${testId} has no onClick`);
  onClick();
};

const isDisabled = (tree: React.ReactElement, testId: string): boolean => {
  const element = byTestId(tree, testId);
  if (element === undefined) throw new Error(`no element ${testId}`);
  return element.props?.disabled === true;
};

const titleOf = (tree: React.ReactElement, testId: string): string | undefined => byTestId(tree, testId)?.props?.title;

describe("33.3 French Zouaves", () => {
  test("the rebuild button is enabled, costs 1 CP and calls rebuildZouave", () => {
    const G = fresh("FR", 2);
    const zouave = Object.values(G.units).find((unit) => unit.kind === "zouave" && unit.owner === "FR");
    expect(zouave).toBeDefined();
    removeUnit(G, zouave!.id);

    const moves = moveBag("rebuildZouave");
    const tree = renderTree(G, "FR", moves);
    expect(byTestId(tree, "ie-national-actions")).toBeDefined();
    expect(isDisabled(tree, "ie-rebuild-zouave")).toBe(false);
    click(tree, "ie-rebuild-zouave");
    expect(moves.rebuildZouave).toHaveBeenCalledTimes(1);
  });

  test("the button is disabled while the Zouaves are in play or CP are gone", () => {
    const inPlay = fresh("FR", 2);
    const moves = moveBag("rebuildZouave");
    const tree = renderTree(inPlay, "FR", moves);
    expect(isDisabled(tree, "ie-rebuild-zouave")).toBe(true);
    expect(titleOf(tree, "ie-rebuild-zouave")).toContain("already in play");

    const noCp = fresh("FR", 0);
    removeUnit(noCp, Object.values(noCp.units).find((unit) => unit.kind === "zouave" && unit.owner === "FR")!.id);
    const noCpTree = renderTree(noCp, "FR", moveBag("rebuildZouave"));
    expect(isDisabled(noCpTree, "ie-rebuild-zouave")).toBe(true);
    expect(titleOf(noCpTree, "ie-rebuild-zouave")).toContain("Needs 1 CP");
  });

  test("the FR panel only appears for the active French player", () => {
    const G = fresh("GE", 3);
    const tree = renderTree(G, "FR", moveBag("rebuildZouave"));
    expect(byTestId(tree, "ie-national-actions")).toBeUndefined();
  });
});

describe("33.4 Austrian special actions", () => {
  test("Reforms defaults to the first eligible nationality and calls auAction", () => {
    const G = fresh("AU", 3);
    const moves = moveBag("auAction");
    const tree = renderTree(G, "AU", moves);
    expect(byTestId(tree, "ie-au-actions")).toBeDefined();
    expect(isDisabled(tree, "ie-au-reforms")).toBe(false);
    click(tree, "ie-au-reforms");
    expect(moves.auAction).toHaveBeenCalledWith("reforms", "Italians");
  });

  test("Expand Citizenship picks an eligible nationality and passes the sacrifice flag", () => {
    const G = fresh("AU", 3);
    G.powers.AU.rights = ["Hungarians"];
    const moves = moveBag("auAction");
    const tree = renderTree(G, "AU", moves);
    expect(isDisabled(tree, "ie-au-citizenship")).toBe(false);
    click(tree, "ie-au-citizenship");
    expect(moves.auAction).toHaveBeenCalledWith("expandCitizenship", "Hungarians", false);
  });

  test("Incorporate lists allied minors with full citizenship and calls auAction", () => {
    const G = fresh("AU", 3);
    G.powers.AU.citizenship = ["Germans"];
    G.spaces.saxony.ally = "AU";
    const moves = moveBag("auAction");
    const tree = renderTree(G, "AU", moves);
    expect(isDisabled(tree, "ie-au-incorporate")).toBe(false);
    click(tree, "ie-au-incorporate");
    expect(moves.auAction).toHaveBeenCalledWith("incorporate", "saxony");
  });

  test("all three actions are disabled and explain the 3 CP cost", () => {
    const G = fresh("AU", 2);
    G.powers.AU.rights = ["Hungarians"];
    G.powers.AU.citizenship = ["Germans"];
    G.spaces.saxony.ally = "AU";
    const tree = renderTree(G, "AU", moveBag("auAction"));
    for (const id of ["ie-au-reforms", "ie-au-citizenship", "ie-au-incorporate"]) {
      expect(isDisabled(tree, id)).toBe(true);
      expect(titleOf(tree, id)).toContain("Needs 3 CP");
    }
  });

  test("ineligible targets surface the decision reasons", () => {
    const G = fresh("AU", 3);
    const tree = renderTree(G, "AU", moveBag("auAction"));
    expect(isDisabled(tree, "ie-au-citizenship")).toBe(true);
    expect(titleOf(tree, "ie-au-citizenship")).toContain("does not have rights yet");
    expect(isDisabled(tree, "ie-au-incorporate")).toBe(true);
    expect(titleOf(tree, "ie-au-incorporate")).toContain("eligible");
  });
});

describe("33.5 Trans-Siberian Railroad", () => {
  test("a completed railroad with an army on the route enables the rail move", () => {
    const G = fresh("RU", 0);
    G.powers.RU.tsrr = true;
    const army = placeUnit(G, "RU", "army", "moscow", 2);
    const moves = moveBag("tsrrRailMove");
    const tree = renderTree(G, "RU", moves);
    expect(byTestId(tree, "ie-tsrr-actions")).toBeDefined();
    expect(isDisabled(tree, "ie-tsrr-rail")).toBe(false);
    click(tree, "ie-tsrr-rail");
    expect(moves.tsrrRailMove).toHaveBeenCalledWith(army.id, "tsaritsyn");
  });

  test("an incomplete railroad disables the move and shows the reason", () => {
    const G = fresh("RU", 0);
    placeUnit(G, "RU", "army", "moscow", 2);
    const tree = renderTree(G, "RU", moveBag("tsrrRailMove"));
    expect(isDisabled(tree, "ie-tsrr-rail")).toBe(true);
    expect(titleOf(tree, "ie-tsrr-rail")).toContain("not complete");
  });

  test("no army on the route disables the move even when the line is complete", () => {
    const G = fresh("RU", 0);
    G.powers.RU.tsrr = true;
    const tree = renderTree(G, "RU", moveBag("tsrrRailMove"));
    expect(isDisabled(tree, "ie-tsrr-rail")).toBe(true);
    expect(titleOf(tree, "ie-tsrr-rail")).toContain("No army");
  });
});

describe("33.6 Ottoman Jihad markers", () => {
  test("the pre-dice battle panel offers a Jihad marker and calls useJihad", () => {
    const G = fresh("RU", 1);
    G.powers.OT.jihad = 1;
    G.battle = battleState();
    const moves = moveBag("useJihad");
    const tree = renderTree(G, "OT", moves);
    expect(byTestId(tree, "ie-jihad-actions")).toBeDefined();
    expect(isDisabled(tree, "ie-use-jihad")).toBe(false);
    click(tree, "ie-use-jihad");
    expect(moves.useJihad).toHaveBeenCalledTimes(1);
  });

  test("the button is disabled after the dice or after Jihad was used", () => {
    const rolled = fresh("RU", 1);
    rolled.powers.OT.jihad = 1;
    rolled.battle = {...battleState(), attackerRoll: 4};
    const rolledTree = renderTree(rolled, "OT", moveBag("useJihad"));
    expect(isDisabled(rolledTree, "ie-use-jihad")).toBe(true);
    expect(titleOf(rolledTree, "ie-use-jihad")).toContain("dice have already been rolled");

    const used = fresh("RU", 1);
    used.powers.OT.jihad = 1;
    used.battle = {...battleState(), jihadUsed: true};
    const usedTree = renderTree(used, "OT", moveBag("useJihad"));
    expect(isDisabled(usedTree, "ie-use-jihad")).toBe(true);
    expect(titleOf(usedTree, "ie-use-jihad")).toContain("already used");
  });

  test("no marker means no available button", () => {
    const G = fresh("RU", 1);
    G.powers.OT.jihad = 0;
    G.battle = battleState();
    const tree = renderTree(G, "OT", moveBag("useJihad"));
    expect(isDisabled(tree, "ie-use-jihad")).toBe(true);
    expect(titleOf(tree, "ie-use-jihad")).toContain("No Jihad marker");
  });
});
