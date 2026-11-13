import React from "react";
import {ImperialElegyState, Power, SpaceId} from "../types";
import {spaceLabel} from "../constant/spaces";
import {POWERS} from "../types";
import {cardById} from "../engine/deck";
import {IEBadge, IEPanel} from "./theme";
import {ieT} from "./i18n";
import {PHASE_LABEL, POWER_KEYS, bi, isPowerKey, cardArt} from "./boardHelpers";
import {gwEventHint} from "../engine/playability";

export interface GreatWarPanelProps {
  gw: NonNullable<ImperialElegyState["gw"]>;
  G: ImperialElegyState;
  viewer: Power | null;
  me: ImperialElegyState["powers"][Power] | null;
  active: Power;
  phase: string;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  eliminated: boolean;
  pending: ImperialElegyState["pending"];
  isActive: boolean;
  selected: SpaceId | null;
  gwBudgetOrder: Power[];
  gwSlotLabel: (slot: Power | "bonus" | "IT" | "US" | null) => string;
  italyShowing: boolean;
  italyBox: string;
  italyBoxLabel: string;
  italyHow: string;
  gwTransferToValue: string;
  setGwTransferTo: (s: string) => void;
  gwTransferAmountValue: number;
  setGwTransferAmount: (n: number) => void;
  canGwTransfer: boolean;
  gwSideAllies: Power[];
  canGwReveal: boolean;
  canGwDraft: boolean;
  canGwDeployHere: boolean;
  forcedGwCard: boolean;
  doAction: (fn: () => void) => void;
  moves: Record<string, (...args: any[]) => void>;
}

export const GreatWarPanel = (props: GreatWarPanelProps) => {
  const {
    gw, G, viewer, me, active, phase, locale, t,
    eliminated, pending, isActive, selected,
    gwBudgetOrder, gwSlotLabel,
    italyShowing, italyBox, italyBoxLabel, italyHow,
    gwTransferToValue, setGwTransferTo, gwTransferAmountValue, setGwTransferAmount,
    canGwTransfer, gwSideAllies, canGwReveal, canGwDraft, canGwDeployHere, forcedGwCard,
    doAction, moves,
  } = props;

  return (
    <IEPanel title={`${t.greatWarMap} · GW ${gw.turn}`} actions={<IEBadge tone="warn">{PHASE_LABEL(t, phase)}</IEBadge>}>
      <div className="ie-gw" data-testid="ie-gw">
        <div className="ie-gw-sides">
          <div><strong>TE:</strong> {gw.te.map((p) => t.seats[p]).join(", ") || "—"}</div>
          <div><strong>TA:</strong> {gw.ta.map((p) => t.seats[p]).join(", ") || "—"}</div>
          <div><strong>{t.neutral}:</strong> {gw.neutrals.map((p) => t.seats[p]).join(", ") || "—"}</div>
        </div>
        <div className="ie-gw-order">
          <span className="ie-muted">{bi(locale, "Order", "顺序")}:</span>
          {gw.order.map((slot, index) => (
            <span key={`${index}-${String(slot)}`} className={`ie-gw-slot${slot === active ? " active" : ""}${slot === "bonus" ? " bonus" : ""}`}>{gwSlotLabel(slot)}</span>
          ))}
        </div>
        <div className="ie-budget-grid">
          {gwBudgetOrder.map((p) => (
            <div key={p} className={`ie-budget${p === viewer ? " mine" : ""}${p === active ? " active" : ""}`}>
              <span>{t.seats[p]}</span>
              <b>{G.powers[p].gwBudget ?? 0}</b>
            </div>
          ))}
        </div>
        {italyShowing && !gw.italyIn && !gw.italySurrendered && (
          <div className="ie-muted" data-testid="ie-gw-italy-track" data-box={italyBox}>
            {bi(locale, "Italy", "意大利")}: {italyBoxLabel} · {italyHow}
          </div>
        )}
        {(gw.usIn || gw.italyIn || gw.usSurrendered || gw.italySurrendered) && (
          <div className="ie-muted" data-testid="ie-gw-majors">
            {(["US", "IT"] as const)
              .filter((major) => (major === "US" ? gw.usIn || gw.usSurrendered : gw.italyIn || gw.italySurrendered))
              .map((major) => {
                const label = major === "US" ? bi(locale, "US", "美国") : bi(locale, "Italy", "意大利");
                const surrendered = major === "US" ? gw.usSurrendered : gw.italySurrendered;
                const stability = major === "US" ? gw.usStability : gw.italyStability;
                const budget = major === "US" ? gw.usBudget : gw.italyBudget;
                return (
                  <span key={major} data-testid={`ie-gw-major-${major}`} data-surrendered={String(Boolean(surrendered))}>
                    {surrendered
                      ? `${label}: ${bi(locale, "surrendered", "已投降")}`
                      : `${label}: ${bi(locale, "stability", "稳定度")} ${stability}/3 · CP ${budget}${major === "IT" ? ` · ${bi(locale, "alliance track", "联盟轨道")} ${italyBoxLabel}` : ""}`}
                  </span>
                );
              })
              .reduce<React.ReactNode[]>((acc, node, index) => (index === 0 ? [node] : [...acc, " · ", node]), [])}
          </div>
        )}
        <div className="ie-muted">{bi(locale, "War budget", "战争预算")}: {POWERS.map((p) => `${p} ${G.powers[p].warBudget ?? 0}`).join(" · ")}</div>
        <div className="ie-gw-front" data-testid="ie-gw-combat-cards-in-front">
          <div className="ie-section-title">{bi(locale, "GW combat cards in front", "阵前大战战斗牌")}</div>
          {(gw.combatCardsInFront ?? []).length === 0 ? (
            <div className="ie-muted" data-testid="ie-gw-combat-cards-in-front-empty">{bi(locale, "None", "无")}</div>
          ) : (
            <div className="ie-gw-front-list">
              {(gw.combatCardsInFront ?? []).map((entry, index) => {
                const card = cardById(entry.cardId);
                const title = locale === "zh_CN" ? card.titleZh : card.title;
                const stateLabel = entry.faceup ? bi(locale, "Face up", "明置") : bi(locale, "Face down", "暗置");
                return (
                  <div key={`${entry.cardId}-${index}`} className={`ie-gw-front-card ${entry.faceup ? "faceup" : "facedown"}`}
                    data-testid={`ie-gw-in-front-${entry.cardId}`} data-holder={entry.holder} data-faceup={String(entry.faceup)}>
                    <span className="ie-gw-front-title">{title}</span>
                    <span className="ie-gw-front-holder">{t.seats[entry.holder]}</span>
                    <span className={`ie-gw-front-state${entry.faceup ? " faceup" : " facedown"}`}>{stateLabel}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {gw.lastColonialWar && (
          <div data-testid="ie-gw-winter"><strong>{t.gwWinterStep}:</strong> {bi(locale, "Africa", "非洲")} {gw.lastColonialWar.africa ?? "—"} · {bi(locale, "Asia", "亚洲")} {gw.lastColonialWar.asia ?? "—"}</div>
        )}
        {phase === "gwWinter" && <div className="ie-hint">{bi(locale, "Winter resolves automatically: blockade, colonial war, then the next GW turn.", "冬季自动结算：封锁、殖民战争，然后进入下一个大战回合。")}</div>}

        {phase === "gwPlanning" && viewer !== null && !eliminated && (
          <div className="ie-hint">
            {bi(locale, "All powers pick their GW card in planning; the table then starts maneuver.", "所有国家在计划阶段选择大战卡，然后进入机动。")}
            <button className="ie-btn" data-testid="ie-gw-start" onClick={() => doAction(() => moves.endGwPlanningMove())}>{t.gwStart}</button>
            {canGwTransfer && (
              <span className="ie-inline" data-testid="ie-gw-transfer">
                <select className="ie-select" data-testid="ie-gw-transfer-to" value={gwTransferToValue} onChange={(e) => setGwTransferTo(e.target.value)} title={bi(locale, "Allied recipient", "受援盟友")}>
                  {gwSideAllies.map((power) => <option key={power} value={power}>{t.seats[power]}</option>)}
                </select>
                <input className="ie-select" data-testid="ie-gw-transfer-amount" type="number" min={1} max={Math.max(1, me?.gwBudget ?? 1)}
                  value={gwTransferAmountValue} onChange={(e) => setGwTransferAmount(Number(e.target.value))} title={bi(locale, "CP to transfer", "转交的 CP")}/>
                <button className="ie-btn" data-testid="ie-gw-transfer-submit" disabled={!canGwTransfer || gwTransferToValue === ""}
                  onClick={() => doAction(() => moves.gwTransferBudget(gwTransferToValue as Power, gwTransferAmountValue))}>{t.gwTransfer}</button>
              </span>
            )}
            {canGwReveal && (
              <button className="ie-btn secondary" data-testid="ie-gw-reveal" onClick={() => doAction(() => moves.gwRevealCombat())}>{t.gwReveal}</button>
            )}
          </div>
        )}
        {phase === "gwManeuver" && isActive && !eliminated && pending === null && (
          <div className="ie-inline">
            <button className="ie-btn" data-testid="ie-gw-draft" title={t.draftArmies} disabled={!canGwDraft}
              onClick={() => doAction(() => moves.gwDraft(selected!))}>{t.gwDraft}{selected ? ` · ${spaceLabel(selected, locale)}` : ""}</button>
            <button className="ie-btn" data-testid="ie-gw-deploy" title={bi(locale, "Deploy one reserve army here (27.5).", "在此部署一支预备军（27.5）。")} disabled={!canGwDeployHere}
              onClick={() => doAction(() => moves.gwDeploy(selected!))}>{t.gwDeploy}</button>
            {canGwReveal && (
              <button className="ie-btn secondary" data-testid="ie-gw-reveal" onClick={() => doAction(() => moves.gwRevealCombat())}>{t.gwReveal}</button>
            )}
            <button className="ie-btn secondary" data-testid="ie-gw-pass" disabled={forcedGwCard}
              title={forcedGwCard ? bi(locale, "Exhaustion must be played before you can pass (27.3).", "必须先在打出手中的“精疲力竭”后才能停牌（27.3）。") : bi(locale, "Pass this impulse only; the next power acts.", "仅停牌本轮，下一位国家行动。")}
              onClick={() => doAction(() => moves.gwPass())}>{t.gwPass}</button>
            <button className="ie-btn secondary" data-testid="ie-gw-end"
              title={bi(locale, "End the whole GW maneuver turn and go to winter.", "结束整个大战机动回合并进入冬季。")}
              onClick={() => doAction(() => moves.gwEndTurn())}>{t.gwEnd}</button>
          </div>
        )}
        {phase === "gwManeuver" && isActive && !selected && <div className="ie-hint">{bi(locale, "Select a space on the map, then draft there.", "先在地图上选择空间，然后在此征召。")}</div>}
        {phase === "gwManeuver" && !isActive && viewer !== null && <div className="ie-muted">{t.waitingOther}</div>}
      </div>
    </IEPanel>
  );
};
