/**
 * Rules 11.0 / 11.1 — the diplomacy phase's negotiation table.
 *
 * 11.0 says most deals are non-binding talk: players may show each other their
 * action cards "to encourage cooperation or to back up a threat", and nothing
 * about a conversation changes the board.  11.1 is the one binding clause:
 *
 *   "Players can give other players a number of cards in the diplomacy phase.
 *    This must be a formal agreement between both players and it is done at the
 *    end of the diplomacy phase.  Players cannot give other players specific
 *    cards, all card draws must be random and home cards can never be drawn
 *    from a player's hand.  Once all negotiations have been concluded players
 *    announce the card draws they will be giving and/or receiving in turn order.
 *    An announced card draw must be confirmed by the other player in order for
 *    it to take place.  The random card draw is done in full view of all
 *    players."
 *
 * So this module keeps three things apart:
 *
 *  - `shown` — a card one power showed the table (11.0).  Read through
 *    `playerView`, never a rule effect.
 *  - `offers` — proposals, counters and refusals.  Both sides may only name a
 *    *count*, never a card, so the draw stays random.  Nothing moves here.
 *  - `history` — the settlements.  `settleDeals` runs once, when the diplomacy
 *    phase closes, in printed seat order, and draws every card from
 *    `ctx.random`.  The drawn cards are public.
 *
 * The module is pure: it never touches React, so the moves, the board and the
 * tests all read the same predicates.
 */

import type {Ctx} from "boardgame.io";
import {CardId, DealOffer, DealPromise, DealSettlement, DiplomacyDeals, ImperialElegyState, Power, POWERS} from "../types";
import {cardById} from "./deck";
import {log, randomIndex} from "./rules";

/** 11.1 prints no ceiling; a deal is limited by the hand that must pay it. */
export const MAX_PROMISES = 3;
/** A promise is table talk, not a rules object; keep it to one readable line. */
export const MAX_PROMISE_LENGTH = 120;

/** The documented empty table, for saves and fixtures that predate it. */
const EMPTY: DiplomacyDeals = {offers: [], history: [], shown: [], nextId: 1};

/**
 * The negotiation table, creating the record on first use.  A legacy save or a
 * hand-written test state reads as an empty table instead of throwing.
 */
export const negotiationOf = (G: ImperialElegyState): DiplomacyDeals => {
  if (G.negotiation === undefined || G.negotiation === null) G.negotiation = {...EMPTY, offers: [], history: [], shown: []};
  const deals = G.negotiation;
  deals.offers ??= [];
  deals.history ??= [];
  deals.shown ??= [];
  if (!Number.isFinite(deals.nextId) || deals.nextId < 1) deals.nextId = 1;
  return deals;
};

/** Read-only view of the table (never writes, so `playerView` may call it). */
export const dealsOf = (G: ImperialElegyState): DiplomacyDeals => G.negotiation ?? EMPTY;

/**
 * The cards a power may put into a deal: 11.1 draws from the hand and "home
 * cards can never be drawn from a player's hand".
 */
export const dealableCards = (G: ImperialElegyState, power: Power): CardId[] =>
  (G.powers[power]?.hand ?? []).filter((id) => cardById(id).kind !== "home");

// ---------------------------------------------------------------------------
// Validation — shared by the moves and the panel, so a row is never offered for
// a deal the engine would refuse.
// ---------------------------------------------------------------------------

export type DealProblem =
  | "not-diplomacy"
  | "same-power"
  | "no-target"
  | "eliminated"
  | "nothing-moved"
  | "too-many-cards";

/** Rules 11.0/11.1 — why `from` may not open a deal with `to` right now. */
export const dealProblem = (
  G: ImperialElegyState,
  from: Power,
  to: Power,
  give: number,
  take: number,
): DealProblem | null => {
  if (G.phase !== "diplomacy") return "not-diplomacy";
  if (!(POWERS as readonly string[]).includes(to)) return "no-target";
  if (from === to) return "same-power";
  if (G.powers[to]?.eliminated === true) return "eliminated";
  if (!Number.isInteger(give) || !Number.isInteger(take) || give < 0 || take < 0) return "nothing-moved";
  if (give + take < 1) return "nothing-moved";
  // Each side can only promise cards it holds; 11.1 draws from the hand.
  if (give > dealableCards(G, from).length) return "too-many-cards";
  if (take > dealableCards(G, to).length) return "too-many-cards";
  return null;
};

/** Normalise a client-supplied promise list: bounded in count and length. */
export const readPromises = (value: unknown, from: Power): DealPromise[] =>
  Array.isArray(value)
    ? value.slice(0, MAX_PROMISES).map((entry) => ({
      from,
      text: String((entry as {text?: unknown})?.text ?? "").slice(0, MAX_PROMISE_LENGTH).trim(),
    })).filter((promise) => promise.text.length > 0)
    : [];

/** The offer the given power must answer or withdraw, if any. */
export const offerFor = (deals: DiplomacyDeals, power: Power): DealOffer | undefined =>
  deals.offers.find((offer) =>
    offer.status === "proposed" && (offer.from === power || offer.to === power));

/** Deals still waiting on a signature (any side). */
export const openOffers = (deals: DiplomacyDeals): DealOffer[] =>
  deals.offers.filter((offer) => offer.status === "proposed" || offer.status === "accepted");

// ---------------------------------------------------------------------------
// Settlement — 11.1 "it is done at the end of the diplomacy phase"
// ---------------------------------------------------------------------------

/**
 * Draw `count` cards at random from `giver`'s hand into `taker`'s hand.
 *
 * `ctx.random` owns the draw (11.1: "all card draws must be random"), and the
 * caller passes no card ids at all.  Home cards are never drawn.  A hand that
 * ran short moves what it still has, which the caller reports as a shortfall.
 */
const drawRandomCards = (G: ImperialElegyState, ctx: Ctx, giver: Power, taker: Power, count: number): CardId[] => {
  const drawn: CardId[] = [];
  for (let i = 0; i < count; i++) {
    const pool = dealableCards(G, giver);
    if (pool.length === 0) break;
    const card = pool[randomIndex(ctx, pool.length)];
    G.powers[giver].hand = G.powers[giver].hand.filter((id) => id !== card);
    G.powers[taker].hand.push(card);
    drawn.push(card);
    log(G, giver, "dealCardDrawn", {card, from: giver, to: taker});
  }
  return drawn;
};

/**
 * Close the table: settle every accepted deal in printed seat order (11.1:
 * "players announce the card draws … in turn order"), then drop the round's
 * proposals.  Returns the settlements, which the caller logs and the panel can
 * read straight back.
 *
 * Idempotent through `settledTurn`: re-entering the action phase from a second
 * path must never draw the same cards twice.
 */
export const settleDeals = (G: ImperialElegyState, ctx: Ctx): DealSettlement[] => {
  const deals = G.negotiation;
  if (deals === undefined || deals === null) return [];
  if (deals.settledTurn === G.turn) return [];
  deals.settledTurn = G.turn;

  const accepted = (deals.offers ?? [])
    .filter((offer) => offer.status === "accepted")
    .sort((a, b) => POWERS.indexOf(a.from) - POWERS.indexOf(b.from) || a.seq - b.seq);

  const settled: DealSettlement[] = [];
  for (const offer of accepted) {
    const given = drawRandomCards(G, ctx, offer.from, offer.to, offer.give);
    const taken = drawRandomCards(G, ctx, offer.to, offer.from, offer.take);
    const shortfall = given.length < offer.give || taken.length < offer.take;
    const record: DealSettlement = {
      id: offer.id,
      turn: G.turn,
      from: offer.from,
      to: offer.to,
      given,
      taken,
      shortfall,
    };
    (deals.history ??= []).push(record);
    settled.push(record);
    log(G, offer.from, "dealSettled", {
      id: offer.id,
      to: offer.to,
      given: given.length,
      taken: taken.length,
      promisedGiven: offer.give,
      promisedTaken: offer.take,
    });
    if (shortfall) log(G, offer.from, "dealShortfall", {id: offer.id, to: offer.to});
    // The settled offer leaves the table here; `expireOffers` then reports the
    // proposals that were never confirmed.
    deals.offers = (deals.offers ?? []).filter((entry) => entry.id !== offer.id);
  }
  return settled;
};

/**
 * Close the table: drop the round's proposals that were never confirmed and
 * take the faceup cards back down (11.0's show lasts for the diplomacy phase
 * that showed it).
 *
 * It runs at the phase's close and again as the next phase opens, so a resumed
 * save can never start a turn with last turn's offers or faceup cards.  Returns
 * how many offers lapsed, so the caller can log one line instead of one per
 * offer.
 */
export const expireOffers = (G: ImperialElegyState): number => {
  const deals = G.negotiation;
  if (deals === undefined || deals === null) return 0;
  deals.shown = [];
  const lapsed = (deals.offers ?? []).filter((offer) =>
    offer.status === "proposed" || offer.status === "countered").length;
  if (lapsed > 0) log(G, undefined, "dealsExpired", {count: lapsed});
  deals.offers = [];
  return lapsed;
};

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** The seat order 11.1 announces in. */
export const inTurnOrder = (offers: readonly DealOffer[]): DealOffer[] =>
  [...offers].sort((a, b) => POWERS.indexOf(a.from) - POWERS.indexOf(b.from) || a.seq - b.seq);

/**
 * One deal as a sentence, in the reader's language.
 *
 * "France gives 2 random cards to Russia." / "法国向俄国随机转交 2 张牌。"
 */
export const dealTermsText = (
  offer: Pick<DealOffer, "from" | "to" | "give" | "take">,
  locale: "en" | "zh_CN",
  powerName: (power: Power) => string,
): string => {
  const from = powerName(offer.from);
  const to = powerName(offer.to);
  if (locale === "zh_CN") {
    const parts: string[] = [];
    if (offer.give > 0) parts.push(`${from}向${to}随机转交 ${offer.give} 张牌`);
    if (offer.take > 0) parts.push(`${to}向${from}随机转交 ${offer.take} 张牌`);
    return parts.join("；") + "。";
  }
  const parts: string[] = [];
  if (offer.give > 0) parts.push(`${from} gives ${offer.give} random card${offer.give === 1 ? "" : "s"} to ${to}`);
  if (offer.take > 0) parts.push(`${to} gives ${offer.take} random card${offer.take === 1 ? "" : "s"} to ${from}`);
  return parts.join("; ") + ".";
};

/**
 * What a card shown by `from` to `to` (or to the table) means for `viewer`:
 * the table sees public shows, the two parties see their own private ones, and
 * nobody else sees anything.  11.0 lets the table watch; it does not let a
 * third power read a private show.
 */
export const shownCardsFor = (G: ImperialElegyState, viewer: Power | null): CardId[] => {
  if (viewer === null) return dealsOf(G).shown.filter((entry) => entry.to === null).map((entry) => entry.card);
  return dealsOf(G).shown
    .filter((entry) => entry.to === null || entry.to === viewer || entry.from === viewer)
    .map((entry) => entry.card);
};

export default negotiationOf;
