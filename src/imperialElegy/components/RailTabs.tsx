import React from "react";

export interface RailTab {
  key: string;
  label: string;
  /** Optional count/flag shown on the tab. */
  badge?: React.ReactNode;
  content: React.ReactNode;
  /** The tab only exists when this is not false (war tab before a war). */
  visible?: boolean;
}

export interface RailTabsProps {
  tabs: RailTab[];
  active: string;
  onChange: (key: string) => void;
  label: string;
}

/**
 * The 360 px context rail: one panel at a time behind three tabs.
 *
 * Every panel stays mounted (inactive ones are `hidden`), because the board's
 * derived state and the bots' effects must not depend on which tab the person
 * at the keyboard happens to be looking at.  `hidden` also keeps the content
 * out of the accessibility tree and out of the tab order.
 */
export const RailTabs = ({tabs, active, onChange, label}: RailTabsProps) => {
  const visible = tabs.filter((tab) => tab.visible !== false);
  return (
    <aside className="ie-rail" data-testid="ie-rail" aria-label={label}>
      <div className="ie-rail-tabs" role="tablist" aria-label={label}>
        {visible.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`ie-rail-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`ie-rail-panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              className="ie-rail-tab"
              data-testid={`ie-rail-tab-${tab.key}`}
              onClick={() => onChange(tab.key)}
            >
              {tab.label}
              {tab.badge !== undefined && <span className="ie-rail-badge">{tab.badge}</span>}
            </button>
          );
        })}
      </div>
      {visible.map((tab) => (
        <div
          key={tab.key}
          id={`ie-rail-panel-${tab.key}`}
          role="tabpanel"
          aria-labelledby={`ie-rail-tab-${tab.key}`}
          hidden={tab.key !== active}
          className="ie-rail-panel"
          data-testid={`ie-rail-panel-${tab.key}`}
        >
          {tab.content}
        </div>
      ))}
    </aside>
  );
};
