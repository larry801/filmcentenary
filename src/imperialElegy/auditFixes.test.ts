/**
 * Fixes from the printed-rule audit of §§9–12 and §§13–17 (2026-11-23).
 *
 * Four printed clauses were unwired or over-permissive:
 *
 *  - 15.2 / 27.5: "players cannot perform recruitment or refit actions in
 *    wartime" — `recruit` did not read the shared phase gate every other 12.1
 *    action uses.
 *  - 12.16: battles against rebels "can be conducted from adjacent spaces or
 *    from the same space" — a same-space battle was refused unless a 28.1.2
 *    trench marker was present.
 *  - 12.17.1: "Players can never declare war on the US or the CSA" — the US is
 *    in the minor-home map because it owns The South and could be attacked.
 *  - 12.3 (errata): "Land units using naval movement during peacetime must end
 *    the impulse in a port they control" — any non-hostile port was accepted.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {beginLandBattle} from "./engine/combat";
import {createWarState, warTargetFromKey} from "./engine/limitedWar";
import {declarationDefenders} from "./engine/declarationTargets";
import {planNavalTransport} from "./engine/navalMovement";
import {declareWar, recruit} from "./moves";

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

const seat = (power: string): string => String(POWERS.indexOf(power as never));

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

describe("12.2 / 15.2 — recruitment is refused in wartime and the GW", () => {
  test("a limited-war maneuver cannot recruit", () => {
    const G = fresh();
    G.phase = "wartime";
    G.activePower = "GE";
    G.war = createWarState(G, "GE", "FR", "conquest", ["alsace-lorraine"], 2);
    G.war.status = "maneuver";
    expect(recruit(G, makeCtx([], seat("GE")), "berlin", "reserveArmy")).toBe(INVALID_MOVE);
    expect(recruit(G, makeCtx([], seat("GE")), "berlin", "army", 1)).toBe(INVALID_MOVE);
  });

  test("the Great War maneuver cannot recruit", () => {
    const G = fresh();
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
    };
    G.phase = "gwManeuver";
    G.activePower = "GE";
    expect(recruit(G, makeCtx([], seat("GE")), "berlin", "reserveArmy")).toBe(INVALID_MOVE);
  });

  test("the action phase still recruits", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "UK";
    G.cpRemaining = 4;
    G.pending = null;
    // 33.2: the printed 1st British Army is the only pre-GW British army; the
    // existing recruitment suite removes it to make a second build legal.
    const first = Object.values(G.units).find(
      (u) => u.owner === "UK" && u.kind === "army" && u.flags?.firstArmy === true,
    )!;
    removeUnit(G, first.id);
    expect(recruit(G, makeCtx([], seat("UK")), "scotland", "army", 1)).toBeUndefined();
    expect(G.cpRemaining).toBe(3);
  });
});

describe("12.16 — a same-space battle against rebels is legal", () => {
  test("an army stacked with rebel armies attacks in place", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    placeUnit(G, "GE", "army", "berlin", 2);
    const rebel = placeUnit(G, "REBEL:Berlin", "rebelArmy", "berlin", 2);
    const battle = beginLandBattle(G, makeCtx(), "GE", "berlin", "berlin");
    expect(battle).not.toBeNull();
    expect(battle?.mainDefense).toContain(rebel.id);
  });

  test("a same-space battle against a non-rebel is still 28.1.2-only", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    placeUnit(G, "GE", "army", "berlin", 2);
    placeUnit(G, "FR", "army", "berlin", 2);
    expect(beginLandBattle(G, makeCtx(), "GE", "berlin", "berlin")).toBeNull();
  });
});

describe("12.17.1 — the US and the CSA are never war targets", () => {
  test("the US never appears in the declaration list", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    const targets = declarationDefenders(G, "GE", null).map((entry) =>
      typeof entry.target === "string" ? entry.target : entry.target.minor);
    expect(targets).not.toContain("United States");
  });

  test("declareWar on the United States is refused", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.cpRemaining = 4;
    expect(warTargetFromKey("minor:United States")).toEqual({minor: "United States"});
    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "United States"}, "conquest", ["the-south"], 1))
      .toBe(INVALID_MOVE);
    expect(G.war).toBeNull();
  });
});

describe("12.3 errata — peacetime transports end in a controlled port", () => {
  test("an uncontrolled port is refused, a controlled one is accepted", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "UK";
    const army = placeUnit(G, "UK", "army", "london", 2);
    const fleet = placeUnit(G, "UK", "squadron", "london", 2);
    G.spaces.brittany.control = null;
    G.spaces.brittany.influence = "UK";
    expect(planNavalTransport(G, "UK", army, [fleet], "brittany").reason).toBe("target-not-controlled");
    G.spaces.brittany.control = "UK";
    G.spaces.brittany.influence = null;
    expect(planNavalTransport(G, "UK", army, [fleet], "brittany").ok).toBe(true);
  });
});
