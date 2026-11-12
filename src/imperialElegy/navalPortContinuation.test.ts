/**
 * Rule 19.8 — "After the loser retreats, if the active player won the naval
 * battle, the active player may move any of their units that participated in
 * the naval battle (including an accompanying land unit) into an adjacent
 * friendly port space(s)."
 *
 * This is a *port-only* continuation, distinct from 19.1's "finish the
 * interrupted naval movement" (which may also end in a naval box).  When both
 * apply the port choice comes first: moving into a port finishes the action,
 * while staying at sea hands over to the 19.1 continuation.
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {navalUnitsIn} from "./engine/rules";
import {beginNavalBattle, finishBattle} from "./engine/combat";
import {navalMove, resolvePending} from "./moves";

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

const clearNaval = (G: ImperialElegyState): void => {
  for (const unit of Object.values(G.units)) if (unit.naval) removeUnit(G, unit.id);
};

/** UK (seat 1) at war with FR; both fleets in the North Atlantic box. */
const boxBattle = (): {G: ImperialElegyState; ctx: Ctx; uk: string; army: string} => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = "UK";
  G.turnIndex = 0;
  G.passed = [];
  G.pending = null;
  G.pendingStack = [];
  G.battle = null;
  G.cpRemaining = 6;
  G.war = warState("UK", "FR");
  for (const power of POWERS) {
    G.powers[power].hand = [];
    G.powers[power].gwCard = null;
  }
  clearNaval(G);
  placeUnit(G, "FR", "squadron", "north-atlantic", 2);
  // Hold the battle at the pre-dice card window.
  G.powers.UK.hand = ["IE-A061"];
  const uk = placeUnit(G, "UK", "squadron", "north-atlantic", 2).id;
  const army = placeUnit(G, "UK", "army", "north-atlantic", 2).id;
  return {G, ctx: makeCtx([], seat("UK")), uk, army};
};

/** Start the battle, skip the card window and give the attacker the win. */
const winBattle = (G: ImperialElegyState, ctx: Ctx, winner: "attacker" | "defender") => {
  const battle = beginNavalBattle(G, ctx, "UK", "north-atlantic", "north-atlantic");
  if (!battle) throw new Error("naval battle did not start");
  G.pending = null;
  battle.winner = winner;
  battle.attackerLosses = 0;
  battle.defenderLosses = 0;
  finishBattle(G, ctx);
  return battle;
};

describe("19.8 port-only continuation", () => {
  test("a won naval battle offers only adjacent friendly ports (never a box)", () => {
    const {G, ctx} = boxBattle();
    winBattle(G, ctx, "attacker");
    expect(G.battle).toBeNull();
    expect(G.pending?.kind).toBe("navalPortContinuation");
    expect(G.pending?.power).toBe("UK");
    const ids = G.pending!.options.map((option) => option.id);
    expect(ids).toContain("stay");
    expect(ids).toContain("london");
    // The general 19.1 continuation is separate; this decision is port-only.
    expect(ids).not.toContain("baltic-sea");
    expect(ids).not.toContain("western-mediterranean");
    expect(ids).not.toContain("south-atlantic");
  });

  test("moving into a port also carries the accompanying land unit", () => {
    const {G, ctx, uk, army} = boxBattle();
    winBattle(G, ctx, "attacker");
    expect(G.pending?.context?.unitIds).toEqual(expect.arrayContaining([uk, army]));
    expect(resolvePending(G, makeCtx([], seat("UK")), "london")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.battle).toBeNull();
    expect(G.units[uk].space).toBe("london");
    expect(G.units[army].space).toBe("london");
    expect(G.log.some((entry) => entry.key === "navalPortContinuation" && entry.args?.to === "london")).toBe(true);
    // The port move ends the action: the 19.1 continuation is consumed.
    expect(G.navalContinuation).toBeNull();
  });

  test("staying at sea keeps the fleet in the box", () => {
    const {G, ctx, uk, army} = boxBattle();
    winBattle(G, ctx, "attacker");
    expect(resolvePending(G, makeCtx([], seat("UK")), "stay")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.units[uk].space).toBe("north-atlantic");
    expect(G.units[army].space).toBe("north-atlantic");
    expect(G.navalContinuation).toBeNull();
    expect(G.log.some((entry) => entry.key === "navalPortContinuation" && entry.args?.stopped === true)).toBe(true);
  });

  test("only the active winner decides", () => {
    const {G, ctx} = boxBattle();
    winBattle(G, ctx, "attacker");
    expect(G.pending?.kind).toBe("navalPortContinuation");
    expect(resolvePending(G, makeCtx([], seat("FR")), "london")).toBe(INVALID_MOVE);
    expect(resolvePending(G, makeCtx([], seat("FR")), "stay")).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("navalPortContinuation");
  });

  test("a lost naval battle offers no port continuation", () => {
    const {G, ctx} = boxBattle();
    winBattle(G, ctx, "defender");
    expect(G.pending?.kind).not.toBe("navalPortContinuation");
    expect(G.navalContinuation).toBeNull();
  });

  test("a port-battle victory displaces the attackers to sea and offers no 19.8 move", () => {
    const G = setupImperialElegy(makeCtx());
    G.phase = "action";
    G.activePower = "UK";
    G.pending = null;
    G.pendingStack = [];
    G.battle = null;
    G.cpRemaining = 6;
    G.war = warState("UK", "FR");
    for (const power of POWERS) {
      G.powers[power].hand = [];
      G.powers[power].gwCard = null;
    }
    clearNaval(G);
    G.spaces.brittany.control = "FR";
    placeUnit(G, "FR", "squadron", "brittany", 2);
    placeUnit(G, "UK", "squadron", "north-atlantic", 2);
    G.powers.UK.hand = ["IE-A061"];
    const ctx = makeCtx([], seat("UK"));
    const battle = beginNavalBattle(G, ctx, "UK", "north-atlantic", "brittany");
    if (!battle) throw new Error("naval battle did not start");
    G.pending = null;
    battle.winner = "attacker";
    battle.attackerLosses = 0;
    battle.defenderLosses = 0;
    finishBattle(G, ctx);
    // 19.9: the victors displace back to the box they attacked from, and 19.8
    // is the post-battle move of a naval-box fight (not a second displacement).
    expect(navalUnitsIn(G, "north-atlantic").some((unit) => unit.owner === "UK")).toBe(true);
    expect(G.pending?.kind).not.toBe("navalPortContinuation");
  });

  test("after an interception win the port move pre-empts the 19.1 continuation", () => {
    const G = setupImperialElegy(makeCtx());
    G.phase = "action";
    G.activePower = "UK";
    G.pending = null;
    G.pendingStack = [];
    G.battle = null;
    G.cpRemaining = 6;
    G.war = warState("UK", "FR");
    for (const power of POWERS) {
      G.powers[power].hand = [];
      G.powers[power].gwCard = null;
    }
    clearNaval(G);
    for (const space of ["north-atlantic", "brittany", "london", "western-mediterranean"]) {
      for (const unit of [...navalUnitsIn(G, space)]) removeUnit(G, unit.id);
    }
    placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const ship = placeUnit(G, "UK", "squadron", "london", 2).id;
    expect(navalMove(G, makeCtx([], seat("UK")), [ship], "north-atlantic")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalInterception");
    expect(resolvePending(G, makeCtx([5, 6, 1], seat("FR")), "intercept:brittany")).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(G.pending?.kind).toBe("navalPortContinuation");
    expect(G.pending?.context?.continuation).toBe(true);
    // Moving into London finishes the interrupted move: no 19.1 decision after.
    expect(resolvePending(G, makeCtx([], seat("UK")), "london")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.navalContinuation).toBeNull();
    expect(G.units[ship].space).toBe("london");
    expect(G.log.some((entry) => entry.key === "navalContinuation")).toBe(false);
  });
});
