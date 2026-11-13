import React from "react";
import {ImperialElegyState, PendingOption, Power, SpaceId} from "../types";
import {SPACES, spaceLabel} from "../constant/spaces";
import {CARD_BY_ID} from "../engine/deck";
import {IEBadge, IEPanel} from "./theme";
import {ieT} from "./i18n";
import {BATTLE_STAGE, OPTION_ZH, PROMPT_ZH, bi, unitLabel} from "./boardHelpers";

export interface PendingPanelProps {
  G: ImperialElegyState;
  pending: ImperialElegyState["pending"];
  canDecide: boolean;
  pendingKind: string | null;
  pendingPrompt: string;
  optionLabel: (o: PendingOption) => string;
  canDecline: boolean;
  pendingSpaceTargets: SpaceId[];
  viewer: Power | null;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  jihadDecision: {allowed: boolean; markers: number} | null;
  jihadReason: string | undefined;
  doAction: (fn: () => void) => void;
  moves: Record<string, (...args: any[]) => void>;
}

export const PendingPanel = ({
  G, pending, canDecide, pendingKind, pendingPrompt, optionLabel, canDecline,
  pendingSpaceTargets, viewer, locale, t, jihadDecision, jihadReason, doAction, moves,
}: PendingPanelProps) => (
  <IEPanel title={t.pending} actions={pendingKind ? <IEBadge tone="warn">{pendingKind}</IEBadge> : undefined}>
    {!pending ? <div className="ie-muted">{t.noPending}</div> : (
      <div className={`ie-pending${canDecide ? " urgent" : ""}`} data-testid="ie-pending">
        <h4>{canDecide ? t.yourDecision : `${t.waitingFor}: ${t.seats[pending.power]}`}</h4>
        <div className="ie-pending-kind" data-testid="ie-pending-kind">{pendingKind} · {t.pendingFor}: {t.seats[pending.power]}</div>
        <div className="ie-pending-prompt">{pendingPrompt}</div>
        {canDecide ? (
          <>
            <div className="ie-section-title">{t.pendingOptions}</div>
            <div className="ie-pending-options">
              {pending.options.map((o) => (
                <button key={o.id} data-testid={`ie-pending-option-${o.id}`} onClick={() => doAction(() => moves.resolvePending(o.id))}>{optionLabel(o)}</button>
              ))}
              {canDecline && <button className="ie-btn secondary" onClick={() => doAction(() => moves.declinePending())}>{t.decline}</button>}
            </div>
          </>
        ) : <div className="ie-muted" style={{marginTop: 6}}>{t.waitingOther}</div>}
        {canDecide && pendingSpaceTargets.length > 0 && <div className="ie-hint">{bi(locale, "The matching spaces are highlighted on the map.", "对应空间已在地图上高亮。")}</div>}
      </div>
    )}
    {G.battle && (
      <div className="ie-battle" data-testid="ie-battle">
        <h4>{bi(locale, G.battle.kind === "naval" ? "Naval battle" : "Land battle", G.battle.kind === "naval" ? "海战" : "陆战")} · {spaceLabel(G.battle.from, locale)} → {spaceLabel(G.battle.to, locale)}</h4>
        <div>{t.seats[G.battle.attacker]} → {t.seats[G.battle.defender]} · {bi(locale, "Step", "阶段")}: {BATTLE_STAGE[G.battle.stage] ? bi(locale, BATTLE_STAGE[G.battle.stage].en, BATTLE_STAGE[G.battle.stage].zh) : G.battle.stage}</div>
        {(G.battle.attackerRoll !== undefined || G.battle.defenderRoll !== undefined) && <div>{bi(locale, "Rolls", "掷骰")}: {G.battle.attackerRoll ?? "—"} / {G.battle.defenderRoll ?? "—"} · {bi(locale, "Diff", "差")} {G.battle.diff ?? "—"}</div>}
        <div>{bi(locale, "Losses", "损失")}: {G.battle.attackerLosses} / {G.battle.defenderLosses} · DRM {G.battle.attackerDrm}/{G.battle.defenderDrm}</div>
        {G.battle.notes.length > 0 && <div className="ie-muted">{G.battle.notes.join(", ")}</div>}
        {viewer === "OT" && jihadDecision !== null && (
          <div className="ie-inline" data-testid="ie-jihad-actions">
            <button className="ie-btn" data-testid="ie-use-jihad" disabled={jihadDecision.allowed !== true} title={jihadReason} onClick={() => doAction(() => moves.useJihad())}>
              {t.useJihad} ({jihadDecision.markers})
            </button>
          </div>
        )}
      </div>
    )}
    {G.result && <div style={{marginTop: 8}}><IEBadge tone="warn">{t.gameOver}: {G.result.winners.map((p) => t.seats[p]).join(", ")}</IEBadge></div>}
  </IEPanel>
);
