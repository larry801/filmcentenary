/**
 * The Imperial Elegy icon set: one inline SVG family, 16 × 16, 1.5 px stroke,
 * square caps, miter joins, `currentColor`.  Icons are always decorative unless
 * a control has no other accessible name (then the control owns the label).
 * Contract: docs/imperial-elegy/VISUAL_SYSTEM.md §7.
 */
import type {JSX} from "react";

export type IconName =
  | "chevron-down" | "chevron-up" | "chevron-left" | "chevron-right"
  | "close" | "menu" | "check" | "plus" | "minus" | "search"
  | "book-reference" | "chart" | "printer" | "download" | "crosshair"
  | "anchor" | "crossed-sabres" | "seal-decision" | "star" | "laurel-goal"
  | "fort" | "trench" | "rail" | "arrow-right" | "bot" | "lock"
  | "warning-triangle" | "info-circle";

export type IconSize = 14 | 16 | 20 | 24;

export interface IconProps {
  name: IconName;
  size?: IconSize;
  className?: string;
}

const paths: Record<IconName, JSX.Element> = {
  "chevron-down": <polyline points="4,6 8,10 12,6" />,
  "chevron-up": <polyline points="4,10 8,6 12,10" />,
  "chevron-left": <polyline points="10,4 6,8 10,12" />,
  "chevron-right": <polyline points="6,4 10,8 6,12" />,
  close: <><line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" /></>,
  menu: <><line x1="2.5" y1="4" x2="13.5" y2="4" /><line x1="2.5" y1="8" x2="13.5" y2="8" /><line x1="2.5" y1="12" x2="13.5" y2="12" /></>,
  check: <polyline points="3,8.5 6.5,12 13,4.5" />,
  plus: <><line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" /></>,
  minus: <line x1="3" y1="8" x2="13" y2="8" />,
  search: <><circle cx="7" cy="7" r="4.2" /><line x1="10.2" y1="10.2" x2="13.5" y2="13.5" /></>,
  "book-reference": <><path d="M2.5 3.5h4a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 0-1.5-1.5h-4z" /><path d="M13.5 3.5h-4A1.5 1.5 0 0 0 8 5v8a1.5 1.5 0 0 1 1.5-1.5h4z" /></>,
  chart: <><line x1="3" y1="13" x2="3" y2="8" /><line x1="8" y1="13" x2="8" y2="4" /><line x1="13" y1="13" x2="13" y2="6" /><line x1="2" y1="13" x2="14" y2="13" /></>,
  printer: <><path d="M4.5 6V2.5h7V6" /><rect x="2.5" y="6" width="11" height="5" /><path d="M4.5 11v2.5h7V11" /></>,
  download: <><line x1="8" y1="2.5" x2="8" y2="10" /><polyline points="5,7 8,10 11,7" /><line x1="3" y1="13" x2="13" y2="13" /></>,
  crosshair: <><circle cx="8" cy="8" r="3.6" /><line x1="8" y1="1" x2="8" y2="4" /><line x1="8" y1="12" x2="8" y2="15" /><line x1="1" y1="8" x2="4" y2="8" /><line x1="12" y1="8" x2="15" y2="8" /></>,
  anchor: <><circle cx="8" cy="3" r="1.4" /><line x1="8" y1="4.4" x2="8" y2="13" /><line x1="4.5" y1="7" x2="11.5" y2="7" /><path d="M2.5 10.5c.7 2 2.8 3.2 5.5 3.2s4.8-1.2 5.5-3.2" /></>,
  "crossed-sabres": <><path d="M2.5 2.5l8 8" /><path d="M13.5 2.5l-8 8" /><path d="M2 9.5l3-1 1 3-3 1z" /><path d="M14 9.5l-3-1-1 3 3 1z" /></>,
  "seal-decision": <><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2" /></>,
  star: <polygon points="8,1.5 9.8,6 14.5,6 10.7,8.8 12.2,13.5 8,10.6 3.8,13.5 5.3,8.8 1.5,6 6.2,6" />,
  "laurel-goal": <><path d="M4 13.5c-1.5-3 0-7 4-11.5" /><path d="M12 13.5c1.5-3 0-7-4-11.5" /><line x1="8" y1="4" x2="8" y2="14" /></>,
  fort: <><path d="M2.5 13.5V5.5l2-1.5V2.5h2V4l2-1 2 1V2.5h2V4l2 1.5v8z" /><line x1="2.5" y1="10" x2="13.5" y2="10" /></>,
  trench: <><path d="M2 5.5h4v5H2z" /><path d="M10 5.5h4v5h-4z" /><line x1="6" y1="8" x2="10" y2="8" /></>,
  rail: <><line x1="2.5" y1="4" x2="13.5" y2="4" /><line x1="2.5" y1="12" x2="13.5" y2="12" /><line x1="5" y1="2.5" x2="5" y2="13.5" /><line x1="8" y1="2.5" x2="8" y2="13.5" /><line x1="11" y1="2.5" x2="11" y2="13.5" /></>,
  "arrow-right": <><line x1="2.5" y1="8" x2="13" y2="8" /><polyline points="9,4 13,8 9,12" /></>,
  bot: <><rect x="3" y="5" width="10" height="7" rx="1" /><line x1="8" y1="2.5" x2="8" y2="5" /><circle cx="8" cy="2" r=".8" /><line x1="6" y1="8.5" x2="6" y2="9.5" /><line x1="10" y1="8.5" x2="10" y2="9.5" /><line x1="2" y1="8" x2="3" y2="8" /><line x1="13" y1="8" x2="14" y2="8" /></>,
  lock: <><rect x="3.5" y="7" width="9" height="6.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></>,
  "warning-triangle": <><path d="M8 2.5l6 11H2z" /><line x1="8" y1="6" x2="8" y2="9.5" /><line x1="8" y1="11.2" x2="8" y2="11.4" /></>,
  "info-circle": <><circle cx="8" cy="8" r="6" /><line x1="8" y1="7" x2="8" y2="11.5" /><line x1="8" y1="4.5" x2="8" y2="4.7" /></>,
};

export const Icon = ({name, size = 16, className = ""}: IconProps): JSX.Element => (
  <svg
    className={`ie-icon ${className}`.trim()}
    data-icon={name}
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="square"
    strokeLinejoin="miter"
    aria-hidden="true"
    focusable="false"
  >
    {paths[name]}
  </svg>
);

/** True when the name is part of the published inventory (§7.2). */
export const isIconName = (value: string): value is IconName =>
  Object.prototype.hasOwnProperty.call(paths, value);
