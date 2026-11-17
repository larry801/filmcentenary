/**
 * A small, hand-rolled focus trap for the card inspector and the chart
 * lightbox.
 *
 * `CardInspector` renders a full-height overlay; without a trap, Tab walks out
 * of it into the board behind, which is both confusing for a keyboard user and
 * a way to trigger an action the inspector was opened to review.  The trap
 * keeps Tab/Shift+Tab inside the container, sends Escape to the caller, and
 * restores focus to whatever opened the overlay.
 *
 * No dependency: the tab stops are read from the DOM on every key press, so an
 * overlay whose content changes (a card operation appearing, a chart zooming)
 * needs no bookkeeping.
 */
import React from "react";

const TABBABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** The focusable elements inside `root`, in DOM order, skipping hidden ones. */
export const tabbableIn = (root: HTMLElement | null): HTMLElement[] => {
  if (root === null) return [];
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter((node) => {
    // `offsetParent` is null in a Node (no layout) and for fixed-position
    // overlays, so fall back to the client rects; both are absent in a
    // non-DOM render, where every element is treated as visible.
    const laidOut = typeof node.getClientRects === "function" ? node.getClientRects().length > 0 : true;
    return laidOut || node.offsetParent !== null || node === document.activeElement;
  });
};

export interface UseFocusTrapOptions {
  /** Trap only while true; a closed overlay passes everything through. */
  active: boolean;
  /** Escape handler (the overlay's close). */
  onEscape?: () => void;
}

export const useFocusTrap = <T extends HTMLElement>(
  {active, onEscape}: UseFocusTrapOptions,
): React.RefObject<T | null> => {
  const ref = React.useRef<T | null>(null);
  const restoreTo = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!active) return;
    const root = ref.current;
    restoreTo.current = (document.activeElement as HTMLElement | null) ?? null;
    // Move focus in on open, so the first Tab starts inside the overlay.
    const first = tabbableIn(root)[0] ?? root;
    first?.focus({preventScroll: true});

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        if (onEscape !== undefined) {
          // The overlay is modal: Escape belongs to it alone.  Stopping the
          // event here (document capture) keeps the same key from also
          // reaching the board, the reference drawer or an open toast.
          event.preventDefault();
          event.stopPropagation();
          onEscape();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const stops = tabbableIn(root);
      if (stops.length === 0) {
        event.preventDefault();
        root?.focus({preventScroll: true});
        return;
      }
      const firstStop = stops[0];
      const lastStop = stops[stops.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (current === firstStop || current === null || !root?.contains(current)) {
          event.preventDefault();
          lastStop.focus();
        }
      } else if (current === lastStop || current === null || !root?.contains(current)) {
        event.preventDefault();
        firstStop.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      restoreTo.current?.focus({preventScroll: true});
    };
  }, [active, onEscape]);

  return ref;
};
