/**
 * Rule 8.2 / 14.2 — the declaration-driven Alliance Track shift.
 *
 * "A declaration of war causes the defending power to shift away from the
 * attacker one space on the Alliance Track.  If both powers are in the neutral
 * box, the defending power chooses which alliance box to shift into."
 *
 * The shift is applied by `declareWar` when the two chits determine the
 * direction, and answered by the defender (or defaulted deterministically at
 * the alliance-shift step) when both chits are neutral.  Rule 8.4's printed
 * exception — "when a defender is forced to shift after a declaration of war,
 * the defender can shift into an alliance that already has three players" — is
 * exercised here too.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {ImperialElegyState, Power, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  ALLIANCE_MAX_PLAYERS,
  allianceMembers,
  declarationShift,
  declarationShiftDirection,
  shiftAlliance,
} from "./engine/alliance";
import {chooseAllianceShift, declareWar, startWarManeuver} from "./moves";

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

/** GE declares a legal conquest war on FR (Alsace-Lorraine + Algeria). */
const declareOnFrance = (G: ImperialElegyState): void => {
  beginAction(G);
  expect(declareWar(G, makeCtx([], seat("GE")), "FR", "conquest", ["alsace-lorraine", "algeria"], 2)).toBeUndefined();
};

// ---------------------------------------------------------------------------
// Direction helper
// ---------------------------------------------------------------------------

test("the shift direction is derived from the two chits", () => {
  // Defender on the Entente side of the attacker steps further to the Entente.
  expect(declarationShiftDirection("taCommitted", "neutral")).toBe("te");
  expect(declarationShiftDirection("taAligned", "teAligned")).toBe("te");
  expect(declarationShiftDirection("teCommitted", "neutral")).toBe("ta");
  expect(declarationShiftDirection("teAligned", "taAligned")).toBe("ta");
  // The neutral box is the middle: a neutral defender attacked by an aligned
  // power steps to the opposite alliance's aligned box (8.2).
  expect(declarationShiftDirection("teAligned", "neutral")).toBe("ta");
  expect(declarationShiftDirection("taAligned", "neutral")).toBe("te");
  // Both neutral (the only legal same-box pairing): the defender chooses.
  expect(declarationShiftDirection("neutral", "neutral")).toBeNull();
});

// ---------------------------------------------------------------------------
// Determinate declaration shift
// ---------------------------------------------------------------------------

describe("declareWar applies the printed 8.2 defender shift", () => {
  test("a neutral defender attacked by an aligned power shifts to the other alliance", () => {
    const G = fresh();
    G.powers.GE.alliance = "taCommitted";
    declareOnFrance(G);

    expect(G.powers.FR.alliance).toBe("teAligned");
    expect(G.war?.defenderShift).toEqual({
      from: "neutral",
      to: "teAligned",
      steps: 1,
      forced: false,
      choice: false,
    });
    const entry = lastLog(G, "allianceShifted");
    expect(entry?.power).toBe("FR");
    expect(entry?.args).toMatchObject({from: "neutral", to: "teAligned", steps: 1, attacker: "GE"});
    // The defender is now a member of the Entente (8.2 gives it a defined box).
    expect(allianceMembers(G, "te")).toContain("FR");
  });

  test("a defender already on the attacker's far side not already at the extreme steps further away", () => {
    const G = fresh();
    // GE is TA-aligned; FR is TE-aligned but not committed, so away from GE
    // means one more step toward the committed Entente box.
    G.powers.GE.alliance = "taAligned";
    G.powers.FR.alliance = "teAligned";
    beginAction(G);
    expect(declareWar(G, makeCtx([], seat("GE")), "FR", "conquest", ["alsace-lorraine", "algeria"], 2)).toBeUndefined();
    expect(G.powers.FR.alliance).toBe("teCommitted");
    expect(G.war?.defenderShift).toMatchObject({from: "teAligned", to: "teCommitted", steps: 1});
  });

  test("a defender at the far extreme does not move and nothing is faked", () => {
    const G = fresh();
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    beginAction(G);
    expect(declareWar(G, makeCtx([], seat("GE")), "FR", "conquest", ["alsace-lorraine", "algeria"], 2)).toBeUndefined();
    expect(G.powers.FR.alliance).toBe("teCommitted");
    expect(G.war?.defenderShift).toMatchObject({from: "teCommitted", to: "teCommitted", steps: 0});
  });
});

// ---------------------------------------------------------------------------
// Both neutral: the defender chooses
// ---------------------------------------------------------------------------

describe("both chits neutral: the defending power chooses the box", () => {
  test("declareWar records the open choice instead of guessing", () => {
    const G = fresh();
    declareOnFrance(G);

    expect(G.powers.FR.alliance).toBe("neutral");
    expect(G.war?.defenderShift).toEqual({from: "neutral", to: null, steps: 0, forced: false, choice: true});
    expect(lastLog(G, "allianceShiftChoice")?.power).toBe("FR");
    expect(lastLog(G, "allianceShifted")).toBeUndefined();
  });

  test("the defender's live move applies the chosen box", () => {
    const G = fresh();
    declareOnFrance(G);

    expect(chooseAllianceShift(G, makeCtx([], seat("FR")), "ta")).toBeUndefined();
    expect(G.powers.FR.alliance).toBe("taAligned");
    expect(G.war?.defenderShift).toEqual({from: "neutral", to: "taAligned", steps: 1, forced: false, choice: false});
    expect(lastLog(G, "allianceShifted")?.args).toMatchObject({to: "taAligned", chosen: true});

    // The choice is answered once only.
    expect(chooseAllianceShift(G, makeCtx([], seat("FR")), "te")).toBe(INVALID_MOVE);
  });

  test("only the defender may choose, and only before the maneuver starts", () => {
    const G = fresh();
    declareOnFrance(G);

    expect(chooseAllianceShift(G, makeCtx([], seat("GE")), "te")).toBe(INVALID_MOVE);
    expect(chooseAllianceShift(G, makeCtx([], seat("UK")), "te")).toBe(INVALID_MOVE);
    expect(G.powers.FR.alliance).toBe("neutral");

    // A chit cannot enter the attacker's own alliance box (8.1.2).
    G.powers.GE.alliance = "taAligned";
    expect(chooseAllianceShift(G, makeCtx([], seat("FR")), "ta")).toBe(INVALID_MOVE);
    expect(chooseAllianceShift(G, makeCtx([], seat("FR")), "te")).toBeUndefined();
    expect(G.powers.FR.alliance).toBe("teAligned");
  });

  test("an unanswered choice is settled deterministically at the alliance-shift step", () => {
    const G = fresh();
    declareOnFrance(G);
    expect(G.war?.defenderShift?.choice).toBe(true);

    expect(startWarManeuver(G, makeCtx([3, 3], seat("GE")))).toBeUndefined();
    // Default direction: Triple Entente first, like the 8.6 tie default.
    expect(G.powers.FR.alliance).toBe("teAligned");
    expect(G.war?.defenderShift).toMatchObject({to: "teAligned", choice: false});
    expect(lastLog(G, "allianceShifted")?.args).toMatchObject({fallback: true});
  });

  test("the default skips a full Entente and uses the Triple Alliance", () => {
    const G = fresh();
    G.powers.UK.alliance = "teAligned";
    G.powers.RU.alliance = "teAligned";
    G.powers.AU.alliance = "teAligned";
    declareOnFrance(G);
    expect(G.war?.defenderShift?.choice).toBe(true);

    expect(startWarManeuver(G, makeCtx([3, 3], seat("GE")))).toBeUndefined();
    expect(G.powers.FR.alliance).toBe("taAligned");
    expect(G.war?.defenderShift).toMatchObject({to: "taAligned", choice: false});
  });
});

// ---------------------------------------------------------------------------
// Rule 8.4 exception
// ---------------------------------------------------------------------------

describe("rule 8.4's printed declaration exception", () => {
  test("a defender forced to shift may enter an alliance that already has three players", () => {
    const G = fresh();
    // The Entente is already full at the printed maximum.
    for (const power of ["UK", "FR", "AU"] as Power[]) G.powers[power].alliance = "teAligned";

    expect(allianceMembers(G, "te")).toHaveLength(ALLIANCE_MAX_PLAYERS);

    // GE (TA) declares on RU (neutral): away from GE is the Entente.
    beginAction(G);
    G.powers.GE.alliance = "taAligned";
    expect(declareWar(G, makeCtx([], seat("GE")), "RU", "conquest", ["poland"], 2)).toBeUndefined();

    expect(G.powers.RU.alliance).toBe("teAligned");
    expect(allianceMembers(G, "te")).toHaveLength(4);
    expect(G.war?.defenderShift).toMatchObject({to: "teAligned", forced: true});
    expect(lastLog(G, "allianceShifted")?.args).toMatchObject({forced: true});
  });

  test("a voluntary shift still stops at the cap (the exception is declaration-only)", () => {
    const G = fresh();
    for (const power of ["UK", "FR", "AU"] as Power[]) G.powers[power].alliance = "teAligned";
    const blocked = shiftAlliance(G, "RU", "te", 1);
    expect(blocked.blocked).toBe(true);
    expect(G.powers.RU.alliance).toBe("neutral");
  });

  test("the pure helper reports the exception and leaves other callers capped", () => {
    const G = fresh();
    for (const power of ["UK", "FR", "AU"] as Power[]) G.powers[power].alliance = "teAligned";
    G.powers.GE.alliance = "taAligned";
    const shift = declarationShift(G, "GE", "RU");
    expect(shift).toMatchObject({from: "neutral", to: "teAligned", steps: 1, forced: true, needsChoice: false});
    expect(G.powers.RU.alliance).toBe("teAligned");
  });

  test("both neutral with the defender choosing into a full alliance is allowed by the exception", () => {
    const G = fresh();
    // Fill the Entente without FR so the defender is still neutral.
    for (const power of ["UK", "AU", "RU"] as Power[]) G.powers[power].alliance = "teAligned";
    declareOnFrance(G);
    expect(G.war?.defenderShift?.choice).toBe(true);
    // The chosen box is full, but this is the forced declaration shift.
    expect(chooseAllianceShift(G, makeCtx([], seat("FR")), "te")).toBeUndefined();
    expect(G.powers.FR.alliance).toBe("teAligned");
    expect(G.war?.defenderShift).toMatchObject({to: "teAligned", forced: true});
  });
});

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

test("no shift is recorded before a war exists or for a war created without a declaration", () => {
  const G = fresh();
  expect(G.war).toBeNull();
  beginAction(G);
  // A hand-built war state (no `declareWar`) has no defenderShift record and
  // the maneuver step must not invent one.
  G.war = {
    attacker: "GE", defender: "FR", attackerAllies: [], defenderAllies: [], attackerMinors: [], defenderMinors: [],
    warAim: "conquest", objectives: ["alsace-lorraine"], status: "alliance", budgets: {GE: 5},
    initiative: [], treaties: [], victor: null, truceTurns: 2, passed: [], startedTurn: 1,
  };
  G.phase = "wartime";
  G.activePower = "GE";
  expect(startWarManeuver(G, makeCtx([3, 3], seat("GE")))).toBeUndefined();
  expect(G.war.defenderShift).toBeUndefined();
  expect(G.powers.FR.alliance).toBe("neutral");
});
