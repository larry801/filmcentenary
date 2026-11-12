/**
 * 12.8 / 22.5 — player-initiated Polish recruitment.
 *
 * The pure decision lives in `engine/poland.ts#polishRecruitDecision`; this
 * suite pins the printed conditions and exercises the live `moves.polishRecruit`
 * path (CP, placement, holding box, counter mix, rejection logging).
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, registerPolishIndependence, removeUnit} from "./engine/effects";
import {landUnitsIn} from "./engine/rules";
import {
  POLISH_ELITE_CORPS_COUNTERS,
  POLISH_RESERVE_ARMY_COUNT,
  POLISH_STANDING_COUNTERS,
  POLISH_TOTAL_ARMY_COUNTERS,
  isPolandIndependent,
  polishArmiesOnMap,
  polishArmyCap,
  polishArmyCounters,
  polishArmyTotal,
  polishController,
  polishRecruitDecision,
  polishReserveIds,
} from "./engine/poland";
import {polishRecruit} from "./moves";

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

const startAction = (G: ImperialElegyState, power: Power, cp = 12): void => {
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = cp;
  G.pending = null;
  G.battle = null;
};

/** Independent Poland allied to `controller`, with the 22.5 holding box. */
const makeIndependent = (G: ImperialElegyState, controller: Power = "GE"): void => {
  G.spaces.poland.control = "Poland";
  G.spaces.poland.ally = controller;
  registerPolishIndependence(G);
};

/** Put `count` full-strength Polish reserve counters in the holding box (22.5(1)). */
const seedPolishReserves = (G: ImperialElegyState, count = POLISH_RESERVE_ARMY_COUNT): void => {
  const box = (G.nonPlayerBuildBox ??= {minors: [], italy: {italianArmy: 0, squadron: 0, dreadnought: 0}});
  const polish = (box.poland ??= {reserveArmies: []});
  for (let i = 0; i < count; i += 1) {
    polish.reserveArmies.push(placeUnit(G, "Poland", "reserveArmy", null, 2).id);
  }
};

const polishUnits = (G: ImperialElegyState, kind?: string) =>
  Object.values(G.units).filter(
    (unit) => unit.owner === "Poland" && (kind === undefined || unit.kind === kind),
  );

const lastLog = (G: ImperialElegyState, key: string) =>
  [...G.log].reverse().find((entry) => entry.key === key);

describe("22.5 data and independence gate", () => {
  test("the chart's Polish row matches the 22.5 counter split", () => {
    expect(POLISH_STANDING_COUNTERS).toBe(3);
    expect(POLISH_RESERVE_ARMY_COUNT).toBe(2);
    expect(POLISH_TOTAL_ARMY_COUNTERS).toBe(5);
    expect(POLISH_ELITE_CORPS_COUNTERS).toBe(1);
  });

  test("only the player allied to independent Poland may build", () => {
    const G = fresh();
    startAction(G, "GE");
    expect(isPolandIndependent(G)).toBe(false);
    expect(polishRecruitDecision(G, "GE", "army", "poland", 2).reasons).toContain("Poland is not independent");

    makeIndependent(G, "GE");
    expect(polishController(G)).toBe("GE");
    expect(polishRecruitDecision(G, "GE", "army", "poland", 2).allowed).toBe(true);

    // AU is not Poland's ally marker holder.
    expect(polishRecruitDecision(G, "AU", "army", "poland", 2).reasons.join(" | ")).toMatch(/allied to Poland/);
    G.spaces.poland.ally = null;
    expect(polishRecruitDecision(G, "GE", "army", "poland", 2).reasons.join(" | ")).toMatch(/allied to Poland/);
  });

  test("recruitment is an action-phase action", () => {
    const G = fresh();
    makeIndependent(G);
    G.phase = "wartime";
    expect(polishRecruitDecision(G, "GE", "army", "poland", 2).reasons.join(" | ")).toMatch(/action-phase/);
  });
});

describe("12.8 building Polish standing armies", () => {
  test("a full-strength army costs 2 CP and lands in a Polish space with a LoC", () => {
    const G = fresh();
    makeIndependent(G);
    startAction(G, "GE", 6);
    const before = polishArmyCounters(G);

    expect(polishRecruit(G, makeCtx([], seat("GE")), "army", "poland", 2)).toBeUndefined();

    expect(G.cpRemaining).toBe(4);
    expect(polishArmyCounters(G)).toBe(before + 1);
    const built = polishUnits(G, "army").find((unit) => unit.space === "poland")!;
    expect(built.steps).toBe(2);
    expect(landUnitsIn(G, "poland").filter((unit) => unit.owner === "Poland" && unit.kind === "army")).toHaveLength(1);
    expect(lastLog(G, "polishRecruited")?.args).toMatchObject({kind: "army", space: "poland", cost: 2, upgrade: false});
  });

  test("a reduced army costs 1 CP and a reduced counter flips for 1 CP", () => {
    const reduced = fresh();
    makeIndependent(reduced);
    startAction(reduced, "GE", 6);
    expect(polishRecruit(reduced, makeCtx([], seat("GE")), "army", "poland", 1)).toBeUndefined();
    expect(reduced.cpRemaining).toBe(5);
    expect(polishUnits(reduced, "army").find((unit) => unit.space === "poland")?.steps).toBe(1);

    const upgrade = fresh();
    makeIndependent(upgrade);
    startAction(upgrade, "GE", 6);
    const unit = placeUnit(upgrade, "Poland", "army", "poland", 1);
    expect(polishRecruit(upgrade, makeCtx([], seat("GE")), "army", "poland", 2)).toBeUndefined();
    expect(upgrade.cpRemaining).toBe(5);
    expect(unit.steps).toBe(2);
    expect(polishUnits(upgrade, "army")).toHaveLength(1);
    expect(lastLog(upgrade, "polishRecruited")?.args).toMatchObject({upgrade: true, cost: 1});
  });

  test("the 22.5 cap is Polish spaces controlled + 1", () => {
    const G = fresh();
    makeIndependent(G);
    startAction(G, "GE", 20);
    expect(polishArmyCap(G)).toBe(2);
    expect(polishRecruit(G, makeCtx([], seat("GE")), "army", "poland", 2)).toBeUndefined();
    expect(polishRecruit(G, makeCtx([], seat("GE")), "army", "poland", 2)).toBeUndefined();
    expect(polishArmiesOnMap(G)).toBe(2);
    const cp = G.cpRemaining;

    expect(polishRecruit(G, makeCtx([], seat("GE")), "army", "poland", 2)).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(cp);
    expect(lastLog(G, "polishRecruitRejected")?.args?.reasons).toMatch(/22\.5 limit/);

    // A second Polish space raises the cap to 3.
    G.spaces.galicia.control = "Poland";
    expect(polishArmyCap(G)).toBe(3);
    expect(polishRecruitDecision(G, "GE", "army", "poland", 2).allowed).toBe(true);
  });

  test("the printed 5 army counters are a hard ceiling", () => {
    const G = fresh();
    makeIndependent(G);
    for (const space of ["galicia", "west-ukraine", "belorussia"]) G.spaces[space].control = "Poland";
    startAction(G, "GE", 20);
    expect(polishArmyCap(G)).toBe(5);
    // Three standing counters + the two reserve counters in the box = all five.
    placeUnit(G, "Poland", "army", "poland", 2);
    placeUnit(G, "Poland", "army", "poland", 2);
    const third = placeUnit(G, "Poland", "army", "poland", 1);
    third.space = "galicia";
    G.spaces.poland.units = G.spaces.poland.units.filter((id) => id !== third.id);
    G.spaces.galicia.units.push(third.id);
    seedPolishReserves(G, 2);
    expect(polishArmyCounters(G)).toBe(POLISH_TOTAL_ARMY_COUNTERS);
    expect(polishArmyTotal(G)).toBe(POLISH_TOTAL_ARMY_COUNTERS);
    expect(polishReserveIds(G)).toHaveLength(POLISH_RESERVE_ARMY_COUNT);

    expect(polishRecruit(G, makeCtx([], seat("GE")), "army", "poland", 2)).toBe(INVALID_MOVE);
    expect(lastLog(G, "polishRecruitRejected")?.args?.reasons).toMatch(/22\.5 limit|counter/);
  });

  test("a build cannot end overstacked and must be in a Polish space", () => {
    const G = fresh();
    makeIndependent(G);
    for (const space of ["galicia", "west-ukraine", "belorussia"]) G.spaces[space].control = "Poland";
    startAction(G, "GE", 20);
    for (let i = 0; i < 3; i += 1) placeUnit(G, "Poland", "army", "poland", 2);
    expect(polishRecruit(G, makeCtx([], seat("GE")), "army", "poland", 2)).toBe(INVALID_MOVE);
    expect(lastLog(G, "polishRecruitRejected")?.args?.reasons).toMatch(/Stacking limit/);

    // Berlin is a home key for GE but not a Polish space.
    expect(polishRecruitDecision(G, "GE", "army", "berlin", 2).reasons.join(" | ")).toMatch(/Polish space/);
    // An unheld Polish space fails the control condition.
    expect(polishRecruitDecision(G, "GE", "army", "galicia", 1).allowed).toBe(false);
  });

  test("a player without enough CP cannot build", () => {
    const G = fresh();
    makeIndependent(G);
    startAction(G, "GE", 1);
    expect(polishRecruit(G, makeCtx([], seat("GE")), "army", "poland", 2)).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(1);
    expect(polishUnits(G, "army")).toHaveLength(0);
  });
});

describe("22.5(1) the Polish reserve armies holding box", () => {
  test("the 4th/5th counters are built into the box and cannot be duplicated", () => {
    const G = fresh();
    makeIndependent(G);
    startAction(G, "GE", 10);
    expect(polishReserveIds(G)).toHaveLength(0);
    expect(polishRecruitDecision(G, "GE", "reserveArmy", null, 2).allowed).toBe(true);

    expect(polishRecruit(G, makeCtx([], seat("GE")), "reserveArmy", null, 2)).toBeUndefined();
    expect(polishRecruit(G, makeCtx([], seat("GE")), "reserveArmy", null, 2)).toBeUndefined();
    expect(polishReserveIds(G)).toHaveLength(POLISH_RESERVE_ARMY_COUNT);
    // 22.5(1): the two reserve counters fill the one-space allowance (2).
    expect(polishArmyTotal(G)).toBe(polishArmyCap(G));

    expect(polishRecruit(G, makeCtx([], seat("GE")), "reserveArmy", null, 2)).toBe(INVALID_MOVE);
    expect(lastLog(G, "polishRecruitRejected")?.args?.reasons).toMatch(/22\.5 limit|reserve army counter/);
    expect(polishReserveIds(G)).toHaveLength(POLISH_RESERVE_ARMY_COUNT);
  });

  test("a reduced reserve in the box flips for 1 CP", () => {
    const G = fresh();
    makeIndependent(G);
    startAction(G, "GE", 5);
    seedPolishReserves(G, 1);
    const reserve = G.units[polishReserveIds(G)[0]];
    reserve.steps = 1;

    expect(polishRecruit(G, makeCtx([], seat("GE")), "reserveArmy", null, 2)).toBeUndefined();
    expect(G.cpRemaining).toBe(4);
    expect(reserve.steps).toBe(2);
    expect(polishReserveIds(G)).toHaveLength(1);
    expect(lastLog(G, "polishRecruited")?.args).toMatchObject({kind: "reserveArmy", upgrade: true, cost: 1});
  });

  test("a destroyed reserve counter can be rebuilt into the box", () => {
    const G = fresh();
    makeIndependent(G);
    startAction(G, "GE", 5);
    seedPolishReserves(G, POLISH_RESERVE_ARMY_COUNT);
    const destroyed = G.units[polishReserveIds(G)[0]];
    removeUnit(G, destroyed.id);
    expect(polishReserveIds(G)).toHaveLength(1);

    expect(polishRecruit(G, makeCtx([], seat("GE")), "reserveArmy", null, 2)).toBeUndefined();
    expect(G.cpRemaining).toBe(3);
    expect(polishReserveIds(G)).toHaveLength(2);
    expect(polishUnits(G, "reserveArmy").filter((unit) => unit.space === null)).toHaveLength(2);
  });
});

describe("12.8 Polish elite corps", () => {
  test("one EC counter, attached to a Polish army in a Polish space", () => {
    const G = fresh();
    makeIndependent(G);
    startAction(G, "GE", 10);
    placeUnit(G, "Poland", "army", "poland", 2);

    expect(polishRecruit(G, makeCtx([], seat("GE")), "eliteCorps", "poland")).toBeUndefined();
    expect(G.cpRemaining).toBe(8);
    expect(polishUnits(G, "eliteCorps")).toHaveLength(1);
    expect(lastLog(G, "polishRecruited")?.args).toMatchObject({kind: "eliteCorps", cost: 2});

    expect(polishRecruit(G, makeCtx([], seat("GE")), "eliteCorps", "poland")).toBe(INVALID_MOVE);
    expect(lastLog(G, "polishRecruitRejected")?.args?.reasons).toMatch(/elite corps counter/);
  });

  test("an EC needs a Polish army in the target space", () => {
    const G = fresh();
    makeIndependent(G);
    startAction(G, "GE", 10);
    expect(polishRecruit(G, makeCtx([], seat("GE")), "eliteCorps", "poland")).toBe(INVALID_MOVE);
    expect(lastLog(G, "polishRecruitRejected")?.args?.reasons).toMatch(/Polish army/);
  });
});
