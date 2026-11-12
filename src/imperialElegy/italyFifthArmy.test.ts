/**
 * 22.3.1 Kingdom of Italy Table, result 5–6:
 * "Italy permanently gains an additional reserve army and an additional naval
 * unit."
 *
 * The printed Italian non-player counter row has five armies (three standing
 * from 22.2 plus two reserve counters) and three squadrons (one from 22.2 plus
 * two from repeated 5–6 results), so the grants are capped there.  A reserve
 * army is a `space: null` counter in Italy's reserve armies holding box (3.8 /
 * 5.1.2), never a fourth or fifth standing army on the map.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Unit} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeNonPlayerCounter} from "./engine/effects";
import {italyTable, unifyItaly} from "./engine/greatWar";
import {
  ITALIAN_ARMY_COUNTER_MAX,
  ITALIAN_STANDING_ARMIES,
  redeployItaly,
} from "./engine/greatWarFlow";
import {italianArmyTarget} from "./engine/rules";
import {initialNonPlayerBuildBox, italianRebuildPlan} from "./engine/endPhase";

const makeCtx = (dieValue = 3): Ctx =>
  ({
    playerID: "0",
    random: {Die: (_sides: number) => dieValue},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const italianArmies = (G: ImperialElegyState): Unit[] =>
  Object.values(G.units).filter((unit) => unit.owner === "IT" && unit.kind === "italianArmy");

const standingArmies = (G: ImperialElegyState): Unit[] =>
  italianArmies(G).filter((unit) => unit.space !== null && unit.space !== undefined);

const reserveArmies = (G: ImperialElegyState): Unit[] =>
  italianArmies(G).filter((unit) => unit.space === null || unit.space === undefined);

const italianSquadrons = (G: ImperialElegyState): Unit[] =>
  Object.values(G.units).filter((unit) => unit.owner === "IT" && unit.kind === "squadron");

const unifiedItaly = (dieValue = 3): ImperialElegyState => {
  const G = fresh();
  G.turn = 1;
  unifyItaly(G, makeCtx(dieValue), "GE");
  return G;
};

describe("22.3.1 the 5–6 result grants the extra reserve army and naval unit", () => {
  test("the fourth and fifth army counters are reached, then the row is full", () => {
    const G = unifiedItaly();
    expect(italianArmies(G)).toHaveLength(ITALIAN_STANDING_ARMIES);
    expect(italianSquadrons(G)).toHaveLength(1);

    italyTable(G, makeCtx(5), "GE");
    expect(italianArmies(G)).toHaveLength(4);
    expect(standingArmies(G)).toHaveLength(ITALIAN_STANDING_ARMIES);
    expect(reserveArmies(G)).toHaveLength(1);
    expect(italianSquadrons(G)).toHaveLength(2);

    italyTable(G, makeCtx(5), "GE");
    expect(italianArmies(G)).toHaveLength(ITALIAN_ARMY_COUNTER_MAX);
    expect(standingArmies(G)).toHaveLength(ITALIAN_STANDING_ARMIES);
    expect(reserveArmies(G)).toHaveLength(2);
    expect(italianSquadrons(G)).toHaveLength(3);

    // A third 5–6 result cannot over-place the printed row.
    italyTable(G, makeCtx(5), "GE");
    expect(italianArmies(G)).toHaveLength(ITALIAN_ARMY_COUNTER_MAX);
    expect(italianSquadrons(G)).toHaveLength(3);
    expect(G.italyReinforcements).toEqual({armies: 2, squadrons: 2});
  });

  test("the target tracks the printed mix and each grant", () => {
    const G = fresh();
    expect(italianArmyTarget(G)).toBe(ITALIAN_STANDING_ARMIES);
    G.italyReinforcements = {armies: 1, squadrons: 0};
    expect(italianArmyTarget(G)).toBe(4);
    G.italyReinforcements = {armies: 2, squadrons: 0};
    expect(italianArmyTarget(G)).toBe(ITALIAN_ARMY_COUNTER_MAX);
  });

  test("redeployment never fields more than the five-counter row", () => {
    const G = unifiedItaly();
    // Two 5–6 results: 3 standing + 2 reserve counters.
    italyTable(G, makeCtx(5), "GE");
    italyTable(G, makeCtx(5), "GE");
    expect(italianArmies(G)).toHaveLength(ITALIAN_ARMY_COUNTER_MAX);
    const result = redeployItaly(G);
    expect(result.placed).toEqual([]);
    expect(italianArmies(G)).toHaveLength(ITALIAN_ARMY_COUNTER_MAX);
    expect(standingArmies(G)).toHaveLength(ITALIAN_STANDING_ARMIES);
  });
});

describe("22.4/20.3 a destroyed reserve army returns to the reserve box", () => {
  test("the 20.3 rebuild places a granted reserve counter off-map", () => {
    const G = unifiedItaly();
    G.italyReinforcements = {armies: 1, squadrons: 0};
    G.nonPlayerBuildBox = initialNonPlayerBuildBox();
    G.nonPlayerBuildBox.italy.italianArmy = 1;

    const plan = italianRebuildPlan(G)!;
    expect(plan.rebuild).toEqual([{kind: "italianArmy", space: null}]);
    expect(plan.heldBack.italianArmy).toBe(0);
  });

  test("without a 22.3.1 grant a destroyed fourth counter still stays in the box", () => {
    const G = unifiedItaly();
    G.nonPlayerBuildBox = initialNonPlayerBuildBox();
    G.nonPlayerBuildBox.italy.italianArmy = 1;

    const plan = italianRebuildPlan(G)!;
    expect(plan.rebuild.filter((entry) => entry.kind === "italianArmy")).toHaveLength(0);
    expect(plan.heldBack.italianArmy).toBe(1);
  });

  test("a granted reserve counter is a real 4.2 counter", () => {
    const G = unifiedItaly();
    G.italyReinforcements = {armies: 2, squadrons: 0};
    expect(placeNonPlayerCounter(G, "IT", "italianArmy", null, 2)).not.toBeNull();
    expect(placeNonPlayerCounter(G, "IT", "italianArmy", null, 2)).not.toBeNull();
    // The printed row is five armies: no sixth counter exists.
    expect(placeNonPlayerCounter(G, "IT", "italianArmy", null, 2)).toBeNull();
    expect(italianArmies(G)).toHaveLength(ITALIAN_ARMY_COUNTER_MAX);
  });
});
