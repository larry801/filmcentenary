import React from "react";
import {ImperialElegyState, Power} from "../types";
import {POWER_DEFS} from "../constant/powers";
import {GOALS_BY_ID} from "../constant/goals";
import {IEBadge, IEChip, IEPanel} from "./theme";
import {ieT} from "./i18n";
import {POWER_KEYS, bi, powerOrMinorLabel} from "./boardHelpers";

export interface DashboardPanelProps {
  G: ImperialElegyState;
  active: Power;
  viewer: Power | null;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  handCounts: Partial<Record<Power, number>>;
  goalCounts: Partial<Record<Power, number>>;
  homeCardTitle: (id: string) => string;
  minorMarkerRows: [string, number][];
}

export const DashboardPanel = ({G, active, viewer, locale, t, handCounts, goalCounts, homeCardTitle, minorMarkerRows}: DashboardPanelProps) => (
  <IEPanel title={t.dashboard}>
    <div className="ie-dashboard">
      {POWER_KEYS.map((p) => {
        const def = POWER_DEFS[p];
        const state = G.powers[p];
        return (
          <div key={p} className={`ie-power ${p === active ? "active" : ""} ${state.eliminated ? "eliminated" : ""}`} data-testid={`ie-power-${p}`}>
            <div className="ie-power-head">
              <span className="ie-power-name">{t.seats[p]}</span>
              <span>
                {state.eliminated && <IEBadge tone="warn">{t.eliminated}</IEBadge>}
                <IEBadge tone={p.toLowerCase()}>{state.alliance === "neutral" ? t.neutral : state.alliance}</IEBadge>
              </span>
            </div>
            <div className="ie-power-stat">
              <span>{t.stability} {state.stability}</span>
              <span>{t.manpower} {state.manpower}{state.secondaryManpower !== undefined ? `/${state.secondaryManpower}` : ""}</span>
              <span>{t.industry} {state.industry}</span>
              <span>{t.territorialKeys} {state.territorialKeys}</span>
              <span>{t.colonialKeys} {state.colonialKeys}</span>
              {state.arabKeys !== undefined && <span>{t.arabKeys} {state.arabKeys}</span>}
              <span>{t.vp} {state.vp}</span>
              <span>{t.reserves} {state.reserves.length}</span>
              <span>{t.hand} {handCounts[p] ?? state.hand.length}</span>
              <span>{t.goals} {goalCounts[p] ?? state.goals.length}</span>
              <span>{t.mpit} {state.mpit.te}/{state.mpit.ta}/{state.mpit.neutral}</span>
            </div>
            <div className="ie-power-chips">
              {state.selectedHomeCard && <IEChip>{t.homeCard}: {homeCardTitle(state.selectedHomeCard)}</IEChip>}
              {p === viewer && state.industryCard && <IEChip>{t.industryCard}: {homeCardTitle(state.industryCard)}</IEChip>}
              {p === viewer && state.cpChain.length > 0 && <IEChip>{t.cpChainCard}: {state.cpChain.map(homeCardTitle).join(", ")}</IEChip>}
              {p === viewer && state.goals.map((g) => <IEChip key={g}>{locale === "zh_CN" ? GOALS_BY_ID[g]?.titleZh : GOALS_BY_ID[g]?.title}</IEChip>)}
            </div>
            <details>
              <summary className="ie-muted">{t.characteristics}</summary>
              <ul style={{margin: "4px 0 0 14px", padding: 0, fontSize: 11, lineHeight: 1.3}}>
                {def.characteristics.map((c, i) => <li key={i}>{locale === "zh_CN" ? c.zh : c.en}</li>)}
              </ul>
            </details>
          </div>
        );
      })}
    </div>
    <div className="ie-inline" data-testid="ie-revealed-goals" style={{marginTop: 6}}>
      <span className="ie-section-title">{t.revealedGoals}:</span>
      {(G.revealedGoals ?? []).length === 0
        ? <span className="ie-muted">{bi(locale, "None revealed", "暂无公开目标")}</span>
        : (G.revealedGoals ?? []).map((id) => {
          const goal = GOALS_BY_ID[id];
          return (
            <span key={id} data-testid={`ie-revealed-goal-${id}`}>
              <IEChip>
                {locale === "zh_CN" ? goal?.titleZh ?? id : goal?.title ?? id}
                {goal ? ` · ${t.seats[goal.power]}` : ""}
              </IEChip>
            </span>
          );
        })}
    </div>
    <div className="ie-inline" data-testid="ie-minor-card-markers" style={{marginTop: 6}}>
      <span className="ie-section-title">{bi(locale, "War reparation markers (16.2.3)", "战争赔款标记（16.2.3）")}:</span>
      {minorMarkerRows.length === 0
        ? <span className="ie-muted">{bi(locale, "None", "无")}</span>
        : minorMarkerRows.map(([minor, count]) => (
          <span key={minor} data-testid={`ie-minor-marker-${minor}`}>
            <IEChip>{powerOrMinorLabel(t, locale, minor)} · {count}</IEChip>
          </span>
        ))}
    </div>
  </IEPanel>
);
