import React from "react";
import {ImperialElegyState, SpaceId} from "../types";
import {spaceLabel} from "../constant/spaces";
import {IEPanel} from "./theme";
import {IEMap} from "./map";
import {ieT} from "./i18n";
import {bi} from "./boardHelpers";

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

export const MapPanel = ({G, selected, onSelect, board, setBoard, pendingSpaceTargets, unitMoveTargets, battleTargets, locale, t, mapHint}: MapPanelProps) => (
  <IEPanel
    title={<span>{board === "greatWar" ? t.greatWarMap : t.map} · {selected ? spaceLabel(selected, locale) : t.selectSpace}</span>}
    actions={
      <div className="ie-tabs" role="tablist">
        <button role="tab" aria-selected={board === "world"} onClick={() => setBoard("world")}>{t.map}</button>
        <button role="tab" aria-selected={board === "greatWar"} onClick={() => setBoard("greatWar")}>{t.greatWarMap}</button>
      </div>
    }
  >
    <IEMap
      G={G}
      selected={selected}
      onSelect={onSelect}
      locale={locale}
      board={board}
      moveTargets={unitMoveTargets}
      battleTargets={battleTargets}
      legalTargets={pendingSpaceTargets}
    />
    <div className="ie-map-key">
      <span className="ie-key legal">{bi(locale, "Legal target", "合法目标")}</span>
      <span className="ie-muted">{mapHint}</span>
    </div>
  </IEPanel>
);
