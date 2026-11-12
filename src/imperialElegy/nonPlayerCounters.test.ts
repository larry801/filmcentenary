/**
 * 4.2 — non-player counter pools.
 *
 * The publisher's `counter-count.png` non-player rows are legible, so they are
 * transcribed verbatim in `engine/counters.ts`.  This suite pins the table and
 * proves the live Polish build path enforces the printed Polish row (5 armies,
 * 1 EC).  Rows the chart does not print stay `null` (no invented cap).
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, registerPolishIndependence} from "./engine/effects";
import {
  NON_PLAYER_COUNTER_CHART,
  counterPool,
  counterPoolFor,
  nonPlayerCounterPool,
  nonPlayerCounterRemaining,
  nonPlayerHasCounterFor,
  type NonPlayerCounterChart,
} from "./engine/counters";
import {
  POLISH_ELITE_CORPS_COUNTERS,
  POLISH_RESERVE_ARMY_COUNT,
  POLISH_TOTAL_ARMY_COUNTERS,
} from "./engine/poland";

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

const row = (
  armies: number,
  eliteCorps: number,
  expeditionary: number,
  squadrons: number,
  dreadnoughts: number,
  controlMarkers: number,
): NonPlayerCounterChart => ({armies, eliteCorps, expeditionary, squadrons, dreadnoughts, controlMarkers});

describe("4.2 non-player counter chart", () => {
  test("every legible non-player row matches counter-count.png", () => {
    expect(NON_PLAYER_COUNTER_CHART.IT).toEqual(row(5, 0, 1, 3, 1, 5));
    expect(NON_PLAYER_COUNTER_CHART.US).toEqual(row(3, 0, 0, 2, 2, 2));
    expect(NON_PLAYER_COUNTER_CHART.Japan).toEqual(row(2, 0, 0, 2, 1, 2));
    expect(NON_PLAYER_COUNTER_CHART.Bulgaria).toEqual(row(2, 0, 0, 0, 0, 1));
    expect(NON_PLAYER_COUNTER_CHART.Serbia).toEqual(row(2, 0, 0, 0, 0, 1));
    expect(NON_PLAYER_COUNTER_CHART.Greece).toEqual(row(2, 0, 0, 2, 0, 1));
    expect(NON_PLAYER_COUNTER_CHART.Belgium).toEqual(row(1, 0, 0, 0, 0, 1));
    expect(NON_PLAYER_COUNTER_CHART.Bosnia).toEqual(row(1, 0, 0, 0, 0, 0));
    expect(NON_PLAYER_COUNTER_CHART.Poland).toEqual(row(5, 1, 0, 0, 0, 0));
    expect(NON_PLAYER_COUNTER_CHART.Bavaria).toEqual(row(1, 0, 0, 0, 0, 0));
    expect(NON_PLAYER_COUNTER_CHART.Hanover).toEqual(row(1, 0, 0, 0, 0, 0));
    expect(NON_PLAYER_COUNTER_CHART.Saxony).toEqual(row(1, 0, 0, 0, 0, 0));
    expect(NON_PLAYER_COUNTER_CHART.Romania).toEqual(row(2, 0, 0, 0, 0, 0));
    // Sar-Pied carries the two shared Italian-state control markers; the chart
    // note says they are the Two Sicilies markers on their flip side.
    expect(NON_PLAYER_COUNTER_CHART["Sardinia-Piedmont"]).toEqual(row(2, 0, 0, 1, 0, 2));
    expect(NON_PLAYER_COUNTER_CHART["Two Sicilies"]).toEqual(row(2, 0, 0, 1, 0, 0));
    expect(NON_PLAYER_COUNTER_CHART.Netherlands).toEqual(row(1, 0, 0, 1, 0, 0));
    expect(NON_PLAYER_COUNTER_CHART.Denmark).toEqual(row(1, 0, 0, 1, 0, 0));
    expect(NON_PLAYER_COUNTER_CHART.Persia).toEqual(row(1, 0, 0, 0, 0, 0));
    expect(NON_PLAYER_COUNTER_CHART["Qing China"]).toEqual(row(1, 0, 0, 0, 0, 0));
    expect(NON_PLAYER_COUNTER_CHART.Ethiopia).toEqual(row(1, 0, 0, 0, 0, 0));
    expect(NON_PLAYER_COUNTER_CHART["REBEL:Zulu"]).toEqual(row(1, 0, 0, 0, 0, 0));
    expect(NON_PLAYER_COUNTER_CHART["REBEL:Mahdi"]).toEqual(row(1, 0, 0, 0, 0, 0));
    expect(NON_PLAYER_COUNTER_CHART.Generic).toEqual(row(4, 2, 0, 0, 0, 0));
    expect(NON_PLAYER_COUNTER_CHART["REBEL:Boxer"]).toEqual(row(3, 0, 0, 0, 0, 0));
    // The chart's Polish row is the single source for the 22.5 army mix:
    // 3 standing + 2 reserve = 5 army counters, plus the one EC counter.
    expect(NON_PLAYER_COUNTER_CHART.Poland.armies).toBe(POLISH_TOTAL_ARMY_COUNTERS);
    expect(NON_PLAYER_COUNTER_CHART.Poland.eliteCorps).toBe(POLISH_ELITE_CORPS_COUNTERS);
  });

  test("a row with no printed counter mix stays null (no invented cap)", () => {
    for (const owner of ["Tuscany", "Papal States", "Egypt", "Morocco", "Korea", "Mexico"]) {
      expect(nonPlayerCounterPool(owner)).toBeNull();
      expect(nonPlayerCounterRemaining(fresh(), owner, "army")).toBeNull();
      // A null pool means "no printed numeric cap", never a fabricated zero.
      expect(nonPlayerHasCounterFor(fresh(), owner, "army")).toBe(true);
    }
  });

  test("counterPoolFor returns the player row for seats and the chart row otherwise", () => {
    const G = fresh();
    expect(counterPoolFor(G, "UK")).toEqual(counterPool(G, "UK"));
    expect(counterPoolFor(G, "Poland")).toEqual(NON_PLAYER_COUNTER_CHART.Poland);
    expect(counterPoolFor(G, "Tuscany")).toBeNull();
    // Player rows are untouched by this transcription.
    expect(counterPool(G, "UK").army).toBe(10);
  });
});

describe("4.2 non-player counter enforcement", () => {
  test("Poland's printed 5 army counters are counted across map and holding box", () => {
    const G = fresh();
    expect(nonPlayerCounterRemaining(G, "Poland", "army")).toBe(5);
    G.spaces.poland.control = "Poland";
    G.spaces.poland.ally = "GE";
    registerPolishIndependence(G);
    // 22.5(1) counts the map and the holding box, but independence does not
    // create the 4th/5th counters for free: they are built by 20.3/12.8.
    expect(nonPlayerCounterRemaining(G, "Poland", "army")).toBe(5);
    for (let i = 0; i < 3; i += 1) placeUnit(G, "Poland", "army", "poland", 2);
    // The three standing counters are in play; the two reserve counters remain
    // available and are built into the Polish holding box.
    expect(nonPlayerCounterRemaining(G, "Poland", "army")).toBe(POLISH_RESERVE_ARMY_COUNT);
    const box = (G.nonPlayerBuildBox ??= {minors: [], italy: {italianArmy: 0, squadron: 0, dreadnought: 0}});
    const polish = (box.poland ??= {reserveArmies: []});
    for (let i = 0; i < POLISH_RESERVE_ARMY_COUNT; i += 1) {
      polish.reserveArmies.push(placeUnit(G, "Poland", "reserveArmy", null, 2).id);
    }
    expect(nonPlayerCounterRemaining(G, "Poland", "army")).toBe(0);
    expect(nonPlayerHasCounterFor(G, "Poland", "army")).toBe(false);
  });

  test("Poland has one printed elite corps counter", () => {
    const G = fresh();
    expect(nonPlayerCounterRemaining(G, "Poland", "eliteCorps")).toBe(1);
    placeUnit(G, "Poland", "eliteCorps", "poland", 1);
    expect(nonPlayerCounterRemaining(G, "Poland", "eliteCorps")).toBe(0);
    expect(nonPlayerHasCounterFor(G, "Poland", "eliteCorps")).toBe(false);
  });

  test("Italy, the US and Japan use their chart rows", () => {
    const G = fresh();
    expect(nonPlayerCounterRemaining(G, "IT", "army")).toBe(5);
    expect(nonPlayerCounterRemaining(G, "IT", "expeditionary")).toBe(1);
    expect(nonPlayerCounterRemaining(G, "IT", "squadron")).toBe(3);
    expect(nonPlayerCounterRemaining(G, "IT", "dreadnought")).toBe(1);
    for (let i = 0; i < 5; i += 1) placeUnit(G, "IT", "italianArmy", "rome", 2);
    expect(nonPlayerCounterRemaining(G, "IT", "army")).toBe(0);

    for (let i = 0; i < 3; i += 1) placeUnit(G, "US", "usArmy", "the-south", 2);
    for (let i = 0; i < 2; i += 1) placeUnit(G, "US", "squadron", "north-atlantic", 2);
    expect(nonPlayerCounterRemaining(G, "US", "army")).toBe(0);
    expect(nonPlayerCounterRemaining(G, "US", "squadron")).toBe(0);
    expect(nonPlayerCounterRemaining(G, "US", "dreadnought")).toBe(2);

    for (let i = 0; i < 2; i += 1) placeUnit(G, "Japan", "minorArmy", "japan", 2);
    expect(nonPlayerCounterRemaining(G, "Japan", "army")).toBe(0);
    expect(nonPlayerCounterRemaining(G, "Japan", "squadron")).toBe(2);
  });

  test("the chart uses the in-game owner strings for rebels and generic counters", () => {
    const G = fresh();
    expect(nonPlayerCounterRemaining(G, "REBEL:Boxer", "army")).toBe(3);
    placeUnit(G, "REBEL:Boxer", "rebelArmy", "shanghai", 2);
    expect(nonPlayerCounterRemaining(G, "REBEL:Boxer", "army")).toBe(2);
    expect(nonPlayerCounterRemaining(G, "REBEL:Zulu", "army")).toBe(1);
    expect(nonPlayerCounterRemaining(G, "REBEL:Mahdi", "army")).toBe(1);
    expect(nonPlayerCounterRemaining(G, "Generic", "eliteCorps")).toBe(2);
  });

  test("an eliminated non-player counter returns to its pool", () => {
    const G = fresh();
    const unit = placeUnit(G, "Poland", "eliteCorps", "poland", 1);
    expect(nonPlayerCounterRemaining(G, "Poland", "eliteCorps")).toBe(0);
    delete G.units[unit.id];
    expect(nonPlayerCounterRemaining(G, "Poland", "eliteCorps")).toBe(1);
  });
});
