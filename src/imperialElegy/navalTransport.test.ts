jest.mock("react", () => {
  const actual = jest.requireActual("react");
  const useState = (initial: unknown) => [
    typeof initial === "function" ? (initial as () => unknown)() : initial,
    () => undefined,
  ];
  const useMemo = (fn: () => unknown) => fn();
  const useCallback = (fn: unknown) => fn;
  const useRef = (initial: unknown) => ({current: initial});
  const useContext = (ctx: {defaultValue?: unknown}) => ctx?.defaultValue;
  return {...actual, useState, useEffect: () => undefined, useMemo, useCallback, useRef, useContext};
});

jest.mock("./components/theme", () => {
  const React = require("react");
  return {
    IESurface: ({children, className}: any) => React.createElement("div", {className}, children),
    IEPanel: ({title, children, actions}: any) => React.createElement("section", null, React.createElement("h3", null, title), actions, children),
    IEBadge: ({children}: any) => React.createElement("span", null, children),
    IEChip: ({children}: any) => React.createElement("span", null, children),
  };
});

jest.mock("./components/map", () => {
  const React = require("react");
  return {IEMap: () => React.createElement("svg", {"data-testid": "ie-map"})};
});

/**
 * 12.3 naval movement: "Each naval movement action allows a player to move all
 * their naval units plus one land unit by sea for 1 CP. The land unit can move
 * through naval boxes as if it was a naval unit (they are considered to be on
 * transports), and they are not required to be escorted by friendly naval
 * units."
 *
 * The live `navalTransport` move: one army-type land unit + any of the power's
 * naval units starting in the same port/box, one NMP path, port/stacking
 * limits, no enemy-port landing (19.10 keeps that for amphibious assault).
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {BattleState, GreatWarState, ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {navalTransport, navalTransportCheck} from "./moves";
import {placeUnit, removeUnit} from "./engine/effects";
import {beginNavalBattle, finishBattle, resolveNavalInterception} from "./engine/combat";
import {planNavalTransport} from "./engine/navalMovement";
import React from "react";
import {ImperialElegyBoard} from "./components/board";

type MoveBag = Record<string, jest.Mock>;
const walk = (node: unknown, visit: (element: React.ReactElement<any>) => void): void => {
  if (node === null || node === undefined || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const child of node) walk(child, visit); return; }
  if (!React.isValidElement(node)) return;
  const el = node as React.ReactElement<any>;
  visit(el);
  if (typeof el.type === "function") { try { walk((el.type as (p: any) => unknown)(el.props), visit); } catch {} }
  walk(el.props?.children, visit);
};
const byTestId = (tree: React.ReactElement, testId: string): React.ReactElement<any> | undefined => {
  let found: React.ReactElement<any> | undefined;
  walk(tree, (element) => { if (element.props?.["data-testid"] === testId) found = element; });
  return found;
};

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    random: {Die: (n: number) => Math.min(n, 3)},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));
const fresh = (power: Power = "UK", cp = 5): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = cp;
  return G;
};

const clearSpace = (G: ImperialElegyState, space: string): void => {
  for (const id of [...G.spaces[space].units]) delete G.units[id];
  G.spaces[space].units = [];
};

const warState = (attacker: Power, defender: Power): WarState => ({
  attacker,
  defender,
  attackerAllies: [],
  defenderAllies: [],
  attackerMinors: [],
  defenderMinors: [],
  warAim: "conquest",
  objectives: [],
  status: "maneuver",
  budgets: {[attacker]: 2, [defender]: 2},
  initiative: [],
  treaties: [],
  victor: null,
  truceTurns: 2,
  passed: [],
  startedTurn: 1,
});

const gwState = (): GreatWarState => ({
  active: true,
  turn: 1,
  order: ["GE", "UK", "FR"],
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
});

/** A clean London (army + fleet) sailing into a friendly Brest. */
const londonToBrest = (): {G: ImperialElegyState; army: string; fleet: string[]; ctx: Ctx} => {
  const G = fresh("UK", 5);
  clearSpace(G, "london");
  clearSpace(G, "brittany");
  G.spaces.brittany.control = "UK";
  const army = placeUnit(G, "UK", "army", "london", 2).id;
  const fleet = [placeUnit(G, "UK", "squadron", "london", 2).id, placeUnit(G, "UK", "squadron", "london", 2).id];
  return {G, army, fleet, ctx: makeCtx(seat("UK"))};
};

describe("12.3 naval transport", () => {
  test("moves one land unit and the fleet by sea for 1 CP", () => {
    const {G, army, fleet, ctx} = londonToBrest();
    const check = navalTransportCheck(G, "UK", army, fleet, "brittany");
    expect(check.ok).toBe(true);
    expect(check.path).toEqual(["london", "north-atlantic", "brittany"]);

    expect(navalTransport(G, ctx, army, fleet, "brittany")).toBeUndefined();

    expect(G.cpRemaining).toBe(4);
    expect(G.units[army].space).toBe("brittany");
    for (const id of fleet) expect(G.units[id].space).toBe("brittany");
    const entry = G.log.filter((log) => log.key === "navalTransport").at(-1);
    expect(entry?.args).toMatchObject({from: "london", to: "brittany", unit: army, count: 3});
  });

  test("the land unit may sail unescorted (12.3: no escort required)", () => {
    const {G, army, ctx} = londonToBrest();
    expect(navalTransport(G, ctx, army, [], "brittany")).toBeUndefined();
    expect(G.units[army].space).toBe("brittany");
    expect(G.cpRemaining).toBe(4);
  });

  test("the unit must be an army-type land unit", () => {
    const G = fresh("GE", 5);
    clearSpace(G, "berlin");
    const corps = placeUnit(G, "GE", "eliteCorps", "berlin", 1).id;
    expect(navalTransportCheck(G, "GE", corps, [], "berlin").reason).toBe("land-kind");
    // A naval unit cannot be the carried land unit either.
    const ship = placeUnit(G, "GE", "squadron", "berlin", 2).id;
    expect(navalTransportCheck(G, "GE", ship, [], "berlin").reason).toBe("land-kind");
    // Another power's land unit is not commanded by this seat.
    const foreignLand = Object.values(G.units).find((unit) => unit.owner === "FR" && !unit.naval)!;
    expect(navalTransportCheck(G, "GE", foreignLand.id, [], "berlin").reason).toBe("land-unit");
  });

  test("the fleet must belong to the moving power and start with the army", () => {
    const {G, army} = londonToBrest();
    const foreign = Object.values(G.units).find((unit) => unit.owner === "FR" && unit.naval);
    expect(foreign).toBeDefined();
    expect(navalTransportCheck(G, "UK", army, [foreign!.id], "brittany").reason).toBe("naval-unit");

    const elsewhere = placeUnit(G, "UK", "squadron", "scotland", 2).id;
    expect(navalTransportCheck(G, "UK", army, [elsewhere], "brittany").reason).toBe("different-origin");
  });

  test("the origin must be a port or naval box and not an enemy port", () => {
    const {G, army} = londonToBrest();
    G.phase = "action";
    const inland = placeUnit(G, "UK", "army", "saxony", 2).id;
    expect(navalTransportCheck(G, "UK", inland, [], "brittany").reason).toBe("origin-not-port");

    G.war = warState("FR", "UK");
    G.spaces.london.control = "FR";
    expect(navalTransportCheck(G, "UK", army, [], "brittany").reason).toBe("origin-hostile");
  });

  test("the destination must be a different, non-hostile port", () => {
    const {G, army} = londonToBrest();
    expect(navalTransportCheck(G, "UK", army, [], "saxony").reason).toBe("target-not-port");
    expect(navalTransportCheck(G, "UK", army, [], "london").reason).toBe("same-space");
    G.war = warState("UK", "FR");
    G.spaces.brittany.control = "FR";
    expect(navalTransportCheck(G, "UK", army, [], "brittany").reason).toBe("target-hostile");
  });

  test("an unreachable port is a path failure", () => {
    const {G, army} = londonToBrest();
    G.spaces["australia-new-zealand"].control = "UK";
    expect(navalTransportCheck(G, "UK", army, [], "australia-new-zealand").reason).toBe("path");
  });

  test("5.5.3 army stacking applies at the destination", () => {
    const {G, army} = londonToBrest();
    for (let i = 0; i < 3; i += 1) placeUnit(G, "UK", "army", "brittany", 2);
    expect(navalTransportCheck(G, "UK", army, [], "brittany").reason).toBe("army-stacking");
  });

  test("5.5.4 port capacity applies at the destination", () => {
    const {G, army, fleet} = londonToBrest();
    for (let i = 0; i < 4; i += 1) placeUnit(G, "UK", "squadron", "brittany", 2);
    expect(navalTransportCheck(G, "UK", army, [fleet[0]], "brittany").reason).toBe("port-capacity");
    // The army alone still fits: the four ships are already in port.
    expect(navalTransportCheck(G, "UK", army, [], "brittany").ok).toBe(true);
  });

  test("phase, seat, pending and CP gates reject before moving anything", () => {
    const {G, army, ctx} = londonToBrest();
    G.pending = {kind: "eventChoice"} as never;
    expect(navalTransportCheck(G, "UK", army, [], "brittany").reason).toBe("busy");
    expect(navalTransport(G, ctx, army, [], "brittany")).toBe(INVALID_MOVE);
    G.pending = null;

    G.battle = {} as BattleState;
    expect(navalTransportCheck(G, "UK", army, [], "brittany").reason).toBe("busy");
    expect(navalTransport(G, ctx, army, [], "brittany")).toBe(INVALID_MOVE);
    G.battle = null;

    G.activePower = "FR";
    expect(navalTransportCheck(G, "UK", army, [], "brittany").reason).toBe("not-active");
    expect(navalTransport(G, ctx, army, [], "brittany")).toBe(INVALID_MOVE);
    G.activePower = "UK";

    G.cpRemaining = 0;
    expect(navalTransportCheck(G, "UK", army, [], "brittany").reason).toBe("no-budget");
    expect(navalTransport(G, ctx, army, [], "brittany")).toBe(INVALID_MOVE);
    expect(G.units[army].space).toBe("london");

    G.phase = "end";
    expect(navalTransportCheck(G, "UK", army, [], "brittany").reason).toBe("phase");
  });

  test("a wartime impulse spends the war budget, not CP", () => {
    const {G, army, fleet} = londonToBrest();
    G.phase = "wartime";
    G.war = warState("UK", "GE");
    G.cpRemaining = 0;
    expect(navalTransport(G, makeCtx(seat("UK")), army, fleet, "brittany")).toBeUndefined();
    expect(G.war!.budgets.UK).toBe(1);
    expect(G.units[army].space).toBe("brittany");
  });

  test("a GW maneuver spends the GW budget and closes the response window", () => {
    const {G, army, fleet} = londonToBrest();
    G.phase = "gwManeuver";
    G.gw = gwState();
    G.powers.UK.gwBudget = 3;
    G.powers.UK.flags.gwActionsThisImpulse = 0;
    expect(navalTransport(G, makeCtx(seat("UK")), army, fleet, "malta")).toBeUndefined();
    expect(G.powers.UK.gwBudget).toBe(2);
    expect(G.powers.UK.flags.gwActionsThisImpulse).toBe(1);
    expect(G.units[army].space).toBe("malta");
  });
});

describe("planNavalTransport (pure)", () => {
  test("reports the printed reason without mutating state", () => {
    const {G, army, fleet} = londonToBrest();
    const before = JSON.stringify(G);
    const plan = planNavalTransport(G, "UK", G.units[army], fleet.map((id) => G.units[id]), "brittany");
    expect(plan.ok).toBe(true);
    expect(JSON.stringify(G)).toBe(before);

    G.war = warState("UK", "FR");
    G.spaces.brittany.control = "FR";
    const enemy = planNavalTransport(G, "UK", G.units[army], [], "brittany");
    expect(enemy.ok).toBe(false);
    expect(enemy.reason).toBe("target-hostile");
  });
});


describe("12.3 naval transport board control", () => {
  test("renders the loading port, one land unit and calls the move", () => {
    const {G, army, fleet} = londonToBrest();
    // Keep the selector deterministic: London is the only transportable port.
    clearSpace(G, "india");
    const moves: MoveBag = {navalTransport: jest.fn()};
    const tree = (ImperialElegyBoard as unknown as (props: unknown) => React.ReactElement)({
      G,
      ctx: makeCtx(seat("UK")),
      moves,
      playerID: seat("UK"),
    });
    expect(byTestId(tree, "ie-naval-transport")).toBeDefined();
    expect(byTestId(tree, "ie-naval-transport-from")?.props?.value).toBe("london");
    expect(byTestId(tree, "ie-naval-transport-land")?.props?.value).toBe(army);
    expect(byTestId(tree, "ie-naval-transport-go")?.props?.disabled).toBe(false);

    byTestId(tree, "ie-naval-transport-go")?.props?.onClick?.();
    expect(moves.navalTransport).toHaveBeenCalledWith(army, fleet, expect.any(String));
  });
});

// Rule 12.3: "The land unit can move through naval boxes as if it was a naval
// unit (they are considered to be on transports) ... Additionally, units moving
// by sea can be intercepted during wartime [19.1]."  Rule 19.6.1 says a
// transported land unit retreats with its escorting fleet and is eliminated
// when that escort is destroyed.
describe("12.3 transport interception (19.1) and carried land losses (19.6.1)", () => {
  /** UK army + fleet at London, sailing to friendly Brest, with FR at war. */
  const contested = () => {
    const base = londonToBrest();
    base.G.war = warState("UK", "FR");
    base.G.spaces.picardy.control = "FR";
    const fr = placeUnit(base.G, "FR", "squadron", "picardy", 2).id;
    return {...base, fr};
  };

  test("an enemy port adjacent to an intermediate box interrupts the transport", () => {
    const {G, army, fleet, ctx} = contested();
    expect(navalTransport(G, ctx, army, fleet, "brittany")).toBeUndefined();

    // The whole stack (transported army included) is parked in the box where
    // the 19.1 window opened, not at the destination.
    expect(G.pending?.kind).toBe("navalInterception");
    expect(G.pending?.power).toBe("FR");
    expect(G.navalTransit?.index).toBe(1);
    expect(G.navalTransit?.path).toEqual(["london", "north-atlantic", "brittany"]);
    expect(G.navalTransit?.unitIds).toEqual([army, ...fleet]);
    expect(G.units[army].space).toBe("north-atlantic");
    for (const id of fleet) expect(G.units[id].space).toBe("north-atlantic");
    expect(G.units[army].space).not.toBe("brittany");
  });

  test("declining the interception finishes the landing at the planned port", () => {
    const {G, army, fleet, ctx} = contested();
    // An uncontrolled port where the UK has influence: the interrupted landing
    // must still record the 15.3 occupation.
    G.spaces.brittany.control = null;
    G.spaces.brittany.influence = "UK";
    expect(navalTransport(G, ctx, army, fleet, "brittany")).toBeUndefined();
    expect(resolveNavalInterception(G, ctx, G.pending!, "skip")).toBe(true);

    expect(G.pending).toBeNull();
    expect(G.navalTransit).toBeNull();
    expect(G.units[army].space).toBe("brittany");
    for (const id of fleet) expect(G.units[id].space).toBe("brittany");
    expect(G.spaces.brittany.occupiedBy).toBe("UK");
  });

  test("a defeated transport retreats its carried army with the surviving fleet", () => {
    const G = setupImperialElegy(makeCtx());
    G.phase = "action";
    G.activePower = "UK";
    G.war = warState("UK", "FR");
    G.pending = null;
    G.battle = null;
    clearSpace(G, "london");
    clearSpace(G, "north-atlantic");
    clearSpace(G, "brittany");
    G.spaces.brittany.control = "UK";
    const army = placeUnit(G, "UK", "army", "brittany", 2).id;
    const ship = placeUnit(G, "UK", "squadron", "brittany", 2).id;
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const ctx = makeCtx(seat("UK"));

    const battle = beginNavalBattle(G, ctx, "UK", "london", "brittany", {attackerUnits: [ship]});
    expect(battle).not.toBeNull();
    G.pending = null;
    battle!.winner = "defender";
    finishBattle(G, ctx);

    // 19.7: the beaten attacker falls back to the space it attacked from.
    expect(G.units[ship]?.space).toBe("london");
    // 19.6.1: the carried army retreats with it.
    expect(G.units[army]?.space).toBe("london");
  });

  test("a carried army whose whole escort is eliminated is eliminated (19.6.1)", () => {
    const G = setupImperialElegy(makeCtx());
    G.phase = "action";
    G.activePower = "UK";
    G.war = warState("UK", "FR");
    G.pending = null;
    G.battle = null;
    clearSpace(G, "london");
    clearSpace(G, "brittany");
    G.spaces.brittany.control = "UK";
    const army = placeUnit(G, "UK", "army", "brittany", 2).id;
    const ship = placeUnit(G, "UK", "squadron", "brittany", 2).id;
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const ctx = makeCtx(seat("UK"));

    const battle = beginNavalBattle(G, ctx, "UK", "london", "brittany", {attackerUnits: [ship]});
    expect(battle).not.toBeNull();
    G.pending = null;
    battle!.winner = "defender";
    // The last escorting ship is destroyed before the battle is finished.
    removeUnit(G, ship);
    finishBattle(G, ctx);

    expect(G.units[ship]).toBeUndefined();
    expect(G.units[army]).toBeUndefined();
  });
});
