/**
 * 22.5(1) — the Polish map + holding-box cap.
 *
 * Interpretation pinned here: "Poland can build armies equal to the number of
 * Polish spaces they control +1 (the Polish 4th and 5th armies are reserve
 * armies and must be placed in the Polish reserve armies holding box during
 * peacetime)" caps **all** Polish army counters — on the map and in the Polish
 * reserve armies holding box — at Polish spaces + 1, with 4.2's five-counter
 * mix as the hard ceiling.  The scenario data corroborates it (Independent
 * Poland: three Polish spaces, three armies on the map and the fourth counter
 * as a reserve army in the box = spaces + 1).
 *
 * Consequences pinned by these tests:
 *   - independence does not hand Poland two free reserve counters;
 *   - the 20.3 build step puts the 4th/5th counter in the box once the three
 *     standing counters are on the map;
 *   - 22.5(2) moves a reserve counter from the box to the map, which does not
 *     change the total, so it is not blocked by the cap;
 *   - no build may take the map+box total past the cap or the five-counter mix.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, registerPolishIndependence} from "./engine/effects";
import {nonPlayerBuildPlan} from "./engine/endPhase";
import {createWarState} from "./engine/limitedWar";
import {
  POLISH_TOTAL_ARMY_COUNTERS,
  isPolandIndependent,
  polishArmyCap,
  polishArmyCounters,
  polishArmyTotal,
  polishArmiesOnMap,
  polishRecruitDecision,
  polishReserveIds,
} from "./engine/poland";
import {deployReserves, polishRecruit, resolveEnd} from "./moves";

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

const makeIndependent = (G: ImperialElegyState, controller = "GE"): void => {
  G.spaces.poland.control = "Poland";
  G.spaces.poland.ally = controller;
  registerPolishIndependence(G);
};

const boxFor = (minors: string[]): ImperialElegyState["nonPlayerBuildBox"] => ({
  minors: [...minors],
  italy: {italianArmy: 0, squadron: 0, dreadnought: 0},
});

/** Put `count` full-strength Polish reserve counters in the holding box. */
const seedReserves = (G: ImperialElegyState, count = 1): void => {
  const box = (G.nonPlayerBuildBox ??= boxFor([]));
  const polish = (box.poland ??= {reserveArmies: []});
  for (let i = 0; i < count; i += 1) {
    polish.reserveArmies.push(placeUnit(G, "Poland", "reserveArmy", null, 2).id);
  }
};

const polishArmies = (G: ImperialElegyState) =>
  Object.values(G.units).filter((unit) => unit.owner === "Poland" && unit.kind === "army");

const prepareWartime = (G: ImperialElegyState, power: Power): void => {
  G.phase = "wartime";
  G.activePower = power;
  G.war = createWarState(G, power, "FR", "conquest", ["paris"], 2);
  G.war.status = "maneuver";
  G.war.budgets[power] = 9;
};

// ---------------------------------------------------------------------------
// the cap is total counters, not on-map counters
// ---------------------------------------------------------------------------

describe("22.5(1) the cap counts the map and the holding box", () => {
  test("spaces controlled + 1, capped by the five printed army counters", () => {
    const G = fresh();
    expect(polishArmyCap(G)).toBe(0);
    makeIndependent(G);
    expect(polishArmyCap(G)).toBe(2);
    for (const space of ["galicia", "west-ukraine", "belorussia"]) G.spaces[space].control = "Poland";
    expect(polishArmyCap(G)).toBe(5);
    expect(POLISH_TOTAL_ARMY_COUNTERS).toBe(5);
  });

  test("a reserve counter in the box consumes the same allowance as a map army", () => {
    const G = fresh();
    makeIndependent(G);
    placeUnit(G, "Poland", "army", "poland", 2);
    seedReserves(G, 1);
    expect(polishArmiesOnMap(G)).toBe(1);
    expect(polishArmyTotal(G)).toBe(2);
    expect(polishArmyTotal(G)).toBe(polishArmyCap(G));

    // A new standing army would take the total to 3 > spaces+1.
    G.phase = "action";
    const decision = polishRecruitDecision(G, "GE", "army", "poland", 2);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons.join(" | ")).toMatch(/22\.5 limit/);
  });

  test("three armies on the map plus one reserve in the box equal the scenario-2 total", () => {
    const G = fresh();
    makeIndependent(G);
    G.spaces.galicia.control = "Poland";
    G.spaces["west-ukraine"].control = "Poland";
    expect(polishArmyCap(G)).toBe(4);
    for (const space of ["poland", "galicia", "west-ukraine"]) placeUnit(G, "Poland", "army", space, 2);
    seedReserves(G, 1);
    expect(polishArmyTotal(G)).toBe(4);
    expect(polishArmyTotal(G)).toBe(polishArmyCap(G));
    // The printed Independent Poland scenario is exactly this 3 map + 1 box mix.
    expect(polishArmyCounters(G)).toBe(4);
    expect(polishRecruitDecision(G, "GE", "reserveArmy", null, 1).allowed).toBe(false);
  });

  test("the 20.3 step places the 4th counter in the box, not as a fourth standing army", () => {
    const G = fresh();
    makeIndependent(G);
    G.spaces.galicia.control = "Poland";
    G.spaces["west-ukraine"].control = "Poland";
    G.nonPlayerBuildBox = boxFor(["Poland"]);
    for (let i = 0; i < 3; i += 1) placeUnit(G, "Poland", "army", "poland", 2);
    expect(nonPlayerBuildPlan(G)).toEqual([
      {minor: "Poland", home: "poland", action: "placeReserve", unitId: null, space: null},
    ]);
    resolveEnd(G, makeCtx());
    expect(polishArmies(G)).toHaveLength(3);
    expect(polishReserveIds(G)).toHaveLength(1);
    expect(polishArmyTotal(G)).toBe(4);
    expect(polishArmyTotal(G)).toBe(polishArmyCap(G));
  });

  test("independence creates the box empty so the allowance is not pre-spent", () => {
    const G = fresh();
    expect(isPolandIndependent(G)).toBe(false);
    makeIndependent(G);
    expect(G.nonPlayerBuildBox?.poland?.reserveArmies).toEqual([]);
    expect(polishArmyTotal(G)).toBe(0);
    expect(polishArmyCap(G)).toBe(2);
    // The two-step 22.5(3) build fits entirely inside the one-space allowance.
    G.nonPlayerBuildBox = boxFor(["Poland"]);
    resolveEnd(G, makeCtx());
    expect(polishArmies(G)).toHaveLength(2);
    expect(polishArmyTotal(G)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 22.5(2) deployment is a box -> map move, not a new army
// ---------------------------------------------------------------------------

describe("22.5(2) deploying a reserve does not violate the cap", () => {
  test("a reserve can deploy even when map + box already equals the cap", () => {
    const G = fresh();
    makeIndependent(G);
    G.spaces.galicia.control = "Poland";
    G.spaces["west-ukraine"].control = "Poland";
    for (const space of ["poland", "galicia", "west-ukraine"]) placeUnit(G, "Poland", "army", space, 2);
    seedReserves(G, 1);
    expect(polishArmyTotal(G)).toBe(4);
    expect(polishArmyTotal(G)).toBe(polishArmyCap(G));

    prepareWartime(G, "GE");
    G.powers.GE.industry = 1;
    G.powers.GE.reserves = [];
    const reserve = placeUnit(G, "GE", "reserveArmy", null, 2);
    G.powers.GE.reserves.push(reserve.id);

    expect(deployReserves(G, makeCtx([], seat("GE")), "berlin")).toBeUndefined();
    // The counter moved out of the box; the total did not change.
    expect(polishReserveIds(G)).toHaveLength(0);
    expect(polishArmiesOnMap(G)).toBe(4);
    expect(polishArmyTotal(G)).toBe(4);
    expect(G.spaces.berlin.units.some((id) => G.units[id].owner === "Poland")).toBe(true);
  });

  test("a build that would add a fifth counter is still refused", () => {
    const G = fresh();
    makeIndependent(G);
    G.spaces.galicia.control = "Poland";
    G.spaces["west-ukraine"].control = "Poland";
    G.phase = "action";
    G.activePower = "GE";
    G.cpRemaining = 10;
    for (const space of ["poland", "galicia", "west-ukraine"]) placeUnit(G, "Poland", "army", space, 2);
    seedReserves(G, 1);

    expect(polishRecruit(G, makeCtx([], seat("GE")), "army", "poland", 2)).toBe(INVALID_MOVE);
    expect(polishRecruit(G, makeCtx([], seat("GE")), "reserveArmy", null, 2)).toBe(INVALID_MOVE);
    expect(polishArmyTotal(G)).toBe(4);
  });
});
