/**
 * 22.4 Italian Military — the clauses the coverage map used to record as
 * approximations: lone-defender displacement, the reserve-army impulse,
 * earliest-allied commander and the one-industry treatment.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {createWarState, deployReserveLimit} from "./engine/limitedWar";
import {railAllowance} from "./engine/wartimeMovement";
import {
  ITALY_WARTIME_INDUSTRY,
  deployItalianReserveForGoal,
  displaceItalyForLoneDefense,
  italyWartimeCommander,
} from "./engine/italyMilitary";

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    events: {},
    turn: 1,
    phase: "action",
    random: {Die: () => 3, Number: () => 0.5, Shuffle: <T,>(a: T[]): T[] => a},
  }) as unknown as Ctx;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const italyState = (): ImperialElegyState => {
  const G = fresh();
  G.units = {};
  for (const state of Object.values(G.spaces)) state.units = [];
  G.persistent.italyUnified = true;
  G.flags.italyUnified = true;
  for (const space of ["piedmont", "lombardy", "tuscany", "naples", "rome"]) {
    G.spaces[space].control = "IT";
    G.spaces[space].occupiedBy = null;
  }
  return G;
};

const loneWar = (G: ImperialElegyState): WarState => {
  const war = createWarState(
    G,
    "FR",
    "IT" as unknown as Power,
    "conquest",
    ["piedmont", "lombardy"],
    3,
    {minor: {minor: "Italy", ally: null}},
  );
  G.war = war;
  return war;
};

describe("22.4 Italy defending alone", () => {
  test("standing armies outside Rome displace onto the targeted goals", () => {
    const G = italyState();
    const rome = placeUnit(G, "IT", "italianArmy", "rome", 2);
    const tuscan = placeUnit(G, "IT", "italianArmy", "tuscany", 2);
    const neapolitan = placeUnit(G, "IT", "italianArmy", "naples", 2);
    const war = loneWar(G);

    const displaced = displaceItalyForLoneDefense(G, war);

    // Rome is the capital and does not move; the other two fill the two goals
    // one per space, exactly as the printed plan reads.
    expect(G.units[rome.id].space).toBe("rome");
    expect(displaced).toHaveLength(2);
    expect(new Set(displaced.map((entry) => entry.to))).toEqual(new Set(["piedmont", "lombardy"]));
    expect([G.units[tuscan.id].space, G.units[neapolitan.id].space].sort())
      .toEqual(["lombardy", "piedmont"]);
    expect(G.log.some((entry) => entry.key === "italyLoneDisplacement")).toBe(true);
  });

  test("a reserve army deploys to the threatened goal first", () => {
    const G = italyState();
    placeUnit(G, "IT", "italianArmy", "rome", 2);
    const reserve = placeUnit(G, "IT", "italianArmy", null, 2);
    const war = loneWar(G);
    G.spaces.lombardy.occupiedBy = "AU";

    const placed = deployItalianReserveForGoal(G, war);

    expect(placed).not.toBeNull();
    expect(placed!.unitId).toBe(reserve.id);
    expect(placed!.to).toBe("lombardy");
    expect(G.spaces.lombardy.units).toContain(reserve.id);
    expect(G.log.some((entry) => entry.key === "italyReserveDeployed")).toBe(true);
  });
});

describe("22.4 wartime control and industry", () => {
  test("the earliest allied player in the initiative order commands Italy", () => {
    const G = italyState();
    const war = loneWar(G);
    war.defenderAllies = ["UK", "FR"];
    war.initiative = ["FR", "UK"];
    expect(italyWartimeCommander(G, war)).toBe("FR");

    // The printed order, not the order the declaration happened to name.
    war.initiative = ["UK", "FR"];
    expect(italyWartimeCommander(G, war)).toBe("UK");
  });

  test("an Italy with no player ally commands itself", () => {
    const G = italyState();
    const war = loneWar(G);
    war.defenderAllies = [];
    expect(italyWartimeCommander(G, war)).toBe("IT");
  });

  test("Italy is treated as 1 industry for deploy reserves", () => {
    const G = italyState();
    expect(ITALY_WARTIME_INDUSTRY).toBe(1);
    expect(deployReserveLimit(G, "IT")).toBe(1);
    expect(railAllowance(G, "IT")).toBe(1);
    // A normal power's own industry still wins.
    expect(deployReserveLimit(G, "GE")).toBe(Math.min(3, Math.max(1, Math.ceil(G.powers.GE.industry / 2))));
  });
});
