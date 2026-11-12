/**
 * 33.2.1 UK manpower and armies — the CW (Commonwealth) army.
 *
 * "During the GW building new British armies consumes British manpower while
 * building new Indian armies and the CW (Commonwealth) army consumes colonial
 * manpower.  The CW army can only be built during the GW, and it must be built
 * in Australia/New Zealand or Canada (emphasis added by one of our Canadian
 * playtesters)."
 *
 * The build is the normal `moves.recruit` path with the typed `{cw: true}`
 * option: the counter is a UK army flagged `cw`, it draws on the colonial
 * manpower track (shared with the Indian Army), and the ordinary stacking and
 * counter guards still apply.  It is unavailable before the Great War.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {GreatWarState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {removeUnit} from "./engine/effects";
import {landUnitsIn, recomputeTracks} from "./engine/rules";
import {
  CW_ARMY_SPACES,
  canRecruitIn,
  isCwArmySpace,
  recruitmentLimits,
} from "./engine/characteristics";
import {recruit} from "./moves";

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

const gwState = (): GreatWarState => ({
  active: true,
  turn: 1,
  order: [],
  belligerents: [],
  neutrals: [],
  te: [],
  ta: [],
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
});

/** A clean UK Great War impulse (builds are paid from the GW budget). */
const startGwBuild = (G: ImperialElegyState, budget = 6): void => {
  G.phase = "gwManeuver";
  G.activePower = "UK";
  G.pending = null;
  G.powers.UK.gwBudget = budget;
  G.gw = gwState();
};

const startAction = (G: ImperialElegyState, cp = 6): void => {
  G.phase = "action";
  G.activePower = "UK";
  G.cpRemaining = cp;
  G.pending = null;
};

const lastLog = (G: ImperialElegyState, key: string) =>
  [...G.log].reverse().find((entry) => entry.key === key);

const cwArmies = (G: ImperialElegyState) =>
  Object.values(G.units).filter((unit) => unit.owner === "UK" && unit.flags?.cw === true);

const colonialCount = (G: ImperialElegyState): number =>
  Object.values(G.units).filter(
    (unit) => unit.owner === "UK" && (unit.flags?.cw === true || unit.flags?.indian === true),
  ).length;

/**
 * The UK colonial-manpower track is derived from colonial keys (`recomputeTracks`
 * runs at the end of every build).  Two extra colonial keys move it from the
 * printed start of 1 to 2, which is the smallest pool that can hold a setup
 * Indian army plus a CW army.
 */
const openColonialTrack = (G: ImperialElegyState): void => {
  G.spaces["the-south"].control = "UK";
  G.spaces.mexico.control = "UK";
  recomputeTracks(G);
  expect(G.powers.UK.secondaryManpower).toBe(2);
};

/**
 * Pin the colonial track right before one build.  Used only where the test
 * needs a pool larger than the printed track can ever reach (the stacking
 * guard); each call re-asserts the value the build's own check reads.
 */
const simulateColonialManpower = (G: ImperialElegyState, value: number): void => {
  G.powers.UK.secondaryManpower = value;
};

// ---------------------------------------------------------------------------
// The build spaces
// ---------------------------------------------------------------------------

test("the printed CW build spaces are Australia/New Zealand and Canada", () => {
  expect([...CW_ARMY_SPACES].sort()).toEqual(["australia-new-zealand", "canada"]);
  expect(isCwArmySpace("canada")).toBe(true);
  expect(isCwArmySpace("australia-new-zealand")).toBe(true);
  expect(isCwArmySpace("scotland")).toBe(false);
  expect(isCwArmySpace(null)).toBe(false);
});

// ---------------------------------------------------------------------------
// Great War only
// ---------------------------------------------------------------------------

describe("the CW army is unavailable before the Great War", () => {
  test("a pre-GW build is refused with the printed reason and spends no CP", () => {
    const G = fresh();
    startAction(G);
    expect(recruit(G, makeCtx([], seat("UK")), "canada", "army", 1, {cw: true})).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(6);
    expect(cwArmies(G)).toHaveLength(0);
    expect(lastLog(G, "recruitRejected")?.args?.reasons).toMatch(/only be built during the GW/);
  });

  test("canRecruitIn reports the GW-only rule", () => {
    const G = fresh();
    startAction(G);
    const decision = canRecruitIn(G, "UK", "canada", "army", {cw: true});
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain("The CW army can only be built during the GW");
    expect(recruitmentLimits(G, "UK").british?.cwArmyAvailable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The build spaces during the GW
// ---------------------------------------------------------------------------

describe("during the Great War", () => {
  test("a build outside Australia/New Zealand or Canada is refused", () => {
    const G = fresh();
    startGwBuild(G);
    expect(recruit(G, makeCtx([], seat("UK")), "scotland", "army", 1, {cw: true})).toBe(INVALID_MOVE);
    expect(lastLog(G, "recruitRejected")?.args?.reasons).toMatch(/Australia\/New Zealand or Canada/);
    expect(cwArmies(G)).toHaveLength(0);
  });

  test("Canada and Australia/New Zealand both accept the build and consume colonial manpower", () => {
    const G = fresh();
    startGwBuild(G, 12);
    openColonialTrack(G);
    const ctx = makeCtx([], seat("UK"));

    expect(recruit(G, ctx, "canada", "army", 1, {cw: true})).toBeUndefined();
    const canada = landUnitsIn(G, "canada").find((unit) => unit.owner === "UK" && unit.kind === "army")!;
    expect(canada.flags?.cw).toBe(true);
    expect(canada.flags?.indian).toBeUndefined();
    expect(canada.steps).toBe(2);
    expect(G.powers.UK.gwBudget).toBe(11);
    expect(lastLog(G, "recruited")?.args).toMatchObject({cw: true, indian: false, space: "canada"});
    expect(recruitmentLimits(G, "UK").british).toMatchObject({currentCwArmies: 1, cwArmyLimit: 2});

    // The shared colonial pool is now full: the setup Indian army + 1 CW army.
    expect(recruit(G, ctx, "canada", "army", 1, {cw: true})).toBe(INVALID_MOVE);
    expect(lastLog(G, "recruitRejected")?.args?.reasons).toMatch(/Colonial manpower limit 2/);

    // Freeing the Indian army opens the second printed space.
    const indian = Object.values(G.units).find((unit) => unit.owner === "UK" && unit.flags?.indian === true)!;
    removeUnit(G, indian.id);
    expect(recruit(G, ctx, "australia-new-zealand", "army", 1, {cw: true})).toBeUndefined();
    expect(cwArmies(G)).toHaveLength(2);
    expect(colonialCount(G)).toBe(2);
    expect(G.powers.UK.gwBudget).toBe(10);
  });

  test("British and colonial manpower are separate: a British build ignores the colonial pool", () => {
    const G = fresh();
    startGwBuild(G);
    // The colonial pool is full (1 Indian army, colonial manpower 1), but the
    // British army limit (3 manpower) is not.
    const ctx = makeCtx([], seat("UK"));
    expect(recruit(G, ctx, "canada", "army", 1, {cw: true})).toBe(INVALID_MOVE);
    expect(lastLog(G, "recruitRejected")?.args?.reasons).toMatch(/Colonial manpower/);

    expect(recruit(G, ctx, "canada", "army", 1)).toBeUndefined();
    const british = landUnitsIn(G, "canada").find(
      (unit) => unit.owner === "UK" && unit.kind === "army" && unit.flags?.cw !== true,
    )!;
    expect(british.flags?.cw).toBeUndefined();
    expect(british.flags?.indian).toBeUndefined();
    // A British build does not consume the colonial track.
    expect(colonialCount(G)).toBe(1);
    expect(G.powers.UK.gwBudget).toBe(5);
  });

  test("the Indian Army and the CW army share the colonial manpower ceiling", () => {
    const G = fresh();
    startGwBuild(G, 12);
    openColonialTrack(G);
    const ctx = makeCtx([], seat("UK"));
    // Free the track from the setup Indian army, then fill it with CW armies.
    const indian = Object.values(G.units).find((unit) => unit.owner === "UK" && unit.flags?.indian === true)!;
    removeUnit(G, indian.id);
    expect(recruit(G, ctx, "canada", "army", 1, {cw: true})).toBeUndefined();
    expect(recruit(G, ctx, "australia-new-zealand", "army", 1, {cw: true})).toBeUndefined();
    expect(colonialCount(G)).toBe(2);

    // No colonial manpower is left for a new Indian army.
    expect(recruit(G, ctx, "india", "army", 1)).toBe(INVALID_MOVE);
    expect(lastLog(G, "recruitRejected")?.args?.reasons).toMatch(/Colonial manpower limit 2/);
  });

  test("the normal stacking rule still caps the CW armies in one space", () => {
    const G = fresh();
    startGwBuild(G, 12);
    const ctx = makeCtx([], seat("UK"));
    // Canada is outside Europe: at most two armies per space.  The pool is
    // pinned per build because the move recomputes it from the colonial keys.
    simulateColonialManpower(G, 6);
    expect(recruit(G, ctx, "canada", "army", 1, {cw: true})).toBeUndefined();
    simulateColonialManpower(G, 6);
    expect(recruit(G, ctx, "canada", "army", 1, {cw: true})).toBeUndefined();
    simulateColonialManpower(G, 6);
    expect(recruit(G, ctx, "canada", "army", 1, {cw: true})).toBe(INVALID_MOVE);
    expect(lastLog(G, "recruitRejected")?.args?.reasons).toMatch(/Stacking limit reached/);
    expect(cwArmies(G)).toHaveLength(2);
  });

  test("a CW build does not relabel or upgrade an existing British army", () => {
    const G = fresh();
    startGwBuild(G, 12);
    openColonialTrack(G);
    const ctx = makeCtx([], seat("UK"));
    // A reduced British army sits in Canada.
    expect(recruit(G, ctx, "canada", "army", 1)).toBeUndefined();
    const british = landUnitsIn(G, "canada").find(
      (unit) => unit.owner === "UK" && unit.kind === "army" && unit.flags?.cw !== true,
    )!;
    british.steps = 1;

    // The CW build is a distinct counter: the British army is not relabelled
    // and the colonial track pays for the new CW army.
    expect(recruit(G, ctx, "canada", "army", 1, {cw: true})).toBeUndefined();
    expect(british.steps).toBe(1);
    expect(british.flags?.cw).toBeUndefined();
    const cw = cwArmies(G);
    expect(cw).toHaveLength(1);
    expect(cw[0].steps).toBe(2);
    expect(colonialCount(G)).toBe(2);
  });

  test("the CW flag is recorded in the typed unit state and in the recruitment limits", () => {
    const G = fresh();
    startGwBuild(G);
    openColonialTrack(G);
    expect(recruit(G, makeCtx([], seat("UK")), "australia-new-zealand", "army", 1, {cw: true})).toBeUndefined();
    const built = cwArmies(G);
    expect(built).toHaveLength(1);
    expect(built[0].kind).toBe("army");
    expect(built[0].steps).toBe(2);
    expect(built[0].space).toBe("australia-new-zealand");
    const limits = recruitmentLimits(G, "UK");
    expect(limits.british).toMatchObject({cwArmyAvailable: true, currentCwArmies: 1, cwArmyLimit: 2});
    // It is not a British army: the British army count is unaffected.
    expect(limits.british?.currentBritishArmies).toBe(1);
  });
});
