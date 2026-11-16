import React from "react";

/**
 * Roving tabindex for a `tablist`.
 *
 * Arrow keys move between tabs, Home/End jump to the first/last, and the tab
 * that receives focus is also selected (the automatic-activation pattern the
 * board uses everywhere, so a keyboard user never has to press Enter twice).
 * Returns the props each tab needs; the caller keeps the selection state.
 */
export interface RovingTabProps {
  ref: (node: HTMLButtonElement | null) => void;
  tabIndex: number;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}

export const useRovingTabs = (
  keys: readonly string[],
  active: string,
  onSelect: (key: string) => void,
): ((key: string) => RovingTabProps) => {
  const nodes = React.useRef(new Map<string, HTMLButtonElement>());

  const move = (from: number, delta: number): void => {
    if (keys.length === 0) return;
    const next = (from + delta + keys.length) % keys.length;
    const key = keys[next];
    onSelect(key);
    // Focus after the re-render that moves `tabIndex`, so the browser can
    // keep the focus on a tab that is now tabbable.
    window.setTimeout(() => nodes.current.get(key)?.focus(), 0);
  };

  return (key: string): RovingTabProps => ({
    ref: (node) => {
      if (node) nodes.current.set(key, node);
      else nodes.current.delete(key);
    },
    tabIndex: key === active ? 0 : -1,
    onKeyDown: (event) => {
      const index = keys.indexOf(key);
      if (index < 0) return;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          move(index, 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          move(index, -1);
          break;
        case "Home":
          event.preventDefault();
          move(0, 0);
          break;
        case "End":
          event.preventDefault();
          move(keys.length - 1, 0);
          break;
        default:
          break;
      }
    },
  });
};
