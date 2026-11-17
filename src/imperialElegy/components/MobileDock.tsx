/**
 * The phone's single bottom sheet.
 *
 * Below 768 px the map and the turn panel / player mat / hand tray stop being
 * three stacked regions and become one sheet with a tab bar: Orders, Hand, Mat,
 * Log (and War while a war or the Great War is running).  The sheet is
 * controlled from outside (`BoardLayout` + `useBoardModel`), so this component
 * owns markup only:
 *
 *   open/expanded   the tray's two positions: peek (closed), half, full
 *   tab/tabs        which body is in front, and which tabs exist
 *   decision        a decision is owed, so the sheet must never pass half
 *
 * The `data-open` / `data-expanded` / `data-tab` / `data-decision` attributes
 * are the contract with the stylesheet: every height and every show/hide below
 * 768 px is CSS, and nothing is unmounted when a tab is not selected (the
 * panels' state and test ids survive a switch).
 *
 * On desktop the dock stays in the DOM but the stylesheet makes the wrapper
 * and the body `display: contents`, so the three panels keep their grid areas
 * and the tab bar is hidden.  The buttons below are therefore not rendered
 * conditionally — a phone/desktop split here would change the DOM between the
 * two layouts.
 */
import React from "react";
import {bi} from "./boardHelpers";
import type {MobileTab} from "./modelValues";
import {useRovingTabs} from "./useRovingTabs";

export interface MobileDockTab {
  key: MobileTab;
  label: string;
  /** Optional marker on the tab, e.g. "!" for an owed decision or "⚔" for war. */
  badge?: React.ReactNode;
}

export interface MobileDockProps {
  open: boolean;
  expanded: boolean;
  tab: MobileTab;
  tabs: MobileDockTab[];
  onTab: (tab: MobileTab) => void;
  onToggleOpen: () => void;
  onToggleExpanded: () => void;
  /** A decision or battle is owed: the sheet may open to half, never higher. */
  decision: boolean;
  locale: "en" | "zh_CN";
  children: React.ReactNode;
}

export const MobileDock = ({
  open, expanded, tab, tabs, onTab, onToggleOpen, onToggleExpanded, decision, locale, children,
}: MobileDockProps) => {
  const chevron = open ? "▾" : "▸";
  const choose = (key: MobileTab) => {
    onTab(key);
    // Choosing a body while the sheet is folded brings it back to half height
    // (the model opens it without expanding it).
    if (!open) onToggleOpen();
  };
  // The tab strip is one tab stop: arrows/Home/End move between the tabs and
  // select as they focus, exactly like the other tablists in the board.
  const roving = useRovingTabs(tabs.map((entry) => entry.key), tab, (key) => choose(key as MobileTab));
  // The expand control only means anything while the sheet is open, and a
  // decision caps the sheet at half height, so both cases ignore the click.
  const expand = () => {
    if (!open || decision) return;
    onToggleExpanded();
  };

  return (
    <div
      className="ie-mobile-dock"
      data-testid="ie-mobile-dock"
      data-open={open ? "true" : "false"}
      data-expanded={expanded ? "true" : "false"}
      data-tab={tab}
      data-decision={decision ? "true" : "false"}
    >
      <header className="ie-mobile-bar">
        <button
          type="button"
          className="ie-mobile-toggle"
          data-testid="ie-mobile-toggle"
          aria-expanded={open}
          aria-controls="ie-mobile-body"
          aria-label={open ? bi(locale, "Collapse the panel", "收起面板") : bi(locale, "Expand the panel", "展开面板")}
          title={open ? bi(locale, "Collapse the panel", "收起面板") : bi(locale, "Expand the panel", "展开面板")}
          onClick={onToggleOpen}
        >
          <span aria-hidden="true">{chevron}</span>
        </button>

        <div className="ie-mobile-tabs" role="tablist" aria-label={bi(locale, "Board sections", "面板分页")}>
          {tabs.map(({key, label, badge}) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`ie-mobile-tab-${key}`}
              data-testid={`ie-mobile-tab-${key}`}
              aria-selected={key === tab}
              aria-controls="ie-mobile-body"
              className={`ie-mobile-tab${key === tab ? " selected" : ""}${key === "orders" && decision ? " urgent" : ""}`}
              {...roving(key)}
              onClick={() => choose(key)}
            >
              {label}
              {badge !== undefined && badge !== null && <span className="ie-mobile-tab-badge">{badge}</span>}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="ie-mobile-expand"
          data-testid="ie-mobile-expand"
          disabled={!open || decision}
          aria-disabled={!open || decision}
          aria-pressed={expanded}
          aria-label={expanded ? bi(locale, "Half-height panel", "半屏面板") : bi(locale, "Full-height panel", "全屏面板")}
          title={expanded ? bi(locale, "Half-height panel", "半屏面板") : bi(locale, "Full-height panel", "全屏面板")}
          onClick={expand}
        >
          <span aria-hidden="true">{expanded ? "▾" : "▴"}</span>
        </button>

        {decision && !open && (
          <span className="ie-mobile-decision-peek" data-testid="ie-mobile-decision-peek" role="status">
            {bi(locale, "A decision is waiting", "有决策待处理")}
          </span>
        )}
        {decision && open && (
          <span className="ie-mobile-decision-live" role="status">
            {bi(locale, "A decision is waiting", "有决策待处理")}
          </span>
        )}
      </header>

      <div
        className="ie-mobile-body"
        id="ie-mobile-body"
        data-testid="ie-mobile-body"
        role="tabpanel"
        aria-labelledby={tabs.some((entry) => entry.key === tab) ? `ie-mobile-tab-${tab}` : undefined}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
};
