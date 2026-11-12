/**
 * 4.2 / 20.3 / 22.4 / 25.2 — non-player counter-pool enforcement.
 *
 * The non-player telemetry is transcribed in `engine/counters.ts`.  These tests
 * pin the three legacy creation classes the round-5 gap named:
 *   - 20.3 non-player build steps use each minor's printed "Armies" row rather
 *     than a universal one-army ceiling;
 *   - the 25.2 US entry and the 22.4 Italian rebuild may not exceed their rows;
 *   - event/rebel placements (Zulu, Mahdi, Boxer, ...) log and skip an
 *     exhausted placement instead of over-placing.
 */
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, registerPolishIndependence, removeUnit, resolveCard} from "./engine/effects";
import {cardById} from "./engine/deck";
import {initialNonPlayerBuildBox, italianRebuildPlan, nonPlayerBuildPlan} from "./engine/endPhase";
import {enterGwAlly, redeployItaly} from "./engine/greatWarFlow";
import {resolveEnd, resolvePending} from "./moves";

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

const unitsOf = (G: ImperialElegyState, owner: string) =>
  Object.values(G.units).filter((unit) => unit.owner === owner);

const lastLog = (G: ImperialElegyState, key: string) =>
  [...G.log].reverse().find((entry) => entry.key === key);

const exhaustedLogs = (G: ImperialElegyState) =>
  G.log.filter((entry) => entry.key === "nonPlayerCounterExhausted");

const boxFor = (minors: string[]): ImperialElegyState["nonPlayerBuildBox"] => ({
  minors: [...minors],
  italy: {italianArmy: 0, squadron: 0, dreadnought: 0},
});

/** Give a minor `count` full-strength armies on its home space. */
const seedMinorArmies = (G: ImperialElegyState, minor: string, home: string, count: number): void => {
  for (const unit of unitsOf(G, minor)) removeUnit(G, unit.id);
  for (let i = 0; i < count; i += 1) placeUnit(G, minor, "minorArmy", home, 2);
};

// ---------------------------------------------------------------------------
// 20.3 — the printed minor "Armies" row is the ceiling
// ---------------------------------------------------------------------------

describe("20.3 minor build ceiling follows the 4.2 chart row", () => {
  test.each([
    ["Serbia", "serbia"],
    ["Greece", "greece"],
    ["Romania", "romania"],
    ["Bulgaria", "bulgaria"],
  ])("%s may reach its printed two armies, one step per end phase", (minor, home) => {
    const G = fresh();
    G.nonPlayerBuildBox = boxFor([minor]);
    seedMinorArmies(G, minor, home, 1);

    // One full army on the map: the chart row (2) still allows a new reduced
    // army.  The old universal ceiling of 1 refused this placement.
    expect(nonPlayerBuildPlan(G)).toEqual([
      {minor, home, action: "placeReduced", unitId: null, space: home},
    ]);
    resolveEnd(G, makeCtx());
    expect(unitsOf(G, minor)).toHaveLength(2);
    expect(unitsOf(G, minor).filter((unit) => unit.steps === 1)).toHaveLength(1);

    // The row is now full: no over-place, and the next phase only promotes the
    // reduced counter.
    const promotePlan = nonPlayerBuildPlan(G);
    expect(promotePlan).toHaveLength(1);
    expect(promotePlan[0]).toMatchObject({minor, home, action: "promote", space: home});
    resolveEnd(G, makeCtx());
    expect(unitsOf(G, minor)).toHaveLength(2);
    expect(unitsOf(G, minor).every((unit) => unit.steps === 2)).toBe(true);
    expect(nonPlayerBuildPlan(G)).toEqual([]);
  });

  test("a chart row with one army (Bosnia) still stops at one", () => {
    const G = fresh();
    G.nonPlayerBuildBox = boxFor(["Bosnia"]);
    seedMinorArmies(G, "Bosnia", "bosnia-herzegovina", 1);
    expect(nonPlayerBuildPlan(G)).toEqual([]);
    resolveEnd(G, makeCtx());
    expect(unitsOf(G, "Bosnia")).toHaveLength(1);
  });

  test("a minor the chart does not print keeps the conservative one-army ceiling", () => {
    const G = fresh();
    G.nonPlayerBuildBox = boxFor(["Tuscany"]);
    seedMinorArmies(G, "Tuscany", "tuscany", 1);
    expect(nonPlayerBuildPlan(G)).toEqual([]);
  });

  test("the build application logs and skips an unavailable counter", () => {
    const G = fresh();
    G.nonPlayerBuildBox = boxFor(["Serbia"]);
    seedMinorArmies(G, "Serbia", "serbia", 2);
    // The plan is empty, so no build is attempted and the pool is untouched.
    resolveEnd(G, makeCtx());
    expect(unitsOf(G, "Serbia")).toHaveLength(2);
    expect(exhaustedLogs(G)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 25.2 — US entry
// ---------------------------------------------------------------------------

const baseGw = (overrides: Partial<GreatWarState> = {}): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
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
    ...overrides,
  };
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.phase = "gwPlanning";
  return G;
};

describe("25.2 US entry respects the printed US row", () => {
  test("the full entry force is 3 armies / 2 squadrons / 2 dreadnoughts", () => {
    const G = baseGw();
    G.persistent.dreadnoughts = true;
    expect(enterGwAlly(G, makeCtx([], seat("GE")), "US", "te").ok).toBe(true);
    const us = unitsOf(G, "US");
    expect(us.filter((unit) => unit.kind === "usArmy")).toHaveLength(3);
    expect(us.filter((unit) => unit.kind === "squadron")).toHaveLength(2);
    expect(us.filter((unit) => unit.kind === "dreadnought")).toHaveLength(2);
    expect(exhaustedLogs(G)).toHaveLength(0);
  });

  test("pre-existing counters are skipped instead of over-placing the row", () => {
    const G = baseGw();
    placeUnit(G, "US", "usArmy", "the-south", 2);
    placeUnit(G, "US", "squadron", "the-south", 2);
    expect(enterGwAlly(G, makeCtx([], seat("GE")), "US", "te").ok).toBe(true);

    // Only the two missing army counters and the one missing squadron arrive.
    const us = unitsOf(G, "US");
    expect(us.filter((unit) => unit.kind === "usArmy")).toHaveLength(3);
    expect(us.filter((unit) => unit.kind === "squadron")).toHaveLength(2);
    expect(exhaustedLogs(G)).toHaveLength(2);
    expect(exhaustedLogs(G).every((entry) => entry.args?.owner === "US")).toBe(true);
  });

  test("a fully exhausted row places nothing further", () => {
    const G = baseGw();
    for (let i = 0; i < 3; i += 1) placeUnit(G, "US", "usArmy", "the-south", 2);
    for (let i = 0; i < 2; i += 1) placeUnit(G, "US", "squadron", "the-south", 2);
    expect(enterGwAlly(G, makeCtx([], seat("GE")), "US", "te").ok).toBe(true);
    expect(unitsOf(G, "US")).toHaveLength(5);
    expect(exhaustedLogs(G)).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// events / rebels
// ---------------------------------------------------------------------------

describe("event and rebel placements cannot exceed the printed rebel row", () => {
  test("the Boxer Rebellion stops at the three Boxer army counters", () => {
    const G = fresh();
    for (const space of ["shandong-peninsula", "shanghai", "guangzhou"]) G.spaces[space].control = "GE";
    // Two of the three printed Boxer counters are already in play.
    placeUnit(G, "REBEL:Boxer", "rebelArmy", "shanghai", 2);
    placeUnit(G, "REBEL:Boxer", "rebelArmy", "guangzhou", 2);

    resolveCard(G, makeCtx([], seat("GE")), "GE", cardById("IE-A094"));

    expect(unitsOf(G, "REBEL:Boxer")).toHaveLength(3);
    expect(exhaustedLogs(G)).toHaveLength(2);
    expect(G.spaces["shandong-peninsula"].rebellion?.rebels).toHaveLength(1);
  });

  test("the Zulu event does not create a second Zulu counter", () => {
    const G = fresh();
    placeUnit(G, "REBEL:Zulu", "rebelArmy", "south-africa", 1);
    resolveCard(G, makeCtx([], seat("GE")), "GE", cardById("IE-A076"));
    expect(unitsOf(G, "REBEL:Zulu")).toHaveLength(1);
    expect(exhaustedLogs(G)).toHaveLength(1);
    // The printed card-marker effect still happens.
    expect(G.powers.UK.cardMarkers).toBeLessThan(fresh().powers.UK.cardMarkers);
  });

  test("the Mahdist War skips the Mahdi army when its counter is already in play", () => {
    const G = fresh();
    placeUnit(G, "REBEL:Mahdi", "rebelArmy", "algeria", 1);
    const ctx = makeCtx([], seat("GE"));
    resolveCard(G, ctx, "GE", cardById("IE-A087"));
    expect(G.pending?.kind).toBe("eventTargetSpace");
    resolvePending(G, ctx, "algeria");
    expect(unitsOf(G, "REBEL:Mahdi")).toHaveLength(1);
    expect(exhaustedLogs(G)).toHaveLength(1);
    // The pacification marker and card-marker text still resolve.
    expect(G.spaces.algeria.pacification).toBe(1);
  });

  test("the Meiji Restoration army is limited to Japan's two-counter row", () => {
    const G = fresh();
    placeUnit(G, "Japan", "minorArmy", "japan", 2);
    placeUnit(G, "Japan", "minorArmy", "japan", 2);
    resolveCard(G, makeCtx([], seat("GE")), "GE", cardById("IE-A072"));
    expect(unitsOf(G, "Japan").filter((unit) => unit.kind === "minorArmy")).toHaveLength(2);
    expect(lastLog(G, "nonPlayerCounterExhausted")?.args).toMatchObject({owner: "Japan", pool: "army"});
  });
});

// ---------------------------------------------------------------------------
// 22.4 — Italian rebuild
// ---------------------------------------------------------------------------

describe("22.4 Italian rebuild respects the printed Italian row", () => {
  const italianArmy = (G: ImperialElegyState, space: string, steps: 1 | 2 = 2) =>
    placeUnit(G, "IT", "italianArmy", space, steps);

  test("five army counters (the chart row) leave nothing to rebuild", () => {
    const G = fresh();
    G.persistent.italyUnified = true;
    G.nonPlayerBuildBox = initialNonPlayerBuildBox();
    G.nonPlayerBuildBox.italy.italianArmy = 1;
    for (const space of ["rome", "naples", "piedmont", "tuscany", "lombardy"]) italianArmy(G, space);
    const plan = italianRebuildPlan(G)!;
    expect(plan.rebuild.filter((entry) => entry.kind === "italianArmy")).toHaveLength(0);
    expect(plan.heldBack.italianArmy).toBe(1);
  });

  test("a destroyed fourth army counter stays in the box (22.4 places standing armies only)", () => {
    const G = fresh();
    G.persistent.italyUnified = true;
    G.nonPlayerBuildBox = initialNonPlayerBuildBox();
    G.nonPlayerBuildBox.italy.italianArmy = 1;
    for (const space of ["rome", "naples", "piedmont"]) italianArmy(G, space);
    const plan = italianRebuildPlan(G)!;
    expect(plan.rebuild.filter((entry) => entry.kind === "italianArmy")).toHaveLength(0);
    expect(plan.heldBack.italianArmy).toBe(1);
  });

  test("a destroyed squadron is rebuilt while the Italian row has room", () => {
    const G = fresh();
    G.persistent.italyUnified = true;
    G.nonPlayerBuildBox = initialNonPlayerBuildBox();
    G.nonPlayerBuildBox.italy.squadron = 1;
    G.spaces.naples.control = "IT";
    // 22.2: a unified Italy's minor-state counters leave the space.
    for (const id of [...G.spaces.naples.units]) {
      if (G.units[id]?.owner !== "IT") removeUnit(G, id);
    }
    for (let i = 0; i < 2; i += 1) placeUnit(G, "IT", "squadron", "naples", 2);
    const plan = italianRebuildPlan(G)!;
    expect(plan.rebuild.filter((entry) => entry.kind === "squadron")).toHaveLength(1);
    expect(plan.heldBack.squadron).toBe(0);
  });

  test("the 22.4 redeployment does not exceed the five-counter Italian army row", () => {
    const G = fresh();
    G.persistent.italyUnified = true;
    G.nonPlayerBuildBox = initialNonPlayerBuildBox();
    G.nonPlayerBuildBox.italy.italianArmy = 1;
    for (const space of ["rome", "naples", "piedmont", "tuscany", "lombardy"]) italianArmy(G, space);
    const before = unitsOf(G, "IT").filter((unit) => unit.kind === "italianArmy").length;
    redeployItaly(G, makeCtx());
    expect(unitsOf(G, "IT").filter((unit) => unit.kind === "italianArmy")).toHaveLength(before);
    expect(before).toBe(5);
  });

  test("Poland's box is registered without free reserve counters", () => {
    const G = fresh();
    G.spaces.poland.control = "Poland";
    registerPolishIndependence(G);
    expect(G.nonPlayerBuildBox?.poland?.reserveArmies).toHaveLength(0);
  });
});
