/**
 * Card playability, as data.
 *
 * The hand's face, the tray buttons and the inspector all need the same
 * answer — may this card be played for CP / its event / as a response, may it
 * industrialize, chain or be saved, and why not — so it is computed once, here,
 * with no React in sight.  The tray renders it; the tests pin it.
 */
import type {ImperialElegyState, Power} from "../types";
import {cardById} from "../engine/deck";
import {eventPlayability} from "../engine/playability";
import {impulseAlreadyUsed, responseCardEligibility} from "../moves";

export interface CardAvailability {
  cpAllowed: boolean;
  cpModeOk: boolean;
  eventAllowed: boolean;
  eventModeOk: boolean;
  eventBlockReason: string | undefined;
  eventBlockKey: string | undefined;
  responseOk: boolean;
  showResponse: boolean;
  industOk: boolean;
  chainOk: boolean;
  saveOk: boolean;
  saved: boolean;
  homeOk: boolean;
  isMandatory: boolean;
  /** Every reason a mode is unavailable, de-duplicated, in printed order. */
  reasons: string[];
  /** The first reason, for the face's one-line "why not". */
  firstReason: string | undefined;
}

export interface CardAvailabilityInput {
  G: ImperialElegyState;
  power: Power;
  cardId: string;
  phase: string;
  isActive: boolean;
  isBelligerent: boolean;
  war: ImperialElegyState["war"];
  canActionCard: boolean;
  saveList: string[];
  /**
   * The printed no-pass cards in hand (A047 / GW-10).  The tray uses them to
   * unfold their row; they grant **no** extra card play, because 12.0's
   * one-card-per-impulse rule still applies and a used impulse can be handed
   * over instead.
   */
  forcedCardIds: string[];
  industryCard: string | null;
  cpChainLength: number;
  homeCards: string[];
  /** Localized text for the engine's playability keys. */
  playBlock: Record<string, string>;
  /** Localized text for the seat/window reasons a response card can have. */
  responseBlock: Record<string, string>;
  bi: (en: string, zh: string) => string;
}

export const cardAvailability = (input: CardAvailabilityInput): CardAvailability => {
  const {
    G, power, cardId, phase, isActive, isBelligerent, war, canActionCard, saveList,
    industryCard, cpChainLength, homeCards, playBlock, responseBlock, bi,
  } = input;
  const card = cardById(cardId);
  const isMandatory = card.type === "mandatory" || card.type === "mandatoryResponse";
  const saved = saveList.includes(cardId);
  const cpAllowed = !isMandatory && card.type !== "response" && card.type !== "combat";
  const eventAllowed = (card.type !== "response" && card.type !== "combat") || card.id === "IE-A041";
  // 6.1/12.0: a home card is playable while it is **in hand**, which is the only
  // way the tray can list it.  That is normally just the card chosen in
  // Diplomacy, but A040 British Trade adds the other one to hand, so hand
  // membership — not the Diplomacy selection — decides play.  The selection
  // still decides 12.13's industrialization slot.
  const homeIndustryOk = card.kind !== "home" || homeCards.includes(cardId);
  // 12.0: a card opens an impulse.  Once that impulse's card has been played
  // (or its CP have been spent, even down to zero) the next card waits for a
  // fresh impulse, so both the CP and the event mode are shut — not merely the
  // CP mode, which is what let a spent impulse play a second card.  The board's
  // `forcedCardIds` (the printed no-pass cards) deliberately grants no
  // exception: a used impulse may be handed over, so the card never needs a
  // second slot in the same impulse.
  const impulseUsed = impulseAlreadyUsed(G, power);
  const cpModeOk = canActionCard && cpAllowed && !impulseUsed;
  const eventGate = eventAllowed ? eventPlayability(G, power, cardId) : null;
  const eventBlockKey = eventGate !== null && !eventGate.ok ? eventGate.reason : undefined;
  const eventBlockReason = eventBlockKey !== undefined ? playBlock[eventBlockKey] : undefined;
  const eventModeOk = canActionCard && eventAllowed && !impulseUsed && (eventGate === null || eventGate.ok);
  const responseEligible = card.type === "response" ? responseCardEligibility(G, power, cardId) : null;
  const responseOk = responseEligible?.ok === true;
  const showResponse = card.type === "response" && (
    phase === "action" ? isActive
      : phase === "wartime" ? isBelligerent && (isActive || war?.status === "alliance")
        : phase === "gwManeuver" ? isActive
          : false
  );
  // 12.13: the selected home card is a legal industrialization card too.
  // Unselected home cards never reach the hand except through A040 British
  // Trade, which grants the card for play, not for industrialization.
  const industOk = canActionCard && industryCard === null && homeIndustryOk && !isMandatory;
  const chainOk = canActionCard && cpChainLength < 2;
  const saveOk = (phase === "action" || phase === "end") && card.kind !== "home" && !isMandatory;

  // A response card is gated by its printed text first (the right seat, or
  // "no effect during the Great War"), then by whether a window is open; both
  // belong in the title, the card's own reason first.
  const responseReason = responseEligible !== null && !responseEligible.ok && responseEligible.reason !== undefined
    ? responseBlock[responseEligible.reason]
    : undefined;
  const responseWindowReason = responseEligible?.window !== undefined
    ? responseBlock[responseEligible.window]
    : undefined;
  const noWindowReason = card.type === "response" && !responseOk && responseReason === undefined
    ? bi("No response window now", "当前没有响应窗口")
    : undefined;
  // The card's own gates come before the generic card-type lines: "cannot be
  // played for CP" describes the type, not why this card is unusable now.
  const ownReasons: string[] = (card.type === "response"
    ? [responseReason, responseWindowReason ?? noWindowReason]
    : [eventBlockReason]).filter((reason): reason is string => reason !== undefined);
  const reasons: string[] = [];
  // 12.0: the impulse's card play comes before its CP are spent.  Two wordings
  // keep the familiar reason while CP are still banked and name the printed
  // one-card rule once the budget is gone and the impulse is only being closed.
  const oneCardReason = bi("One card per impulse; finish this impulse first", "每次行动轮只能打出 1 张牌；请先结束本次行动");
  if (!cpModeOk) {
    if (!cpAllowed) reasons.push(bi("Cannot be played for CP (mandatory/response/combat card)", "不能作为 CP 打出（强制/响应/战斗牌）"));
    else if (!canActionCard) reasons.push(bi("Only during your Action-phase impulse", "仅限你的行动阶段行动轮"));
    else if (impulseUsed) reasons.push(G.cpRemaining > 0 ? bi("Finish the current impulse first", "请先结束本次行动") : oneCardReason);
  }
  if (!eventModeOk) {
    if (!eventAllowed) reasons.push(bi("This card has no printed event", "此牌没有可打出的事件"));
    else if (eventBlockReason !== undefined) reasons.push(eventBlockReason);
    else if (!canActionCard) reasons.push(bi("Events are played at the start of an Action impulse", "事件需在行动轮开始时打出"));
    else if (impulseUsed) reasons.push(G.cpRemaining > 0 ? bi("Events are played before spending CP", "事件需在花费 CP 前打出") : oneCardReason);
  }
  if (!industOk && !isMandatory) {
    reasons.push(card.kind === "home" && !homeIndustryOk
      ? bi("Set it as your home card during Diplomacy first", "需先在外交阶段选为本国牌")
      : industryCard !== null
        ? bi("A card is already industrializing", "已有牌在工业化")
        : bi("Industrialize only during your Action impulse", "工业化仅限你的行动阶段行动轮"));
  }
  if (!chainOk && cpChainLength >= 2) reasons.push(bi("CP chain is full", "CP 链已满"));
  if (!saveOk) reasons.push(bi("Save only in the Action or End phase", "仅可在行动或结束阶段保留"));
  const unique = [...new Set([...ownReasons, ...reasons])];
  return {
    cpAllowed, cpModeOk, eventAllowed, eventModeOk, eventBlockReason, eventBlockKey,
    responseOk, showResponse, industOk, chainOk, saveOk, saved, homeOk: homeIndustryOk, isMandatory,
    reasons: unique,
    firstReason: unique[0],
  };
};

/** Card-type icon keys, following the printed key on the cards and charts. */
export type CardTypeIcon = "event" | "response" | "combat" | "mandatory" | "mandatoryResponse" | "home" | "greatWar";

export const cardTypeIcon = (kind: string, type: string): CardTypeIcon => {
  if (kind === "home") return "home";
  if (kind === "greatWar") return "greatWar";
  return (type as CardTypeIcon) ?? "event";
};

// ---------------------------------------------------------------------------
// Tray ordering
// ---------------------------------------------------------------------------

export type CardFilter = "all" | "playable" | "event" | "response" | "combat" | "mandatory";
export type CardSort = "printed" | "cp" | "type" | "decade";

export interface SortCardsInput {
  filter: CardFilter;
  sort: CardSort;
  availability: (id: string) => CardAvailability;
  viewer: Power | null;
}

const DECADE_ORDER: Record<string, number> = {
  "1850s": 1, "1860s": 2, "1870s": 3, "1880s": 4, "1890s": 5, "1900s": 6, "1910s": 7,
};
const TYPE_ORDER: Record<string, number> = {mandatoryResponse: 0, mandatory: 1, combat: 2, response: 3, event: 4};

/**
 * The tray's visible, ordered card ids.  Filtering never hides a card the
 * rules require right now (a mandatory event): a filter is a view, and the
 * "Required card choice" box already pins those.
 */
export const sortCards = (hand: readonly string[], input: SortCardsInput): string[] => {
  const withCards = hand.map((id, index) => ({id, index, card: cardById(id), a: input.availability(id)}));
  const visible = withCards.filter(({card, a}) => {
    switch (input.filter) {
      case "all": return true;
      case "playable": return a.cpModeOk || a.eventModeOk || a.responseOk || a.isMandatory;
      case "event": return card.type === "event" || card.type === "mandatory";
      case "response": return card.type === "response" || card.type === "mandatoryResponse";
      case "combat": return card.type === "combat";
      case "mandatory": return a.isMandatory;
      default: return true;
    }
  });
  const sorted = [...visible];
  switch (input.sort) {
    case "printed":
      break;
    case "cp":
      sorted.sort((x, y) => y.card.cp - x.card.cp || x.index - y.index);
      break;
    case "type":
      sorted.sort((x, y) => (TYPE_ORDER[x.card.type] ?? 9) - (TYPE_ORDER[y.card.type] ?? 9) || x.index - y.index);
      break;
    case "decade":
      sorted.sort((x, y) => (DECADE_ORDER[x.card.entry] ?? 9) - (DECADE_ORDER[y.card.entry] ?? 9) || x.index - y.index);
      break;
    default:
      break;
  }
  return sorted.map((entry) => entry.id);
};

/** The printed card-type key: one glyph per type, as on the cards and charts. */
export const CARD_TYPE_GLYPH: Record<CardTypeIcon, string> = {
  event: "◆",
  response: "↺",
  combat: "⚔",
  mandatory: "■",
  mandatoryResponse: "◩",
  home: "⌂",
  greatWar: "✶",
};
