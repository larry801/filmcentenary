/**
 * Consumed battle DRMs (round 5):
 *  - A41 Prussian Military Tradition: +1 for German land battles in which
 *    Germany is the attacker, for the rest of the turn, no effect in the GW;
 *  - A98 Dreyfus Affair: -1 for French land battles, for the rest of the turn,
 *    no effect in the GW;
 *  - both are "rest of turn" effects, so a battle reads the flag without
 *    consuming it; the turn boundary clears it (`turnDurationFlags.test.ts`).
 */
import type {Ctx} from "boardgame.io";
import type {BattleState, GreatWarState, ImperialElegyState, Power, SpaceId} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {createWarState} from "./engine/limitedWar";
import {beginLandBattle} from "./engine/combat";
import {landBattleModifier} from "./engine/characteristics";
import {placeUnit, removeUnit} from "./engine/effects";
import {landUnitsIn} from "./engine/rules";

const makeCtx = (): Ctx =>
  ({
    playerID: "0",
    random: {Die: (_sides: number) => 3},
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    turn: 1,
    phase: "wartime",
  }) as unknown as Ctx;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const startWar = (G: ImperialElegyState, attacker: Power, defender: Power): void => {
  G.war = createWarState(G, attacker, defender, "conquest", [], 2);
  G.war.status = "maneuver";
  G.phase = "wartime";
  G.activePower = attacker;
  G.cpRemaining = 0;
  G.pending = null;
};

const clearLandUnits = (G: ImperialElegyState, space: SpaceId): void => {
  for (const unit of [...landUnitsIn(G, space)]) removeUnit(G, unit.id);
};

/** Stage one army per side and start the live battle. */
const stageBattle = (
  G: ImperialElegyState,
  attacker: Power,
  defender: Power,
  from: SpaceId,
  to: SpaceId,
): BattleState => {
  clearLandUnits(G, from);
  clearLandUnits(G, to);
  placeUnit(G, attacker, "army", from, 2);
  placeUnit(G, defender, "army", to, 2);
  const battle = beginLandBattle(G, makeCtx(), attacker, from, to);
  if (!battle) throw new Error("test battle did not start");
  return battle;
};

const gwActive = (): GreatWarState => ({
  active: true,
  turn: 1,
  order: [],
  belligerents: [],
  neutrals: [],
  te: [],
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
});

const makeBattle = (attacker: Power, defender: Power, from: SpaceId, to: SpaceId): BattleState => ({
  kind: "land",
  attacker,
  defender,
  from,
  to,
  mainAttack: [],
  mainDefense: [],
  supportAttack: [],
  supportDefense: [],
  stage: "roll",
  supportSide: "attacker",
  attackerDrm: 0,
  defenderDrm: 0,
  attackerLosses: 0,
  defenderLosses: 0,
  decisive: false,
  notes: [],
});

// ---------------------------------------------------------------------------
// A41 Prussian Military Tradition
// ---------------------------------------------------------------------------

describe("A41 Prussian Military Tradition", () => {
  test("adds +1 to the German attacker's live battle DRM", () => {
    const baseline = fresh();
    startWar(baseline, "GE", "FR");
    const baselineBattle = stageBattle(baseline, "GE", "FR", "berlin", "saxony");

    const G = fresh();
    startWar(G, "GE", "FR");
    G.powers.GE.flags.landDrm = 1;
    const battle = stageBattle(G, "GE", "FR", "berlin", "saxony");

    expect(battle.attackerDrm - baselineBattle.attackerDrm).toBe(1);
    expect(battle.defenderDrm).toBe(baselineBattle.defenderDrm);
  });

  test("the helper reports the printed event source", () => {
    const G = fresh();
    G.powers.GE.flags.landDrm = 1;
    const modifier = landBattleModifier(G, "GE", makeBattle("GE", "FR", "berlin", "saxony"));
    expect(modifier.side).toBe("attacker");
    expect(modifier.drm).toBe(1);
    expect(modifier.sources).toEqual(
      expect.arrayContaining([expect.objectContaining({id: "prussianMilitaryTradition", drm: 1, origin: "event"})]),
    );
  });

  test("it never helps Germany on defense", () => {
    const G = fresh();
    G.powers.GE.flags.landDrm = 1;
    const modifier = landBattleModifier(G, "GE", makeBattle("FR", "GE", "saxony", "berlin"));
    expect(modifier.side).toBe("defender");
    expect(modifier.drm).toBe(0);
    expect(modifier.sources.some((source) => source.id === "prussianMilitaryTradition")).toBe(false);
  });

  test("it has no effect during the Great War", () => {
    const G = fresh();
    G.gw = gwActive();
    G.powers.GE.flags.landDrm = 1;
    expect(landBattleModifier(G, "GE", makeBattle("GE", "FR", "berlin", "saxony")).drm).toBe(0);
  });

  test("a battle reads the flag without consuming it", () => {
    const G = fresh();
    startWar(G, "GE", "FR");
    G.powers.GE.flags.landDrm = 1;
    stageBattle(G, "GE", "FR", "berlin", "saxony");
    expect(G.powers.GE.flags.landDrm).toBe(1);
    // The next battle this turn still gets the modifier.
    G.pending = null;
    const second = stageBattle(G, "GE", "FR", "berlin", "saxony");
    const modifier = landBattleModifier(G, "GE", second);
    expect(modifier.sources.some((source) => source.id === "prussianMilitaryTradition")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// A98 Dreyfus Affair
// ---------------------------------------------------------------------------

describe("A98 Dreyfus Affair", () => {
  test("applies -1 to France attacking", () => {
    const G = fresh();
    G.powers.FR.flags.frLandDrm = -1;
    const modifier = landBattleModifier(G, "FR", makeBattle("FR", "GE", "alsace-lorraine", "westphalia"));
    expect(modifier.side).toBe("attacker");
    expect(modifier.drm).toBe(-1);
    expect(modifier.sources).toEqual(
      expect.arrayContaining([expect.objectContaining({id: "dreyfusAffair", drm: -1, origin: "event"})]),
    );
  });

  test("applies -1 to France defending", () => {
    const G = fresh();
    G.powers.FR.flags.frLandDrm = -1;
    const modifier = landBattleModifier(G, "FR", makeBattle("GE", "FR", "berlin", "saxony"));
    expect(modifier.side).toBe("defender");
    expect(modifier.drm).toBe(-1);
  });

  test("reaches the live defender DRM", () => {
    const baseline = fresh();
    startWar(baseline, "GE", "FR");
    const baselineBattle = stageBattle(baseline, "GE", "FR", "berlin", "saxony");

    const G = fresh();
    startWar(G, "GE", "FR");
    G.powers.FR.flags.frLandDrm = -1;
    const battle = stageBattle(G, "GE", "FR", "berlin", "saxony");

    expect(battle.defenderDrm - baselineBattle.defenderDrm).toBe(-1);
  });

  test("reaches the live attacker DRM", () => {
    const baseline = fresh();
    startWar(baseline, "FR", "GE");
    const baselineBattle = stageBattle(baseline, "FR", "GE", "alsace-lorraine", "westphalia");

    const G = fresh();
    startWar(G, "FR", "GE");
    G.powers.FR.flags.frLandDrm = -1;
    const battle = stageBattle(G, "FR", "GE", "alsace-lorraine", "westphalia");

    expect(battle.attackerDrm - baselineBattle.attackerDrm).toBe(-1);
  });

  test("has no effect during the Great War", () => {
    const G = fresh();
    G.gw = gwActive();
    G.powers.FR.flags.frLandDrm = -1;
    expect(landBattleModifier(G, "FR", makeBattle("GE", "FR", "berlin", "saxony")).drm).toBe(0);
  });

  test("a battle reads the flag without consuming it", () => {
    const G = fresh();
    startWar(G, "GE", "FR");
    G.powers.FR.flags.frLandDrm = -1;
    stageBattle(G, "GE", "FR", "berlin", "saxony");
    expect(G.powers.FR.flags.frLandDrm).toBe(-1);
    G.pending = null;
    const second = landBattleModifier(G, "FR", makeBattle("GE", "FR", "berlin", "saxony"));
    expect(second.drm).toBe(-1);
  });
});
