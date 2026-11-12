/**
 * 32.1: "If Mexico and/or Canada are now enemies of the US, the US (or US
 * allies) must first occupy both Mexico and Canada (or one of them if only one
 * is enemy controlled) before US armies can leave the North America submap."
 */
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {enterGwAlly, performGwManeuver} from "./engine/greatWarFlow";
import {usArmyMayLeaveNorthAmerica, usCanLeaveNorthAmerica} from "./engine/gwMajors";
import {landUnitsIn, navalUnitsIn} from "./engine/rules";
import {SPACES} from "./constant/spaces";

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
    phase: "gwManeuver",
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

/** A Great War with the US entered on the TE side, ready for a US impulse. */
const usSetup = (overrides: Partial<GreatWarState> = {}): ImperialElegyState => {
  const G = gwState(overrides);
  expect(enterGwAlly(G, makeCtx(), "US", "te").ok).toBe(true);
  // The US slot is run by the first living TE power.
  G.activePower = "FR";
  G.turnIndex = G.gw!.order.indexOf("US");
  G.flags.gwAllyImpulse = "US";
  G.gw!.usBudget = 10;
  return G;
};

const clearSpace = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...landUnitsIn(G, space), ...navalUnitsIn(G, space)]) delete G.units[unit.id];
  G.spaces[space].units = [];
};

/** Canada is British; put the UK on the US's side so Canada is friendly. */
const allyCanada = (G: ImperialElegyState): void => {
  G.gw!.te.push("UK");
  G.gw!.belligerents.push("UK");
  G.powers.UK.alliance = "teCommitted";
};

describe("32.1 usCanLeaveNorthAmerica", () => {
  test("is unrestricted before the US enters the Great War", () => {
    const G = gwState();
    G.spaces.mexico.control = "Mexico";
    const check = usCanLeaveNorthAmerica(G);
    expect(check).toEqual({allowed: true, required: [], unoccupied: []});
    const army = placeUnit(G, "US", "usArmy", "the-south", 2);
    expect(usArmyMayLeaveNorthAmerica(G, army, "berlin")).toBe(true);
  });

  test("enemy Mexico and enemy Canada must both be occupied", () => {
    const G = usSetup();
    // Mexico is an independent minor (hostile); Canada is British and the UK
    // is on the other GW side.
    G.gw!.ta.push("UK");
    G.gw!.belligerents.push("UK");
    G.spaces.mexico.control = "Mexico";

    const check = usCanLeaveNorthAmerica(G);
    expect(check.required).toEqual(["mexico", "canada"]);
    expect(check.unoccupied).toEqual(["mexico", "canada"]);
    expect(check.allowed).toBe(false);

    // The US seat occupies Mexico with an allied (FR) army.
    placeUnit(G, "FR", "army", "mexico", 2);
    expect(usCanLeaveNorthAmerica(G).unoccupied).toEqual(["canada"]);
    expect(usCanLeaveNorthAmerica(G).allowed).toBe(false);

    // A US army occupies Canada.
    placeUnit(G, "US", "usArmy", "canada", 2);
    expect(usCanLeaveNorthAmerica(G)).toEqual({allowed: true, required: ["mexico", "canada"], unoccupied: []});
  });

  test("only one enemy-controlled space must be occupied", () => {
    const G = usSetup();
    allyCanada(G);
    G.spaces.mexico.control = "Mexico";

    const check = usCanLeaveNorthAmerica(G);
    expect(check.required).toEqual(["mexico"]);
    expect(check.allowed).toBe(false);

    placeUnit(G, "US", "usArmy", "mexico", 2);
    expect(usCanLeaveNorthAmerica(G)).toEqual({allowed: true, required: ["mexico"], unoccupied: []});
  });

  test("a friendly Canada and a US-controlled Mexico need nothing occupied", () => {
    const G = usSetup();
    allyCanada(G);
    G.spaces.mexico.control = "United States";
    expect(usCanLeaveNorthAmerica(G)).toEqual({allowed: true, required: [], unoccupied: []});
  });

  test("a neutral Canada is not an enemy of the US", () => {
    const G = usSetup();
    // The UK stays neutral (not in te/ta), so Canada is not an enemy.
    expect(G.gw!.neutrals).toContain("UK");
    G.spaces.mexico.control = "United States";
    expect(usCanLeaveNorthAmerica(G).required).toEqual([]);
  });

  test("US armies inside North America are never restricted", () => {
    const G = usSetup();
    G.gw!.ta.push("UK");
    G.spaces.mexico.control = "Mexico";
    const army = Object.values(G.units).find((unit) => unit.owner === "US")!;
    expect(usArmyMayLeaveNorthAmerica(G, army, "canada")).toBe(true);
    expect(usArmyMayLeaveNorthAmerica(G, army, "mexico")).toBe(true);
  });

  test("US fleets are not armies and may leave North America", () => {
    const G = usSetup();
    G.gw!.ta.push("UK");
    G.spaces.mexico.control = "Mexico";
    const fleet = Object.values(G.units).find((unit) => unit.owner === "US" && unit.naval)!;
    expect(usArmyMayLeaveNorthAmerica(G, fleet, "north-atlantic")).toBe(true);
  });
});

describe("32.1 live US GW maneuver", () => {
  test("a US fleet may sail out of the South even while both gates are enemy-held", () => {
    const G = usSetup();
    G.gw!.ta.push("UK");
    G.spaces.mexico.control = "Mexico";
    const fleet = Object.values(G.units).find((unit) => unit.owner === "US" && unit.kind === "squadron")!;
    const budget = G.gw!.usBudget;

    const res = performGwManeuver(G, makeCtx(), {
      kind: "naval",
      power: "FR",
      unitIds: [fleet.id],
      to: "north-atlantic",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.units[fleet.id].space).toBe("north-atlantic");
    expect(G.gw!.usBudget).toBe(budget - 1);
  });

  test("a US army may march inside North America while the gate is unoccupied", () => {
    const G = usSetup();
    allyCanada(G);
    G.spaces.mexico.control = "Mexico";
    G.spaces.canada.control = "FR";
    const army = Object.values(G.units).find((unit) => unit.owner === "US")!;

    const res = performGwManeuver(G, makeCtx(), {kind: "march", power: "FR", unitId: army.id, to: "canada"});
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.units[army.id].space).toBe("canada");
  });

  test("a US army may not leave the submap while an enemy gate is unoccupied", () => {
    const G = usSetup();
    allyCanada(G);
    G.spaces.mexico.control = "Mexico";
    G.spaces.canada.control = "FR";
    const army = Object.values(G.units).find((unit) => unit.owner === "US")!;
    const budget = G.gw!.usBudget;
    // The printed map has no land route out of the North America inset, so mark
    // Canada as a main-map destination to exercise the maneuver boundary.
    const canada = SPACES.canada as {submap: string};
    const originalSubmap = canada.submap;
    canada.submap = "main";
    try {
      const res = performGwManeuver(G, makeCtx(), {kind: "march", power: "FR", unitId: army.id, to: "canada"});
      expect(res.ok).toBe(false);
      if (res.ok) throw new Error("expected the 32.1 restriction");
      expect(res.error).toBe("invalidTarget");
      expect(res.message).toContain("32.1");
      expect(G.units[army.id].space).toBe("the-south");
      expect(G.gw!.usBudget).toBe(budget);
      const blocked = G.log.filter((entry) => entry.key === "gwUsNorthAmericaBlocked").at(-1);
      expect(blocked?.args).toMatchObject({to: "canada", unoccupied: "mexico", required: "mexico"});
    } finally {
      canada.submap = originalSubmap;
    }
  });

  test("occupying the enemy gate unlocks the US army movement", () => {
    const G = usSetup();
    allyCanada(G);
    G.spaces.mexico.control = "Mexico";
    G.spaces.canada.control = "FR";
    placeUnit(G, "FR", "army", "mexico", 2);
    const army = Object.values(G.units).find((unit) => unit.owner === "US")!;
    const canada = SPACES.canada as {submap: string};
    const originalSubmap = canada.submap;
    canada.submap = "main";
    try {
      const res = performGwManeuver(G, makeCtx(), {kind: "march", power: "FR", unitId: army.id, to: "canada"});
      expect(res.ok).toBe(true);
      expect(G.units[army.id].space).toBe("canada");
    } finally {
      canada.submap = originalSubmap;
    }
  });
});
