import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, registerPolishIndependence} from "./engine/effects";
import {nonPlayerBuildPlan} from "./engine/endPhase";
import {
  POLISH_RESERVE_ARMY_COUNT,
  isPolandIndependent,
  polishArmyCap,
  polishArmyTotal,
  polishController,
  polishMapArmyCap,
  polishReserveIds,
} from "./engine/poland";
import {createWarState, demobilizeWar} from "./engine/limitedWar";
import {deployReserves, resolveEnd} from "./moves";

/**
 * Rule 22.5 — Poland.
 *
 * The five printed Polish army counters are three standing armies plus the 4th
 * and 5th reserve armies held in the Polish reserve armies holding box (3.8).
 * An independent Poland builds two army steps in the end phase (20.3), may
 * build Polish spaces controlled + 1 armies, and its controlling player may
 * deploy one Polish reserve army with a wartime deploy-reserves action.
 */

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
    phase: "end",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const makeIndependent = (G: ImperialElegyState): void => {
  G.spaces.poland.control = "Poland";
};

const buildBox = (minors: string[] = ["Poland"]) => ({
  minors: [...minors],
  italy: {italianArmy: 0, squadron: 0, dreadnought: 0},
});

const polishUnits = (G: ImperialElegyState) =>
  Object.values(G.units).filter((unit) => unit.owner === "Poland");

const prepareWartime = (G: ImperialElegyState, power: Power): void => {
  G.phase = "wartime";
  G.activePower = power;
  G.war = createWarState(G, power, "FR", "conquest", ["paris"], 2);
  G.war.status = "maneuver";
  G.war.budgets[power] = 9;
};

// ---------------------------------------------------------------------------
// 22.5(1) build limit and the Polish holding box
// ---------------------------------------------------------------------------

describe("22.5(1) Polish build limit", () => {
  test("Poland is independent only while it controls a Polish space", () => {
    const G = fresh();
    expect(isPolandIndependent(G)).toBe(false);
    makeIndependent(G);
    expect(isPolandIndependent(G)).toBe(true);
    expect(polishController(G)).toBeNull();
    G.spaces.poland.ally = "GE";
    expect(polishController(G)).toBe("GE");
  });

  test("armies = Polish spaces controlled + 1, capped by the five army counters", () => {
    const G = fresh();
    expect(polishArmyCap(G)).toBe(0);
    makeIndependent(G);
    expect(polishArmyCap(G)).toBe(2);
    G.spaces.galicia.control = "Poland";
    expect(polishArmyCap(G)).toBe(3);
    G.spaces["west-ukraine"].control = "Poland";
    expect(polishArmyCap(G)).toBe(4);
    G.spaces.belorussia.control = "Poland";
    // Four Polish spaces exist on the map, so the +1 allowance hits the
    // five-counter ceiling exactly.
    expect(polishArmyCap(G)).toBe(5);
  });

  test("the 4th and 5th counters never enter through the build step", () => {
    const G = fresh();
    makeIndependent(G);
    G.spaces.galicia.control = "Poland";
    G.spaces["west-ukraine"].control = "Poland";
    // The spaces + 1 allowance is 4, but only three standing army counters
    // exist; the 4th/5th are reserve counters deployed by 22.5(2).
    expect(polishArmyCap(G)).toBe(4);
    expect(polishMapArmyCap(G)).toBe(3);
    prepareWartime(G, "GE");
    expect(polishMapArmyCap(G)).toBe(3);
  });

  test("independence creates the box and the 20.3 roster, without free reserve counters", () => {
    const G = fresh();
    expect(registerPolishIndependence(G)).toBe(false);
    makeIndependent(G);
    expect(registerPolishIndependence(G)).toBe(true);
    const box = G.nonPlayerBuildBox!;
    expect(box.minors).toContain("Poland");
    // 22.5(1) counts map + box against "Polish spaces + 1": the 4th/5th
    // counters are built by the 20.3/12.8 paths, not handed out at independence.
    expect(box.poland?.reserveArmies).toHaveLength(0);
    expect(polishReserveIds(G)).toHaveLength(0);
    expect(polishArmyTotal(G)).toBe(0);
    // Idempotent: no extra counters or duplicate roster entry.
    expect(registerPolishIndependence(G)).toBe(false);
    expect(box.poland?.reserveArmies).toHaveLength(0);
    expect(box.minors.filter((minor) => minor === "Poland")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 22.5(3) the two-step end-phase build
// ---------------------------------------------------------------------------

describe("22.5(3) independent Poland builds two army steps", () => {
  test("the build plan gives Poland two steps and is gated on independence", () => {
    const G = fresh();
    G.nonPlayerBuildBox = buildBox();
    expect(nonPlayerBuildPlan(G)).toEqual([]);
    makeIndependent(G);
    const plan = nonPlayerBuildPlan(G);
    expect(plan).toHaveLength(2);
    expect(plan.every((entry) => entry.minor === "Poland" && entry.action === "placeReduced" && entry.space === "poland")).toBe(true);
  });

  test("resolveEnd places the two reduced Polish armies in Poland (live 20.3)", () => {
    const G = fresh();
    makeIndependent(G);
    G.nonPlayerBuildBox = buildBox();
    resolveEnd(G, makeCtx());
    const polish = polishUnits(G);
    expect(polish).toHaveLength(2);
    expect(polish.every((unit) => unit.space === "poland" && unit.steps === 1)).toBe(true);
  });

  test("the peacetime map ceiling stops the fourth standing army and builds a reserve instead", () => {
    const G = fresh();
    makeIndependent(G);
    G.spaces.galicia.control = "Poland";
    G.spaces["west-ukraine"].control = "Poland";
    G.nonPlayerBuildBox = buildBox();
    for (let i = 0; i < 3; i += 1) placeUnit(G, "Poland", "army", "poland", 2);
    // Three spaces -> cap 4.  Three standing counters are on the map, so the
    // only way to use the fourth step is the 4th/5th reserve counter in the box.
    expect(polishArmyCap(G)).toBe(4);
    expect(polishMapArmyCap(G)).toBe(3);
    expect(nonPlayerBuildPlan(G)).toEqual([
      {minor: "Poland", home: "poland", action: "placeReserve", unitId: null, space: null},
    ]);
  });

  test("wartime still does not build a fourth standing army", () => {
    const G = fresh();
    makeIndependent(G);
    G.spaces.galicia.control = "Poland";
    G.spaces["west-ukraine"].control = "Poland";
    G.nonPlayerBuildBox = buildBox();
    for (let i = 0; i < 3; i += 1) placeUnit(G, "Poland", "army", "poland", 2);
    prepareWartime(G, "GE");
    // The 4th and 5th armies are reserve counters; the build step puts them in
    // the holding box, and only 22.5(2) moves them to the map.
    const plan = nonPlayerBuildPlan(G);
    expect(plan).toEqual([
      {minor: "Poland", home: "poland", action: "placeReserve", unitId: null, space: null},
    ]);
    resolveEnd(G, makeCtx());
    expect(polishUnits(G).filter((unit) => unit.space === "poland")).toHaveLength(3);
    expect(polishReserveIds(G)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 22.5(2) deploying a Polish reserve army with deploy reserves
// ---------------------------------------------------------------------------

describe("22.5(2) deploy one Polish reserve army", () => {
  const seedPolishReserves = (G: ImperialElegyState): void => {
    const box = (G.nonPlayerBuildBox ??= buildBox());
    const polish = (box.poland ??= {reserveArmies: []});
    for (let i = 0; i < POLISH_RESERVE_ARMY_COUNT; i += 1) {
      polish.reserveArmies.push(placeUnit(G, "Poland", "reserveArmy", null, 2).id);
    }
  };

  const preparePolishController = (G: ImperialElegyState): void => {
    makeIndependent(G);
    G.spaces.poland.ally = "GE";
    registerPolishIndependence(G);
    // 22.5(1): the 4th/5th counters live in the box once built (here by 12.8).
    seedPolishReserves(G);
    G.powers.GE.industry = 1;
    G.powers.GE.reserves = [];
    const reserve = placeUnit(G, "GE", "reserveArmy", null, 2);
    G.powers.GE.reserves.push(reserve.id);
  };

  test("the controller's deploy-reserves action also deploys one Polish reserve", () => {
    const G = fresh();
    prepareWartime(G, "GE");
    preparePolishController(G);
    const ctx = makeCtx([], seat("GE"));
    expect(deployReserves(G, ctx, "berlin")).toBeUndefined();

    const polishOnMap = polishUnits(G).filter((unit) => unit.space === "berlin");
    expect(polishOnMap).toHaveLength(1);
    expect(polishOnMap[0].kind).toBe("reserveArmy");
    expect(polishOnMap[0].flags?.deployedThisImpulse).toBe(true);
    expect(polishReserveIds(G)).toHaveLength(1);
    expect(G.log.some((entry) => entry.key === "deployedPolishReserve" && entry.args?.space === "berlin")).toBe(true);
  });

  test("the extra deployment can be declined and never happens without control", () => {
    const G = fresh();
    prepareWartime(G, "GE");
    preparePolishController(G);
    const ctx = makeCtx([], seat("GE"));
    expect(deployReserves(G, ctx, "berlin", 1, {polishReserve: false})).toBeUndefined();
    expect(polishUnits(G).filter((unit) => unit.space !== null)).toHaveLength(0);
    expect(polishReserveIds(G)).toHaveLength(2);

    // Another player's deploy-reserves action does not touch Poland's box.
    G.spaces.poland.ally = "AU";
    G.powers.GE.reserves = [];
    const second = placeUnit(G, "GE", "reserveArmy", null, 2);
    G.powers.GE.reserves.push(second.id);
    expect(deployReserves(G, ctx, "berlin")).toBeUndefined();
    expect(polishUnits(G).filter((unit) => unit.space !== null)).toHaveLength(0);
    expect(polishReserveIds(G)).toHaveLength(2);
  });

  test("a non-independent Poland has no reserve box to deploy from", () => {
    const G = fresh();
    prepareWartime(G, "GE");
    G.powers.GE.industry = 1;
    G.powers.GE.reserves = [];
    const reserve = placeUnit(G, "GE", "reserveArmy", null, 2);
    G.powers.GE.reserves.push(reserve.id);
    expect(deployReserves(G, makeCtx([], seat("GE")), "berlin")).toBeUndefined();
    expect(polishUnits(G)).toHaveLength(0);
  });

  test("demobilisation returns a deployed Polish reserve to the holding box", () => {
    const G = fresh();
    prepareWartime(G, "GE");
    preparePolishController(G);
    expect(deployReserves(G, makeCtx([], seat("GE")), "berlin")).toBeUndefined();
    expect(polishReserveIds(G)).toHaveLength(1);

    const result = demobilizeWar(G, G.war, makeCtx());
    expect(result.ok).toBe(true);
    expect(polishReserveIds(G)).toHaveLength(2);
    expect(polishUnits(G).every((unit) => unit.space === null)).toBe(true);
    expect(result.reservesReturned.find((entry) => entry.power === "Poland")?.unitIds).toHaveLength(1);
    expect(G.log.some((entry) => entry.key === "polishReserveReturned" && entry.args?.count === 1)).toBe(true);
  });
});
