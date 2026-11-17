/**
 * The inline intent chooser.
 *
 * A click on a destination that offers two intents (a Great War land unit can
 * both march and rail to the same space, a redeploy can be a land or a naval
 * move) must not guess: it asks.  The chooser is a small, anchored popover that
 * submits through the same `submitTargeting` path as any other click, so the CP
 * invariant — only a submission spends CP — is untouched.
 */
import React from "react";
import {bi} from "./boardHelpers";
import type {TargetIntent} from "./useInteraction";

export interface IntentChooserProps {
  locale: "en" | "zh_CN";
  /** The destination the choice applies to, already localized. */
  targetLabel: string;
  intents: TargetIntent[];
  onChoose: (intent: TargetIntent) => void;
  onCancel: () => void;
}

const INTENT_LABELS: Record<TargetIntent, {en: string; zh: string}> = {
  redeploy: {en: "Move here", zh: "移动至此"},
  landBattle: {en: "Land battle", zh: "陆战"},
  navalBattle: {en: "Naval battle", zh: "海战"},
  amphibious: {en: "Amphibious assault", zh: "两栖突击"},
  navalTransport: {en: "Naval transport", zh: "海上运输"},
  navalIntercept: {en: "Naval interception", zh: "海上拦截"},
  gwMarch: {en: "March (1 space)", zh: "行军（1 格）"},
  gwRail: {en: "Rail (along a friendly path)", zh: "铁路（沿友方线路）"},
};

export const intentLabel = (intent: TargetIntent, locale: "en" | "zh_CN"): string =>
  locale === "zh_CN" ? INTENT_LABELS[intent].zh : INTENT_LABELS[intent].en;

export const IntentChooser = ({locale, targetLabel, intents, onChoose, onCancel}: IntentChooserProps) => {
  const firstRef = React.useRef<HTMLButtonElement | null>(null);
  React.useEffect(() => { firstRef.current?.focus(); }, []);
  return (
    <div className="ie-intent-chooser" data-testid="ie-intent-chooser" role="group" aria-label={bi(locale, "Choose the action", "选择行动")}>
      <span className="ie-intent-chooser-title">
        {bi(locale, `What happens at ${targetLabel}?`, `在${targetLabel}做什么？`)}
      </span>
      <div className="ie-intent-chooser-options">
        {intents.map((intent, index) => (
          <button
            key={intent}
            ref={index === 0 ? firstRef : undefined}
            type="button"
            className="ie-btn"
            data-testid={`ie-intent-${intent}`}
            onClick={() => onChoose(intent)}
          >
            {intentLabel(intent, locale)}
          </button>
        ))}
        <button
          type="button"
          className="ie-btn secondary ie-btn-xs"
          data-testid="ie-intent-cancel"
          onClick={onCancel}
        >
          {bi(locale, "Cancel (Esc)", "取消（Esc）")}
        </button>
      </div>
    </div>
  );
};
