/**
 * The War tab's trench-battle list (rule 28.1).
 *
 * The dead sideboard JPG tab is gone; the trenches are a list the reader can
 * act on instead: each row names the space, whose side the 28.1.1 marker
 * favours and both forces standing there.
 * Clicking a row focuses the space on the map (`onSelect`), which is the same
 * selection every other map control uses.
 *
 * The rows are pure data (`trenchRows.ts`); this file only renders them.
 */
import React from "react";
import type {SpaceId} from "../types";
import {spaceLabel} from "../constant/spaces";
import {bi} from "./boardHelpers";
import type {TrenchRow, TrenchSide} from "./trenchRows";

export interface TrenchBoardProps {
  rows: TrenchRow[];
  locale: "en" | "zh_CN";
  /** The space currently selected on the map, highlighted here. */
  selected?: SpaceId | null;
  /** Focus that space on the map. */
  onSelect?: (space: SpaceId) => void;
}

const STATUS_LABEL: Record<TrenchRow["status"], {en: string; zh: string}> = {
  attacker: {en: "Attacker advantage", zh: "进攻方占优"},
  deadlock: {en: "Deadlock", zh: "僵持"},
  defender: {en: "Defender advantage", zh: "防守方占优"},
};

/**
 * The marker names the side, not the power: 28.1.1 talks about "the Attacker"
 * and "the Defender" of the battle, so the row underlines the force the marker
 * favours instead of guessing which power that is.
 */
const sideLine = (side: TrenchSide, locale: "en" | "zh_CN"): string => {
  const elite = side.eliteCorps > 0
    ? ` · ${bi(locale, `${side.eliteCorps} elite`, `${side.eliteCorps} 精锐军`)}`
    : "";
  return `${bi(locale, `${side.armies} armies`, `${side.armies} 个军团`)}${elite}`;
};

export const TrenchBoard = ({rows, locale, selected = null, onSelect}: TrenchBoardProps) => {
  if (rows.length === 0) {
    return (
      <p className="ie-muted" data-testid="ie-trench-empty">
        {bi(locale, "No trench battle is marked yet.", "目前没有战壕战标记。")}
      </p>
    );
  }
  return (
    <section className="ie-trench" data-testid="ie-trench-board" aria-label={bi(locale, "Trench battles", "战壕战")}>
      <h4 className="ie-trench-title">
        {bi(locale, "Trench battles", "战壕战")}
        <span className="ie-trench-rule">28.1</span>
      </h4>
      <ul className="ie-trench-list" role="list">
        {rows.map((row) => {
          const current = row.space === selected;
          return (
            <li key={row.space} className="ie-trench-row-item">
              <button
                type="button"
                className={`ie-trench-row${current ? " selected" : ""}`}
                data-testid={`ie-trench-${row.space}`}
                data-status={row.status}
                data-current={current ? "true" : "false"}
                aria-current={current ? "true" : undefined}
                aria-label={`${spaceLabel(row.space, locale)} · ${bi(locale, STATUS_LABEL[row.status].en, STATUS_LABEL[row.status].zh)}`}
                title={bi(locale, "Show this space on the map", "在地图上显示该空间")}
                onClick={() => onSelect?.(row.space)}
              >
                <span className={`ie-trench-status ie-trench-status-${row.status}`} aria-hidden="true">
                  {row.status === "deadlock" ? "×" : row.status === "attacker" ? "→" : "←"}
                </span>
                <span className="ie-trench-space">{spaceLabel(row.space, locale)}</span>
                <span className="ie-trench-flag">{bi(locale, STATUS_LABEL[row.status].en, STATUS_LABEL[row.status].zh)}</span>
                {row.turn > 0 && <span className="ie-trench-turn">GW {row.turn}</span>}
                <span className="ie-trench-sides">
                  {row.sides.length === 0 && <span className="ie-muted">{bi(locale, "No land units", "无地面部队")}</span>}
                  {row.sides.map((side) => (
                    <span
                      key={side.power}
                      className={`ie-trench-side ie-power-pip-${side.power.toLowerCase()}`}
                      data-power={side.power}
                      data-belligerent={side.belligerent ? "true" : "false"}
                    >
                      <span className="ie-trench-power">{side.power}</span> {sideLine(side, locale)}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="ie-trench-hint">
        {bi(locale, "A row focuses its space on the map; the map's own markers still open the battle.", "点击一行会在地图上定位该空间；地图上的标记仍可开启战斗。")}
      </p>
    </section>
  );
};
