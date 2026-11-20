/**
 * The after-battle report, raised for every seat.
 *
 * A battle used to end with only a log line and the loss panel disappearing at
 * once, so the table could miss who won, by how much, and what both sides paid.
 * The engine now keeps `G.battleReport`; this dialog reads it from shared state,
 * so an online opponent and a hotseat's other seats see the same result even
 * though only one seat answered the loss decisions.  It is a report, not a
 * blocker: the reader closes it with the ✕, the footer button or Escape.
 */
import React from "react";
import type {BattleLossRecord, BattleReport} from "../types";
import {spaceLabel} from "../constant/spaces";
import {unitKindLabel} from "../engine/unitKind";
import {Modal} from "./Modal";
import {bi} from "./boardHelpers";
import {ieT} from "./i18n";
import {BattleDrmList} from "./BattleDrmList";

export interface BattleResultModalProps {
  report: BattleReport | null;
  open: boolean;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  onClose: () => void;
}

interface CasualtyGroup {
  kind: string;
  eliminated: boolean;
  count: number;
}

/** "2 × army (eliminated), 1 × squadron (reduced)" in the board's language. */
const casualtySummary = (units: readonly BattleLossRecord[], locale: "en" | "zh_CN"): string => {
  if (units.length === 0) return bi(locale, "No unit lost", "无部队损失");
  const groups: CasualtyGroup[] = [];
  for (const unit of units) {
    const group = groups.find((entry) => entry.kind === unit.kind && entry.eliminated === unit.eliminated);
    if (group) group.count += 1;
    else groups.push({kind: unit.kind, eliminated: unit.eliminated, count: 1});
  }
  return groups
    .map((group) =>
      `${group.count} × ${unitKindLabel(group.kind, locale)}${
        group.eliminated
          ? bi(locale, " (eliminated)", "（被消灭）")
          : bi(locale, " (reduced)", "（受损）")
      }`,
    )
    .join(bi(locale, ", ", "，"));
};

const signed = (value: number | undefined): string => {
  if (value === undefined) return "—";
  return value > 0 ? `+${value}` : String(value);
};

const BattleSide = ({side, report, locale, t}: {
  side: "attacker" | "defender";
  report: BattleReport;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
}) => {
  const power = side === "attacker" ? report.attacker : report.defender;
  const losses = side === "attacker" ? report.attackerLosses : report.defenderLosses;
  const units = side === "attacker" ? report.attackerUnits : report.defenderUnits;
  const dreadnoughts = units.filter((unit) => unit.kind === "dreadnought").length;
  const won = report.winner === side;
  return (
    <div
      className={`ie-battle-result-side${won ? " is-winner" : ""}`}
      data-testid={`ie-battle-result-${side}`}
    >
      <div className="ie-battle-result-role">
        {side === "attacker" ? bi(locale, "Attacker", "进攻方") : bi(locale, "Defender", "防守方")}
      </div>
      <div className="ie-battle-result-power">{t.seats[power]}</div>
      <div className="ie-battle-result-number" data-testid={`ie-battle-result-${side}-losses`}>{losses}</div>
      <div className="ie-battle-result-unit">{bi(locale, "step losses", "步骤损失")}</div>
      <div className="ie-battle-result-casualties" data-testid={`ie-battle-result-${side}-units`}>
        {casualtySummary(units, locale)}
      </div>
      {dreadnoughts > 0 && (
        <div className="ie-battle-result-detail">
          {bi(locale, "Dreadnought steps", "无畏舰损失")}: {dreadnoughts}
        </div>
      )}
      {won && <div className="ie-battle-result-tag">{bi(locale, "Winner", "胜方")}</div>}
    </div>
  );
};

const BattleResultBody = ({report, locale, t}: {
  report: BattleReport;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
}) => {
  const kind = report.kind === "naval"
    ? bi(locale, "Naval battle", "海战")
    : bi(locale, "Land battle", "陆战");
  const winner = report.winner === "attacker" ? report.attacker : report.defender;
  const hasDice = report.attackerRoll !== undefined || report.defenderRoll !== undefined;
  const notes: string[] = [];
  if (report.mines > 0) notes.push(`${bi(locale, "Mine hits", "水雷命中")}: ${report.mines}`);
  if (report.trench) notes.push(bi(locale, "Trench battle: the attacker paid +1 loss", "堑壕战：进攻方额外承受 1 点损失"));
  if (report.noRetreat) notes.push(bi(locale, "The defeated force could not retreat", "战败方无法撤退"));
  else if (report.retreatTo) notes.push(`${bi(locale, "Retreats to", "撤退至")}: ${spaceLabel(report.retreatTo, locale)}`);
  return (
    <div className="ie-battle-result" data-testid="ie-battle-result">
      <header className="ie-battle-result-head">
        <div className="ie-battle-result-space">
          {kind} · {spaceLabel(report.from, locale)} → {spaceLabel(report.to, locale)}
        </div>
        <div className="ie-battle-result-matchup">
          {t.seats[report.attacker]} vs {t.seats[report.defender]}
        </div>
        <div className="ie-battle-result-winner" data-testid="ie-battle-result-winner">
          {bi(locale, "Winner", "胜方")}: {t.seats[winner]}
          {report.decisive ? ` · ${bi(locale, "decisive", "决定性胜利")}` : ""}
        </div>
      </header>

      <dl className="ie-battle-result-facts">
        <div>
          <dt>{bi(locale, "Rolls", "掷骰")}</dt>
          <dd data-testid="ie-battle-result-rolls">
            {hasDice ? `${report.attackerRoll ?? "—"} / ${report.defenderRoll ?? "—"}` : bi(locale, "No dice", "未掷骰")}
          </dd>
        </div>
        <div>
          <dt>{bi(locale, "Differential", "差值")}</dt>
          <dd data-testid="ie-battle-result-differential">{signed(report.differential)}</dd>
        </div>
        <div>
          <dt>{bi(locale, "DRM", "DRM")}</dt>
          <dd>{signed(report.attackerDrm)} / {signed(report.defenderDrm)}</dd>
        </div>
      </dl>

      <section className="ie-battle-result-drms" data-testid="ie-battle-result-drms">
        <h3>{bi(locale, "Dice modifiers", "掷骰修正来源")}</h3>
        <div className="ie-battle-result-sides">
          <BattleDrmList
            side="attacker"
            breakdown={report.drmSources}
            total={report.attackerDrm}
            locale={locale}
            testId="ie-battle-result-drm-attacker"
          />
          <BattleDrmList
            side="defender"
            breakdown={report.drmSources}
            total={report.defenderDrm}
            locale={locale}
            testId="ie-battle-result-drm-defender"
          />
        </div>
      </section>

      <section className="ie-battle-result-damage" data-testid="ie-battle-result-damage">
        <h3>{bi(locale, "Damage taken", "承受伤害")}</h3>
        <div className="ie-battle-result-sides">
          <BattleSide side="attacker" report={report} locale={locale} t={t}/>
          <BattleSide side="defender" report={report} locale={locale} t={t}/>
        </div>
      </section>

      {notes.length > 0 && (
        <ul className="ie-battle-result-notes" data-testid="ie-battle-result-notes">
          {notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      )}
    </div>
  );
};

export const BattleResultModal = ({report, open, locale, t, onClose}: BattleResultModalProps) => (
  <Modal
    open={open && report !== null}
    // A result is a report, not a required choice: it can be dismissed.
    dismissible
    locale={locale}
    title={bi(locale, "Battle result", "战斗结果")}
    onClose={onClose}
    testId="ie-battle-result-modal"
    backdropTestId="ie-battle-result-backdrop"
    closeTestId="ie-battle-result-close"
    className="ie-battle-result-modal"
    footer={(
      <button type="button" className="ie-btn primary" data-testid="ie-battle-result-dismiss" onClick={onClose}>
        {bi(locale, "Got it", "知道了")}
      </button>
    )}
  >
    {report !== null && <BattleResultBody report={report} locale={locale} t={t}/>}
  </Modal>
);
