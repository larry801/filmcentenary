/**
 * Rules 19.4/19.6 — "Dreadnought Losses: the majority (more than half) of step
 * losses from mines [19.4] / in naval battles [19.6] must be taken by
 * dreadnoughts if any are present."  The quota is fixed when the losses are
 * rolled; the owner still chooses which dreadnought takes a step, and once the
 * quota is met the ordinary 18.6 loss order resumes.
 */

import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {beginNavalBattle, resolveBattleRoll} from "./engine/combat";
import {resolvePending} from "./moves";

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

const clearAllNaval = (G: ImperialElegyState): void => {
  for (const unit of Object.values(G.units)) if (unit.naval) removeUnit(G, unit.id);
};

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
  // Hold the battle at the pre-dice card window so each test can supply its
  // own dice; without an available card `beginNavalBattle` auto-resolves.
  G.powers.UK.hand = ["IE-A061"];
  clearAllNaval(G);
  return G;
};

describe("19.6 dreadnought-majority losses", () => {
  test("the attacker may pick which dreadnought takes each required step, but not a squadron", () => {
    const G = navalWar();
    const dread1 = placeUnit(G, "UK", "dreadnought", "london", 2).id;
    const dread2 = placeUnit(G, "UK", "dreadnought", "london", 2).id;
    const dread3 = placeUnit(G, "UK", "dreadnought", "london", 2).id;
    const squadron = placeUnit(G, "UK", "squadron", "london", 2).id;
    for (let i = 0; i < 4; i += 1) placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    const battle = beginNavalBattle(G, makeCtx(), "UK", "london", "north-atlantic");
    if (!battle) throw new Error("naval battle did not start");
    G.pending = null;
    // FP: 3 dreadnoughts (9) + squadron (2) vs 4 dread-halved squadrons (4).
    // Cancel the firepower differential so the dice decide the CRT result.
    battle.attackerDrm = -7;
    battle.defenderDrm = 0;
    resolveBattleRoll(G, makeCtx([1, 4]));

    // Differential -3: the attacker takes two losses, so more than half is 2.
    expect(battle.attackerLosses).toBe(2);
    expect(battle.dreadnoughtRequired).toEqual({attacker: 2, defender: 0});
    expect(G.pending?.kind).toBe("combatLosses");
    expect(G.pending?.power).toBe("UK");
    const first = G.pending!.options.map((option) => option.id);
    expect(first.sort()).toEqual([dread1, dread2, dread3].sort());
    expect(first).not.toContain(squadron);

    // One dreadnought step taken; the second loss still must be a dreadnought.
    expect(resolvePending(G, makeCtx([], seat("UK")), dread1)).toBeUndefined();
    const second = G.pending!.options.map((option) => option.id);
    expect(second).toContain(dread1);
    expect(second).toContain(dread2);
    expect(second).not.toContain(squadron);
    expect(resolvePending(G, makeCtx([], seat("UK")), dread1)).toBeUndefined();

    // The quota is met; the defender's single loss is now chosen normally.
    expect(G.pending?.kind).toBe("combatLosses");
    expect(G.pending?.power).toBe("FR");
    expect(resolvePending(G, makeCtx([], seat("FR")), G.pending!.options[0].id)).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(battle.dreadnoughtLosses?.attacker).toBe(2);
    expect(G.units[dread1]).toBeUndefined();
    expect(G.units[squadron]?.steps).toBe(2);
  });

  test("19.4 mine hits obey the same dreadnought majority", () => {
    const G = navalWar();
    G.turn = 3; // three mine dice in the port battle
    const dread = placeUnit(G, "UK", "dreadnought", "north-atlantic", 2).id;
    const squadron = placeUnit(G, "UK", "squadron", "north-atlantic", 2).id;
    placeUnit(G, "FR", "squadron", "brittany", 1);
    G.spaces.brittany.control = "FR";
    G.spaces.brittany.fort = {power: "FR", level: 1};
    const battle = beginNavalBattle(G, makeCtx(), "UK", "north-atlantic", "brittany");
    if (!battle) throw new Error("naval battle did not start");
    G.pending = null;
    expect(battle.notes).toContain("minefield");
    battle.attackerDrm = 50;
    // 19.3 step 1: the three mine rolls all hit before any battle die; the
    // attacker then wins decisively with the battle dice.
    resolveBattleRoll(G, makeCtx([4, 4, 4, 1, 1]));
    // 19.4: a third mine hit triggers the two-hit retreat option; taking every
    // hit keeps the full dreadnought-majority resolution.
    expect(G.pending?.kind).toBe("mineRetreat");
    expect(resolvePending(G, makeCtx([], seat("UK")), "continue")).toBeUndefined();
    expect(battle.mines).toBe(3);
    expect(battle.attackerLosses).toBe(3);
    // More than half of three is two: both dreadnought steps, then the squadron.
    expect(battle.dreadnoughtRequired?.attacker).toBe(2);
    expect(battle.dreadnoughtLosses?.attacker).toBe(2);
    expect(G.units[dread]).toBeUndefined();
    expect(G.units[squadron]?.steps).toBe(1);
  });

  test("the defending side also takes its dreadnought majority", () => {
    const G = navalWar();
    const defenderDread1 = placeUnit(G, "FR", "dreadnought", "brittany", 2).id;
    const defenderDread2 = placeUnit(G, "FR", "dreadnought", "brittany", 2).id;
    const frSquadron = placeUnit(G, "FR", "squadron", "brittany", 2).id;
    for (let i = 0; i < 4; i += 1) placeUnit(G, "UK", "squadron", "north-atlantic", 2);
    G.spaces.brittany.control = "FR";
    const battle = beginNavalBattle(G, makeCtx(), "UK", "north-atlantic", "brittany");
    if (!battle) throw new Error("naval battle did not start");
    G.pending = null;
    // 4 squadrons (8) vs 2 dreadnoughts (6) + squadron (2), no dreadnought
    // halving on the attacking squadrons: an even FP battle won decisively.
    battle.attackerDrm = 0;
    battle.defenderDrm = 0;
    // 19.3 step 1: one mine die (1, a miss) comes before the battle dice (6, 1).
    resolveBattleRoll(G, makeCtx([1, 6, 1]));
    expect(battle.winner).toBe("attacker");
    expect(battle.defenderLosses).toBe(4);
    // More than half of four is three; the deterministic 18.6 order keeps
    // taking dreadnought steps (the reduced one is the smallest unit), so all
    // four losses land on dreadnoughts and the squadron is untouched.
    expect(battle.dreadnoughtRequired?.defender).toBe(3);
    expect(battle.dreadnoughtLosses?.defender).toBe(4);
    expect(G.units[defenderDread1]).toBeUndefined();
    expect(G.units[defenderDread2]).toBeUndefined();
    expect(G.units[frSquadron]?.steps).toBe(2);
  });

  test("with no dreadnoughts present the normal loss choice is unrestricted", () => {
    const G = navalWar();
    const squadron1 = placeUnit(G, "UK", "squadron", "london", 2).id;
    const squadron2 = placeUnit(G, "UK", "squadron", "london", 2).id;
    const squadron3 = placeUnit(G, "UK", "squadron", "london", 2).id;
    for (let i = 0; i < 3; i += 1) placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    const battle = beginNavalBattle(G, makeCtx(), "UK", "london", "north-atlantic");
    if (!battle) throw new Error("naval battle did not start");
    G.pending = null;
    battle.attackerDrm = 0;
    battle.defenderDrm = 0;
    resolveBattleRoll(G, makeCtx([1, 4]));
    expect(battle.dreadnoughtRequired).toEqual({attacker: 0, defender: 0});
    expect(G.pending?.kind).toBe("combatLosses");
    const options = G.pending!.options.map((option) => option.id);
    expect(options.sort()).toEqual([squadron1, squadron2, squadron3].sort());
  });
});

/**
 * 30.0: "Losing a dreadnought in battle: -1 stability."  The recorded owner is
 * charged once the battle's other effects are done; the US and Italy follow
 * their own 32.1/32.2 lists instead.
 */
const gwNavalWar = (): ImperialElegyState => {
  const G = navalWar();
  G.war = null;
  G.phase = "gwManeuver";
  G.gw = {
    active: true,
    turn: 2,
    order: ["UK", "GE"],
    belligerents: ["UK", "GE"],
    neutrals: [],
    te: ["UK"],
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
  } as GreatWarState;
  G.powers.UK.alliance = "teCommitted";
  G.powers.GE.alliance = "taCommitted";
  G.powers.UK.stability = 3;
  G.powers.GE.stability = 3;
  return G;
};

describe("30.0 a dreadnought lost in a GW battle", () => {
  test("the eliminating step costs the owner 1 stability", () => {
    const G = gwNavalWar();
    const dread = placeUnit(G, "UK", "dreadnought", "london", 2);
    dread.steps = 1; // one step from elimination
    for (let i = 0; i < 4; i += 1) placeUnit(G, "GE", "squadron", "north-atlantic", 2);
    const battle = beginNavalBattle(G, makeCtx(), "UK", "london", "north-atlantic");
    if (!battle) throw new Error("naval battle did not start");
    G.pending = null;
    // Force a decisive defender win: the lone dreadnought must take the losses.
    battle.attackerDrm = -20;
    battle.defenderDrm = 0;
    resolveBattleRoll(G, makeCtx([1, 6]));

    expect(G.units[dread.id]).toBeUndefined();
    expect(G.powers.UK.stability).toBe(2);
    expect(G.powers.GE.stability).toBe(3);
  });

  test("a dreadnought outside the Great War costs no stability", () => {
    const G = navalWar();
    const dread = placeUnit(G, "UK", "dreadnought", "london", 2);
    dread.steps = 1;
    for (let i = 0; i < 4; i += 1) placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    const battle = beginNavalBattle(G, makeCtx(), "UK", "london", "north-atlantic");
    if (!battle) throw new Error("naval battle did not start");
    G.pending = null;
    battle.attackerDrm = -20;
    battle.defenderDrm = 0;
    const before = G.powers.UK.stability;
    resolveBattleRoll(G, makeCtx([1, 6]));

    expect(G.units[dread.id]).toBeUndefined();
    expect(G.powers.UK.stability).toBe(before);
  });
});
