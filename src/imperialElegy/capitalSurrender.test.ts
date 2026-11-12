/**
 * 30.1 GW Surrender and Elimination + 15.5/16.1.1/16.1.6 war capitals.
 *
 * "A player immediately surrenders when their stability reaches 0 or if their
 * capital is occupied.  Exception: AU, RU, and OT players have a capital and a
 * subcapital, both must be occupied to force them to surrender."  The 33.5
 * Second Rome switch moves the Ottoman capital to Ankara, which every capital
 * lookup (the live 30.1 check and the limited-war knockout/victory rules) must
 * follow.  Outside the GW a taken capital is a major victory or an ally
 * knockout, never a game elimination, so those paths must not call
 * `eliminatePower`.
 */
import type {Ctx} from "boardgame.io";
import type {BattleState, GreatWarState, ImperialElegyState, Power, WarState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {finishBattle} from "./engine/combat";
import {
  capitalOccupiedByEnemy,
  changeStability,
  isPower,
  landUnitsIn,
  resolveCapitalSurrenders,
} from "./engine/rules";
import {performGwManeuver, resolveGwWinter} from "./engine/greatWarFlow";
import {classifyVictory} from "./engine/limitedWar";

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

const gwState = (overrides: Partial<GreatWarState> = {}): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = {
    active: true,
    turn: 1,
    order: ["FR", "GE"],
    belligerents: ["GE", "FR"],
    neutrals: [],
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
  G.phase = "gwManeuver";
  return G;
};

const clearSpace = (G: ImperialElegyState, space: string): void => {
  for (const id of [...G.spaces[space].units]) delete G.units[id];
  G.spaces[space].units = [];
  G.spaces[space].occupiedBy = null;
};

/** Finish a land battle with a fixed outcome (the romeSpace.test.ts pattern). */
const resolveBattle = (
  G: ImperialElegyState,
  attacker: Power,
  from: string,
  to: string,
  winner: "attacker" | "defender",
  decisive = false,
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
    decisive,
    winner,
    notes: [],
  };
  G.battle = battle;
  finishBattle(G, makeCtx());
};

const makeWar = (attacker: Power, defender: Power, overrides: Partial<WarState> = {}): WarState => ({
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
  truceTurns: 0,
  passed: [],
  startedTurn: 1,
  ...overrides,
});

describe("30.1 capital occupation", () => {
  test("a single-capital power surrenders when an enemy occupies its capital", () => {
    const G = gwState();
    G.spaces.berlin.occupiedBy = "FR";

    expect(capitalOccupiedByEnemy(G, "GE")).toBe(true);
    const eliminated = resolveCapitalSurrenders(G, makeCtx());

    expect(eliminated).toEqual(["GE"]);
    expect(G.powers.GE.eliminated).toBe(true);
    expect(Object.values(G.units).some((unit) => unit.owner === "GE")).toBe(false);
    expect(G.spaces.berlin.units.every((id) => G.units[id]?.owner !== "GE")).toBe(true);
    expect(G.gw!.ta).not.toContain("GE");
    expect(G.gw!.belligerents).not.toContain("GE");
    const entry = G.log.find((item) => item.key === "powerEliminated");
    expect(entry?.args).toMatchObject({cause: "capital"});
  });

  test("an enemy land unit alone occupies the capital (15.3)", () => {
    const G = gwState();
    // The occupation marker is the usual case, but 15.3 also counts the last
    // enemy force standing in the space.
    G.spaces.berlin.occupiedBy = null;
    placeUnit(G, "FR", "army", "berlin", 2);

    expect(capitalOccupiedByEnemy(G, "GE")).toBe(true);
  });

  test("a neutral minor or rebel in the capital does not surrender the player", () => {
    const G = gwState();
    G.spaces.berlin.occupiedBy = "Serbia";
    expect(capitalOccupiedByEnemy(G, "GE")).toBe(false);
    G.spaces.berlin.occupiedBy = null;
    placeUnit(G, "REBEL:Berlin", "rebelArmy", "berlin", 2);
    expect(capitalOccupiedByEnemy(G, "GE")).toBe(false);
    expect(resolveCapitalSurrenders(G, makeCtx())).toEqual([]);
  });

  test("a friendly occupier never surrenders the owner", () => {
    const G = gwState({te: ["FR"], ta: ["GE", "UK"], belligerents: ["GE", "FR", "UK"]});
    G.spaces.berlin.occupiedBy = "UK";
    expect(capitalOccupiedByEnemy(G, "GE")).toBe(false);
  });

  test("AU, RU and OT need capital and subcapital both occupied", () => {
    const G = gwState({
      order: ["FR"],
      belligerents: ["AU", "RU", "OT", "FR", "GE"],
      te: ["FR"],
      ta: ["AU", "RU", "OT", "GE"],
    });

    G.spaces.vienna.occupiedBy = "FR";
    expect(capitalOccupiedByEnemy(G, "AU")).toBe(false);
    G.spaces.hungary.occupiedBy = "FR";
    expect(capitalOccupiedByEnemy(G, "AU")).toBe(true);

    G.spaces["st-petersburg"].occupiedBy = "FR";
    expect(capitalOccupiedByEnemy(G, "RU")).toBe(false);
    G.spaces.moscow.occupiedBy = "FR";
    expect(capitalOccupiedByEnemy(G, "RU")).toBe(true);

    G.spaces.istanbul.occupiedBy = "FR";
    expect(capitalOccupiedByEnemy(G, "OT")).toBe(false);
    G.spaces.ankara.occupiedBy = "FR";
    expect(capitalOccupiedByEnemy(G, "OT")).toBe(true);

    // GE/FR/UK have no subcapital: one occupied capital is enough.
    G.spaces.berlin.occupiedBy = "FR";
    expect(capitalOccupiedByEnemy(G, "GE")).toBe(true);
  });

  test("only both occupied capitals eliminate AU, RU and OT", () => {
    const G = gwState({
      order: ["FR"],
      belligerents: ["AU", "RU", "OT", "FR"],
      te: ["FR"],
      ta: ["AU", "RU", "OT"],
    });
    G.spaces.vienna.occupiedBy = "FR";
    G.spaces["st-petersburg"].occupiedBy = "FR";
    G.spaces.istanbul.occupiedBy = "FR";
    expect(resolveCapitalSurrenders(G, makeCtx())).toEqual([]);

    G.spaces.hungary.occupiedBy = "FR";
    G.spaces.moscow.occupiedBy = "FR";
    G.spaces.ankara.occupiedBy = "FR";
    expect(resolveCapitalSurrenders(G, makeCtx())).toEqual(["AU", "RU", "OT"]);
    for (const power of ["AU", "RU", "OT"] as Power[]) expect(G.powers[power].eliminated).toBe(true);
  });

  test("33.5: after RU takes Istanbul, Ankara is the capital and the subcapital", () => {
    const G = gwState({
      order: ["FR"],
      belligerents: ["OT", "FR"],
      te: ["FR"],
      ta: ["OT"],
    });
    G.persistent.otCapital = "ankara";
    // RU already took Istanbul at the end of the war (33.5).
    G.spaces.istanbul.control = "RU";
    G.spaces.istanbul.occupiedBy = null;
    expect(capitalOccupiedByEnemy(G, "OT")).toBe(false);

    // Ankara alone surrenders the Ottomans; Istanbul no longer matters.
    G.spaces.ankara.occupiedBy = "FR";
    expect(capitalOccupiedByEnemy(G, "OT")).toBe(true);
    expect(resolveCapitalSurrenders(G, makeCtx())).toEqual(["OT"]);
  });

  test("does not double-surrender an eliminated power", () => {
    const G = gwState();
    G.spaces.berlin.occupiedBy = "FR";

    expect(resolveCapitalSurrenders(G, makeCtx())).toEqual(["GE"]);
    const logged = G.log.filter((item) => item.key === "powerEliminated").length;
    expect(resolveCapitalSurrenders(G, makeCtx())).toEqual([]);
    expect(G.log.filter((item) => item.key === "powerEliminated")).toHaveLength(logged);
    // An already-eliminated power is skipped even while its capital is held.
    expect(G.powers.GE.eliminated).toBe(true);
  });

  test("stability 0 still eliminates immediately (30.1 first clause)", () => {
    const G = gwState();
    changeStability(G, "GE", -3, makeCtx());
    expect(G.powers.GE.eliminated).toBe(true);
    expect(G.log.find((item) => item.key === "powerEliminated")?.args).toMatchObject({cause: "stability"});
  });

  test("a non-belligerent player's occupied capital is not a GW surrender", () => {
    const G = gwState({te: ["FR"], ta: ["GE"], belligerents: ["FR"]});
    G.spaces.berlin.occupiedBy = "FR";
    expect(capitalOccupiedByEnemy(G, "GE")).toBe(true);
    expect(resolveCapitalSurrenders(G, makeCtx())).toEqual([]);
    expect(G.powers.GE.eliminated).toBeFalsy();
  });
});

describe("30.1 live occupation", () => {
  test("a GW land advance into the capital surrenders the owner at once", () => {
    const G = gwState();
    clearSpace(G, "berlin");
    clearSpace(G, "pomerania");
    G.spaces.berlin.control = "GE";
    G.spaces.pomerania.control = "FR";
    placeUnit(G, "GE", "army", "berlin", 2);
    placeUnit(G, "FR", "army", "pomerania", 2);

    resolveBattle(G, "FR", "pomerania", "berlin", "attacker");

    expect(G.spaces.berlin.occupiedBy).toBe("FR");
    expect(G.powers.GE.eliminated).toBe(true);
    expect(Object.values(G.units).some((unit) => unit.owner === "GE")).toBe(false);
  });

  test("a GW maneuver that leaves a capital occupied is caught by the safety net", () => {
    const G = gwState();
    clearSpace(G, "pomerania");
    clearSpace(G, "prussia");
    G.spaces.pomerania.control = "FR";
    G.spaces.prussia.control = "FR";
    G.spaces.berlin.occupiedBy = "FR";
    G.gw!.order = ["FR", "GE"];
    G.gw!.belligerents = ["GE", "FR"];
    G.activePower = "FR";
    G.powers.FR.gwBudget = 3;
    const unit = placeUnit(G, "FR", "army", "pomerania", 2);

    const res = performGwManeuver(G, makeCtx(), {kind: "march", power: "FR", unitId: unit.id, to: "prussia"});

    expect(res.ok).toBe(true);
    expect(G.powers.GE.eliminated).toBe(true);
  });

  test("31.0: a capital advance that leaves an alliance at one power ends the war at once", () => {
    const G = gwState({
      order: ["FR", "GE", "UK", "AU"],
      te: ["FR", "UK"],
      ta: ["GE", "AU"],
      belligerents: ["FR", "GE", "UK", "AU"],
      neutrals: [],
    });
    G.powers.UK.alliance = "teCommitted";
    G.powers.AU.alliance = "taCommitted";
    G.powers.AU.stability = 3;
    clearSpace(G, "vienna");
    clearSpace(G, "hungary");
    // Hungary is the AU subcapital and already occupied, so taking Vienna
    // eliminates AU.  GE is then the only Triple Alliance power left and no
    // neutral can join it (31.0), so the war ends in this battle's finish.
    placeUnit(G, "FR", "army", "hungary", 2);
    // The occupation marker persists when that army advances, keeping the
    // subcapital occupied and so completing AU's 30.1 surrender.
    G.spaces.hungary.occupiedBy = "FR";
    placeUnit(G, "AU", "army", "vienna", 2);

    resolveBattle(G, "FR", "hungary", "vienna", "attacker");

    expect(G.powers.AU.eliminated).toBe(true);
    expect(G.gw!.ta).toEqual(["GE"]);
    expect(G.gw!.victor).toBe("te");
    expect(G.result?.reason).toBe("greatWar:te");
    expect(G.phase).toBe("gameOver");
  });

  test("the winter step is a safety net for an occupation already in place", () => {
    const G = gwState();
    G.phase = "gwWinter";
    G.spaces.berlin.occupiedBy = "FR";

    const res = resolveGwWinter(G, makeCtx());

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.eliminated).toContain("GE");
    expect(G.powers.GE.eliminated).toBe(true);
  });
});

describe("limited-war capitals follow capitalOf (15.5 / 16.1.1 / 16.1.6)", () => {
  test("a post-Ankara war uses Ankara for the major victory", () => {
    const G = setupImperialElegy(makeCtx());
    G.persistent.otCapital = "ankara";
    const war = makeWar("RU", "OT");

    // Istanbul is no longer the capital: holding it is not a major victory.
    G.spaces.istanbul.occupiedBy = "RU";
    expect(classifyVictory(G, war).kind).not.toBe("major");

    G.spaces.ankara.occupiedBy = "RU";
    const victory = classifyVictory(G, war);
    expect(victory.kind).toBe("major");
    expect(victory.victor).toBe("attacker");
    expect(victory.notes).toContain("major:defenderCapital");
  });

  test("before the switch Istanbul is still the Ottoman capital", () => {
    const G = setupImperialElegy(makeCtx());
    const war = makeWar("RU", "OT");
    G.spaces.istanbul.occupiedBy = "RU";
    const victory = classifyVictory(G, war);
    expect(victory.kind).toBe("major");
    expect(victory.victor).toBe("attacker");
  });

  test("an ally knockout names the live capital (Ankara after 33.5)", () => {
    const G = setupImperialElegy(makeCtx());
    G.persistent.otCapital = "ankara";
    const war = makeWar("FR", "GE", {attackerAllies: ["OT"]});
    G.spaces.ankara.occupiedBy = "GE";

    const victory = classifyVictory(G, war);

    expect(victory.kind).toBe("allyKnockout");
    expect(victory.allyKnockouts).toHaveLength(1);
    expect(victory.allyKnockouts[0]).toMatchObject({power: "OT", capital: "ankara", by: "defender"});
  });

  test("an ally knockout before the switch names Istanbul", () => {
    const G = setupImperialElegy(makeCtx());
    const war = makeWar("FR", "GE", {attackerAllies: ["OT"]});
    G.spaces.istanbul.occupiedBy = "GE";

    const victory = classifyVictory(G, war);

    expect(victory.allyKnockouts[0]).toMatchObject({power: "OT", capital: "istanbul"});
  });
});
