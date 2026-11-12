/**
 * Rule 25.3 — Italy in the Great War (the Outbreak Step).
 *
 *   "If Italy is in the neutral box it does not join the GW during the Outbreak
 *   Step.  If Italy is in an aligned alliance box a die is rolled to see if
 *   Italy joins the war during the Outbreak Step.  On a roll of 4 or higher
 *   Italy joins the GW, but if the roll is 3 or less Italy immediately shifts
 *   to the neutral box and does not join the war at this time.  However, if
 *   Italy is in a committed alliance box, it automatically joins the GW with
 *   its alliance.  If Italy is not unified this rule does not apply.
 *   Exception: if Italy is blamed for the inciting incident based on the Crisis
 *   Table Result, it will automatically join the GW."
 *
 * Together with GW #2 ("Shift your chit on the Alliance Track" — Italy was the
 * historical case) this makes Italy an Alliance Track chit of its own, like the
 * US chit of 25.2.  The position lives in `G.gw.italyAlliance` and this module
 * imports no other engine module, so both `greatWar.ts` (outbreak) and
 * `greatWarFlow.ts` (GW #2) can use it without an import cycle.
 *
 * Joining is left to the caller (`enterGwAlly`), which needs a `Ctx`, the map
 * placement helpers and the entry log; this module only decides *whether* and
 * *on which side*.
 *
 * The same module owns Italy's own MPIT column (8.5/8.6/13.4.1): the typed
 * `G.italyMpit` counters, the neutral influence a player's refusal awards
 * Italy, and the end-phase alliance resolution that reads the column and
 * shifts the Italian chit.  That keeps the chart/column logic together without
 * pulling engine modules into the GW entry helpers.
 */
import type {AllianceBox, ImperialElegyState, ItalyMpit} from "../types";

export type ItalySide = "te" | "ta";
/** Rule 8.6: Italy's three MPIT markers and the direction they vote for. */
export type ItalyAllianceDirection = ItalySide | "neutral";

/** Alliance-track boxes in order from TA committed to TE committed. */
export const ALLIANCE_TRACK: readonly AllianceBox[] = ["taCommitted", "taAligned", "neutral", "teAligned", "teCommitted"];

/** Printed alliance per box; the aligned box is the alliance's guest box. */
const SIDE_BY_BOX: Partial<Record<AllianceBox, ItalySide>> = {
  teAligned: "te",
  teCommitted: "te",
  taAligned: "ta",
  taCommitted: "ta",
};

export const isAllianceBox = (value: unknown): value is AllianceBox =>
  typeof value === "string" && (ALLIANCE_TRACK as readonly string[]).includes(value);

/**
 * 25.3: Italy's Alliance Track box.  Only a unified Italy has one; before
 * unification the rule does not apply and Italy sits in the neutral box.
 */
export const italyAllianceBox = (G: ImperialElegyState): AllianceBox => {
  if (G.persistent.italyUnified !== true) return "neutral";
  const raw = G.gw?.italyAlliance ?? G.persistent.italyAlliance;
  return isAllianceBox(raw) ? raw : "neutral";
};

/** The alliance Italy would fight for from its current box (null when neutral). */
export const italyAllianceSide = (G: ImperialElegyState): ItalySide | null =>
  SIDE_BY_BOX[italyAllianceBox(G)] ?? null;

export const isCommittedBox = (box: AllianceBox): boolean => box.endsWith("Committed");

/**
 * Shift Italy one box toward `side`.  A neutral Italy only reaches that
 * alliance's *aligned* box, which is what makes GW #2's "4–6 roll" meaningful;
 * an Italy already in a box moves toward committed or back toward neutrality.
 * Returns the new box.
 */
export const shiftItalyToward = (G: ImperialElegyState, side: ItalySide): AllianceBox =>
  shiftItalyTowardDirection(G, side);

/**
 * Rule 8.6: shift Italy's chit one box toward `direction`.  "A player in an
 * alliance box whose roll means a shift towards the other alliance, will move
 * closer to neutrality first", so the neutral direction always steps toward
 * the centre of the track.
 */
export const shiftItalyTowardDirection = (
  G: ImperialElegyState,
  direction: ItalyAllianceDirection,
): AllianceBox => {
  const index = ALLIANCE_TRACK.indexOf(italyAllianceBox(G));
  const target = direction === "te" ? ALLIANCE_TRACK.length - 1 : direction === "ta" ? 0 : 2;
  const step = Math.sign(target - index);
  const next = ALLIANCE_TRACK[Math.max(0, Math.min(ALLIANCE_TRACK.length - 1, index + step))];
  if (G.gw) G.gw.italyAlliance = next;
  G.persistent.italyAlliance = next;
  return next;
};

// ---------------------------------------------------------------------------
// Rules 8.5 / 8.6 / 13.4.1 — Italy's own MPIT column
// ---------------------------------------------------------------------------

const ZERO_ITALY_MPIT: ItalyMpit = {te: 0, ta: 0, neutral: 0};

/** A non-negative integer counter, tolerating old saves and partial states. */
const counter = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

/**
 * Rule 8.5: a unified Italy has its own MPIT column with three counters.  The
 * typed column is `G.italyMpit`; saves written before it existed kept the same
 * markers under the legacy `persistent.italy_mpit_*` string keys, which are
 * still read (and folded into the typed column on the next write).
 */
export const italyMpitOf = (G: ImperialElegyState): ItalyMpit => {
  if (G.italyMpit !== undefined) {
    return {
      te: counter(G.italyMpit.te),
      ta: counter(G.italyMpit.ta),
      neutral: counter(G.italyMpit.neutral),
    };
  }
  return {
    te: counter(G.persistent.italy_mpit_te),
    ta: counter(G.persistent.italy_mpit_ta),
    neutral: counter(G.persistent.italy_mpit_neutral),
  };
};

/**
 * Rule 13.4.1: "If Italy is attacked and a player refuses to join the war
 * Italy gains 10 neutral influence on the MPIT per player that refused to
 * join."  `track` is one of Italy's three counters; the only printed source is
 * the neutral one.  Returns the new column for the log/callers.
 */
export const addItalyMpit = (
  G: ImperialElegyState,
  track: ItalyAllianceDirection,
  amount: number,
): ItalyMpit => {
  const next = italyMpitOf(G);
  next[track] = counter(next[track] + amount);
  G.italyMpit = next;
  return next;
};

/** Reset Italy's MPIT after a resolution (8.5): only the matching box keeps 1. */
export const resetItalyMpit = (G: ImperialElegyState, box: AllianceBox): ItalyMpit => {
  const side = SIDE_BY_BOX[box] ?? "neutral";
  G.italyMpit = {...ZERO_ITALY_MPIT, [side]: 1};
  return G.italyMpit;
};

/** One Italy 8.6 roll, before the shift and the MPIT reset are applied. */
export interface ItalyAllianceRoll {
  /** Italy's influence at the moment it resolved. */
  influence: ItalyMpit;
  /** The total that decides the resolution order. */
  total: number;
  /** The marker results; null when only one marker was in play. */
  rolls: {te: number; ta: number; neutral: number} | null;
  /** Directions by result, highest first (printed TE/TA/neutral order on ties). */
  ranked: {side: ItalyAllianceDirection; result: number}[];
  direction: ItalyAllianceDirection;
  /** Rule 8.6.1: a differential of 10+ shifts twice. */
  steps: 1 | 2;
}

const italyOrder: readonly ItalyAllianceDirection[] = ["te", "ta", "neutral"];

/**
 * Rule 8.6, Italy's half.  Italy rolls exactly like a player power — one
 * influence type shifts automatically, two or three roll 2d6 per marker with
 * the influence as a DRM — except that "reroll the dice if the Italian result
 * produces a tie".  Returns null when Italy has no influence to resolve.
 */
export const rollItalyAllianceResolution = (
  G: ImperialElegyState,
  rollDie: () => number,
): ItalyAllianceRoll | null => {
  const influence = italyMpitOf(G);
  const total = influence.te + influence.ta + influence.neutral;
  if (total <= 0) return null;
  const present = italyOrder.filter((side) => influence[side] >= 1);
  if (present.length === 1) {
    const side = present[0];
    return {
      influence,
      total,
      rolls: null,
      ranked: [{side, result: influence[side]}],
      direction: side,
      steps: 1,
    };
  }

  // 8.6: "a die is rolled for each marker" — only the markers with at least
  // one influence are rolled (the printed example rolls two dice for a power
  // with neutral + Triple Alliance influence).
  const rollOnce = (): {te: number; ta: number; neutral: number} => ({
    te: present.includes("te") ? rollDie() + rollDie() + influence.te : 0,
    ta: present.includes("ta") ? rollDie() + rollDie() + influence.ta : 0,
    neutral: present.includes("neutral") ? rollDie() + rollDie() + influence.neutral : 0,
  });
  const rank = (rolls: {te: number; ta: number; neutral: number}) => {
    const ranked = italyOrder
      .map((side) => ({side, result: rolls[side]}))
      .sort((a, b) => b.result - a.result || italyOrder.indexOf(a.side) - italyOrder.indexOf(b.side));
    const top = ranked[0].result;
    return {ranked, tied: ranked.filter((entry) => entry.result === top).map((entry) => entry.side)};
  };

  let rolls = rollOnce();
  let {ranked, tied} = rank(rolls);
  // 8.6: "Reroll the dice if the Italian result produces a tie."  The cap is a
  // determinism guard only; it is never reached with a fair die in practice.
  for (let attempt = 0; attempt < 50 && tied.length > 1; attempt += 1) {
    rolls = rollOnce();
    ({ranked, tied} = rank(rolls));
  }
  const direction = ranked[0].side;
  const top = ranked[0];
  const second = ranked.find((entry) => entry.side !== direction);
  const steps: 1 | 2 = second !== undefined && top.result - second.result >= 10 ? 2 : 1;
  return {influence, total, rolls, ranked, direction, steps};
};

export interface ItalyAllianceShift {
  from: AllianceBox;
  to: AllianceBox;
  steps: number;
  /** True when the track end stopped the printed two-box shift. */
  blocked: boolean;
}

/**
 * Rule 8.6, second half for Italy: shift the chit (twice on a differential of
 * 10+, stopping at the track end), then reset the MPIT to the new box (8.5).
 */
export const applyItalyAllianceResolution = (
  G: ImperialElegyState,
  roll: ItalyAllianceRoll,
): ItalyAllianceShift => {
  const from = italyAllianceBox(G);
  let to = from;
  let moved = 0;
  for (let step = 0; step < roll.steps; step += 1) {
    const next = shiftItalyTowardDirection(G, roll.direction);
    if (next === to) break;
    to = next;
    moved += 1;
  }
  resetItalyMpit(G, to);
  return {from, to, steps: moved, blocked: moved < roll.steps};
};

export type ItalyOutbreakOutcome =
  | "notUnified"
  | "neutral"
  | "blamed"
  | "committed"
  | "alignedJoined"
  | "alignedWithdrew";

export interface ItalyOutbreakPlan {
  outcome: ItalyOutbreakOutcome;
  /** The box Italy occupied when the outbreak step began. */
  box: AllianceBox;
  /** The side Italy joins, when it joins. */
  side: ItalySide | null;
  /** The die result for an aligned Italy; null when no die is rolled. */
  roll: number | null;
}

/**
 * 25.3, pure decision half.  `blamed` is true when the inciting incident is one
 * of the cards the Crisis Table blames Italy for (Assassination!, Powder Keg and
 * The Black Hand are the printed "*blame*" rows of the table; Morocco / 'Urabi
 * Revolt sits in a neighbouring cell, so it is accepted too).  A unified Italy
 * that stood in an aligned box and rolled low moves to neutral in the caller.
 */
export const planItalyOutbreak = (
  G: ImperialElegyState,
  blamed: boolean,
  rolled: number,
): ItalyOutbreakPlan => {
  const box = italyAllianceBox(G);
  if (G.persistent.italyUnified !== true) return {outcome: "notUnified", box, side: null, roll: null};
  const side = SIDE_BY_BOX[box] ?? null;
  // "It will automatically join the GW" overrides even the neutral box.
  if (blamed) return {outcome: "blamed", box, side, roll: null};
  if (side === null) return {outcome: "neutral", box, side: null, roll: null};
  if (isCommittedBox(box)) return {outcome: "committed", box, side, roll: null};
  // Aligned box: 4+ joins, 3 or less withdraws to neutral (no die on 25.3).
  return rolled >= 4
    ? {outcome: "alignedJoined", box, side, roll: rolled}
    : {outcome: "alignedWithdrew", box, side: null, roll: rolled};
};

/**
 * GW #2 for Italy: "If Italy is chosen roll a die, on a 4–6 Italy shifts into
 * the chosen alliance and joins the GW."  One play moves one box, so repeated
 * plays walk Italy neutral -> aligned -> committed; only a 4–6 at the end of
 * that road brings it into the war, and a committed box then joins
 * automatically (25.3).
 */
export const italyGwCardEntryPlan = (G: ImperialElegyState, side: ItalySide, rolled: number): ItalyOutbreakPlan => {
  shiftItalyToward(G, side);
  return planItalyOutbreak(G, false, rolled);
};

/** One-line odds for the GW #2 chooser, read from Italy's box before the shift. */
export const italyEntryOdds = (box: AllianceBox): string =>
  box === "neutral"
    ? "shifts into the chosen alliance, joins on 4–6"
    : isCommittedBox(box)
      ? "already committed: joins automatically"
      : "in the aligned box of one alliance: a 4–6 makes it join";
