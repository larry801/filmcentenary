/**
 * Rule 12.0 / 27.3 — the two cards that forbid passing.
 *
 * A047 The Dual Monarchy and GW #10 Exhaustion both print "you cannot pass
 * with this card in your hand".  Because `pass` is the only way out of an
 * action impulse, a naive reading of that clause dead-ends the table: the
 * holder cannot pass and `endImpulse` refuses a hand holding a playable
 * event.  These tests pin the recoverable behaviour — the card must be played
 * for CP, and that impulse can then end.
 */

import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {ImperialElegyState, Power} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {DUAL_MONARCHY_CARD, EXHAUSTION_CARD, passRestriction} from "./engine/characteristics";
import {
  canPassNow,
  chooseHomeCard,
  endDiplomacy,
  endImpulse,
  finishPrep,
  gwPass,
  pass,
  playCard,
  resolvePending,
} from "./moves";

const POWERS: Power[] = ["GE", "UK", "FR", "AU", "RU", "OT"];
const seatOf = (power: Power): string => String(POWERS.indexOf(power));

const makeCtx = (power: Power, G: {phase?: string} = {}): Ctx =>
  ({
    playerID: seatOf(power),
    random: {Die: (_sides: number) => 3, Number: () => 1, Shuffle: (a: unknown[]) => a},
    events: {
      setPhase: (phase: string) => {
        G.phase = phase;
      },
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
  }) as unknown as Ctx;

/** Reach turn 1's action phase through the real prep and diplomacy moves. */
const reachActionPhase = (): ImperialElegyState => {
  const holder: {phase?: string} = {};
  const G = setupImperialElegy(makeCtx("GE", holder));
  holder.phase = G.phase;
  for (const power of POWERS) finishPrep(G, makeCtx(power, holder));
  for (const power of POWERS) chooseHomeCard(G, makeCtx(power, holder), G.powers[power].homeCards[0]);
  endDiplomacy(G, makeCtx("GE", holder));
  // 33.4 Metternich's Legacy leaves a pending AU choice open at the end of the
  // turn-1 diplomacy phase; answer it so the phase is ready to play.
  while (G.pending?.kind === "metternich") {
    const option = G.pending.options[0];
    resolvePending(G, makeCtx("AU", holder), option.id);
  }
  expect(G.phase).toBe("action");
  return G;
};

describe("passRestriction", () => {
  test("flags the two printed no-pass cards and nothing else", () => {
    const G = setupImperialElegy(makeCtx("AU"));
    expect(passRestriction(G, "AU", []).forced).toBe(false);
    expect(passRestriction(G, "AU", ["IE-A013"]).forced).toBe(false);

    const dual = passRestriction(G, "AU", [DUAL_MONARCHY_CARD, "IE-A013"]);
    expect(dual.forced).toBe(true);
    expect(dual.cpRequired).toBe(true);
    expect(dual.cards.map((c) => c.card)).toEqual([DUAL_MONARCHY_CARD]);
    expect(dual.cards[0].rule).toBe("A047");

    expect(passRestriction(G, "GE", [EXHAUSTION_CARD]).cards[0].rule).toBe("GW-10");
  });
});

describe("12.0 A047 The Dual Monarchy", () => {
  test("cannot pass, and its CP is playable even with CP already banked", () => {
    const G = reachActionPhase();
    const holder: {phase?: string} = {phase: "action"};
    const au = makeCtx("AU", holder);

    G.activePower = "AU";
    G.cpRemaining = 0;
    G.powers.AU.hand = [DUAL_MONARCHY_CARD];

    expect(canPassNow(G, "AU")).toBe(false);
    expect(pass(G, au)).toBe(INVALID_MOVE);

    expect(playCard(G, au, DUAL_MONARCHY_CARD, "cp")).toBeUndefined();
    expect(G.cpRemaining).toBe(2);
    expect(G.powers.AU.hand).not.toContain(DUAL_MONARCHY_CARD);

    G.cpRemaining = 0;
    expect(endImpulse(G, au)).toBeUndefined();
    expect(G.activePower).not.toBe("AU");
  });

  test("a hand the engine cannot otherwise play still has a legal move", () => {
    const G = reachActionPhase();
    const holder: {phase?: string} = {phase: "action"};
    const ot = makeCtx("OT", holder);

    // This is the state the seven-turn auto-play campaign reached on turn 5:
    // A047 (no passing) beside A043, a combat card `playCard` refuses, plus a
    // home card.  Before the fix every move returned INVALID_MOVE and the
    // match had no exit at all.
    G.activePower = "OT";
    G.cpRemaining = 2;
    G.powers.OT.hand = ["IE-A043", DUAL_MONARCHY_CARD, "IE-H-OT-11"];

    expect(pass(G, ot)).toBe(INVALID_MOVE);
    expect(playCard(G, ot, "IE-A043", "event")).toBe(INVALID_MOVE);
    expect(playCard(G, ot, "IE-A043", "cp")).toBe(INVALID_MOVE);

    // The rescue: A047 can be spent on top of the banked CP.
    expect(playCard(G, ot, DUAL_MONARCHY_CARD, "cp")).toBeUndefined();
    expect(G.cpRemaining).toBe(4);
    expect(G.powers.OT.hand).not.toContain(DUAL_MONARCHY_CARD);

    // With the forced card gone the impulse can end normally.
    G.cpRemaining = 0;
    expect(endImpulse(G, ot)).toBeUndefined();
    expect(G.activePower).not.toBe("OT");
  });

  test("a seat without the card keeps the ordinary 12.0 pass rules", () => {
    // 12.0 also caps the hand: two cards cannot be passed away (UK excepted),
    // one plain event can.
    const G = reachActionPhase();
    G.activePower = "GE";
    G.cpRemaining = 0;
    // Two non-home, non-mandatory cards: more than the one card a non-UK seat
    // may pass with, so passing is refused for the printed reason only.
    G.powers.GE.hand = ["IE-A018", "IE-A020"];
    expect(pass(G, makeCtx("GE"))).toBe(INVALID_MOVE);
    expect(passRestriction(G, "GE").forced).toBe(false);

    G.powers.GE.hand = ["IE-A018"];
    expect(canPassNow(G, "GE")).toBe(true);
    expect(pass(G, makeCtx("GE"))).toBeUndefined();
  });
});

describe("27.3 GW Exhaustion", () => {
  /** The same minimal GW state `greatWarIntegration.test.ts` uses. */
  const baseGw = (): ImperialElegyState => {
    const G = setupImperialElegy(makeCtx("GE"));
    G.gw = {
      active: true,
      turn: 1,
      order: ["GE", "FR"],
      belligerents: ["GE", "FR"],
      neutrals: ["UK", "AU", "RU", "OT"],
      te: ["FR"],
      ta: ["GE"],
      usIn: false,
      italyIn: false,
      usStability: 3,
      usManpower: 3,
      usBudget: 4,
      italyStability: 3,
      italyManpower: 3,
      italyBudget: 2,
      trenches: {},
      lastColonialWar: null,
      victor: null,
      outbreakDone: true,
      nationalWillDone: true,
      bonusImpulses: [],
    } as unknown as ImperialElegyState["gw"];
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.turnIndex = 0;
    return G;
  };

  test("cannot pass while holding Exhaustion, but can once it is played", () => {
    const G = baseGw();
    G.powers.GE.gwCard = EXHAUSTION_CARD;

    expect(gwPass(G, makeCtx("GE"))).toBe(INVALID_MOVE);
    expect(G.powers.GE.flags.passedGw).not.toBe(true);

    // Playing it (for CP) is the legal way forward; then passing works.
    G.powers.GE.gwBudget = 0;
    expect(G.powers.GE.gwCard).toBe(EXHAUSTION_CARD);
    G.powers.GE.gwCard = null;
    expect(gwPass(G, makeCtx("GE"))).toBeUndefined();
    expect(G.powers.GE.flags.passedGw).toBe(true);
  });

  test("a different GW card does not block passing", () => {
    const G = baseGw();
    G.powers.GE.gwCard = "IE-GW-01";
    expect(gwPass(G, makeCtx("GE"))).toBeUndefined();
  });
});
