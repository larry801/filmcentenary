import React from "react";
import {ImperialElegyState, Power} from "../types";
import {IEBadge, IEPanel} from "./theme";
import {ieT} from "./i18n";
import {POWER_KEYS, bi} from "./boardHelpers";

export interface MpitPanelProps {
  G: ImperialElegyState;
  canAct: boolean;
  viewer: Power | null;
  me: ImperialElegyState["powers"][Power] | null;
  cpBudget: () => number;
  canSpend: (cost: number) => boolean;
  mpitTarget: Power;
  setMpitTarget: (p: Power) => void;
  mpitTrack: "te" | "ta" | "neutral";
  setMpitTrack: (t: "te" | "ta" | "neutral") => void;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  doAction: (fn: () => void) => void;
  moves: Record<string, (...args: any[]) => void>;
}

export const MpitPanel = ({G, canAct, viewer, me, cpBudget, canSpend, mpitTarget, setMpitTarget, mpitTrack, setMpitTrack, locale, t, doAction, moves}: MpitPanelProps) => (
  <IEPanel title={`${t.mpit} · ${bi(locale, "Influence track", "影响力轨")}`} actions={<IEBadge>{bi(locale, "1 CP per marker", "每标记 1 CP")}</IEBadge>}>
    <div data-testid="ie-mpit">
      {canAct ? (
        <div className="ie-inline" data-testid="ie-mpit-controls">
          <IEBadge tone={me ? (viewer as string).toLowerCase() : "default"}>{t.cp}: {cpBudget()}</IEBadge>
          <select className="ie-select" value={mpitTarget} onChange={(e) => setMpitTarget(e.target.value as Power)} title={t.target}>
            {POWER_KEYS.map((p) => <option key={p} value={p}>{t.seats[p]}</option>)}
          </select>
          <select className="ie-select" value={mpitTrack} onChange={(e) => setMpitTrack(e.target.value as typeof mpitTrack)} title={bi(locale, "Track", "轨道")}>
            <option value="te">{t.mpitTe}</option><option value="ta">{t.mpitTa}</option><option value="neutral">{t.mpitNeutral}</option>
          </select>
          <button className="ie-btn" disabled={!canSpend(1)} onClick={() => doAction(() => moves.placeMpit(mpitTarget, mpitTrack))}>{t.placeMpit}</button>
        </div>
      ) : <div className="ie-muted">{bi(locale, "Available during your own impulse.", "仅在你的行动轮可用。")}</div>}
      <div className="ie-mpit-grid">
        {POWER_KEYS.map((p) => (
          <div key={p} className={`ie-mpit-cell${p === viewer ? " mine" : ""}`}>
            <b>{t.seats[p]}</b>
            <span>{t.mpitTe} {G.powers[p].mpit.te}</span>
            <span>{t.mpitTa} {G.powers[p].mpit.ta}</span>
            <span>{t.mpitNeutral} {G.powers[p].mpit.neutral}</span>
          </div>
        ))}
      </div>
    </div>
  </IEPanel>
);
