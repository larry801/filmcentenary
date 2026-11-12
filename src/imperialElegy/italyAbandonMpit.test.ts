/**
 * Rules 8.5 / 8.6 / 13.4.1 — Italy's own typed MPIT column.
 *
 * "If Italy is attacked and a player refuses to join the war Italy gains 10
 * neutral influence on the MPIT per player that refused to join."  Italy is not
 * a player power, so its three counters live in `G.italyMpit` (typed) instead
 * of `PowerState.mpit`.  The column is read by the live 20.9 alliance
 * resolution step (8.6): an influence-only roll shifts the Italian chit and
 * resets the column to the matching box (8.5); a tie is rerolled (8.6).
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  addItalyMpit,
  applyItalyAllianceResolution,
  italyAllianceBox,
  italyMpitOf,
  rollItalyAllianceResolution,
} from "./engine/italyEntry";
import {italyTable, unifyItaly} from "./engine/greatWar";
import {beginEndPhase, declareWar, declinePending, resolvePending} from "./moves";

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
const lastLog = (G: ImperialElegyState, key: string) =>
  [...G.log].reverse().find((entry) => entry.key === key);

const beginAction = (G: ImperialElegyState, active: Power = "GE", cp = 4): void => {
  G.phase = "action";
  G.activePower = active;
  G.cpRemaining = cp;
  G.pending = null;
  G.war = null;
};

/** A unified Italy whose capital (Rome) is held by `ally`, if any. */
const unifiedItaly = (G: ImperialElegyState, ally: Power | null = null): void => {
  G.persistent.italyUnified = true;
  G.flags.italyUnified = true;
  G.persistent.italyAlliance = "neutral";
  G.spaces.rome.control = "IT";
  G.spaces.naples.control = "IT";
  G.spaces.naples.ally = ally;
  G.spaces.rome.ally = ally;
};

// ---------------------------------------------------------------------------
// Typed column
// ---------------------------------------------------------------------------

describe("8.5 Italy's typed MPIT column", () => {
  test("a missing column reads as zeroes; writes create the typed column", () => {
    const G = fresh();
    expect(italyMpitOf(G)).toEqual({te: 0, ta: 0, neutral: 0});
    expect(addItalyMpit(G, "neutral", 10)).toEqual({te: 0, ta: 0, neutral: 10});
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 10});
    expect(italyMpitOf(G)).toEqual({te: 0, ta: 0, neutral: 10});
  });

  test("legacy persistent markers are folded into the typed column on the next write", () => {
    const G = fresh();
    G.persistent.italy_mpit_neutral = 2;
    expect(italyMpitOf(G)).toEqual({te: 0, ta: 0, neutral: 2});
    expect(addItalyMpit(G, "te", 1)).toEqual({te: 1, ta: 0, neutral: 2});
    expect(G.italyMpit).toEqual({te: 1, ta: 0, neutral: 2});
  });

  test("unification seeds the column at the printed 1 neutral influence", () => {
    const G = fresh();
    expect(G.italyMpit).toBeUndefined();
    unifyItaly(G, makeCtx([], seat("GE")), "GE");
    expect(G.persistent.italyUnified).toBe(true);
    expect(italyAllianceBox(G)).toBe("neutral");
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 1});
  });
});

// ---------------------------------------------------------------------------
// 13.4.1 live refusal paths
// ---------------------------------------------------------------------------

describe("13.4.1 Italy gains 10 neutral influence per refusal", () => {
  test("a player abandoning Italy writes +10 to Italy's MPIT and logs it", () => {
    const G = fresh();
    unifiedItaly(G, "FR");
    G.italyMpit = {te: 0, ta: 0, neutral: 1};
    beginAction(G);

    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Italy"}, "conquest", ["naples"], 2)).toBeUndefined();
    expect(G.pending?.kind).toBe("minorAbandon");
    expect(resolvePending(G, makeCtx([], seat("FR")), "abandon")).toBeUndefined();

    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 11});
    expect(lastLog(G, "italyMpitGained")?.args).toMatchObject({
      major: "IT",
      track: "neutral",
      amount: 10,
      total: 11,
      reason: "abandoned",
    });
    // The abandoning player's own MPIT is untouched by 13.4.1's Italy clause.
    expect(G.powers.FR.mpit).toEqual({te: 0, ta: 0, neutral: 1});
  });

  test("every player that declines the 13.4.2 aid search adds another +10", () => {
    const G = fresh();
    unifiedItaly(G, null);
    G.italyMpit = {te: 0, ta: 0, neutral: 0};
    beginAction(G);

    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Italy"}, "conquest", ["naples"], 2)).toBeUndefined();
    expect(G.pending?.kind).toBe("minorAid");

    const declined: Power[] = [];
    let guard = 0;
    while (G.pending?.kind === "minorAid") {
      guard += 1;
      if (guard > 10) throw new Error("the aid search did not finish");
      const candidate = G.pending.power;
      declined.push(candidate);
      expect(resolvePending(G, makeCtx([], seat(candidate)), "decline")).toBeUndefined();
    }
    // The printed Italy row is FR/AU (roll-off), Germany, then the UK; the
    // attacker (GE) is never asked to aid its own target.
    expect(declined).toEqual(["FR", "AU", "UK"]);
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 30});
    expect(G.log.filter((entry) => entry.key === "italyMpitGained")).toHaveLength(3);
    expect(lastLog(G, "italyMpitGained")?.args).toMatchObject({amount: 10, total: 30, reason: "aidDeclined"});
    // No player chose to aid Italy, so the declaration proceeds unopposed.
    expect(G.minorDeclarations?.[0]).toMatchObject({attacker: "GE", minor: "Italy"});
  });

  test("a player that aids Italy does not add influence", () => {
    const G = fresh();
    unifiedItaly(G, null);
    G.italyMpit = {te: 0, ta: 0, neutral: 0};
    beginAction(G);

    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Italy"}, "conquest", ["naples"], 2)).toBeUndefined();
    expect(G.pending?.kind).toBe("minorAid");
    expect(resolvePending(G, makeCtx([], seat("FR")), "aid")).toBeUndefined();

    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 0});
    expect(G.war?.defender).toBe("FR");
  });

  test("the wrong seat cannot answer the abandonment decision and no track moves", () => {
    const G = fresh();
    unifiedItaly(G, "FR");
    G.italyMpit = {te: 0, ta: 0, neutral: 1};
    beginAction(G);
    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Italy"}, "conquest", ["naples"], 2)).toBeUndefined();

    expect(resolvePending(G, makeCtx([], seat("AU")), "abandon")).toBe(INVALID_MOVE);
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 1});
  });
});

// ---------------------------------------------------------------------------
// 8.6 pure resolution
// ---------------------------------------------------------------------------

describe("8.6 Italy's own alliance resolution", () => {
  const italy = (mpit: {te: number; ta: number; neutral: number}): ImperialElegyState => {
    const G = fresh();
    unifiedItaly(G, null);
    G.italyMpit = mpit;
    return G;
  };

  test("a single influence type shifts automatically", () => {
    const G = italy({te: 0, ta: 0, neutral: 10});
    G.persistent.italyAlliance = "teAligned";
    const roll = rollItalyAllianceResolution(G, () => 3);
    expect(roll).toMatchObject({direction: "neutral", steps: 1, rolls: null});

    const shift = applyItalyAllianceResolution(G, roll!);
    expect(shift).toEqual({from: "teAligned", to: "neutral", steps: 1, blocked: false});
    expect(italyAllianceBox(G)).toBe("neutral");
    // 8.5: the marker matching the new box is set to 1.
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 1});
  });

  test("a tie is rerolled (the Italian exception)", () => {
    const G = italy({te: 1, ta: 1, neutral: 0});
    const dice = [1, 1, 1, 1, 2, 1, 1, 1];
    const roll = rollItalyAllianceResolution(G, () => dice.shift() ?? 1);
    // First roll ties 3-3; the reroll is 4-3 for the Triple Entente.
    expect(roll?.rolls).toEqual({te: 4, ta: 3, neutral: 0});
    expect(roll?.direction).toBe("te");
    expect(roll?.steps).toBe(1);
  });

  test("a differential of 10+ shifts twice", () => {
    const G = italy({te: 1, ta: 0, neutral: 1});
    const dice = [6, 6, 1, 1, 1, 1];
    const roll = rollItalyAllianceResolution(G, () => dice.shift() ?? 1);
    // te = 13, neutral = 3, ta = 0 -> differential 10 -> two boxes.
    expect(roll?.rolls).toEqual({te: 13, ta: 0, neutral: 3});
    expect(roll?.steps).toBe(2);
    expect(roll?.direction).toBe("te");
    const shift = applyItalyAllianceResolution(G, roll!);
    expect(shift).toEqual({from: "neutral", to: "teCommitted", steps: 2, blocked: false});
    expect(G.italyMpit).toEqual({te: 1, ta: 0, neutral: 0});
  });

  test("no influence means no resolution", () => {
    const G = italy({te: 0, ta: 0, neutral: 0});
    expect(rollItalyAllianceResolution(G, () => 3)).toBeNull();
  });

  test("the track end stops a two-box shift and reports it", () => {
    const G = italy({te: 1, ta: 0, neutral: 1});
    G.persistent.italyAlliance = "teAligned";
    const dice = [6, 6, 1, 1];
    const roll = rollItalyAllianceResolution(G, () => dice.shift() ?? 1);
    expect(roll?.steps).toBe(2);
    const shift = applyItalyAllianceResolution(G, roll!);
    expect(shift).toEqual({from: "teAligned", to: "teCommitted", steps: 1, blocked: true});
    expect(G.italyMpit).toEqual({te: 1, ta: 0, neutral: 0});
  });
});

// ---------------------------------------------------------------------------
// 22.1 Italian Minor Power Table source
// ---------------------------------------------------------------------------

describe("22.1 the Italian table writes the same typed column", () => {
  test("the 2-result gains 2 neutral influence on Italy's typed MPIT", () => {
    const G = fresh();
    unifiedItaly(G, null);
    G.italyMpit = {te: 0, ta: 0, neutral: 1};
    italyTable(G, makeCtx([2], seat("GE")), "GE");
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 3});
    expect(G.persistent.italy_mpit_neutral).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 20.9 live step
// ---------------------------------------------------------------------------

const defaultPick = (G: ImperialElegyState): string =>
  G.pending!.options.find((candidate) => candidate.id === "skip")?.id ??
  G.pending!.options[0]?.id ??
  "";

/** Start the live end phase and settle every other decision with its default. */
const runEndPhase = (G: ImperialElegyState, ctx: Ctx): void => {
  beginEndPhase(G, ctx);
  let guard = 0;
  while (G.pending !== null) {
    guard += 1;
    if (guard > 300) throw new Error("the end phase did not settle");
    const pending = G.pending;
    expect(resolvePending(G, {...ctx, playerID: seat(pending.power)}, defaultPick(G))).toBeUndefined();
  }
};

describe("20.9 runs Italy's MPIT resolution live", () => {
  test("Italy's typed neutral influence pulls its chit toward neutrality and resets", () => {
    const G = fresh();
    unifiedItaly(G, null);
    G.persistent.italyAlliance = "teAligned";
    G.italyMpit = {te: 0, ta: 0, neutral: 10};
    const ctx = makeCtx([3], seat("GE"));
    ctx.phase = "end";

    runEndPhase(G, ctx);

    expect(G.persistent.italyAlliance).toBe("neutral");
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 1});
    expect(lastLog(G, "italyAllianceResolution")?.args).toMatchObject({
      major: "IT",
      direction: "neutral",
      steps: 1,
      blocked: false,
      from: "teAligned",
      to: "neutral",
    });
  });

  test("a unified Italy with no influence is skipped", () => {
    const G = fresh();
    unifiedItaly(G, null);
    G.persistent.italyAlliance = "teAligned";
    G.italyMpit = {te: 0, ta: 0, neutral: 0};
    const ctx = makeCtx([3], seat("GE"));
    ctx.phase = "end";

    runEndPhase(G, ctx);

    expect(G.persistent.italyAlliance).toBe("teAligned");
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 0});
    expect(lastLog(G, "italyAllianceResolution")).toBeUndefined();
  });
});
