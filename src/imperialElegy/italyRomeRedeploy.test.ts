/**
 * 22.2 / 22.4 Italian Military.
 *
 * "When Italy unifies an Italian redeployment occurs.  When Italy redeploys, one
 * Italian standing army is placed in Rome and the other two Italian standing
 * armies are placed in spaces that are adjacent to player controlled spaces
 * (usually Piedmont and Lombardy).  If there are two such spaces, place an
 * Italian army in each space.  Italian naval units are always placed in Naples
 * or Piedmont if Naples is not Italian controlled."
 *
 * The old fixed Naples/Piedmont/Tuscany seeding is gone: the redeployment is
 * deterministic, idempotent, and never fields more than the five printed Italian
 * army counters (three standing armies plus the two 22.3.1 reserve armies).
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Unit} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {unifyItaly} from "./engine/greatWar";
import {establishItalianPresence, ITALIAN_ARMY_COUNTER_MAX, redeployItaly} from "./engine/greatWarFlow";
import {italianRedeployPlan, landUnitsIn, navalUnitsIn} from "./engine/rules";

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

const italianUnits = (G: ImperialElegyState): Unit[] =>
  Object.values(G.units).filter((unit) => unit.owner === "IT");

const italianArmies = (G: ImperialElegyState): Unit[] =>
  italianUnits(G).filter((unit) => unit.kind === "italianArmy");

const standingArmies = (G: ImperialElegyState): Unit[] =>
  italianArmies(G).filter((unit) => unit.space !== null && unit.space !== undefined);

const armyIn = (G: ImperialElegyState, space: string): boolean =>
  landUnitsIn(G, space).some((unit) => unit.owner === "IT" && unit.kind === "italianArmy");

const navyIn = (G: ImperialElegyState, space: string): number =>
  navalUnitsIn(G, space).filter((unit) => unit.owner === "IT").length;

const clearSpace = (G: ImperialElegyState, space: string): void => {
  for (const id of [...G.spaces[space].units]) delete G.units[id];
  G.spaces[space].units = [];
};

describe("22.4 the printed redeployment plan", () => {
  test("Rome plus the Italian spaces next to player-controlled spaces", () => {
    const G = fresh();
    unifyItaly(G, makeCtx(), "GE");

    // Lombardy is still an AU home key, so the frontier is Piedmont and
    // Tuscany (both touch AU-controlled Lombardy); Lombardy is not Italy's.
    expect(italianRedeployPlan(G)).toEqual({rome: "rome", adjacent: ["piedmont", "tuscany"], naval: "naples"});
  });

  test("Piedmont and Lombardy when Lombardy became Italian (the printed case)", () => {
    const G = fresh();
    clearSpace(G, "lombardy");
    G.spaces.lombardy.control = "Sardinia-Piedmont";
    unifyItaly(G, makeCtx(), "GE");

    expect(G.spaces.lombardy.control).toBe("IT");
    expect(italianRedeployPlan(G).adjacent).toEqual(["piedmont", "lombardy"]);
  });

  test("the naval grant moves to Piedmont when Naples is not Italian controlled", () => {
    const G = fresh();
    G.spaces.naples.control = "FR";
    unifyItaly(G, makeCtx(), "GE");

    // A player-controlled Naples stays with that player (22.2).
    expect(G.spaces.naples.control).toBe("FR");
    expect(italianRedeployPlan(G).naval).toBe("piedmont");
  });
});

describe("22.4 Italian redeployment on unification", () => {
  test("one army in Rome, one in each frontier space, and the squadron in Naples", () => {
    const G = fresh();
    unifyItaly(G, makeCtx(), "GE");

    expect(standingArmies(G)).toHaveLength(3);
    expect(italianArmies(G)).toHaveLength(3);
    expect(armyIn(G, "rome")).toBe(true);
    expect(armyIn(G, "piedmont")).toBe(true);
    expect(armyIn(G, "tuscany")).toBe(true);
    // The old fixed seeding put an army in Naples; the redeployment does not.
    expect(armyIn(G, "naples")).toBe(false);
    // 22.2's single naval squadron goes to Italian-controlled Naples.
    expect(navyIn(G, "naples")).toBe(1);
    expect(navyIn(G, "piedmont")).toBe(0);
  });

  test("Piedmont and Lombardy receive the two frontier armies", () => {
    const G = fresh();
    clearSpace(G, "lombardy");
    G.spaces.lombardy.control = "Sardinia-Piedmont";
    unifyItaly(G, makeCtx(), "GE");

    expect(armyIn(G, "rome")).toBe(true);
    expect(armyIn(G, "piedmont")).toBe(true);
    expect(armyIn(G, "lombardy")).toBe(true);
    expect(armyIn(G, "tuscany")).toBe(false);
    expect(italianArmies(G)).toHaveLength(3);
  });

  test("the naval grant falls back to Piedmont when Naples is player-held", () => {
    const G = fresh();
    G.spaces.naples.control = "FR";
    unifyItaly(G, makeCtx(), "GE");

    expect(navyIn(G, "piedmont")).toBe(1);
    expect(navyIn(G, "naples")).toBe(0);
    expect(italianArmies(G)).toHaveLength(3);
  });

  test("an enemy-occupied Naples sends the naval grant to Piedmont", () => {
    const G = fresh();
    G.spaces.naples.occupiedBy = "FR";
    unifyItaly(G, makeCtx(), "GE");

    expect(navyIn(G, "piedmont")).toBe(1);
    expect(navyIn(G, "naples")).toBe(0);
  });

  test("a player-held Rome receives no Italian army", () => {
    const G = fresh();
    G.spaces.rome.control = "FR";
    unifyItaly(G, makeCtx(), "GE");

    expect(G.spaces.rome.control).toBe("FR");
    expect(armyIn(G, "rome")).toBe(false);
    // The three standing armies still take the field in Italy's own spaces.
    expect(italianArmies(G)).toHaveLength(3);
    expect(italianArmies(G).every((unit) => unit.space !== null && G.spaces[unit.space!].control === "IT")).toBe(true);
  });

  test("an Italian-held Rome gets the army even when the frontier moves", () => {
    const G = fresh();
    G.spaces.rome.control = "IT";
    unifyItaly(G, makeCtx(), "GE");

    expect(armyIn(G, "rome")).toBe(true);
    expect(italianArmies(G)).toHaveLength(3);
  });
});

describe("22.4 establishment and idempotency", () => {
  test("establishItalianPresence uses the redeployment, not the old seeding", () => {
    const G = fresh();
    G.persistent.italyUnified = true;

    const placed = establishItalianPresence(G, makeCtx());

    expect(placed).toBeGreaterThan(0);
    expect(standingArmies(G)).toHaveLength(3);
    expect(armyIn(G, "rome")).toBe(true);
    expect(armyIn(G, "piedmont")).toBe(true);
    expect(armyIn(G, "tuscany")).toBe(true);
    expect(navyIn(G, "naples")).toBe(1);
  });

  test("a second unification/redeployment adds nothing", () => {
    const G = fresh();
    unifyItaly(G, makeCtx(), "GE");
    const before = italianUnits(G).length;

    unifyItaly(G, makeCtx(), "GE");
    establishItalianPresence(G, makeCtx());
    establishItalianPresence(G, makeCtx());
    redeployItaly(G, makeCtx());

    expect(italianUnits(G)).toHaveLength(before);
    expect(italianArmies(G)).toHaveLength(3);
  });

  test("a destroyed standing army is topped back up without exceeding the counters", () => {
    const G = fresh();
    unifyItaly(G, makeCtx(), "GE");
    const lost = italianArmies(G).find((unit) => unit.space === "tuscany");
    expect(lost).toBeTruthy();
    delete G.units[lost!.id];
    G.spaces.tuscany.units = G.spaces.tuscany.units.filter((id) => id !== lost!.id);

    redeployItaly(G, makeCtx());

    expect(standingArmies(G)).toHaveLength(3);
    // Rome and Piedmont already hold their army, so the replacement refills the
    // empty frontier slot (Tuscany) instead of stacking a second army.
    expect(armyIn(G, "tuscany")).toBe(true);
    expect(armyIn(G, "naples")).toBe(false);
  });

  test("never fields more than the five printed Italian army counters", () => {
    const G = fresh();
    unifyItaly(G, makeCtx(), "GE");
    expect(italianArmies(G)).toHaveLength(3);
    // The two 22.3.1 reserve armies are the fourth and fifth counters.
    for (const id of ["u-test-reserve", "u-test-reserve-2"]) {
      G.units[id] = {
        id,
        kind: "italianArmy",
        owner: "IT",
        steps: 2,
        space: null,
        naval: false,
      };
    }
    expect(italianArmies(G)).toHaveLength(ITALIAN_ARMY_COUNTER_MAX);

    const result = redeployItaly(G, makeCtx());

    expect(result.placed).toEqual([]);
    expect(italianArmies(G)).toHaveLength(ITALIAN_ARMY_COUNTER_MAX);
    expect(standingArmies(G)).toHaveLength(3);
  });
});

describe("22.4 a unified Italy holds its own territory", () => {
  test("Italian minor units give way and Italian spaces become Italy's", () => {
    const G = fresh();
    const minor = (owner: string): Unit | undefined =>
      Object.values(G.units).find((unit) => unit.owner === owner);
    expect(minor("Sardinia-Piedmont")).toBeTruthy();

    unifyItaly(G, makeCtx(), "GE");

    expect(Object.values(G.units).some((unit) => unit.owner === "Sardinia-Piedmont")).toBe(false);
    expect(Object.values(G.units).some((unit) => unit.owner === "Two Sicilies")).toBe(false);
    expect(G.spaces.piedmont.control).toBe("IT");
    expect(G.spaces.rome.control).toBe("IT");
    // Lombardy is an AU home: a player-controlled Italian space stays AU's.
    expect(G.spaces.lombardy.control).toBe("AU");
  });
});
