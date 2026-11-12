/**
 * Rule 8.2 — the unified-Italy random declaration shift.
 *
 * "If a unified Italy is attacked by a neutral player and it is not aided by a
 * player [13.4.2], randomly determine where Italy shifts by rolling a die
 * (1-3 Triple Entente, 4-6 Triple Alliance)."  Italy is not a player power:
 * its chit lives outside the six MPIT columns, so the shift goes through
 * `engine/italyEntry.ts#shiftItalyToward` and rule 8.4's cap does not apply.
 *
 * The live path is `declareWar` with the typed `{minor: "Italy"}` target.  A
 * unified Italy with no player ally defends alone (15.4.2): the declaration
 * creates a live `WarState` whose typed `minorTarget` has `ally: null` and
 * whose `defender` is Italy's control id ("IT"), and it is also recorded on
 * `G.minorDeclarations` with the printed shift.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {italyDeclarationShift} from "./engine/alliance";
import {declareWar, resolvePending} from "./moves";

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

/** A unified Italy holding Rome and Naples, with no player ally. */
const unifyItaly = (G: ImperialElegyState): void => {
  G.persistent.italyUnified = true;
  G.flags.italyUnified = true;
  G.persistent.italyAlliance = "neutral";
  G.spaces.rome.control = "IT";
  G.spaces.rome.ally = null;
  G.spaces.rome.diplomacy = null;
  G.spaces.naples.control = "IT";
  G.spaces.naples.ally = null;
};

const beginAction = (G: ImperialElegyState, active: Power = "GE", cp = 4): void => {
  G.phase = "action";
  G.activePower = active;
  G.cpRemaining = cp;
  G.pending = null;
  G.war = null;
  G.wtt = 0;
};

const lastLog = (G: ImperialElegyState, key: string) =>
  [...G.log].reverse().find((entry) => entry.key === key);

/**
 * 13.4.2: every printed aid candidate declines, so the declaration reaches the
 * unopposed path where 8.2's random Italy shift is rolled.
 */
const declineAllAid = (G: ImperialElegyState, finalDice: number[] = []): void => {
  let guard = 0;
  while (G.pending?.kind === "minorAid" && guard < 10) {
    guard += 1;
    expect(resolvePending(G, makeCtx(finalDice, seat(G.pending.power)), "decline")).toBeUndefined();
  }
  expect(G.pending).toBeNull();
};

// ---------------------------------------------------------------------------
// Pure helper
// ---------------------------------------------------------------------------

describe("8.2 unified-Italy shift helper", () => {
  test("a roll of 1-3 shifts Italy toward the Triple Entente", () => {
    const G = fresh();
    unifyItaly(G);
    for (const roll of [1, 2, 3]) {
      G.persistent.italyAlliance = "neutral";
      const result = italyDeclarationShift(G, "GE", roll, false);
      expect(result).toMatchObject({applied: true, random: true, roll, side: "te", from: "neutral", to: "teAligned"});
      expect(G.persistent.italyAlliance).toBe("teAligned");
    }
  });

  test("a roll of 4-6 shifts Italy toward the Triple Alliance", () => {
    const G = fresh();
    unifyItaly(G);
    for (const roll of [4, 5, 6]) {
      G.persistent.italyAlliance = "neutral";
      const result = italyDeclarationShift(G, "GE", roll, false);
      expect(result).toMatchObject({applied: true, random: true, roll, side: "ta", from: "neutral", to: "taAligned"});
      expect(G.persistent.italyAlliance).toBe("taAligned");
    }
  });

  test("the random clause does not apply while Italy is not unified", () => {
    const G = fresh();
    const result = italyDeclarationShift(G, "GE", 1, false);
    expect(result.applied).toBe(false);
    expect(G.persistent.italyAlliance).toBeUndefined();
  });

  test("the random clause does not apply when a player aids Italy", () => {
    const G = fresh();
    unifyItaly(G);
    const result = italyDeclarationShift(G, "GE", 1, true);
    expect(result.applied).toBe(false);
    expect(G.persistent.italyAlliance).toBe("neutral");
  });

  test("an aligned attacker shifts Italy deterministically away from its own chit", () => {
    const G = fresh();
    unifyItaly(G);
    G.powers.GE.alliance = "taCommitted";
    G.persistent.italyAlliance = "neutral";
    const result = italyDeclarationShift(G, "GE", 6, false);
    expect(result).toMatchObject({applied: true, random: false, roll: null, side: "te", to: "teAligned"});
  });
});

// ---------------------------------------------------------------------------
// Live declaration
// ---------------------------------------------------------------------------

describe("declareWar on a unified Italy", () => {
  test("a neutral attacker's declaration rolls the server die and shifts Italy", () => {
    const G = fresh();
    unifyItaly(G);
    beginAction(G);
    const stability = G.powers.GE.stability;

    // The first two dice are the 13.4.3 Italy/IT Minor roll-off (FR 5, AU 2);
    // every candidate then declines; the last decline's ctx supplies the 8.2
    // shift die (4).
    expect(declareWar(G, makeCtx([5, 2], seat("GE")), {minor: "Italy"}, "conquest", ["naples"], 2)).toBeUndefined();
    // 13.4.2: the minor first seeks aid; nobody chooses to aid it.
    expect(G.pending?.kind).toBe("minorAid");
    expect(G.pending?.power).toBe("FR");
    expect(lastLog(G, "minorAidRoll")?.args).toMatchObject({minor: "Italy", order: "FR,AU"});
    declineAllAid(G, [4]);

    // The declaration is typed and paid for, and the random shift is applied.
    expect(G.minorDeclarations).toHaveLength(1);
    expect(G.minorDeclarations?.[0]).toMatchObject({
      attacker: "GE",
      minor: "Italy",
      aim: "conquest",
      objectives: ["naples"],
      italyShift: {roll: 4, random: true, side: "ta", from: "neutral", to: "taAligned"},
    });
    expect(G.persistent.italyAlliance).toBe("taAligned");
    expect(G.cpRemaining).toBe(2);
    // 13.3 conquest: WTT +1 and the printed stability loss.
    expect(G.wtt).toBe(1);
    expect(G.powers.GE.stability).toBe(stability - 1);
    const shiftLog = lastLog(G, "allianceShifted");
    expect(shiftLog?.args).toMatchObject({from: "neutral", to: "taAligned", random: true, roll: 4});
    expect(lastLog(G, "warDeclared")?.args).toMatchObject({target: "Italy", aim: "conquest"});
    // 15.4.2: the unaided declaration is a live war with Italy defending alone.
    expect(G.war?.defender).toBe("IT");
    expect(G.war?.minorTarget).toEqual({minor: "Italy", ally: null});
    expect(G.war?.defenderMinors).toEqual(["Italy"]);
    expect(G.phase).toBe("wartime");
    expect(G.activePower).toBe("GE");
  });

  test("a roll of 1-3 moves the Italy chit to the Entente box", () => {
    const G = fresh();
    unifyItaly(G);
    beginAction(G);
    // Roll-off: FR 2, AU 1 -> FR first; the last decline then rolls a 2 for
    // the 8.2 random shift.
    expect(declareWar(G, makeCtx([2, 1], seat("GE")), {minor: "Italy"}, "conquest", ["naples"], 2)).toBeUndefined();
    declineAllAid(G, [2]);
    expect(G.persistent.italyAlliance).toBe("teAligned");
    expect(G.minorDeclarations?.[0].italyShift).toMatchObject({roll: 2, side: "te"});
  });

  test("a non-unified Italy cannot be targeted", () => {
    const G = fresh();
    beginAction(G);
    expect(declareWar(G, makeCtx([1], seat("GE")), {minor: "Italy"}, "conquest", ["naples"], 2)).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(4);
    expect(G.minorDeclarations ?? []).toHaveLength(0);
  });

  test("an illegal objective rejects the declaration before the die is rolled", () => {
    const G = fresh();
    unifyItaly(G);
    beginAction(G);
    // Rome is a capital, which no war of conquest may target (13.3.1).
    expect(declareWar(G, makeCtx([2], seat("GE")), {minor: "Italy"}, "conquest", ["rome"], 2)).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(4);
    expect(G.persistent.italyAlliance).toBe("neutral");
  });

  test("an Italy allied to a player is treated as a war on that player (13.4)", () => {
    const G = fresh();
    unifyItaly(G);
    G.spaces.rome.ally = "FR";
    G.spaces.naples.ally = "FR";
    beginAction(G);

    expect(declareWar(G, makeCtx([2], seat("GE")), {minor: "Italy"}, "conquest", ["naples"], 2)).toBeUndefined();
    // 13.4.1: the existing player ally decides whether to fight or abandon.
    expect(G.pending?.kind).toBe("minorAbandon");
    expect(resolvePending(G, makeCtx([], seat("FR")), "join")).toBeUndefined();

    expect(G.minorDeclarations ?? []).toHaveLength(0);
    expect(G.war?.defender).toBe("FR");
    expect(G.war?.minorTarget).toEqual({minor: "Italy", ally: "FR"});
    // 14.2: the defending player shifts away from the attacker, and the
    // 14.2 special also shifts a neutral unified Italy's own chit.
    expect(G.powers.FR.alliance).toBe("teAligned");
    expect(G.persistent.italyAlliance).toBe("teAligned");
  });
});
