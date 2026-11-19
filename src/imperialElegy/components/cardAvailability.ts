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
import {impulseAlreadyUsed, responseCardEligibility} from "../moves";

export interface CardAvailability {
  cpAllowed: boolean;
  cpModeOk: boolean;
  /**
   * Whether the hand draws a CP control for this card.  A mandatory event has
   * no CP-only mode — 12.0's CP play *is* its event — so the tray folds the two
   * controls into the single "play mandatory event" button instead of offering
   * a choice that does the same thing.  A105 (mandatory *response*) keeps its
   * CP control: "If played for CP the event does not trigger."
   */
  showCp: boolean;
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
  // 12.0's "All cards except Mandatory Event cards can be played for CP": a
  // mandatory event still resolves its printed event when played for CP, so
  // the move accepts both modes but the tray must not offer two buttons that
  // do the same thing.  Only a mandatory *response* (A105) keeps a real
  // separate CP mode.
  const showCp = card.type !== "mandatory";
  const cpBlockKey = cpGate.ok ? eventBlockKey : cpGate.reason;
  const cpBlockReason = cpBlockKey !== undefined ? playBlock[cpBlockKey] : undefined;
  // 6.1/12.0: a home card is playable while it is **in hand**, which is the only
  // way the tray can list it.  That is normally just the card chosen in
  // Diplomacy, but A040 British Trade adds the other one to hand, so hand
  // membership — not the Diplomacy selection — decides play.  The selection
  // still decides 12.13's industrialization slot.
  const homeIndustryOk = card.kind !== "home" || homeCards.includes(cardId);
  // 12.0: a card opens an impulse.  Once that impulse's card has been played
  // (or its CP have been spent, even down to zero) the next card waits for a
  // fresh impulse, so both the CP and the event mode are shut — not merely the
  // CP mode, which is what let a spent impulse play a second card.  The printed
  // no-pass cards (`forcedCardIds`) grant no exception: a used impulse can be
  // handed over, so the card never needs a second slot in the same impulse.
  const impulseUsed = impulseAlreadyUsed(G, power);
  const cpModeOk = canActionCard && cpAllowed && !impulseUsed;
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
  // The card's own gates come before the generic lines: "cannot be played for
  // CP" describes the card, not why it is unusable at this moment.
  const ownReasons: string[] = (card.type === "response"
    ? [responseReason, responseWindowReason ?? noWindowReason]
    : [cpBlockReason, eventBlockReason]).filter((reason): reason is string => reason !== undefined);
  const reasons: string[] = [];
  // 12.0: the impulse's card play comes before its CP are spent.  Two wordings
  // keep the familiar reason while CP are still banked and name the printed
  // one-card rule once the budget is gone and the impulse is only being closed.
  const oneCardReason = bi("One card per impulse; finish this impulse first", "每次行动轮只能打出 1 张牌；请先结束本次行动");
  if (!cpModeOk) {
    if (!cpAllowed) reasons.push(cpBlockReason ?? bi("Cannot be played for CP", "不能作为 CP 打出"));
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
    cpAllowed, cpModeOk, showCp, eventAllowed, eventModeOk, eventBlockReason, eventBlockKey,
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
