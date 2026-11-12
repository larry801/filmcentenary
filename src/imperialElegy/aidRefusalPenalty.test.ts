/**
 * Rules 13.4.1 / 13.4.2 + 14.0 — refusing to aid a minor also takes the
 * printed 14.0 refusal penalties.
 *
 * 13.4.1: "If Italy is attacked and a player refuses to join the war Italy
 * gains 10 neutral influence on the MPIT per player that refused to join.  This
 * is in addition to the normal penalties incurred per rule 14.0."  14.0's
 * penalties fall on the refusing player's own MPIT: +5 neutral influence from
 * an aligned box, and +10 plus -1 stability from a committed box.  A refusal
 * forced by a truce is the printed exception: no 14.0 penalty, and it also
 * cancels the Italy clause.  A neutral power has no printed box penalty.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {createWarState} from "./engine/limitedWar";
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
const lastLog = (G: ImperialElegyState, key: string) =>
  [...G.log].reverse().find((entry) => entry.key === key);

const beginAction = (G: ImperialElegyState, active: Power = "GE", cp = 4): void => {
  G.phase = "action";
  G.activePower = active;
  G.cpRemaining = cp;
  G.pending = null;
  G.war = null;
};

/** A unified Italy with no player ally and its all-important MPIT column. */
const unifiedItaly = (G: ImperialElegyState): void => {
  G.persistent.italyUnified = true;
  G.flags.italyUnified = true;
  G.persistent.italyAlliance = "neutral";
  G.spaces.rome.control = "IT";
  G.spaces.naples.control = "IT";
  G.spaces.rome.ally = null;
  G.spaces.naples.ally = null;
};

/** A completed GE-FR war whose truce is still running (rule 13.5 / 16.3). */
const withTruce = (G: ImperialElegyState): void => {
  const war = createWarState(G, "GE", "FR", "conquest", [], 1);
  war.status = "victory";
  war.truceTurns = 1;
  if (!G.wars) G.wars = [];
  G.wars.push(war);
  G.war = null;
};

const declareOnItaly = (G: ImperialElegyState): void => {
  beginAction(G);
  expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Italy"}, "conquest", ["naples"], 2)).toBeUndefined();
};

// ---------------------------------------------------------------------------
// 13.4.2 Seeking Aid declines
// ---------------------------------------------------------------------------

describe("13.4.2 aid declines take the 14.0 refusal penalty", () => {
  test("an aligned refuser gains 5 neutral influence on its own MPIT, not just Italy's +10", () => {
    const G = fresh();
    unifiedItaly(G);
    G.italyMpit = {te: 0, ta: 0, neutral: 1};
    G.powers.FR.alliance = "teAligned";
    G.powers.FR.mpit = {te: 0, ta: 0, neutral: 0};
    declareOnItaly(G);

    expect(G.pending?.kind).toBe("minorAid");
    expect(G.pending?.power).toBe("FR");
    expect(resolvePending(G, makeCtx([], seat("FR")), "decline")).toBeUndefined();

    // 14.0 aligned penalty on the refuser; 13.4.1's Italy clause is additional.
    expect(G.powers.FR.mpit).toEqual({te: 0, ta: 0, neutral: 5});
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 11});
    expect(G.powers.FR.stability).toBe(3);
    expect(lastLog(G, "allyRefusedWar")?.args).toMatchObject({
      caller: "GE",
      stability: 0,
      neutralInfluence: 5,
      exemptForTruce: false,
    });
    expect(lastLog(G, "italyMpitGained")?.args).toMatchObject({
      major: "IT",
      amount: 10,
      total: 11,
      reason: "aidDeclined",
    });
  });

  test("a committed refuser loses 1 stability and gains 10 neutral influence, plus Italy's +10", () => {
    const G = fresh();
    unifiedItaly(G);
    G.italyMpit = {te: 0, ta: 0, neutral: 0};
    G.powers.FR.alliance = "taCommitted";
    G.powers.FR.mpit = {te: 0, ta: 0, neutral: 0};
    const stability = G.powers.FR.stability;
    declareOnItaly(G);

    expect(G.pending?.power).toBe("FR");
    expect(resolvePending(G, makeCtx([], seat("FR")), "decline")).toBeUndefined();

    expect(G.powers.FR.mpit).toEqual({te: 0, ta: 0, neutral: 10});
    expect(G.powers.FR.stability).toBe(stability - 1);
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 10});
    expect(lastLog(G, "allyRefusedWar")?.args).toMatchObject({
      caller: "GE",
      stability: -1,
      neutralInfluence: 10,
      exemptForTruce: false,
    });
  });

  test("a neutral refuser has no 14.0 penalty but Italy still gains its +10", () => {
    const G = fresh();
    unifiedItaly(G);
    G.italyMpit = {te: 0, ta: 0, neutral: 0};
    G.powers.FR.alliance = "neutral";
    G.powers.FR.mpit = {te: 0, ta: 0, neutral: 1};
    const stability = G.powers.FR.stability;
    declareOnItaly(G);

    expect(resolvePending(G, makeCtx([], seat("FR")), "decline")).toBeUndefined();

    expect(G.powers.FR.mpit).toEqual({te: 0, ta: 0, neutral: 1});
    expect(G.powers.FR.stability).toBe(stability);
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 10});
    // A neutral decline stays private: no public refusal entry.
    expect(lastLog(G, "allyRefusedWar")).toBeUndefined();
  });

  test("a candidate that holds a truce with the attacker is never asked, so there is no refusal penalty", () => {
    const G = fresh();
    unifiedItaly(G);
    G.italyMpit = {te: 0, ta: 0, neutral: 0};
    G.powers.FR.alliance = "teCommitted";
    G.powers.FR.mpit = {te: 0, ta: 0, neutral: 0};
    G.powers.FR.stability = 2;
    withTruce(G);
    declareOnItaly(G);

    // 13.5: FR cannot join a war against its truce partner, so the aid search
    // skips it (the 14.0 exception's effect) and asks AU instead.
    expect(G.pending?.power).not.toBe("FR");
    expect(G.pending?.power).toBe("AU");
    const stability = G.powers.FR.stability;
    const asked: Power[] = [];
    let guard = 0;
    while (G.pending?.kind === "minorAid") {
      guard += 1;
      if (guard > 10) throw new Error("the aid search did not finish");
      const candidate = G.pending.power;
      asked.push(candidate);
      expect(candidate).not.toBe("FR");
      expect(resolvePending(G, makeCtx([], seat(candidate)), "decline")).toBeUndefined();
    }
    expect(asked).not.toContain("FR");
    // FR was never asked: no own-MPIT change, no stability loss, and Italy
    // gains nothing from it.
    expect(G.powers.FR.mpit).toEqual({te: 0, ta: 0, neutral: 0});
    expect(G.powers.FR.stability).toBe(stability);
    expect(G.italyMpit.neutral).toBe(asked.length * 10);
  });
});

// ---------------------------------------------------------------------------
// 13.4.1 abandonment
// ---------------------------------------------------------------------------

describe("13.4.1 abandoning Italy takes the 14.0 penalty in addition", () => {
  /** FR is Italy's player ally and the attacker is neutral GE. */
  const declareOnAlliedItaly = (G: ImperialElegyState, box: "teAligned" | "taCommitted" | "neutral"): void => {
    unifiedItaly(G);
    G.italyMpit = {te: 0, ta: 0, neutral: 1};
    G.spaces.rome.ally = "FR";
    G.spaces.naples.ally = "FR";
    G.powers.FR.alliance = box;
    G.powers.FR.mpit = {te: 0, ta: 0, neutral: 0};
    declareOnItaly(G);
    expect(G.pending?.kind).toBe("minorAbandon");
    expect(G.pending?.power).toBe("FR");
  };

  test("an aligned abandoner gains 5 neutral influence on top of 13.4.1's loss", () => {
    const G = fresh();
    declareOnAlliedItaly(G, "teAligned");
    const stability = G.powers.FR.stability;

    expect(resolvePending(G, makeCtx([], seat("FR")), "abandon")).toBeUndefined();

    // 13.4.1: -1 stability and the chit shifts away from the attacker.
    expect(G.powers.FR.stability).toBe(stability - 1);
    expect(G.powers.FR.alliance).toBe("teCommitted");
    // 14.0 aligned refusal: +5 neutral influence on FR's own MPIT.
    expect(G.powers.FR.mpit).toEqual({te: 0, ta: 0, neutral: 5});
    // 13.4.1's Italy clause is additional, on Italy's own column.
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 11});
    expect(lastLog(G, "allyRefusedWar")?.args).toMatchObject({
      caller: "GE",
      stability: 0,
      neutralInfluence: 5,
      exemptForTruce: false,
    });
    expect(lastLog(G, "minorAbandoned")?.args).toMatchObject({
      minor: "Italy",
      stability: -1,
      refusalInfluence: 5,
      italyInfluence: 10,
    });
  });

  test("a committed abandoner takes 13.4.1's -1 and the separate 14.0 -1", () => {
    const G = fresh();
    declareOnAlliedItaly(G, "taCommitted");
    const stability = G.powers.FR.stability;

    expect(resolvePending(G, makeCtx([], seat("FR")), "abandon")).toBeUndefined();

    // 13.4.1's own -1 and 14.0's committed-box -1 are separate penalties.
    expect(G.powers.FR.stability).toBe(stability - 2);
    // The committed 14.0 MPIT penalty is still added.
    expect(G.powers.FR.mpit).toEqual({te: 0, ta: 0, neutral: 10});
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 11});
    expect(lastLog(G, "allyRefusedWar")?.args).toMatchObject({
      stability: -1,
      neutralInfluence: 10,
    });
    expect(lastLog(G, "minorAbandoned")?.args).toMatchObject({
      refusalInfluence: 10,
      italyInfluence: 10,
    });
  });

  test("a neutral abandoner keeps 13.4.1's loss but takes no 14.0 MPIT penalty", () => {
    const G = fresh();
    declareOnAlliedItaly(G, "neutral");
    const stability = G.powers.FR.stability;

    expect(resolvePending(G, makeCtx([], seat("FR")), "abandon")).toBeUndefined();

    expect(G.powers.FR.stability).toBe(stability - 1);
    expect(G.powers.FR.mpit).toEqual({te: 0, ta: 0, neutral: 0});
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 11});
    expect(lastLog(G, "allyRefusedWar")).toBeUndefined();
    expect(lastLog(G, "minorAbandoned")?.args).toMatchObject({refusalInfluence: 0, italyInfluence: 10});
  });

});
