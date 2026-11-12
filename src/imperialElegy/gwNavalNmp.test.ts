/**
 * Rule 12.3 in the Great War — a GW naval maneuver uses the same Naval Movement
 * Point path as a wartime naval move: one budget point buys unlimited movement
 * through European Waters, gate checks (Suez, Dardanelles, enemy boxes) apply
 * on the whole route, and contact/interception/avoidance still resolve at the
 * destination.
 */

import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {navalUnitsIn} from "./engine/rules";
import {performGwManeuver} from "./engine/greatWarFlow";
import {planNavalMove} from "./engine/navalMovement";
import {navalMove} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const baseGw = (overrides: Partial<GreatWarState> = {}): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = {
    active: true,
    turn: 1,
    order: ["GE", "FR", "RU"],
    belligerents: ["GE", "FR", "RU"],
    neutrals: ["UK", "AU", "OT"],
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
  G.powers.RU.alliance = "taCommitted";
  G.phase = "gwPlanning";
  return G;
};

const clearNaval = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...navalUnitsIn(G, space)]) removeUnit(G, unit.id);
};

const maneuver = (overrides: Partial<GreatWarState> = {}): ImperialElegyState => {
  const G = baseGw(overrides);
  G.phase = "gwManeuver";
  G.activePower = "GE";
  G.turnIndex = 0;
  G.pending = null;
  G.battle = null;
  G.powers.GE.gwBudget = 6;
  G.powers.GE.flags.gwActionsThisImpulse = 0;
  G.powers.GE.flags.passedGw = false;
  for (const space of [
    "baltic-sea",
    "pomerania",
    "prussia",
    "denmark",
    "north-atlantic",
    "western-mediterranean",
    "eastern-mediterranean",
  ]) {
    clearNaval(G, space);
  }
  return G;
};

describe("GW naval NMP (12.3)", () => {
  test("one GW budget point crosses several European boxes", () => {
    const G = maneuver();
    const ship = placeUnit(G, "GE", "squadron", "pomerania", 2).id;
    // The same route a wartime naval move would take: Pomerania (port) ->
    // Baltic -> North Atlantic -> Western Mediterranean (three sea hops).
    expect(planNavalMove(G, "GE", "pomerania", "western-mediterranean")).toMatchObject({
      ok: true,
      path: ["pomerania", "baltic-sea", "north-atlantic", "western-mediterranean"],
    });

    const res = performGwManeuver(G, makeCtx(), {
      kind: "naval",
      power: "GE",
      unitIds: [ship],
      to: "western-mediterranean",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.cost).toBe(1);
    expect(G.units[ship].space).toBe("western-mediterranean");
    // One action = one budget point, regardless of the number of boxes crossed.
    expect(G.powers.GE.gwBudget).toBe(5);
    expect(G.log.some((entry) => entry.key === "gwManeuverAction" && entry.args?.kind === "naval")).toBe(true);
  });

  test("the live navalMove wrapper reaches the same multi-box GW move", () => {
    const G = maneuver();
    const ship = placeUnit(G, "GE", "squadron", "pomerania", 2).id;
    expect(navalMove(G, makeCtx([], "0"), [ship], "north-atlantic")).toBeUndefined();
    expect(G.units[ship].space).toBe("north-atlantic");
    expect(G.powers.GE.gwBudget).toBe(5);
  });

  test("a GW joint naval operation moves both contingents over the same NMP route", () => {
    const G = maneuver({te: ["GE", "FR"], ta: ["RU"], belligerents: ["GE", "FR", "RU"]});
    G.powers.GE.alliance = "teCommitted";
    // 19.1: a joint move is now intercepted at each box it enters, so clear the
    // Baltic port squadron to keep this test about the NMP route itself.
    clearNaval(G, "st-petersburg");
    const own = placeUnit(G, "GE", "squadron", "pomerania", 2).id;
    const ally = placeUnit(G, "FR", "squadron", "pomerania", 2).id;
    const res = performGwManeuver(G, makeCtx(), {
      kind: "jointNaval",
      power: "GE",
      ally: "FR",
      unitIds: [own],
      allyUnitIds: [ally],
      to: "north-atlantic",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.units[own].space).toBe("north-atlantic");
    expect(G.units[ally].space).toBe("north-atlantic");
    expect(G.powers.GE.gwBudget).toBe(5);
  });

  test("an enemy-occupied box is still never a stepping stone on a GW route", () => {
    const G = maneuver({te: ["FR", "RU"]});
    const ship = placeUnit(G, "GE", "squadron", "pomerania", 2).id;
    placeUnit(G, "RU", "squadron", "north-atlantic", 2);
    const res = performGwManeuver(G, makeCtx(), {
      kind: "naval",
      power: "GE",
      unitIds: [ship],
      to: "western-mediterranean",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalidTarget");
    expect(G.units[ship].space).toBe("pomerania");
    expect(G.powers.GE.gwBudget).toBe(6);
  });

  test("the destination contact still opens the interception/avoidance chain", () => {
    const G = maneuver({te: ["RU"]});
    const ship = placeUnit(G, "GE", "squadron", "pomerania", 2).id;
    placeUnit(G, "RU", "squadron", "baltic-sea", 2);
    // RU's Baltic port (St Petersburg) can intercept the contact in the Baltic;
    // the enemy-occupied destination is a battle space, never a stepping stone.
    placeUnit(G, "RU", "squadron", "st-petersburg", 2);

    const res = performGwManeuver(G, makeCtx(), {
      kind: "naval",
      power: "GE",
      unitIds: [ship],
      to: "baltic-sea",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.units[ship].space).toBe("baltic-sea");
    expect(G.pending?.kind).toBe("navalInterception");
    expect(G.pending?.power).toBe("RU");
  });

  test("a joint naval contact records the ally in the 19.1 continuation state", () => {
    const G = maneuver({te: ["GE", "FR"], ta: ["RU"], belligerents: ["GE", "FR", "RU"]});
    G.powers.GE.alliance = "teCommitted";
    const own = placeUnit(G, "GE", "squadron", "pomerania", 2).id;
    const ally = placeUnit(G, "FR", "squadron", "pomerania", 2).id;
    placeUnit(G, "RU", "squadron", "baltic-sea", 2);
    const res = performGwManeuver(G, makeCtx(), {
      kind: "jointNaval",
      power: "GE",
      ally: "FR",
      unitIds: [own],
      allyUnitIds: [ally],
      to: "baltic-sea",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.pending?.kind).toBe("navalInterception");
    expect(G.navalContinuation?.ally).toBe("FR");
    expect(new Set(G.navalContinuation?.unitIds)).toEqual(new Set([own, ally]));
    expect(G.powers.GE.gwBudget).toBe(5);
  });

  test("a port contact still caps the attacking ships at four (5.5.4)", () => {
    const G = maneuver();
    const movers = Array.from({length: 5}, () => placeUnit(G, "GE", "squadron", "baltic-sea", 2).id);
    placeUnit(G, "RU", "squadron", "st-petersburg", 2);
    G.spaces["st-petersburg"].control = "RU";
    const res = performGwManeuver(G, makeCtx(), {
      kind: "naval",
      power: "GE",
      unitIds: movers,
      to: "st-petersburg",
    });
    expect(res.ok).toBe(false);
    expect(G.powers.GE.gwBudget).toBe(6);
  });
});
