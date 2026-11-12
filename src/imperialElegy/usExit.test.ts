/**
 * 32.1 US in the GW: "If Mexico and/or Canada are now enemies of the US, the US
 * (or US allies) must first occupy both Mexico and Canada (or one of them if
 * only one is enemy controlled) before US armies can leave the North America
 * submap."
 *
 * Before this round the only live US army move was march/rail, and the printed
 * map has no land route out of the North America inset — so the restriction was
 * unreachable.  12.3 naval transport (one land unit with the fleet) is now the
 * legal route, and it enforces the same gate.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {GreatWarState, ImperialElegyState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {enterGwAlly} from "./engine/greatWarFlow";
import {usArmyMayLeaveNorthAmerica, usCanLeaveNorthAmerica} from "./engine/gwMajors";
import {navalTransport, navalTransportCheck} from "./moves";
import {isArmyKind} from "./engine/rules";

/** The US slot is run by the first living TE power: France (seat 2). */
const seat = (power: "GE" | "FR") => String(POWERS.indexOf(power));

const makeCtx = (dieValue = 3): Ctx =>
  ({
    playerID: seat("FR"),
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
  // The US slot is run by the first living TE power (France here).
  G.activePower = "FR";
  G.turnIndex = G.gw!.order.indexOf("US");
  G.flags.gwAllyImpulse = "US";
  G.gw!.usBudget = 10;
  G.powers.FR.gwBudget = 5;
  return G;
};

const usUnits = (G: ImperialElegyState) => {
  const army = Object.values(G.units).find((unit) => unit.owner === "US" && isArmyKind(unit.kind))!;
  const fleet = Object.values(G.units).find((unit) => unit.owner === "US" && unit.naval)!;
  return {army, fleet};
};

/** The UK on the other GW side makes Canada an enemy gate space. */
const enemyCanada = (G: ImperialElegyState): void => {
  G.gw!.ta.push("UK");
  G.gw!.belligerents.push("UK");
  G.powers.UK.alliance = "taCommitted";
};

describe("32.1 live US army route out of North America", () => {
  test("a US army transport is refused while enemy Mexico is unoccupied", () => {
    const G = usSetup();
    expect(usCanLeaveNorthAmerica(G).required).toEqual(["mexico"]);
    const {army, fleet} = usUnits(G);
    const budget = G.gw!.usBudget;
    const ctx = makeCtx();

    expect(navalTransportCheck(G, "FR", army.id, [fleet.id], "brittany").reason).toBe("us-north-america");
    expect(navalTransport(G, ctx, army.id, [fleet.id], "brittany")).toBe(INVALID_MOVE);

    expect(G.units[army.id].space).toBe("the-south");
    expect(G.units[fleet.id].space).toBe("the-south");
    expect(G.gw!.usBudget).toBe(budget);
    expect(G.powers.FR.gwBudget).toBe(5);
    const blocked = G.log.filter((entry) => entry.key === "gwUsNorthAmericaBlocked").at(-1);
    expect(blocked?.args).toMatchObject({to: "brittany", required: "mexico", unoccupied: "mexico"});
  });

  test("occupying enemy Mexico unlocks the legal transport out of North America", () => {
    const G = usSetup();
    placeUnit(G, "FR", "army", "mexico", 2);
    expect(usCanLeaveNorthAmerica(G).allowed).toBe(true);
    const {army, fleet} = usUnits(G);
    const budget = G.gw!.usBudget;

    expect(usArmyMayLeaveNorthAmerica(G, army, "brittany")).toBe(true);
    expect(navalTransport(G, makeCtx(), army.id, [fleet.id], "brittany")).toBeUndefined();

    expect(G.units[army.id].space).toBe("brittany");
    expect(G.units[fleet.id].space).toBe("brittany");
    // The US impulse spends the US budget, not the commanding player's.
    expect(G.gw!.usBudget).toBe(budget - 1);
    expect(G.powers.FR.gwBudget).toBe(5);
    expect(G.log.filter((entry) => entry.key === "navalTransport").at(-1)?.args).toMatchObject({
      from: "the-south",
      to: "brittany",
      count: 2,
    });
  });

  test("a transport inside North America needs no gate occupation", () => {
    const G = usSetup();
    // Enemy Mexico is still unoccupied, but Canada is inside the submap.
    const {army, fleet} = usUnits(G);
    expect(navalTransport(G, makeCtx(), army.id, [fleet.id], "canada")).toBeUndefined();
    expect(G.units[army.id].space).toBe("canada");
  });

  test("both enemy gates must be occupied before the army can leave", () => {
    const G = usSetup();
    enemyCanada(G);
    expect(usCanLeaveNorthAmerica(G).required).toEqual(["mexico", "canada"]);

    placeUnit(G, "FR", "army", "mexico", 2);
    const {army, fleet} = usUnits(G);
    expect(usCanLeaveNorthAmerica(G).unoccupied).toEqual(["canada"]);
    expect(navalTransport(G, makeCtx(), army.id, [fleet.id], "brittany")).toBe(INVALID_MOVE);

    placeUnit(G, "US", "usArmy", "canada", 2);
    expect(usCanLeaveNorthAmerica(G).allowed).toBe(true);
    expect(navalTransport(G, makeCtx(), army.id, [fleet.id], "brittany")).toBeUndefined();
    expect(G.units[army.id].space).toBe("brittany");
  });
});
