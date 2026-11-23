import React from "react";
import {ImperialElegyState, PendingOption, Power, SpaceId} from "../types";
import {spaceLabel} from "../constant/spaces";
import {IEBadge, IEPanel} from "./theme";
import {ieT} from "./i18n";
import {BATTLE_STAGE, bi} from "./boardHelpers";
import {CardChoice, CardChoiceFace} from "./CardChoice";
import {ConfirmButton} from "./ConfirmButton";
import {ScorePanel} from "./ScorePanel";
import {pendingOptionSafety} from "./pendingSafety";
import {BattleDrmList} from "./BattleDrmList";
import {battleDrmBreakdown, battleDrmTotals} from "../engine/combat";

/**
 * A decision that prints its own decline option (13.4.2's aid search, the
 * treaty and war windows) must not also be given the panel's generic one: the
 * seat would see two identical 拒绝 buttons whose only difference is which
 * move they dispatch.
 */
export const pendingDeclinesItself = (
  pending: {options?: readonly {id: string}[]} | null | undefined,
): boolean => (pending?.options ?? []).some((option) => option.id === "decline" || option.id === "refuse");

export interface PendingPanelProps {
  G: ImperialElegyState;
  pending: ImperialElegyState["pending"];
  canDecide: boolean;
  pendingKind: string | null;
  pendingPrompt: string;
  optionLabel: (o: PendingOption) => string;
  /**
   * Printed face for an option that names a card or a National Goal, so the
   * decision shows the card itself instead of only its title.  Returns null
   * for every other option (spaces, powers, units, "continue", hidden bids).
   */
  optionFace?: (o: PendingOption) => CardChoiceFace | null;
  /** Button text for a card/Goal option, shown under its face. */
  optionAction?: (o: PendingOption) => string;
  canDecline: boolean;
  pendingSpaceTargets: SpaceId[];
  viewer: Power | null;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  jihadDecision: {allowed: boolean; markers: number} | null;
  jihadReason: string | undefined;
  /** Public goal counts, forwarded to the final score breakdown. */
  goalCounts?: Partial<Record<Power, number>>;
  doAction: (fn: () => void, describe?: {label: string; reason?: string}) => void;
  /** The live `confirmActions` preference; a disabled preference keeps one-click choices. */
  confirmActions?: boolean;
  moves: Record<string, (...args: any[]) => void>;
  /** Docked above the board: the panel is pinned in place while the board scrolls. */
  dock?: boolean;
  /**
   * Raised as a dialog.  The dialog's backdrop covers the map, so the hint
   * cannot promise that a highlighted space is clickable: the option buttons
   * are the way to answer.
   */
  inModal?: boolean;
}

/** Pinned instruction strip for a map-targeting step (battle, naval battle, move). */
export const TargetDock = ({title, body, cancelLabel, onCancel}: {
  title: string;
  body: string;
  cancelLabel: string;
  onCancel: () => void;
}) => (
  <div className="ie-dock-target" data-testid="ie-dock-target" role="status">
    <strong>{title}</strong>
    <span>{body}</span>
    <button type="button" className="ie-dock-toggle" data-testid="ie-dock-target-cancel" onClick={onCancel}>
      {cancelLabel}
    </button>
  </div>
);

/**
 * The decision itself, without the panel chrome.
 *
 * Two hosts render it: the Orders panel (another seat's decision, a battle or
 * the result — reports rather than this seat's choice) and `DecisionModal` (the
 * decision *this* seat owes, which is a blocker and therefore a dialog).  The
 * option buttons, their test ids and the confirm wiring therefore cannot drift
 * between the two.
 */
export const DecisionBody = ({
  G, pending, canDecide, pendingKind, pendingPrompt, optionLabel, optionFace, optionAction, canDecline,
  pendingSpaceTargets, viewer, locale, t, jihadDecision, jihadReason, goalCounts, doAction, moves,
  confirmActions = true, inModal = false,
}: Omit<PendingPanelProps, "dock">) => {
  // Card and Goal options show their printed face; everything else (spaces,
  // powers, units, "continue") stays a button.  A card offered in several
  // modes (A061/A066, the UK's two auction sides) keeps one face and one
  // button per mode instead of repeating the face.
  const groups: {face: CardChoiceFace; options: PendingOption[]}[] = [];
  const rest: PendingOption[] = [];
  for (const o of pending?.options ?? []) {
    const face = optionFace ? optionFace(o) : null;
    if (face === null) {
      rest.push(o);
      continue;
    }
    const key = face.goal ? face.goal.id : face.card.id;
    const group = groups.find((entry) => (entry.face.goal ? entry.face.goal.id : entry.face.card.id) === key);
    if (group) group.options.push(o);
    else groups.push({face, options: [o]});
  }

  // Rule 18.2.1/19.5: the live battle's named modifiers and the totals they add
  // up to, computed once for both side panels.  A hand-written state may leave
  // `battle` undefined, so the check is truthiness, not `=== null`.
  const liveBattle = G.battle ?? null;
  const battleBreakdown = liveBattle === null ? null : battleDrmBreakdown(G, liveBattle);
  const battleTotals = liveBattle === null ? null : battleDrmTotals(G, liveBattle);

  return (
    <>
      {!pending ? <div className="ie-muted">{t.noPending}</div> : (
        <div className={`ie-pending${canDecide ? " urgent" : ""}`} data-testid="ie-pending">
          <h4>{canDecide ? t.yourDecision : `${t.waitingFor}: ${t.seats[pending.power]}`}</h4>
          <div className="ie-pending-kind" data-testid="ie-pending-kind">{pendingKind} · {t.pendingFor}: {t.seats[pending.power]}</div>
          <div className="ie-pending-prompt">{pendingPrompt}</div>
          {canDecide ? (
            <>
              <div className="ie-section-title">{t.pendingOptions}</div>
              {groups.length > 0 && (
                <div className="ie-choice-grid" data-testid="ie-pending-cards">
                  {groups.map(({face, options}) => {
                    const id = face.goal ? face.goal.id : face.card.id;
                    return (
                      <CardChoice
                        key={id}
                        locale={locale}
                        face={face}
                        testId={`ie-pending-card-${id}`}
                        actions={options.map((o) => {
                          const safety = pendingOptionSafety(pending, o, locale);
                          // A card with several printed modes needs the mode
                          // named on the buttons; a single use of a card keeps
                          // a short verb under the face.
                          const label = options.length > 1 || optionAction === undefined ? optionLabel(o) : optionAction(o);
                          return {
                            label,
                            testId: `ie-pending-option-${o.id}`,
                            title: safety.reason ?? optionLabel(o),
                            confirm: confirmActions && safety.confirm,
                            confirmLabel: bi(locale, `Confirm: ${label}`, `确认：${label}`),
                            onChoose: () => doAction(() => moves.resolvePending(o.id), {label: optionLabel(o)}),
                          };
                        })}
                      />
                    );
                  })}
                </div>
              )}
              {(rest.length > 0 || canDecline) && (
                <div className="ie-pending-options">
                  {rest.map((o) => {
                    const safety = pendingOptionSafety(pending, o, locale);
                    const label = optionLabel(o);
                    if (confirmActions && safety.confirm) {
                      return (
                        <ConfirmButton
                          key={o.id}
                          data-testid={`ie-pending-option-${o.id}`}
                          title={safety.reason}
                          confirm
                          confirmLabel={bi(locale, `Confirm: ${label}`, `确认：${label}`)}
                          onConfirm={() => doAction(() => moves.resolvePending(o.id), {label})}
                        >
                          {label}
                        </ConfirmButton>
                      );
                    }
                    return <button key={o.id} data-testid={`ie-pending-option-${o.id}`} onClick={() => doAction(() => moves.resolvePending(o.id), {label})}>{label}</button>;
                  })}
                  {canDecline && (() => {
                    const safety = pendingOptionSafety(pending, {id: "decline", label: t.decline}, locale);
                    if (confirmActions && safety.confirm) {
                      return (
                        <ConfirmButton
                          className="ie-btn secondary"
                          title={safety.reason}
                          confirm
                          confirmLabel={bi(locale, `Confirm: ${t.decline}`, `确认：${t.decline}`)}
                          onConfirm={() => doAction(() => moves.declinePending(), {label: t.decline})}
                        >
                          {t.decline}
                        </ConfirmButton>
                      );
                    }
                    return <button className="ie-btn secondary" onClick={() => doAction(() => moves.declinePending(), {label: t.decline})}>{t.decline}</button>;
                  })()}
                </div>
              )}
            </>
          ) : <div className="ie-muted ie-mt-6">{t.waitingOther}</div>}
          {canDecide && pendingSpaceTargets.length > 0 && (
            <div className="ie-hint">
              {inModal
                // The dialog's backdrop covers the map: a highlighted space is
                // not clickable through it, so the hint names the buttons.
                ? bi(locale, "Choose one of the options above to answer.", "请在上方选项中选择以完成决策。")
                : bi(locale, "The matching spaces are highlighted on the map.", "对应空间已在地图上高亮。")}
            </div>
          )}
        </div>
      )}
      {G.battle && (
        <div className="ie-battle" data-testid="ie-battle">
          <h4>{bi(locale, G.battle.kind === "naval" ? "Naval battle" : "Land battle", G.battle.kind === "naval" ? "海战" : "陆战")} · {spaceLabel(G.battle.from, locale)} → {spaceLabel(G.battle.to, locale)}</h4>
          <div>{t.seats[G.battle.attacker]} → {(t.seats as Record<string, string>)[G.battle.defenderNonPlayer ?? G.battle.defender] ?? String(G.battle.defenderNonPlayer ?? G.battle.defender)} · {bi(locale, "Step", "阶段")}: {BATTLE_STAGE[G.battle.stage] ? bi(locale, BATTLE_STAGE[G.battle.stage].en, BATTLE_STAGE[G.battle.stage].zh) : G.battle.stage}</div>
          {(G.battle.attackerRoll !== undefined || G.battle.defenderRoll !== undefined) && <div>{bi(locale, "Rolls", "掷骰")}: {G.battle.attackerRoll ?? "—"} / {G.battle.defenderRoll ?? "—"} · {bi(locale, "Diff", "差")} {G.battle.diff ?? "—"}</div>}
          <div>{bi(locale, "Losses", "损失")}: {G.battle.attackerLosses} / {G.battle.defenderLosses}</div>
          {/* The two totals alone hid which printed clause produced them, so the
              live panel lists every named modifier for both sides. */}
          <div className="ie-battle-drms">
            <BattleDrmList
              side="attacker"
              breakdown={battleBreakdown ?? undefined}
              total={battleTotals?.attacker ?? G.battle.attackerDrm}
              locale={locale}
              live
              testId="ie-battle-drm-attacker"
            />
            <BattleDrmList
              side="defender"
              breakdown={battleBreakdown ?? undefined}
              total={battleTotals?.defender ?? G.battle.defenderDrm}
              locale={locale}
              live
              testId="ie-battle-drm-defender"
            />
          </div>
          {G.battle.notes.length > 0 && <div className="ie-muted">{G.battle.notes.join(", ")}</div>}
          {viewer === "OT" && jihadDecision !== null && (
            <div className="ie-inline" data-testid="ie-jihad-actions">
              <button className="ie-btn" data-testid="ie-use-jihad" disabled={jihadDecision.allowed !== true} title={jihadReason} onClick={() => doAction(() => moves.useJihad(), {label: t.useJihad, reason: jihadReason})}>
                {t.useJihad} ({jihadDecision.markers})
              </button>
            </div>
          )}
        </div>
      )}
      {G.result && (
        <div className="ie-mt-8" data-testid="ie-final-score">
          <IEBadge tone="warn">{t.gameOver}: {G.result.winners.map((p) => t.seats[p]).join(", ")}</IEBadge>
          <ScorePanel G={G} locale={locale} viewer={viewer} goalCounts={goalCounts}/>
        </div>
      )}
    </>
  );
};

export const PendingPanel = (props: PendingPanelProps) => {
  const {canDecide, pendingKind, locale, t, dock = false} = props;

  return (
    <IEPanel
      className={dock ? "ie-dock-panel" : ""}
      title={t.pending}
      // Folding this panel must not hide a decision the player owes: the
      // folded bar says so, and the badge names the kind of decision.
      collapsedHint={canDecide
        ? bi(locale, "A decision is waiting here — expand to answer it.", "这里有待决事项，展开以继续。")
        : undefined}
      actions={pendingKind !== null ? (
        <div className="ie-panel-actions">
          <IEBadge tone="warn">{pendingKind}</IEBadge>
        </div>
      ) : undefined}
    >
      <DecisionBody {...props}/>
    </IEPanel>
  );
};
