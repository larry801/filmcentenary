/**
 * Rule 19.2 — avoiding naval battle.
 *
 * A naval move that ends in a space containing enemy naval units opens the
 * defender's avoid/fight decision before any battle.  These tests cover the
 * printed DRMs, the destination restrictions, the one-roll split across ports,
 * the cross-seat decision, failure's -1 battle modifier, and the fact that
 * intercepted/intercepting units never get an avoid offer.
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {friendlySpace, navalUnitsIn} from "./engine/rules";
import {navalAvoidPlans, navalAvoidanceModifiers} from "./engine/combat";
import {navalBattle, navalIntercept, navalMove, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "1"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {
      Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3,
    },
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

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const seat = (power: Power): string => String(POWERS.indexOf(power));

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
  budgets: {},
  initiative: [],
  treaties: [],
  victor: null,
  truceTurns: 2,
  passed: [],
  startedTurn: 1,
} as unknown as WarState);

const clearNaval = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...navalUnitsIn(G, space)]) removeUnit(G, unit.id);
};

/**
 * UK (seat 1) vs FR (seat 2) at war.  The North Atlantic, Brittany and the
 * Western Mediterranean are empty so destination planning is predictable.
 */
const navalWar = (): ImperialElegyState => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "UK";
  G.passed = [];
  G.pending = null;
  G.battle = null;
  G.cpRemaining = 6;
  G.war = warState("UK", "FR");
  for (const space of ["north-atlantic", "brittany", "western-mediterranean", "provence", "london"]) {
    clearNaval(G, space);
  }
  return G;
};

const ukShip = (G: ImperialElegyState): string =>
  placeUnit(G, "UK", "squadron", "london", 2).id;

/** UK moves one ship from London into the North Atlantic, contacting FR. */
const contact = (G: ImperialElegyState, frShips = 1): string[] => {
  const ships = Array.from({length: frShips}, () => placeUnit(G, "FR", "squadron", "north-atlantic", 2).id);
  const mover = ukShip(G);
  expect(navalMove(G, makeCtx([], seat("UK")), [mover], "north-atlantic")).toBeUndefined();
  return ships;
};

// ---------------------------------------------------------------------------
// 19.2 DRMs
// ---------------------------------------------------------------------------

describe("19.2 avoidance DRMs", () => {
  test("an ocean box gives +1; a sea does not", () => {
    const G = fresh();
    expect(navalAvoidanceModifiers(G, "GE", "UK", "north-atlantic").notes).toContain("oceanBox");
    expect(navalAvoidanceModifiers(G, "GE", "UK", "north-atlantic").drm).toBeGreaterThanOrEqual(1);
    expect(navalAvoidanceModifiers(G, "GE", "UK", "baltic-sea").notes).not.toContain("oceanBox");
    expect(navalAvoidanceModifiers(G, "GE", "UK", "western-mediterranean").notes).not.toContain("oceanBox");
    expect(navalAvoidanceModifiers(G, "GE", "UK", "black-sea").notes).not.toContain("oceanBox");
  });

  test("the attacker having no adjacent friendly port is +1", () => {
    const G = fresh();
    // GE holds no port touching the North Atlantic at the campaign start.
    const mods = navalAvoidanceModifiers(G, "GE", "UK", "north-atlantic");
    expect(mods.notes).toContain("attackerNoPorts");
  });

  test("an attacker with two more adjacent ports takes -1", () => {
    const G = fresh();
    // UK holds London, Scotland, Ireland and Gibraltar on the North Atlantic;
    // FR holds Brittany.
    const mods = navalAvoidanceModifiers(G, "UK", "FR", "north-atlantic");
    expect(mods.notes).toContain("attackerPortAdvantage");
    expect(mods.drm).toBe(0);
    expect(mods.notes).not.toContain("attackerNoPorts");
  });
});

// ---------------------------------------------------------------------------
// Destination restrictions
// ---------------------------------------------------------------------------

describe("19.2 legal destinations", () => {
  test("a friendly port is offered and an enemy box is not", () => {
    const G = navalWar();
    placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    placeUnit(G, "UK", "squadron", "western-mediterranean", 2);
    const plans = navalAvoidPlans(G, "UK", "FR", "north-atlantic", "london");
    expect(plans.some((plan) => plan.space === "brittany")).toBe(true);
    expect(plans.some((plan) => plan.space === "western-mediterranean")).toBe(false);
  });

  test("the space the attack came from can never be chosen", () => {
    const G = navalWar();
    placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    const plans = navalAvoidPlans(G, "UK", "FR", "north-atlantic", "brittany");
    expect(plans.some((plan) => plan.space === "brittany")).toBe(false);
  });

  test("a fleet larger than a port is split across two ports with one plan", () => {
    const G = navalWar();
    for (let i = 0; i < 5; i += 1) placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    const plans = navalAvoidPlans(G, "UK", "FR", "north-atlantic", "london");
    const brittany = plans.find((plan) => plan.space === "brittany");
    expect(brittany).toBeDefined();
    expect(brittany!.ports.length).toBeGreaterThan(1);
    expect(brittany!.ports[0]).toBe("brittany");
    expect(new Set(brittany!.ports).size).toBe(brittany!.ports.length);
    for (const port of brittany!.ports) expect(friendlySpace(G, port, "FR")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Live decision flow
// ---------------------------------------------------------------------------

describe("19.2 live avoid/fight decision", () => {
  test("contact opens a cross-seat decision that only the defender can answer", () => {
    const G = navalWar();
    contact(G);
    expect(G.battle).toBeNull();
    expect(G.pending?.kind).toBe("navalAvoid");
    expect(G.pending?.power).toBe("FR");
    const ids = G.pending!.options.map((entry) => entry.id);
    expect(ids).toContain("fight");
    expect(ids.some((id) => id.startsWith("avoid:"))).toBe(true);

    // The attacker's seat cannot answer the defender's decision.
    expect(resolvePending(G, makeCtx([6], seat("UK")), "fight")).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("navalAvoid");
  });

  test("a successful avoid moves the fleet and no battle is fought", () => {
    const G = navalWar();
    const ships = contact(G);
    const frCtx = makeCtx([6], seat("FR"));
    expect(resolvePending(G, frCtx, "avoid:brittany")).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(G.pending).toBeNull();
    expect(G.units[ships[0]].space).toBe("brittany");
    expect(navalUnitsIn(G, "north-atlantic").filter((unit) => unit.owner === "FR")).toHaveLength(0);
    const last = G.log[G.log.length - 1];
    expect(last.key).toBe("navalAvoidance");
    expect(last.args?.success).toBe(true);
  });

  test("a failed avoid starts the battle with the -1 failure modifier", () => {
    const G = navalWar();
    contact(G);
    expect(resolvePending(G, makeCtx([1], seat("FR")), "avoid:brittany")).toBeUndefined();
    expect(G.battle?.kind).toBe("naval");
    expect(G.battle?.attacker).toBe("UK");
    expect(G.battle?.to).toBe("north-atlantic");
    expect(G.battle?.notes).toContain("failedAvoid");
    const last = G.log.find((entry) => entry.key === "navalAvoidance")!;
    expect(last.args?.success).toBe(false);
  });

  test("fighting gives the defender no failure modifier", () => {
    const G = navalWar();
    contact(G);
    expect(resolvePending(G, makeCtx([], seat("FR")), "fight")).toBeUndefined();
    expect(G.battle?.kind).toBe("naval");
    expect(G.battle?.notes).not.toContain("failedAvoid");
  });

  test("declining the decision defaults to fight and cannot deadlock", () => {
    const G = navalWar();
    contact(G);
    const fallback = G.pending!.options.find((entry) => entry.id === "fight");
    expect(fallback).toBeDefined();
    expect(resolvePending(G, makeCtx([], seat("FR")), fallback!.id)).toBeUndefined();
    expect(G.battle?.kind).toBe("naval");
  });

  test("the explicit naval battle action also gives the defender the avoid decision", () => {
    const G = navalWar();
    placeUnit(G, "UK", "squadron", "brittany", 2);
    placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    expect(navalBattle(G, makeCtx([], seat("UK")), "brittany", "north-atlantic")).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(G.pending?.kind).toBe("navalAvoid");
    expect(G.pending?.power).toBe("FR");
    const avoid = G.pending!.options.find((entry) => entry.id.startsWith("avoid:"));
    expect(avoid).toBeDefined();
    expect(resolvePending(G, makeCtx([6], seat("FR")), avoid!.id)).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(navalUnitsIn(G, "north-atlantic").filter((unit) => unit.owner === "FR")).toHaveLength(0);
  });

  test("an enemy port contact also opens the avoid decision", () => {
    const G = navalWar();
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const mover = ukShip(G);
    expect(navalMove(G, makeCtx([], seat("UK")), [mover], "brittany")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalAvoid");
    expect(G.pending?.power).toBe("FR");
    expect(G.battle).toBeNull();
    expect(resolvePending(G, makeCtx([], seat("FR")), "fight")).toBeUndefined();
    expect(G.battle?.kind).toBe("naval");
    expect(G.battle?.to).toBe("brittany");
  });
});

// ---------------------------------------------------------------------------
// 5.5.4 / 19.2 exceptions
// ---------------------------------------------------------------------------

describe("19.2 combat exceptions", () => {
  test("interception never offers the intercepting ships an avoid decision", () => {
    const G = navalWar();
    const mover = ukShip(G);
    expect(navalMove(G, makeCtx([], seat("UK")), [mover], "north-atlantic")).toBeUndefined();
    placeUnit(G, "FR", "squadron", "brittany", 2);
    expect(navalIntercept(G, makeCtx([5], seat("FR")), "brittany", "north-atlantic")).toBeUndefined();
    expect(G.battle?.kind).toBe("naval");
    expect(G.pending?.kind).not.toBe("navalAvoid");
  });

  test("a port attack may bring at most four ships (5.5.4)", () => {
    const G = navalWar();
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const movers = Array.from({length: 5}, () => placeUnit(G, "UK", "squadron", "london", 2).id);
    expect(navalMove(G, makeCtx([], seat("UK")), movers, "brittany")).toBe(INVALID_MOVE);
    expect(navalUnitsIn(G, "brittany").filter((unit) => unit.owner === "UK")).toHaveLength(0);
  });
});
