/**
 * 15.6 Knocking Out Wartime Allies / 16.1.6 Special - Ally Knockout.
 *
 * "Occupying the capital of a player who is not a primary belligerent
 * immediately knocks that player out of the war and grants the occupying player
 * a special treaty option during the victory step (see 16.1.6)."  The knockout
 * is recorded the moment it happens, so retaking the capital during the same
 * war cannot retroactively erase the treaty option ("Regardless of the war's
 * outcome, an ally knockout still occurs").  Minor powers are never knocked out
 * of a war, and a primary belligerent's capital is a victory condition, not a
 * knockout.
 */
import type {Ctx} from "boardgame.io";
import type {BattleState, ImperialElegyState, Power, WarState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {finishBattle} from "./engine/combat";
import {isPower, landUnitsIn} from "./engine/rules";
import {
  canApplyTreaty,
  classifyVictory,
  recordWarKnockoutCapture,
  recordWarKnockouts,
} from "./engine/limitedWar";

const makeCtx = (dieValue = 3): Ctx =>
  ({
    playerID: "0",
    random: {Die: (_sides: number) => dieValue},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const makeWar = (attacker: Power, defender: Power, overrides: Partial<WarState> = {}): WarState => ({
  attacker,
  defender,
  attackerAllies: [],
  defenderAllies: [],
  attackerMinors: [],
  defenderMinors: [],
  warAim: "conquest",
  objectives: ["warsaw"],
  status: "maneuver",
  budgets: {},
  initiative: [],
  treaties: [],
  victor: null,
  truceTurns: 0,
  passed: [],
  startedTurn: 1,
  ...overrides,
});

/** Finish a land battle with a fixed outcome (the capitalSurrender.test.ts pattern). */
const resolveBattle = (
  G: ImperialElegyState,
  attacker: Power,
  from: string,
  to: string,
  winner: "attacker" | "defender",
): void => {
  const attack = landUnitsIn(G, from).filter((unit) => unit.owner === attacker);
  const defend = landUnitsIn(G, to).filter((unit) => unit.owner !== attacker);
  if (attack.length === 0 || defend.length === 0) throw new Error("no battle");
  const control = G.spaces[to].control;
  const defender =
    (defend.find((unit) => isPower(unit.owner))?.owner as Power | undefined) ??
    (isPower(control) ? control : attacker);
  const battle: BattleState = {
    kind: "land",
    attacker,
    defender,
    from,
    to,
    mainAttack: attack.map((unit) => unit.id),
    mainDefense: defend.map((unit) => unit.id),
    forceOwners: {attacker: attack.map((unit) => unit.owner), defender: defend.map((unit) => unit.owner)},
    supportAttack: [],
    supportDefense: [],
    stage: "done",
    supportSide: "attacker",
    attackerDrm: 0,
    defenderDrm: 0,
    attackerLosses: 0,
    defenderLosses: 0,
    decisive: false,
    winner,
    notes: [],
  };
  G.battle = battle;
  finishBattle(G, makeCtx());
};

const recordedPowers = (G: ImperialElegyState): string[] =>
  (G.war?.knockedOut ?? []).map((entry) => entry.power);

describe("15.6 recording the knockout at the capture", () => {
  test("an enemy occupying an ally's capital is recorded immediately", () => {
    const G = fresh();
    const war = makeWar("GE", "AU", {defenderAllies: ["RU"]});
    G.war = war;

    const knockout = recordWarKnockoutCapture(G, "st-petersburg", "GE");

    expect(knockout).toMatchObject({
      power: "RU",
      by: "attacker",
      occupier: "GE",
      capital: "st-petersburg",
      treatyOptions: 1,
    });
    expect(recordedPowers(G)).toEqual(["RU"]);
    const entry = G.log.find((item) => item.key === "warAllyKnockout");
    expect(entry?.args).toMatchObject({power: "RU", by: "attacker", capital: "st-petersburg"});
  });

  test("the defense-side ally is recorded when the defender takes its capital", () => {
    const G = fresh();
    const war = makeWar("GE", "AU", {attackerAllies: ["RU"]});
    G.war = war;

    expect(recordWarKnockoutCapture(G, "st-petersburg", "AU")).toMatchObject({
      power: "RU",
      by: "defender",
      occupier: "AU",
    });
  });

  test("a live land advance records the knockout through the capture hook", () => {
    const G = fresh();
    const war = makeWar("GE", "AU", {defenderAllies: ["RU"]});
    G.war = war;
    G.spaces["st-petersburg"].occupiedBy = null;
    placeUnit(G, "RU", "army", "st-petersburg", 2);
    placeUnit(G, "GE", "army", "moscow", 2);

    resolveBattle(G, "GE", "moscow", "st-petersburg", "attacker");

    expect(G.spaces["st-petersburg"].occupiedBy).toBe("GE");
    expect(recordedPowers(G)).toEqual(["RU"]);
    expect(G.log.some((item) => item.key === "warAllyKnockout")).toBe(true);
  });

  test("a primary belligerent's capital and a minor capital are not knockouts", () => {
    const G = fresh();
    G.war = makeWar("GE", "AU", {defenderAllies: ["RU"]});

    expect(recordWarKnockoutCapture(G, "vienna", "GE")).toBeNull();
    expect(recordWarKnockoutCapture(G, "serbia", "GE")).toBeNull();
    expect(recordedPowers(G)).toEqual([]);
  });

  test("a unit of the victim's own side recapturing a capital does not record", () => {
    const G = fresh();
    G.war = makeWar("GE", "AU", {defenderAllies: ["RU"]});

    expect(recordWarKnockoutCapture(G, "st-petersburg", "AU")).toBeNull();
    expect(recordedPowers(G)).toEqual([]);
  });

  test("recording is idempotent", () => {
    const G = fresh();
    G.war = makeWar("GE", "AU", {defenderAllies: ["RU"]});
    expect(recordWarKnockoutCapture(G, "st-petersburg", "GE")).not.toBeNull();
    expect(recordWarKnockoutCapture(G, "st-petersburg", "GE")).toBeNull();
    expect(recordedPowers(G)).toEqual(["RU"]);
    expect(G.log.filter((item) => item.key === "warAllyKnockout")).toHaveLength(1);
  });
});

describe("15.6 a retaken capital cannot undo the knockout", () => {
  test("classification still reports the knockout after the capital is retaken", () => {
    const G = fresh();
    const war = makeWar("GE", "AU", {defenderAllies: ["RU"]});
    G.war = war;
    recordWarKnockoutCapture(G, "st-petersburg", "GE");
    // RU retakes its capital before the war is settled.
    G.spaces["st-petersburg"].occupiedBy = "RU";

    const victory = classifyVictory(G, war);

    expect(victory.allyKnockouts).toHaveLength(1);
    expect(victory.allyKnockouts[0]).toMatchObject({
      power: "RU",
      by: "attacker",
      occupier: "GE",
      capital: "st-petersburg",
    });
    expect(victory.kind).toBe("allyKnockout");
    expect(victory.primary).toBe("whitePeace");
    expect(victory.allyKnockoutTreatyOptions).toBe(1);
    expect(victory.totalTreatyOptions).toBe(1);
  });

  test("the 16.1.6 treaty option is still legal after the recapture", () => {
    const G = fresh();
    const war = makeWar("GE", "AU", {defenderAllies: ["RU"]});
    G.war = war;
    recordWarKnockoutCapture(G, "st-petersburg", "GE");
    G.spaces["st-petersburg"].occupiedBy = "RU";
    // The winning side still occupies another Russian home for reparations.
    G.spaces.moscow.occupiedBy = "GE";

    const victory = classifyVictory(G, war);
    const check = canApplyTreaty(G, war, victory, {option: "warReparations", target: "RU"});

    expect(check.ok).toBe(true);
    expect(check.target).toBe("RU");
    expect(check.imposingSide).toBe("attacker");
  });

  test("a knockout-only war still classifies as an ally knockout", () => {
    const G = fresh();
    const war = makeWar("GE", "AU", {attackerAllies: ["RU"]});
    G.war = war;
    // AU (defender) takes the attacker ally's capital.
    recordWarKnockoutCapture(G, "st-petersburg", "AU");

    const victory = classifyVictory(G, war);

    expect(victory.kind).toBe("allyKnockout");
    expect(victory.victor).toBe("defender");
    expect(victory.winner).toBe("AU");
    expect(victory.loser).toBe("RU");
  });
});

describe("15.6 the safety net for captures without a hook", () => {
  test("an already-held capital is recorded before settlement", () => {
    const G = fresh();
    G.war = makeWar("GE", "AU", {defenderAllies: ["RU"]});
    G.spaces["st-petersburg"].occupiedBy = "GE";

    const recorded = recordWarKnockouts(G);

    expect(recorded.map((entry) => entry.power)).toEqual(["RU"]);
    expect(recordedPowers(G)).toEqual(["RU"]);
    expect(recordWarKnockouts(G)).toEqual([]);
  });

  test("classification still falls back to the live capital check for old saves", () => {
    const G = fresh();
    const war = makeWar("GE", "AU", {defenderAllies: ["RU"]});
    G.spaces["st-petersburg"].occupiedBy = "GE";

    const victory = classifyVictory(G, war);

    expect(victory.allyKnockouts[0]).toMatchObject({power: "RU", by: "attacker"});
  });

  test("nothing is recorded outside a limited war or during the Great War", () => {
    const G = fresh();
    expect(recordWarKnockoutCapture(G, "st-petersburg", "GE")).toBeNull();
    G.war = makeWar("GE", "AU", {defenderAllies: ["RU"]});
    G.gw = {
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
    };
    expect(recordWarKnockoutCapture(G, "st-petersburg", "GE")).toBeNull();
  });
});
