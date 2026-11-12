/**
 * Rule 13.4.2 — Seeking Aid that finds no ally now creates the 15.4.2 lone
 * non-player war (instead of only recording the declaration).
 *
 * "If no player chooses to aid the non playing power, proceed to the
 * initiative order and war budget step."  The aiding path is unchanged: the
 * volunteer gains the alliance and is the defending primary (13.4 / 14.2).
 * The abandoned path (13.4.1) also ends with the non-player defending alone.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {belligerentsOf, isLoneMinorWar} from "./engine/limitedWar";
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

/** Every printed aid candidate declines; the final ctx supplies the 8.2 die. */
const declineAllAid = (G: ImperialElegyState, finalDice: number[] = []): void => {
  let guard = 0;
  while (G.pending?.kind === "minorAid" && guard < 10) {
    guard += 1;
    expect(resolvePending(G, makeCtx(finalDice, seat(G.pending.power)), "decline")).toBeUndefined();
  }
  expect(G.pending).toBeNull();
};

// ---------------------------------------------------------------------------
// No candidate at all
// ---------------------------------------------------------------------------

describe("13.4.2 no eligible ally", () => {
  test("the declaration becomes a live lone war immediately", () => {
    const G = fresh();
    // 8.1.2: every table candidate shares the attacker's alliance and cannot
    // aid (Denmark has no diplomacy marker at setup).
    for (const power of POWERS) G.powers[power].alliance = "taAligned";
    beginAction(G, "GE", 3);
    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Denmark"}, "conquest", ["schleswig-holstein"], 3))
      .toBeUndefined();

    expect(G.pending).toBeNull();
    expect(G.war).not.toBeNull();
    expect(isLoneMinorWar(G.war)).toBe(true);
    expect(G.war!.defender).toBe("Denmark");
    expect(G.war!.minorTarget).toEqual({minor: "Denmark", ally: null});
    expect(G.war!.defenderMinors).toEqual(["Denmark"]);
    // 14.3: the attacker keeps a war budget; the lone defender has none.
    expect(G.war!.budgets.GE).toBe(3 + G.powers.GE.industry);
    expect(G.war!.budgets.Denmark).toBeUndefined();
    expect(G.phase).toBe("wartime");
    expect(G.activePower).toBe("GE");
    expect(belligerentsOf(G.war!)).toEqual(["GE"]);
    expect(lastLog(G, "minorUnopposed")?.args).toMatchObject({target: "Denmark", war: true});
  });
});

// ---------------------------------------------------------------------------
// The printed order declines to the end
// ---------------------------------------------------------------------------

describe("13.4.2 declines exhaust the printed order", () => {
  test("the last decline opens the lone war instead of only recording the declaration", () => {
    const G = fresh();
    beginAction(G, "GE", 4);
    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Belgium"}, "conquest", ["belgium"], 2)).toBeUndefined();

    // Diplomacy step (UK), 1st Choice (UK), 2nd Choice (FR).
    expect(G.pending?.power).toBe("UK");
    expect(G.war).toBeNull();
    expect(resolvePending(G, makeCtx([], seat("UK")), "decline")).toBeUndefined();
    expect(G.pending?.power).toBe("UK");
    expect(resolvePending(G, makeCtx([], seat("UK")), "decline")).toBeUndefined();
    expect(G.pending?.power).toBe("FR");
    expect(G.war).toBeNull();
    expect(resolvePending(G, makeCtx([], seat("FR")), "decline")).toBeUndefined();

    expect(G.pending).toBeNull();
    expect(G.war).not.toBeNull();
    expect(G.war!.attacker).toBe("GE");
    expect(G.war!.defender).toBe("Belgium");
    expect(G.war!.minorTarget).toEqual({minor: "Belgium", ally: null});
    expect(G.war!.warAim).toBe("conquest");
    expect(G.war!.objectives).toEqual(["belgium"]);
    expect(G.war!.budgets.GE).toBe(2 + G.powers.GE.industry);
    expect(G.phase).toBe("wartime");
    expect(G.activePower).toBe("GE");
    // The 13.4.2 declaration ledger keeps the printed record.
    expect(G.minorDeclarations).toHaveLength(1);
    expect(G.minorDeclarations?.[0]).toMatchObject({
      attacker: "GE",
      minor: "Belgium",
      aim: "conquest",
      objectives: ["belgium"],
      italyShift: null,
    });
    expect(lastLog(G, "warDeclared")?.args).toMatchObject({target: "Belgium", aim: "conquest"});
    expect(lastLog(G, "minorUnopposed")?.args).toMatchObject({target: "Belgium", war: true});
    // The declaration was paid for once.
    expect(G.cpRemaining).toBe(2);
  });

  test("a forged/stale aid answer is still rejected", () => {
    const G = fresh();
    beginAction(G, "GE", 2);
    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Belgium"}, "conquest", ["belgium"], 2)).toBeUndefined();
    const before = JSON.stringify(G);
    expect(resolvePending(G, makeCtx([], seat("GE")), "aid")).toBe(INVALID_MOVE);
    expect(resolvePending(G, makeCtx([], seat("UK")), "betray")).toBe(INVALID_MOVE);
    expect(JSON.stringify(G)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// The aiding path is unchanged
// ---------------------------------------------------------------------------

describe("13.4.2 aid keeps the player-defended war", () => {
  test("aiding creates the ordinary 13.4 war with the ally as defender", () => {
    const G = fresh();
    beginAction(G, "GE", 2);
    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Belgium"}, "conquest", ["belgium"], 2)).toBeUndefined();
    expect(resolvePending(G, makeCtx([], seat("UK")), "aid")).toBeUndefined();

    expect(G.war?.defender).toBe("UK");
    expect(G.war?.minorTarget).toEqual({minor: "Belgium", ally: "UK"});
    expect(isLoneMinorWar(G.war)).toBe(false);
    expect(G.war?.defenderMinors).toEqual(["Belgium"]);
    expect(G.war?.budgets.UK).toBe(0);
    // No lone-war ledger entry on the aided path.
    expect(G.minorDeclarations ?? []).toHaveLength(0);
    expect(G.phase).toBe("wartime");
  });
});

// ---------------------------------------------------------------------------
// 13.4.1 abandonment ends with the lone defender too
// ---------------------------------------------------------------------------

describe("13.4.1 abandoned minor defends alone", () => {
  test("abandoning leaves the war live with the non-player as defender", () => {
    const G = fresh();
    G.spaces.belgium.ally = "FR";
    beginAction(G, "GE", 2);
    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Belgium"}, "conquest", ["belgium"], 2)).toBeUndefined();
    expect(G.pending?.kind).toBe("minorAbandon");
    const stability = G.powers.FR.stability;

    expect(resolvePending(G, makeCtx([], seat("FR")), "abandon")).toBeUndefined();

    // The three printed 13.4.1 consequences still apply.
    expect(G.powers.FR.stability).toBe(stability - 1);
    expect(G.powers.FR.alliance).toBe("teAligned");
    // The declaration then proceeds with no player ally (15.4.2).
    expect(G.war).not.toBeNull();
    expect(isLoneMinorWar(G.war)).toBe(true);
    expect(G.war!.defender).toBe("Belgium");
    expect(G.war!.minorTarget).toEqual({minor: "Belgium", ally: null});
    expect(G.war!.defenderMinors).toEqual(["Belgium"]);
    expect(G.war!.budgets.GE).toBe(2 + G.powers.GE.industry);
    expect(G.phase).toBe("wartime");
    expect(G.minorDeclarations).toHaveLength(1);
    expect(lastLog(G, "minorAbandoned")?.args).toMatchObject({minor: "Belgium", stability: -1});
  });
});

// ---------------------------------------------------------------------------
// Unified Italy
// ---------------------------------------------------------------------------

describe("13.4.2 unified Italy with no ally", () => {
  test("the lone war uses Italy's control id as the defender and keeps the 8.2 shift", () => {
    const G = fresh();
    unifyItaly(G);
    beginAction(G, "GE", 2);
    // Roll-off: FR 5, AU 2 (FR first); the final decline's ctx rolls the 8.2
    // shift die (2 = Triple Entente).
    expect(declareWar(G, makeCtx([5, 2], seat("GE")), {minor: "Italy"}, "conquest", ["naples"], 2)).toBeUndefined();
    expect(G.war).toBeNull();
    expect(G.pending?.kind).toBe("minorAid");
    declineAllAid(G, [2]);

    expect(G.war).not.toBeNull();
    expect(isLoneMinorWar(G.war)).toBe(true);
    expect(G.war!.defender).toBe("IT");
    expect(G.war!.minorTarget).toEqual({minor: "Italy", ally: null});
    expect(G.war!.defenderMinors).toEqual(["Italy"]);
    expect(G.war!.objectives).toEqual(["naples"]);
    // 14.2 special / 8.2: Italy's own chit shifted; no deferred defender choice
    // exists for a non-player.
    expect(G.persistent.italyAlliance).toBe("teAligned");
    expect(G.war!.defenderShift).toBeUndefined();
    expect(G.minorDeclarations?.[0]).toMatchObject({
      attacker: "GE",
      minor: "Italy",
      objectives: ["naples"],
      italyShift: {roll: 2, random: true, side: "te", from: "neutral", to: "teAligned"},
    });
    expect(G.phase).toBe("wartime");
    expect(belligerentsOf(G.war!)).toEqual(["GE"]);
  });
});
