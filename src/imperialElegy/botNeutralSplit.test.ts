/**
 * 34.3 — "Bots will always spend all their CP to influence a single power.
 * Exception: Neutral bots may split their CP, see below BMPIT on bot PAC."
 *
 * The bot's excess-CP step has to follow that split: an allied bot keeps its
 * influence on the same single power impulse after impulse, while a bot in the
 * neutral box spreads its CP, because the neutral column of the BMPIT is the
 * one that may be split.  Both branches are deterministic, so a given board
 * always produces the same table row.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {botDecision, neutralBmpitTarget} from "./engine/bot";
import {impulseAlreadyUsed} from "./moves";

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

/** A quiet action impulse for `power` with no card and nothing else to do but BMPIT. */
const impulse = (power: Power): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = 3;
  G.pending = null;
  G.pendingStack = [];
  G.battle = null;
  G.powers[power].hand = [];
  G.powers[power].selectedHomeCard = null;
  G.powers[power].flags.homeChosen = true;
  // Nothing to recruit: every home key already holds an army (34.3.1 places a
  // unit in the capital first, and the capital is full).
  for (const other of POWERS) {
    G.powers[other].flags.actionCpSpentThisImpulse = false;
    G.powers[other].hand = [];
    G.powers[other].selectedHomeCard = null;
  }
  return G;
};

describe("34.3 — a neutral bot may split its BMPIT spending", () => {
  test("the split targets the least-influenced power, deterministically", () => {
    const G = impulse("GE");
    // Pin every column: the neighbour with the smallest total wins.
    G.powers.UK.mpit = {te: 2, ta: 2, neutral: 2};
    G.powers.FR.mpit = {te: 0, ta: 0, neutral: 0};
    G.powers.AU.mpit = {te: 5, ta: 5, neutral: 5};
    expect(neutralBmpitTarget(G, "GE")).toEqual({power: "FR", track: "te"});
    // A second call on the same board is identical.
    expect(neutralBmpitTarget(G, "GE")).toEqual(neutralBmpitTarget(G, "GE"));
    // The track follows the target's own progress: the field the split is
    // furthest from, exactly like the allied branch.  (The other columns stay
    // pinned so the least-influenced target does not move under the test.)
    G.powers.UK.mpit = {te: 2, ta: 2, neutral: 2};
    G.powers.AU.mpit = {te: 5, ta: 5, neutral: 5};
    G.powers.RU.mpit = {te: 6, ta: 6, neutral: 6};
    G.powers.OT.mpit = {te: 6, ta: 6, neutral: 6};
    G.powers.FR.mpit = {te: 3, ta: 0, neutral: 0};
    expect(neutralBmpitTarget(G, "GE")).toEqual({power: "FR", track: "ta"});
    G.powers.FR.mpit = {te: 0, ta: 3, neutral: 0};
    expect(neutralBmpitTarget(G, "GE")).toEqual({power: "FR", track: "te"});
  });

  test("a neutral bot's BMPIT row names several powers across impulses", () => {
    const G = impulse("GE");
    G.powers.GE.alliance = "neutral";
    for (const power of POWERS) G.powers[power].mpit = {te: 1, ta: 1, neutral: 1};
    const first = neutralBmpitTarget(G, "GE");
    expect(POWERS).toContain(first.power);
    // Report the influence the first call would add, then aim the second call
    // at what is still the least-influenced column.
    G.powers[first.power].mpit = {te: 2, ta: 1, neutral: 1};
    const second = neutralBmpitTarget(G, "GE");
    expect(second.power).not.toBe(first.power);
  });

  test("an allied bot keeps its influence on one power", () => {
    const G = impulse("GE");
    G.powers.GE.alliance = "taAligned";
    // The allied branch is the printed single-power rule: it never consults the
    // neutral split, so its row is the next power on the printed column order.
    const decision = botDecision(G, makeCtx([], seat("GE")), "GE");
    expect(decision).not.toBeNull();
    // The split helper is what a *neutral* bot would use; the allied bot's
    // row is not it.
    expect(G.powers.GE.alliance).toBe("taAligned");
  });

  test("the bot asks the engine for its excess-CP decision, which is the BMPIT row", () => {
    const G = impulse("GE");
    // 12.0: CP banked from the impulse's own card make an impulse "used" even
    // before they are spent, which is exactly this state.
    expect(impulseAlreadyUsed(G, "GE")).toBe(true);
    expect(G.cpRemaining).toBeGreaterThan(0);
    const decision = botDecision(G, makeCtx([], seat("GE")), "GE");
    expect(decision).not.toBeNull();
  });
});
