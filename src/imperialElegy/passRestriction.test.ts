/**
 * Rule 12.0 / 27.3 — the two cards that forbid passing.
 *
 * A047 The Dual Monarchy and GW #10 Exhaustion both print "you cannot pass
 * with this card in your hand".  Because `pass` is the only way out of an
 * action impulse, a naive reading of that clause dead-ends the table: the
 * holder cannot pass, and only a card played for CP opens the exit again.
 * These tests pin the recoverable behaviour — the card must be played, and that
 * used impulse can then be handed over.
 */

import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {ImperialElegyState, Power} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {DUAL_MONARCHY_CARD, EXHAUSTION_CARD, passRestriction} from "./engine/characteristics";
import {cardAvailability} from "./components/cardAvailability";
import {
  canPassNow,
  chooseHomeCard,
  endDiplomacy,
  finishPrep,
  gwPass,
  pass,
  playCard,
  resolvePending,
} from "./moves";

const POWERS: Power[] = ["GE", "UK", "FR", "AU", "RU", "OT"];
const seatOf = (power: Power): string => String(POWERS.indexOf(power));

/** The hand's own "why not" line for a card, as the tray would show it. */
const passCardReason = (G: ImperialElegyState, cardId: string): string => cardAvailability({
  G,
  power: G.activePower,
  cardId,
  phase: G.phase,
  isActive: true,
  isBelligerent: false,
  war: G.war,
  canActionCard: true,
  saveList: [],
  forcedCardIds: passRestriction(G, G.activePower).cards.map((c) => c.card),
  industryCard: G.powers[G.activePower].industryCard,
  cpChainLength: G.powers[G.activePower].cpChain.length,
  homeCards: [],
  playBlock: {},
  responseBlock: {},
  bi: (en: string) => en,
}).reasons.join(" · ");

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
  test("cannot pass, and its CP is the impulse's single card play", () => {
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
    expect(pass(G, au)).toBeUndefined();
    expect(G.activePower).not.toBe("AU");
  });

  test("the no-pass card grants no second card in the same impulse", () => {
    // 12.0 is one card per impulse, so A047 cannot be a "rescue" play on top of
    // CP banked by another card.  The legal exit is to hand the used impulse
    // over, which `pass` always allows once a card has been played.
    const G = reachActionPhase();
    const au = makeCtx("AU", {phase: "action"});
    G.activePower = "AU";
    G.cpRemaining = 0;
    G.powers.AU.hand = [DUAL_MONARCHY_CARD, "IE-A018"];

    expect(playCard(G, au, "IE-A018", "cp")).toBeUndefined();
    // A018 grants 1 CP, so the banked-CP wording is the live reason here.
    expect(passCardReason(G, DUAL_MONARCHY_CARD)).toContain("Finish the current impulse first");
    expect(playCard(G, au, DUAL_MONARCHY_CARD, "cp")).toBe(INVALID_MOVE);
    expect(G.powers.AU.hand).toContain(DUAL_MONARCHY_CARD);
    expect(G.cpRemaining).toBe(1);

    // The used impulse may be handed over even though the no-pass card is held.
    expect(pass(G, au)).toBeUndefined();
    expect(G.activePower).not.toBe("AU");
  });

  test("a hand the engine cannot otherwise play still has a legal move", () => {
    const G = reachActionPhase();
    const holder: {phase?: string} = {phase: "action"};
    const ot = makeCtx("OT", holder);

    // This is the state the seven-turn auto-play campaign reached on turn 5:
    // A047 (no passing) beside A043, a combat card, plus a home card.  Before
    // the fix every move returned INVALID_MOVE and the match had no exit at all.
    //
    // The impulse is unused here on purpose: once a card has been played for CP
    // the seat may always hand the used impulse over (12.0 only restricts the
    // pass of an *unused* one), so banked CP would hide the deadlock.
    G.activePower = "OT";
    G.cpRemaining = 0;
    G.powers.OT.hand = ["IE-A043", DUAL_MONARCHY_CARD, "IE-H-OT-11"];

    expect(pass(G, ot)).toBe(INVALID_MOVE);
    // 12.0: a combat card is a CP card too, so this hand has a legal exit.
    expect(playCard(G, ot, "IE-A043", "cp")).toBeUndefined();
    expect(G.cpRemaining).toBe(2);
    expect(G.powers.OT.hand).not.toContain("IE-A043");
  });

  test("the no-pass card grants no second card in the same impulse", () => {
    // 12.0 is one card per impulse, so A047 cannot be a "rescue" play on top of
    // CP banked by another card.  The legal exit is to hand the used impulse
    // over, which `pass` always allows once a card has been played.
    const G = reachActionPhase();
    const holder: {phase?: string} = {phase: "action"};
    const ot = makeCtx("OT", holder);

    G.activePower = "OT";
    G.cpRemaining = 0;
    G.powers.OT.hand = [DUAL_MONARCHY_CARD, "IE-A018"];

    // A047 opens the impulse for CP; that makes the impulse used.
    expect(playCard(G, ot, DUAL_MONARCHY_CARD, "cp")).toBeUndefined();
    expect(G.cpRemaining).toBe(2);
    expect(G.powers.OT.hand).not.toContain(DUAL_MONARCHY_CARD);

    // The second card is refused even though the impulse still holds CP, and
    // refused again once the CP are gone: one card per impulse.
    expect(playCard(G, ot, "IE-A018", "cp")).toBe(INVALID_MOVE);
    G.cpRemaining = 0;
    expect(passCardReason(G, "IE-A018")).toContain("One card per impulse; finish this impulse first");
    expect(playCard(G, ot, "IE-A018", "cp")).toBe(INVALID_MOVE);
    expect(G.powers.OT.hand).toContain("IE-A018");

    // The used impulse can still be handed over normally.
    expect(pass(G, ot)).toBeUndefined();
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

describe("12.0 one exit: a used impulse may always be handed over", () => {
  /** A seat holding many cards, which 12.0 forbids passing with. */
  const crowded = (): ImperialElegyState => {
    const G = reachActionPhase();
    G.activePower = "GE";
    G.powers.GE.hand = ["IE-A018", "IE-A020", "IE-A021"];
    return G;
  };

  test("an unused crowded hand cannot be skipped", () => {
    const G = crowded();
    G.cpRemaining = 0;
    expect(canPassNow(G, "GE")).toBe(false);
    expect(pass(G, makeCtx("GE"))).toBe(INVALID_MOVE);
    // Nothing moved: no pass recorded, GE still active.
    expect(G.passed).toEqual([]);
    expect(G.activePower).toBe("GE");
  });

  test("playing a card makes that same crowded hand handable-over", () => {
    const G = crowded();
    const ctx = makeCtx("GE");
    expect(playCard(G, ctx, "IE-A018", "cp")).toBeUndefined();
    expect(G.cpRemaining).toBeGreaterThan(0);
    // The unused-impulse restriction no longer applies …
    expect(canPassNow(G, "GE")).toBe(false);
    expect(pass(G, ctx)).toBeUndefined();
    // … and the remaining CP are forfeited, with no pass recorded.
    expect(G.cpRemaining).toBe(0);
    expect(G.passed).toEqual([]);
    expect(G.activePower).not.toBe("GE");
  });

  test("the flag alone is enough, even with every hand card still held", () => {
    const G = crowded();
    // A card was played but the engine kept the hand full (an event that gives
    // CP back, a chained mandatory card): the impulse is still used.
    G.cpRemaining = 0;
    G.powers.GE.flags.actionCpSpentThisImpulse = true;
    expect(pass(G, makeCtx("GE"))).toBeUndefined();
    expect(G.passed).toEqual([]);
  });

  test("a pass of an unused impulse is still recorded for 12.0's phase end", () => {
    const G = reachActionPhase();
    G.activePower = "GE";
    G.cpRemaining = 0;
    G.powers.GE.hand = [];
    expect(pass(G, makeCtx("GE"))).toBeUndefined();
    expect(G.passed).toContain("GE");
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
