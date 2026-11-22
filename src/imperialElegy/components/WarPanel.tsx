import React from "react";
import {ImperialElegyState, Power} from "../types";
import {SPACES, spaceLabel} from "../constant/spaces";
import {MINOR_POWER_HOMES} from "../constant/setup";
import {POWER_DEFS} from "../constant/powers";
import {canPassWarImpulse, canSurrender, holdsWarImpulse, isLoneMinorWar, loneMinorDefender, neutralJoinEligibility, warAllPassed} from "../engine/limitedWar";
import {treatyOptionLabel} from "../engine/treatyChoice";
import {BALANCE_OF_POWER_CARD} from "../moves";
import {cardById} from "../engine/deck";
import {IEBadge, IEPanel} from "./theme";
import {ieT} from "./i18n";
import {bi, powerOrMinorLabel} from "./boardHelpers";
import {RuleLink} from "./RuleRef";

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
  doAction: (fn: () => void, describe?: {label: string; reason?: string}) => void;
  moves: Record<string, (...args: any[]) => void>;
  onOpenReference?: (anchor: string) => void;
}

/**
 * A non-player power's printed name in the UI language.
 *
 * `loneMinorDefender` returns the minor's *name* ("Denmark"), not a space id,
 * so the space label is reached through the minor's printed home space; a
 * minor with no home falls back to the name as printed on its counters.
 */
const minorName = (t: ReturnType<typeof ieT>, locale: "en" | "zh_CN", minor: string | null): string => {
  if (minor === null || minor === "") return "—";
  const home = MINOR_POWER_HOMES[minor];
  if (home !== undefined && SPACES[home] !== undefined) return spaceLabel(home, locale);
  const def = (POWER_DEFS as unknown as Record<string, {name?: string; nameZh?: string}>)[minor];
  if (def?.name !== undefined) return locale === "zh_CN" ? def.nameZh ?? def.name : def.name;
  return minor;
};

export const WarPanel = (props: WarPanelProps) => {
  const {
    war, G, viewer, active, phase, locale, t, warStatusLabel, warAimLabel,
    warBelligerents, isPrincipal, isBelligerent, eliminated, pending,
    warBudgetRows, warDefenderMinors, callableAllies, warAllyValue, setWarAlly,
    callableMinors, warMinorValue, setWarMinor, confirmSurrender, setConfirmSurrender,
    doAction, moves, onOpenReference,
  } = props;
  // Aux Armes: a neutral power may volunteer for the defending side without an
  // invitation when the card's two-key/two-power clause opened the war.
  const neutralJoin = viewer !== null && pending === null && !eliminated
    && (war.status === "warAim" || war.status === "alliance")
    ? neutralJoinEligibility(G, war, viewer)
    : null;
  // 13.7: the defending seat may play one card for its CP war budget while the
  // war is still in its war-aim/alliance steps.
  const isDefender = viewer !== null && (viewer === war.defender || war.defenderAllies.includes(viewer));
  const budgetCards = viewer === null || !isDefender || eliminated || pending !== null
    || !["warAim", "alliance"].includes(war.status)
    || (war.defenderBudgetCards ?? []).some((entry) => entry.power === viewer)
    ? []
    : G.powers[viewer].hand.filter((id) => {
        const card = cardById(id);
        return card.type !== "mandatory" && card.type !== "mandatoryResponse";
      });
  return (
    <IEPanel title={`${t.phases.wartime} · ${warStatusLabel}`} actions={<IEBadge tone="warn">{warStatusLabel}</IEBadge>}>
      <div className="ie-war" data-testid="ie-war">
        <div className="ie-rule-ref-row">
          <RuleLink anchor="chart:war-aims-minors" locale={locale} onOpenReference={onOpenReference}/>
        </div>
        <div className="ie-war-sides">
          <div className="ie-war-side">
            <div className="ie-war-power">{t.seats[war.attacker]}</div>
            <div className="ie-muted">{bi(locale, "Attacker", "进攻方")}</div>
            {war.attackerAllies.length > 0 && <div>{bi(locale, "Allies", "盟友")}: {war.attackerAllies.map((p) => t.seats[p]).join(", ")}</div>}
          </div>
          <div className="ie-war-arrow">→</div>
          <div className="ie-war-side">
            <div className="ie-war-power" data-testid="ie-war-defender">
              {isLoneMinorWar(war)
                ? minorName(t, locale, loneMinorDefender(war))
                : powerOrMinorLabel(t, locale, war.defender)}
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
        {budgetCards.length > 0 && (
          <div className="ie-inline" data-testid="ie-war-budget-cards">
            <span className="ie-muted">{bi(locale, "13.7: play a card for your war budget", "13.7：打出一张牌增加战争预算")}:</span>
            {budgetCards.map((id) => {
              const card = cardById(id);
              return (
                <button key={id} className="ie-btn secondary ie-btn-xs" onClick={() => doAction(() => moves.playWarBudgetCard(id), {label: bi(locale, "Play for war budget", "打出以增加战争预算")})}>
                  {locale === "zh_CN" ? card.titleZh : card.title} (+{card.cp})
                </button>
              );
            })}
          </div>
        )}
        <div><strong>{t.pass}:</strong> {war.passed.map((p) => t.seats[p]).join(", ") || "—"}</div>
        {war.initiative.length > 0 && <div><strong>{bi(locale, "Initiative", "先手")}:</strong> {war.initiative.map((p) => t.seats[p]).join(" → ")}</div>}
        {war.treaties.length > 0 && <div data-testid="ie-war-treaties"><strong>{t.treaty}:</strong> {war.treaties.map((option) => treatyOptionLabel(option, locale)).join(", ")}</div>}
        <div className="ie-muted">{bi(locale, "Status", "状态")}: {warStatusLabel} · {bi(locale, "Started turn", "开始回合")} {war.startedTurn}</div>

        {isBelligerent && !eliminated && pending === null && (
          <div className="ie-war-controls">
            {/* 13.2/14.3: the attacker opens the aim and initiative steps; the
                defender's own choices there (13.7, 8.2, 13.6) are below. */}
            {viewer === war.attacker && (war.status === "warAim" || war.status === "alliance") && (
              <button className="ie-btn" onClick={() => doAction(() => moves.startWarManeuver(), {label: t.startWar})}>{t.startWar}</button>
            )}
            {viewer === war.defender && war.defenderShift?.choice === true && (war.status === "warAim" || war.status === "alliance") && (
              <div className="ie-inline">
                <span className="ie-muted">{bi(locale, "Alliance shift (8.2)", "联盟转变（8.2）")}:</span>
                {(["te", "ta"] as const).map((side) => (
                  <button key={side} className="ie-btn secondary" onClick={() => doAction(() => moves.chooseAllianceShift(side), {label: bi(locale, "Alliance shift", "同盟转换")})}>
                    {side === "te" ? bi(locale, "Triple Entente", "协约国") : bi(locale, "Triple Alliance", "同盟国")}
                  </button>
                ))}
              </div>
            )}
            {war.status === "warAim" && viewer === war.attacker && (
              <div className="ie-inline">
                <span className="ie-muted">{t.chooseAim}:</span>
                {(["conquest", "liberation", "unification"] as const).map((aim) => (
                  <button key={aim} className={`ie-btn secondary${war.warAim === aim ? " selected" : ""}`} aria-pressed={war.warAim === aim} onClick={() => doAction(() => moves.chooseWarAim(aim), {label: warAimLabel(aim)})}>{warAimLabel(aim)}</button>
                ))}
              </div>
            )}
            {isPrincipal && (
              <div className="ie-inline">
                <select className="ie-select" value={warAllyValue ?? ""} disabled={callableAllies.length === 0} onChange={(e) => setWarAlly(e.target.value as Power)} title={t.callAlly}>
                  {callableAllies.length === 0 && <option value="">{bi(locale, "No allied hand", "无盟友手牌")}</option>}
                  {callableAllies.map((p) => <option key={p} value={p}>{t.seats[p]}</option>)}
                </select>
                <button className="ie-btn" disabled={callableAllies.length === 0 || warAllyValue === undefined} onClick={() => doAction(() => moves.callWarAlly(warAllyValue!), {label: t.callAlly})}>{t.callAlly}</button>
              </div>
            )}
            {isPrincipal && war.status === "alliance" && callableMinors.length > 0 && (
              <div className="ie-inline" data-testid="ie-call-minor">
                <select className="ie-select" data-testid="ie-call-minor-select" value={warMinorValue} onChange={(e) => setWarMinor(e.target.value)} title={t.callMinor}>
                  {callableMinors.map((minor) => <option key={minor} value={minor}>{minor}</option>)}
                </select>
                <button className="ie-btn" data-testid="ie-call-minor-button" disabled={warMinorValue === ""} onClick={() => doAction(() => moves.callWarMinor(warMinorValue), {label: t.callMinor})}>{t.callMinor}</button>
              </div>
            )}
            {/* 13.6: a defender may concede before the maneuver starts, at any
                impulse; 15.5 keeps the maneuver-time offer to the seat whose
                impulse is open (4.4), so the button matches the move. */}
            {isPrincipal && viewer !== null && canSurrender(G, viewer)
              && (war.status !== "maneuver" || holdsWarImpulse(G, viewer)) && (
              <button data-testid="ie-surrender" className={`ie-btn secondary${confirmSurrender ? " danger" : ""}`} onClick={() => {
                if (!confirmSurrender) { setConfirmSurrender(true); return; }
                doAction(() => moves.surrender(), {label: bi(locale, "Surrender", "投降")});
                setConfirmSurrender(false);
              }}>{confirmSurrender ? bi(locale, "Confirm surrender", "确认投降") : bi(locale, "Surrender", "投降")}</button>
            )}
            {/* 15.0: the impulse holder passes its impulse on ("战争停牌"), and a
                war already recorded as won (15.5) is sent on to its victory
                step by any belligerent. */}
            {phase === "wartime" && canPassWarImpulse(G, viewer!) && (
              <button className="ie-btn" disabled={war.passed.includes(viewer!)} onClick={() => doAction(() => moves.passWarMove(), {label: t.passWar})}>{t.passWar}</button>
            )}
            {/* 15.0's all-passed boundary is where a maneuver settles; the last
                pass already does this, so the button is the manual recovery for
                a settlement that returned without opening a decision. */}
            {phase === "wartime" && war.status === "maneuver" && warAllPassed(war) && (
              <button className="ie-btn" onClick={() => doAction(() => moves.resolveWar(), {label: t.resolveWar})}>{t.resolveWar}</button>
            )}
          </div>
        )}
        {war.forbidPlayerJoins === true && (
          <div className="ie-hint" data-testid="ie-war-forbid-join-active">
            {bi(locale,
              "Bismarck has forbidden other players from joining this war; minor power allies may still join.",
              "俾斯麦已禁止其他玩家参战；小国盟友仍可参战。")}
          </div>
        )}
        {war.allowNeutralJoin === true && (
          <div className="ie-hint" data-testid="ie-war-neutral-join-open">
            {bi(locale,
              "Aux Armes opened this war: neutral powers may join the defending side.",
              "《公民们，拿起武器！》使中立国可以加入防守方参战。")}
          </div>
        )}
        {neutralJoin?.ok && (
          <div className="ie-war-controls" data-testid="ie-war-neutral-join">
            <button
              className="ie-btn"
              onClick={() => doAction(
                () => moves.joinWarAsNeutral(neutralJoin.cardId ?? undefined),
                {label: bi(locale, "Join the war", "参战")},
              )}
            >
              {bi(locale, `Join the war against ${t.seats[war.attacker]}`, `加入对${t.seats[war.attacker]}的战争`)}
            </button>
          </div>
        )}
        {viewer === "UK" && !eliminated && pending === null && !warBelligerents.includes("UK")
          && (war.status === "warAim" || war.status === "alliance")
          && G.powers.UK.hand.includes(BALANCE_OF_POWER_CARD) && (
          <div className="ie-war-controls">
            <button className="ie-btn" onClick={() => doAction(() => moves.playBalanceOfPower(), {label: bi(locale, "Balance of Power", "势力均衡")})}>
              {bi(locale, "Balance of Power: become the primary defender", "势力均衡：成为主要防守方")}
            </button>
          </div>
        )}
      </div>
    </IEPanel>
  );
};
