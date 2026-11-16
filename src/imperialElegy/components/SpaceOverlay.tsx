import React from "react";
import {ImperialElegyState, Power, SpaceId} from "../types";
import {SPACES, spaceLabel} from "../constant/spaces";
import {effectiveKeyType, friendlySpace, hasLoc} from "../engine/rules";
import {ieT} from "./i18n";
import {bi, controlLabel} from "./boardHelpers";

export interface SpaceOverlayProps {
  G: ImperialElegyState;
  selected: SpaceId | null;
  viewer: Power | null;
  locale: "en" | "zh_CN";
}

/**
 * A small floating card in the map's bottom-left corner: the selected space's
 * name, control and garrison, so the map can answer "what is this?" without
 * sending the eye to the rail.  The full space dossier (and every action) stays
 * in the Action tab; this card deliberately has no buttons of its own.
 */
export const SpaceOverlay = ({G, selected, viewer, locale}: SpaceOverlayProps) => {
  const t = ieT();
  if (selected === null) return null;
  const def = SPACES[selected];
  const state = G.spaces[selected];
  if (!def || !state) return null;
  const units = state.units
    .map((id) => G.units[id])
    .filter((unit) => unit !== undefined);
  const armyCount = units.filter((unit) => unit.naval !== true).length;
  const shipCount = units.filter((unit) => unit.naval === true).length;
  const supply = viewer !== null ? hasLoc(G, viewer, selected) : null;
  const keyType = effectiveKeyType(G, selected);
  return (
    <div className="ie-space-overlay" data-testid="ie-space-overlay" data-space={selected}>
      <div className="ie-space-overlay-title">
        {spaceLabel(selected, locale)}
        {def.keyType !== undefined ? <span className="ie-space-overlay-star" aria-label={t.keyType}>★</span> : null}
      </div>
      <div className="ie-space-overlay-row">
        <span>{t.control}: {controlLabel(t, state.control)}</span>
        {keyType !== undefined && <span>{keyType === "colonial" ? t.keyTypeColonial : t.keyTypeTerritorial}</span>}
      </div>
      <div className="ie-space-overlay-row">
        <span>{t.units}: {armyCount + shipCount}</span>
        {armyCount > 0 && <span>⚔ {armyCount}</span>}
        {shipCount > 0 && <span>⚓ {shipCount}</span>}
        {supply !== null && (
          <span className={supply ? "ie-ok" : "ie-danger"}>
            {supply ? t.inSupply : t.outOfSupply}
          </span>
        )}
        {viewer !== null && friendlySpace(G, selected, viewer) && (
          <span className="ie-space-overlay-friendly">{bi(locale, "friendly", "友方")}</span>
        )}
      </div>
    </div>
  );
};
