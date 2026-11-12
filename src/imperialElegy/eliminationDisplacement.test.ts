/**
 * 15.6 / 30.1 unit displacement out of a departed power's territory.
 *
 * 15.6: "When a player ally (or Italy) is knocked out, displace any allied
 * units in their territory.  Do not displace any enemy units in occupied
 * spaces, those units will displace at the end of the war."
 *
 * 30.1: a player's surrender/elimination removes that player's units and
 * markers; 5.7 moves an allied land unit to the closest friendly controlled
 * space with a LoC (or a naval unit to an adjacent naval box), and eliminates
 * it when no such space exists.
 */
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power, WarState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {
  displacementTargetForLoc,
  eliminatePower,
  removeAllUnitsOf,
  resolveCapitalSurrenders,
} from "./engine/rules";
import {surrenderGwMajor} from "./engine/gwMajors";
import {recordWarKnockoutCapture} from "./engine/limitedWar";

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

const gwState = (overrides: Partial<GreatWarState> = {}): ImperialElegyState => {
  const G = fresh();
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

const unitDisplacements = (G: ImperialElegyState) =>
  G.log.filter((entry) => entry.key === "unitDisplaced" && entry.args?.territory !== undefined);

/** Remove AU's units and controlled keys so it has no friendly LoC space left. */
const stripAuSupply = (G: ImperialElegyState): void => {
  removeAllUnitsOf(G, "AU");
  for (const space of Object.keys(G.spaces)) {
    if (G.spaces[space].control === "AU") G.spaces[space].control = null;
  }
};

describe("30.1 a player elimination displaces allied units in its territory", () => {
  test("an allied land unit moves to the closest friendly space with a LoC", () => {
    const G = gwState({order: ["FR", "GE", "AU"], te: ["FR"], ta: ["GE", "AU"], belligerents: ["FR", "GE", "AU"]});
    G.powers.AU.alliance = "taCommitted";
    const au = placeUnit(G, "AU", "army", "silesia", 2);
    G.spaces.berlin.occupiedBy = "FR";

    expect(resolveCapitalSurrenders(G, makeCtx())).toEqual(["GE"]);

    expect(G.powers.GE.eliminated).toBe(true);
    expect(G.units[au.id]).toBeDefined();
    const landed = G.units[au.id].space;
    expect(landed).not.toBe("silesia");
    expect(G.spaces[landed!].control).not.toBe("GE");
    // The unit left the eliminated power's territory for the closest friendly
    // controlled space with a LoC (5.7), here the reassigned Saxony ally.
    expect(displacementTargetForLoc(G, "AU", "silesia")).toBe(landed);
    expect(G.spaces.silesia.units).not.toContain(au.id);
    const entry = unitDisplacements(G)[0];
    expect(entry.args).toMatchObject({unit: au.id, owner: "AU", from: "silesia", to: landed, territory: "GE"});
  });

  test("enemy units in occupied spaces stay put (15.6)", () => {
    const G = gwState();
    const enemy = placeUnit(G, "FR", "army", "silesia", 2);
    const ally = placeUnit(G, "AU", "army", "silesia", 2);
    G.powers.AU.alliance = "taCommitted";
    G.gw!.ta.push("AU");
    G.spaces.berlin.occupiedBy = "FR";

    eliminatePower(G, "GE", makeCtx(), "capital");

    expect(G.units[enemy.id].space).toBe("silesia");
    expect(G.units[ally.id].space).not.toBe("silesia");
    expect(unitDisplacements(G).map((entry) => entry.args?.unit)).toEqual([ally.id]);
  });

  test("an allied naval unit displaces to an adjacent naval box", () => {
    const G = gwState();
    G.powers.AU.alliance = "taCommitted";
    G.gw!.ta.push("AU");
    const fleet = placeUnit(G, "AU", "squadron", "pomerania", 2);
    G.spaces.berlin.occupiedBy = "FR";

    eliminatePower(G, "GE", makeCtx(), "capital");

    expect(G.units[fleet.id].space).toBe("baltic-sea");
    expect(unitDisplacements(G)[0].args).toMatchObject({unit: fleet.id, kind: "naval", to: "baltic-sea"});
  });

  test("a unit with no friendly LoC space is eliminated by 5.7", () => {
    const G = gwState();
    G.powers.AU.alliance = "taCommitted";
    G.gw!.ta.push("AU");
    // Strip AU of every unit and controlled home key so it has no friendly
    // space with a LoC anywhere.
    stripAuSupply(G);
    const stranded = placeUnit(G, "AU", "army", "silesia", 2);
    G.spaces.berlin.occupiedBy = "FR";

    eliminatePower(G, "GE", makeCtx(), "capital");

    expect(G.units[stranded.id]).toBeUndefined();
    expect(unitDisplacements(G)).toHaveLength(1);
    expect(unitDisplacements(G)[0].args).toMatchObject({eliminated: true, territory: "GE"});
  });

  test("a US army allied to the eliminated power leaves its territory", () => {
    const G = gwState({te: ["FR"], ta: ["GE", "AU"], belligerents: ["FR", "GE", "AU"], order: ["FR", "GE", "AU"]});
    G.powers.AU.alliance = "taCommitted";
    G.gw!.usIn = true;
    G.flags.usSide = "ta";
    const us = placeUnit(G, "US", "usArmy", "silesia", 2);
    G.spaces.berlin.occupiedBy = "FR";

    eliminatePower(G, "GE", makeCtx(), "capital");

    expect(G.units[us.id]).toBeDefined();
    const landed = G.units[us.id].space!;
    expect(landed).not.toBe("silesia");
    expect(G.spaces[landed].control).not.toBe("GE");
    // 5.7: a major displaces into its alliance's friendly LoC network.
    expect(unitDisplacements(G)[0].args).toMatchObject({unit: us.id, owner: "US", territory: "GE"});
  });

  test("an eliminated power's own units are removed, not displaced", () => {
    const G = gwState();
    const own = placeUnit(G, "GE", "army", "silesia", 2);
    G.spaces.berlin.occupiedBy = "FR";

    eliminatePower(G, "GE", makeCtx(), "capital");

    expect(G.units[own.id]).toBeUndefined();
    expect(unitDisplacements(G)).toHaveLength(0);
  });

  test("only formerly controlled territory is affected", () => {
    const G = gwState();
    G.powers.AU.alliance = "taCommitted";
    G.gw!.ta.push("AU");
    const inSaxony = placeUnit(G, "AU", "army", "saxony", 2);
    const inBohemia = placeUnit(G, "AU", "army", "bohemia", 2);
    G.spaces.berlin.occupiedBy = "FR";

    eliminatePower(G, "GE", makeCtx(), "capital");

    // Saxony is a minor's space, Bohemia is an AU home: neither is GE territory.
    expect(G.units[inSaxony.id].space).toBe("saxony");
    expect(G.units[inBohemia.id].space).toBe("bohemia");
    expect(unitDisplacements(G)).toHaveLength(0);
  });
});

describe("15.6 a knocked-out limited-war ally displaces allied units", () => {
  const knockoutState = (): {G: ImperialElegyState; war: WarState} => {
    const G = fresh();
    const war = makeWar("GE", "AU", {defenderAllies: ["RU"]});
    G.war = war;
    G.powers.AU.alliance = "taCommitted";
    G.powers.RU.alliance = "taCommitted";
    G.powers.GE.alliance = "teCommitted";
    return {G, war};
  };

  test("an allied unit leaves the knocked-out power's territory; its own units stay", () => {
    const {G} = knockoutState();
    const ally = placeUnit(G, "AU", "army", "moscow", 2);
    const own = placeUnit(G, "RU", "army", "moscow", 2);

    expect(recordWarKnockoutCapture(G, "st-petersburg", "GE")).toMatchObject({power: "RU"});

    const landed = G.units[ally.id].space!;
    expect(landed).not.toBe("moscow");
    // The unit is displaced *out of* the knocked-out power's territory.
    expect(G.spaces[landed].control).not.toBe("RU");
    expect(G.units[own.id].space).toBe("moscow");
    expect(unitDisplacements(G).map((entry) => entry.args?.unit)).toEqual([ally.id]);
    expect(unitDisplacements(G)[0].args).toMatchObject({from: "moscow", territory: "RU"});
  });

  test("the knockout is recorded once, so the displacement runs once", () => {
    const {G} = knockoutState();
    placeUnit(G, "AU", "army", "moscow", 2);
    recordWarKnockoutCapture(G, "st-petersburg", "GE");
    recordWarKnockoutCapture(G, "st-petersburg", "GE");

    expect(unitDisplacements(G)).toHaveLength(1);
  });

  test("a unit with no destination is eliminated", () => {
    const {G} = knockoutState();
    stripAuSupply(G);
    const stranded = placeUnit(G, "AU", "army", "moscow", 2);

    recordWarKnockoutCapture(G, "st-petersburg", "GE");

    expect(G.units[stranded.id]).toBeUndefined();
    expect(unitDisplacements(G)[0].args).toMatchObject({eliminated: true, territory: "RU"});
  });
});

describe("30.2 / 15.6 a surrendered major's territory is cleared too", () => {
  test("Italy's surrender displaces allied units out of Italian territory", () => {
    const G = gwState({
      order: ["FR", "IT"],
      te: ["FR"],
      ta: ["GE", "AU"],
      belligerents: ["FR", "GE", "AU"],
    });
    G.gw!.italyIn = true;
    G.gw!.italyAlliance = "taCommitted";
    G.flags.italySide = "ta";
    G.powers.AU.alliance = "taCommitted";
    G.spaces.rome.control = "IT";
    G.spaces.tuscany.control = "IT";
    const ally = placeUnit(G, "AU", "army", "rome", 2);
    const expected = displacementTargetForLoc(G, "AU", "rome");

    surrenderGwMajor(G, "IT", "capital", makeCtx());

    expect(G.gw!.italySurrendered).toBe(true);
    expect(G.units[ally.id]).toBeDefined();
    expect(G.units[ally.id].space).toBe(expected);
    expect(unitDisplacements(G)[0].args).toMatchObject({unit: ally.id, from: "rome", territory: "IT"});
  });

  test("the US keeps no allied units in its home space, so its surrender displaces nothing", () => {
    const G = gwState();
    G.gw!.usIn = true;
    G.flags.usSide = "te";
    G.spaces["the-south"].control = "United States";
    placeUnit(G, "US", "usArmy", "the-south", 2);

    surrenderGwMajor(G, "US", "stability", makeCtx());

    expect(G.gw!.usSurrendered).toBe(true);
    expect(unitDisplacements(G)).toHaveLength(0);
  });
});
