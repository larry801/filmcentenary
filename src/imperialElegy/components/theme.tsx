import React from "react";
import {Icon} from "./Icon";
import {ThemeProvider} from "@mui/material/styles";
import "./imperial-elegy.css";
import {ieLocale, ieT} from "./i18n";
import {ieTheme} from "./ie-theme";

export const IEThemeProvider = ({children}: {children: React.ReactNode}) => (
  <ThemeProvider theme={ieTheme}>{children}</ThemeProvider>
);

export const IESurface = ({children, className = ""}: {children: React.ReactNode; className?: string}) => (
  <IEThemeProvider>
    <div className={`ie-surface ${className}`} data-locale={ieLocale()}>{children}</div>
  </IEThemeProvider>
);

/**
 * Whether a click inside a panel head came from one of the controls that live
 * there.  Those keep their own behaviour; anywhere else the bar folds the panel.
 * Kept as a pure predicate so it can be tested without a DOM.
 */
export const isHeaderControl = (target: EventTarget | null): boolean => {
  const element = target as (Element & {closest?: (selector: string) => Element | null}) | null;
  if (!element || typeof element.closest !== "function") return false;
  return element.closest("button, a, input, select, textarea, label") !== null;
};

export interface IEPanelProps {
  title?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /**
   * Panels fold by clicking their title bar.  Every board panel does this, so a
   * phone can show just the one or two panels being used; `collapsible={false}`
   * is for the rare panel whose body must stay visible (a blocking decision).
   */
  collapsible?: boolean;
  /** Controlled collapsed state; omit to let the panel manage it. */
  collapsed?: boolean;
  /** Initial state for an uncontrolled panel. */
  defaultCollapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
  /** Shown in the title bar while folded, e.g. "3 legal targets". */
  collapsedHint?: React.ReactNode;
}

/**
 * A board panel with a foldable title bar.
 *
 * Clicking anywhere in the bar toggles the body, except on the controls that
 * live there — a tab, a badge button or a close button must still do its own
 * job.  The caret and `aria-expanded` carry the state for assistive tech.
 */
export const IEPanel = ({
  title, children, actions, className = "",
  collapsible = true,
  collapsed,
  defaultCollapsed = false,
  onToggle,
  collapsedHint,
}: IEPanelProps) => {
  const [internal, setInternal] = React.useState(defaultCollapsed);
  const isCollapsed = collapsed ?? internal;
  const bodyId = React.useId();
  const t = ieT();

  const toggle = () => {
    const next = !isCollapsed;
    if (collapsed === undefined) setInternal(next);
    onToggle?.(next);
  };

  const onHeadClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!collapsible) return;
    if (isHeaderControl(event.target)) return;
    toggle();
  };

  return (
    <section className={`ie-panel ${className}`} data-collapsed={isCollapsed ? "true" : "false"}>
      {(title || actions) && (
        <header
          className={`ie-panel-head${collapsible ? " collapsible" : ""}`}
          onClick={onHeadClick}
        >
          {collapsible && (
            <button
              type="button"
              className="ie-panel-caret"
              aria-expanded={isCollapsed ? "false" : "true"}
              aria-controls={bodyId}
              aria-label={isCollapsed ? t.expand : t.collapse}
              title={isCollapsed ? t.expand : t.collapse}
              onClick={(event) => { event.stopPropagation(); toggle(); }}
            >
              <span aria-hidden="true">{isCollapsed ? <Icon name="chevron-right" size={14}/> : <Icon name="chevron-down" size={14}/>}</span>
            </button>
          )}
          <h3>{title}</h3>
          {actions}
          {isCollapsed && collapsedHint !== undefined && (
            <span className="ie-panel-folded-hint">{collapsedHint}</span>
          )}
        </header>
      )}
      {!isCollapsed && <div className="ie-panel-body" id={bodyId}>{children}</div>}
    </section>
  );
};

export const IEBadge = ({children, tone = "default"}: {children: React.ReactNode; tone?: string}) => (
  <span className={`ie-badge ie-badge-${tone}`}>{children}</span>
);

export const IEChip = ({children}: {children: React.ReactNode}) => <span className="ie-chip">{children}</span>;
