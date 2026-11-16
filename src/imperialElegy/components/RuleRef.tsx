import React from "react";
import {bi} from "./boardHelpers";

/**
 * The printed rule that a panel or a section is about.
 *
 * Two shapes share this file:
 *
 * - `RuleRef` (`<sup>`) is the static typographic badge a title prints next to
 *   its own text ("Amphibious assault ¹⁹·¹⁰").  It is not interactive.
 * - `RuleLink` is the interactive one: a circled "?" plus the rule number that
 *   opens the reference drawer at a resolved anchor.  It is a real button, so
 *   it stops the click it gets inside a foldable panel's title bar and cannot
 *   grow bigger than the bar around it.
 *
 * Both are stateless.
 */

/** A printed rule number.  It is a typographic superscript, not body text, so it
 * may sit below 12 px; the title carries the full reference for hover/AT. */
export const RuleRef = ({n, title}: {n: string; title?: string}) => (
  <sup className="ie-rule-ref" title={title ?? n}>{n}</sup>
);

export interface RuleRefProps {
  /** A drawer anchor: `rules:<section>` or `chart:<chart id>`. */
  anchor: string;
  locale: "en" | "zh_CN";
  /** What to print after the "?"; defaults to the anchor's own rule number. */
  label?: string;
  /** The drawer's opener.  Without it the link is inert (the drawer is closed here). */
  onOpenReference?: (anchor: string) => void;
  testId?: string;
}

/** `chart:combat-crt` reads "CRT"; `rules:12.3` keeps its own number. */
export const ruleRefLabel = (anchor: string): string => {
  const [kind, ...rest] = anchor.split(":");
  const id = rest.join(":") || anchor;
  if (kind === "chart") {
    return id
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  return id.replace(/^rules:?/, "");
};

/** `chart:combat-crt` → `ie-rule-ref-chart-combat-crt`. */
export const ruleRefTestId = (anchor: string): string =>
  `ie-rule-ref-${anchor.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "")}`;

/**
 * The interactive reference link: `? 12.3`, opening the drawer at `anchor`.
 *
 * It is a button rather than an anchor because it opens a panel, not a page;
 * the accessible name spells the whole action out, so the "?" is decoration.
 */
export const RuleLink = ({anchor, locale, label, onOpenReference, testId}: RuleRefProps) => {
  const rule = label ?? ruleRefLabel(anchor);
  const open = onOpenReference !== undefined;
  return (
    <button
      type="button"
      className="ie-rule-ref-btn"
      data-testid={testId ?? ruleRefTestId(anchor)}
      data-anchor={anchor}
      disabled={!open}
      aria-label={bi(locale, `Open the rule reference: ${rule}`, `打开规则参考：${rule}`)}
      title={open
        ? bi(locale, `Open the rule reference: ${rule}`, `打开规则参考：${rule}`)
        : bi(locale, "The reference drawer is closed here.", "此处无法打开参考面板。")}
      onClick={(event) => {
        // The link usually sits inside a foldable panel's title bar: the bar
        // must not fold when the link opens the drawer.
        event.stopPropagation();
        onOpenReference?.(anchor);
      }}
    >
      <span className="ie-rule-ref-mark" aria-hidden="true">?</span>
      <span className="ie-rule-ref-rule">{rule}</span>
    </button>
  );
};
