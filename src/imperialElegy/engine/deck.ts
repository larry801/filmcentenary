import {Ctx} from "boardgame.io";
import {CardId, ImperialElegyState, Power, POWERS} from "../types";
import {CARDS} from "../constant/cards.data";
import {CardDef, Decade} from "../constant/cards";
import {die, log, POWER_ORDER} from "./rules";
import {cardDrawModifier} from "./characteristics";

/**
 * The campaign turn -> printed card band mapping lives in `engine/economy.ts`.
 * Re-exporting it keeps a single source of truth (rules 10.1/10.2); the
 * module cycle is safe because economy only calls these bindings lazily from
 * functions.
 */
export {decadeForTurn} from "./economy";

export const ALL_CARDS: CardDef[] = [...CARDS.actions, ...CARDS.home, ...CARDS.greatWar];

export const CARD_BY_ID: Record<CardId, CardDef> = Object.fromEntries(ALL_CARDS.map((c) => [c.id, c]));

export const cardById = (id: CardId): CardDef => {
  const card = CARD_BY_ID[id];
  if (!card) throw new Error(`unknown card ${id}`);
  return card;
};

export const isCardId = (id: unknown): id is CardId => typeof id === "string" && id in CARD_BY_ID;

export const cardsForDecade = (decade: Decade): CardId[] =>
  CARDS.actions.filter((c) => c.entry === decade).map((c) => c.id);

export const decadeLabel = (decade: Decade): {en: string; zh: string} => {
  switch (decade) {
    case "1850s": return {en: "1850s", zh: "1850 年代"};
    case "1860s": return {en: "1860s", zh: "1860 年代"};
    case "1870s": return {en: "1870s", zh: "1870 年代"};
    case "1880s": return {en: "1880s", zh: "1880 年代"};
    case "1890s": return {en: "1890s", zh: "1890 年代"};
    case "1900s": return {en: "1900s", zh: "1900 年代"};
    case "1910s": return {en: "1910s", zh: "1910 年代"};
  }
};

export const shuffle = <T>(ctx: Ctx, values: T[]): T[] => {
  const array = [...values];
  // boardgame.io's random is seeded by the match and is server-authoritative.
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = die(ctx, i + 1) - 1;
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

/**
 * Add the current decade's cards, then reshuffle the discard into the deck.
 *
 * `entering` should come from `beginTurnDecade(G, turn).entering`, which knows
 * about every zone a card can already be in (hand, home slot, CP chain,
 * industry slot, deck, discard, removed).  Callers that still pass only a
 * decade get the old deck/discard/removed-only fallback; production prep uses
 * the explicit list, so a saved card can never be duplicated when a later
 * decade enters (including the empty 1860s/1910s label bands).
 */
export const prepareDeck = (
  G: ImperialElegyState,
  ctx: Ctx,
  decade: Decade,
  entering?: readonly CardId[],
): void => {
  const cards = entering === undefined
    ? cardsForDecade(decade).filter((id) => !G.deck.includes(id) && !G.removed.includes(id) && !G.discard.includes(id))
    : [...new Set(entering)];
  G.deck.push(...cards);
  G.deck.push(...G.discard);
  G.discard = [];
  G.deck = shuffle(ctx, G.deck);
  log(G, undefined, "deckPrepared", {decade, entering: cards.length, deck: G.deck.length});
};

export const drawOne = (G: ImperialElegyState, ctx: Ctx): CardId | null => {
  // IE-A061 Ironclads has a draw-time special: once Dreadnoughts has been
  // played the card is removed from the game and another card is drawn.
  // Resolve it here so every draw path (prep deal, event draws, end-of-battle
  // draws, replacements) honours the printed clause.
  for (let guard = 0; guard < 512; guard += 1) {
    if (G.deck.length === 0) {
      if (G.discard.length === 0) return null;
      G.deck = shuffle(ctx, G.discard);
      G.discard = [];
      log(G, undefined, "deckReshuffled", {deck: G.deck.length});
    }
    const card = G.deck.pop() ?? null;
    if (card === null) return null;
    if (card === "IE-A061" && G.persistent.dreadnoughts === true) {
      if (!G.removed.includes(card)) G.removed.push(card);
      log(G, undefined, "cardRemoved", {card, reason: "dreadnoughts"});
      continue;
    }
    return card;
  }
  return null;
};

export const drawCards = (G: ImperialElegyState, ctx: Ctx, power: Power, count: number): CardId[] => {
  const drawn: CardId[] = [];
  const p = G.powers[power];
  for (let i = 0; i < count; i += 1) {
    const card = drawOne(G, ctx);
    if (card === null) break;
    p.hand.push(card);
    drawn.push(card);
  }
  log(G, power, "cardsDrawn", {count: drawn.length});
  return drawn;
};

export const discardCard = (G: ImperialElegyState, power: Power, card: CardId, reason = "discard"): void => {
  const p = G.powers[power];
  p.hand = p.hand.filter((c) => c !== card);
  p.cpChain = p.cpChain.filter((c) => c !== card);
  if (p.industryCard === card) {
    p.industryCard = null;
  }
  const def = cardById(card);
  if (def.remove) {
    G.removed.push(card);
    log(G, power, "cardRemoved", {card});
    return;
  }
  if (def.kind === "home") {
    // Home cards always return to their owner; they are never shuffled into
    // the action deck.
    log(G, power, reason, {card});
    return;
  }
  G.discard.push(card);
  log(G, power, reason, {card});
};

export const removeCard = (G: ImperialElegyState, card: CardId): void => {
  G.deck = G.deck.filter((c) => c !== card);
  G.discard = G.discard.filter((c) => c !== card);
  for (const p of POWERS) {
    G.powers[p].hand = G.powers[p].hand.filter((c) => c !== card);
    G.powers[p].homeCards = G.powers[p].homeCards.filter((c) => c !== card);
    G.powers[p].cpChain = G.powers[p].cpChain.filter((c) => c !== card);
  }
  if (!G.removed.includes(card)) G.removed.push(card);
  log(G, undefined, "cardRemoved", {card});
};

/** All cards go to discard at the end of a turn except home cards and saved cards. */
export const discardHandAtEndOfTurn = (G: ImperialElegyState, power: Power): void => {
  const p = G.powers[power];
  const saved = new Set<CardId>();
  const keep = cardDrawModifier(G, power).banking.saveLimit;
  // The player may keep up to `keep` non-home, non-mandatory cards (12.0).
  // The boardgame.io client chooses them with `saveCard`; anything marked is
  // in flags.savedCards.
  const savedCards = String(p.flags.savedCards ?? "").split(",").filter(Boolean);
  for (const card of savedCards.slice(0, keep)) {
    if (p.hand.includes(card) && cardById(card).kind !== "home" && cardById(card).type !== "mandatory") saved.add(card);
  }
  const homeCard = p.selectedHomeCard;
  for (const card of [...p.hand]) {
    if (card === homeCard) {
      p.hand = p.hand.filter((c) => c !== card);
      continue;
    }
    if (saved.has(card)) continue;
    discardCard(G, power, card, "endOfTurnDiscard");
  }
  p.flags.savedCards = "";
  if (homeCard) {
    p.hand = p.hand.filter((c) => c !== homeCard);
    p.selectedHomeCard = null;
  }
};

export const handWithoutSpecials = (G: ImperialElegyState, power: Power): CardId[] => {
  const p = G.powers[power];
  return p.hand.filter((id) => {
    const card = cardById(id);
    return card.kind !== "home" && card.type !== "mandatory" && card.type !== "mandatoryResponse";
  });
};

export const mandatoryCardsInHand = (G: ImperialElegyState, power: Power): CardId[] =>
  G.powers[power].hand.filter((id) => {
    const card = cardById(id);
    return card.type === "mandatory" || card.type === "mandatoryResponse";
  });

export const homeCardFor = (G: ImperialElegyState, power: Power, id: CardId): boolean =>
  G.powers[power].homeCards.includes(id);

export const powerOrder = (a: Power, b: Power): number => POWER_ORDER[a] - POWER_ORDER[b];

export const sortByTurnOrder = (powers: Power[]): Power[] => [...powers].sort(powerOrder);

/** Remaining cards in hand that can be played. */
export const playableCards = (G: ImperialElegyState, power: Power): CardId[] => {
  const p = G.powers[power];
  return p.hand.filter((id) => cardById(id).type !== "response" && cardById(id).type !== "combat" && cardById(id).type !== "mandatoryResponse");
};

export const cardImage = (id: CardId): string | undefined => cardById(id).image;
