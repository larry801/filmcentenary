/**
 * Rule 3.4.1 — the Dardanelles crossing needs the controlling player's
 * permission.  A neutral controller is no longer treated as granting it: the
 * live move opens a `dardanellesPassage` decision (the controller grants or
 * refuses, logged both ways), and the planner keeps the strait closed until a
 * grant exists.  The GW maneuver path uses the same hard gate.
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {createWarState} from "./engine/limitedWar";
import {navalUnitsIn} from "./engine/rules";
import {planNavalMove} from "./engine/navalMovement";
import {performGwManeuver} from "./engine/greatWarFlow";
import {navalMove, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "4"): Ctx => {
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

const clearNaval = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...navalUnitsIn(G, space)]) removeUnit(G, unit.id);
};

/** RU active; the strait is OT-controlled; one RU squadron waits in the Black Sea. */
const straitFixture = (): {G: ImperialElegyState; ship: string} => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = "RU";
  G.passed = [];
  G.pending = null;
  G.battle = null;
  G.cpRemaining = 6;
  G.war = null;
  G.spaces.dardanelles.control = "OT";
  clearNaval(G, "black-sea");
  clearNaval(G, "eastern-mediterranean");
  const ship = placeUnit(G, "RU", "squadron", "black-sea", 2).id;
  return {G, ship};
};

describe("3.4.1 Dardanelles permission", () => {
  test("a neutral controller closes the strait until it grants passage", () => {
    const {G, ship} = straitFixture();
    expect(planNavalMove(G, "RU", "black-sea", "eastern-mediterranean")).toMatchObject({
      ok: false,
      reason: "dardanellesPermission",
    });

    expect(navalMove(G, makeCtx([], seat("RU")), [ship], "eastern-mediterranean")).toBeUndefined();
    // The request is a decision, not an action: no CP is spent and no unit moves.
    expect(G.cpRemaining).toBe(6);
    expect(G.units[ship].space).toBe("black-sea");
    expect(G.pending?.kind).toBe("dardanellesPassage");
    expect(G.pending?.power).toBe("OT");
    expect(G.log.some((entry) => entry.key === "dardanellesPassageRequested")).toBe(true);

    // Only the controller answers.
    expect(resolvePending(G, makeCtx([], seat("RU")), "grant")).toBe(INVALID_MOVE);
    expect(resolvePending(G, makeCtx([], seat("OT")), "grant")).toBeUndefined();
    expect(G.dardanellesPassage).toMatchObject({requesting: "RU", granting: "OT", turn: G.turn});
    expect(G.pending).toBeNull();
    const grantLog = G.log.find((entry) => entry.key === "dardanellesPassage")!;
    expect(grantLog.args?.granted).toBe(true);

    // The mover repeats the same action now that permission exists.
    expect(navalMove(G, makeCtx([], seat("RU")), [ship], "eastern-mediterranean")).toBeUndefined();
    expect(G.units[ship].space).toBe("eastern-mediterranean");
    expect(G.cpRemaining).toBe(5);
  });

  test("a refusal leaves the strait closed", () => {
    const {G, ship} = straitFixture();
    expect(navalMove(G, makeCtx([], seat("RU")), [ship], "eastern-mediterranean")).toBeUndefined();
    expect(resolvePending(G, makeCtx([], seat("OT")), "refuse")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.dardanellesPassage).toBeFalsy();
    expect(G.log.some((entry) => entry.key === "dardanellesPassage" && entry.args?.granted === false)).toBe(true);
    expect(planNavalMove(G, "RU", "black-sea", "eastern-mediterranean")).toMatchObject({
      ok: false,
      reason: "dardanellesPermission",
    });
  });

  test("an enemy controller is never asked and the strait stays closed", () => {
    const {G, ship} = straitFixture();
    G.war = createWarState(G, "RU", "OT", "conquest", ["macedonia"], 2);
    expect(planNavalMove(G, "RU", "black-sea", "eastern-mediterranean")).toMatchObject({
      ok: false,
      reason: "dardanellesDenied",
    });
    expect(navalMove(G, makeCtx([], seat("RU")), [ship], "eastern-mediterranean")).toBe(INVALID_MOVE);
    expect(G.pending).toBeNull();
    expect(G.units[ship].space).toBe("black-sea");
  });

  test("a friendly controller needs no prompt", () => {
    const {G, ship} = straitFixture();
    G.spaces.dardanelles.control = "RU";
    expect(navalMove(G, makeCtx([], seat("RU")), [ship], "eastern-mediterranean")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.units[ship].space).toBe("eastern-mediterranean");
  });

  test("the GW maneuver path uses the same gate", () => {
    const {G, ship} = straitFixture();
    G.gw = {
      active: true,
      turn: 1,
      order: ["RU"],
      belligerents: ["RU"],
      neutrals: ["GE", "UK", "FR", "AU", "OT"],
      te: ["RU"],
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
    G.powers.RU.alliance = "teCommitted";
    G.phase = "gwManeuver";
    G.activePower = "RU";
    G.turnIndex = 0;
    G.powers.RU.gwBudget = 4;

    const denied = performGwManeuver(G, makeCtx(), {kind: "naval", power: "RU", unitIds: [ship], to: "eastern-mediterranean"});
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error).toBe("invalidTarget");
      // The direct GW caller now raises the same 3.4.1 permission decision as
      // the live wrapper (no budget spent while it is open).
      expect(denied.pending).toBe(true);
    }
    expect(G.pending?.kind).toBe("dardanellesPassage");
    expect(G.pending?.power).toBe("OT");
    expect(G.powers.RU.gwBudget).toBe(4);
    expect(G.units[ship].space).toBe("black-sea");
    expect(resolvePending(G, makeCtx([], seat("OT")), "grant")).toBeUndefined();
    expect(G.pending).toBeNull();
    const allowed = performGwManeuver(G, makeCtx(), {kind: "naval", power: "RU", unitIds: [ship], to: "eastern-mediterranean"});
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) throw new Error(allowed.message);
    expect(G.powers.RU.gwBudget).toBe(3);
    expect(G.units[ship].space).toBe("eastern-mediterranean");

    // A grant is scoped to one GW turn (winter advances `G.gw.turn`).
    G.gw.turn = 2;
    expect(planNavalMove(G, "RU", "eastern-mediterranean", "black-sea")).toMatchObject({
      ok: false,
      reason: "dardanellesPermission",
    });
  });
});
