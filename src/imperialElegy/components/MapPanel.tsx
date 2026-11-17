import React from "react";
import {ImperialElegyState, Power, SpaceId} from "../types";
import {SPACES, spaceLabel} from "../constant/spaces";
import {POWER_DEFS} from "../constant/powers";
import {IEPanel} from "./theme";
import {IEMap, MapFrameRequest} from "./map";
import {SpacePicker} from "./SpacePicker";
import {ieT} from "./i18n";
import {bi} from "./boardHelpers";
import {THEATRES} from "./map-geometry";

export interface MapPanelProps {
  G: ImperialElegyState;
  selected: SpaceId | null;
  onSelect: (id: SpaceId) => void;
  board: "world" | "greatWar";
  setBoard: (b: "world" | "greatWar") => void;
  pendingSpaceTargets: SpaceId[];
  unitMoveTargets: SpaceId[];
  battleTargets: SpaceId[];
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  mapHint: string;
  /** The seat shown on this board, used to open the map on its capital. */
  viewer?: Power | null;
  /** Explicit targeting banner shown over the map (battle, boarding, …). */
  modePill?: {
    label: string;
    from: string;
    count: number;
    cancelLabel: string;
    onCancel: () => void;
    /** Keyboard-reachable target list (Tab to it, choose, submit). */
    targets?: {id: SpaceId; label: string}[];
    onChoose?: (id: SpaceId) => void;
  } | null;
  /** Floating space card slot, bottom-left of the map. */
  overlay?: React.ReactNode;
}

/**
 * The board panel.
 *
 * The panel folds from its title bar like every other panel; the board tabs are
 * hidden while folded so the bar stays a bar.  A decision that is waiting for a
 * map click keeps a one-line count in the folded bar, because folding must not
 * hide a required choice.
 *
 * The view bar under the map is the answer to "the whole board is too cramped
 * on a phone": the printed map is 6693 units wide, which is four pixels per
 * space on a handset, so the map opens on the player's own capital and every
 * theatre of the war is one press away.
 */
export const MapPanel = ({
  G, selected, onSelect, board, setBoard, pendingSpaceTargets, unitMoveTargets, battleTargets,
  locale, t, mapHint, viewer = null, modePill = null, overlay = null,
}: MapPanelProps) => {
  const [collapsed, setCollapsed] = React.useState(false);
  const [showPicker, setShowPicker] = React.useState(false);
  const [focus, setFocus] = React.useState<{x: number; y: number; nonce: number} | null>(null);
  const [search, setSearch] = React.useState("");
  const [frame, setFrame] = React.useState<MapFrameRequest | null>(null);
  const [theatre, setTheatre] = React.useState("all");
  const focusSpace = React.useCallback((id: SpaceId) => {
    const space = SPACES[id];
    if (space) setFocus({x: space.x, y: space.y, nonce: Date.now()});
  }, []);
  const choose = React.useCallback((id: SpaceId) => {
    onSelect(id);
    focusSpace(id);
  }, [onSelect, focusSpace]);

  const targets = React.useMemo(
    () => [...new Set([...pendingSpaceTargets, ...unitMoveTargets, ...battleTargets])],
    [pendingSpaceTargets, unitMoveTargets, battleTargets],
  );

  const capital = viewer !== null ? (POWER_DEFS[viewer]?.capital ?? null) : null;
  const frameTheatre = React.useCallback((id: string) => {
    setTheatre(id);
    setFrame({kind: id === "all" ? "fit" : "theatre", theatre: id, nonce: Date.now()});
  }, []);
  const frameCapital = React.useCallback(() => {
    setFrame({kind: "capital", space: capital ?? undefined, nonce: Date.now()});
  }, [capital]);

  const title = board === "greatWar" ? t.greatWarMap : t.map;
  const selection = selected ? spaceLabel(selected, locale) : t.selectSpace;

  return (
    <IEPanel
      className="ie-map-panel"
      title={<span>{title} · {selection}</span>}
      collapsed={collapsed}
      onToggle={setCollapsed}
      collapsedHint={targets.length > 0
        ? bi(locale, `${targets.length} legal targets — expand the map to pick one.`,
          `当前有 ${targets.length} 个可选地点，展开地图进行选择。`)
        : undefined}
      actions={!collapsed && (
        <div className="ie-map-actions">
          <div className="ie-tabs" role="tablist">
            <button role="tab" aria-selected={board === "world"} onClick={() => setBoard("world")}>{t.map}</button>
            <button role="tab" aria-selected={board === "greatWar"} onClick={() => setBoard("greatWar")}>{t.greatWarMap}</button>
          </div>
          <button
            type="button"
            className="ie-map-search-toggle"
            aria-expanded={showPicker ? "true" : "false"}
            onClick={() => setShowPicker((value) => !value)}
          >
            {bi(locale, "Find space", "查找空间")}
          </button>
        </div>
      )}
    >
      {showPicker && (
        <SpacePicker
          G={G}
          locale={locale}
          t={t}
          selected={selected}
          targets={targets}
          search={search}
          setSearch={setSearch}
          onChoose={choose}
          onFocus={focusSpace}
        />
      )}
      <div className="ie-map-views" data-testid="ie-map-views" role="group"
        aria-label={bi(locale, "Map framing", "地图取景")}>
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
          className="ie-view-chip"
          data-testid="ie-map-capital"
          title={capital ? spaceLabel(capital as SpaceId, locale) : undefined}
          onClick={frameCapital}
        >
          {bi(locale, "Capital", "首都")}
        </button>
        <select
          className="ie-select ie-view-select"
          data-testid="ie-map-theatre"
          aria-label={bi(locale, "Theatre", "战区")}
          value={theatre}
          onChange={(event) => frameTheatre(event.target.value)}
        >
          {/* "Whole map" is the chip beside this list, so it is not repeated as
              the select's first option. */}
          {THEATRES.filter((option) => option.id !== "all").map((option) => (
            <option key={option.id} value={option.id}>
              {locale === "zh_CN" ? option.labelZh : option.labelEn}
            </option>
          ))}
          <option value="all" hidden>{bi(locale, "Whole map", "全图")}</option>
        </select>
      </div>
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
          board={board}
          moveTargets={unitMoveTargets}
          battleTargets={battleTargets}
          legalTargets={pendingSpaceTargets}
          focus={focus}
          frame={frame}
          homeCapital={capital as SpaceId | null}
        />
        {overlay !== null && <div className="ie-map-overlay">{overlay}</div>}
      </div>
      <div className="ie-map-key">
        <span className="ie-key legal">{bi(locale, "Legal target", "合法目标")}</span>
        <span className="ie-muted">{mapHint}</span>
      </div>
    </IEPanel>
  );
};
