/**
 * Rule 19.1/19.2 — a naval move that contacts enemy ships resolves the 19.1
 * interception attempts *before* opening the defender's 19.2 avoidance
 * decision, then the battle.  Intercepted/intercepting units are never offered
 * avoidance.
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {navalUnitsIn} from "./engine/rules";
import {navalMove, resolvePending} from "./moves";

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

/** UK (seat 1) vs FR (seat 2), UK active, North Atlantic stage cleared. */
const navalWar = (): ImperialElegyState => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "UK";
  G.passed = [];
  G.pending = null;
  G.battle = null;
  G.cpRemaining = 6;
  G.war = warState("UK", "FR");
  for (const space of ["north-atlantic", "brittany", "picardy", "london", "western-mediterranean"]) {
    clearNaval(G, space);
  }
  return G;
};

/** UK moves one ship into the North Atlantic where FR ships wait. */
const contact = (G: ImperialElegyState, frShips = 1): string[] => {
  const ships = Array.from({length: frShips}, () => placeUnit(G, "FR", "squadron", "north-atlantic", 2).id);
  const mover = placeUnit(G, "UK", "squadron", "london", 2).id;
  expect(navalMove(G, makeCtx([], seat("UK")), [mover], "north-atlantic")).toBeUndefined();
  return ships;
};

describe("19.1 interception before 19.2 avoidance", () => {
  test("a contact opens the interception window first; declining hands over to avoidance", () => {
    const G = navalWar();
    placeUnit(G, "FR", "squadron", "brittany", 2);
    contact(G);
    expect(G.battle).toBeNull();
    expect(G.pending?.kind).toBe("navalInterception");
    expect(G.pending?.power).toBe("FR");
    expect(G.pending?.options.map((option) => option.id)).toEqual(
      expect.arrayContaining(["intercept:brittany", "skip"]),
    );

    expect(resolvePending(G, makeCtx([], seat("FR")), "skip")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalAvoid");
    expect(G.pending?.power).toBe("FR");
  });

  test("a successful interception starts the battle and never offers avoidance", () => {
    const G = navalWar();
    const moved = placeUnit(G, "UK", "squadron", "london", 2).id;
    placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    placeUnit(G, "FR", "squadron", "brittany", 2);
    expect(navalMove(G, makeCtx([], seat("UK")), [moved], "north-atlantic")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalInterception");
    expect(resolvePending(G, makeCtx([5], seat("FR")), "intercept:brittany")).toBeUndefined();
    expect(G.battle?.kind).toBe("naval");
    expect(G.battle?.attacker).toBe("UK");
    expect(G.battle?.to).toBe("north-atlantic");
    // The interceptor joins the contacted fleet in the main defence.
    expect(G.battle?.mainDefense.some((id) => G.units[id]?.owner === "FR")).toBe(true);
    expect(G.pending?.kind).not.toBe("navalAvoid");
  });

  test("a failed interception continues with the remaining ports, then avoidance", () => {
    const G = navalWar();
    placeUnit(G, "FR", "squadron", "brittany", 2);
    placeUnit(G, "FR", "squadron", "picardy", 2);
    contact(G);
    expect(G.pending?.options.map((option) => option.id)).toEqual(
      expect.arrayContaining(["intercept:brittany", "intercept:picardy"]),
    );
    // Fail the Brittany roll (die 1): the Picardy window stays open.
    expect(resolvePending(G, makeCtx([1], seat("FR")), "intercept:brittany")).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(G.pending?.kind).toBe("navalInterception");
    expect(G.pending?.options.map((option) => option.id)).toContain("intercept:picardy");
    expect(G.pending?.options.map((option) => option.id)).not.toContain("intercept:brittany");
    // Failing the last port hands the decision to the 19.2 avoidance step.
    expect(resolvePending(G, makeCtx([1], seat("FR")), "intercept:picardy")).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(G.pending?.kind).toBe("navalAvoid");
  });

  test("the interception window is private to the intercepting seat", () => {
    const G = navalWar();
    placeUnit(G, "FR", "squadron", "brittany", 2);
    contact(G);
    expect(resolvePending(G, makeCtx([5], seat("UK")), "intercept:brittany")).toBe(INVALID_MOVE);
    expect(resolvePending(G, makeCtx([5], seat("GE")), "skip")).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("navalInterception");
  });

  test("declining the interception decision cannot deadlock", () => {
    const G = navalWar();
    placeUnit(G, "FR", "squadron", "brittany", 2);
    contact(G);
    expect(resolvePending(G, makeCtx([], seat("FR")), "skip")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalAvoid");
    expect(resolvePending(G, makeCtx([], seat("FR")), "fight")).toBeUndefined();
    expect(G.battle?.kind).toBe("naval");
  });
});
