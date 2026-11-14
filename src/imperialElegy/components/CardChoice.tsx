import React from "react";
import {CardDef} from "../constant/cards";
import {GoalDef} from "../constant/goals";
import {CardFace} from "./CardFace";
import {IELocale} from "./i18n";

/** Which printed face a choice draws. */
export type CardChoiceFace =
  | {card: CardDef; goal?: never}
  | {goal: GoalDef; card?: never};

export interface CardChoiceAction {
  /** Button text; the face already prints the card title. */
  label: string;
  /** Stable test id for the button. */
  testId: string;
  disabled?: boolean;
  selected?: boolean;
  title?: string;
  onChoose: () => void;
}

export interface CardChoiceProps {
  locale: IELocale;
  /** The card or National Goal this choice is about. */
  face: CardChoiceFace;
  /** Stable test id for the wrapper, so the face itself is selectable. */
  testId: string;
  /**
   * One button per legal way to use this card.  A card printed with
   * alternatives (combat modes, auction sides) gets one face and one button
   * per mode instead of repeating the face.
   */
  actions: CardChoiceAction[];
}

/**
 * A required card/Goal choice rendered as the printed face plus buttons.
 *
 * The rules ask the player to pick a specific card (a home card, one of three
 * National Goals, a card to discard, the combat card to play), so the choice
 * shows the face itself instead of only its title.  Buttons stay plain
 * `<button>` elements so existing selectors keep working.
 */
export const CardChoice = ({locale, face, testId, actions}: CardChoiceProps) => {
  const selected = actions.some((action) => action.selected === true);
  return (
    <article className={`ie-card ie-choice-card${selected ? " selected" : ""}`} data-testid={testId} data-card-id={face.goal ? face.goal.id : face.card.id}>
      {face.goal ? <CardFace goal={face.goal} locale={locale}/> : <CardFace card={face.card} locale={locale}/>}
      <div className="ie-card-actions">
        {actions.map((action) => (
          <button
            key={action.testId}
            type="button"
            data-testid={action.testId}
            aria-pressed={action.selected}
            disabled={action.disabled}
            title={action.title}
            onClick={action.onChoose}
          >
            {action.selected ? "✓ " : ""}{action.label}
          </button>
        ))}
      </div>
    </article>
  );
};
