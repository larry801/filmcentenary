/**
 * Round-8: Great War maneuver board controls.
 *
 * `ALL_MOVES` already registered gwMarch/gwRail/gwDeploy/gwTransferBudget/
 * gwRevealCombat, but the board only exposed draft/pass/end, so a GW turn could
 * not be played from the UI.  These tests render the real component with a
 * stateful `useState` shim and an interactive map stub (Jest runs in a Node
 * environment), then drive the same clicks a player would: pick the origin
 * space, pick a unit, pick the destination, and press the GW action button.
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
  // The interaction state machine is a real reducer; keep it stateful so the
  // suite's mapSelect / unit-click / mapSelect sequence behaves like a board.
  const useReducer = (reducer: (state: unknown, action: unknown) => unknown, initial: unknown) => {
    const index = mockHookIndex.value++;
    if (!(index in mockStateStore)) {
      mockStateStore[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
    }
    return [
      mockStateStore[index],
      (action: unknown) => {
        mockStateStore[index] = reducer(mockStateStore[index], action);
      },
    ];
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
  // The board renders IEMap as a child component, so the element tree only
  // carries its onSelect prop; `mapSelect` below drives that callback directly.
  return {IEMap: () => React.createElement("svg", {"data-testid": "ie-map"})};
});

jest.mock("../../constant/i18n", () => ({
  __esModule: true,
  default: {use: () => undefined, getLocaleName: () => "en", locale: async () => undefined},
}));

import React from "react";
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power} from "../types";
import {POWERS} from "../types";
import {setupImperialElegy} from "../engine/setup";
import {isArmyKind} from "../engine/rules";
import {placeUnit} from "../engine/effects";
import {useBoardModel} from "./useBoardModel";
import {BoardLayout} from "./BoardLayout";

const testCtx = {
  playerID: "0",
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => undefined, setPhase: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "gwManeuver",
} as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));

const baseGw = (overrides: Partial<GreatWarState> = {}): ImperialElegyState => {
  const G = setupImperialElegy(testCtx);
  G.gw = {
    active: true,
    turn: 1,
    order: ["GE", "FR"],
    belligerents: ["GE", "FR"],
    neutrals: ["UK", "AU", "RU", "OT"],
    te: ["FR"],
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
    ...overrides,
  };
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.phase = "gwPlanning";
  G.activePower = "GE";
  G.turnIndex = 0;
  G.pending = null;
  G.battle = null;
  G.war = null;
  return G;
};

type MoveBag = Record<string, (...args: any[]) => void>;

const moveBag = (...names: string[]): MoveBag =>
  Object.fromEntries(names.map((name) => [name, jest.fn()]));

const render = (G: ImperialElegyState, power: Power, moves: MoveBag): React.ReactElement => {
  mockHookIndex.value = 0;
  return ((props: unknown) => React.createElement(BoardLayout, {model: (useBoardModel as unknown as (p: unknown) => never)(props)}))({
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

const click = (tree: React.ReactElement, testId: string): void => {
  const element = byTestId(tree, testId);
  if (element === undefined) throw new Error(`missing control ${testId}`);
  element.props.onClick?.({currentTarget: element, target: element});
};

/** Drive the map's onSelect callback, as a click on that space would. */
const mapSelect = (tree: React.ReactElement, space: string): void => {
  let onSelect: ((id: string) => void) | undefined;
  walk(tree, (element) => {
    if (typeof element.props?.onSelect === "function") onSelect = element.props.onSelect;
  });
  if (onSelect === undefined) throw new Error("no map onSelect");
  onSelect(space);
};

const findArmy = (G: ImperialElegyState, power: Power, space: string): string => {
  const army = Object.values(G.units).find(
    (unit) => unit.owner === power && unit.space === space && !unit.naval && isArmyKind(unit.kind),
  );
  if (army === undefined) throw new Error(`no ${power} army in ${space}`);
  return army.id;
};

beforeEach(() => {
  mockStateStore.length = 0;
  mockHookIndex.value = 0;
});

const GW_MOVES = [
  "gwMarch", "gwRail", "gwDeploy", "gwDraft", "gwPass", "gwEndTurn",
  "gwTransferBudget", "gwRevealCombat", "gwGiftCombatCard", "redeploy", "navalMove",
] as const;

describe("Great War maneuver board controls", () => {
  test("selecting a land unit and a destination offers march and rail (27.5)", () => {
    const G = baseGw();
    G.phase = "gwManeuver";
    G.powers.GE.gwBudget = 3;
    G.spaces.berlin.control = "GE";
    G.spaces.pomerania.control = "GE";
    const army = findArmy(G, "GE", "berlin");
    const moves = moveBag(...GW_MOVES);

    mapSelect(render(G, "GE", moves), "berlin");
    click(render(G, "GE", moves), `ie-unit-${army}`);
    mapSelect(render(G, "GE", moves), "pomerania");
    const tree = render(G, "GE", moves);

    const march = byTestId(tree, "ie-gw-march");
    const rail = byTestId(tree, "ie-gw-rail");
    expect(march).toBeTruthy();
    expect(rail).toBeTruthy();
    expect(march!.props.disabled).toBe(false);

    march!.props.onClick();
    expect(moves.gwMarch).toHaveBeenCalledWith(army, "pomerania");
    rail!.props.onClick();
    expect(moves.gwRail).toHaveBeenCalledWith(army, "pomerania");
    // The generic wartime redeploy must not fire during a GW turn.
    expect(moves.redeploy).not.toHaveBeenCalled();
  });

  test("a selected controlled home key exposes GW deploy reserves (27.5)", () => {
    const G = baseGw();
    G.phase = "gwManeuver";
    G.powers.GE.gwBudget = 3;
    G.spaces.berlin.control = "GE";
    const moves = moveBag(...GW_MOVES);

    mapSelect(render(G, "GE", moves), "berlin");
    const tree = render(G, "GE", moves);
    const deploy = byTestId(tree, "ie-gw-deploy");
    expect(deploy).toBeTruthy();
    expect(deploy!.props.disabled).toBe(false);
    deploy!.props.onClick();
    expect(moves.gwDeploy).toHaveBeenCalledWith("berlin");
  });

  test("planning exposes the allied CP transfer and the combat-card reveal (27.6/26.1)", () => {
    const G = baseGw();
    G.phase = "gwPlanning";
    G.gw!.ta = ["GE", "AU"];
    G.powers.AU.alliance = "taCommitted";
    G.powers.GE.gwBudget = 3;
    G.powers.GE.gwCard = "IE-GW-03";
    const moves = moveBag(...GW_MOVES);

    const tree = render(G, "GE", moves);
    expect(byTestId(tree, "ie-gw-transfer")).toBeTruthy();
    expect(byTestId(tree, "ie-gw-transfer-to")?.props.value).toBe("AU");

    click(tree, "ie-gw-transfer-submit");
    expect(moves.gwTransferBudget).toHaveBeenCalledWith("AU", 1);

    click(tree, "ie-gw-reveal");
    expect(moves.gwRevealCombat).toHaveBeenCalled();
  });

  test("planning exposes the 26.1 gift of a faceup in-front combat card", () => {
    const G = baseGw();
    G.phase = "gwPlanning";
    G.gw!.ta = ["GE", "AU"];
    G.gw!.combatCardsInFront = [{holder: "GE", cardId: "IE-GW-03", faceup: true}];
    const moves = moveBag(...GW_MOVES);

    const tree = render(G, "GE", moves);
    expect(byTestId(tree, "ie-gw-gift")).toBeTruthy();
    expect(byTestId(tree, "ie-gw-gift-card")?.props.value).toBe("IE-GW-03");
    expect(byTestId(tree, "ie-gw-gift-to")?.props.value).toBe("AU");

    click(tree, "ie-gw-gift-submit");
    expect(moves.gwGiftCombatCard).toHaveBeenCalledWith("AU", "IE-GW-03");
  });

  test("a facedown in-front card offers no gift control", () => {
    const G = baseGw();
    G.phase = "gwPlanning";
    G.gw!.ta = ["GE", "AU"];
    G.gw!.combatCardsInFront = [{holder: "GE", cardId: "IE-GW-03", faceup: false}];
    const tree = render(G, "GE", moveBag(...GW_MOVES));
    expect(byTestId(tree, "ie-gw-gift")).toBeUndefined();
  });

  test("a non-combat GW card does not offer the reveal control", () => {
    const G = baseGw();
    G.phase = "gwPlanning";
    G.powers.GE.gwCard = "IE-GW-01";
    const tree = render(G, "GE", moveBag(...GW_MOVES));
    expect(byTestId(tree, "ie-gw-reveal")).toBeUndefined();
  });
});

/**
 * 27.1–27.3: the impulse's exit is one button, and when it is grey the panel must
 * say why.  Reported case: France played its 1-CP GW card, deployed reserves with
 * the bonus, and every control went grey — the card's action is not a substitute
 * for the ordinary budget action, so the pass is refused until one is spent.
 */
describe("Great War impulse exit states", () => {
  const fr = (impulse: Record<string, unknown>): ImperialElegyState => {
    const G = baseGw();
    G.phase = "gwManeuver";
    G.gw!.turn = 0;
    G.gw!.order = ["FR", "GE"];
    G.activePower = "FR";
    G.turnIndex = 0;
    G.powers.FR.gwBudget = 5;
    G.powers.FR.manpower = 4;
    placeUnit(G, "FR", "army", "paris", 2);
    G.gw!.impulse = {power: "FR", turn: 0, index: 0, serial: 1, acted: true, ...impulse} as never;
    return G;
  };

  test("after a card-funded deploy the panel explains the budget action still owed", () => {
    const tree = render(fr({cardPlayed: true, bonusAction: "deploy"}), "FR", moveBag(...GW_MOVES));
    expect(byTestId(tree, "ie-gw-pass")?.props.disabled).toBe(true);
    const hint = byTestId(tree, "ie-gw-impulse-hint");
    expect(hint).toBeTruthy();
    expect(hint!.props.children).toContain("war-budget CP");
    expect(hint!.props.children).toContain("march, rail, draft or refit");
  });

  test("after the ordinary budget action the impulse can be ended", () => {
    const tree = render(fr({budgetAction: "deploy"}), "FR", moveBag(...GW_MOVES));
    expect(byTestId(tree, "ie-gw-pass")?.props.disabled).toBe(false);
    expect(byTestId(tree, "ie-gw-impulse-hint")).toBeUndefined();
  });
});

/**
 * 27.1: the maneuver's exit belongs in the pinned dock, not only in the War
 * tab.  A player who reads the dock (every campaign phase ends there) used to
 * see no way to finish a Great War impulse at all: the button existed only
 * inside the War panel, and the dock's one-line summary never said what the
 * impulse still owed.
 */
describe("Great War exit in the pinned dock", () => {
  const maneuver = (impulse: Record<string, unknown>): ImperialElegyState => {
    const G = baseGw();
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.turnIndex = 0;
    G.powers.GE.gwBudget = 5;
    G.gw!.impulse = {power: "GE", turn: 1, index: 0, serial: 1, acted: false, ...impulse} as never;
    return G;
  };
  const summary = (tree: React.ReactElement): string =>
    String(byTestId(tree, "ie-dock-summary")?.props?.children ?? "");

  test("the dock ends a completed impulse", () => {
    const tree = render(maneuver({acted: true, budgetAction: "deploy"}), "GE", moveBag(...GW_MOVES));
    const pass = byTestId(tree, "ie-gw-pass-dock");
    expect(pass).toBeTruthy();
    expect(pass?.props.disabled).toBeFalsy();
    expect(pass?.props.children).toBe("End impulse");
    expect(summary(tree)).toBe("Action done — end your impulse");
  });

  test("an impulse that still owes its budget action keeps the exit disabled with the reason", () => {
    const tree = render(maneuver({}), "GE", moveBag(...GW_MOVES));
    const pass = byTestId(tree, "ie-gw-pass-dock");
    expect(pass?.props.disabled).toBe(true);
    expect(pass?.props.title).toContain("war-budget CP");
    expect(summary(tree)).toContain("you may pass only at 2 or less");
  });

  test("the planning step can start the maneuver from the dock", () => {
    const G = baseGw();
    G.phase = "gwPlanning";
    G.activePower = "GE";
    const tree = render(G, "GE", moveBag("endGwPlanningMove"));
    expect(byTestId(tree, "ie-gw-start-dock")).toBeTruthy();
  });
});
