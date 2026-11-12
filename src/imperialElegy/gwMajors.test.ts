/**
 * 30.2 / 32.1 / 32.2 / 29.1.1: US and Italian Great War stability and
 * surrender.
 */
import type {Ctx} from "boardgame.io";
import type {BattleState, GreatWarState, ImperialElegyState, Power, SpaceId} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {finishBattle} from "./engine/combat";
import {placeUnit, removeUnit} from "./engine/effects";
import {hostileOwner, isPower, landUnitsIn, navalUnitsIn} from "./engine/rules";
import {enterGwAlly, majorEntryOptions} from "./engine/greatWarFlow";
import {winter} from "./engine/greatWar";
import {
  changeGwMajorStability,
  forceLeaderFromOwners,
  italianHomeKeys,
  syncItalianHomeKeys,
  usNorthAtlanticCheck,
} from "./engine/gwMajors";
import {neighboursOf, SPACES} from "./constant/spaces";
import {logText as describeLogEntry} from "./components/logText";

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
    phase: "gwManeuver",
  } as unknown as Ctx;
};

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
  combatCardsInFront: [],
  ...overrides,
});

const clearSpace = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...landUnitsIn(G, space), ...navalUnitsIn(G, space)]) delete G.units[unit.id];
  G.spaces[space].units = [];
};

/** A GE (TA) vs FR (TE) Great War with nothing else going on. */
const gwSetup = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = gwState();
  G.phase = "gwManeuver";
  G.activePower = "FR";
  for (const power of POWERS) G.powers[power].gwBudget = 3;
  return G;
};

const usUnits = (G: ImperialElegyState) => Object.values(G.units).filter((u) => u.owner === "US");

const landNeighbour = (space: string, exclude: string[] = []): string =>
  neighboursOf(space).find((id) => SPACES[id]?.type !== "navalBox" && !exclude.includes(id))!;

/**
 * Finish a land battle with a fixed outcome.  The battle state is built the
 * way `beginLandBattle` builds it, but without rolling: `beginLandBattle`
 * resolves on the spot when no support/card window opens, so the dice would
 * otherwise decide the result.
 */
const resolveBattle = (
  G: ImperialElegyState,
  attacker: Power,
  from: string,
  to: string,
  winner: "attacker" | "defender",
  decisive: boolean,
  supportAttack: {space: SpaceId; unitId: string}[] = [],
): void => {
  const major = G.flags.gwAllyImpulse;
  const attack = landUnitsIn(G, from).filter((u) => u.owner === attacker || (major !== "" && u.owner === major));
  const defend = landUnitsIn(G, to).filter((u) => hostileOwner(G, attacker, u.owner));
  if (attack.length === 0 || defend.length === 0) throw new Error("no battle");
  const control = G.spaces[to].control;
  const defender = (defend.find((u) => isPower(u.owner))?.owner as Power | undefined)
    ?? (isPower(control) ? control : attacker);
  const battle: BattleState = {
    kind: "land",
    attacker,
    defender,
    from,
    to,
    mainAttack: attack.map((u) => u.id),
    mainDefense: defend.map((u) => u.id),
    forceOwners: {attacker: attack.map((u) => u.owner), defender: defend.map((u) => u.owner)},
    supportAttack: supportAttack.map((entry) => ({space: entry.space, units: [entry.unitId], fp: 2})),
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

describe("32.1 US stability", () => {
  test("each eliminated US army costs 1 stability; ships do not", () => {
    const G = gwSetup();
    expect(enterGwAlly(G, makeCtx(), "US", "te").ok).toBe(true);
    const [army] = usUnits(G).filter((u) => u.kind === "usArmy");
    const ship = usUnits(G).find((u) => u.naval)!;

    removeUnit(G, ship.id);
    expect(G.gw!.usStability).toBe(3);
    removeUnit(G, army.id);
    expect(G.gw!.usStability).toBe(2);
    expect(G.log.some((entry) => entry.key === "gwMajorStability")).toBe(true);
  });

  test("losing US armies is free before the US enters the war", () => {
    const G = gwSetup();
    const army = placeUnit(G, "US", "usArmy", "the-south", 2);
    removeUnit(G, army.id);
    expect(G.gw!.usStability).toBe(3);
  });

  test("the third lost army surrenders the US: all units go and it cannot re-enter", () => {
    const G = gwSetup();
    expect(enterGwAlly(G, makeCtx(), "US", "te").ok).toBe(true);
    const armies = usUnits(G).filter((u) => u.kind === "usArmy");
    expect(armies).toHaveLength(3);
    for (const army of armies) removeUnit(G, army.id);

    expect(G.gw!.usStability).toBe(0);
    expect(G.gw!.usSurrendered).toBe(true);
    expect(G.gw!.usIn).toBe(false);
    expect(G.gw!.usBudget).toBe(0);
    expect(usUnits(G)).toHaveLength(0);
    expect(G.spaces["the-south"].units.some((id) => !G.units[id])).toBe(false);
    expect(majorEntryOptions(G, "FR")).not.toContain("US");
    expect(enterGwAlly(G, makeCtx(), "US", "te").ok).toBe(false);
    const surrender = G.log.find((entry) => entry.key === "gwMajorSurrender")!;
    expect(surrender.args).toMatchObject({major: "US", reason: "stability", removed: 3});
  });

  test("a decisive defeat of a US-led force costs the US, not its controller", () => {
    const G = gwSetup();
    expect(enterGwAlly(G, makeCtx(), "US", "te").ok).toBe(true);
    // A GE-held land space next to another land space for the US to attack from.
    const target = Object.values(SPACES).find(
      (def) => def.submap === "main" && def.type !== "navalBox" && neighboursOf(def.id).some((id) => SPACES[id]?.type !== "navalBox"),
    )!.id;
    const from = landNeighbour(target);
    clearSpace(G, target);
    clearSpace(G, from);
    G.spaces[target].fort = null;
    G.spaces[from].control = "FR";
    placeUnit(G, "GE", "army", target, 2);
    placeUnit(G, "US", "usArmy", from, 2);
    placeUnit(G, "US", "usArmy", from, 2);
    G.flags.gwAllyImpulse = "US";
    const frStability = G.powers.FR.stability;

    resolveBattle(G, "FR", from, target, "defender", true);

    expect(G.gw!.usStability).toBe(2);
    expect(G.powers.FR.stability).toBe(frStability);
  });

  test("a one-unit force is below the decisive-battle threshold", () => {
    const G = gwSetup();
    expect(enterGwAlly(G, makeCtx(), "US", "te").ok).toBe(true);
    const target = Object.values(SPACES).find(
      (def) => def.submap === "main" && def.type !== "navalBox" && neighboursOf(def.id).some((id) => SPACES[id]?.type !== "navalBox"),
    )!.id;
    const from = landNeighbour(target);
    clearSpace(G, target);
    clearSpace(G, from);
    G.spaces[target].fort = null;
    placeUnit(G, "GE", "army", target, 2);
    placeUnit(G, "US", "usArmy", from, 2);
    G.flags.gwAllyImpulse = "US";

    resolveBattle(G, "FR", from, target, "defender", true);
    expect(G.gw!.usStability).toBe(3);
  });

  test("30.0: a supporting army counts towards the decisive-battle threshold", () => {
    const G = gwSetup();
    expect(enterGwAlly(G, makeCtx(), "US", "te").ok).toBe(true);
    // Prussia borders both Berlin (the attack space) and Pomerania (the target),
    // so it can provide the one supporting army.
    const target = "pomerania";
    const from = "berlin";
    const support = "prussia";
    clearSpace(G, target);
    clearSpace(G, from);
    clearSpace(G, support);
    G.spaces[target].fort = null;
    placeUnit(G, "GE", "army", target, 2);
    placeUnit(G, "US", "usArmy", from, 2);
    const supportingArmy = placeUnit(G, "US", "usArmy", support, 2).id;
    G.flags.gwAllyImpulse = "US";

    // One US army in the main force plus one supporting US army is a defeated
    // force of two armies, so the US loses 1 stability (30.0 footnote).
    resolveBattle(G, "FR", from, target, "defender", true, [{space: support, unitId: supportingArmy}]);
    expect(G.gw!.usStability).toBe(2);
  });

  test("the force leader is the majority owner of the main force", () => {
    expect(forceLeaderFromOwners(["US", "US", "FR"])).toBe("US");
    expect(forceLeaderFromOwners(["US", "FR"])).toBeNull();
    expect(forceLeaderFromOwners(["IT", "IT"])).toBe("IT");
    expect(forceLeaderFromOwners(["GE"])).toBeNull();
  });

  test("enemy ships in the North Atlantic cost 1 stability at winter", () => {
    const G = gwSetup();
    expect(enterGwAlly(G, makeCtx(), "US", "te").ok).toBe(true);
    clearSpace(G, "north-atlantic");
    placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    expect(usNorthAtlanticCheck(G)).toBe(0);

    placeUnit(G, "GE", "squadron", "north-atlantic", 2);
    G.phase = "gwWinter";
    winter(G, makeCtx([3]));
    expect(G.gw!.usStability).toBe(2);
    expect(G.log.find((entry) => entry.key === "gwMajorStability")?.args).toMatchObject({cause: "northAtlantic"});
  });

  test("the North Atlantic check ignores a US that has not entered", () => {
    const G = gwSetup();
    clearSpace(G, "north-atlantic");
    placeUnit(G, "GE", "squadron", "north-atlantic", 2);
    expect(usNorthAtlanticCheck(G)).toBe(0);
    expect(G.gw!.usStability).toBe(3);
  });
});

describe("32.2 Italian stability", () => {
  const italySetup = (): ImperialElegyState => {
    const G = gwSetup();
    G.persistent.italyUnified = true;
    expect(enterGwAlly(G, makeCtx(), "IT", "te").ok).toBe(true);
    return G;
  };

  test("Italy's home keys are the Italian-flashpoint keys outside AU's home", () => {
    const keys = italianHomeKeys();
    expect(keys).toEqual(expect.arrayContaining(["piedmont", "tuscany", "naples"]));
    expect(keys).not.toContain("lombardy");
  });

  test("an enemy capture costs 1 once, and a friendly recapture gives it back", () => {
    const G = italySetup();
    const from = landNeighbour("naples");
    clearSpace(G, "naples");
    clearSpace(G, from);
    G.spaces.naples.fort = null;
    placeUnit(G, "IT", "italianArmy", "naples", 2);
    placeUnit(G, "GE", "army", from, 2);

    resolveBattle(G, "GE", from, "naples", "attacker", false);
    expect(G.spaces.naples.occupiedBy).toBe("GE");
    expect(G.gw!.italyStability).toBe(2);
    expect(G.gw!.italyLostKeys).toEqual(["naples"]);

    // Re-syncing does not charge the same loss twice.
    syncItalianHomeKeys(G);
    expect(G.gw!.italyStability).toBe(2);

    // FR (Italy's side) drives GE out.
    const frFrom = landNeighbour("naples", [from]) ?? from;
    clearSpace(G, frFrom);
    G.spaces[frFrom].control = "FR";
    G.spaces[frFrom].occupiedBy = null;
    placeUnit(G, "FR", "army", frFrom, 2);
    resolveBattle(G, "FR", frFrom, "naples", "attacker", false);
    expect(G.spaces.naples.occupiedBy).toBe("FR");
    expect(G.gw!.italyStability).toBe(3);
    expect(G.gw!.italyLostKeys).toEqual([]);
  });

  test("keys already lost when Italy enters are the baseline", () => {
    const G = gwSetup();
    G.persistent.italyUnified = true;
    G.spaces.naples.occupiedBy = "GE";
    expect(enterGwAlly(G, makeCtx(), "IT", "te").ok).toBe(true);
    expect(G.gw!.italyLostKeys).toEqual(["naples"]);
    syncItalianHomeKeys(G);
    expect(G.gw!.italyStability).toBe(3);
  });

  test("a decisive defeat of an Italian-led force costs Italy", () => {
    const G = italySetup();
    const from = landNeighbour("tuscany");
    clearSpace(G, "tuscany");
    clearSpace(G, from);
    G.spaces.tuscany.fort = null;
    placeUnit(G, "IT", "italianArmy", "tuscany", 2);
    placeUnit(G, "IT", "italianArmy", "tuscany", 2);
    placeUnit(G, "GE", "army", from, 2);
    const frStability = G.powers.FR.stability;

    // GE wins decisively; the Italian defenders retreat.  The capture and the
    // decisive defeat are separate losses.
    resolveBattle(G, "GE", from, "tuscany", "attacker", true);
    expect(G.gw!.italyStability).toBe(1);
    expect(G.powers.FR.stability).toBe(frStability);
  });

  test("losing three home keys surrenders Italy and removes its units", () => {
    const G = italySetup();
    // Keep Italian units elsewhere so the removal is visible.
    clearSpace(G, "naples");
    placeUnit(G, "IT", "squadron", "western-mediterranean", 2);
    for (const key of ["piedmont", "tuscany", "naples"]) G.spaces[key].occupiedBy = "GE";
    syncItalianHomeKeys(G);

    expect(G.gw!.italyStability).toBe(0);
    expect(G.gw!.italySurrendered).toBe(true);
    expect(G.gw!.italyIn).toBe(false);
    expect(Object.values(G.units).filter((u) => u.owner === "IT")).toHaveLength(0);
    expect(majorEntryOptions(G, "FR")).not.toContain("IT");
  });

  test("stability is capped at 3", () => {
    const G = italySetup();
    expect(changeGwMajorStability(G, "IT", 1, "homeKeyRetaken")).toBe(0);
    expect(G.gw!.italyStability).toBe(3);
  });

  test("the new log entries render in both locales", () => {
    const G = italySetup();
    G.spaces.naples.occupiedBy = "GE";
    syncItalianHomeKeys(G);
    G.spaces.piedmont.occupiedBy = "GE";
    G.spaces.tuscany.occupiedBy = "GE";
    syncItalianHomeKeys(G);
    for (const key of ["gwMajorStability", "gwMajorSurrender"]) {
      const entry = G.log.find((item) => item.key === key)!;
      expect(describeLogEntry(entry, "en")).not.toMatch(key);
      expect(describeLogEntry(entry, "zh_CN")).not.toMatch(key);
    }
    const stability = G.log.find((item) => item.key === "gwMajorStability")!;
    expect(describeLogEntry(stability, "en")).toMatch(/Naples/);
  });
});
