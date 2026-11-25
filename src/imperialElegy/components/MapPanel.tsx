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
import {ImperialElegyState, Power, SpaceId} from "../types";
import {SPACES, spaceLabel} from "../constant/spaces";
import {POWER_DEFS} from "../constant/powers";
import {IEMap, type MapFrameRequest, type MapTarget} from "./map";
import {SpacePicker} from "./SpacePicker";
import {ieT} from "./i18n";
import {bi} from "./boardHelpers";
import {Icon} from "./Icon";
import {MapLegend} from "./MapLegend";
import {spaceFlashpointNames} from "./flashpointHints";
import {MAP_SECTIONS, MapSectionId, THEATRES, mapSectionById} from "./map-geometry";
import type {MapViewMode} from "./preferences";
import type {TableArt} from "./table3d/camera";

// three.js only ever loads with the 3D table: the sheet path, the Jest suites
// and an SSR render never touch the renderer's 600 KB.
const TableMap = React.lazy(() => import("./table3d/TableMap"));

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
  /** The seat on this board, so the map opens on its capital. */
  viewer?: Power | null;
  /** The map's presentation; `sheet` unless the reader opted into the table. */
  view?: MapViewMode;
  /** The table's material. */
  art?: TableArt;
  onViewChange?: (view: MapViewMode) => void;
  onArtChange?: (art: TableArt) => void;
  /** Opens the reference drawer at the flashpoint chart. */
  onOpenReference?: (anchor: string) => void;
}

export const MapPanel = ({
  G, selected, onSelect, targets, focusedTarget = null, locale, t, mapHint, modePill = null,
  focus = null, onFindSpace, viewer = null,
  view = "sheet", art = "felt", onViewChange, onArtChange, onOpenReference,
}: MapPanelProps) => {
  // The printed map is 6693 board units wide, which is four pixels per space on
  // a phone, so the map opens on the player's own capital and every theatre of
  // the war is one press away instead of starting on an illegible world view.
  const capital = (viewer !== null ? POWER_DEFS[viewer]?.capital : undefined) as SpaceId | undefined;
  const [theatre, setTheatre] = React.useState("capital");
  // The atlas is split into three playable sheets.  `null` is the whole
  // printed board, which the existing "Whole map" chip still offers.
  const [section, setSection] = React.useState<MapSectionId | null>(null);
  const sectionBox = section === null ? null : mapSectionById(section)?.box ?? null;
  const [frame, setFrame] = React.useState<MapFrameRequest | null>(null);
  const frameTheatre = React.useCallback((id: string) => {
    setSection(null);
    setTheatre(id);
    setFrame({kind: id === "all" ? "fit" : "theatre", theatre: id, nonce: Date.now()});
  }, []);
  const frameSection = React.useCallback((id: MapSectionId) => {
    setSection(id);
    setTheatre("section");
    // The frame request is the same "fit" the whole-map chip uses, but the
    // cropped viewBox makes it fill the panel with this sheet.
    setFrame({kind: "fit", nonce: Date.now()});
  }, []);
  const frameCapital = React.useCallback(() => {
    setSection(null);
    setTheatre("capital");
    setFrame({kind: "capital", space: capital, nonce: Date.now()});
  }, [capital]);
  const [showPicker, setShowPicker] = React.useState(false);
  // A browser without WebGL gets the sheet, with a note, instead of a blank
  // map: a renderer must never cost a player their turn.
  const [rendererUnavailable, setRendererUnavailable] = React.useState(false);
  React.useEffect(() => {
    if (view === "table") setRendererUnavailable(false);
  }, [view]);
  const showTable = view === "table" && !rendererUnavailable;
  const [search, setSearch] = React.useState("");
  const [localFocus, setLocalFocus] = React.useState<{x: number; y: number; nonce: number} | null>(null);
  // The map owns its roving keyboard focus; lift the focused target here so the
  // space card can name it (the map draws the brighter ring itself).
  const [keyboardFocus, setKeyboardFocus] = React.useState<SpaceId | null>(null);

  const focusSpace = React.useCallback((id: SpaceId) => {
    const space = SPACES[id];
    if (!space) return;
    // Keep the split atlas on the sheet that contains the space being found:
    // a search result in India should not leave the player on the Europe crop.
    setSection(space.region === "africa" ? "africa"
      : space.region === "asia" || space.region === "pacific" ? "asia" : "europeAmerica");
    setLocalFocus({x: space.x, y: space.y, nonce: Date.now()});
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

        {showTable ? (
          <React.Suspense fallback={(
            <div className="ie-table-3d-loading" data-testid="ie-table-3d-suspense" role="status">
              {bi(locale, "Laying the table…", "正在铺开桌面…")}
            </div>
          )}>
            <TableMap
              G={G}
              selected={selected}
              onSelect={onSelect}
              targets={targets}
              locale={locale}
              t={t}
              focusedTarget={focusedTarget}
              onFocusTarget={setKeyboardFocus}
              focus={focus ?? localFocus}
              frame={frame}
              homeCapital={capital ?? null}
              section={sectionBox}
              art={art}
              onUnavailable={() => setRendererUnavailable(true)}
            />
          </React.Suspense>
        ) : (
          <IEMap
            G={G}
            selected={selected}
            onSelect={onSelect}
            locale={locale}
            targets={targets}
            emphasis={focusedTarget}
            onFocusTarget={setKeyboardFocus}
            focus={focus ?? localFocus}
            frame={frame}
            homeCapital={capital ?? null}
            section={sectionBox}
          />
        )}

        {view === "table" && rendererUnavailable && (
          <div className="ie-table-3d-fallback" data-testid="ie-table-3d-fallback" role="status">
            {bi(locale, "This browser has no WebGL, so the printed sheet is shown instead.", "此浏览器不支持 WebGL，已改为显示平面图。")}
          </div>
        )}

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
              defaultOpen
            />
          </div>
        )}

        <div className="ie-map-views" data-testid="ie-map-views" role="group"
          aria-label={bi(locale, "Map framing", "地图取景")}>
          <div className="ie-map-view-mode" role="group"
            aria-label={bi(locale, "Map presentation", "地图视图")}>
            <button
              type="button"
              className={`ie-view-chip${!showTable ? " selected" : ""}`}
              data-testid="ie-map-view-sheet"
              aria-pressed={!showTable}
              title={bi(locale, "The printed sheet, as specified by One Sheet", "单页纸面（One Sheet 规范）")}
              onClick={() => onViewChange?.("sheet")}
            >
              {bi(locale, "Sheet", "平面图")}
            </button>
            <button
              type="button"
              className={`ie-view-chip${showTable ? " selected" : ""}`}
              data-testid="ie-map-view-table"
              aria-pressed={showTable}
              title={bi(locale, "The board as a 3D table with counters standing on it", "把棋盘当作 3D 桌面，计数器立在桌上")}
              onClick={() => onViewChange?.("table")}
            >
              3D
            </button>
          </div>
          {showTable && (
            <div className="ie-map-view-mode" role="group"
              aria-label={bi(locale, "Table material", "桌面材质")}>
              <button
                type="button"
                className={`ie-view-chip${art === "felt" ? " selected" : ""}`}
                data-testid="ie-table-art-felt"
                aria-pressed={art === "felt"}
                title={bi(locale, "Felt table under a warm lamp", "台灯下的绒布桌面")}
                onClick={() => onArtChange?.("felt")}
              >
                {bi(locale, "Felt", "绒布")}
              </button>
              <button
                type="button"
                className={`ie-view-chip${art === "paper" ? " selected" : ""}`}
                data-testid="ie-table-art-paper"
                aria-pressed={art === "paper"}
                title={bi(locale, "Plain paper ground, the One Sheet palette", "纸面色底（沿用 One Sheet 配色）")}
                onClick={() => onArtChange?.("paper")}
              >
                {bi(locale, "Paper", "纸面")}
              </button>
            </div>
          )}
          <div className="ie-map-sections" role="tablist"
            aria-label={bi(locale, "Atlas sheets", "地图分册")}>
            {MAP_SECTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                className={`ie-view-chip ie-map-section-chip${section === option.id ? " selected" : ""}`}
                data-testid={`ie-map-section-${option.id}`}
                aria-selected={section === option.id}
                onClick={() => frameSection(option.id)}
              >
                {locale === "zh_CN" ? option.labelZh : option.labelEn}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`ie-view-chip${theatre === "all" ? " selected" : ""}`}
            data-testid="ie-map-fit"
            aria-pressed={theatre === "all"}
            onClick={() => frameTheatre("all")}
          >
            {bi(locale, "Whole map", "全图")}
          </button>
          <button
            type="button"
            className={`ie-view-chip${theatre === "capital" ? " selected" : ""}`}
            data-testid="ie-map-capital"
            aria-pressed={theatre === "capital"}
            title={capital ? spaceLabel(capital, locale) : undefined}
            onClick={frameCapital}
          >
            {bi(locale, "Capital", "首都")}
          </button>
          <a
            className="ie-view-chip ie-view-board"
            data-testid="ie-map-printed-board"
            href="/board/imperialElegy"
            target="_blank"
            rel="noreferrer"
            title={bi(locale, "Open the printed board as one vector sheet", "打开 1:1 印刷版图（矢量单页）")}
          >
            {bi(locale, "Printed board", "印刷版图")}
          </a>
          <select
            className="ie-select ie-view-select"
            data-testid="ie-map-theatre"
            aria-label={bi(locale, "Theatre", "战区")}
            value={theatre}
            onChange={(event) => frameTheatre(event.target.value)}
          >
            {/* "Whole map" and "Capital" are the two chips beside this list, so
                neither is repeated as a visible option. */}
            <option value="capital" hidden>{bi(locale, "Capital", "首都")}</option>
            {THEATRES.filter((option) => option.id !== "all").map((option) => (
              <option key={option.id} value={option.id}>
                {locale === "zh_CN" ? option.labelZh : option.labelEn}
              </option>
            ))}
            <option value="all" hidden>{bi(locale, "Whole map", "全图")}</option>
          </select>
          {/* The find control belongs to the framing bar: it was a bare
              <button> in the stage's flow, so the stage's `overflow: hidden`
              clipped it at every width and the space picker could not be opened
              at all.  A phone shows the icon alone (the label is 4 CJK glyphs). */}
          <button
            type="button"
            className={`ie-view-chip ie-view-find${showPicker ? " selected" : ""}`}
            data-testid="ie-map-find"
            aria-label={bi(locale, "Find space", "查找空间")}
            aria-expanded={showPicker ? "true" : "false"}
            aria-controls="ie-picker-panel"
            title={bi(locale, "Find a space by name", "按名称查找地点")}
            onClick={togglePicker}
          >
            <Icon name="search" size={16}/>
            <span className="ie-view-find-label">{bi(locale, "Find space", "查找空间")}</span>
          </button>
        </div>
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
              {spaceFlashpointNames(cardSpace!, locale).length > 0 && (
                <span className="ie-space-card-line" data-testid="ie-space-card-flashpoints">
                  {bi(locale, "Flashpoint", "闪点")}: {spaceFlashpointNames(cardSpace!, locale).join(" · ")}
                </span>
              )}
              {selection !== t.selectSpace && <span className="ie-space-card-hint">{mapHint}</span>}
            </>
          )}
        </div>

        {/* The key, and nothing else: the map draws its own colour legend —
            the same six powers plus the neutral dot, with the one-line gesture
            help above them — inside `.ie-map-wrap`.  Repeating it here printed
            the identical key a second time right under it (and cost a phone
            29 px of map height). */}
        <MapLegend locale={locale} counts={counts} onOpenReference={onOpenReference}/>
      </footer>
    </section>
  );
};
