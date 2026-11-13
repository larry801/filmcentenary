import React from "react";
import {ImperialElegyState, Power, SpaceId, Unit} from "../types";
import {spaceLabel} from "../constant/spaces";
import {IEBadge, IEPanel} from "./theme";
import {ieT} from "./i18n";
import {bi, unitLabel} from "./boardHelpers";

// ---------------------------------------------------------------- Amphibious

export interface AmphibiousPanelProps {
  show: boolean;
  G: ImperialElegyState;
  viewer: Power;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  amphibiousOrigins: SpaceId[];
  amphibiousFromValue: string;
  setAmphibiousFrom: (s: string) => void;
  amphibiousTargets: SpaceId[];
  amphibiousToValue: string;
  setAmphibiousTo: (s: string) => void;
  amphibiousArmies: string[];
  amphibiousArmyValue: string[];
  toggleAmphibiousArmy: (id: string, checked: boolean) => void;
  amphibiousCanGo: boolean;
  amphibiousReason: string | undefined;
  amphibiousCheck: {enemyNaval?: number; needShips?: number; ownNaval?: number; ok?: boolean} | null;
  doAction: (fn: () => void) => void;
  moves: Record<string, (...args: any[]) => void>;
}

export const AmphibiousPanel = ({
  show, G, viewer, locale, t,
  amphibiousOrigins, amphibiousFromValue, setAmphibiousFrom,
  amphibiousTargets, amphibiousToValue, setAmphibiousTo,
  amphibiousArmies, amphibiousArmyValue, toggleAmphibiousArmy,
  amphibiousCanGo, amphibiousReason, amphibiousCheck,
  doAction, moves,
}: AmphibiousPanelProps) => {
  if (!show) return null;
  return (
    <IEPanel title={`${t.amphibiousAssault} · 19.10`} actions={<IEBadge>{t.seats[viewer]}</IEBadge>}>
      <div className="ie-amphibious" data-testid="ie-amphibious">
        <div className="ie-inline">
          <span className="ie-section-title">{bi(locale, "From", "出发地")}</span>
          <select className="ie-select" data-testid="ie-amphibious-from" value={amphibiousFromValue} onChange={(e) => setAmphibiousFrom(e.target.value)}>
            {amphibiousOrigins.length === 0
              ? <option value="">{bi(locale, "No loaded army", "没有已装载军团")}</option>
              : amphibiousOrigins.map((id) => <option key={id} value={id}>{spaceLabel(id, locale)}</option>)}
          </select>
          <span className="ie-section-title">{bi(locale, "Target port", "目标港口")}</span>
          <select className="ie-select" data-testid="ie-amphibious-to" value={amphibiousToValue} onChange={(e) => setAmphibiousTo(e.target.value)}>
            {amphibiousTargets.length === 0
              ? <option value="">{bi(locale, "No enemy port", "没有敌方港口")}</option>
              : amphibiousTargets.map((id) => <option key={id} value={id}>{spaceLabel(id, locale)}</option>)}
          </select>
        </div>
        <div className="ie-amphibious-armies" data-testid="ie-amphibious-armies">
          <span className="ie-section-title">{bi(locale, "Loaded armies (up to 2)", "装载军团（至多 2）")}</span>
          {amphibiousArmies.length === 0
            ? <span className="ie-muted">{bi(locale, "No army is loaded here.", "此处没有已装载军团。")}</span>
            : amphibiousArmies.map((id) => {
              const unit = G.units[id];
              if (!unit) return null;
              return (
                <label key={id} className="ie-muted">
                  <input type="checkbox" data-testid={`ie-amphibious-unit-${id}`} checked={amphibiousArmyValue.includes(id)} onChange={(e) => toggleAmphibiousArmy(id, e.target.checked)}/>{" "}
                  {unitLabel(unit, t)}
                </label>
              );
            })}
        </div>
        <div className="ie-inline">
          <button className="ie-btn" data-testid="ie-amphibious-go" disabled={!amphibiousCanGo} title={amphibiousReason}
            onClick={() => doAction(() => moves.amphibiousAssault(amphibiousFromValue as SpaceId, amphibiousToValue as SpaceId, amphibiousArmyValue))}>
            {t.amphibiousAssault}
          </button>
          {!amphibiousCanGo && amphibiousReason && <span className="ie-muted" data-testid="ie-amphibious-reason">{amphibiousReason}</span>}
        </div>
        {(amphibiousCheck?.enemyNaval ?? 0) > 0 && (
          <div className="ie-hint" data-testid="ie-amphibious-escort">
            {bi(locale,
              `Enemy naval presence: ${amphibiousCheck?.enemyNaval ?? 0} ships; a 2:1 escort needs ${amphibiousCheck?.needShips ?? 0} (you have ${amphibiousCheck?.ownNaval ?? 0}).`,
              `敌方海上力量：${amphibiousCheck?.enemyNaval ?? 0} 艘；2:1 护航需 ${amphibiousCheck?.needShips ?? 0} 艘（你现有 ${amphibiousCheck?.ownNaval ?? 0} 艘）。`)}
          </div>
        )}
      </div>
    </IEPanel>
  );
};

// ---------------------------------------------------------------- Naval Transport

export interface NavalTransportPanelProps {
  show: boolean;
  G: ImperialElegyState;
  viewer: Power;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  transportOrigins: SpaceId[];
  transportFromValue: string;
  setTransportFrom: (s: string) => void;
  transportLands: string[];
  transportLandValue: string;
  setTransportLand: (s: string) => void;
  transportTargets: SpaceId[];
  transportToValue: string;
  setTransportTo: (s: string) => void;
  transportFleet: string[];
  transportCanGo: boolean;
  transportReason: string | undefined;
  doAction: (fn: () => void) => void;
  moves: Record<string, (...args: any[]) => void>;
}

export const NavalTransportPanel = ({
  show, G, viewer, locale, t,
  transportOrigins, transportFromValue, setTransportFrom,
  transportLands, transportLandValue, setTransportLand,
  transportTargets, transportToValue, setTransportTo,
  transportFleet, transportCanGo, transportReason,
  doAction, moves,
}: NavalTransportPanelProps) => {
  if (!show) return null;
  return (
    <IEPanel title={`${bi(locale, "Naval transport", "海上运输")} · 12.3`} actions={<IEBadge>{t.seats[viewer]}</IEBadge>}>
      <div className="ie-naval-transport" data-testid="ie-naval-transport">
        <div className="ie-inline">
          <span className="ie-section-title">{bi(locale, "From", "出发地")}</span>
          <select className="ie-select" data-testid="ie-naval-transport-from" value={transportFromValue} onChange={(e) => setTransportFrom(e.target.value)}>
            {transportOrigins.length === 0
              ? <option value="">{bi(locale, "No loaded land unit", "没有可装载的陆军")}</option>
              : transportOrigins.map((id) => <option key={id} value={id}>{spaceLabel(id, locale)}</option>)}
          </select>
          <span className="ie-section-title">{bi(locale, "Land unit", "陆军单位")}</span>
          <select className="ie-select" data-testid="ie-naval-transport-land" value={transportLandValue} onChange={(e) => setTransportLand(e.target.value)}>
            {transportLands.length === 0
              ? <option value="">{bi(locale, "No land unit", "没有陆军单位")}</option>
              : transportLands.map((id) => {
                const unit = G.units[id];
                return <option key={id} value={id}>{unit ? unitLabel(unit, t) : id}</option>;
              })}
          </select>
          <span className="ie-section-title">{bi(locale, "Destination port", "目的港口")}</span>
          <select className="ie-select" data-testid="ie-naval-transport-to" value={transportToValue} onChange={(e) => setTransportTo(e.target.value)}>
            {transportTargets.length === 0
              ? <option value="">{bi(locale, "No reachable port", "没有可抵达港口")}</option>
              : transportTargets.map((id) => <option key={id} value={id}>{spaceLabel(id, locale)}</option>)}
          </select>
        </div>
        <div className="ie-inline">
          <button className="ie-btn" data-testid="ie-naval-transport-go" disabled={!transportCanGo} title={transportReason}
            onClick={() => doAction(() => moves.navalTransport(transportLandValue, transportFleet, transportToValue as SpaceId))}>
            {bi(locale, "Transport", "海运")}
          </button>
          <span className="ie-muted" data-testid="ie-naval-transport-fleet">
            {bi(locale, `Escorting fleet: ${transportFleet.length} ships`, `护航舰队：${transportFleet.length} 艘`)}
          </span>
          {!transportCanGo && transportReason && <span className="ie-muted" data-testid="ie-naval-transport-reason">{transportReason}</span>}
        </div>
      </div>
    </IEPanel>
  );
};

// ---------------------------------------------------------------- Naval Intercept

export interface NavalInterceptPanelProps {
  show: boolean;
  lastNavalBox: SpaceId;
  lastNavalMover: Power | null;
  viewer: Power | null;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  interceptPorts: SpaceId[];
  interceptPortValue: string;
  setInterceptPort: (s: string) => void;
  interceptCheck: {ok?: boolean; ships?: number; reason?: string} | null;
  interceptReason: string | undefined;
  doAction: (fn: () => void) => void;
  moves: Record<string, (...args: any[]) => void>;
}

export const NavalInterceptPanel = ({
  show, lastNavalBox, lastNavalMover, viewer, locale, t,
  interceptPorts, interceptPortValue, setInterceptPort,
  interceptCheck, interceptReason,
  doAction, moves,
}: NavalInterceptPanelProps) => {
  if (!show) return null;
  return (
    <IEPanel title={`${t.navalIntercept} · 19.1`} actions={<IEBadge tone="warn">{spaceLabel(lastNavalBox, locale)}</IEBadge>}>
      <div className="ie-naval-intercept" data-testid="ie-naval-intercept">
        <div className="ie-muted">
          {bi(locale,
            `Last naval move: ${lastNavalMover ? t.seats[lastNavalMover] : "—"} into ${spaceLabel(lastNavalBox, locale)}. The defender may attempt an interception from one of their ports.`,
            `最近一次海军移动：${lastNavalMover ? t.seats[lastNavalMover] : "—"} 进入${spaceLabel(lastNavalBox, locale)}。防御方可从其一港口尝试拦截。`)}
        </div>
        <div className="ie-inline">
          <select className="ie-select" data-testid="ie-intercept-port" value={interceptPortValue} onChange={(e) => setInterceptPort(e.target.value)} disabled={interceptPorts.length === 0}>
            {interceptPorts.length === 0
              ? <option value="">{bi(locale, "No adjacent port", "没有相邻港口")}</option>
              : interceptPorts.map((id) => <option key={id} value={id}>{spaceLabel(id, locale)}</option>)}
          </select>
          <button className="ie-btn" data-testid="ie-intercept-go" disabled={interceptCheck?.ok !== true} title={interceptReason}
            onClick={() => doAction(() => moves.navalIntercept(interceptPortValue as SpaceId, lastNavalBox))}>
            {t.navalIntercept}
          </button>
          {interceptCheck?.ok !== true && interceptReason && <span className="ie-muted" data-testid="ie-intercept-reason">{interceptReason}</span>}
        </div>
        {interceptCheck?.ok === true && (
          <div className="ie-hint">
            {bi(locale, `${interceptCheck.ships ?? 0} ships in the port will roll 5+.`, `${interceptCheck.ships ?? 0} 艘港口内舰船需掷 5+。`)}
          </div>
        )}
      </div>
    </IEPanel>
  );
};
