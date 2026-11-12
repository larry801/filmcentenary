/**
 * 5.5.3 / 5.5.4 — movement-end stacking.
 *
 * "Stacking can be violated during movement, but units cannot end their
 * movement overstacked."  These tests cover the live movement paths that were
 * previously unchecked: wartime redeploy, GW march/rail and naval move (port
 * capacity of four), plus the pass-through/source exception.
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {GreatWarState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {addReserve, placeUnit, removeUnit} from "./engine/effects";
import {
  landUnitsIn,
  movementEndProblem,
  navalUnitsIn,
  PORT_NAVAL_LIMIT,
} from "./engine/rules";
import {beginGwTurn, performGwManeuver} from "./engine/greatWarFlow";
import {navalMove, redeploy, resolvePending, tsrrRailMove} from "./moves";

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

const seat = (power: Power): string => String(POWERS.indexOf(power));

const clearLand = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...landUnitsIn(G, space)]) removeUnit(G, unit.id);
};

const clearNaval = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...navalUnitsIn(G, space)]) removeUnit(G, unit.id);
};

const warState = (attacker: Power, defender: Power): ImperialElegyState["war"] => ({
  attacker,
  defender,
  attackerAllies: [],
  defenderAllies: [],
  attackerMinors: [],
  defenderMinors: [],
  warAim: "conquest",
  objectives: [],
  status: "maneuver",
  budgets: {[attacker]: 6},
  initiative: [],
  treaties: [],
  victor: null,
  truceTurns: 2,
  passed: [],
  startedTurn: 1,
} as unknown as ImperialElegyState["war"]);

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

const gw = (): {G: ImperialElegyState; ctx: Ctx} => {
  const G = fresh();
  G.gw = gwState(1);
  G.phase = "gwPlanning";
  const ctx = makeCtx([6, 1, 3]);
  beginGwTurn(G, ctx);
  for (const power of POWERS) G.powers[power].gwCard = null;
  G.gw.combatCardsInFront = [];
  G.flags.gwFaceupCombat = "";
  G.phase = "gwManeuver";
  G.activePower = "GE";
  G.turnIndex = 0;
  G.powers.GE.gwBudget = 6;
  G.powers.GE.flags.gwActionsThisImpulse = 0;
  G.powers.GE.flags.passedGw = false;
  return {G, ctx};
};

// ---------------------------------------------------------------------------
// Pure validator
// ---------------------------------------------------------------------------

describe("movementEndProblem", () => {
  test("counts only the arriving armies against the land limit", () => {
    const G = fresh();
    clearLand(G, "berlin");
    for (let i = 0; i < 3; i += 1) placeUnit(G, "GE", "army", "berlin", 2);
    const mover = placeUnit(G, "GE", "army", "saxony", 2);
    expect(movementEndProblem(G, "berlin", [mover])).toBe("armyStacking");
    expect(movementEndProblem(G, "berlin", [])).toBeNull();
  });

  test("ECs and EFs never count against the army limit", () => {
    const G = fresh();
    clearLand(G, "berlin");
    for (let i = 0; i < 3; i += 1) placeUnit(G, "GE", "army", "berlin", 2);
    const ec = placeUnit(G, "GE", "eliteCorps", "saxony", 1);
    expect(movementEndProblem(G, "berlin", [ec])).toBeNull();
  });

  test("a port holds four naval units; a box has no limit", () => {
    const G = fresh();
    clearNaval(G, "london");
    for (let i = 0; i < PORT_NAVAL_LIMIT; i += 1) placeUnit(G, "GE", "squadron", "london", 2);
    const ship = placeUnit(G, "GE", "squadron", "north-atlantic", 2);
    expect(movementEndProblem(G, "london", [ship])).toBe("portCapacity");
    clearNaval(G, "north-atlantic");
    for (let i = 0; i < 8; i += 1) placeUnit(G, "GE", "squadron", "north-atlantic", 2);
    expect(movementEndProblem(G, "north-atlantic", [ship])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Wartime redeploy
// ---------------------------------------------------------------------------

describe("redeploy movement-end stacking", () => {
  const redeployFixture = (): ImperialElegyState => {
    const G = fresh();
    G.phase = "wartime";
    G.activePower = "GE";
    G.pending = null;
    G.battle = null;
    G.war = warState("GE", "FR");
    clearLand(G, "berlin");
    clearLand(G, "paris");
    clearLand(G, "istanbul");
    // Friendly destinations for the German mover.
    G.spaces.paris.control = "GE";
    G.spaces.paris.occupiedBy = "GE";
    return G;
  };

  test("a move into a full European key is refused; one with room is allowed", () => {
    const G = redeployFixture();
    const mover = placeUnit(G, "GE", "army", "berlin", 2);
    for (let i = 0; i < 3; i += 1) placeUnit(G, "GE", "army", "paris", 2);
    const ctx = makeCtx([], seat("GE"));
    expect(redeploy(G, ctx, mover.id, "paris")).toBe(INVALID_MOVE);
    expect(G.units[mover.id].space).toBe("berlin");
    removeUnit(G, landUnitsIn(G, "paris")[0].id);
    expect(redeploy(G, ctx, mover.id, "paris")).toBeUndefined();
    expect(G.units[mover.id].space).toBe("paris");
  });

  test("an Ottoman home space ends at two armies", () => {
    const G = redeployFixture();
    G.spaces.istanbul.control = "GE";
    G.spaces.istanbul.occupiedBy = "GE";
    for (let i = 0; i < 2; i += 1) placeUnit(G, "GE", "army", "istanbul", 2);
    const mover = placeUnit(G, "GE", "army", "berlin", 2);
    const ctx = makeCtx([], seat("GE"));
    expect(redeploy(G, ctx, mover.id, "istanbul")).toBe(INVALID_MOVE);
  });

  test("a unit leaving an overstacked source is not blocked (only the destination is checked)", () => {
    const G = redeployFixture();
    for (let i = 0; i < 4; i += 1) placeUnit(G, "GE", "army", "berlin", 2);
    const mover = landUnitsIn(G, "berlin")[3];
    const ctx = makeCtx([], seat("GE"));
    expect(redeploy(G, ctx, mover.id, "paris")).toBeUndefined();
    expect(G.units[mover.id].space).toBe("paris");
  });
});

// ---------------------------------------------------------------------------
// Naval move port capacity
// ---------------------------------------------------------------------------

describe("navalMove movement-end port capacity", () => {
  const navalFixture = (): ImperialElegyState => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "UK";
    G.pending = null;
    G.battle = null;
    G.cpRemaining = 6;
    clearNaval(G, "london");
    clearNaval(G, "north-atlantic");
    return G;
  };

  test("a move into a port already holding four ships is refused", () => {
    const G = navalFixture();
    for (let i = 0; i < PORT_NAVAL_LIMIT; i += 1) placeUnit(G, "UK", "squadron", "london", 2);
    const ship = placeUnit(G, "UK", "squadron", "north-atlantic", 2);
    const ctx = makeCtx([], seat("UK"));
    expect(navalMove(G, ctx, [ship.id], "london")).toBe(INVALID_MOVE);
    expect(G.units[ship.id].space).toBe("north-atlantic");
    removeUnit(G, navalUnitsIn(G, "london")[0].id);
    expect(navalMove(G, ctx, [ship.id], "london")).toBeUndefined();
    expect(G.units[ship.id].space).toBe("london");
  });

  test("a naval box has no limit", () => {
    const G = navalFixture();
    for (let i = 0; i < 8; i += 1) placeUnit(G, "UK", "squadron", "north-atlantic", 2);
    const ship = placeUnit(G, "UK", "squadron", "london", 2);
    expect(navalMove(G, makeCtx([], seat("UK")), [ship.id], "north-atlantic")).toBeUndefined();
    expect(navalUnitsIn(G, "north-atlantic")).toHaveLength(9);
  });

  test("a move leaving an overstacked port is legal", () => {
    const G = navalFixture();
    for (let i = 0; i < 5; i += 1) placeUnit(G, "UK", "squadron", "london", 2);
    const ship = navalUnitsIn(G, "london")[4];
    expect(navalMove(G, makeCtx([], seat("UK")), [ship.id], "north-atlantic")).toBeUndefined();
    expect(G.units[ship.id].space).toBe("north-atlantic");
  });
});

// ---------------------------------------------------------------------------
// GW maneuver capacity
// ---------------------------------------------------------------------------

describe("GW maneuver movement-end stacking", () => {
  test("a GW naval move into a full port is refused", () => {
    const {G, ctx} = gw();
    G.phase = "gwManeuver";
    clearNaval(G, "pomerania");
    clearNaval(G, "baltic-sea");
    for (let i = 0; i < PORT_NAVAL_LIMIT; i += 1) placeUnit(G, "GE", "squadron", "pomerania", 2);
    const ship = placeUnit(G, "GE", "squadron", "baltic-sea", 2);
    G.spaces.pomerania.control = "GE";
    const blocked = performGwManeuver(G, ctx, {kind: "naval", power: "GE", unitIds: [ship.id], to: "pomerania"});
    expect(blocked.ok).toBe(false);
    expect(G.units[ship.id].space).toBe("baltic-sea");
    removeUnit(G, navalUnitsIn(G, "pomerania")[0].id);
    const allowed = performGwManeuver(G, ctx, {kind: "naval", power: "GE", unitIds: [ship.id], to: "pomerania"});
    if (!allowed.ok) throw new Error(allowed.message);
    expect(allowed.ok).toBe(true);
    expect(G.units[ship.id].space).toBe("pomerania");
  });

  test("a GW rail move into a space with three armies is refused", () => {
    const {G, ctx} = gw();
    clearLand(G, "berlin");
    clearLand(G, "saxony");
    const mover = placeUnit(G, "GE", "army", "berlin", 2);
    for (let i = 0; i < 3; i += 1) placeUnit(G, "GE", "army", "saxony", 2);
    G.spaces.saxony.control = "GE";
    const res = performGwManeuver(G, ctx, {kind: "rail", power: "GE", unitId: mover.id, to: "saxony"});
    expect(res.ok).toBe(false);
    expect(G.units[mover.id].space).toBe("berlin");
  });
});

// ---------------------------------------------------------------------------
// Trans-Siberian Railroad and GW deployment capacity
// ---------------------------------------------------------------------------

describe("other movement-end capacity paths", () => {
  test("a free TSRR rail move cannot end on three armies", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "RU";
    G.pending = null;
    G.battle = null;
    G.cpRemaining = 6;
    G.powers.RU.tsrr = true;
    clearLand(G, "moscow");
    clearLand(G, "urals");
    const mover = placeUnit(G, "RU", "army", "moscow", 2);
    for (let i = 0; i < 3; i += 1) placeUnit(G, "RU", "army", "urals", 2);
    const ctx = makeCtx([], seat("RU"));
    expect(tsrrRailMove(G, ctx, mover.id, "urals")).toBe(INVALID_MOVE);
    expect(G.units[mover.id].space).toBe("moscow");
    removeUnit(G, landUnitsIn(G, "urals")[0].id);
    expect(tsrrRailMove(G, ctx, mover.id, "urals")).toBeUndefined();
    expect(G.units[mover.id].space).toBe("urals");
  });

  test("a GW deploy that would overload the destination is refused", () => {
    const {G, ctx} = gw();
    clearLand(G, "berlin");
    for (let i = 0; i < 3; i += 1) placeUnit(G, "GE", "army", "berlin", 2);
    addReserve(G, "GE", 1);
    const reserve = G.powers.GE.reserves[0];
    const blocked = performGwManeuver(G, ctx, {kind: "deploy", power: "GE", space: "berlin", unitId: reserve});
    expect(blocked.ok).toBe(false);
    expect(G.powers.GE.reserves).toContain(reserve);
    removeUnit(G, landUnitsIn(G, "berlin")[0].id);
    const allowed = performGwManeuver(G, ctx, {kind: "deploy", power: "GE", space: "berlin", unitId: reserve});
    if (!allowed.ok) throw new Error(allowed.message);
    expect(allowed.ok).toBe(true);
    expect(G.units[reserve].space).toBe("berlin");
  });
});

// ---------------------------------------------------------------------------
// 27.5.2 draft placement
// ---------------------------------------------------------------------------

describe("27.5.2 draft split placement", () => {
  const reducedArmies = (G: ImperialElegyState, space: string) =>
    landUnitsIn(G, space).filter((unit) => unit.owner === "GE" && unit.kind === "army" && unit.steps === 1);

  test("a draft places one army, then asks for a different second space", () => {
    const {G, ctx} = gw();
    clearLand(G, "berlin");
    G.powers.GE.manpower = 3;
    G.powers.GE.gwBudget = 3;
    const res = performGwManeuver(G, ctx, {kind: "draft", power: "GE", space: "berlin"});
    expect(res.ok).toBe(true);

    expect(reducedArmies(G, "berlin")).toHaveLength(1);
    expect(G.pending?.kind).toBe("gwDraft");
    expect(G.pending?.power).toBe("GE");
    const options = G.pending!.options.map((entry) => entry.id);
    expect(options).not.toContain("berlin");
    expect(options).toContain("pomerania");

    // The printed "no more than one per space": the first space is not legal.
    expect(resolvePending(G, ctx, "berlin")).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("gwDraft");
    const second = options[0];
    expect(resolvePending(G, ctx, second)).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(reducedArmies(G, second)).toHaveLength(1);
    // The single 1 CP / 1 manpower cost covers both armies.
    expect(G.powers.GE.gwBudget).toBe(2);
    expect(G.powers.GE.manpower).toBe(2);
  });

  test("an overstacked first space refuses the whole draft", () => {
    const {G, ctx} = gw();
    clearLand(G, "berlin");
    for (let i = 0; i < 3; i += 1) placeUnit(G, "GE", "army", "berlin", 2);
    const before = JSON.stringify({budget: G.powers.GE.gwBudget, manpower: G.powers.GE.manpower});
    const res = performGwManeuver(G, ctx, {kind: "draft", power: "GE", space: "berlin"});
    expect(res.ok).toBe(false);
    expect(G.pending).toBeNull();
    expect(JSON.stringify({budget: G.powers.GE.gwBudget, manpower: G.powers.GE.manpower})).toBe(before);
  });

  test("the second space must be trench-free and have room for one army", () => {
    const {G, ctx} = gw();
    clearLand(G, "berlin");
    clearLand(G, "westphalia");
    clearLand(G, "silesia");
    // The occupiers' own counter pools do not matter: 5.5.1 counts every
    // owner's armies in the space.
    for (let i = 0; i < 3; i += 1) placeUnit(G, "FR", "army", "westphalia", 2);
    G.spaces.silesia.trench = {status: "deadlock", turn: 1};
    const res = performGwManeuver(G, ctx, {kind: "draft", power: "GE", space: "berlin"});
    expect(res.ok).toBe(true);
    const options = G.pending!.options.map((entry) => entry.id);
    expect(options).not.toContain("berlin");
    expect(options).not.toContain("westphalia");
    expect(options).not.toContain("silesia");
    expect(options).toContain("pomerania");
  });

  test("no legal second army space still offers EF substitution instead of deadlocking", () => {
    const {G, ctx} = gw();
    for (const space of ["westphalia", "silesia", "pomerania", "prussia"]) {
      clearLand(G, space);
      for (let i = 0; i < 3; i += 1) placeUnit(G, "FR", "army", space, 2);
    }
    clearLand(G, "berlin");
    const res = performGwManeuver(G, ctx, {kind: "draft", power: "GE", space: "berlin"});
    expect(res.ok).toBe(true);
    expect(reducedArmies(G, "berlin")).toHaveLength(1);
    // 27.5.2 lets the second army become an EF.  EFs do not count against army
    // stacking, so the decision can still be offered even when every army space
    // is full; only an exhausted EF pool falls back to the forfeit log.
    if (G.pending === null) {
      expect(G.log.some((entry) => entry.key === "gwDraftSecondForfeited" && entry.args?.reason === "noSpace")).toBe(true);
    } else {
      const ids = G.pending.options.map((entry) => entry.id);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.every((id) => id.startsWith("ef:") || id.startsWith("eliteEf:"))).toBe(true);
    }
  });
});
