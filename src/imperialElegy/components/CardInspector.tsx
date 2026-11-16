/**
 * Modal card inspector: the "zoom in" view of a card or a National Goal.
 *
 * Kept deliberately free of MUI so it can be server-rendered and unit-tested
 * with `renderToStaticMarkup`.  The inspector shows either the vector CardFace
 * or, in print mode, the module's scanned card image, plus every operation the
 * engine offers for that card and a single aggregated "cannot play" line.
 */
import {useEffect, useRef} from "react";
import type {MouseEvent, ReactNode} from "react";
import {CardDef} from "../constant/cards";
import {GoalDef} from "../constant/goals";
import {CardFace} from "./CardFace";
import {cardImageSrc} from "./preferences";
import type {CardFaceMode} from "./preferences";
import {ieStringsFor} from "./i18n";

export interface CardInspectorProps {
  open: boolean;
  onClose: () => void;
  locale: "en" | "zh_CN";
  face: {card: CardDef} | {goal: GoalDef};
  mode: CardFaceMode;
  /** All six operations for this card, rendered inside the inspector. */
  actions: ReactNode;
  /** Aggregated reasons the card cannot be played right now (may be empty). */
  unavailable?: string[];
  /** Focus target restored on close; defaults to document.activeElement captured on open. */
  returnFocus?: HTMLElement | null;
}

export const CardInspector = ({
  open,
  onClose,
  locale,
  face,
  mode,
  actions,
  unavailable,
  returnFocus,
}: CardInspectorProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const capturedFocus = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null | undefined>(returnFocus);

  // Keep the latest prop without re-running the open/close effect (which would
  // otherwise restore focus early, simply because the caller re-rendered).
  returnFocusRef.current = returnFocus;

  // Capture the pre-open focus target and restore it when the dialog closes or
  // unmounts.  Declared before the focus effect so capture happens first.
  useEffect(() => {
    if (!open) return;
    if (typeof document !== "undefined") {
      capturedFocus.current = document.activeElement as HTMLElement | null;
    }
    return () => {
      const target = returnFocusRef.current !== undefined
        ? returnFocusRef.current
        : capturedFocus.current;
      capturedFocus.current = null;
      if (typeof document === "undefined" || !target || typeof target.focus !== "function") return;
      try {
        target.focus();
      } catch {
        // The node may have been detached while the dialog was open.
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const button = closeRef.current;
    if (!button || typeof button.focus !== "function") return;
    try {
      button.focus();
    } catch {
      // Focusing is an enhancement; ignore detached/blocked nodes.
    }
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Respect handlers that already consumed the key, and never close while
      // an IME composition is in flight.
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      if (event.key === "Escape" || event.key === "Esc") {
        // Capture phase: while the inspector is open, Esc belongs to it alone,
        // not to the board's targeting/selection cancel handler.
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  const card = "card" in face ? face.card : undefined;
  const goal = "goal" in face ? face.goal : undefined;
  const data = goal ?? card!;
  const title = locale === "zh_CN" ? data.titleZh : data.title;
  const subtitle = goal
    ? `${goal.number} · ${goal.vp} VP`
    : `${card!.number === undefined ? "" : `${card!.number} · `}${card!.cp} CP`;
  const closeLabel = ieStringsFor(locale).close;
  const reasons = unavailable ?? [];
  const printImage = mode === "print" && card ? cardImageSrc(card.image) : null;
  const stopPropagation = (event: MouseEvent<HTMLElement>) => event.stopPropagation();

  return (
    <div
      className="ie-inspector-backdrop"
      data-testid="ie-card-inspector-backdrop"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="ie-inspector"
        data-testid="ie-card-inspector"
        data-face-mode={mode}
        onClick={stopPropagation}
      >
        <header className="ie-inspector-header">
          <div className="ie-inspector-heading">
            <h2 className="ie-inspector-title">{title}</h2>
            <div className="ie-inspector-subtitle">{subtitle}</div>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="ie-inspector-close"
            data-testid="ie-card-inspector-close"
            aria-label={closeLabel}
            onClick={onClose}
          >
            {closeLabel}
          </button>
        </header>

        <div className="ie-card-inspector-body">
          {printImage ? (
            <img
              className="ie-card-inspector-print"
              src={printImage}
              alt={title}
              data-testid="ie-card-inspector-image"
            />
          ) : goal ? (
            <CardFace locale={locale} goal={goal}/>
          ) : (
            <CardFace locale={locale} card={card!}/>
          )}
        </div>

        <div className="ie-card-inspector-actions" data-testid="ie-card-inspector-actions">
          {actions}
        </div>

        {reasons.length > 0 ? (
          <div className="ie-card-inspector-unavailable" data-testid="ie-card-inspector-unavailable">
            {reasons.join(" · ")}
          </div>
        ) : null}
      </aside>
    </div>
  );
};
