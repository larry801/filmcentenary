import React from "react";
import {ImperialElegyState, Power, SpaceId} from "../types";
import {SPACES, spaceLabel} from "../constant/spaces";
import {MINOR_POWER_HOMES} from "../constant/setup";
import {minorAlliesOf} from "../engine/rules";
import {isLoneMinorWar, loneMinorDefender} from "../engine/limitedWar";
import {treatyOptionLabel} from "../engine/treatyChoice";
import {BALANCE_OF_POWER_CARD} from "../moves";
import {IEBadge, IEPanel} from "./theme";
import {ieT} from "./i18n";
import {POWER_KEYS, bi, isPowerKey, powerOrMinorLabel, pickActionTarget} from "./boardHelpers";

export interface WarPanelProps {
  war: NonNullable<ImperialElegyState["war"]>;
  G: ImperialElegyState;
  viewer: Power | null;
  active: Power;
  phase: string;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  warStatusLabel: string;
  warAimLabel: (aim: string | null) => string;
  warBelligerents: string[];
  isPrincipal: boolean;
  isBelligerent: boolean;
  eliminated: boolean;
  pending: ImperialElegyState["pending"];
  isActive: boolean;
  warBudgetRows: Power[];
  warDefenderMinors: string[];
  callableAllies: Power[];
  warAllyValue: Power | undefined;
  setWarAlly: (p: Power) => void;
  callableMinors: string[];
  warMinorValue: string;
  setWarMinor: (s: string) => void;
  confirmSurrender: boolean;
  setConfirmSurrender: (b: boolean) => void;
  doAction: (fn: () => void) => void;
  moves: Record<string, (...args: any[]) => void>;
}

export const WarPanel = (props: WarPanelProps) => {
  const {
    war, G, viewer, active, phase, locale, t, warStatusLabel, warAimLabel,
    warBelligerents, isPrincipal, isBelligerent, eliminated, pending, isActive,
    warBudgetRows, warDefenderMinors, callableAllies, warAllyValue, setWarAlly,
    callableMinors, warMinorValue, setWarMinor, confirmSurrender, setConfirmSurrender,
    doAction, moves,
  } = props;
  return (
    <IEPanel title={`${t.phases.wartime} · ${warStatusLabel}`} actions={<IEBadge tone="warn">{warStatusLabel}</IEBadge>}>
      <div className="ie-war" data-testid="ie-war">
        <div className="ie-war-sides">
          <div className="ie-war-side">
            <div className="ie-war-power">{t.seats[war.attacker]}</div>
            <div className="ie-muted">{bi(locale, "Attacker", "进攻方")}</div>
            {war.attackerAllies.length > 0 && <div>{bi(locale, "Allies", "盟友")}: {war.attackerAllies.map((p) => t.seats[p]).join(", ")}</div>}
          </div>
          <div className="ie-war-arrow">→</div>
          <div className="ie-war-side">
            <div className="ie-war-power" data-testid="ie-war-defender">
              {powerOrMinorLabel(t, locale, isLoneMinorWar(war) ? loneMinorDefender(war) ?? war.defender : war.defender)}
            </div>
            <div className="ie-muted">{bi(locale, "Defender", "防守方")}</div>
            {war.defenderAllies.length > 0 && <div>{bi(locale, "Allies", "盟友")}: {war.defenderAllies.map((p) => t.seats[p]).join(", ")}</div>}
            {warDefenderMinors.length > 0 && (
              <div data-testid="ie-war-defender-minors">
                {bi(locale, "Minor allies", "小国盟友")}: {warDefenderMinors.map((m) => powerOrMinorLabel(t, locale, m)).join(", ")}
              </div>
            )}
          </div>
        </div>
        <div><strong>{t.warAim}:</strong> {warAimLabel(war.warAim)} · <strong>{t.objectives}:</strong> {war.objectives.map((id) => spaceLabel(id, locale)).join(", ")}</div>
        <div className="ie-war-budgets" data-testid="ie-war-budgets"><strong>{t.cp}:</strong> {warBudgetRows.map((p) => <span key={p} className={p === active ? "active" : ""}>{t.seats[p]} {war.budgets[p] ?? 0}</span>)}</div>
        <div><strong>{t.pass}:</strong> {war.passed.map((p) => t.seats[p]).join(", ") || "—"}</div>
        {war.initiative.length > 0 && <div><strong>{bi(locale, "Initiative", "先手")}:</strong> {war.initiative.map((p) => t.seats[p]).join(" → ")}</div>}
        {war.treaties.length > 0 && <div data-testid="ie-war-treaties"><strong>{t.treaty}:</strong> {war.treaties.map((option) => treatyOptionLabel(option, locale)).join(", ")}</div>}
        <div className="ie-muted">{bi(locale, "Status", "状态")}: {warStatusLabel} · {bi(locale, "Started turn", "开始回合")} {war.startedTurn}</div>

        {isBelligerent && !eliminated && pending === null && (
          <div className="ie-war-controls">
            {isActive && (war.status === "warAim" || war.status === "alliance") && (
              <button className="ie-btn" onClick={() => doAction(() => moves.startWarManeuver())}>{t.startWar}</button>
            )}
            {viewer === war.defender && war.defenderShift?.choice === true && (war.status === "warAim" || war.status === "alliance") && (
              <div className="ie-inline">
                <span className="ie-muted">{bi(locale, "Alliance shift (8.2)", "联盟转变（8.2）")}:</span>
                {(["te", "ta"] as const).map((side) => (
                  <button key={side} className="ie-btn secondary" onClick={() => doAction(() => moves.chooseAllianceShift(side))}>
                    {side === "te" ? bi(locale, "Triple Entente", "协约国") : bi(locale, "Triple Alliance", "同盟国")}
                  </button>
                ))}
              </div>
            )}
            {war.status === "warAim" && viewer === war.attacker && (
              <div className="ie-inline">
                <span className="ie-muted">{t.chooseAim}:</span>
                {(["conquest", "liberation", "unification"] as const).map((aim) => (
                  <button key={aim} className={`ie-btn secondary${war.warAim === aim ? " selected" : ""}`} aria-pressed={war.warAim === aim} onClick={() => doAction(() => moves.chooseWarAim(aim))}>{warAimLabel(aim)}</button>
                ))}
              </div>
            )}
            {isPrincipal && (
              <div className="ie-inline">
                <select className="ie-select" value={warAllyValue ?? ""} disabled={callableAllies.length === 0} onChange={(e) => setWarAlly(e.target.value as Power)} title={t.callAlly}>
                  {callableAllies.length === 0 && <option value="">{bi(locale, "No allied hand", "无盟友手牌")}</option>}
                  {callableAllies.map((p) => <option key={p} value={p}>{t.seats[p]}</option>)}
                </select>
                <button className="ie-btn" disabled={callableAllies.length === 0 || warAllyValue === undefined} onClick={() => doAction(() => moves.callWarAlly(warAllyValue!))}>{t.callAlly}</button>
              </div>
            )}
            {isPrincipal && war.status === "alliance" && callableMinors.length > 0 && (
              <div className="ie-inline" data-testid="ie-call-minor">
                <select className="ie-select" data-testid="ie-call-minor-select" value={warMinorValue} onChange={(e) => setWarMinor(e.target.value)} title={t.callMinor}>
                  {callableMinors.map((minor) => <option key={minor} value={minor}>{minor}</option>)}
                </select>
                <button className="ie-btn" data-testid="ie-call-minor-button" disabled={warMinorValue === ""} onClick={() => doAction(() => moves.callWarMinor(warMinorValue))}>{t.callMinor}</button>
              </div>
            )}
            {isPrincipal && (
              <button className={`ie-btn secondary${confirmSurrender ? " danger" : ""}`} onClick={() => {
                if (!confirmSurrender) { setConfirmSurrender(true); return; }
                doAction(() => moves.surrender());
                setConfirmSurrender(false);
              }}>{confirmSurrender ? bi(locale, "Confirm surrender", "确认投降") : bi(locale, "Surrender", "投降")}</button>
            )}
            {isActive && phase === "wartime" && (
              <button className="ie-btn" disabled={war.passed.includes(viewer!)} onClick={() => doAction(() => moves.passWarMove())}>{t.passWar}</button>
            )}
            {isActive && phase === "wartime" && (
              <button className="ie-btn" onClick={() => doAction(() => moves.resolveWar())}>{t.resolveWar}</button>
            )}
          </div>
        )}
        {viewer === "UK" && !eliminated && pending === null && !warBelligerents.includes("UK")
          && (war.status === "warAim" || war.status === "alliance")
          && G.powers.UK.hand.includes(BALANCE_OF_POWER_CARD) && (
          <div className="ie-war-controls">
            <button className="ie-btn" onClick={() => doAction(() => moves.playBalanceOfPower())}>
              {bi(locale, "Balance of Power: become the primary defender", "势力均衡：成为主要防守方")}
            </button>
          </div>
        )}
      </div>
    </IEPanel>
  );
};
