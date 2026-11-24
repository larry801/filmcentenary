/**
 * Rule 15.4.1 / 14.0 — a unified Italy in a limited war.
 *
 * "Italy is controlled by their player ally who is the primary belligerent.
 * Italian units move and attack during the Italian wartime impulse, which is
 * always last.  They use the Italian budget, which always starts at 2."  Rule
 * 14.0 also lets "all minor power allies, and a unified Italy, join the war at
 * the primary belligerent's discretion."
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {classifyVictory, createWarState, joinWarAsMinor, recordWarKnockoutCapture} from "./engine/limitedWar";
import {cpBudgetFor} from "./engine/rules";
import {passWarMove, redeploy, resolvePending, resolveWar} from "./moves";

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    turn: 1,
    phase: "wartime",
    random: {Die: () => 3, Number: () => 0.5, Shuffle: <T,>(a: T[]): T[] => a},
  }) as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));
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
    G.spaces[space].ally = null;
  }
  return G;
};

/** UK attacks GE; FR is UK's player ally and Italy's ally, so FR commands it. */
const warWithItaly = (G: ImperialElegyState): WarState => {
  const war = createWarState(G, "UK", "GE", "conquest", ["brittany"], 2);
  war.status = "maneuver";
  war.initiative = ["UK", "FR", "GE"];
  war.attackerAllies = ["FR"];
  war.attackerMinors = ["Italy"];
  war.budgets.UK = 2;
  war.budgets.FR = 2;
  war.budgets.GE = 2;
  G.war = war;
  G.phase = "wartime";
  G.pending = null;
  G.activePower = "GE";
  war.passed = ["UK", "FR"];
  G.spaces.rome.ally = "UK";
  return war;
};

describe("14.0 unified Italy joins at the primary's discretion", () => {
  test("a unified Italy allied to the caller can join the war for free", () => {
    const G = italyState();
    const war = warWithItaly(G);
    war.attackerMinors = [];
    const joined = joinWarAsMinor(G, war, "UK", "Italy");
    expect(joined.applied).toBe(true);
    expect(war.attackerMinors).toContain("Italy");
  });
});

describe("15.4.1 the Italian wartime impulse", () => {
  test("it starts last, after every player passed, with its own 2 CP", () => {
    const G = italyState();
    const war = warWithItaly(G);
    expect(passWarMove(G, makeCtx(seat("GE")))).toBeUndefined();
    expect(G.flags.italyImpulse).toBe(true);
    expect(war.italyBudget).toBe(2);
    // 15.4.1: the primary belligerent (UK, the attacker) commands Italy.
    expect(G.activePower).toBe("UK");
    // The commander draws on Italy's 2 CP, not their own player budget.
    expect(cpBudgetFor(G, "UK")).toBe(2);
  });

  test("the commander moves an Italian army with Italy's budget", () => {
    const G = italyState();
    const war = warWithItaly(G);
    const army = placeUnit(G, "IT", "italianArmy", "rome", 2);
    expect(passWarMove(G, makeCtx(seat("GE")))).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(redeploy(G, makeCtx(seat("UK")), army.id, "tuscany")).toBeUndefined();
    expect(G.units[army.id].space).toBe("tuscany");
    expect(war.italyBudget).toBe(1);
  });

  test("passing the impulse ends it and settles the war", () => {
    const G = italyState();
    const war = warWithItaly(G);
    expect(passWarMove(G, makeCtx(seat("GE")))).toBeUndefined();
    expect(G.flags.italyImpulse).toBe(true);
    expect(passWarMove(G, makeCtx(seat("UK")))).toBeUndefined();
    expect(G.flags.italyImpulse).toBeUndefined();
    expect(war.italyBudget).toBe(0);
    // The settlement may open the treaty chooser; the impulse itself is over.
    expect(G.log.some((entry) => entry.key === "italyImpulseEnded")).toBe(true);
  });
});

describe("15.6 Rome knocks Italy out of the war", () => {
  test("the occupier records the knockout and the captor chooses the 16.1.6 option", () => {
    const G = italyState();
    const war = warWithItaly(G);
    G.spaces.rome.occupiedBy = "GE";

    expect(recordWarKnockoutCapture(G, "rome", "GE")).toBeNull();
    expect(war.italyKnockedOut).toMatchObject({captor: "GE", capital: "rome"});
    expect(war.attackerMinors).not.toContain("Italy");
    expect(G.log.some((entry) => entry.key === "italyKnockedOut")).toBe(true);

    const victory = classifyVictory(G, war);
    // 15.6 treats Italy as a knockout target: one 16.1.6 option, chosen by the
    // power that took Rome (GE, the defender here) — not auto-ceded.
    expect(victory.italyKnockout).toMatchObject({power: "Italy", by: "defender", captor: "GE"});
    expect(victory.totalTreatyOptions).toBe(1);
    expect(G.spaces.rome.control).toBe("IT");

    // All player belligerents have passed, so the war settles through the live
    // chooser instead of the removed deterministic cession.
    war.passed = ["UK", "FR", "GE"];
    const ctx = makeCtx(seat("GE"));
    expect(resolveWar(G, ctx)).toBeUndefined();
    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.power).toBe("GE");
    // UK won the primary; Italy was knocked out by the losing side (GE), so
    // 16.1.6 gives GE its mandatory Italy pick after the winner.
    expect(G.pending?.context?.stage).toBe("loser");
    expect((G.pending?.options ?? []).map((option) => option.id)).toContain("territorialCession#Italy");
    // Nothing is ceded until the captor answers.
    expect(G.spaces.rome.control).toBe("IT");

    expect(resolvePending(G, ctx, "territorialCession#Italy")).toBeUndefined();
    expect(G.spaces.rome.control).toBe("GE");
    expect(G.log.some((entry) => entry.key === "italyKnockoutCession")).toBe(true);
  });

  test("a direct settlement can still impose the occupied key as Italy's option", () => {
    const G = italyState();
    const war = warWithItaly(G);
    G.spaces.rome.occupiedBy = "GE";
    recordWarKnockoutCapture(G, "rome", "GE");
    const victory = classifyVictory(G, war);
    // Direct callers/tests name the treaty choice explicitly.
    const {settleLimitedWar} = require("./engine/limitedWar") as typeof import("./engine/limitedWar");
    const settlement = settleLimitedWar(G, victory, [
      {option: "territorialCession", spaces: ["rome"], target: "Italy"},
    ]);
    expect(settlement.ok).toBe(true);
    expect(G.spaces.rome.control).toBe("GE");
  });
});
