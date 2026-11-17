/**
 * The stack popover: what a dense space actually holds.
 *
 * The map can only paint the top three counters of a stack; this card lists
 * every group in `stackSummary` order with the owner's colour, the counter's
 * name, its count and a note when some of them are reduced.  It is a modal-less
 * `role="dialog"`: Escape or the close button dismisses it, and the parent
 * (the map) keeps the open state, so nothing is rendered while `open` is false.
 */
import React from "react";
import type {Power, UnitKind} from "../types";
import {bi} from "./boardHelpers";
import type {StackEntry} from "./stackSummary";

export interface StackPopoverProps {
  entries: StackEntry[];
  locale: "en" | "zh_CN";
  open: boolean;
  onClose: () => void;
  testId?: string;
}

/** Counter name, in the order the popover lists them. */
const kindName = (locale: "en" | "zh_CN", kind: UnitKind): string => {
  switch (kind) {
    case "army": return bi(locale, "Army", "军团");
    case "reserveArmy": return bi(locale, "Reserve army", "预备军");
    case "eliteCorps": return bi(locale, "Elite Corps", "精锐军");
    case "expeditionary": return bi(locale, "Expeditionary Force", "远征军");
    case "squadron": return bi(locale, "Squadron", "舰队");
    case "dreadnought": return bi(locale, "Dreadnought", "无畏舰");
    default: return bi(locale, "Unit", "单位");
  }
};

const powerName = (locale: "en" | "zh_CN", power: Power): string => {
  switch (power) {
    case "GE": return bi(locale, "Germany", "德国");
    case "UK": return bi(locale, "Britain", "英国");
    case "FR": return bi(locale, "France", "法国");
    case "AU": return bi(locale, "Austria-Hungary", "奥匈");
    case "RU": return bi(locale, "Russia", "俄国");
    case "OT": return bi(locale, "Ottoman Empire", "奥斯曼");
    default: return power;
  }
};

export const StackPopover = ({entries, locale, open, onClose, testId}: StackPopoverProps): React.JSX.Element | null => {
  const closeRef = React.useRef<HTMLButtonElement | null>(null);
  const latestClose = React.useRef(onClose);
  latestClose.current = onClose;

  // Escape closes from anywhere, including when focus stayed on the map.
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      latestClose.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Move focus onto the close button so Escape and Tab stay inside the card.
  React.useEffect(() => {
    if (open) closeRef.current?.focus({preventScroll: true});
  }, [open]);

  if (!open) return null;

  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  const title = bi(locale, "Unit stack", "单位堆叠");
  const status = total === 0
    ? bi(locale, "No units", "无单位")
    : bi(locale, `${total} unit${total === 1 ? "" : "s"}`, `${total} 个单位`);

  return (
    <div className="ie-stack-popover" role="dialog" aria-label={title}
      aria-modal={false} data-testid={testId}>
      <div className="ie-stack-popover-head">
        <span className="ie-stack-popover-title">{title}</span>
        <span className="ie-stack-popover-total">{status}</span>
        <button ref={closeRef} type="button" className="ie-stack-popover-close"
          aria-label={bi(locale, "Close", "关闭")} title={bi(locale, "Close", "关闭")}
          onClick={onClose}>×</button>
      </div>
      {entries.length > 0 && (
        <ul className="ie-stack-popover-list">
          {entries.map((entry) => (
            <li key={`${entry.power}-${entry.kind}-${entry.reduced ? "r" : "f"}`}
              className="ie-stack-popover-row"
              data-testid={testId === undefined ? undefined : `${testId}-row-${entry.power}-${entry.kind}`}>
              <i className={`ie-stack-popover-pip ie-power-pip-${entry.power.toLowerCase()}`} aria-hidden="true"/>
              <span className="ie-stack-popover-kind">{kindName(locale, entry.kind)}</span>
              <span className="ie-stack-popover-power">{powerName(locale, entry.power)}</span>
              <span className="ie-stack-popover-count">×{entry.count}</span>
              {entry.reduced && (
                <span className="ie-stack-popover-reduced">{bi(locale, "reduced", "受损")}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
