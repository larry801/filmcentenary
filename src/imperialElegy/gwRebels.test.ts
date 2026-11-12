/**
 * 32.5 Rebels in the GW.
 *
 * "At the start of the GW if a space contains rebels and player units, the
 * player units immediately displace.  Unlike rebels prior to the GW, rebel and
 * non-rebel units cannot coexist in the same space during the GW.  ...
 * Rebel spaces never contain trenches."
 */
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {beginGwTurn} from "./engine/greatWarFlow";
import {displaceUnitsFromRebelSpaces} from "./engine/greatWar";
import {maneuverDestinationProblem} from "./engine/rules";

const makeCtx = (): Ctx =>
  ({
    playerID: "0",
    random: {Die: () => 3, Number: () => 1, Shuffle: (a: unknown[]) => a},
    events: {
      setActivePlayers: () => undefined,
      setPhase: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "gwManeuver",
  }) as unknown as Ctx;

const baseGw = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = {
    active: true,
    turn: 1,
    order: ["GE"],
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
  } as GreatWarState;
  G.phase = "gwManeuver";
  G.activePower = "GE";
  G.turnIndex = 0;
  G.pending = null;
  G.battle = null;
  G.war = null;
  return G;
};

describe("32.5 rebels in the Great War", () => {
  test("player units displace out of a rebel space at the outbreak", () => {
    const G = baseGw();
    G.spaces.berlin.control = "GE";
    const army = placeUnit(G, "GE", "army", "berlin", 2);
    const rebel = placeUnit(G, "REBEL:German", "rebelArmy", "berlin", 2);
    G.spaces.berlin.rebellion = {minor: "German Rebels", step: 1, rebels: [rebel.id]};
    const displaced = displaceUnitsFromRebelSpaces(G);
    expect(displaced).toBeGreaterThanOrEqual(1);
    expect(G.units[army.id].space).not.toBe("berlin");
    expect(G.units[rebel.id].space).toBe("berlin");
    expect(G.spaces.berlin.units).toContain(rebel.id);
    expect(G.spaces.berlin.units).not.toContain(army.id);
  });

  test("trench creation skips rebel spaces", () => {
    const G = baseGw();
    G.gw!.turn = 1;
    G.spaces.berlin.rebellion = {minor: "German Rebels", step: 0, rebels: []};
    G.spaces.pomerania.control = "GE";
    const begin = beginGwTurn(G, makeCtx());
    expect(begin.ok).toBe(true);
    expect(G.spaces.berlin.trenchLine).not.toBe(true);
    expect(G.gw!.trenches.berlin).toBeUndefined();
    // A normal key still gets its trench.
    expect(G.spaces.pomerania.trenchLine).toBe(true);
  });

  test("a GW maneuver cannot end in a rebel space", () => {
    const G = baseGw();
    G.spaces.pomerania.rebellion = {minor: "German Rebels", step: 1, rebels: []};
    G.spaces.berlin.control = "GE";
    const army = placeUnit(G, "GE", "army", "berlin", 2);
    const problem = maneuverDestinationProblem(G, "GE", {kind: "march", unitId: army.id, to: "pomerania"});
    expect(problem).toContain("rebels");
  });

  test("the helper is a no-op when there is no rebellion", () => {
    const G = baseGw();
    const army = placeUnit(G, "GE", "army", "berlin", 2);
    expect(displaceUnitsFromRebelSpaces(G)).toBe(0);
    expect(G.units[army.id].space).toBe("berlin");
  });
});
