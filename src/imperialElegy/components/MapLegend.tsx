/**
 * The map's target legend, following the printed key: a ring's *shape and
 * colour* say what a click would do, before any text does.
 *
 *   move     dashed teal ring            attack  red ring with crosshair ticks
 *   choice   gold double ring with a pip  rail   teal ring with a rail tick
 *   pending  gold double ring (a decision waits on that space)
 *
 * The counts come from the marks the map is actually drawing, so the legend
 * never promises a highlight the board does not show.
 */
import React from "react";
import {bi} from "./boardHelpers";
import type {MapTarget} from "./map";

export interface MapLegendProps {
  locale: "en" | "zh_CN";
  /** How many targets of each style are on the map right now. */
  counts: Partial<Record<MapTarget["style"], number>>;
  /** Opens the reference drawer; the hatched-theatre key links to the chart. */
  onOpenReference?: (anchor: string) => void;
}

const ENTRIES: readonly {style: MapTarget["style"]; en: string; zh: string}[] = [
  {style: "move", en: "Move", zh: "移动"},
  {style: "attack", en: "Attack", zh: "进攻"},
  {style: "rail", en: "Rail only", zh: "仅铁路"},
  {style: "choice", en: "Choice", zh: "选择"},
  {style: "pending", en: "Decision", zh: "待决"},
];

/**
 * The hatch key.  The board shades its flashpoint theatres, and the shading is
 * the only cue that a space scores a flashpoint at all; without this entry the
 * reader sees a texture with no explanation.  It is a button because the chart
 * is one click away and a phone has no hover to read a title.
 */
const FlashpointKey = ({locale, onOpenReference}: Pick<MapLegendProps, "locale" | "onOpenReference">) => {
  const label = bi(locale, "Flashpoint theatre", "闪点地区");
  const title = bi(locale,
    "Hatched regions are flashpoint theatres. Controlling the most keys there gives a card bonus; the chart lists every theatre and reward.",
    "斜纹地区为闪点地区：控制最多关键区者可获得抽牌奖励；图表列出每个闪点与奖励。");
  const body = (
    <>
      <svg className="ie-key-hatch" width="12" height="10" viewBox="0 0 12 10" aria-hidden="true">
        <rect x="0.5" y="0.5" width="11" height="9" fill="none" stroke="currentColor" strokeWidth="1"/>
        <path d="M1 9 L9 1 M4 10 L12 2" stroke="currentColor" strokeWidth="1"/>
      </svg>
      <span>{label}</span>
    </>
  );
  return onOpenReference === undefined ? (
    <span className="ie-key ie-key-flashpoint" data-testid="ie-key-flashpoint" title={title}>{body}</span>
  ) : (
    <button
      type="button"
      className="ie-key ie-key-flashpoint"
      data-testid="ie-key-flashpoint"
      title={title}
      aria-label={bi(locale, "Open the flashpoint chart", "打开闪点图表")}
      onClick={() => onOpenReference("chart:map-flashpoints")}
    >
      {body}
    </button>
  );
};

export const MapLegend = ({locale, counts, onOpenReference}: MapLegendProps) => {
  const shown = ENTRIES.filter((entry) => (counts[entry.style] ?? 0) > 0);
  return (
    <div
      id="ie-map-legend"
      className="ie-map-key"
      data-testid="ie-map-legend"
      role="group"
      aria-label={bi(locale, "Map key", "地图图例")}
    >
      {(shown.length > 0 ? shown : ENTRIES.slice(0, 3)).map((entry) => (
        <span
          key={entry.style}
          className={`ie-key ${entry.style}`}
          data-testid={`ie-key-${entry.style}`}
          data-style={entry.style}
        >
          {locale === "zh_CN" ? entry.zh : entry.en}
          {(counts[entry.style] ?? 0) > 0 && <b className="ie-key-count">{counts[entry.style]}</b>}
        </span>
      ))}
      <FlashpointKey locale={locale} onOpenReference={onOpenReference}/>
    </div>
  );
};
