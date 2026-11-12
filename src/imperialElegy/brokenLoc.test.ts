import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power, WarState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {
  beginImpulseUpkeep,
  brokenLoc,
  brokenLocSpaces,
  friendlySpace,
  hasLoc,
  impulsePenalties,
  landUnitsIn,
} from "./engine/rules";
import {beginLandBattle, supportCandidates} from "./engine/combat";
import {resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {
      Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3,
    },
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

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const warState = (attacker: Power, defender: Power): WarState => ({
  attacker,
  defender,
  attackerAllies: [],
  defenderAllies: [],
  attackerMinors: [],
  defenderMinors: [],
  warAim: "conquest",
  objectives: [],
  status: "maneuver",
  budgets: {},
  initiative: [],
  treaties: [],
  victor: null,
  truceTurns: 2,
  passed: [],
  startedTurn: 1,
} as unknown as WarState);

const clearLand = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...landUnitsIn(G, space)]) removeUnit(G, unit.id);
};

const atWar = (G: ImperialElegyState): ImperialElegyState => {
  G.phase = "wartime";
  G.war = warState("GE", "FR");
  return G;
};

// ---------------------------------------------------------------------------
// 5.6.2 detection
// ---------------------------------------------------------------------------

describe("5.6.2 broken-LoC detection", () => {
  test("an army that cannot trace to a supply source is broken; a home army is not", () => {
    const G = atWar(fresh());
    clearLand(G, "paris");
    const paris = placeUnit(G, "GE", "army", "paris", 2);
    expect(brokenLoc(G, "GE", "paris")).toBe(true);
    expect(brokenLoc(G, "GE", "berlin")).toBe(false);
    expect(brokenLocSpaces(G, "GE")).toContain("paris");
    expect(brokenLocSpaces(G, "GE")).not.toContain("berlin");
    expect(G.units[paris.id].steps).toBe(2);
  });

  test("no broken-LoC step penalties in peacetime", () => {
    const G = fresh();
    clearLand(G, "paris");
    placeUnit(G, "GE", "army", "paris", 2);
    expect(brokenLoc(G, "GE", "paris")).toBe(true);
    expect(brokenLocSpaces(G, "GE")).toEqual([]);
    expect(impulsePenalties(G, "GE").some((p) => p.space === "paris")).toBe(false);
  });

  test("only armies check for a LoC: an EC alone does not create a penalty", () => {
    const G = atWar(fresh());
    clearLand(G, "paris");
    placeUnit(G, "GE", "eliteCorps", "paris", 1);
    expect(brokenLocSpaces(G, "GE")).not.toContain("paris");
    expect(impulsePenalties(G, "GE").some((p) => p.space === "paris")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5.6.2 (1) start-of-impulse step loss
// ---------------------------------------------------------------------------

describe("5.6.2 broken-LoC step losses", () => {
  test("one step total at the start of the owning player's impulse", () => {
    const G = atWar(fresh());
    clearLand(G, "paris");
    const only = placeUnit(G, "GE", "army", "paris", 2);
    const ctx = makeCtx();
    expect(beginImpulseUpkeep(G, ctx, "GE")).toBe(false);
    expect(G.units[only.id].steps).toBe(1);
    expect(G.pending).toBeNull();
  });

  test("the owning player chooses which of several broken-LoC armies loses the step", () => {
    const G = atWar(fresh());
    clearLand(G, "paris");
    const ids = [0, 1, 2].map(() => placeUnit(G, "GE", "army", "paris", 2).id);
    const ctx = makeCtx();
    expect(beginImpulseUpkeep(G, ctx, "GE")).toBe(true);
    expect(G.pending?.kind).toBe("impulseLoss");
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.options.map((o) => o.id).sort()).toEqual([...ids].sort());
    resolvePending(G, ctx, ids[2]);
    expect(G.units[ids[2]].steps).toBe(1);
    expect(G.units[ids[0]].steps).toBe(2);
    expect(G.units[ids[1]].steps).toBe(2);
  });

  test("the penalty does not fire twice for one impulse", () => {
    const G = atWar(fresh());
    clearLand(G, "paris");
    const only = placeUnit(G, "GE", "army", "paris", 2);
    const ctx = makeCtx();
    beginImpulseUpkeep(G, ctx, "GE");
    expect(G.units[only.id].steps).toBe(1);
    beginImpulseUpkeep(G, ctx, "GE");
    expect(G.units[only.id].steps).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 5.6.2 (2) -1 land battle modifier
// ---------------------------------------------------------------------------

describe("5.6.2 broken-LoC battle modifier", () => {
  test("a broken-LoC attacker suffers -1", () => {
    const G = atWar(fresh());
    clearLand(G, "paris");
    clearLand(G, "picardy");
    placeUnit(G, "GE", "army", "paris", 2);
    placeUnit(G, "FR", "army", "picardy", 2);
    const battle = beginLandBattle(G, makeCtx([3, 3]), "GE", "paris", "picardy");
    expect(battle).not.toBeNull();
    expect(battle!.attackerDrm).toBe(-1);
    expect(battle!.notes).toContain("brokenLocAttacker");
  });

  test("a broken-LoC defender suffers -1", () => {
    const G = atWar(fresh());
    clearLand(G, "saxony");
    placeUnit(G, "FR", "army", "saxony", 2);
    const battle = beginLandBattle(G, makeCtx([3, 3]), "GE", "berlin", "saxony");
    expect(battle).not.toBeNull();
    expect(battle!.defenderDrm).toBe(-1);
    expect(battle!.notes).toContain("brokenLocDefender");
  });

  test("an in-supply force gets no modifier", () => {
    const G = atWar(fresh());
    clearLand(G, "saxony");
    placeUnit(G, "FR", "army", "saxony", 2);
    const battle = beginLandBattle(G, makeCtx([3, 3]), "GE", "berlin", "saxony");
    expect(battle!.notes).not.toContain("brokenLocAttacker");
    // Berlin is a supply source with a LoC, so the attacker keeps its DRM.
    expect(battle!.attackerDrm).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5.6.2 (3) no support with a broken LoC
// ---------------------------------------------------------------------------

describe("5.6.2 broken LoCs cannot support", () => {
  test("support candidates from enemy ground with no LoC are removed", () => {
    const G = atWar(fresh());
    clearLand(G, "paris");
    clearLand(G, "picardy");
    clearLand(G, "champagne");
    clearLand(G, "burgundy");
    placeUnit(G, "GE", "army", "paris", 2);
    placeUnit(G, "GE", "army", "champagne", 2);
    placeUnit(G, "GE", "army", "burgundy", 2);
    placeUnit(G, "FR", "army", "picardy", 2);
    const battle = beginLandBattle(G, makeCtx([3, 3]), "GE", "paris", "picardy")!;
    expect(battle.amphibious).toBeFalsy();
    const spaces = supportCandidates(G, "GE", battle, "attacker").map((entry) => entry.space);
    expect(spaces).not.toContain("champagne");
    expect(spaces).not.toContain("burgundy");
    expect(brokenLoc(G, "GE", "champagne")).toBe(true);
  });

  test("an in-supply supporting army is still offered", () => {
    const G = atWar(fresh());
    clearLand(G, "saxony");
    clearLand(G, "prussia");
    placeUnit(G, "GE", "army", "prussia", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    const battle = beginLandBattle(G, makeCtx([3, 3]), "GE", "berlin", "saxony")!;
    const spaces = supportCandidates(G, "GE", battle, "attacker").map((entry) => entry.space);
    expect(spaces).toContain("prussia");
  });
});

// ---------------------------------------------------------------------------
// 5.6.3 peacetime displacement
// ---------------------------------------------------------------------------

describe("5.6.3 peacetime broken LoCs displace", () => {
  test("a broken-LoC army is displaced to a friendly space with a LoC without losing a step", () => {
    const G = fresh();
    clearLand(G, "paris");
    const unit = placeUnit(G, "GE", "army", "paris", 2);
    expect(beginImpulseUpkeep(G, makeCtx(), "GE")).toBe(false);
    expect(G.units[unit.id].steps).toBe(2);
    const space = G.units[unit.id].space!;
    expect(space).not.toBe("paris");
    expect(friendlySpace(G, space, "GE")).toBe(true);
    expect(hasLoc(G, "GE", space)).toBe(true);
  });

  test("no displacement target leaves the unit in place", () => {
    const G = fresh();
    clearLand(G, "paris");
    // Cut Germany off: no space is friendly to it any more.
    for (const state of Object.values(G.spaces)) {
      state.control = "FR";
      state.occupiedBy = null;
      state.ally = null;
      state.influence = null;
      state.homeOverride = null;
    }
    const unit = placeUnit(G, "GE", "army", "paris", 2);
    expect(beginImpulseUpkeep(G, makeCtx(), "GE")).toBe(false);
    expect(G.units[unit.id].space).toBe("paris");
    expect(G.units[unit.id].steps).toBe(2);
  });
});
