/**
 * 22.2 / 22.4 / 25.3 / 30.2: the Papal States capital, Rome.
 *
 * The printed map shows Rome as the star-shaped capital of the Papal States
 * between Tuscany and Naples, with the Italian unification symbol.  This suite
 * pins the space data, the unification/Italy integration, the Papal Influence
 * card (A070) and Italy's capital surrender.
 */
import type {Ctx} from "boardgame.io";
import type {BattleState, GreatWarState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {finishBattle} from "./engine/combat";
import {placeUnit} from "./engine/effects";
import {connectionsOf, neighboursOf, SPACES} from "./constant/spaces";
import {CAMPAIGN_SETUP, MINOR_POWER_HOMES, START_BUILD_BOX} from "./constant/setup";
import {PLAYBOOK_START_KEYS} from "./data/referenceExpectations";
import {
  changeGwMajorStability,
  hasSurrendered,
  italianHomeKeys,
  syncItalianHomeKeys,
} from "./engine/gwMajors";
import {enterGwAlly} from "./engine/greatWarFlow";
import {checkItalianUnification} from "./engine/victory";
import {unifyItaly} from "./engine/greatWar";
import {hostileOwner, isPower, italianKeys, landUnitsIn, navalUnitsIn, recomputeTracks} from "./engine/rules";
import {CARD_BY_ID} from "./engine/deck";
import {resolveCard, resolveCardDecision} from "./engine/effects";

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
  };
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.phase = "gwManeuver";
  return G;
};

const clearSpace = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...landUnitsIn(G, space), ...navalUnitsIn(G, space)]) delete G.units[unit.id];
  G.spaces[space].units = [];
};

/** Finish a land battle with a fixed outcome (the gwMajors.test.ts pattern). */
const resolveBattle = (
  G: ImperialElegyState,
  attacker: Power,
  from: string,
  to: string,
  winner: "attacker" | "defender",
  decisive: boolean,
): void => {
  const attack = landUnitsIn(G, from).filter((unit) => unit.owner === attacker);
  const defend = landUnitsIn(G, to).filter((unit) => hostileOwner(G, attacker, unit.owner));
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
  finishBattle(G, makeCtx([3]));
};

const italySetup = (): ImperialElegyState => {
  const G = gwState();
  G.persistent.italyUnified = true;
  expect(enterGwAlly(G, makeCtx(), "IT", "te", {independent: true}).ok).toBe(true);
  return G;
};

describe("Rome space (Papal States)", () => {
  test("is the printed Papal capital with the Italian unification symbol", () => {
    const rome = SPACES.rome;
    expect(rome).toBeDefined();
    expect(rome.name).toBe("Rome");
    expect(rome.nameZh).toBe("罗马");
    expect(rome.type).toBe("capital");
    expect(rome.keyType).toBe("territorial");
    expect(rome.region).toBe("europe");
    expect(rome.submap).toBe("main");
    expect(rome.control).toBe("Papal States");
    expect(rome.minorHome).toBe("Papal States");
    expect(rome.home).toBeNull();
    expect(rome.flashpoints).toContain("italy");
    expect(rome.nationalities).toEqual(["Italians"]);
    // No printed anchor: Rome is not a port.
    expect(rome.ports ?? []).toEqual([]);
  });

  test("registers the fourth Italian minor power and does not build", () => {
    expect(MINOR_POWER_HOMES["Papal States"]).toBe("rome");
    expect(START_BUILD_BOX).not.toContain("Papal States");
    expect(CAMPAIGN_SETUP.units.some((unit) => unit.owner === "Papal States")).toBe(false);
  });

  test("connects to Tuscany and Naples over the printed dashed lines", () => {
    const links = connectionsOf("rome").map((connection) => ({
      other: connection.a === "rome" ? connection.b : connection.a,
      type: connection.type,
    }));
    expect(links).toEqual(
      expect.arrayContaining([
        {other: "tuscany", type: "difficult"},
        {other: "naples", type: "difficult"},
      ]),
    );
    expect(neighboursOf("rome").sort()).toEqual(["naples", "tuscany"]);
  });

  test("does not change any power's printed key totals", () => {
    const G = setupImperialElegy(makeCtx());
    recomputeTracks(G);
    for (const power of POWERS) {
      const expected = PLAYBOOK_START_KEYS[power];
      expect(G.powers[power].territorialKeys).toBe(expected.territorial);
      expect(G.powers[power].colonialKeys).toBe(expected.colonial);
      if (expected.arab !== undefined) expect(G.powers[power].arabKeys).toBe(expected.arab);
    }
    // Rome is a key but not controlled by a player, so it is not counted.
    expect(SPACES.rome.keyType).toBe("territorial");
  });
});

describe("Rome and Italian unification", () => {
  test("Rome is one of the printed Italian unification spaces", () => {
    const G = setupImperialElegy(makeCtx());
    expect(italianKeys(G)).toEqual(expect.arrayContaining(["piedmont", "lombardy", "tuscany", "naples", "rome"]));
    expect(italianHomeKeys()).toContain("rome");
  });

  test("unification hands Rome (and the other minor homes) to Italy", () => {
    const G = setupImperialElegy(makeCtx());
    // Three Italian spaces under the two unifying minors triggers 22.2.
    G.spaces.piedmont.control = "Sardinia-Piedmont";
    G.spaces.naples.control = "Two Sicilies";
    G.spaces.tuscany.control = "Sardinia-Piedmont";

    expect(checkItalianUnification(G)).toBe(true);
    expect(G.persistent.italyUnified).toBe(true);
    expect(G.spaces.rome.control).toBe("IT");
    expect(G.spaces.tuscany.control).toBe("IT");
    // A player-controlled Italian space keeps its owner.
    expect(G.spaces.lombardy.control).toBe("AU");
    expect(G.spaces.rome.ally).toBeNull();
    expect(G.spaces.rome.diplomacy).toBeNull();
  });

  test("the Great War unification path also gives Rome to Italy", () => {
    const G = setupImperialElegy(makeCtx());
    unifyItaly(G, makeCtx(), "GE");
    expect(G.persistent.italyUnified).toBe(true);
    expect(G.spaces.rome.control).toBe("IT");
  });
});

describe("A070 Papal Influence", () => {
  const card = CARD_BY_ID["IE-A070"];

  test("allies the Papal States in Rome and removes an opposing marker", () => {
    const G = setupImperialElegy(makeCtx());
    G.spaces.rome.diplomacy = "GE";
    G.powers.FR.cardMarkers = 0;

    expect(resolveCard(G, makeCtx(), "FR", card)).toBe(true);

    expect(G.spaces.rome.ally).toBe("FR");
    expect(G.spaces.rome.diplomacy).toBeNull();
    expect(G.powers.FR.cardMarkers).toBe(0);
    expect(G.log.some((entry) => entry.key === "minorAlliance" && entry.args?.space === "rome")).toBe(true);
  });

  test("an already-allied player may target another Italian minor power for the +1 card marker", () => {
    const G = setupImperialElegy(makeCtx());
    G.spaces.rome.ally = "AU";
    G.spaces.tuscany.diplomacy = "FR";
    G.powers.AU.cardMarkers = 0;

    expect(resolveCard(G, makeCtx(), "AU", card)).toBe(false);
    expect(G.pending?.kind).toBe("eventTargetSpace");
    expect((G.pending?.options ?? []).map((option) => option.id)).toEqual(
      expect.arrayContaining(["piedmont", "tuscany", "naples"]),
    );
    expect((G.pending?.options ?? []).map((option) => option.id)).not.toContain("rome");

    resolveCardDecision(G, makeCtx(), G.pending!, "tuscany", {});

    expect(G.spaces.tuscany.ally).toBe("AU");
    expect(G.spaces.tuscany.diplomacy).toBeNull();
    // Allied to Rome and one other Italian minor: +1 card marker.
    expect(G.powers.AU.cardMarkers).toBe(1);
  });

  test("cannot trigger while the player dominates the Italy flashpoint", () => {
    const G = setupImperialElegy(makeCtx());
    for (const space of ["piedmont", "tuscany", "naples", "rome"]) G.spaces[space].control = "FR";
    expect(resolveCard(G, makeCtx(), "FR", card)).toBe(true);
    expect(G.spaces.rome.ally).toBeNull();
  });

  test("has no effect after Italy unifies", () => {
    const G = setupImperialElegy(makeCtx());
    G.persistent.italyUnified = true;
    expect(resolveCard(G, makeCtx(), "FR", card)).toBe(true);
    expect(G.spaces.rome.ally).toBeNull();
  });
});

describe("30.2 Italy's capital surrender", () => {
  test("a live capture of Rome surrenders Italy at once", () => {
    const G = italySetup();
    clearSpace(G, "tuscany");
    clearSpace(G, "rome");
    G.spaces.tuscany.control = "GE";
    G.spaces.rome.fort = null;
    placeUnit(G, "GE", "army", "tuscany", 2);
    placeUnit(G, "IT", "italianArmy", "rome", 2);

    resolveBattle(G, "GE", "tuscany", "rome", "attacker", false);

    expect(G.spaces.rome.occupiedBy).toBe("GE");
    expect(hasSurrendered(G, "IT")).toBe(true);
    expect(G.gw!.italySurrendered).toBe(true);
    expect(G.gw!.italyIn).toBe(false);
    expect(G.gw!.italyBudget).toBe(0);
    expect(Object.values(G.units).some((unit) => unit.owner === "IT")).toBe(false);
    // The capturing GE army may stay in Rome; no Italian counter remains.
    expect(G.spaces.rome.units.every((id) => G.units[id]?.owner !== "IT")).toBe(true);
    expect(G.log.some((entry) => entry.key === "gwItalyCapitalTaken")).toBe(true);
    const surrender = G.log.find((entry) => entry.key === "gwMajorSurrender");
    expect(surrender?.args).toMatchObject({major: "IT", reason: "capital"});
    // Re-entry is blocked.
    expect(enterGwAlly(G, makeCtx(), "IT", "ta").ok).toBe(false);
  });

  test("a pre-entry enemy occupation of Rome also surrenders Italy", () => {
    const G = gwState();
    G.persistent.italyUnified = true;
    G.spaces.rome.occupiedBy = "GE";

    const res = enterGwAlly(G, makeCtx(), "IT", "te", {independent: true});

    expect(res.ok).toBe(true);
    expect(hasSurrendered(G, "IT")).toBe(true);
    expect(G.gw!.italyIn).toBe(false);
    expect(res.ok && res.budget).toBe(0);
  });

  test("a friendly Rome has no effect", () => {
    const G = italySetup();
    clearSpace(G, "rome");
    G.spaces.rome.control = "IT";
    placeUnit(G, "IT", "italianArmy", "rome", 2);

    syncItalianHomeKeys(G);

    expect(hasSurrendered(G, "IT")).toBe(false);
    expect(G.gw!.italyStability).toBe(3);
    expect(G.spaces.rome.control).toBe("IT");
  });

  test("Italy's 0-stability surrender behaviour is unchanged", () => {
    const G = italySetup();
    clearSpace(G, "rome");
    placeUnit(G, "IT", "italianArmy", "rome", 2);

    const applied = changeGwMajorStability(G, "IT", -3, "test");

    expect(applied).toBe(-3);
    expect(hasSurrendered(G, "IT")).toBe(true);
    const surrender = G.log.find((entry) => entry.key === "gwMajorSurrender");
    expect(surrender?.args).toMatchObject({major: "IT", reason: "stability"});
    expect(Object.values(G.units).some((unit) => unit.owner === "IT")).toBe(false);
    expect(enterGwAlly(G, makeCtx(), "IT", "te").ok).toBe(false);
  });
});
