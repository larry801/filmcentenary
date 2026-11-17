/**
 * The reference, as a lightbox: one printed chart, full screen.
 *
 * The nine published charts are PNGs, so opening one is an image with a
 * close button and a zoom hint; the inline tables (CRT, costs, sequence of
 * play) are rendered as markup and addressable by anchor, which is what the
 * track strip, the mat and the "?" controls link to.
 *
 * Focus is trapped while open, Esc closes, and the scroll position returns to
 * the page underneath.
 */
import React from "react";
import {Power} from "../types";
import {POWER_DEFS} from "../constant/powers";
import {bi} from "./boardHelpers";
import {useFocusTrap} from "./useFocusTrap";

export interface ChartEntry {
  id: string;
  /** File under `public/imperial-elegy/charts/` (without extension). */
  file: string;
  title: string;
  titleZh: string;
  /**
   * Full published path, for the entries that are not one of the nine charts —
   * the six player displays live under `displays/` and keep their own
   * extension (the module publishes the UK board as a PNG).
   */
  src?: string;
}

export const CHARTS: readonly ChartEntry[] = [
  {id: "map-flashpoints", file: "map-flashpoints", title: "Flashpoints", titleZh: "闪点地区"},
  {id: "combat-crt", file: "combat-crt", title: "Combat Results Table", titleZh: "战斗结果表"},
  {id: "colonial-great-wars", file: "colonial-great-wars", title: "Colonial & Great Wars", titleZh: "殖民战争与大战"},
  {id: "war-aims-minors", file: "war-aims-minors", title: "War Aims & Minors", titleZh: "战争目标与小国"},
  {id: "crisis", file: "crisis", title: "Crisis Table", titleZh: "危机表"},
  {id: "influence-track", file: "influence-track", title: "Player Display", titleZh: "玩家面板"},
  {id: "italy-legend", file: "italy-legend", title: "Italy & Legend", titleZh: "意大利与图例"},
  {id: "sequence-of-play", file: "sequence-of-play", title: "Sequence of Play", titleZh: "游戏流程"},
  {id: "counter-count", file: "counter-count", title: "Counter Count", titleZh: "单位数量"},
];

export const chartById = (id: string): ChartEntry | undefined => CHARTS.find((chart) => chart.id === id);

/** A chart's public URL; the PNGs live under the published asset root. */
export const chartSrc = (entry: ChartEntry): string => entry.src ?? `/imperial-elegy/charts/${entry.file}.png`;

/**
 * The printed player display of one power, as a chart entry.
 *
 * `displays/` carries the six board images the tracks and printed values are
 * transcribed from; the mat's "Printed display" opens the viewer's own board
 * rather than the influence track, which is a different chart.
 */
export const PLAYER_DISPLAY_EXT: Record<Power, "jpg" | "png"> = {
  GE: "jpg",
  UK: "png",
  FR: "jpg",
  AU: "jpg",
  RU: "jpg",
  OT: "jpg",
};

export const playerDisplayChart = (power: Power, locale: "en" | "zh_CN"): ChartEntry => ({
  id: `display-${power.toLowerCase()}`,
  file: `display-${power.toLowerCase()}`,
  title: `Player display: ${POWER_DEFS[power].name}`,
  titleZh: `玩家面板：${POWER_DEFS[power].nameZh}`,
  src: `/imperial-elegy/displays/${power}.${PLAYER_DISPLAY_EXT[power]}`,
});

/** The anchor the mat's "Printed display" button opens for one power. */
export const displayAnchor = (power: Power): string => `display:${power}`;

/**
 * The power a `display:<POWER>` anchor names, or null for any other anchor.
 * Kept next to `displayAnchor` so the two halves of the contract sit together.
 */
export const displayAnchorPower = (anchor: string): Power | null => {
  const match = /^display:(GE|UK|FR|AU|RU|OT)$/.exec(anchor);
  return match === null ? null : (match[1] as Power);
};

export interface ChartLightboxProps {
  chart: ChartEntry;
  locale: "en" | "zh_CN";
  onClose: () => void;
  onZoom?: () => void;
}

export const ChartLightbox = ({chart, locale, onClose, onZoom}: ChartLightboxProps) => {
  const closeRef = React.useRef<HTMLButtonElement | null>(null);
  const title = locale === "zh_CN" ? chart.titleZh : chart.title;
  // Focus moves into the dialog and stays there: Esc closes it, Tab cycles its
  // controls, and focus returns to whatever opened the chart.
  const dialogRef = useFocusTrap<HTMLDivElement>({active: true, onEscape: onClose});

  return (
    <div
      ref={dialogRef}
      className="ie-lightbox"
      data-testid="ie-chart-lightbox"
      data-chart={chart.id}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="ie-lightbox-bar">
        <h2 className="ie-lightbox-title">{title}</h2>
        <span className="ie-muted">{bi(locale, "Printed chart · Esc closes", "印刷图表 · Esc 关闭")}</span>
        <button
          ref={closeRef}
          type="button"
          className="ie-btn secondary"
          data-testid="ie-chart-close"
          onClick={onClose}
          aria-label={bi(locale, "Close the chart", "关闭图表")}
          title={bi(locale, "Close (Esc)", "关闭（Esc）")}
        >
          ✕
        </button>
      </div>
      <div className="ie-lightbox-stage" onClick={onClose}>
        <img
          className="ie-lightbox-image"
          src={chartSrc(chart)}
          alt={title}
          data-testid="ie-chart-image"
          onClick={(event) => {
            event.stopPropagation();
            onZoom?.();
          }}
        />
      </div>
    </div>
  );
};
