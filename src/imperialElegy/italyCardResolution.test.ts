/**
 * Rule 8.6 — a unified Italy resolves its own MPIT column during the
 * action-phase Alliance System / Shifting Alliances events.
 *
 * "During this step all players and a unified Italy determine if they shift on
 * the alliance track. ... If it has 2 or 3 types of influence ≥1, a die is
 * rolled for each marker. ... Reroll the dice if the Italian result produces a
 * tie."  The live card events previously resolved players only; they now run
 * the same `resolveItalyAllianceStep` as the 20.9 end phase: one marker shifts
 * automatically, 2d6 + influence decides multiple markers, a differential of
 * 10+ shifts two boxes (8.6.1), a tie is rerolled, and 8.5 resets the column to
 * the marker matching the new box.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {playCard, resolvePending} from "./moves";

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
 * Arm GE with Shifting Alliances.  Every player power starts at zero influence
 * so only GE (one marker, automatic shift) takes part; the scripted dice are
 * then Italy's alone.
 */
const armShiftingAlliances = (
  G: ImperialElegyState,
  options: {unified?: boolean; italyBox?: string; italyMpit?: {te: number; ta: number; neutral: number}} = {},
): void => {
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  G.pending = null;
  G.war = null;
  G.powers.GE.hand = ["IE-A015"];
  for (const power of POWERS) G.powers[power].mpit = {te: 0, ta: 0, neutral: 0};
  G.powers.GE.mpit = {te: 1, ta: 0, neutral: 0};
  if (options.unified !== false) {
    G.persistent.italyUnified = true;
    G.flags.italyUnified = true;
    G.persistent.italyAlliance = options.italyBox ?? "neutral";
    G.spaces.rome.control = "IT";
    G.spaces.naples.control = "IT";
    G.italyMpit = options.italyMpit ?? {te: 0, ta: 0, neutral: 0};
  }
};

/** Play the card and answer its own "shift your chit" choice with TE. */
const playShiftingAlliances = (G: ImperialElegyState, ctx: Ctx): void => {
  expect(playCard(G, ctx, "IE-A015", "event")).toBeUndefined();
  expect(G.pending?.kind).toBe("eventChoice");
  expect(resolvePending(G, ctx, "te")).toBeUndefined();
};

describe("8.6 action-phase events resolve unified Italy's MPIT", () => {
  test("a single Italian marker shifts automatically and resets to the new box", () => {
    const G = fresh();
    armShiftingAlliances(G, {
      italyBox: "teAligned",
      italyMpit: {te: 0, ta: 0, neutral: 10},
    });
    const ctx = makeCtx([], seat("GE"));
    playShiftingAlliances(G, ctx);

    expect(G.pending).toBeNull();
    // GE auto-shifts TE -> committed; Italy's neutral marker steps one box
    // toward neutrality.
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
    expect(G.log.filter((entry) => entry.key === "italyAllianceResolution")).toHaveLength(1);
    expect(G.discard).toContain("IE-A015");
  });

  test("2d6 + influence with a differential of 10+ shifts Italy two boxes", () => {
    const G = fresh();
    armShiftingAlliances(G, {
      italyBox: "neutral",
      italyMpit: {te: 1, ta: 0, neutral: 1},
    });
    // Italy rolls TE first (2d6) then neutral (2d6): 13 vs 3 = differential 10.
    const ctx = makeCtx([6, 6, 1, 1], seat("GE"));
    playShiftingAlliances(G, ctx);

    expect(G.persistent.italyAlliance).toBe("teCommitted");
    expect(G.italyMpit).toEqual({te: 1, ta: 0, neutral: 0});
    expect(lastLog(G, "italyAllianceResolution")?.args).toMatchObject({
      major: "IT",
      te: 13,
      ta: 0,
      neutral: 3,
      direction: "te",
      steps: 2,
      blocked: false,
      from: "neutral",
      to: "teCommitted",
    });
  });

  test("an Italian tie is rerolled instead of opening a decision", () => {
    const G = fresh();
    armShiftingAlliances(G, {
      italyBox: "neutral",
      italyMpit: {te: 1, ta: 1, neutral: 0},
    });
    // First roll ties 3-3 (TE 1+1+1, TA 1+1+1); reroll is TE 4 / TA 3.
    const ctx = makeCtx([1, 1, 1, 1, 2, 1, 1, 1], seat("GE"));
    playShiftingAlliances(G, ctx);

    expect(G.pending).toBeNull();
    expect(G.persistent.italyAlliance).toBe("teAligned");
    expect(G.italyMpit).toEqual({te: 1, ta: 0, neutral: 0});
    expect(lastLog(G, "italyAllianceResolution")?.args).toMatchObject({
      direction: "te",
      te: 4,
      ta: 3,
      steps: 1,
      to: "teAligned",
    });
    // The 8.6 player tie decision is only for player powers.
    expect(G.log.filter((entry) => entry.key === "allianceTie")).toHaveLength(0);
  });

  test("a player's suspended tie resumes and Italy resolves exactly once", () => {
    const G = fresh();
    armShiftingAlliances(G, {
      italyBox: "teAligned",
      italyMpit: {te: 0, ta: 0, neutral: 5},
    });
    // GE has TE and TA influence: 3+3+1=7 and 1+5+1=7, a printed player tie.
    G.powers.GE.mpit = {te: 1, ta: 1, neutral: 0};
    const ctx = makeCtx([3, 3, 1, 5, 1, 1], seat("GE"));
    playShiftingAlliances(G, ctx);

    expect(G.pending?.kind).toBe("allianceTie");
    expect(G.pending?.power).toBe("GE");
    // Italy has not resolved while the player's decision is open.
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 5});
    expect(lastLog(G, "italyAllianceResolution")).toBeUndefined();

    expect(resolvePending(G, ctx, "te")).toBeUndefined();
    expect(G.pending).toBeNull();
    // Italy's neutral marker then shifts TE aligned -> neutral and resets.
    expect(G.persistent.italyAlliance).toBe("neutral");
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 1});
    expect(G.log.filter((entry) => entry.key === "italyAllianceResolution")).toHaveLength(1);
  });

  test("no unified Italy means no Italian resolution even with MPIT influence", () => {
    const G = fresh();
    armShiftingAlliances(G, {unified: false});
    G.italyMpit = {te: 0, ta: 0, neutral: 10};
    const ctx = makeCtx([], seat("GE"));
    playShiftingAlliances(G, ctx);

    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 10});
    expect(lastLog(G, "italyAllianceResolution")).toBeUndefined();
  });

  test("a unified Italy with no influence is skipped", () => {
    const G = fresh();
    armShiftingAlliances(G, {
      italyBox: "taAligned",
      italyMpit: {te: 0, ta: 0, neutral: 0},
    });
    const ctx = makeCtx([], seat("GE"));
    playShiftingAlliances(G, ctx);

    expect(G.persistent.italyAlliance).toBe("taAligned");
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 0});
    expect(lastLog(G, "italyAllianceResolution")).toBeUndefined();
  });
});
