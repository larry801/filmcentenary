/**
 * Modal card inspector: the "zoom in" view of a card or a National Goal.
 *
 * Kept deliberately free of MUI so it can be server-rendered and unit-tested
 * with `renderToStaticMarkup`.  The inspector shows either the vector CardFace
 * or, in print mode, the module's scanned card image, plus every operation the
 * engine offers for that card and a single aggregated "cannot play" line.
 *
 * It is a real modal dialog: `useFocusTrap` keeps Tab/Shift+Tab inside it, Esc
 * closes it, and focus returns to whatever opened it.
 */
import {useCallback, useEffect, useRef} from "react";
import type {MouseEvent, ReactNode} from "react";
import {CardDef} from "../constant/cards";
import {GoalDef} from "../constant/goals";
import {CardFace} from "./CardFace";
import {cardImageSrc} from "./preferences";
import type {CardFaceMode} from "./preferences";
import {ieStringsFor} from "./i18n";
import {useFocusTrap} from "./useFocusTrap";

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
  /** Focus target restored on close; defaults to the element that opened the inspector. */
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
  // Focus stays inside the dialog: `useFocusTrap` captures whatever opened the
  // inspector, moves focus to the first tab stop (the close button, which is
  // first in the DOM) on open, cycles Tab/Shift+Tab, sends Escape to `onClose`,
  // and restores the opener on close or unmount.
  //
  // The trap re-runs its effect when `onEscape` changes identity, and the board
  // re-renders often, so the handler is kept stable and reads the latest
  // `onClose` through a ref.  A fresh closure here would otherwise restore and
  // re-take focus on every parent render, yanking the user back to the close
  // button mid-dialog.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const handleEscape = useCallback(() => onCloseRef.current(), []);
  const dialogRef = useFocusTrap<HTMLElement>({active: open, onEscape: handleEscape});

  // A caller-named `returnFocus` overrides the trap's default (the element that
  // had focus when the dialog opened).  This effect is declared after the trap
  // so its cleanup runs after the trap's, letting the explicit target win.
  const returnFocusRef = useRef(returnFocus);
  returnFocusRef.current = returnFocus;
  useEffect(() => {
    if (!open || returnFocusRef.current === undefined) return;
    return () => {
      const target = returnFocusRef.current;
      if (!target || typeof target.focus !== "function") return;
      try {
        target.focus();
      } catch {
        // The node may have been detached while the dialog was open.
      }
    };
  }, [open]);

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
        ref={dialogRef}
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
