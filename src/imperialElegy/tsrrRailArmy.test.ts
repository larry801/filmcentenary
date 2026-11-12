/**
 * 33.5 / 15.2.5 — the Trans-Siberian Railroad "rail 1 army" clause.
 *
 * The rulebook prints a *movement allowance* ("can rail 1 army along the
 * railroad per impulse"), not a distinct railroad army unit.  The RU "Special"
 * counter on the 4.2 chart is the TSRR completion marker.  These tests pin that
 * reading and the live move: an existing army counter is moved for free, once
 * per impulse, by RU or by an ally at war with RU.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {counterPool} from "./engine/counters";
import {tsrrRail, TSRR_RAIL_ARMY_KINDS} from "./engine/characteristics";
import {RU_TSRR_MARKER_COUNTERS} from "./engine/counters";
import {endImpulse, passWar, tsrrRailMove} from "./moves";

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

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const moveUnit = (G: ImperialElegyState, unitId: string, to: string): void => {
  const unit = G.units[unitId];
  if (unit.space) G.spaces[unit.space].units = G.spaces[unit.space].units.filter((id) => id !== unitId);
  G.spaces[to].units.push(unitId);
  unit.space = to;
};

const startAction = (G: ImperialElegyState, power: Power, cp = 0): void => {
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = cp;
  G.pending = null;
};

const makeWar = (attacker: Power, defender: Power, overrides: Partial<WarState> = {}): WarState => ({
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
  victor: "defender",
  truceTurns: 0,
  passed: [],
  startedTurn: 1,
  ...overrides,
});

const lastLog = (G: ImperialElegyState, key: string) =>
  [...G.log].reverse().find((entry) => entry.key === key);

const russianArmyAtMoscow = (G: ImperialElegyState): string => {
  const army = Object.values(G.units).find((unit) => unit.owner === "RU" && unit.kind === "army")!;
  moveUnit(G, army.id, "moscow");
  return army.id;
};

describe("33.5 the railroad clause is a movement allowance, not a unit", () => {
  test("no railroad army counter is printed or modelled", () => {
    expect(TSRR_RAIL_ARMY_KINDS).toEqual(["army", "reserveArmy"]);
    expect(TSRR_RAIL_ARMY_KINDS).not.toContain("railroadArmy" as never);
    // The RU "Special" chart counter is the TSRR completion marker; the RU
    // player's army pool stays at the printed five counters.
    expect(RU_TSRR_MARKER_COUNTERS).toBe(1);
    const G = fresh();
    expect(counterPool(G, "RU").army).toBe(5);
  });

  test("the live move relocates an existing counter without creating one", () => {
    const G = fresh();
    G.powers.RU.tsrr = true;
    const unitId = russianArmyAtMoscow(G);
    startAction(G, "RU", 0);
    const unitIds = Object.keys(G.units).sort();

    expect(tsrrRailMove(G, makeCtx([], seat("RU")), unitId, "urals")).toBeUndefined();

    expect(Object.keys(G.units).sort()).toEqual(unitIds);
    expect(G.units[unitId].kind).toBe("army");
    expect(G.units[unitId].owner).toBe("RU");
    expect(G.units[unitId].space).toBe("urals");
    // The allowance is free: no CP is spent and it is not a rail action.
    expect(G.cpRemaining).toBe(0);
  });

  test("a reserve army is an army counter too (5.1.2)", () => {
    const G = fresh();
    G.powers.RU.tsrr = true;
    const reserve = placeUnit(G, "RU", "reserveArmy", "moscow", 2);
    startAction(G, "RU", 0);
    expect(tsrrRail(G, "RU", reserve.id, "tsaritsyn").allowed).toBe(true);
    expect(tsrrRailMove(G, makeCtx([], seat("RU")), reserve.id, "tsaritsyn")).toBeUndefined();
    expect(G.units[reserve.id].space).toBe("tsaritsyn");
  });

  test("only one army may be railed: ECs, EFs and ships are refused", () => {
    const G = fresh();
    G.powers.RU.tsrr = true;
    startAction(G, "RU", 0);
    const ec = placeUnit(G, "RU", "eliteCorps", "moscow", 1);
    const ef = placeUnit(G, "RU", "expeditionary", "moscow", 1);
    const ship = placeUnit(G, "RU", "squadron", "urals", 2);
    for (const unit of [ec, ef, ship]) {
      const decision = tsrrRail(G, "RU", unit.id, unit.id === ship.id ? "tsaritsyn" : "urals");
      expect(decision.allowed).toBe(false);
      expect(decision.reasons.join(" | ")).toMatch(/Only one army/);
    }
    expect(tsrrRailMove(G, makeCtx([], seat("RU")), ec.id, "urals")).toBe(INVALID_MOVE);
    expect(lastLog(G, "tsrrRailRejected")?.args?.reasons).toMatch(/Only one army/);
  });
});

describe("33.5 who may rail", () => {
  test("RU may rail once per impulse; the flag blocks a second move", () => {
    const G = fresh();
    G.powers.RU.tsrr = true;
    const unitId = russianArmyAtMoscow(G);
    startAction(G, "RU", 0);
    expect(tsrrRailMove(G, makeCtx([], seat("RU")), unitId, "urals")).toBeUndefined();
    expect(tsrrRailMove(G, makeCtx([], seat("RU")), unitId, "tsaritsyn")).toBe(INVALID_MOVE);
    expect(lastLog(G, "tsrrRailRejected")?.args?.reasons).toMatch(/already used this impulse/);
  });

  test("an RU ally may rail during wartime but not in peacetime", () => {
    const peace = fresh();
    peace.powers.RU.tsrr = true;
    const french = Object.values(peace.units).find((unit) => unit.owner === "FR" && unit.kind === "army")!;
    moveUnit(peace, french.id, "moscow");
    startAction(peace, "FR", 0);
    expect(tsrrRailMove(peace, makeCtx([], seat("FR")), french.id, "urals")).toBe(INVALID_MOVE);
    expect(lastLog(peace, "tsrrRailRejected")?.args?.reasons).toMatch(/allies during wartime/);

    const war = fresh();
    war.powers.RU.tsrr = true;
    const ally = Object.values(war.units).find((unit) => unit.owner === "FR" && unit.kind === "army")!;
    moveUnit(war, ally.id, "moscow");
    war.phase = "wartime";
    war.activePower = "FR";
    war.war = makeWar("RU", "OT", {attackerAllies: ["FR"]});
    expect(tsrrRailMove(war, makeCtx([], seat("FR")), ally.id, "urals")).toBeUndefined();
    expect(war.units[ally.id].space).toBe("urals");
  });

  test("a power on the other side of the war cannot use the line", () => {
    const G = fresh();
    G.powers.RU.tsrr = true;
    const french = Object.values(G.units).find((unit) => unit.owner === "FR" && unit.kind === "army")!;
    moveUnit(G, french.id, "moscow");
    G.phase = "wartime";
    G.activePower = "FR";
    G.war = makeWar("RU", "OT", {defenderAllies: ["FR"]});
    expect(tsrrRailMove(G, makeCtx([], seat("FR")), french.id, "urals")).toBe(INVALID_MOVE);
    expect(lastLog(G, "tsrrRailRejected")?.args?.reasons).toMatch(/allies during wartime/);
  });
});

describe("33.5 per-impulse reset (4.5)", () => {
  test("the action-phase allowance clears when the impulse passes", () => {
    const G = fresh();
    G.powers.RU.tsrr = true;
    const unitId = russianArmyAtMoscow(G);
    startAction(G, "RU", 0);
    expect(tsrrRailMove(G, makeCtx([], seat("RU")), unitId, "urals")).toBeUndefined();
    expect(tsrrRailMove(G, makeCtx([], seat("RU")), unitId, "tsaritsyn")).toBe(INVALID_MOVE);

    // End RU's impulse; the allowance resets for the next impulse (which may
    // belong to RU again after the other seats).
    expect(endImpulse(G, makeCtx([], seat("RU")))).toBeUndefined();
    for (const power of POWERS) expect(G.powers[power].flags.tsrrRailImpulse).toBeUndefined();

    G.phase = "action";
    G.activePower = "RU";
    expect(tsrrRailMove(G, makeCtx([], seat("RU")), unitId, "tsaritsyn")).toBeUndefined();
    expect(G.units[unitId].space).toBe("tsaritsyn");
  });

  test("the wartime allowance clears when the maneuver passes", () => {
    const G = fresh();
    G.powers.RU.tsrr = true;
    const french = Object.values(G.units).find((unit) => unit.owner === "FR" && unit.kind === "army")!;
    moveUnit(G, french.id, "moscow");
    G.phase = "wartime";
    G.activePower = "FR";
    G.war = makeWar("RU", "OT", {attackerAllies: ["FR"]});
    expect(tsrrRailMove(G, makeCtx([], seat("FR")), french.id, "urals")).toBeUndefined();
    expect(G.powers.FR.flags.tsrrRailImpulse).toBeDefined();

    expect(passWar(G, makeCtx([], seat("FR")))).toBeUndefined();
    expect(G.powers.FR.flags.tsrrRailImpulse).toBeUndefined();

    // FR's next impulse may rail again.
    G.phase = "wartime";
    G.activePower = "FR";
    expect(tsrrRailMove(G, makeCtx([], seat("FR")), french.id, "moscow")).toBeUndefined();
    expect(G.units[french.id].space).toBe("moscow");
  });

  test("the free allowance is not offered in the Great War (27.5 uses the CP rail action)", () => {
    const G = fresh();
    G.powers.RU.tsrr = true;
    const unitId = russianArmyAtMoscow(G);
    G.phase = "gwManeuver";
    G.activePower = "RU";
    G.cpRemaining = 3;
    expect(tsrrRailMove(G, makeCtx([], seat("RU")), unitId, "urals")).toBe(INVALID_MOVE);
    expect(lastLog(G, "tsrrRailRejected")?.args?.reasons).toMatch(/action-phase and wartime/);
    expect(G.cpRemaining).toBe(3);
  });
});
