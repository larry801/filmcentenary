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
import {cpPlayability, eventPlayability} from "../engine/playability";
import {responseCardEligibility} from "../moves";

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
    forcedCardIds, industryCard, cpChainLength, homeCards, playBlock, responseBlock, bi,
  } = input;
  const card = cardById(cardId);
  const isMandatory = card.type === "mandatory" || card.type === "mandatoryResponse";
  const saved = saveList.includes(cardId);
  const eventAllowed = (card.type !== "response" && card.type !== "combat") || card.id === "IE-A041";
  const eventGate = eventAllowed ? eventPlayability(G, power, cardId) : null;
  const eventBlockKey = eventGate !== null && !eventGate.ok ? eventGate.reason : undefined;
  const eventBlockReason = eventBlockKey !== undefined ? playBlock[eventBlockKey] : undefined;
  // 12.0: every card may be spent for CP, response and combat cards included.
  // Only a card's own printed CP clause can refuse it (A105's hand-size gate),
  // so the type is never the reason.  A mandatory event played for CP *is* its
  // event, so it also answers to that event's own printed gate — the same pair
  // of checks `playCard` makes.
  const cpGate = cpPlayability(G, power, cardId);
  const cpAllowed = cpGate.ok && (card.type !== "mandatory" || eventBlockKey === undefined);
  const cpBlockKey = cpGate.ok ? eventBlockKey : cpGate.reason;
  const cpBlockReason = cpBlockKey !== undefined ? playBlock[cpBlockKey] : undefined;
  const homeOk = card.kind !== "home" || homeCards.includes(cardId);
  const rescueOk = forcedCardIds.includes(cardId) && cpAllowed;
  const cpModeOk = canActionCard && cpAllowed && (G.cpRemaining === 0 || rescueOk) && homeOk;
  const eventModeOk = canActionCard && eventAllowed && G.cpRemaining === 0 && (eventGate === null || eventGate.ok);
  const responseEligible = card.type === "response" ? responseCardEligibility(G, power, cardId) : null;
  const responseOk = responseEligible?.ok === true;
  const showResponse = card.type === "response" && (
    phase === "action" ? isActive
      : phase === "wartime" ? isBelligerent && (isActive || war?.status === "alliance")
        : phase === "gwManeuver" ? isActive
          : false
  );
  // 12.13: the selected home card is a legal industrialization card too.  Unselected
  // home cards never reach the hand, so `homeOk` keeps them out here as well.
  const industOk = canActionCard && industryCard === null && homeOk && !isMandatory;
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
  // The card's own gates come before the generic lines: "cannot be played for
  // CP" describes the card, not why it is unusable at this moment.
  const ownReasons: string[] = (card.type === "response"
    ? [responseReason, responseWindowReason ?? noWindowReason]
    : [cpBlockReason, eventBlockReason]).filter((reason): reason is string => reason !== undefined);
  const reasons: string[] = [];
  if (!cpModeOk) {
    if (!cpAllowed) reasons.push(cpBlockReason ?? bi("Cannot be played for CP", "不能作为 CP 打出"));
    else if (!homeOk) reasons.push(bi("Set it as your home card during Diplomacy first", "需先在外交阶段选为本国牌"));
    else if (!canActionCard) reasons.push(bi("Only during your Action-phase impulse", "仅限你的行动阶段行动轮"));
    else if (G.cpRemaining > 0) reasons.push(bi("Finish the current impulse first", "请先结束本次行动"));
  }
  if (!eventModeOk) {
    if (!eventAllowed) reasons.push(bi("This card has no printed event", "此牌没有可打出的事件"));
    else if (eventBlockReason !== undefined) reasons.push(eventBlockReason);
    else if (!canActionCard) reasons.push(bi("Events are played at the start of an Action impulse", "事件需在行动轮开始时打出"));
    else if (G.cpRemaining > 0) reasons.push(bi("Events are played before spending CP", "事件需在花费 CP 前打出"));
  }
  if (!industOk && !isMandatory) {
    reasons.push(card.kind === "home" && !homeOk
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
    responseOk, showResponse, industOk, chainOk, saveOk, saved, homeOk, isMandatory,
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
