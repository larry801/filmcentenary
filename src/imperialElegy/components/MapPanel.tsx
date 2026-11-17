/**
 * The map south edge: an honest, non-interactive space card, the zoom/fit
 * buttons and the printed-legend key for the target rings.
 *
 * It replaced the floating parchment overlay and the old board tabs.  The card
 * follows `pointer-events: none` so a click that lands on it reaches the map
 * underneath, and it never covers a target: the turn panel owns the
 * interactions now.
 */
import React from "react";
import {ImperialElegyState, SpaceId} from "../types";
import {SPACES, spaceLabel} from "../constant/spaces";
import {IEMap, type MapTarget} from "./map";
import {SpacePicker} from "./SpacePicker";
import {ieT} from "./i18n";
import {bi} from "./boardHelpers";
import {MapLegend} from "./MapLegend";

export interface MapPanelProps {
  G: ImperialElegyState;
  selected: SpaceId | null;
  onSelect: (id: SpaceId) => void;
  /** The map's own click state, already resolved into typed targets. */
  targets: MapTarget[];
  /** The space highlighted by keyboard focus (a legal target). */
  focusedTarget?: SpaceId | null;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  mapHint: string;
  modePill?: {
    label: string;
    from: string;
    count: number;
    cancelLabel: string;
    onCancel: () => void;
    targets?: {id: SpaceId; label: string}[];
    onChoose?: (id: SpaceId) => void;
  } | null;
  /** Bring a board point into view (the space picker and the War tab). */
  focus?: {x: number; y: number; nonce: number} | null;
  onFindSpace?: (open: boolean) => void;
}

export const MapPanel = ({
  G, selected, onSelect, targets, focusedTarget = null, locale, t, mapHint, modePill = null,
  focus = null, onFindSpace,
}: MapPanelProps) => {
  const [showPicker, setShowPicker] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [localFocus, setLocalFocus] = React.useState<{x: number; y: number; nonce: number} | null>(null);
  // The map owns its roving keyboard focus; lift the focused target here so the
  // space card can name it (the map draws the brighter ring itself).
  const [keyboardFocus, setKeyboardFocus] = React.useState<SpaceId | null>(null);

  const focusSpace = React.useCallback((id: SpaceId) => {
    const space = SPACES[id];
    if (space) setLocalFocus({x: space.x, y: space.y, nonce: Date.now()});
  }, []);
  const choose = React.useCallback((id: SpaceId) => {
    onSelect(id);
    focusSpace(id);
  }, [onSelect, focusSpace]);

  const targetIds = targets.map((target) => target.id);
  const shownFocus = focusedTarget ?? keyboardFocus;
  // The tag may only claim a ring the map is actually drawing.
  const shownFocusIsTarget = shownFocus !== null && targets.some((target) => target.id === shownFocus);
  // While a target is focused the card follows the focus, not the targeting
  // origin: it must never name Berlin while the tag says the focus is Prussia.
  // When the ring set clears (and the focus is dropped) it reverts to `selected`.
  const cardSpace = shownFocus ?? selected;
  const selection = cardSpace ? spaceLabel(cardSpace, locale) : t.selectSpace;
  const spaceDef = cardSpace ? SPACES[cardSpace] : null;
  const spaceState = cardSpace ? G.spaces[cardSpace] : null;
  const counts = targets.reduce((acc, target) => ({...acc, [target.style]: (acc[target.style] ?? 0) + 1}), {} as Record<string, number>);
  // A ring set that changes invalidates the old keyboard focus; the map's own
  // `styleOf.has` guard already stops drawing it, and this stops the space card
  // naming a space that is no longer a target.
  React.useEffect(() => setKeyboardFocus(null), [targetIds.join(",")]);

  const togglePicker = () => {
    setShowPicker((open) => {
      onFindSpace?.(!open);
      return !open;
    });
  };

  return (
    <section className="ie-map-panel" data-testid="ie-map-panel" aria-label={t.map}>
      <div className="ie-map-stage">
        {modePill !== null && (
          <div className="ie-mode-pill" role="status" aria-live="polite" data-testid="ie-mode-pill">
            <span className="ie-mode-pill-label">{modePill.label}</span>
            <span className="ie-mode-pill-from">{modePill.from}</span>
            <span className="ie-mode-pill-arrow" aria-hidden="true">→</span>
            <span className="ie-mode-pill-count">
              {bi(locale, `${modePill.count} legal targets`, `${modePill.count} 个合法目标`)}
            </span>
            {modePill.targets !== undefined && modePill.targets.length > 0 && modePill.onChoose !== undefined && (
              <select
                className="ie-mode-pill-targets"
                data-testid="ie-mode-pill-targets"
                aria-label={bi(locale, "Legal targets", "合法目标")}
                value=""
                onChange={(event) => {
                  const id = event.target.value;
                  if (id !== "") modePill.onChoose?.(id as SpaceId);
                }}
              >
                <option value="">{bi(locale, "Choose target", "选择目标")}</option>
                {modePill.targets.map((target) => (
                  <option key={target.id} value={target.id}>{target.label}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="ie-mode-pill-cancel"
              data-testid="ie-mode-pill-cancel"
              onClick={modePill.onCancel}
              title={bi(locale, "Cancel (Esc)", "取消（Esc）")}
            >
              {modePill.cancelLabel} <span className="ie-mode-pill-esc" aria-hidden="true">Esc</span>
            </button>
          </div>
        )}

        <IEMap
          G={G}
          selected={selected}
          onSelect={onSelect}
          locale={locale}
          targets={targets}
          emphasis={focusedTarget}
          onFocusTarget={setKeyboardFocus}
          focus={focus ?? localFocus}
        />

        {showPicker && (
          <div className="ie-map-picker-slot">
            <SpacePicker
              G={G}
              locale={locale}
              t={t}
              selected={selected}
              targets={targetIds}
              search={search}
              setSearch={setSearch}
              onChoose={choose}
              onFocus={focusSpace}
            />
          </div>
        )}

        <button
          type="button"
          className="ie-map-find"
          data-testid="ie-map-find"
          aria-expanded={showPicker ? "true" : "false"}
          onClick={togglePicker}
        >
          {bi(locale, "Find space", "查找空间")}
        </button>
      </div>

      <footer className="ie-map-footer">
        <div className="ie-space-card" data-testid="ie-space-card" aria-live="polite">
          {!spaceDef || !spaceState ? (
            <span className="ie-muted">{t.noSpace}</span>
          ) : (
            <>
              <span className="ie-space-card-title">
                {locale === "zh_CN" ? spaceDef.nameZh : spaceDef.name}
              </span>
              {shownFocusIsTarget && (
                <span className="ie-space-card-tag" data-testid="ie-space-card-tag">
                  {bi(locale, "focused target", "聚焦目标")}
                </span>
              )}
              <span className="ie-space-card-line">
                {t.units}: {spaceState.units.length === 0 ? "—" : spaceState.units.length}
                {" · "}{t.fort}: {spaceState.fort ? `${spaceState.fort.level}` : "—"}
                {" · "}{t.pacification}: {spaceState.pacification ?? 0}
                {spaceState.trench ? ` · ${bi(locale, "trench", "战壕")}` : ""}
              </span>
              {selection !== t.selectSpace && <span className="ie-space-card-hint">{mapHint}</span>}
            </>
          )}
        </div>

        <MapLegend locale={locale} counts={counts}/>

        <div className="ie-map-legend">
          {(["GE", "UK", "FR", "AU", "RU", "OT"] as const).map((power) => (
            <span key={power}><i className={`ie-map-legend-dot ie-map-legend-dot-${power.toLowerCase()}`}/>{t.seats[power]}</span>
          ))}
          <span><i className="ie-map-legend-dot ie-map-legend-dot-neutral"/>{t.neutral}</span>
        </div>
      </footer>
    </section>
  );
};
