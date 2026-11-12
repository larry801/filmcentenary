/**
 * Rule 14.2 special — post-unification Italy.
 *
 * "Special: After unification, if a neutral Italy is attacked and a player
 * chooses to aid Italy [13.4.2], both Italy and the aiding player will shift
 * away from the attacker on the alliance track."
 *
 * Italy's chit lives outside the six player MPIT columns
 * (`engine/italyEntry.ts#shiftItalyToward`) and is exempt from rule 8.4, so an
 * aided Italy shifts even when the aiding player's own shift is capped.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {applyItalyAidShift, seekingAidSlots} from "./engine/limitedWar";
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

// ---------------------------------------------------------------------------
// Pure helper
// ---------------------------------------------------------------------------

describe("14.2 Italy aid shift helper", () => {
  test("a neutral unified Italy shifts toward the given side", () => {
    const G = fresh();
    unifyItaly(G);
    expect(applyItalyAidShift(G, "te")).toMatchObject({
      applied: true,
      from: "neutral",
      to: "teAligned",
      side: "te",
      steps: 1,
    });
    expect(G.persistent.italyAlliance).toBe("teAligned");
  });

  test("an Italy that is not unified, or no longer neutral, does not shift", () => {
    const notUnified = fresh();
    expect(applyItalyAidShift(notUnified, "te").applied).toBe(false);
    expect(notUnified.persistent.italyAlliance).toBeUndefined();

    const aligned = fresh();
    unifyItaly(aligned);
    aligned.persistent.italyAlliance = "taAligned";
    expect(applyItalyAidShift(aligned, "te").applied).toBe(false);
    expect(aligned.persistent.italyAlliance).toBe("taAligned");
  });

  test("Italy is exempt from rule 8.4's three-player maximum", () => {
    const G = fresh();
    unifyItaly(G);
    for (const power of ["UK", "FR", "RU"] as const) G.powers[power].alliance = "teAligned";
    expect(applyItalyAidShift(G, "te")).toMatchObject({applied: true, to: "teAligned"});
  });
});

// ---------------------------------------------------------------------------
// Live: the aid of a unified Italy
// ---------------------------------------------------------------------------

describe("13.4.2 / 14.2 aiding a unified Italy", () => {
  test("the Italy/IT Minor table row asks France/Austria first, then Germany, then the UK", () => {
    const G = fresh();
    unifyItaly(G);
    // The 2nd Choice is Germany itself, which cannot ally with Italy against
    // itself (13.4.2), so the live list jumps to the UK as the 3rd Choice.
    expect(seekingAidSlots(G, "GE", "Italy")).toEqual([
      {step: 2, diplomacy: false, candidates: ["FR", "AU"], rollOff: true},
      {step: 4, diplomacy: false, candidates: ["UK"], rollOff: false},
    ]);
  });

  test("an aiding player and neutral Italy both shift away from the attacker", () => {
    const G = fresh();
    unifyItaly(G);
    beginAction(G);
    // The Italy row's 1st Choice is FR/AU: AU wins the roll-off.
    expect(declareWar(G, makeCtx([1, 2], seat("GE")), {minor: "Italy"}, "conquest", ["naples"], 2)).toBeUndefined();
    expect(G.pending?.kind).toBe("minorAid");
    expect(G.pending?.power).toBe("AU");

    expect(resolvePending(G, makeCtx([], seat("AU")), "aid")).toBeUndefined();

    // "both Italy and the aiding player will shift away from the attacker."
    expect(G.war?.defender).toBe("AU");
    expect(G.war?.minorTarget).toEqual({minor: "Italy", ally: "AU"});
    expect(G.powers.AU.alliance).toBe("teAligned");
    expect(G.persistent.italyAlliance).toBe("teAligned");
    const italyShift = G.log.filter((entry) => entry.key === "allianceShifted" && entry.args?.italy === true);
    expect(italyShift).toHaveLength(1);
    expect(italyShift[0].args).toMatchObject({from: "neutral", to: "teAligned", aidMinor: "Italy"});
    expect(lastLog(G, "minorAidGranted")?.args).toMatchObject({minor: "Italy", ally: "AU"});
  });

  test("the shift follows the attacker's chit when it determines a direction", () => {
    const G = fresh();
    unifyItaly(G);
    // GE TA-aligned: both Italy and the aider must move away toward the TE.
    G.powers.GE.alliance = "taAligned";
    beginAction(G);
    expect(declareWar(G, makeCtx([2, 1], seat("GE")), {minor: "Italy"}, "conquest", ["naples"], 2)).toBeUndefined();
    expect(G.pending?.power).toBe("FR");
    expect(resolvePending(G, makeCtx([], seat("FR")), "aid")).toBeUndefined();
    expect(G.powers.FR.alliance).toBe("teAligned");
    expect(G.persistent.italyAlliance).toBe("teAligned");
  });

  test("a capped aiding player does not stop Italy's own shift", () => {
    const G = fresh();
    unifyItaly(G);
    G.powers.GE.alliance = "taAligned";
    // The Entente already has its three player powers, so a neutral Austria's
    // voluntary aid shift is blocked by rule 8.4.
    for (const power of ["UK", "FR", "RU"] as const) G.powers[power].alliance = "teAligned";
    beginAction(G);
    expect(declareWar(G, makeCtx([1, 2], seat("GE")), {minor: "Italy"}, "conquest", ["naples"], 2)).toBeUndefined();
    expect(G.pending?.power).toBe("AU");
    expect(resolvePending(G, makeCtx([], seat("AU")), "aid")).toBeUndefined();

    // 8.4 blocks the player's chit...
    expect(G.powers.AU.alliance).toBe("neutral");
    const auShift = G.log.find((entry) => entry.key === "allianceShifted" && entry.power === "AU");
    expect(auShift?.args).toMatchObject({steps: 0, blocked: true, aidMinor: "Italy"});
    // ...but Italy is not a player power and still shifts.
    expect(G.persistent.italyAlliance).toBe("teAligned");
  });

  test("an Italy that is already aligned does not take the 14.2 special shift", () => {
    const G = fresh();
    unifyItaly(G);
    G.persistent.italyAlliance = "taAligned";
    beginAction(G);
    expect(declareWar(G, makeCtx([1, 2], seat("GE")), {minor: "Italy"}, "conquest", ["naples"], 2)).toBeUndefined();
    expect(resolvePending(G, makeCtx([], seat("AU")), "aid")).toBeUndefined();
    expect(G.powers.AU.alliance).toBe("teAligned");
    expect(G.persistent.italyAlliance).toBe("taAligned");
  });

  test("a non-Italian minor's aid does not move the Italy chit", () => {
    const G = fresh();
    unifyItaly(G);
    G.spaces.belgium.ally = null;
    G.spaces.belgium.diplomacy = "UK";
    beginAction(G);
    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Belgium"}, "conquest", ["belgium"], 2)).toBeUndefined();
    expect(resolvePending(G, makeCtx([], seat("UK")), "aid")).toBeUndefined();
    expect(G.powers.UK.alliance).toBe("teAligned");
    expect(G.persistent.italyAlliance).toBe("neutral");
  });
});
