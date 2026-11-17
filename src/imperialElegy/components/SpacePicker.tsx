import React from "react";
import {ImperialElegyState, Power, SpaceId} from "../types";
import {spaceLabel} from "../constant/spaces";
import {ieStringsFor, ieT} from "./i18n";
import {bi} from "./boardHelpers";
import {PICKER_REGIONS, filterSpaces} from "./spaceFilter";

export interface SpacePickerProps {
  G: ImperialElegyState;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  selected: SpaceId | null;
  /** Spaces the current decision or selected unit can actually act on. */
  targets: SpaceId[];
  search: string;
  setSearch: (value: string) => void;
  onChoose: (id: SpaceId) => void;
  /** Centre the map on a space without selecting it. */
  onFocus: (id: SpaceId) => void;
}

const REGION_LABEL: Record<string, {en: string; zh: string}> = {
  all: {en: "All", zh: "全部"},
  europe: {en: "Europe", zh: "欧洲"},
  africa: {en: "Africa", zh: "非洲"},
  asia: {en: "Asia", zh: "亚洲"},
  northAmerica: {en: "North America", zh: "北美洲"},
  pacific: {en: "Pacific", zh: "太平洋"},
  naval: {en: "Sea boxes", zh: "海域"},
};

/**
 * Searchable space chooser.
 *
 * The printed board has 145 spaces.  A 145-entry `<select>` is unreadable on a
 * phone and painful on a desktop, so this picker narrows by typed text — both
 * printed languages are searched, so "柏林" and "berlin" both find Berlin — and
 * puts the spaces that are legal right now at the top.
 */
export const SpacePicker = ({
  G, locale, t, selected, targets, search, setSearch, onChoose, onFocus,
}: SpacePickerProps) => {
  const [open, setOpen] = React.useState(false);
  const [region, setRegion] = React.useState<typeof PICKER_REGIONS[number]>("all");
  const [onlyTargets, setOnlyTargets] = React.useState(false);

  const shown = React.useMemo(
    () => filterSpaces({search, region, onlyTargets, targets}, locale),
    [search, region, onlyTargets, targets, locale],
  );

  const current = selected ? spaceLabel(selected, locale) : "";

  return (
    <div className="ie-picker" data-testid="ie-space-picker">
      <div className="ie-picker-row">
        <button
          type="button"
          className="ie-picker-current"
          data-testid="ie-picker-toggle"
          aria-expanded={open}
          aria-controls="ie-picker-panel"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="ie-picker-value">{current || t.selectSpace}</span>
          <span className="ie-picker-caret" aria-hidden="true">{open ? "▲" : "▼"}</span>
        </button>
        {targets.length > 0 && (
          <button
            type="button"
            className="ie-btn secondary ie-mini"
            data-testid="ie-picker-targets-only"
            aria-pressed={onlyTargets}
            onClick={() => { setOnlyTargets((value) => !value); setOpen(true); }}
          >
            {bi(locale, `Targets (${targets.length})`, `可选目标 (${targets.length})`)}
          </button>
        )}
      </div>

      {open && (
        <div className="ie-picker-panel" id="ie-picker-panel" data-testid="ie-picker-panel">
          <input
            className="ie-input ie-picker-search"
            data-testid="ie-picker-search"
            type="search"
            autoFocus
            aria-label={bi(locale, "Search a space", "搜索地点")}
            placeholder={bi(locale, "Search a space…", "搜索地点…")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
              if (event.key === "Enter" && shown.length > 0) {
                onChoose(shown[0]);
                setOpen(false);
              }
            }}
          />
          <div className="ie-picker-regions" role="group" aria-label={bi(locale, "Filter by region", "按区域筛选")}>
            {PICKER_REGIONS.map((key) => (
              <button
                key={key}
                type="button"
                className="ie-chip"
                aria-pressed={region === key}
                onClick={() => setRegion(key)}
              >
                {bi(locale, REGION_LABEL[key].en, REGION_LABEL[key].zh)}
              </button>
            ))}
          </div>
          {/* A plain list of buttons: two independent controls per row, so a
              listbox/option model would be invalid ARIA and would promise
              arrow-key navigation this control does not implement.  Tabbing
              reaches every button; `aria-current` marks the chosen space. */}
          <ul
            className="ie-picker-list"
            data-testid="ie-picker-list"
            aria-label={bi(locale, "Spaces", "地点")}
          >
            {shown.length === 0 && (
              <li className="ie-picker-empty">{bi(locale, "No match", "没有匹配的地点")}</li>
            )}
            {shown.map((id) => {
              const state = G.spaces[id];
              const isTarget = targets.includes(id);
              const isSelected = selected === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={`ie-picker-item${isTarget ? " target" : ""}${isSelected ? " selected" : ""}`}
                    data-testid={`ie-picker-item-${id}`}
                    aria-current={isSelected ? "true" : undefined}
                    onClick={() => { onChoose(id); setOpen(false); }}
                  >
                    <span className="ie-picker-name">{spaceLabel(id, locale)}</span>
                    {isTarget && <span className="ie-picker-flag">{bi(locale, "target", "目标")}</span>}
                    <span className="ie-picker-meta">
                      {state?.control ? controlName(state.control, locale) : bi(locale, "neutral", "中立")}
                      {state && state.units.length > 0 ? ` · ${state.units.length}` : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="ie-picker-locate"
                    data-testid={`ie-picker-locate-${id}`}
                    title={bi(locale, "Show on the map", "在地图上定位")}
                    aria-label={bi(locale, `Show ${spaceLabel(id, locale)} on the map`, `在地图上定位${spaceLabel(id, locale)}`)}
                    onClick={() => { onFocus(id); setOpen(false); }}
                  >
                    ⌖
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="ie-picker-count" aria-live="polite">
            {bi(locale, `${shown.length} spaces`, `${shown.length} 个地点`)}
          </div>
        </div>
      )}
    </div>
  );
};

const controlName = (control: string, locale: "en" | "zh_CN"): string => {
  const seat = ieStringsFor(locale).seats[control as Power];
  return seat ?? control;
};
