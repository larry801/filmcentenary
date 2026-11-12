/**
 * 33.2 The Indian Army.
 *
 * "The UK player can build Indian armies equal to their colonial manpower.
 * Indian armies automatically displace to Bengal or India: (1) at the end of a
 * turn, or (2) the conclusion of a war the UK participated in."
 *
 * Covers the pure destination plan, the end-of-turn and war-conclusion
 * hooks, the enemy-destination fallback and the build cap (including the
 * post-independence one-army cap).
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {applyWarEndCharacteristics, recruit, resolveEnd} from "./moves";
import {
  canRecruitIn,
  indianArmyCap,
  planIndianArmyDisplacement,
  recruitmentLimits,
} from "./engine/characteristics";
import {createWarState} from "./engine/limitedWar";
import {recomputeTracks} from "./engine/rules";

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

const makeIndianArmy = (G: ImperialElegyState, space: string) =>
  placeUnit(G, "UK", "army", space, 2, {flags: {indian: true}});

const indianArmiesOf = (G: ImperialElegyState) =>
  Object.values(G.units).filter((unit) => unit.owner === "UK" && Boolean(unit.flags?.indian));

const setActive = (G: ImperialElegyState, power: Power, cp = 6): void => {
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = cp;
  G.pending = null;
};

// ---------------------------------------------------------------------------
// Destination plan
// ---------------------------------------------------------------------------

describe("planIndianArmyDisplacement (33.2)", () => {
  test("prefers Bengal while the UK controls it, otherwise India", () => {
    const G = fresh();
    const army = makeIndianArmy(G, "london");
    expect(planIndianArmyDisplacement(G)).toEqual([{unitId: army.id, from: "london", to: "bengal"}]);

    G.spaces.bengal.control = "FR";
    expect(planIndianArmyDisplacement(G)).toEqual([{unitId: army.id, from: "london", to: "india"}]);
  });

  test("an enemy-occupied Bengal falls back to India", () => {
    const G = fresh();
    // Enemy means at war (rules.ts#hostileOwner): put GE and the UK at war.
    G.war = createWarState(G, "GE", "UK", "conquest", ["london"], 2);
    const army = makeIndianArmy(G, "london");
    placeUnit(G, "GE", "army", "bengal", 2);
    expect(planIndianArmyDisplacement(G)).toEqual([{unitId: army.id, from: "london", to: "india"}]);
  });

  test("armies already in Bengal or India are not displaced", () => {
    const G = fresh();
    const inIndia = makeIndianArmy(G, "india");
    const inBengal = makeIndianArmy(G, "bengal");
    const plan = planIndianArmyDisplacement(G).map((entry) => entry.unitId);
    expect(plan).not.toContain(inIndia.id);
    expect(plan).not.toContain(inBengal.id);
  });

  test("both printed destinations gone: falls back to the nearest friendly LoC space", () => {
    const G = fresh();
    const army = makeIndianArmy(G, "london");
    G.spaces.bengal.control = "FR";
    G.spaces.india.control = "FR";
    const [entry] = planIndianArmyDisplacement(G);
    expect(entry.unitId).toBe(army.id);
    expect(entry.to).not.toBeNull();
    expect(["bengal", "india"]).not.toContain(entry.to);
    expect(G.spaces[entry.to as string].control).toBe("UK");
  });
});

// ---------------------------------------------------------------------------
// End-of-turn and war-conclusion hooks
// ---------------------------------------------------------------------------

describe("automatic displacement hooks", () => {
  test("resolveEnd displaces an Indian army at the end of the turn", () => {
    const G = fresh();
    // The live end phase now applies 20.5.  The campaign starts with one Indian
    // army (the colonial-manpower limit); remove it so adding the displaced army
    // keeps the track within its limit and the test observes 33.2 itself.
    for (const unit of Object.values(G.units)) {
      if (unit.owner === "UK" && unit.flags?.indian === true) removeUnit(G, unit.id);
    }
    const army = makeIndianArmy(G, "london");
    resolveEnd(G, makeCtx());
    expect(G.units[army.id].space).toBe("bengal");
    expect(G.log.some((entry) => entry.key === "indianArmyDisplaced" && entry.args?.reason === "endOfTurn")).toBe(true);
  });

  test("a war the UK fought displaces at its conclusion", () => {
    const G = fresh();
    const army = makeIndianArmy(G, "london");
    G.war = createWarState(G, "GE", "UK", "conquest", ["london"], 2);
    applyWarEndCharacteristics(G, makeCtx());
    expect(G.units[army.id].space).toBe("bengal");
    expect(G.log.some((entry) => entry.key === "indianArmyDisplaced" && entry.args?.reason === "warEnd")).toBe(true);
  });

  test("UK participation as an ally also triggers the displacement", () => {
    const G = fresh();
    const army = makeIndianArmy(G, "london");
    const war: WarState = createWarState(G, "GE", "FR", "conquest", ["paris"], 2);
    war.attackerAllies = ["UK"];
    G.war = war;
    applyWarEndCharacteristics(G, makeCtx());
    expect(G.units[army.id].space).toBe("bengal");
  });

  test("a war the UK did not fight leaves its Indian armies alone", () => {
    const G = fresh();
    const army = makeIndianArmy(G, "london");
    G.war = createWarState(G, "GE", "FR", "conquest", ["paris"], 2);
    applyWarEndCharacteristics(G, makeCtx());
    expect(G.units[army.id].space).toBe("london");
  });
});

// ---------------------------------------------------------------------------
// Build cap
// ---------------------------------------------------------------------------

describe("Indian army build limit (33.2)", () => {
  test("colonial manpower caps the builds and the new units carry the Indian flag", () => {
    const G = fresh();
    // Raise the UK colonial key count so the printed track gives 2 colonial
    // manpower (the campaign start gives 1).
    G.spaces["the-south"].control = "UK";
    G.spaces.mexico.control = "UK";
    recomputeTracks(G);
    expect(G.powers.UK.secondaryManpower).toBe(2);
    setActive(G, "UK");

    // One Indian army already exists from the campaign setup; build the second.
    expect(indianArmiesOf(G)).toHaveLength(1);
    expect(recruit(G, makeCtx([], seat("UK")), "bengal", "army", 1, {indian: true})).toBeUndefined();
    expect(indianArmiesOf(G)).toHaveLength(2);
    for (const unit of indianArmiesOf(G)) expect(unit.flags?.indian).toBe(true);

    // A third build is over colonial manpower.
    expect(canRecruitIn(G, "UK", "bengal", "army", {indian: true}).allowed).toBe(false);
    setActive(G, "UK");
    expect(recruit(G, makeCtx([], seat("UK")), "bengal", "army", 1, {indian: true})).toBe(INVALID_MOVE);
    expect(indianArmiesOf(G)).toHaveLength(2);
  });

  test("after independence the cap is one and replacements stay refused", () => {
    const G = fresh();
    G.powers.UK.indiaIndependent = true;
    G.powers.UK.indiaStable = false;
    G.powers.UK.secondaryManpower = 4;
    setActive(G, "UK");

    expect(indianArmyCap(G)).toBe(1);
    expect(recruitmentLimits(G, "UK").british?.indianArmyLimit).toBe(1);
    expect(recruit(G, makeCtx([], seat("UK")), "bengal", "army", 1, {indian: true})).toBe(INVALID_MOVE);
    expect(G.log.some((entry) => entry.key === "recruitRejected")).toBe(true);
  });
});
