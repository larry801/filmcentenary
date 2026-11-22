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
 * They are five pages now, behind one sticky segmented control:
 *
 *   actions    the space's name, its legal actions, the folded refused rows
 *   space      what the space *is*, and its unit selection
 *   influence  the MPIT matrix and the national characteristics
 *   deals      the 11.0/11.1 negotiation table (only during the diplomacy phase)
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
 *
 * The deals page is conditional for the same reason (rules 11.0/11.1): the
 * negotiation table only exists during the diplomacy phase, and an offer
 * addressed to the reader pulls it to the front so a deal cannot sit unread.
 */
import React from "react";
import {bi} from "./boardHelpers";
import {useRovingTabs} from "./useRovingTabs";

export type OrdersTab = "actions" | "space" | "influence" | "deals" | "naval";

export interface OrdersPanelProps {
  locale: "en" | "zh_CN";
  labels: {
    actions: string;
    space: string;
    influence: string;
    deals: string;
    naval: string;
  };
  active: OrdersTab;
  onTab: (tab: OrdersTab) => void;
  /** The naval page has something to offer this render. */
  navalVisible: boolean;
  /** 11.0/11.1: the diplomacy phase's negotiation table is open this render. */
  dealsVisible?: boolean;
  /** A deal addressed to the reader just arrived: pull its page to the front. */
  dealUrgent?: boolean;
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
export const ordersTabKeys = (navalVisible: boolean, dealsVisible = false): OrdersTab[] => [
  "actions",
  "space",
  "influence",
  ...(dealsVisible ? ["deals" as OrdersTab] : []),
  ...(navalVisible ? ["naval" as OrdersTab] : []),
];

/** Where the panel lands when the requested page no longer exists. */
export const resolveOrdersTab = (
  requested: OrdersTab,
  navalVisible: boolean,
  dealsVisible = false,
): OrdersTab =>
  ordersTabKeys(navalVisible, dealsVisible).includes(requested) ? requested : "actions";

export const OrdersPanel = ({
  locale, labels, active, onTab, navalVisible, navalUrgent = false,
  dealsVisible = false, dealUrgent = false, heading, tabs,
}: OrdersPanelProps) => {
  const keys = ordersTabKeys(navalVisible, dealsVisible);
  const selected = resolveOrdersTab(active, navalVisible, dealsVisible);
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
              className={`ie-orders-tab${(key === "naval" && navalUrgent) || (key === "deals" && dealUrgent) ? " urgent" : ""}`}
              data-testid={`ie-orders-tab-${key}`}
              {...roving(key)}
              onClick={() => onTab(key)}
            >
              {labels[key]}
              {key === "naval" && navalUrgent && (
                <span className="ie-orders-tab-badge" aria-label={bi(locale, "Interception offered", "可尝试拦截")}>!</span>
              )}
              {key === "deals" && dealUrgent && (
                <span className="ie-orders-tab-badge" aria-label={bi(locale, "Deal to answer", "有待确认的交易")}>!</span>
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
