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
  /**
   * Phone layout: the rail is a 38 px strip of tabs and the active panel slides
   * up over the map.  Omitted on desktop, where the rail is a permanent column.
   */
  drawer?: {
    open: boolean;
    setOpen: (open: boolean) => void;
  };
}

/**
 * The 360 px context rail: one panel at a time behind three tabs.
 *
 * Every panel stays mounted (inactive ones are `hidden`), because the board's
 * derived state and the bots' effects must not depend on which tab the person
 * at the keyboard happens to be looking at.  `hidden` also keeps the content
 * out of the accessibility tree and out of the tab order.
 *
 * On a phone the rail collapses to its tab strip so the map gets the whole
 * screen; pressing a tab opens the sheet (`drawer`).
 */
export const RailTabs = ({tabs, active, onChange, label, drawer}: RailTabsProps) => {
  const visible = tabs.filter((tab) => tab.visible !== false);
  const sheet = drawer !== undefined;
  const open = sheet && drawer.open;
  const close = () => drawer?.setOpen(false);
  // Escape folds the sheet, the same way it cancels a targeting mode: a phone
  // player needs one predictable way out of a panel covering the map.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") drawer.setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, drawer]);
  return (
    <aside
      className={`ie-rail${sheet ? " ie-rail-sheet" : ""}`}
      data-testid="ie-rail"
      data-open={sheet ? (drawer.open ? "true" : "false") : undefined}
      aria-label={label}
    >
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
              aria-expanded={sheet ? (open && selected ? "true" : "false") : undefined}
              tabIndex={selected ? 0 : -1}
              className="ie-rail-tab"
              data-testid={`ie-rail-tab-${tab.key}`}
              onClick={() => {
                onChange(tab.key);
                // On a phone, pressing the tab that is already open folds the
                // sheet back down; pressing another one shows it.
                if (sheet) drawer.setOpen(!(open && selected));
              }}
            >
              {tab.label}
              {tab.badge !== undefined && <span className="ie-rail-badge">{tab.badge}</span>}
            </button>
          );
        })}
        {sheet && open && (
          <button
            type="button"
            className="ie-rail-close"
            data-testid="ie-rail-close"
            aria-label={label}
            onClick={close}
          >✕</button>
        )}
      </div>
      {visible.map((tab) => (
        <div
          key={tab.key}
          id={`ie-rail-panel-${tab.key}`}
          role="tabpanel"
          aria-labelledby={`ie-rail-tab-${tab.key}`}
          hidden={tab.key !== active || (sheet && !open)}
          className="ie-rail-panel"
          data-testid={`ie-rail-panel-${tab.key}`}
        >
          {tab.content}
        </div>
      ))}
    </aside>
  );
};
