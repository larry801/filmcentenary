/**
 * Card names as the UI prints them.
 *
 * A mandatory event and a combat card are easy to confuse at a glance in the
 * hand row, the card list and a pending decision, so their titles carry the
 * letter the rulebook uses for the printed type: 【M】 and 【C】.  Every other
 * type — and every National Goal, which has no card type — keeps its bare
 * title.  Keeping the rule in one place means the row, the face, the inspector,
 * the log and the card table cannot drift apart.
 */
import type {CardDef} from "../constant/cards";
import type {GoalDef} from "../constant/goals";
import {GOALS_BY_ID} from "../constant/goals";
import {CARD_BY_ID} from "../engine/deck";

export type CardNameLocale = "en" | "zh_CN";

/** The bracketed letter that marks a mandatory event or a combat card. */
export const cardTypeMark = (card: CardDef | GoalDef): string => {
  if ("type" in card) {
    if (card.type === "mandatory") return "【M】";
    if (card.type === "combat") return "【C】";
  }
  return "";
};

/** A card or goal's title in the UI language, with its printed-type mark. */
export const cardDisplayName = (card: CardDef | GoalDef, locale: CardNameLocale): string =>
  `${cardTypeMark(card)}${locale === "zh_CN" ? card.titleZh : card.title}`;

/** The same by id; an unknown id still renders as itself. */
export const cardDisplayNameById = (id: string, locale: CardNameLocale): string => {
  const card = CARD_BY_ID[id];
  if (card !== undefined) return cardDisplayName(card, locale);
  const goal = GOALS_BY_ID[id];
  return goal !== undefined ? cardDisplayName(goal, locale) : id;
};

/**
 * The hand as the tray prints it: home cards first, then the rest.
 *
 * A home card is the card the diplomacy step makes the seat keep, and it is
 * the one card in hand that is always legal to play (12.0) and always worth
 * finding.  A long hand pushes it off the right edge of the row, so it is
 * pinned to the front instead: the order within each group stays the order the
 * cards are held, so nothing else about the row changes.
 *
 * `kind` comes from the card definition; an id the deck does not know is left
 * where it is rather than being silently moved.
 */
export const pinHomeCards = (hand: readonly string[]): string[] => {
  const home: string[] = [];
  const rest: string[] = [];
  for (const id of hand) {
    if (CARD_BY_ID[id]?.kind === "home") home.push(id);
    else rest.push(id);
  }
  return [...home, ...rest];
};
