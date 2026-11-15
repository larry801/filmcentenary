import React from "react";
import {ImperialElegyState, SpaceId} from "../types";
import {SPACES, spaceLabel} from "../constant/spaces";
import {IEPanel} from "./theme";
import {IEMap} from "./map";
import {ieT} from "./i18n";
import {bi} from "./boardHelpers";
import {SpacePicker} from "./SpacePicker";

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
}

/**
 * The board panel.
 *
 * The panel folds from its title bar like every other panel; the board tabs are
 * hidden while folded so the bar stays a bar.  A decision that is waiting for a
 * map click keeps a one-line count in the folded bar, because folding must not
 * hide a required choice.
 */
export const MapPanel = ({G, selected, onSelect, board, setBoard, pendingSpaceTargets, unitMoveTargets, battleTargets, locale, t, mapHint}: MapPanelProps) => {
  // The picker's "locate" affordance nudges the map; the nonce makes every
  // press move the view even when the same space is chosen twice.
  const [focus, setFocus] = React.useState<{x: number; y: number; nonce: number} | null>(null);
  const [search, setSearch] = React.useState("");
  const [collapsed, setCollapsed] = React.useState(false);

  const focusSpace = React.useCallback((id: SpaceId) => {
    const space = SPACES[id];
    if (!space) return;
    setFocus({x: space.x, y: space.y, nonce: Date.now()});
  }, []);

  const choose = React.useCallback((id: SpaceId) => {
    onSelect(id);
    focusSpace(id);
  }, [onSelect, focusSpace]);

  const targets = React.useMemo(
    () => [...new Set([...pendingSpaceTargets, ...unitMoveTargets, ...battleTargets])],
    [pendingSpaceTargets, unitMoveTargets, battleTargets],
  );

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
        <div className="ie-tabs" role="tablist">
          <button role="tab" aria-selected={board === "world"} onClick={() => setBoard("world")}>{t.map}</button>
          <button role="tab" aria-selected={board === "greatWar"} onClick={() => setBoard("greatWar")}>{t.greatWarMap}</button>
        </div>
      )}
    >
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
      />
      <div className="ie-map-key">
        <span className="ie-key legal">{bi(locale, "Legal target", "合法目标")}</span>
        <span className="ie-muted">{mapHint}</span>
      </div>
    </IEPanel>
  );
};
