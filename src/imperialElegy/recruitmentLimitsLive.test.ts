/**
 * 33.2 / 33.6 recruitment limits — live `moves.recruit` paths.
 *
 * The pure decisions live in `characteristics.test.ts`; this suite proves the
 * move consults `recruitmentLimits`/`canRecruitIn`, records the typed unit
 * flags, spends no CP on a rejection and logs the printed reason.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {GreatWarState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {landUnitsIn, recomputeTracks} from "./engine/rules";
import {canRecruitIn, recruitmentLimits} from "./engine/characteristics";
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

const startAction = (G: ImperialElegyState, power: Power, cp = 6): void => {
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = cp;
  G.pending = null;
};

const activateGw = (G: ImperialElegyState): void => {
  const gw: GreatWarState = {
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
  };
  G.gw = gw;
};

const unitCount = (G: ImperialElegyState, power: Power, predicate: (flags: Record<string, unknown>) => boolean): number =>
  Object.values(G.units).filter(
    (u) => u.owner === power && u.kind === "army" && predicate((u.flags ?? {}) as Record<string, unknown>),
  ).length;

const lastLog = (G: ImperialElegyState, key: string) => [...G.log].reverse().find((entry) => entry.key === key);

// ---------------------------------------------------------------------------
// 33.2 UK Professional Army / Indian Army
// ---------------------------------------------------------------------------

describe("UK Professional Army (33.2)", () => {
  test("reserves are always refused and the rejection is logged", () => {
    const G = fresh();
    startAction(G, "UK", 4);
    expect(recruit(G, makeCtx([], seat("UK")), "london", "reserveArmy")).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(4);
    expect(G.powers.UK.reserves).toHaveLength(0);
    const rejection = lastLog(G, "recruitRejected");
    expect(rejection?.args?.reasons).toMatch(/reserve armies/);
    expect(recruitmentLimits(G, "UK").reserveAllowed).toBe(false);
  });

  test("only the 1st British Army may be built before the GW, counted globally", () => {
    const G = fresh();
    startAction(G, "UK", 4);
    const ctx = makeCtx([], seat("UK"));
    // The setup 1st Army sits in London; a build anywhere else must still fail.
    expect(recruit(G, ctx, "scotland", "army")).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(4);
    expect(lastLog(G, "recruitRejected")?.args?.reasons).toMatch(/1st British Army/);

    // Removing the printed 1st Army makes the same build legal.
    const first = Object.values(G.units).find((u) => u.owner === "UK" && u.flags?.firstArmy === true)!;
    removeUnit(G, first.id);
    expect(recruit(G, ctx, "scotland", "army")).toBeUndefined();
    expect(unitCount(G, "UK", (flags) => flags.indian !== true)).toBe(1);
  });

  test("after the GW the British army limit is British manpower", () => {
    const G = fresh();
    activateGw(G);
    startAction(G, "UK", 6);
    const ctx = makeCtx([], seat("UK"));
    // The manpower track (3) only allows two more British armies alongside the
    // 1st Army; the third build is refused.  12.2: 1 CP per step, so a new
    // full-strength counter costs 2 CP.
    expect(recruit(G, ctx, "scotland", "army", 2)).toBeUndefined();
    expect(recruit(G, ctx, "scotland", "army", 2)).toBeUndefined();
    expect(recruit(G, ctx, "scotland", "army", 2)).toBe(INVALID_MOVE);
    expect(lastLog(G, "recruitRejected")?.args?.reasons).toMatch(/British manpower/);
  });

  test("Indian armies are limited by colonial manpower and carry the indian flag", () => {
    const G = fresh();
    startAction(G, "UK", 6);
    const ctx = makeCtx([], seat("UK"));
    // Setup: one Indian army in India and colonial manpower 1.
    expect(recruit(G, ctx, "india", "army")).toBe(INVALID_MOVE);
    expect(lastLog(G, "recruitRejected")?.args?.reasons).toMatch(/Colonial manpower/);

    const indian = Object.values(G.units).find((u) => u.owner === "UK" && u.flags?.indian === true)!;
    removeUnit(G, indian.id);
    expect(recruit(G, ctx, "bengal", "army")).toBeUndefined();
    const built = landUnitsIn(G, "bengal").find((u) => u.owner === "UK" && u.kind === "army")!;
    expect(built.flags?.indian).toBe(true);
    // The build must not consume British manpower: the 1st Army is still the
    // only British army, so a second British build stays blocked pre-GW.
    expect(recruit(G, ctx, "wales", "army")).toBe(INVALID_MOVE);
  });

  test("an occupied or non-home space is refused with the printed reason", () => {
    const G = fresh();
    startAction(G, "GE", 4);
    const decision = canRecruitIn(G, "GE", "saxony", "army");
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain("Not a home space");
    expect(recruit(G, makeCtx([], seat("GE")), "saxony", "army")).toBe(INVALID_MOVE);
  });

  test("elite corps needs a friendly army and is bounded by the printed counter mix", () => {
    const G = fresh();
    startAction(G, "GE", 4);
    expect(recruit(G, makeCtx([], seat("GE")), "saxony", "eliteCorps")).toBe(INVALID_MOVE);
    // GE already fields the Berlin EC at setup and its chart prints four ECs.
    // 12.2 has no per-player ceiling; errata 33.6 caps only the Ottomans (one
    // until The Young Turks, then two), so a second GE EC is legal.
    expect(recruit(G, makeCtx([], seat("GE")), "berlin", "eliteCorps")).toBeUndefined();
    // AU has an army in Vienna and no starting EC, so the attachment is legal.
    startAction(G, "AU", 4);
    expect(recruit(G, makeCtx([], seat("AU")), "vienna", "eliteCorps")).toBeUndefined();
  });

  test("a successful army build spends CP and logs the typed build", () => {
    const G = fresh();
    startAction(G, "GE", 4);
    // Prussia's army is removed so GE is below its manpower track.
    const prussian = landUnitsIn(G, "prussia").find((u) => u.owner === "GE" && u.kind === "army")!;
    removeUnit(G, prussian.id);
    expect(recruit(G, makeCtx([], seat("GE")), "berlin", "army", 1)).toBeUndefined();
    expect(G.cpRemaining).toBe(3);
    expect(landUnitsIn(G, "berlin").filter((u) => u.owner === "GE" && u.kind === "army")).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 12.2 refitting a reduced army in place
// ---------------------------------------------------------------------------

/**
 * The manpower track caps how many army *counters* a power may field, not how
 * many steps those counters have.  Flipping a reduced army back to full adds no
 * counter, so it stays legal at the ceiling — but the ceiling is exactly what
 * blocks it in a fresh campaign, where every power starts at its manpower.
 */
describe("12.2 refit a reduced army at the manpower ceiling", () => {
  test("the in-place flip is legal, spends 1 CP and keeps the counter count", () => {
    const G = fresh();
    startAction(G, "GE", 4);
    expect(recruitmentLimits(G, "GE").currentArmies).toBe(recruitmentLimits(G, "GE").armyLimit);

    const berlin = landUnitsIn(G, "berlin").find((u) => u.owner === "GE" && u.kind === "army")!;
    berlin.steps = 1;

    expect(canRecruitIn(G, "GE", "berlin", "army").allowed).toBe(true);
    expect(recruit(G, makeCtx([], seat("GE")), "berlin", "army", 1)).toBeUndefined();
    expect(berlin.steps).toBe(2);
    expect(G.cpRemaining).toBe(3);
    expect(landUnitsIn(G, "berlin").filter((u) => u.owner === "GE" && u.kind === "army")).toHaveLength(1);
    expect(lastLog(G, "recruited")?.args).toMatchObject({kind: "army", space: "berlin"});
  });

  test("a full army at the ceiling still needs a free counter", () => {
    const G = fresh();
    startAction(G, "GE", 4);
    const decision = canRecruitIn(G, "GE", "berlin", "army");
    expect(decision.allowed).toBe(false);
    expect(decision.reasons.join(" ")).toMatch(/Manpower/);
    expect(recruit(G, makeCtx([], seat("GE")), "berlin", "army")).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(4);
  });

  test("the flip targets the reduced counter, not the first army in the space", () => {
    const G = fresh();
    startAction(G, "GE", 4);
    // Stack both German armies in Berlin (cap 3) and reduce the second one.
    const prussian = landUnitsIn(G, "prussia").find((u) => u.owner === "GE" && u.kind === "army")!;
    G.spaces.prussia.units = G.spaces.prussia.units.filter((id) => id !== prussian.id);
    G.spaces.berlin.units.push(prussian.id);
    prussian.space = "berlin";
    prussian.steps = 1;
    const berlin = landUnitsIn(G, "berlin").find((u) => u.owner === "GE" && u.kind === "army" && u.id !== prussian.id)!;
    expect(berlin.steps).toBe(2);

    expect(recruit(G, makeCtx([], seat("GE")), "berlin", "army", 1)).toBeUndefined();
    expect(prussian.steps).toBe(2);
    expect(berlin.steps).toBe(2);
    expect(landUnitsIn(G, "berlin").filter((u) => u.owner === "GE" && u.kind === "army")).toHaveLength(2);
    expect(G.cpRemaining).toBe(3);
  });

  test("UK Professional Army still allows the 1st Army to be refit before the GW", () => {
    const G = fresh();
    startAction(G, "UK", 4);
    const first = Object.values(G.units).find((u) => u.owner === "UK" && u.flags?.firstArmy === true)!;
    first.steps = 1;
    expect(canRecruitIn(G, "UK", first.space as string, "army").allowed).toBe(true);
    expect(recruit(G, makeCtx([], seat("UK")), first.space as string, "army", 1)).toBeUndefined();
    expect(first.steps).toBe(2);
    expect(G.cpRemaining).toBe(3);
  });

  test("an Ottoman Turkish army refits in a clean home key at the Turkish ceiling", () => {
    const G = fresh();
    startAction(G, "OT", 4);
    // Erzurum's Armenians bar a Turkish build there; move the reduced counter
    // to Ankara so the only remaining gate is the manpower ceiling.
    const erzurum = landUnitsIn(G, "erzurum").find((u) => u.owner === "OT" && u.kind === "army")!;
    G.spaces.erzurum.units = G.spaces.erzurum.units.filter((id) => id !== erzurum.id);
    G.spaces.ankara.units.push(erzurum.id);
    erzurum.space = "ankara";
    expect(erzurum.steps).toBe(1);
    expect(recruitmentLimits(G, "OT").currentArmies).toBe(recruitmentLimits(G, "OT").armyLimit);

    expect(canRecruitIn(G, "OT", "ankara", "army").allowed).toBe(true);
    expect(recruit(G, makeCtx([], seat("OT")), "ankara", "army", 1)).toBeUndefined();
    expect(erzurum.steps).toBe(2);
    expect(G.cpRemaining).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 33.6 Ottoman Manpower
// ---------------------------------------------------------------------------

describe("Ottoman Manpower (33.6)", () => {
  test("Turkish armies are refused in Arab keys and minority-nationality keys", () => {
    const G = fresh();
    startAction(G, "OT", 6);
    const ctx = makeCtx([], seat("OT"));
    // An Arab-nationality space defaults to the Arab pool, so it is the pool
    // that refuses (the printed Arab army already spends the track).
    expect(recruit(G, ctx, "arabia", "army")).toBe(INVALID_MOVE);
    expect(lastLog(G, "recruitRejected")?.args?.reasons).toMatch(/Arab manpower/);
    // Forcing a Turkish build into an Arab key is refused by Local Autonomy.
    expect(recruit(G, ctx, "palestine", "army", 1, {ottoman: "turkish"})).toBe(INVALID_MOVE);
    expect(lastLog(G, "recruitRejected")?.args?.reasons).toMatch(/Arab\/Egyptian keys/);
    // Arabia is a printed territory with an Arab nationality, so a forced
    // Turkish build there is refused by the minority rule instead.
    expect(recruit(G, ctx, "arabia", "army", 1, {ottoman: "turkish"})).toBe(INVALID_MOVE);
    expect(lastLog(G, "recruitRejected")?.args?.reasons).toMatch(/minority nationality/);
    // Erzurum prints Armenians, a minority nationality for the Ottomans.
    expect(recruit(G, ctx, "erzurum", "army")).toBe(INVALID_MOVE);
    expect(lastLog(G, "recruitRejected")?.args?.reasons).toMatch(/minority nationality/);
  });

  test("a Turkish army builds in a clean key and carries no arab flag", () => {
    const G = fresh();
    startAction(G, "OT", 6);
    // Free one Turkish manpower slot: the setup already fields the track's 3.
    const erzurum = landUnitsIn(G, "erzurum").find((u) => u.owner === "OT")!;
    removeUnit(G, erzurum.id);
    expect(recruit(G, makeCtx([], seat("OT")), "ankara", "army")).toBeUndefined();
    const built = landUnitsIn(G, "ankara").find((u) => u.owner === "OT" && u.kind === "army")!;
    expect(built.flags?.arab).toBeUndefined();
    expect(lastLog(G, "recruited")?.args).toMatchObject({ottoman: "turkish"});
  });

  test("Arab armies need an Arab key and Arab manpower, and carry the arab flag", () => {
    const G = fresh();
    startAction(G, "OT", 6);
    const ctx = makeCtx([], seat("OT"));
    // Ankara is not an Arab key.
    expect(recruit(G, ctx, "ankara", "army", 1, {ottoman: "arab"})).toBe(INVALID_MOVE);
    expect(lastLog(G, "recruitRejected")?.args?.reasons).toMatch(/Arab\/Egyptian keys/);

    // The setup Arab army already spends the only Arab manpower.
    expect(recruit(G, ctx, "arabia", "army", 1, {ottoman: "arab"})).toBe(INVALID_MOVE);
    expect(lastLog(G, "recruitRejected")?.args?.reasons).toMatch(/Arab manpower/);

    const syria = landUnitsIn(G, "syria").find((u) => u.owner === "OT" && u.flags?.arab === true)!;
    removeUnit(G, syria.id);
    expect(recruit(G, ctx, "arabia", "army", 1, {ottoman: "arab"})).toBeUndefined();
    const built = landUnitsIn(G, "arabia").find((u) => u.owner === "OT" && u.kind === "army")!;
    expect(built.flags?.arab).toBe(true);
    expect(lastLog(G, "recruited")?.args).toMatchObject({ottoman: "arab"});
    expect(G.powers.OT.secondaryManpower).toBe(1);
    // The Arab pool is now full again.
    expect(recruit(G, ctx, "mecca", "army", 1, {ottoman: "arab"})).toBe(INVALID_MOVE);
  });

  test("the build location selects the pool: an Arab key defaults to an Arab army", () => {
    const G = fresh();
    startAction(G, "OT", 6);
    const syria = landUnitsIn(G, "syria").find((u) => u.owner === "OT" && u.flags?.arab === true)!;
    removeUnit(G, syria.id);
    // Egypt starts as an independent minor; the build needs OT control.
    G.spaces.egypt.control = "OT";
    expect(recruit(G, makeCtx([], seat("OT")), "egypt", "army")).toBeUndefined();
    const built = landUnitsIn(G, "egypt").find((u) => u.owner === "OT" && u.kind === "army")!;
    expect(built.flags?.arab).toBe(true);
  });

  test("Local Autonomy keys still choose the Arab pool after a recompute", () => {
    const G = fresh();
    recomputeTracks(G);
    expect(G.powers.OT.secondaryManpower).toBe(1);
    startAction(G, "OT", 6);
    expect(canRecruitIn(G, "OT", "arabia", "army", {ottoman: "turkish"}).allowed).toBe(false);
    // The Arab pool is already spent by the setup Arab army, not mis-keyed.
    const arab = canRecruitIn(G, "OT", "arabia", "army", {ottoman: "arab"});
    expect(arab.reasons.join(" ")).toMatch(/Arab manpower limit/);
    const syria = landUnitsIn(G, "syria").find((u) => u.owner === "OT" && u.flags?.arab === true)!;
    removeUnit(G, syria.id);
    expect(canRecruitIn(G, "OT", "arabia", "army", {ottoman: "arab"}).allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 12.14 / card restrictions
// ---------------------------------------------------------------------------

describe("recruit restrictions from cards", () => {
  test("A Liberal Reforms impulse cannot build armies", () => {
    const G = fresh();
    startAction(G, "GE", 4);
    G.powers.GE.flags.noBuildArmiesThisImpulse = true;
    const prussian = landUnitsIn(G, "prussia").find((u) => u.owner === "GE" && u.kind === "army")!;
    removeUnit(G, prussian.id);
    expect(recruit(G, makeCtx([], seat("GE")), "berlin", "army")).toBe(INVALID_MOVE);
    expect(lastLog(G, "recruitRejected")?.args?.reasons).toMatch(/may not be built/);
  });

  test("a rejected build never spends CP", () => {
    const G = fresh();
    startAction(G, "OT", 6);
    expect(recruit(G, makeCtx([], seat("OT")), "arabia", "army")).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(6);
  });
});
