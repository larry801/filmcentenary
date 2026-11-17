/**
 * A printed-style unit counter, drawn as SVG for the map's token layer.
 *
 * Anatomy follows the printed counters: a large square for an army (a bold "R"
 * for a reserve army), a circle for an Elite Corps, a small square for an
 * Expeditionary Force, a ship hull for squadrons and dreadnoughts, and a
 * hexagon for a fort.  The owner's colour fills the counter, a dark ink outline
 * frames it, and a reduced counter carries the printed diagonal band.
 *
 * Everything is positioned with SVG attributes (`x`, `y`, `r`, `points`) in a
 * 20 x 20 unit box that is scaled to `size`, so the component needs no CSS
 * inside the SVG and stays sharp at any zoom.
 */
import type {JSX} from "react";
import type {Power, UnitKind} from "../types";
import {bi} from "./boardHelpers";
import {tokenKindOf} from "./stackSummary";

export interface UnitTokenProps {
  kind: UnitKind;
  power: Power;
  reduced: boolean;
  /** Side length in board units. */
  size: number;
  locale: "en" | "zh_CN";
  testId?: string;
  /** True when a popover or label already names the counter; hides it from AT. */
  decorative?: boolean;
}

/** The 20-unit design box every counter is drawn in. */
const BOX = 20;
const CENTRE = BOX / 2;

const kindLong = (locale: "en" | "zh_CN", kind: UnitKind): string => {
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

/** Hexagon around the centre of the design box, flat side down. */
const HEX_POINTS = Array.from({length: 6}, (_, i) => {
  const angle = (Math.PI / 3) * i - Math.PI / 2;
  const r = 9;
  return `${(CENTRE + Math.cos(angle) * r).toFixed(2)},${(CENTRE + Math.sin(angle) * r).toFixed(2)}`;
}).join(" ");

/** A simple ship silhouette: the hull, plus a deck line and a funnel. */
const HULL_POINTS = "1,11 19,11 14.5,16 5.5,16";

/** A scrub band across the counter, drawn inside the shape. */
const ReductionBand = ({r}: {r: number}) => (
  <line className="ie-unit-token-reduced" x1={CENTRE - r * 0.9} y1={CENTRE + r * 0.9}
    x2={CENTRE + r * 0.9} y2={CENTRE - r * 0.9} strokeWidth={1.1} vectorEffect="non-scaling-stroke"/>
);

export const UnitToken = ({kind, power, reduced, size, locale, testId, decorative = false}: UnitTokenProps): JSX.Element => {
  // The shape comes from `tokenKindOf` so the map and the token never disagree
  // about which counter is a square and which is a hull.
  const shape = tokenKindOf(kind);
  const label = `${powerName(locale, power)} ${kindLong(locale, kind)}${reduced ? bi(locale, " · reduced", " · 受损") : ""}`;
  const common = {
    className: `ie-unit-token ie-unit-token-${shape} ie-power-pip-${power.toLowerCase()}${reduced ? " is-reduced" : ""}`,
    width: size,
    height: size,
    viewBox: `0 0 ${BOX} ${BOX}`,
    "data-testid": testId,
    "data-power": power,
    "data-kind": kind,
    "data-reduced": reduced ? "true" : "false",
    role: "img",
    "aria-label": label,
  } as const;
  // A counter the popover already names is decorative: it keeps `role="img"`
  // but is hidden from assistive tech, so a stack is announced once, not
  // once per counter.
  const {role: _role, "aria-label": _label, ...frame} = common;
  void _role;
  void _label;
  const a11y = decorative ? {"aria-hidden": true as const} : {role: common.role, "aria-label": label};

  return (
    <svg {...frame} {...a11y} focusable="false">
      {shape === "army" && (
        <rect x={1} y={1} width={BOX - 2} height={BOX - 2} rx={1.5}/>
      )}
      {shape === "elite" && <circle cx={CENTRE} cy={CENTRE} r={9}/>}
      {shape === "ef" && <rect x={4} y={4} width={BOX - 8} height={BOX - 8} rx={1}/>}
      {shape === "fort" && <polygon points={HEX_POINTS}/>}
      {shape === "ship" && (
        <>
          <polygon points={HULL_POINTS}/>
          <rect className="ie-unit-token-deck" x={8} y={5} width={4} height={5}/>
          <line className="ie-unit-token-deck" x1={3} y1={11} x2={17} y2={11} strokeWidth={0.8}
            vectorEffect="non-scaling-stroke"/>
        </>
      )}
      {kind === "reserveArmy" && (
        <text className="ie-unit-token-mark" x={CENTRE} y={CENTRE + 3.4} textAnchor="middle" fontSize={11}
          fontWeight={700}>R</text>
      )}
      {reduced && <ReductionBand r={shape === "ef" ? 5 : shape === "ship" ? 6 : 8.4}/>}
    </svg>
  );
};
