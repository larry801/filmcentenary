/**
 * Per-power score breakdown.
 *
 * The engine's `scoreGame` owns the arithmetic; this panel only prints the
 * lines it returns.  During play an opponent's National Goals are private, so
 * the panel shows the known subtotal and marks the missing goals instead of
 * guessing.  Once `G.result` exists its stored breakdown is public and every
 * source is printed, including goals scored at the Great War outbreak.
 */
import React from "react";
import {ImperialElegyState, POWERS, Power, ScoreLine} from "../types";
import {GOALS_BY_ID} from "../constant/goals";
import {scoreBreakdowns} from "../engine/victory";
import {bi} from "./boardHelpers";
import {ieStringsFor} from "./i18n";

export interface ScorePanelProps {
  G: ImperialElegyState;
  locale: "en" | "zh_CN";
  viewer: Power | null;
  /** Public hand-out goal counts; used to say how many goals stay hidden. */
  goalCounts?: Partial<Record<Power, number>>;
}

const goalTitle = (id: string, locale: "en" | "zh_CN"): string => {
  const goal = GOALS_BY_ID[id];
  return (locale === "zh_CN" ? goal?.titleZh : goal?.title) || id;
};

const goalLine = (line: ScoreLine, locale: "en" | "zh_CN", testId: string) => (
  <li key={`${testId}-${line.goal}`} data-testid={testId}>
    <span className="ie-score-label">
      {goalTitle(line.goal, locale)}
      {line.rank !== undefined && <span className="ie-muted"> · #{line.rank}{line.note === "tied" ? " =" : ""}</span>}
    </span>
    <span className="ie-score-value">+{line.vp}</span>
  </li>
);

export const ScorePanel = ({G, locale, viewer, goalCounts}: ScorePanelProps) => {
  const t = ieStringsFor(locale);
  const final = G.result != null;
  // A result saved before the breakdown existed still gets a panel: the live
  // numbers are the fallback, and the stored numbers win when present.
  const live = scoreBreakdowns(G);
  const rows = POWERS.map((power) => ({
    power,
    breakdown: G.result?.breakdown?.[power] ?? live[power],
  }));

  return (
    <div className="ie-score-panel" data-testid="ie-score-panel">
      <h4>{t.scoreBreakdown}</h4>
      <p className="ie-muted">
        {final
          ? `${t.finalScore} · ${bi(locale, "Every VP source in the final result.", "最终结果中所有得分来源。")}`
          : bi(locale, "Projected totals from public information; hidden National Goals are not counted.", "按公开信息推算的当前得分；未公开的国家目标不计入。")}
      </p>
      <div className="ie-score-grid">
        {rows.map(({power, breakdown}) => {
          const bankedGoalsVp = breakdown.bankedGoals.reduce((sum, line) => sum + line.vp, 0);
          const otherBankedVp = breakdown.bankedVp - bankedGoalsVp - breakdown.bankedSecondRomeVp;
          const hiddenCount = Math.max(0, (goalCounts?.[power] ?? 0) - breakdown.goals.length);
          return (
            <div key={power} className="ie-score-card" data-testid={`ie-score-${power}`}>
              <div className="ie-score-head">
                <strong>{t.seats[power]}</strong>
                <span className="ie-score-total" data-testid={`ie-score-${power}-total`}>
                  {breakdown.total}{hiddenCount > 0 ? "+" : ""} VP
                </span>
              </div>
              <ul className="ie-score-lines">
                {breakdown.bankedGoals.length > 0 || breakdown.bankedSecondRomeVp > 0 ? (
                  <li>
                    <span className="ie-score-label">{bi(locale, "Other banked VP", "其他已入账 VP")}</span>
                    <span className="ie-score-value">{otherBankedVp}</span>
                  </li>
                ) : (
                  <li>
                    <span className="ie-score-label">{bi(locale, "Banked VP", "已入账 VP")}</span>
                    <span className="ie-score-value">{breakdown.bankedVp}</span>
                  </li>
                )}
                {breakdown.bankedGoals.length > 0 && (
                  <li className="ie-score-group" data-testid={`ie-score-${power}-banked-goals`}>
                    {bi(locale, "Goals scored at the Great War outbreak", "大战爆发时结算的国家目标")}
                  </li>
                )}
                {breakdown.bankedGoals.map((line) => goalLine(line, locale, `ie-score-${power}-banked-goal-${line.goal}`))}
                {breakdown.bankedSecondRomeVp > 0 && (
                  <li data-testid={`ie-score-${power}-banked-second-rome`}>
                    <span className="ie-score-label">{bi(locale, "Second Rome (outbreak)", "第二罗马（大战爆发）")}</span>
                    <span className="ie-score-value">+{breakdown.bankedSecondRomeVp}</span>
                  </li>
                )}
                {breakdown.goals.length > 0 && (
                  <li className="ie-score-group">{bi(locale, "National Goals", "国家目标")}</li>
                )}
                {breakdown.goals.map((line) => goalLine(line, locale, `ie-score-${power}-goal-${line.goal}`))}
                {hiddenCount > 0 && (
                  <li className="ie-muted" data-testid={`ie-score-${power}-hidden`}>
                    <span className="ie-score-label">
                      {hiddenCount} {bi(locale, hiddenCount === 1 ? "hidden goal" : "hidden goals", "个未公开目标")}
                    </span>
                    <span className="ie-score-value">?</span>
                  </li>
                )}
                <li>
                  <span className="ie-score-label">{bi(locale, "Stability", "稳定度")}</span>
                  <span className="ie-score-value">+{breakdown.stabilityVp}</span>
                </li>
                {breakdown.secondRomeVp > 0 && (
                  <li data-testid={`ie-score-${power}-second-rome`}>
                    <span className="ie-score-label">{bi(locale, "Second Rome (Istanbul)", "第二罗马（伊斯坦布尔）")}</span>
                    <span className="ie-score-value">+{breakdown.secondRomeVp}</span>
                  </li>
                )}
              </ul>
              <div className="ie-score-foot">
                <span>{bi(locale, "Subtotal", "当前小计")}</span>
                <strong>{breakdown.total} VP{hiddenCount > 0 ? "+" : ""}</strong>
              </div>
            </div>
          );
        })}
      </div>
      {viewer === null && !final && (
        <p className="ie-muted">{bi(locale, "Spectators see the same public subtotals.", "观战者看到的同样是公开小计。")}</p>
      )}
    </div>
  );
};
