/**
 * 30.1 / 15.6 / 5.7 — the permanent-minor / orphan-commander sweep.
 *
 * 30.1 removes an eliminated player's markers and units.  A minor that has been
 * permanently eliminated (33.1 German Confederation, 22.2 Italian unification)
 * or whose controlling player is gone must not keep orphaned counters on the
 * map even when it was not under the eliminated power at the instant of
 * elimination.  Permanent minors lose every counter; orphaned minors follow
 * 5.7 (withdraw to a friendly space with a LoC, or leave play).  The winter step
 * runs the same sweep as a safety net, and each minor is logged once.
 */

import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {eliminatePower, sweepOrphanedMinorUnits} from "./engine/rules";
import {surrenderGwMajor} from "./engine/gwMajors";
import {resolveGwWinter} from "./engine/greatWarFlow";

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

const gwState = (): ImperialElegyState => {
  const G = fresh();
  G.gw = {
    active: true,
    turn: 1,
    order: ["FR", "GE"],
    belligerents: ["FR", "GE"],
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
  } as GreatWarState;
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.phase = "gwManeuver";
  return G;
};

const disbandLogs = (G: ImperialElegyState) => G.log.filter((entry) => entry.key === "minorUnitsDisbanded");
const logsFor = (G: ImperialElegyState, minor: string) => disbandLogs(G).filter((entry) => entry.args?.minor === minor);

describe("30.1 permanent minors leave play on a player elimination", () => {
  test("a permanently eliminated minor is swept even under another player's ally marker", () => {
    const G = gwState();
    G.eliminatedMinors = ["Bavaria"];
    // Bavaria is permanently gone but its ally marker still names the living FR:
    // GE's elimination must not be what makes the orphan visible.
    G.spaces.bavaria.control = "Bavaria";
    G.spaces.bavaria.ally = "FR";
    const army = placeUnit(G, "Bavaria", "army", "bavaria", 2);
    // Attached to the minor's army but owned by a surviving power: the sweep
    // must take the attached step with the permanently eliminated minor.
    const step = placeUnit(G, "FR", "eliteCorps", "bavaria", 1, {attachedTo: army.id});
    const ownerCount = Object.values(G.units).filter((unit) => unit.owner === "Bavaria").length;

    eliminatePower(G, "GE", makeCtx(), "capital");

    expect(G.units[army.id]).toBeUndefined();
    // 33.1 removes elite steps attached to the minor's counters too.
    expect(G.units[step.id]).toBeUndefined();
    expect(G.spaces.bavaria.units).not.toContain(army.id);
    expect(logsFor(G, "Bavaria")[0]?.args).toMatchObject({
      minor: "Bavaria",
      leaving: "GE",
      displaced: 0,
      eliminated: ownerCount + 1,
      permanent: true,
    });
  });

  test("a minor whose controlling player is already gone is swept at a later elimination", () => {
    const G = gwState();
    // AU was eliminated earlier (a stale save): Tuscany's ally marker still
    // names it, and the army sits in GE's territory.
    G.powers.AU.eliminated = true;
    G.gw!.ta = ["GE", "AU"];
    G.gw!.belligerents = ["FR", "GE", "AU"];
    G.spaces.tuscany.control = "Tuscany";
    G.spaces.tuscany.ally = "AU";
    G.spaces.silesia.control = "GE";
    const army = placeUnit(G, "Tuscany", "army", "silesia", 2);

    eliminatePower(G, "GE", makeCtx(), "capital");

    // 5.7: the orphan withdraws to its own home key.
    expect(G.units[army.id]).toBeDefined();
    expect(G.units[army.id].space).toBe("tuscany");
    expect(G.spaces.tuscany.ally).toBeNull();
    expect(logsFor(G, "Tuscany")[0]?.args).toMatchObject({
      minor: "Tuscany",
      displaced: 1,
      eliminated: 0,
      permanent: false,
      reason: "commanderEliminated",
    });
  });

  test("the sweep is idempotent and logs a minor once", () => {
    const G = gwState();
    G.eliminatedMinors = ["Bavaria"];
    placeUnit(G, "Bavaria", "army", "bavaria", 2);

    eliminatePower(G, "GE", makeCtx(), "capital");
    eliminatePower(G, "GE", makeCtx(), "capital");

    expect(logsFor(G, "Bavaria")).toHaveLength(1);
  });
});

describe("30.1 elimination leaves no stale occupation marker", () => {
  test("an eliminated power's occupation markers leave play with its units", () => {
    const G = gwState();
    G.spaces.westphalia.control = "FR";
    G.spaces.westphalia.occupiedBy = "GE";

    eliminatePower(G, "GE", makeCtx(), "capital");

    expect(G.spaces.westphalia.occupiedBy).toBeNull();
    // The surviving occupier's marker in another space is not touched.
    G.spaces.saxony.occupiedBy = "FR";
    eliminatePower(G, "GE", makeCtx(), "capital");
    expect(G.spaces.saxony.occupiedBy).toBe("FR");
  });

  test("a stale commander on a captured home is cleared so a minor logs once", () => {
    const G = gwState();
    G.powers.AU.eliminated = true;
    // Tuscany's home was captured but its ally marker still names the dead AU.
    G.spaces.tuscany.control = "GE";
    G.spaces.tuscany.ally = "AU";
    placeUnit(G, "Tuscany", "army", "silesia", 2);

    eliminatePower(G, "GE", makeCtx(), "capital");
    expect(G.spaces.tuscany.ally).toBeNull();
    expect(logsFor(G, "Tuscany")).toHaveLength(1);

    // The winter backstop finds no units and no stale commander: no second log.
    sweepOrphanedMinorUnits(G);
    expect(logsFor(G, "Tuscany")).toHaveLength(1);
  });
});

describe("30.1 winter safety net", () => {
  test("the winter sweep removes a permanent minor left by an earlier path", () => {
    const G = gwState();
    G.phase = "gwWinter";
    G.eliminatedMinors = ["Bavaria"];
    G.spaces.bavaria.control = "Bavaria";
    const army = placeUnit(G, "Bavaria", "army", "bavaria", 2);
    const ownerCount = Object.values(G.units).filter((unit) => unit.owner === "Bavaria").length;

    const result = resolveGwWinter(G, makeCtx());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(G.units[army.id]).toBeUndefined();
    expect(logsFor(G, "Bavaria")).toHaveLength(1);
    expect(logsFor(G, "Bavaria")[0]?.args).toMatchObject({permanent: true, eliminated: ownerCount});
  });

  test("22.2: a unified Italy's minor states are swept even without eliminatedMinors", () => {
    const G = gwState();
    G.phase = "gwWinter";
    G.persistent.italyUnified = true;
    G.spaces.tuscany.control = "Tuscany";
    const army = placeUnit(G, "Tuscany", "army", "tuscany", 2);
    const ownerCount = Object.values(G.units).filter((unit) => unit.owner === "Tuscany").length;

    const result = resolveGwWinter(G, makeCtx());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(G.units[army.id]).toBeUndefined();
    expect(logsFor(G, "Tuscany")[0]?.args).toMatchObject({permanent: true, eliminated: ownerCount});
  });

  test("a minor with a living commander is untouched by the winter sweep", () => {
    const G = gwState();
    G.phase = "gwWinter";
    G.spaces.tuscany.control = "Tuscany";
    G.spaces.tuscany.ally = "FR";
    const army = placeUnit(G, "Tuscany", "army", "tuscany", 2);

    const result = resolveGwWinter(G, makeCtx());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(G.units[army.id]).toBeDefined();
    expect(G.units[army.id].space).toBe("tuscany");
    expect(logsFor(G, "Tuscany")).toHaveLength(0);
  });
});

describe("30.2 a GW major's surrender runs the same sweep", () => {
  test("a permanently eliminated minor loses its counters when the US surrenders", () => {
    const G = gwState();
    G.gw!.usIn = true;
    G.persistent.usAlliance = "te";
    G.eliminatedMinors = ["Bavaria"];
    G.spaces.bavaria.control = "Bavaria";
    const army = placeUnit(G, "Bavaria", "army", "bavaria", 2);

    surrenderGwMajor(G, "US", "stability");

    expect(G.units[army.id]).toBeUndefined();
    expect(logsFor(G, "Bavaria")[0]?.args).toMatchObject({permanent: true});
  });
});
