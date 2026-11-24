/**
 * 12.0 — **one card per impulse**.
 *
 * An impulse starts with exactly one card play: either the card is spent for CP
 * or it is played as its event (a mandatory event resolves first, then grants
 * its printed CP).  The impulse may then spend that CP; it may *not* open a
 * second card in the same impulse, whether the first was spent for CP or as an
 * event.
 *
 * The bug this pins: `playCard` only refused a second card while CP were still
 * banked (`G.cpRemaining > 0`).  Spending the last CP — including the 2 CP a
 * mandatory event grants — left the counter at 0, so the seat could play a
 * second card in the same impulse and effectively take two impulses in one.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {cpChain, declareWar, impulseAlreadyUsed, industrialize, placeMpit, playCard} from "./moves";
import {BISMARCK_HOME_CARD, spendCpFor, warDeclarationEntitlement} from "./engine/rules";
import {ieStringsFor} from "./components/i18n";
import {cardAvailability, type CardAvailabilityInput} from "./components/cardAvailability";

const makeCtx = (playerID: string | null = "0"): Ctx => ({
  playerID,
  random: {Die: () => 3},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "action",
}) as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));

/** A campaign state in GE's action impulse with an empty hand and no CP. */
const fresh = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  for (const power of POWERS) G.powers[power].hand = [];
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  delete G.powers.GE.flags.actionCpSpentThisImpulse;
  return G;
};

/** A4 The Funeral of Edward VII: mandatory, 2 CP, "decrease the WTT by 1". */
const MANDATORY_CARD = "IE-A104";
/** An ordinary 2 CP event card (no printed gate in the fresh setup). */
const ORDINARY_CARD = "IE-A029";

describe("12.0 one card opens an impulse", () => {
  test("a CP card cannot be followed by a second card once its CP are spent", () => {
    const G = fresh();
    G.powers.GE.hand = ["IE-A018", ORDINARY_CARD];

    expect(playCard(G, makeCtx("0"), "IE-A018", "cp")).toBeUndefined();
    expect(G.cpRemaining).toBeGreaterThan(0);
    // Spending the whole budget still leaves the impulse used: the flag
    // outlives the CP balance.
    while (G.cpRemaining > 0) expect(placeMpit(G, makeCtx("0"), "UK", "te")).toBeUndefined();
    expect(impulseAlreadyUsed(G, "GE")).toBe(true);

    expect(playCard(G, makeCtx("0"), ORDINARY_CARD, "cp")).toBe(INVALID_MOVE);
    expect(playCard(G, makeCtx("0"), ORDINARY_CARD, "event")).toBe(INVALID_MOVE);
    expect(G.powers.GE.hand).toContain(ORDINARY_CARD);
  });

  test("a mandatory event's CP are the impulse's, and cannot be followed by a second card", () => {
    const G = fresh();
    G.wtt = 3;
    G.powers.GE.hand = [MANDATORY_CARD, ORDINARY_CARD];

    expect(playCard(G, makeCtx("0"), MANDATORY_CARD, "event")).toBeUndefined();
    // The printed event resolved first and granted its 2 CP.
    expect(G.wtt).toBe(2);
    expect(G.cpRemaining).toBe(2);
    while (G.cpRemaining > 0) expect(placeMpit(G, makeCtx("0"), "UK", "te")).toBeUndefined();

    expect(playCard(G, makeCtx("0"), ORDINARY_CARD, "cp")).toBe(INVALID_MOVE);
    expect(playCard(G, makeCtx("0"), ORDINARY_CARD, "event")).toBe(INVALID_MOVE);
    // No boardgame.io undo either: the refused play did not touch the hand.
    expect(G.powers.GE.hand).toEqual([ORDINARY_CARD]);
  });

  test("the next impulse may open a fresh card", () => {
    const G = fresh();
    G.powers.GE.hand = [MANDATORY_CARD, ORDINARY_CARD];
    expect(playCard(G, makeCtx("0"), MANDATORY_CARD, "event")).toBeUndefined();
    while (G.cpRemaining > 0) expect(spendCpFor(G, "GE", 1)).toBe(true);

    // `finishImpulse` is what clears the flag: simulate the hand-over by
    // clearing it, exactly as the engine does when the impulse passes on.
    delete G.powers.GE.flags.actionCpSpentThisImpulse;
    G.cpRemaining = 0;
    expect(impulseAlreadyUsed(G, "GE")).toBe(false);
    expect(playCard(G, makeCtx("0"), ORDINARY_CARD, "cp")).toBeUndefined();
  });

  test("the hand's card data refuses the same second play the move refuses", () => {
    const G = fresh();
    G.powers.GE.hand = [MANDATORY_CARD, ORDINARY_CARD];
    const input = (cardId: string): CardAvailabilityInput => ({
      G, power: "GE", cardId, phase: "action", isActive: true, isBelligerent: false,
      war: null, canActionCard: true, saveList: [], forcedCardIds: [], industryCard: null,
      cpChainLength: 0, homeCards: [G.powers.GE.homeCards[0]],
      playBlock: {}, responseBlock: {}, bi: (_en: string, _zh: string) => _en,
    });
    expect(cardAvailability(input(ORDINARY_CARD)).cpModeOk).toBe(true);

    expect(playCard(G, makeCtx("0"), MANDATORY_CARD, "event")).toBeUndefined();
    while (G.cpRemaining > 0) expect(placeMpit(G, makeCtx("0"), "UK", "te")).toBeUndefined();

    const after = cardAvailability(input(ORDINARY_CARD));
    expect(after.cpModeOk).toBe(false);
    expect(after.eventModeOk).toBe(false);
    expect(after.reasons).toContain("One card per impulse; finish this impulse first");
  });
});

describe("12.0 the industry slot and the CP chain are the impulse's card too", () => {
  // The report: "帝国挽歌 事件俾斯麦之后不应该还能在同一行动轮打出其他牌".  Bismarck's
  // event keeps the impulse open so the seat can declare the war the card
  // grants; the tray stayed live and offered the *other* cards in hand as the
  // industry card (12.13) or a CP-chain card (12.14).  Both are "1 Card" — the
  // impulse's own card play — so a used impulse must refuse them, and refusing
  // them keeps the open declaration instead of losing it to `finishImpulse`.
  const input = (G: ImperialElegyState, cardId: string, industryCard: string | null, cpChainLength: number): CardAvailabilityInput => ({
    G, power: "GE", cardId, phase: "action", isActive: true, isBelligerent: false,
    war: null, canActionCard: true, saveList: [], forcedCardIds: [], industryCard,
    cpChainLength, homeCards: [G.powers.GE.homeCards[0]],
    playBlock: {}, responseBlock: {}, bi: (_en: string, _zh: string) => _en,
  });

  test("a second card cannot be chained or industrialized after a CP card", () => {
    const G = fresh();
    G.powers.GE.hand = ["IE-A018", ORDINARY_CARD];
    expect(playCard(G, makeCtx("0"), "IE-A018", "cp")).toBeUndefined();

    expect(cpChain(G, makeCtx("0"), ORDINARY_CARD)).toBe(INVALID_MOVE);
    expect(industrialize(G, makeCtx("0"), ORDINARY_CARD)).toBe(INVALID_MOVE);
    expect(G.powers.GE.cpChain).toEqual([]);
    expect(G.powers.GE.industryCard).toBeNull();
    expect(G.powers.GE.hand).toContain(ORDINARY_CARD);

    const blocked = cardAvailability(input(G, ORDINARY_CARD, null, 0));
    expect(blocked.chainOk).toBe(false);
    expect(blocked.industOk).toBe(false);
    expect(blocked.reasons).toContain("One card per impulse; finish this impulse first");
  });

  test("after Bismarck's event the declaration survives and no other card can be placed", () => {
    const G = fresh();
    G.turn = 5;
    G.powers.GE.hand = [BISMARCK_HOME_CARD, ORDINARY_CARD];
    G.powers.GE.selectedHomeCard = BISMARCK_HOME_CARD;
    expect(playCard(G, makeCtx("0"), BISMARCK_HOME_CARD, "event")).toBeUndefined();
    expect(warDeclarationEntitlement(G, "GE")).not.toBeNull();

    expect(industrialize(G, makeCtx("0"), ORDINARY_CARD)).toBe(INVALID_MOVE);
    expect(cpChain(G, makeCtx("0"), ORDINARY_CARD)).toBe(INVALID_MOVE);
    // Nothing moved and the impulse still belongs to GE with its declaration.
    expect(G.powers.GE.hand).toEqual([ORDINARY_CARD]);
    expect(G.powers.GE.industryCard).toBeNull();
    expect(G.powers.GE.cpChain).toEqual([]);
    expect(G.activePower).toBe("GE");
    expect(warDeclarationEntitlement(G, "GE")).toEqual({card: BISMARCK_HOME_CARD, cp: 3, aim: "unification"});
    // The printed declaration is still launchable in this impulse.
    expect(declareWar(G, makeCtx("0"), "FR", "unification", ["alsace-lorraine"], 3)).toBeUndefined();
    expect(G.war).not.toBeNull();
  });

  test("a fresh impulse offers both again", () => {
    const G = fresh();
    G.powers.GE.hand = [ORDINARY_CARD];
    const open = cardAvailability(input(G, ORDINARY_CARD, null, 0));
    expect(open.chainOk).toBe(true);
    expect(open.industOk).toBe(true);
    // Accepted: the card leaves the hand for the chain (the impulse then hands
    // over, and an action phase with nothing left to play discards the chain).
    expect(cpChain(G, makeCtx("0"), ORDINARY_CARD)).toBeUndefined();
    expect(G.powers.GE.hand).not.toContain(ORDINARY_CARD);
  });
});

describe("12.0 the event button says what the card is", () => {
  test("the bilingual labels name a mandatory event, not a plain event", () => {
    // The hand tray draws `t.eventMode` for ordinary cards and a printed-type
    // label for mandatory ones; both locales must carry the distinction so the
    // button never reads "打出事件" for a card the rules call 强制事件.
    const zh = ieStringsFor("zh_CN");
    const en = ieStringsFor("en");
    expect(zh.eventMode).toBe("打出事件");
    expect(zh.cardType.mandatory).toBe("强制");
    expect(zh.cardType.mandatoryResponse).toBe("强制响应");
    expect(en.cardType.mandatory).toBe("Mandatory");
    expect(en.eventMode).toBe("Play event");
    // Guard the exact wording the tray renders (HandTray's `eventLabel`).
    expect("打出强制事件").toContain(zh.cardType.mandatory);
  });
});
