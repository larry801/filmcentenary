/**
 * Rule 8.6 — the action-phase Alliance Resolution Step's tie.
 *
 * The Shifting Alliances / The Alliance System events "immediately conduct an
 * alliance resolution step".  Rule 8.6 says "in the case of a tie the player
 * chooses how they shift", so the event must suspend exactly like the live
 * 20.9 end-phase step.  Both callers now share the `allianceTie` pending kind:
 * the dice already rolled are kept in the decision's context and are never
 * re-rolled, and declining takes the deterministic default.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {redactForView} from "./engine/privacy";
import {playCard, resolvePending, declinePending} from "./moves";

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

/**
 * Arm GE with Shifting Alliances.  GE has two influence types with equal
 * influence, so each marker rolls two dice; the scripted dice [3,3,1,5,1,1] make
 * both results tie at 7.
 */
const armShiftingAlliances = (G: ImperialElegyState): void => {
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  G.pending = null;
  G.war = null;
  G.powers.GE.hand = ["IE-A015"];
  for (const power of POWERS) G.powers[power].mpit = {te: 0, ta: 0, neutral: 0};
  G.powers.GE.mpit = {te: 1, ta: 1, neutral: 0};
};

describe("8.6 action-phase alliance resolution tie", () => {
  test("the card suspends on the shared allianceTie pending and resumes", () => {
    const G = fresh();
    armShiftingAlliances(G);
    const next = makeCtx([3, 3, 1, 5, 1, 1], seat("GE"));

    expect(playCard(G, next, "IE-A015", "event")).toBeUndefined();
    // The card's own "shift your chit" choice comes first.
    expect(G.pending?.kind).toBe("eventChoice");
    expect(resolvePending(G, next, "te")).toBeUndefined();
    // GE shifts to the Entente aligned box; the resolution then ties.
    expect(G.powers.GE.alliance).toBe("teAligned");
    expect(G.pending?.kind).toBe("allianceTie");
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.options.map((option) => option.id).sort()).toEqual(["ta", "te"]);
    // The rolled dice live in the context (private) and are not re-rolled.
    expect(G.pending?.context?.roll).toMatchObject({tied: ["te", "ta"]});

    // The deciding player chooses the Triple Entente.
    expect(resolvePending(G, next, "te")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.powers.GE.alliance).toBe("teCommitted");
    // 8.5: the MPIT resets to the marker matching the new box.
    expect(G.powers.GE.mpit).toEqual({te: 1, ta: 0, neutral: 0});
    // The card is only discarded after the chain finishes.
    expect(G.discard).toContain("IE-A015");
    expect(G.resolvingCard).toBeNull();
    expect(lastLog(G, "allianceResolution")?.args).toMatchObject({steps: 1, to: "teCommitted"});
  });

  test("the tie decision is private to the deciding seat", () => {
    const G = fresh();
    armShiftingAlliances(G);
    const next = makeCtx([3, 3, 1, 5, 1, 1], seat("GE"));
    playCard(G, next, "IE-A015", "event");
    resolvePending(G, next, "te");
    expect(G.pending?.kind).toBe("allianceTie");

    const own = redactForView(G, seat("GE"), next);
    expect(own.pending?.options.map((option) => option.id).sort()).toEqual(["ta", "te"]);
    expect(own.pending?.context?.roll).toBeDefined();

    const other = redactForView(G, seat("RU"), next);
    expect(other.pending?.options).toEqual([]);
    expect(other.pending?.context).toEqual({});
    expect(other.pending?.promptArgs).toEqual({});
  });

  test("declining the tie takes the deterministic 8.6 direction", () => {
    const G = fresh();
    armShiftingAlliances(G);
    const next = makeCtx([3, 3, 1, 5, 1, 1], seat("GE"));
    playCard(G, next, "IE-A015", "event");
    resolvePending(G, next, "te");
    expect(G.pending?.kind).toBe("allianceTie");

    // GE's chit is teAligned, so the 8.6 default prefers the Entente.
    expect(declinePending(G, next)).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.powers.GE.alliance).toBe("teCommitted");
    expect(G.discard).toContain("IE-A015");
  });

  test("a later power's tie suspends again without re-rolling the first", () => {
    const G = fresh();
    armShiftingAlliances(G);
    // GE resolves first (same total, earlier seat).  UK then ties as well.
    G.powers.UK.mpit = {te: 1, ta: 1, neutral: 0};
    // GE: te 3+3+1=7, ta 1+5+1=7, neutral 1+1+0=2.
    // UK: te 2+2+1=5, ta 4+4+1=9 -> no tie on these dice; use 4+4 and 2+6.
    const next = makeCtx([3, 3, 1, 5, 1, 1, 4, 4, 2, 6, 1, 1], seat("GE"));
    playCard(G, next, "IE-A015", "event");
    resolvePending(G, next, "te");
    expect(G.pending?.kind).toBe("allianceTie");
    expect(G.pending?.power).toBe("GE");
    expect(resolvePending(G, next, "te")).toBeUndefined();
    expect(G.pending?.kind).toBe("allianceTie");
    // The next tied power is asked with its own dice; GE was already resolved.
    expect(G.pending?.kind).toBe("allianceTie");
    expect(G.pending?.power).toBe("UK");
    expect(G.pending?.context?.roll).toMatchObject({tied: ["te", "ta"]});
    expect(G.powers.GE.mpit).toEqual({te: 1, ta: 0, neutral: 0});
    expect(resolvePending(G, makeCtx([], seat("UK")), "ta")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.powers.UK.mpit).toEqual({te: 0, ta: 1, neutral: 0});
    expect(G.log.filter((entry) => entry.key === "allianceResolution")).toHaveLength(2);
  });

  test("an untied resolution still completes without a decision", () => {
    const G = fresh();
    armShiftingAlliances(G);
    // Only one influence type: the chit shifts automatically, no die is rolled.
    G.powers.GE.mpit = {te: 2, ta: 0, neutral: 0};
    const next = makeCtx([6], seat("GE"));
    expect(playCard(G, next, "IE-A015", "event")).toBeUndefined();
    expect(G.pending?.kind).toBe("eventChoice");
    expect(resolvePending(G, next, "te")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.powers.GE.alliance).toBe("teCommitted");
    expect(G.powers.GE.mpit).toEqual({te: 1, ta: 0, neutral: 0});
    expect(G.discard).toContain("IE-A015");
  });

  test("a rejected option does not consume the tie", () => {
    const G = fresh();
    armShiftingAlliances(G);
    const next = makeCtx([3, 3, 1, 5, 1, 1], seat("GE"));
    playCard(G, next, "IE-A015", "event");
    resolvePending(G, next, "te");
    expect(G.pending?.kind).toBe("allianceTie");
    // "neutral" is not one of the tied directions.
    expect(resolvePending(G, next, "neutral")).not.toBeUndefined();
    expect(G.pending?.kind).toBe("allianceTie");
    expect(G.powers.GE.alliance).toBe("teAligned");
  });
});
