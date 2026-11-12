import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {SPACES} from "./constant/spaces";
import {
  beginImpulseUpkeep,
  landUnitsIn,
  navalUnitsIn,
} from "./engine/rules";
import {
  beginLandBattle,
  chooseSupport,
  nextTrenchStatus,
  supportCandidates,
} from "./engine/combat";
import {COMBAT_CARD_BY_ID, applyCombatCardToBattle} from "./engine/combatCards";
import {beginGwTurn, performGwManeuver} from "./engine/greatWarFlow";

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

const gwState = (turn: number): GreatWarState => ({
  active: true,
  turn,
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
  combatCardsInFront: [],
});

const clearLand = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...landUnitsIn(G, space)]) removeUnit(G, unit.id);
};

const clearNaval = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...navalUnitsIn(G, space)]) removeUnit(G, unit.id);
};

/** GW fixture without any dealt combat cards, so battle windows stay closed. */
const gw = (turn: number): {G: ImperialElegyState; ctx: Ctx} => {
  const G = fresh();
  G.gw = gwState(turn);
  G.phase = "gwPlanning";
  const ctx = makeCtx([6, 1, 3]);
  beginGwTurn(G, ctx);
  for (const power of POWERS) G.powers[power].gwCard = null;
  G.gw.combatCardsInFront = [];
  G.flags.gwFaceupCombat = "";
  return {G, ctx};
};

const finishSupportWindows = (G: ImperialElegyState, ctx: Ctx): void => {
  let guard = 0;
  while (G.pending?.kind === "combatSupport" && guard++ < 6) chooseSupport(G, ctx, "done");
};

// ---------------------------------------------------------------------------
// 28.1 creation
// ---------------------------------------------------------------------------

describe("28.1 trench creation", () => {
  test("no trenches on GW turn 0", () => {
    const {G} = gw(0);
    expect(G.spaces.berlin.trenchLine).toBeFalsy();
    expect(G.spaces.paris.trenchLine).toBeFalsy();
    expect(Object.keys(G.gw!.trenches)).toHaveLength(0);
  });

  test("every key contains a trench at the start of GW turn 1", () => {
    const {G} = gw(1);
    const isPrintedKey = (type: string): boolean => type === "key" || type === "capital" || type === "subcapital";
    const keys = Object.values(SPACES).filter((def) => isPrintedKey(def.type));
    expect(keys.length).toBeGreaterThan(10);
    for (const def of keys) expect(G.spaces[def.id].trenchLine).toBe(true);
    const nonKey = Object.values(SPACES).find((def) => def.type === "territory" || def.type === "navalBase")!;
    expect(G.spaces[nonKey.id].trenchLine).toBeFalsy();
    expect(G.gw!.trenches.berlin).toBeDefined();
    expect(G.gw!.trenches.paris).toBeDefined();
  });

  test("re-entering planning keeps an existing trench battle marker", () => {
    const {G, ctx} = gw(1);
    G.spaces.berlin.trench = {status: "attacker", turn: 1};
    G.gw!.trenches.berlin = "attacker";
    beginGwTurn(G, ctx);
    expect(G.spaces.berlin.trenchLine).toBe(true);
    expect(G.spaces.berlin.trench?.status).toBe("attacker");
    expect(G.gw!.trenches.berlin).toBe("attacker");
  });
});

// ---------------------------------------------------------------------------
// 28.1 attack requirements and extra loss
// ---------------------------------------------------------------------------

describe("28.1 trench attacks", () => {
  test("only a full-strength army may attack a trench space", () => {
    const {G, ctx} = gw(1);
    clearLand(G, "berlin");
    clearLand(G, "saxony");
    placeUnit(G, "FR", "army", "saxony", 2);
    const reduced = placeUnit(G, "GE", "army", "berlin", 1);
    expect(beginLandBattle(G, ctx, "GE", "berlin", "saxony")).toBeNull();
    removeUnit(G, reduced.id);
    placeUnit(G, "GE", "army", "berlin", 2);
    const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    expect(battle).not.toBeNull();
    expect(battle!.trench).toBe(true);
    finishSupportWindows(G, ctx);
  });

  test("the attacker suffers one additional step loss", () => {
    const {G, ctx} = gw(1);
    clearLand(G, "berlin");
    clearLand(G, "saxony");
    placeUnit(G, "GE", "army", "berlin", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    const battleCtx = makeCtx([6, 1]);
    const battle = beginLandBattle(G, battleCtx, "GE", "berlin", "saxony")!;
    finishSupportWindows(G, battleCtx);
    // Deterministic dice 6 vs 1: differential 5 -> no CRT attacker loss, +1 trench.
    expect(battle.attackerLosses).toBe(1);
    expect(battle.defenderLosses).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 28.1.1 trench battle marker lifecycle
// ---------------------------------------------------------------------------

describe("28.1.1 trench battle marker", () => {
  test("a successful attack places an attacker-advantage marker, keeps the defender and advances", () => {
    const {G, ctx} = gw(1);
    clearLand(G, "berlin");
    clearLand(G, "saxony");
    const attacker = placeUnit(G, "GE", "army", "berlin", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    const battleCtx = makeCtx([6, 1]);
    const battle = beginLandBattle(G, battleCtx, "GE", "berlin", "saxony")!;
    finishSupportWindows(G, battleCtx);
    expect(G.battle).toBeNull();
    expect(G.spaces.saxony.trench?.status).toBe("attacker");
    // The defender was not forced out; the attacker advanced into the space.
    expect(landUnitsIn(G, "saxony").filter((u) => u.owner === "FR").length).toBeGreaterThan(0);
    expect(G.units[attacker.id].space).toBe("saxony");
    // 28.1.4: decisive battles in a trench battle have no follow-up.
    expect(G.flags.decisiveFollowUp).toBeUndefined();
  });

  test("28.1.1 status lifecycle: winning keeps the advantage, losing it deadlocks", () => {
    expect(nextTrenchStatus("deadlock", "attacker")).toBe("attacker");
    expect(nextTrenchStatus("attacker", "attacker")).toBe("attacker");
    expect(nextTrenchStatus("defender", "attacker")).toBe("deadlock");
    expect(nextTrenchStatus("attacker", "defender")).toBe("deadlock");
    expect(nextTrenchStatus("defender", "defender")).toBe("defender");
    expect(nextTrenchStatus("deadlock", "defender")).toBe("defender");
  });

  test("28.1.5 a side vacating the space removes the marker and the other side occupies", () => {
    const {G, ctx} = gw(1);
    clearLand(G, "berlin");
    clearLand(G, "saxony");
    // 28.1.2: a marker space is only attacked from inside it, so the losing
    // attacker starts in Saxony with the defender.
    placeUnit(G, "GE", "army", "saxony", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    G.spaces.saxony.trench = {status: "attacker", turn: 1};
    G.gw!.trenches.saxony = "attacker";
    const losingCtx = makeCtx([1, 6]);
    const battle = beginLandBattle(G, losingCtx, "GE", "saxony", "saxony")!;
    finishSupportWindows(G, losingCtx);
    expect(G.battle).toBeNull();
    // The attack failed and was wiped out; the defender holds the space.
    expect(landUnitsIn(G, "saxony").filter((u) => u.owner === "FR").length).toBeGreaterThan(0);
    // Only the defender remains in the space, so the marker is lifted (28.1.5)
    // and the surviving side occupies it.
    expect(G.spaces.saxony.trench).toBeFalsy();
    expect(G.spaces.saxony.occupiedBy).toBe("FR");
    expect(G.gw!.trenches.saxony).toBeUndefined();
  });

  test("GW-03/GW-04 still cancel the trench and its extra loss", () => {
    const {G, ctx} = gw(3);
    clearLand(G, "berlin");
    clearLand(G, "saxony");
    placeUnit(G, "GE", "army", "berlin", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    const battleCtx = makeCtx([6, 1]);
    const battle = beginLandBattle(G, battleCtx, "GE", "berlin", "saxony")!;
    expect(battle.trench).toBe(true);
    const cancelled = applyCombatCardToBattle(battle, COMBAT_CARD_BY_ID["IE-GW-04"], 3);
    expect(cancelled.trench).toBe(false);
    expect(cancelled.notes).toContain("cancelTrenches");
    finishSupportWindows(G, battleCtx);
  });
});

// ---------------------------------------------------------------------------
// 28.1.3 support halving only inside a trench battle
// ---------------------------------------------------------------------------

describe("28.1.3 trench battle support halving", () => {
  test("terrain alone does not halve adjacent support; a trench battle marker does", () => {
    const {G, ctx} = gw(1);
    clearLand(G, "berlin");
    clearLand(G, "saxony");
    clearLand(G, "prussia");
    placeUnit(G, "GE", "army", "berlin", 2);
    placeUnit(G, "GE", "army", "prussia", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    const battleCtx = makeCtx([6, 1]);
    const battle = beginLandBattle(G, battleCtx, "GE", "berlin", "saxony")!;
    const terrain = supportCandidates(G, "GE", battle, "attacker");
    expect(terrain.map((entry) => entry.space)).toContain("prussia");
    // Prussia has a trench line (all keys do) but no trench battle marker.
    expect(G.spaces.prussia.trenchLine).toBe(true);
    expect(G.spaces.prussia.trench).toBeFalsy();
    expect(terrain.find((entry) => entry.space === "prussia")!.fp).toBe(2);
    // A trench battle marker halves the supporting FP once (18.3.2/28.1.3).
    G.spaces.prussia.trench = {status: "deadlock", turn: 1};
    const withMarker = supportCandidates(G, "GE", battle, "attacker");
    expect(withMarker.find((entry) => entry.space === "prussia")!.fp).toBe(1);
    finishSupportWindows(G, battleCtx);
  });
});

// ---------------------------------------------------------------------------
// 27.5.2 draft exclusion
// ---------------------------------------------------------------------------

describe("27.5.2 drafts and trench battle markers", () => {
  const draftFixture = () => {
    const {G, ctx} = gw(1);
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.turnIndex = 0;
    G.powers.GE.gwBudget = 4;
    G.powers.GE.manpower = 4;
    G.powers.GE.flags.gwActionsThisImpulse = 0;
    G.powers.GE.flags.passedGw = false;
    return {G, ctx};
  };

  test("a draft cannot be placed in a space with a trench battle marker", () => {
    const {G, ctx} = draftFixture();
    G.spaces.berlin.trench = {status: "attacker", turn: 1};
    const res = performGwManeuver(G, ctx, {kind: "draft", power: "GE", space: "berlin"});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalidTarget");
  });

  test("a draft is legal without a trench battle marker", () => {
    const {G, ctx} = draftFixture();
    const res = performGwManeuver(G, ctx, {kind: "draft", power: "GE", space: "berlin"});
    expect(res.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5.5.3/5.6.2 wiring sanity for the GW impulse-start hook
// ---------------------------------------------------------------------------

test("the GW impulse start runs the shared upkeep", () => {
  const {G, ctx} = gw(1);
  clearLand(G, "paris");
  const army = placeUnit(G, "GE", "army", "paris", 2);
  G.phase = "gwManeuver";
  G.activePower = "FR";
  G.turnIndex = 1;
  beginImpulseUpkeep(G, ctx, "GE");
  expect(G.units[army.id].steps).toBe(1);
});
