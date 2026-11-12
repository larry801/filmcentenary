import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {
  PLAYER_COUNTER_CHART,
  counterPool,
  counterRemaining,
  countersOwned,
  hasCounterFor,
  navalCounterLimit,
} from "./engine/counters";
import {buildEf} from "./moves";

/**
 * Rule 4.2 counter pools, transcribed from the publisher's counter chart
 * (`public/imperial-elegy/charts/counter-count.png`).  The chart is legible, so
 * no pool is `null` and no cap below the printed mix is invented.
 */

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    random: {Die: () => 3},
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

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

describe("4.2 player counter chart", () => {
  test("every row matches counter-count.png", () => {
    expect(PLAYER_COUNTER_CHART.GE).toEqual({
      standingArmies: 5, reserveArmies: 11, specialStandingArmies: 0, specialReserveArmies: 0,
      eliteCorps: 4, expeditionary: 4, squadrons: 4, dreadnoughts: 4,
    });
    expect(PLAYER_COUNTER_CHART.UK).toEqual({
      standingArmies: 5, reserveArmies: 0, specialStandingArmies: 5, specialReserveArmies: 0,
      eliteCorps: 2, expeditionary: 5, squadrons: 6, dreadnoughts: 6,
    });
    expect(PLAYER_COUNTER_CHART.FR).toEqual({
      standingArmies: 5, reserveArmies: 9, specialStandingArmies: 0, specialReserveArmies: 0,
      eliteCorps: 3, expeditionary: 4, squadrons: 4, dreadnoughts: 4,
    });
    expect(PLAYER_COUNTER_CHART.AU).toEqual({
      standingArmies: 5, reserveArmies: 9, specialStandingArmies: 0, specialReserveArmies: 0,
      eliteCorps: 2, expeditionary: 1, squadrons: 4, dreadnoughts: 4,
    });
    expect(PLAYER_COUNTER_CHART.RU).toEqual({
      standingArmies: 5, reserveArmies: 11, specialStandingArmies: 0, specialReserveArmies: 0,
      eliteCorps: 2, expeditionary: 3, squadrons: 4, dreadnoughts: 4,
    });
    expect(PLAYER_COUNTER_CHART.OT).toEqual({
      standingArmies: 4, reserveArmies: 1, specialStandingArmies: 2, specialReserveArmies: 2,
      eliteCorps: 2, expeditionary: 1, squadrons: 4, dreadnoughts: 4,
    });
  });

  test("counterPool exposes the chart and never a null player pool", () => {
    const G = fresh();
    for (const power of POWERS) {
      const pool = counterPool(G, power);
      for (const kind of ["army", "reserveArmy", "eliteCorps", "expeditionary", "squadron", "dreadnought"] as const) {
        expect(pool[kind]).not.toBeNull();
      }
    }
    // Special armies are standing armies for the pool: UK 5 + 5, OT 4 + 2.
    expect(counterPool(G, "UK").army).toBe(10);
    expect(counterPool(G, "OT").army).toBe(6);
    // OT's two Arab reserve counters are reserve armies.
    expect(counterPool(G, "OT").reserveArmy).toBe(3);
    // The elite colonial EF is an EF counter, so it is charged to the EF pool.
    expect(counterRemaining(G, "GE", "expeditionary")).toBe(4);
  });

  test("naval pools use the effective rule 4.2 limit, not the physical NAR counters", () => {
    const G = fresh();
    expect(counterPool(G, "GE").squadron).toBe(2);
    expect(counterPool(G, "AU").dreadnought).toBe(2);
    expect(counterPool(G, "OT").squadron).toBe(2);
    expect(counterPool(G, "UK")).toMatchObject({squadron: 6, dreadnought: 6});
    expect(counterPool(G, "FR")).toMatchObject({squadron: 4, dreadnought: 4});
    expect(counterPool(G, "RU")).toMatchObject({squadron: 4, dreadnought: 4});
    expect(navalCounterLimit(G, "UK").squadrons).toBe(6);
  });

  test("an elite colonial EF is charged against the EF pool", () => {
    const G = fresh();
    // FR has 4 EF counters; one is the colonial elite EF.
    placeUnit(G, "FR", "eliteColonialEf", "algeria", 1, {elite: true});
    expect(counterRemaining(G, "FR", "expeditionary")).toBe(3);
  });

  test("the EC pool is enforced as a physical counter limit", () => {
    const G = fresh();
    // GE starts with the Berlin EC (4 printed EC counters).
    expect(counterRemaining(G, "GE", "eliteCorps")).toBe(3);
    for (let i = 0; i < 3; i += 1) placeUnit(G, "GE", "eliteCorps", "berlin", 1);
    expect(counterRemaining(G, "GE", "eliteCorps")).toBe(0);
    expect(hasCounterFor(G, "GE", "eliteCorps")).toBe(false);
    expect(countersOwned(G, "GE", "eliteCorps")).toBe(4);
  });
});

describe("4.2 live EF build limit", () => {
  test("FR builds exactly its four printed EF counters", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "FR";
    G.pending = null;
    G.battle = null;
    G.cpRemaining = 20;
    const ctx = makeCtx(seat("FR"));
    for (let i = 0; i < 4; i += 1) {
      expect(buildEf(G, ctx, "paris")).toBeUndefined();
    }
    expect(G.cpRemaining).toBe(12);
    expect(buildEf(G, ctx, "paris")).toBe(INVALID_MOVE);
    expect(countersOwned(G, "FR", "expeditionary")).toBe(4);
  });
});
