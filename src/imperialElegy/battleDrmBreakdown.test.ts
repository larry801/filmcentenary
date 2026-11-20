/**
 * The battle's DRM breakdown names every printed clause that changed a side's
 * roll, so the table can read "why +3 / -1" instead of only the totals.
 *
 * The engine records a source at each site that mutates `attackerDrm` /
 * `defenderDrm` (`engine/battleDrm.ts`) and derives the two contributions that
 * are recomputed from live forces (the committed elite bonus and the
 * force-point edge) in `combat.ts#battleDrmBreakdown`.  These tests pin the
 * arithmetic: the listed entries must add up to the printed total, both while
 * the battle runs and inside the after-battle report.
 */

import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {landUnitsIn} from "./engine/rules";
import {redactForView} from "./engine/privacy";
import {recordBattleDrm} from "./engine/battleDrm";
import {COMBAT_CARD_BY_ID, applyCombatCardToBattle} from "./engine/combatCards";
import {
  beginNavalBattle,
  battleDrmBreakdown,
  battleDrmTotals,
  beginLandBattle,
  refreshBattleDrmSnapshot,
  resolveBattleRoll,
} from "./engine/combat";

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

const gwState = (overrides: Partial<GreatWarState> = {}): GreatWarState => ({
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
  ...overrides,
});

const freshState = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "wartime";
  G.activePower = "GE";
  G.passed = [];
  G.pending = null;
  G.pendingStack = [];
  G.battle = null;
  G.battleReport = null;
  G.cpRemaining = 6;
  G.war = warState("GE", "FR");
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  for (const power of POWERS) {
    G.powers[power].hand = [];
    G.powers[power].gwCard = null;
  }
  return G;
};

const clearLand = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...landUnitsIn(G, space)]) removeUnit(G, unit.id);
};

const landFixture = (): ImperialElegyState => {
  const G = freshState();
  for (const space of ["berlin", "saxony"]) clearLand(G, space);
  G.spaces.berlin.control = "GE";
  G.spaces.berlin.ally = null;
  G.spaces.saxony.control = "FR";
  G.spaces.saxony.ally = null;
  placeUnit(G, "GE", "army", "berlin", 2);
  placeUnit(G, "FR", "army", "saxony", 2);
  return G;
};

const names = (breakdown: ReturnType<typeof battleDrmBreakdown>, side: "attacker" | "defender"): string[] =>
  breakdown[side].map((source) => source.key);

describe("the battle DRM breakdown", () => {
  test("the recorded entries add up to each side's total", () => {
    const G = landFixture();
    G.powers.GE.stability = 0; // -2 on the printed table
    G.powers.FR.stability = 1; // -1
    const battle = beginLandBattle(G, makeCtx(), "GE", "berlin", "saxony");
    if (!battle) throw new Error("land battle did not start");
    const breakdown = battleDrmBreakdown(G, battle);
    const totals = battleDrmTotals(G, battle);
    for (const side of ["attacker", "defender"] as const) {
      const sum = breakdown[side].reduce((acc, source) => acc + source.drm, 0);
      expect(sum).toBe(totals[side]);
    }
    expect(names(breakdown, "attacker")).toContain("stability");
    expect(names(breakdown, "defender")).toContain("stability");
    // Both armies are full strength, so no reduced-only penalty is listed.
    expect(names(breakdown, "attacker")).not.toContain("reducedOnly");
  });

  test("each named clause keeps its own signed contribution", () => {
    const G = landFixture();
    G.powers.GE.stability = 0;
    G.powers.FR.stability = 1;
    const battle = beginLandBattle(G, makeCtx(), "GE", "berlin", "saxony");
    if (!battle) throw new Error("land battle did not start");
    const attacker = battleDrmBreakdown(G, battle).attacker;
    const stability = attacker.find((source) => source.key === "stability");
    expect(stability?.drm).toBe(-2);
    expect(stability?.detail?.value).toBe(0);
  });

  test("a reduced-only force is charged its own -1 line", () => {
    const G = landFixture();
    G.powers.GE.stability = 0;
    G.powers.FR.stability = 0;
    clearLand(G, "berlin");
    clearLand(G, "saxony");
    placeUnit(G, "GE", "army", "berlin", 1);
    placeUnit(G, "FR", "army", "saxony", 1);
    const battle = beginLandBattle(G, makeCtx(), "GE", "berlin", "saxony");
    if (!battle) throw new Error("land battle did not start");
    const breakdown = battleDrmBreakdown(G, battle);
    expect(names(breakdown, "attacker")).toContain("reducedOnly");
    expect(names(breakdown, "defender")).toContain("reducedOnly");
    expect(breakdown.attacker.find((source) => source.key === "reducedOnly")?.drm).toBe(-1);
  });

  test("the force-point edge is listed as its own positive line", () => {
    const G = landFixture();
    G.powers.GE.stability = 0;
    G.powers.FR.stability = 0;
    // Two GE armies against one FR army: a +2 FP edge for the attacker.
    placeUnit(G, "GE", "army", "berlin", 2);
    const battle = beginLandBattle(G, makeCtx(), "GE", "berlin", "saxony");
    if (!battle) throw new Error("land battle did not start");
    const breakdown = battleDrmBreakdown(G, battle);
    const edge = breakdown.attacker.find((source) => source.key === "forcePointEdge");
    expect(edge?.drm).toBe(2);
    expect(names(breakdown, "defender")).not.toContain("forcePointEdge");
  });

  test("naval battles list the port-count and stability clauses", () => {
    const G = freshState();
    G.war = warState("UK", "FR");
    G.activePower = "UK";
    for (const unit of Object.values(G.units)) if (unit.naval) removeUnit(G, unit.id);
    placeUnit(G, "UK", "squadron", "north-atlantic", 2);
    placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    G.powers.UK.stability = 0;
    G.powers.FR.stability = 1;
    G.pending = null;
    const battle = beginNavalBattle(G, makeCtx(), "UK", "north-atlantic", "north-atlantic");
    if (!battle) throw new Error("naval battle did not start");
    const breakdown = battleDrmBreakdown(G, battle);
    expect(names(breakdown, "attacker")).toContain("stability");
    expect(names(breakdown, "defender")).toContain("stability");
    // One of the two 19.5 port clauses must appear on whichever side leads.
    const portLines = [...names(breakdown, "attacker"), ...names(breakdown, "defender")];
    expect(portLines.some((key) => key === "portAdvantage" || key === "noFriendlyPorts")).toBe(true);
  });

  test("the after-battle report keeps the snapshot taken with the dice", () => {
    const G = landFixture();
    G.powers.GE.stability = 0;
    G.powers.FR.stability = 1;
    const ctx = makeCtx([4, 4]);
    const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    if (!battle) throw new Error("land battle did not start");
    G.pending = null;
    G.pendingStack = [];
    resolveBattleRoll(G, ctx);
    expect(G.battle).toBeNull();
    const report = G.battleReport;
    expect(report).not.toBeNull();
    expect(report!.drmSources).toBeDefined();
    for (const side of ["attacker", "defender"] as const) {
      const listed = report!.drmSources![side];
      const sum = listed.reduce((acc, source) => acc + source.drm, 0);
      expect(sum).toBe(side === "attacker" ? report!.attackerDrm : report!.defenderDrm);
      expect(listed.map((source) => source.key)).toContain("stability");
    }
  });

  test("the report is public: every seat's view carries the same breakdown", () => {
    const G = landFixture();
    const ctx = makeCtx([4, 4]);
    const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    if (!battle) throw new Error("land battle did not start");
    G.pending = null;
    G.pendingStack = [];
    resolveBattleRoll(G, ctx);
    const report = G.battleReport;
    expect(report).not.toBeNull();
    for (const power of ["GE", "FR"] as const) {
      const view = redactForView(G, seat(power));
      expect(view.battleReport).toEqual(report);
      expect(view.battleReport!.drmSources).toBeDefined();
    }
  });

  test("a Great War exhausted fleet keeps the manpower line in the list", () => {
    const G = freshState();
    G.war = warState("UK", "FR");
    G.gw = gwState();
    G.activePower = "UK";
    for (const unit of Object.values(G.units)) if (unit.naval) removeUnit(G, unit.id);
    placeUnit(G, "UK", "squadron", "north-atlantic", 2);
    placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    G.powers.UK.manpower = 0;
    G.powers.UK.stability = 2;
    G.powers.FR.stability = 2;
    G.pending = null;
    const battle = beginNavalBattle(G, makeCtx(), "UK", "north-atlantic", "north-atlantic");
    if (!battle) throw new Error("naval battle did not start");
    const breakdown = battleDrmBreakdown(G, battle);
    const manpower = breakdown.attacker.find((source) => source.key === "manpowerExhausted");
    expect(manpower?.drm).toBe(-1);
    expect(names(breakdown, "defender")).not.toContain("manpowerExhausted");
  });

  test("a combat card's DRM is listed under its own card name", () => {
    const G = landFixture();
    G.powers.GE.stability = 2;
    G.powers.FR.stability = 2;
    const battle = beginLandBattle(G, makeCtx(), "GE", "berlin", "saxony");
    if (!battle) throw new Error("land battle did not start");
    battle.cardSide = "attacker";
    const def = COMBAT_CARD_BY_ID["IE-A043"];
    const next = applyCombatCardToBattle(battle, def, 0);
    const attacker = battleDrmBreakdown(G, next).attacker;
    const card = attacker.find((source) => source.key === "combatCard");
    expect(card?.drm).toBe(1);
    expect(card?.detail?.card).toBe("IE-A043");
    expect(card?.origin).toBe("card");
  });

  test("a late modifier re-freezes a rolled battle's list so it still adds up", () => {
    const G = landFixture();
    G.powers.GE.stability = 2;
    G.powers.FR.stability = 2;
    const ctx = makeCtx([4, 4]);
    const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    if (!battle) throw new Error("land battle did not start");
    G.pending = null;
    G.pendingStack = [];
    // Freeze a snapshot as the dice step does, then apply a late printed -1
    // through the same helper a late modifier uses.
    battle.drmBreakdown = battleDrmBreakdown(G, battle);
    battle.attackDrmTotal = battleDrmTotals(G, battle).attacker;
    recordBattleDrm(battle, "attacker", -1, "failedAvoid", undefined, "rule");
    battle.attackDrmTotal -= 1;
    refreshBattleDrmSnapshot(G, battle);
    const attacker = battleDrmBreakdown(G, battle).attacker;
    expect(attacker.map((source) => source.key)).toContain("failedAvoid");
    const sum = attacker.reduce((acc, source) => acc + source.drm, 0);
    expect(sum).toBe(battle.attackDrmTotal);
  });
});
