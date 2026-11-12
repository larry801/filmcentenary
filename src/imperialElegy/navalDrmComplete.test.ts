/**
 * Rule 19.5 — the printed naval BDRM list.  Firepower and the port-count
 * modifiers were already live; this suite covers the remaining entries:
 *
 *   - Stability: -1 or -2 from the power's stability track;
 *   - Only reduced units in battle: -1;
 *   - Manpower exhausted (GW only): -1.
 *
 * It also checks that the 19.5 two-box `portBox` footnote still selects the
 * adjacent box used for the port-count DRMs.
 */

import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {navalUnitsIn} from "./engine/rules";
import {beginNavalBattle, navalPortBattleModifiers} from "./engine/combat";

const makeCtx = (dice: number[] = [], playerID: string | null = "1"): Ctx => {
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

const gwState = (overrides: Partial<GreatWarState> = {}): GreatWarState => ({
  active: true,
  turn: 1,
  order: ["GE", "FR", "RU"],
  belligerents: ["UK", "FR"],
  neutrals: ["GE", "AU", "RU", "OT"],
  te: ["UK"],
  ta: ["FR"],
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
});

const clearAllNaval = (G: ImperialElegyState): void => {
  for (const unit of Object.values(G.units)) if (unit.naval) removeUnit(G, unit.id);
};

/** UK (seat 1) vs FR (seat 2), UK active; every other fleet removed. */
const navalWar = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "wartime";
  G.activePower = "UK";
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
  clearAllNaval(G);
  return G;
};

const battleAt = (
  G: ImperialElegyState,
  attacker: Power,
  from: string,
  to: string,
) => {
  G.pending = null;
  G.battle = null;
  const battle = beginNavalBattle(G, makeCtx(), attacker, from, to);
  if (!battle) throw new Error("naval battle did not start");
  return battle;
};

describe("19.5 naval BDRM list — stability", () => {
  test("both sides take their stability-track modifier", () => {
    const G = navalWar();
    placeUnit(G, "UK", "squadron", "london", 2);
    placeUnit(G, "FR", "squadron", "brittany", 2);
    G.powers.UK.stability = 0; // generic table: bm -2
    G.powers.FR.stability = 1; // generic table: bm -1
    const portMods = navalPortBattleModifiers(G, "UK", "FR", "brittany");
    const battle = battleAt(G, "UK", "london", "brittany");
    expect(battle.attackerDrm).toBe(portMods.attackerDrm - 2);
    expect(battle.defenderDrm).toBe(portMods.defenderDrm - 1);
    expect(battle.notes).toContain("stabilityAttacker");
    expect(battle.notes).toContain("stabilityDefender");
  });

  test("a stable power adds nothing", () => {
    const G = navalWar();
    placeUnit(G, "UK", "squadron", "london", 2);
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const portMods = navalPortBattleModifiers(G, "UK", "FR", "brittany");
    const battle = battleAt(G, "UK", "london", "brittany");
    expect(battle.attackerDrm).toBe(portMods.attackerDrm);
    expect(battle.defenderDrm).toBe(portMods.defenderDrm);
    expect(battle.notes).not.toContain("stabilityAttacker");
  });
});

describe("19.5 naval BDRM list — reduced units and manpower", () => {
  test("only reduced naval units in battle: -1 per side", () => {
    const G = navalWar();
    placeUnit(G, "UK", "squadron", "london", 1);
    placeUnit(G, "FR", "squadron", "brittany", 1);
    const portMods = navalPortBattleModifiers(G, "UK", "FR", "brittany");
    const battle = battleAt(G, "UK", "london", "brittany");
    expect(battle.attackerDrm).toBe(portMods.attackerDrm - 1);
    expect(battle.defenderDrm).toBe(portMods.defenderDrm - 1);
    expect(battle.notes).toContain("reducedOnlyAttacker");
    expect(battle.notes).toContain("reducedOnlyDefender");
  });

  test("manpower exhaustion is a GW-only -1 for the exhausted side", () => {
    const G = navalWar();
    G.gw = gwState();
    placeUnit(G, "UK", "squadron", "london", 2);
    placeUnit(G, "FR", "squadron", "brittany", 2);
    G.powers.UK.manpower = 0;
    const portMods = navalPortBattleModifiers(G, "UK", "FR", "brittany");
    const battle = battleAt(G, "UK", "london", "brittany");
    expect(battle.attackerDrm).toBe(portMods.attackerDrm - 1);
    expect(battle.notes).toContain("manpowerExhaustedAttacker");
    expect(battle.notes).not.toContain("manpowerExhaustedDefender");
  });

  test("the exhausted defender also suffers the -1", () => {
    const G = navalWar();
    G.gw = gwState();
    placeUnit(G, "UK", "squadron", "london", 2);
    placeUnit(G, "FR", "squadron", "brittany", 2);
    G.powers.FR.manpower = 0;
    const portMods = navalPortBattleModifiers(G, "UK", "FR", "brittany");
    const battle = battleAt(G, "UK", "london", "brittany");
    expect(battle.defenderDrm).toBe(portMods.defenderDrm - 1);
    expect(battle.notes).toContain("manpowerExhaustedDefender");
  });

  test("outside the Great War the exhausted-manpower clause does not apply", () => {
    const G = navalWar();
    placeUnit(G, "UK", "squadron", "london", 2);
    placeUnit(G, "FR", "squadron", "brittany", 2);
    G.powers.UK.manpower = 0;
    const portMods = navalPortBattleModifiers(G, "UK", "FR", "brittany");
    const battle = battleAt(G, "UK", "london", "brittany");
    expect(battle.attackerDrm).toBe(portMods.attackerDrm);
    expect(battle.notes).not.toContain("manpowerExhaustedAttacker");
  });
});

describe("19.5 two-box port battle keeps its chosen box", () => {
  test("stability stacks on top of the chosen box's port-count DRMs", () => {
    const G = navalWar();
    G.spaces.gibraltar.control = "FR";
    placeUnit(G, "FR", "squadron", "gibraltar", 2);
    placeUnit(G, "UK", "squadron", "london", 2);
    G.powers.UK.stability = 1;
    const north = navalPortBattleModifiers(G, "UK", "FR", "gibraltar", "north-atlantic");
    G.pending = null;
    G.battle = null;
    const battle = beginNavalBattle(G, makeCtx([], seat("UK")), "UK", "london", "gibraltar", {
      portBox: "north-atlantic",
    });
    if (!battle) throw new Error("naval battle did not start");
    expect(battle.portBox).toBe("north-atlantic");
    // The chosen box alone supplies the port-count DRM, then stability applies.
    expect(battle.attackerDrm).toBe(north.attackerDrm - 1);
    expect(battle.notes).toContain("attackerPortAdvantageBattle");
    expect(battle.notes).toContain("stabilityAttacker");
  });
});
