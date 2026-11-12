/**
 * Rule 18.2.1 — "Apply the following modifiers to units in the main attack/
 * defense ... Manpower exhausted (GW only): -1".
 *
 * The printed land modifier list carries the same exhaustion penalty as the
 * 19.5 naval list, so an exhausted power suffers it in land battles too.  It is
 * GW-only, applied once per side, and supporting armies never incur it.
 */

import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {landUnitsIn} from "./engine/rules";
import {beginLandBattle} from "./engine/combat";
import {landBattle} from "./moves";

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

const gwState = (): GreatWarState => ({
  active: true,
  turn: 1,
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
});

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

const fixture = (gw: boolean): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = gw ? gwState() : null;
  G.phase = "action";
  G.activePower = "GE";
  G.turnIndex = 0;
  G.pending = null;
  G.pendingStack = [];
  G.battle = null;
  G.cpRemaining = 6;
  G.war = warState("GE", "FR");
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  for (const power of POWERS) {
    G.powers[power].hand = [];
    G.powers[power].gwCard = null;
  }
  for (const space of ["berlin", "saxony"]) {
    clearLand(G, space);
  }
  G.spaces.berlin.control = "GE";
  G.spaces.saxony.control = "FR";
  placeUnit(G, "GE", "army", "berlin", 2);
  placeUnit(G, "FR", "army", "saxony", 2);
  return G;
};

describe("18.2.1 land manpower exhaustion DRM", () => {
  test("an exhausted attacker suffers an extra -1 in a land battle", () => {
    const baseline = fixture(true);
    const before = beginLandBattle(baseline, makeCtx(), "GE", "berlin", "saxony");
    if (!before) throw new Error("land battle did not start");
    const G = fixture(true);
    G.powers.GE.manpower = 0;
    const battle = beginLandBattle(G, makeCtx(), "GE", "berlin", "saxony");
    if (!battle) throw new Error("land battle did not start");
    expect(battle.notes).toContain("manpowerExhaustedAttacker");
    expect(battle.notes).not.toContain("manpowerExhaustedDefender");
    expect(battle.attackerDrm).toBe(before.attackerDrm - 1);
    expect(battle.defenderDrm).toBe(before.defenderDrm);
  });

  test("an exhausted defender suffers an extra -1 in a land battle", () => {
    const baseline = fixture(true);
    const before = beginLandBattle(baseline, makeCtx(), "GE", "berlin", "saxony");
    if (!before) throw new Error("land battle did not start");
    const G = fixture(true);
    G.powers.FR.manpower = 0;
    const battle = beginLandBattle(G, makeCtx(), "GE", "berlin", "saxony");
    if (!battle) throw new Error("land battle did not start");
    expect(battle.notes).toContain("manpowerExhaustedDefender");
    expect(battle.notes).not.toContain("manpowerExhaustedAttacker");
    expect(battle.defenderDrm).toBe(before.defenderDrm - 1);
    expect(battle.attackerDrm).toBe(before.attackerDrm);
  });

  test("both exhausted sides are charged once each", () => {
    const baseline = fixture(true);
    const before = beginLandBattle(baseline, makeCtx(), "GE", "berlin", "saxony");
    if (!before) throw new Error("land battle did not start");
    const G = fixture(true);
    G.powers.GE.manpower = 0;
    G.powers.FR.manpower = 0;
    const battle = beginLandBattle(G, makeCtx(), "GE", "berlin", "saxony");
    if (!battle) throw new Error("land battle did not start");
    expect(battle.attackerDrm).toBe(before.attackerDrm - 1);
    expect(battle.defenderDrm).toBe(before.defenderDrm - 1);
    expect(battle.notes.filter((note) => note.startsWith("manpowerExhausted"))).toHaveLength(2);
  });

  test("outside the Great War the clause does not apply", () => {
    const baseline = fixture(false);
    const before = beginLandBattle(baseline, makeCtx(), "GE", "berlin", "saxony");
    if (!before) throw new Error("land battle did not start");
    const G = fixture(false);
    G.powers.GE.manpower = 0;
    G.powers.FR.manpower = 0;
    const battle = beginLandBattle(G, makeCtx(), "GE", "berlin", "saxony");
    if (!battle) throw new Error("land battle did not start");
    expect(battle.notes.some((note) => note.startsWith("manpowerExhausted"))).toBe(false);
    expect(battle.attackerDrm).toBe(before.attackerDrm);
    expect(battle.defenderDrm).toBe(before.defenderDrm);
  });

  test("the live land battle move records the printed modifier", () => {
    const G = fixture(true);
    G.powers.GE.manpower = 0;
    expect(landBattle(G, makeCtx([], seat("GE")), "berlin", "saxony")).toBeUndefined();
    expect(G.battle?.kind).toBe("land");
    expect(G.battle?.attacker).toBe("GE");
    expect(G.battle?.notes).toContain("manpowerExhaustedAttacker");
    // The one CP was spent by the move itself.
    expect(G.cpRemaining).toBe(5);
  });
});
