/**
 * The inline reference tables.
 *
 * The drawer shows what can be computed from the game (so it can never drift
 * from the rules) before it shows the printed PNGs:
 *
 * - the Combat Results Table, one row per die differential, read from `crt()`;
 * - the action costs, read from the same `ACTION_COSTS` table the Orders panel
 *   prints on its buttons;
 * - the sequence of play, read from `phaseSteps`;
 * - the other powers' dashboards and the public log.
 *
 * Every anchor (`rules:crt`, `rules:costs`, `chart:<id>`) scrolls to its
 * section when the drawer opens at it.
 */
import React from "react";
import {crt} from "../engine/combat";
import {ieStringsFor} from "./i18n";
import {bi} from "./boardHelpers";
import {phaseSteps} from "./phaseSteps";
import {CHARTS, type ChartEntry} from "./ChartLightbox";
import {ACTION_COSTS, ACTION_COST_ORDER, actionCostLabel, type ActionId} from "./actionAvailability";
import {DashboardPanel} from "./DashboardPanel";
import {logText} from "./logText";
import type {ReferenceSlice} from "./boardSlices";

/** The die differentials the printed CRT covers, best-to-worst for the defender. */
export const CRT_ROWS: readonly number[] = [4, 3, 2, 1, 0, -1, -2, -3, -4];

export interface ReferenceTablesProps extends ReferenceSlice {
  /** Inline section to scroll to (`crt`, `costs`, `sequence`); charts open the lightbox. */
  anchor?: string | null;
  onOpenChart?: (chart: ChartEntry) => void;
}

export const ReferenceTables = (props: ReferenceTablesProps) => {
  const {
    G, locale, t, viewer, me, active, war, gw, pending, handCounts, goalCounts, minorMarkerRows,
    homeCardTitle, cpBudget, canAct, canSpend, mpitTarget, setMpitTarget, mpitTrack, setMpitTrack,
    doAction, moves, anchor = null, onOpenChart,
  } = props;
  const sections = React.useRef(new Map<string, HTMLElement>());
  const register = (key: string) => (node: HTMLElement | null) => {
    if (node) sections.current.set(key, node);
    else sections.current.delete(key);
  };

  React.useEffect(() => {
    if (!anchor) return;
    const node = sections.current.get(anchor);
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({block: "start"});
      node.focus({preventScroll: true});
    }
  }, [anchor]);

  const steps = phaseSteps({phase: G.phase, war, gw, endPhase: G.endPhase});

  return (
    <div className="ie-ref-tables">
      <section
        ref={register("crt")}
        className="ie-ref-section"
        data-testid="ie-ref-crt"
        data-highlighted={anchor === "crt" ? "true" : "false"}
        tabIndex={-1}
      >
        <h3>{bi(locale, "Combat Results Table", "战斗结果表")}</h3>
        <p className="ie-muted">{bi(locale, "Roll, add the differential, read the row. ★ decisive, ★★ white peace.", "掷骰加上差值，查表。★ 决定性胜利，★★ 白和。")}</p>
        <table className="ie-ref-table">
          <thead>
            <tr>
              <th scope="col">{bi(locale, "Die ± diff", "骰值±差值")}</th>
              <th scope="col">{bi(locale, "Attacker losses", "攻方损失")}</th>
              <th scope="col">{bi(locale, "Defender losses", "守方损失")}</th>
              <th scope="col">{bi(locale, "Victory", "胜利方")}</th>
            </tr>
          </thead>
          <tbody>
            {CRT_ROWS.map((row) => {
              const result = crt(row);
              return (
                <tr key={row} data-testid={`ie-crt-row-${row}`}>
                  <th scope="row">{row >= 4 ? "4+" : row}</th>
                  <td>{result.attackerLosses}</td>
                  <td>{result.defenderLosses}</td>
                  <td>
                    {result.victor === "attacker" ? bi(locale, "Attacker", "攻方") : bi(locale, "Defender", "守方")}
                    {result.decisive ? " · ★" : ""}
                    {result.doubleStar ? " · ★★" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section
        ref={register("costs")}
        className="ie-ref-section"
        data-testid="ie-ref-costs"
        data-highlighted={anchor === "costs" ? "true" : "false"}
        tabIndex={-1}
      >
        <h3>{bi(locale, "Action costs", "行动花费")}</h3>
        <ul className="ie-ref-costs">
          {ACTION_COST_ORDER.map((id: ActionId) => (
            <li key={id} data-testid={`ie-ref-cost-${id}`}>
              <span className="ie-ref-cost-label">{actionCostLabel(id, locale)}</span>
              <b className="ie-ref-cost">{ACTION_COSTS[id]} CP</b>
            </li>
          ))}
        </ul>
      </section>

      <section
        ref={register("sequence")}
        className="ie-ref-section"
        data-testid="ie-ref-sequence"
        data-highlighted={anchor === "sequence" ? "true" : "false"}
        tabIndex={-1}
      >
        <h3>{bi(locale, "Sequence of play", "游戏流程")}</h3>
        <ol className="ie-ref-sequence">
          {steps.map((step) => (
            <li key={step.key} data-current={step.current ? "true" : "false"} data-testid={`ie-ref-step-${step.key}`}>
              {locale === "zh_CN" ? step.titleZh : step.title}
              {step.rule && <span className="ie-muted"> · {step.rule}</span>}
            </li>
          ))}
        </ol>
      </section>

      <DashboardPanel
        G={G} active={active} viewer={viewer} locale={locale} t={t}
        handCounts={handCounts} goalCounts={goalCounts} homeCardTitle={homeCardTitle}
        minorMarkerRows={minorMarkerRows}
      />

      <section className="ie-ref-section" data-testid="ie-ref-charts">
        <h3>{bi(locale, "Reference charts", "参考图表")}</h3>
        <div className="ie-chart-grid">
          {CHARTS.map((chart) => (
            <figure key={chart.id}>
              <button
                type="button"
                className="ie-chart-open"
                data-testid={`ie-chart-${chart.id}`}
                onClick={() => onOpenChart?.(chart)}
                title={bi(locale, "Open the printed chart", "打开印刷图表")}
              >
                <img src={`/imperial-elegy/charts/${chart.file}.png`} alt={locale === "zh_CN" ? chart.titleZh : chart.title} loading="lazy"/>
              </button>
              <figcaption>{locale === "zh_CN" ? chart.titleZh : chart.title}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="ie-ref-section ie-log-panel" data-testid="ie-ref-log">
        <h3>{bi(locale, "History", "历史记录")}</h3>
        <div className="ie-log" data-testid="ie-ref-log-entries">
          {G.log.slice(-80).reverse().map((entry) => (
            <div key={entry.id}><span className="t">T{entry.turn}</span>{logText(entry, locale)}</div>
          ))}
        </div>
      </section>

      {pending !== null && (
        <p className="ie-muted" data-testid="ie-ref-pending">
          {bi(locale, "Decision for", "决策者")}: {ieStringsFor(locale).seats[pending.power]}
        </p>
      )}
    </div>
  );
};
