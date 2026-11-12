/**
 * Rule 19.0/19.1/19.2 in the Great War — a GW naval maneuver may end in an
 * enemy-occupied box or port as a *contact*, opening interception then
 * avoidance instead of silently parking in the enemy's space.
 */

import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {navalUnitsIn} from "./engine/rules";
import {performGwManeuver} from "./engine/greatWarFlow";
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

const baseGw = (overrides: Partial<GreatWarState> = {}): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = {
    active: true,
    turn: 1,
    order: ["GE", "FR", "RU"],
    belligerents: ["GE", "FR", "RU"],
    neutrals: ["UK", "AU", "OT"],
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
  G.powers.RU.alliance = "taCommitted";
  G.phase = "gwPlanning";
  return G;
};

const clearNaval = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...navalUnitsIn(G, space)]) removeUnit(G, unit.id);
};

const maneuver = (overrides: Partial<GreatWarState> = {}): ImperialElegyState => {
  const G = baseGw(overrides);
  G.phase = "gwManeuver";
  G.activePower = "GE";
  G.turnIndex = 0;
  G.pending = null;
  G.battle = null;
  G.powers.GE.gwBudget = 6;
  G.powers.GE.flags.gwActionsThisImpulse = 0;
  G.powers.GE.flags.passedGw = false;
  for (const space of ["baltic-sea", "pomerania", "prussia", "denmark"]) clearNaval(G, space);
  return G;
};

describe("GW naval contact (19.0)", () => {
  test("a GW naval maneuver into an enemy-occupied box is a contact that opens interception", () => {
    const G = maneuver();
    const mover = placeUnit(G, "GE", "squadron", "pomerania", 2).id;
    placeUnit(G, "FR", "squadron", "baltic-sea", 2);
    G.spaces.denmark.control = "FR";
    placeUnit(G, "FR", "squadron", "denmark", 2);

    const res = performGwManeuver(G, makeCtx(), {kind: "naval", power: "GE", unitIds: [mover], to: "baltic-sea"});
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    // The budget is spent exactly once by the move itself.
    expect(G.powers.GE.gwBudget).toBe(5);
    expect(G.units[mover].space).toBe("baltic-sea");
    // 19.1 comes before 19.2.
    expect(G.pending?.kind).toBe("navalInterception");
    expect(G.pending?.power).toBe("FR");
    expect(G.battle).toBeNull();

    expect(resolvePending(G, makeCtx([], "2"), "skip")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalAvoid");
    expect(G.pending?.power).toBe("FR");
    expect(G.powers.GE.gwBudget).toBe(5);

    expect(resolvePending(G, makeCtx([], "2"), "fight")).toBeUndefined();
    // No combat cards are available, so the battle auto-resolves; the log still
    // records the naval battle starting and ending.
    expect(G.pending?.kind).not.toBe("navalAvoid");
    expect(G.log.some((entry) => entry.key === "battleEnded" && entry.args?.to === "baltic-sea")).toBe(true);
    expect(G.powers.GE.gwBudget).toBe(5);
  });

  test("the live navalMove wrapper reaches the same GW contact flow", () => {
    const G = maneuver();
    const mover = placeUnit(G, "GE", "squadron", "pomerania", 2).id;
    placeUnit(G, "FR", "squadron", "baltic-sea", 2);
    G.spaces.denmark.control = "FR";
    placeUnit(G, "FR", "squadron", "denmark", 2);
    expect(navalMove(G, makeCtx([], "0"), [mover], "baltic-sea")).toBeUndefined();
    expect(G.units[mover].space).toBe("baltic-sea");
    expect(G.powers.GE.gwBudget).toBe(5);
    expect(G.pending?.kind).toBe("navalInterception");
    expect(G.pending?.power).toBe("FR");
  });

  test("a GW maneuver may contact an enemy port with up to four attacking ships", () => {
    const G = maneuver();
    const mover = placeUnit(G, "GE", "squadron", "baltic-sea", 2).id;
    for (let i = 0; i < 4; i += 1) placeUnit(G, "FR", "squadron", "denmark", 2);
    G.spaces.denmark.control = "FR";

    const res = performGwManeuver(G, makeCtx(), {kind: "naval", power: "GE", unitIds: [mover], to: "denmark"});
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.units[mover].space).toBe("denmark");
    // Denmark touches two naval boxes, so the attacker must first choose which
    // box counts for the port-count DRMs (19.5 footnote).
    expect(G.pending?.kind).toBe("navalPortBox");
    expect(G.pending?.power).toBe("GE");
    expect(resolvePending(G, makeCtx([], "0"), "box:baltic-sea")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalAvoid");
    expect(G.pending?.power).toBe("FR");
  });

  test("more than four attacking ships cannot contact a port (5.5.4)", () => {
    const G = maneuver();
    const movers = Array.from({length: 5}, () => placeUnit(G, "GE", "squadron", "baltic-sea", 2).id);
    placeUnit(G, "FR", "squadron", "denmark", 2);
    G.spaces.denmark.control = "FR";
    const res = performGwManeuver(G, makeCtx(), {kind: "naval", power: "GE", unitIds: movers, to: "denmark"});
    expect(res.ok).toBe(false);
    expect(G.powers.GE.gwBudget).toBe(6);
    expect(G.pending).toBeNull();
  });

  test("an empty enemy port is still not a naval destination", () => {
    const G = maneuver();
    const mover = placeUnit(G, "GE", "squadron", "baltic-sea", 2).id;
    G.spaces.denmark.control = "FR";
    const res = performGwManeuver(G, makeCtx(), {kind: "naval", power: "GE", unitIds: [mover], to: "denmark"});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalidTarget");
    expect(G.units[mover].space).toBe("baltic-sea");
  });

  test("a GW joint naval contact opens the defender's decision once", () => {
    const G = maneuver({te: ["GE", "FR"], ta: ["RU"], belligerents: ["GE", "FR", "RU"]});
    G.powers.GE.alliance = "teCommitted";
    const own = placeUnit(G, "GE", "squadron", "pomerania", 2).id;
    const allyShip = placeUnit(G, "FR", "squadron", "pomerania", 2).id;
    placeUnit(G, "RU", "squadron", "baltic-sea", 2);

    const res = performGwManeuver(G, makeCtx(), {
      kind: "jointNaval",
      power: "GE",
      ally: "FR",
      unitIds: [own],
      allyUnitIds: [allyShip],
      to: "baltic-sea",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.powers.GE.gwBudget).toBe(5);
    expect(G.units[own].space).toBe("baltic-sea");
    expect(G.units[allyShip].space).toBe("baltic-sea");
    // RU's Baltic port (St Petersburg) may intercept first.
    expect(G.pending?.kind).toBe("navalInterception");
    expect(G.pending?.power).toBe("RU");
    expect(resolvePending(G, makeCtx([], "4"), "skip")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalAvoid");
    expect(G.pending?.power).toBe("RU");
  });
});
