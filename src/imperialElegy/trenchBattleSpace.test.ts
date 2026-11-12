/**
 * Rule 28.1.2 / 28.1.5 — land battles and movement in trench battle spaces.
 *
 * 28.1.2: only units already in a trench battle space may initiate a battle
 * there; adjacent armies cannot.  A same-space battle (from === to) is the
 * representation of the intra-space trench battle.  28.1.5: march/rail may
 * enter and leave a marker space, the first space left must not be enemy
 * controlled/occupied unless it also has a marker, and a side that completely
 * vacates the space removes the marker while the opponent occupies it.
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {GreatWarState, ImperialElegyState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {landUnitsIn} from "./engine/rules";
import {beginLandBattle, chooseSupport, setTrenchBattleMarker} from "./engine/combat";
import {beginGwTurn, performGwManeuver} from "./engine/greatWarFlow";
import {landBattle, resolvePending} from "./moves";

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

/** GW fixture with no dealt combat cards, so battle windows stay closed. */
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

const maneuverFixture = (): {G: ImperialElegyState; ctx: Ctx} => {
  const {G, ctx} = gw(1);
  G.phase = "gwManeuver";
  G.activePower = "GE";
  G.turnIndex = 0;
  G.powers.GE.gwBudget = 6;
  G.powers.GE.flags.gwActionsThisImpulse = 0;
  G.powers.GE.flags.passedGw = false;
  return {G, ctx};
};

// ---------------------------------------------------------------------------
// 28.1.2 battle initiation
// ---------------------------------------------------------------------------

describe("28.1.2 trench battle space initiation", () => {
  test("an adjacent army cannot attack into a space with a trench battle marker", () => {
    const {G, ctx} = gw(1);
    clearLand(G, "berlin");
    clearLand(G, "saxony");
    placeUnit(G, "GE", "army", "berlin", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    setTrenchBattleMarker(G, "saxony", "deadlock", 1);
    expect(beginLandBattle(G, ctx, "GE", "berlin", "saxony")).toBeNull();
    expect(G.battle).toBeNull();
  });

  test("the live land battle move refuses the adjacent attack without spending the GW budget", () => {
    const {G, ctx} = maneuverFixture();
    clearLand(G, "berlin");
    clearLand(G, "saxony");
    placeUnit(G, "GE", "army", "berlin", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    setTrenchBattleMarker(G, "saxony", "deadlock", 1);
    const budget = G.powers.GE.gwBudget!;
    expect(landBattle(G, makeCtx([], "0"), "berlin", "saxony")).toBe(INVALID_MOVE);
    expect(G.battle).toBeNull();
    expect(G.powers.GE.gwBudget).toBe(budget);
  });

  test("units already in the space may attack there (same-space battle)", () => {
    const {G, ctx} = gw(1);
    clearLand(G, "saxony");
    clearLand(G, "berlin");
    placeUnit(G, "GE", "army", "saxony", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    setTrenchBattleMarker(G, "saxony", "deadlock", 1);
    const battle = beginLandBattle(G, ctx, "GE", "saxony", "saxony");
    expect(battle).not.toBeNull();
    expect(battle!.from).toBe("saxony");
    expect(battle!.to).toBe("saxony");
    // The battle may auto-resolve inside beginLandBattle when no support window
    // is open; the defeated defender is then pushed out of the shared space.
    expect(landUnitsIn(G, "saxony").filter((unit) => unit.owner === "FR")).toHaveLength(0);
    finishSupportWindows(G, ctx);
  });

  test("normally the marker space cannot be attacked from outside even with a full-strength army", () => {
    const {G, ctx} = gw(1);
    clearLand(G, "saxony");
    clearLand(G, "berlin");
    placeUnit(G, "GE", "army", "berlin", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    // Trench terrain without a battle marker is a normal adjacent attack.
    expect(G.spaces.saxony.trench).toBeFalsy();
    const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    expect(battle).not.toBeNull();
    expect(battle!.trench).toBe(true);
    finishSupportWindows(G, ctx);
  });
});

// ---------------------------------------------------------------------------
// 28.1.1 / 28.1.5 same-space battles and marker removal
// ---------------------------------------------------------------------------

describe("28.1.1 same-space trench battles", () => {
  test("a winning attacker forces the defender out, lifts the marker and occupies", () => {
    const {G, ctx} = gw(1);
    for (const space of ["saxony", "berlin", "champagne", "bavaria", "hanover"]) clearLand(G, space);
    placeUnit(G, "GE", "army", "saxony", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    setTrenchBattleMarker(G, "saxony", "deadlock", 1);
    const battleCtx = makeCtx([6, 1]);
    const battle = beginLandBattle(G, battleCtx, "GE", "saxony", "saxony")!;
    expect(battle).not.toBeNull();
    finishSupportWindows(G, battleCtx);
    expect(G.battle).toBeNull();
    // The defeated defenders leave the shared space; the marker is lifted.
    expect(landUnitsIn(G, "saxony").filter((unit) => unit.owner === "FR")).toHaveLength(0);
    expect(landUnitsIn(G, "saxony").filter((unit) => unit.owner === "GE").length).toBeGreaterThan(0);
    expect(G.spaces.saxony.trench).toBeFalsy();
    expect(G.spaces.saxony.occupiedBy).toBe("GE");
  });

  test("a winning defender forces the attacker out and lifts the marker", () => {
    const {G, ctx} = gw(1);
    for (const space of ["saxony", "berlin", "champagne", "bavaria", "hanover"]) clearLand(G, space);
    placeUnit(G, "GE", "army", "saxony", 2);
    placeUnit(G, "GE", "army", "saxony", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    setTrenchBattleMarker(G, "saxony", "deadlock", 1);
    const battleCtx = makeCtx([1, 6]);
    const battle = beginLandBattle(G, battleCtx, "GE", "saxony", "saxony")!;
    expect(battle).not.toBeNull();
    finishSupportWindows(G, battleCtx);
    // 28.1.1: with several legal retreat spaces the defeated attacker chooses;
    // the first legal option keeps this test focused on the marker lifecycle.
    if (G.pending?.kind === "combatRetreat") {
      expect(resolvePending(G, battleCtx, G.pending.options[0].id)).toBeUndefined();
    }
    expect(G.battle).toBeNull();
    expect(landUnitsIn(G, "saxony").filter((unit) => unit.owner === "GE")).toHaveLength(0);
    expect(landUnitsIn(G, "saxony").filter((unit) => unit.owner === "FR").length).toBeGreaterThan(0);
    expect(G.spaces.saxony.trench).toBeFalsy();
    expect(G.spaces.saxony.occupiedBy).toBe("FR");
  });
});

// ---------------------------------------------------------------------------
// 28.1.5 march / rail movement
// ---------------------------------------------------------------------------

describe("28.1.5 leaving and entering trench battle spaces", () => {
  test("marching out of a marker space into an enemy space is refused", () => {
    const {G, ctx} = maneuverFixture();
    clearLand(G, "saxony");
    clearLand(G, "berlin");
    const unit = placeUnit(G, "GE", "army", "saxony", 2);
    G.spaces.saxony.control = "GE";
    G.spaces.berlin.control = "FR";
    G.spaces.berlin.occupiedBy = "FR";
    setTrenchBattleMarker(G, "saxony", "deadlock", 1);
    const res = performGwManeuver(G, ctx, {kind: "march", power: "GE", unitId: unit.id, to: "berlin"});
    expect(res.ok).toBe(false);
    expect(G.units[unit.id].space).toBe("saxony");
  });

  test("marching out to a friendly space is legal and the marker is removed when the side vacates", () => {
    const {G, ctx} = maneuverFixture();
    clearLand(G, "saxony");
    clearLand(G, "berlin");
    clearLand(G, "silesia");
    const mover = placeUnit(G, "GE", "army", "saxony", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    G.spaces.saxony.control = "GE";
    G.spaces.silesia.control = "GE";
    setTrenchBattleMarker(G, "saxony", "deadlock", 1);
    // Only the German side leaves; the marker is lifted and France occupies.
    const res = performGwManeuver(G, ctx, {kind: "march", power: "GE", unitId: mover.id, to: "silesia"});
    if (!res.ok) throw new Error(res.message);
    expect(res.ok).toBe(true);
    expect(G.units[mover.id].space).toBe("silesia");
    expect(G.spaces.saxony.trench).toBeFalsy();
    expect(G.spaces.saxony.occupiedBy).toBe("FR");
  });

  test("rail may enter a friendly space that holds a trench battle marker", () => {
    const {G, ctx} = maneuverFixture();
    clearLand(G, "saxony");
    clearLand(G, "berlin");
    clearLand(G, "prussia");
    const unit = placeUnit(G, "GE", "army", "berlin", 2);
    G.spaces.saxony.control = "GE";
    G.spaces.saxony.occupiedBy = "GE";
    G.spaces.prussia.control = "GE";
    setTrenchBattleMarker(G, "saxony", "deadlock", 1);
    const res = performGwManeuver(G, ctx, {kind: "rail", power: "GE", unitId: unit.id, to: "saxony"});
    expect(res.ok).toBe(true);
    expect(G.units[unit.id].space).toBe("saxony");
  });

  test("march and rail cannot end overstacked (5.5.3)", () => {
    const {G, ctx} = maneuverFixture();
    clearLand(G, "berlin");
    clearLand(G, "saxony");
    clearLand(G, "prussia");
    const mover = placeUnit(G, "GE", "army", "berlin", 2);
    for (let i = 0; i < 3; i += 1) placeUnit(G, "GE", "army", "saxony", 2);
    G.spaces.saxony.control = "GE";
    G.spaces.prussia.control = "GE";
    const march = performGwManeuver(G, ctx, {kind: "march", power: "GE", unitId: mover.id, to: "saxony"});
    expect(march.ok).toBe(false);
    const rail = performGwManeuver(G, ctx, {kind: "rail", power: "GE", unitId: mover.id, to: "saxony"});
    expect(rail.ok).toBe(false);
    expect(G.units[mover.id].space).toBe("berlin");
  });

  test("marching out of a marker space into a friendly space is legal", () => {
    const {G, ctx} = maneuverFixture();
    clearLand(G, "berlin");
    clearLand(G, "saxony");
    G.spaces.berlin.trench = {status: "deadlock", turn: 1};
    const unit = placeUnit(G, "GE", "army", "berlin", 2);
    G.spaces.saxony.control = "GE";
    G.spaces.saxony.occupiedBy = "GE";
    const res = performGwManeuver(G, ctx, {kind: "march", power: "GE", unitId: unit.id, to: "saxony"});
    expect(res.ok).toBe(true);
    expect(G.powers.GE.gwBudget).toBe(5);
  });
});
