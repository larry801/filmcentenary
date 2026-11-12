/**
 * Rule 13.4.1 — Abandoning a Non-Player Power Ally.
 *
 * "Players are not required to fight with their minor power allies if the
 * latter is attacked.  A player ally can decline to enter a war after the
 * attacker announces their war aim thus abandoning the minor power."  The
 * abandoning player loses 1 stability and shifts away from the attacker, and
 * the declaration then proceeds without the player ally.  The decision is a
 * private `minorAbandon` pending owned by the player ally (the generic
 * pending panel renders it).
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {redactForView} from "./engine/privacy";
import {declareWar, resolvePending, declinePending} from "./moves";

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
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const beginAction = (G: ImperialElegyState, active: Power = "GE", cp = 4): void => {
  G.phase = "action";
  G.activePower = active;
  G.cpRemaining = cp;
  G.pending = null;
  G.war = null;
};

const lastLog = (G: ImperialElegyState, key: string) =>
  [...G.log].reverse().find((entry) => entry.key === key);

/** GE declares on Belgium, which is allied to FR (13.4: the printed case). */
const declareOnAlliedBelgium = (G: ImperialElegyState): void => {
  G.spaces.belgium.ally = "FR";
  beginAction(G);
  expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Belgium"}, "conquest", ["belgium"], 2)).toBeUndefined();
};

// ---------------------------------------------------------------------------
// The live abandonment option
// ---------------------------------------------------------------------------

describe("13.4.1 abandoning a non-player power ally", () => {
  test("the player ally is asked whether to fight or abandon before the war exists", () => {
    const G = fresh();
    declareOnAlliedBelgium(G);

    // The declaration is paid for and validated, but the war waits for the
    // ally's answer: "a player ally can decline ... after the attacker
    // announces their war aim".
    expect(G.pending?.kind).toBe("minorAbandon");
    expect(G.pending?.power).toBe("FR");
    expect(G.pending?.options.map((entry) => entry.id).sort()).toEqual(["abandon", "join"]);
    expect(G.war).toBeNull();
    expect(G.cpRemaining).toBe(2);
    expect(lastLog(G, "minorAllyAsked")?.args).toMatchObject({minor: "Belgium", power: "FR"});
  });

  test("joining creates the ordinary 13.4 war with the ally as defending primary", () => {
    const G = fresh();
    declareOnAlliedBelgium(G);

    expect(resolvePending(G, makeCtx([], seat("FR")), "join")).toBeUndefined();

    expect(G.war?.attacker).toBe("GE");
    expect(G.war?.defender).toBe("FR");
    expect(G.war?.minorTarget).toEqual({minor: "Belgium", ally: "FR"});
    expect(G.war?.defenderMinors).toEqual(["Belgium"]);
    // 14.2: the aiding player shifts away from the attacker.
    expect(G.powers.FR.alliance).toBe("teAligned");
    expect(G.phase).toBe("wartime");
    expect(G.pending).toBeNull();
  });

  test("abandoning costs 1 stability, shifts the ally away and records the unopposed war", () => {
    const G = fresh();
    declareOnAlliedBelgium(G);
    const stability = G.powers.FR.stability;

    expect(resolvePending(G, makeCtx([], seat("FR")), "abandon")).toBeUndefined();

    // The three printed consequences of 13.4.1.
    expect(G.powers.FR.stability).toBe(stability - 1);
    expect(G.powers.FR.alliance).toBe("teAligned");
    expect(lastLog(G, "minorAbandoned")?.args).toMatchObject({
      minor: "Belgium",
      stability: -1,
      from: "neutral",
      to: "teAligned",
    });
    // "proceed without the player ally": the non-player defends alone (15.4.2)
    // in a live war, and the declaration ledger still records it.
    expect(G.war).not.toBeNull();
    expect(G.war?.defender).toBe("Belgium");
    expect(G.war?.minorTarget).toEqual({minor: "Belgium", ally: null});
    expect(G.phase).toBe("wartime");
    expect(G.pending).toBeNull();
    expect(G.minorDeclarations).toHaveLength(1);
    expect(G.minorDeclarations?.[0]).toMatchObject({attacker: "GE", minor: "Belgium", aim: "conquest"});
    // The conquest declaration penalty still applies.
    expect(G.wtt).toBe(1);
  });

  test("an abandonment shift respects rule 8.4's three-player maximum", () => {
    const G = fresh();
    declareOnAlliedBelgium(G);
    // GE is TA-aligned, so the derived direction is away toward the Entente.
    G.powers.GE.alliance = "taAligned";
    for (const power of ["UK", "AU", "RU"] as const) G.powers[power].alliance = "teAligned";

    expect(resolvePending(G, makeCtx([], seat("FR")), "abandon")).toBeUndefined();

    expect(G.powers.FR.alliance).toBe("neutral");
    expect(lastLog(G, "allianceShifted")?.args).toMatchObject({steps: 0, blocked: true, abandonedMinor: "Belgium"});
  });

  test("the abandoning seat only can answer, and no other option is accepted", () => {
    const G = fresh();
    declareOnAlliedBelgium(G);
    const before = JSON.stringify(G);

    // Wrong seat (the attacker and an unrelated power) cannot answer.
    expect(resolvePending(G, makeCtx([], seat("GE")), "abandon")).toBe(INVALID_MOVE);
    expect(resolvePending(G, makeCtx([], seat("AU")), "abandon")).toBe(INVALID_MOVE);
    // Only join/abandon exist.
    expect(resolvePending(G, makeCtx([], seat("FR")), "attack")).toBe(INVALID_MOVE);
    expect(JSON.stringify(G)).toBe(before);
  });

  test("declining the decision keeps the pre-13.4.1 behaviour (fight for the ally)", () => {
    const G = fresh();
    declareOnAlliedBelgium(G);
    expect(declinePending(G, makeCtx([], seat("FR")))).toBeUndefined();
    expect(G.war?.defender).toBe("FR");
    expect(G.powers.FR.stability).toBe(3);
  });

  test("the decision is private to the player ally", () => {
    const G = fresh();
    declareOnAlliedBelgium(G);
    const other = redactForView(G, seat("GE"));
    expect(other.pending?.kind).toBe("minorAbandon");
    expect(other.pending?.power).toBe("FR");
    expect(other.pending?.options).toEqual([]);
    expect(other.pending?.context).toEqual({});
    // The deciding seat keeps the options and context.
    const owner = redactForView(G, seat("FR"));
    expect(owner.pending?.options.map((entry) => entry.id).sort()).toEqual(["abandon", "join"]);
    expect(owner.pending?.context?.minor).toBe("Belgium");
  });

  test("Italy's 13.4.1 influence is written to its own typed MPIT column", () => {
    const G = fresh();
    G.persistent.italyUnified = true;
    G.flags.italyUnified = true;
    G.spaces.rome.control = "IT";
    G.spaces.rome.ally = "FR";
    G.spaces.naples.control = "IT";
    G.spaces.naples.ally = "FR";
    beginAction(G);
    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Italy"}, "conquest", ["naples"], 2)).toBeUndefined();
    expect(G.pending?.kind).toBe("minorAbandon");
    expect(resolvePending(G, makeCtx([], seat("FR")), "abandon")).toBeUndefined();
    expect(lastLog(G, "minorAbandoned")?.args).toMatchObject({minor: "Italy", italyInfluence: 10});
    // 13.4.1 / 8.5: the attacked Italy gains 10 neutral influence on its own
    // MPIT column; the abandoning player's own MPIT is untouched.
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 10});
    expect(lastLog(G, "italyMpitGained")?.args).toMatchObject({
      amount: 10,
      track: "neutral",
      total: 10,
      reason: "abandoned",
    });
    expect(G.powers.FR.mpit.neutral).toBe(1);
  });
});
