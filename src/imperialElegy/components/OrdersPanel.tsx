/**
 * The Orders body's own navigation.
 *
 * The turn panel's Action tab used to be one long column holding six unrelated
 * things: the space's facts, its action list, the MPIT influence matrix, the
 * national characteristics, three naval flows and the required card choices.  A
 * typical space refused ten of its twelve rows, so the two legal buttons sat
 * below a wall of disabled ones, and MPIT (a once-per-impulse lever) competed
 * for the same first screen.
 *
 * They are four pages now, behind one sticky segmented control:
 *
 *   actions    the space's name, its legal actions, the folded refused rows
 *   space      what the space *is*, and its unit selection
 *   influence  the MPIT matrix and the national characteristics
 *   naval      amphibious / transport / interception (only while offered)
 *
 * Every page stays mounted and inactive pages are `hidden`, the same contract
 * the turn panel's tab strip already had: an armed `ConfirmButton`, a half-filled
 * naval form and the bots' effects must not reset when the reader switches.
 *
 * The naval page is conditional.  It appears with the first offered naval flow,
 * jumps to the front when an interception window opens (the window is short and
 * belongs to the defender), and falls back to the actions page when the window
 * closes under the reader.
 */
import React from "react";
import {bi} from "./boardHelpers";
import {useRovingTabs} from "./useRovingTabs";

export type OrdersTab = "actions" | "space" | "influence" | "naval";

export interface OrdersPanelProps {
  locale: "en" | "zh_CN";
  labels: {
    actions: string;
    space: string;
    influence: string;
    naval: string;
  };
  active: OrdersTab;
  onTab: (tab: OrdersTab) => void;
  /** The naval page has something to offer this render. */
  navalVisible: boolean;
  /** An interception window just opened: pull the naval page to the front. */
  navalUrgent?: boolean;
  /** The selected space's name, for the always-on heading above the pages. */
  heading?: React.ReactNode;
  tabs: Record<OrdersTab, React.ReactNode>;
}

/**
 * The page keys, in reading order, restricted to the pages that exist.
 *
 * Exported for the tests and the model: the fallback when a page disappears is
 * "first key", which is what both the turn panel and the phone dock do with
 * their own tab strips.
 */
export const ordersTabKeys = (navalVisible: boolean): OrdersTab[] =>
  navalVisible ? ["actions", "space", "influence", "naval"] : ["actions", "space", "influence"];

/** Where the panel lands when the requested page no longer exists. */
export const resolveOrdersTab = (requested: OrdersTab, navalVisible: boolean): OrdersTab =>
  ordersTabKeys(navalVisible).includes(requested) ? requested : "actions";

export const OrdersPanel = ({
  locale, labels, active, onTab, navalVisible, navalUrgent = false, heading, tabs,
}: OrdersPanelProps) => {
  const keys = ordersTabKeys(navalVisible);
  const selected = resolveOrdersTab(active, navalVisible);
  const roving = useRovingTabs(keys, selected, (key) => onTab(key as OrdersTab));

  return (
    <div className="ie-orders" data-testid="ie-orders">
      {heading !== undefined && <div className="ie-orders-heading" data-testid="ie-orders-heading">{heading}</div>}

      <div
        className="ie-orders-nav"
        data-testid="ie-orders-nav"
        role="tablist"
        aria-label={bi(locale, "Orders sections", "指令分页")}
      >
        {keys.map((key) => {
          const isSelected = key === selected;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`ie-orders-tab-${key}`}
              aria-selected={isSelected}
              aria-controls={`ie-orders-panel-${key}`}
              className={`ie-orders-tab${key === "naval" && navalUrgent ? " urgent" : ""}`}
              data-testid={`ie-orders-tab-${key}`}
              {...roving(key)}
              onClick={() => onTab(key)}
            >
              {labels[key]}
              {key === "naval" && navalUrgent && (
                <span className="ie-orders-tab-badge" aria-label={bi(locale, "Interception offered", "可尝试拦截")}>!</span>
              )}
            </button>
          );
        })}
      </div>

      {keys.map((key) => (
        <div
          key={key}
          id={`ie-orders-panel-${key}`}
          role="tabpanel"
          aria-labelledby={`ie-orders-tab-${key}`}
          className={`ie-orders-pane ie-orders-pane-${key}`}
          data-testid={`ie-orders-panel-${key}`}
          hidden={key !== selected}
          // Inactive pages stay mounted (hidden) so their derived state, an
          // armed confirmation and the bots' effects survive a switch.
        >
          {tabs[key]}
        </div>
      ))}
    </div>
  );
};
