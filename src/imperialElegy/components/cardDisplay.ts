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
