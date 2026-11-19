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
}

const ENTRIES: readonly {style: MapTarget["style"]; en: string; zh: string}[] = [
  {style: "move", en: "Move", zh: "移动"},
  {style: "attack", en: "Attack", zh: "进攻"},
  {style: "rail", en: "Rail only", zh: "仅铁路"},
  {style: "choice", en: "Choice", zh: "选择"},
  {style: "pending", en: "Decision", zh: "待决"},
];

export const MapLegend = ({locale, counts}: MapLegendProps) => {
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
    </div>
  );
};
