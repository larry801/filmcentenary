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
  return {...actual, useState, useEffect: () => undefined};
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
import {ImperialElegyBoard} from "./board";

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
  visit(node as React.ReactElement<any>);
  walk((node as React.ReactElement<any>).props?.children, visit);
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
  "gwTransferBudget", "gwRevealCombat", "redeploy", "navalMove",
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

  test("a non-combat GW card does not offer the reveal control", () => {
    const G = baseGw();
    G.phase = "gwPlanning";
    G.powers.GE.gwCard = "IE-GW-01";
    const tree = render(G, "GE", moveBag(...GW_MOVES));
    expect(byTestId(tree, "ie-gw-reveal")).toBeUndefined();
  });
});
