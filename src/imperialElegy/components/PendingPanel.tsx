import React from "react";
import {ImperialElegyState, PendingOption, Power, SpaceId} from "../types";
import {SPACES, spaceLabel} from "../constant/spaces";
import {CARD_BY_ID} from "../engine/deck";
import {IEBadge, IEPanel} from "./theme";
import {ieT} from "./i18n";
import {BATTLE_STAGE, OPTION_ZH, PROMPT_ZH, bi, unitLabel} from "./boardHelpers";
import {CardChoice, CardChoiceFace} from "./CardChoice";

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
  doAction: (fn: () => void) => void;
  moves: Record<string, (...args: any[]) => void>;
  /** Docked above the board: the panel is pinned in place while the board scrolls. */
  dock?: boolean;
  /** Docked and collapsed into a one-line summary. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
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

export const PendingPanel = ({
  G, pending, canDecide, pendingKind, pendingPrompt, optionLabel, optionFace, optionAction, canDecline,
  pendingSpaceTargets, viewer, locale, t, jihadDecision, jihadReason, doAction, moves,
  dock = false, collapsed = false, onToggleCollapsed,
}: PendingPanelProps) => {
  const toggle = onToggleCollapsed === undefined ? null : (
    <button
      type="button"
      className="ie-dock-toggle"
      data-testid="ie-dock-toggle"
      aria-expanded={collapsed ? "false" : "true"}
      onClick={onToggleCollapsed}
    >
      {collapsed ? bi(locale, "Expand", "展开") : bi(locale, "Collapse", "收起")}
    </button>
  );
  // One-line readout for the collapsed dock, so the pending state stays legible
  // without covering the map.
  const summary = pending
    ? `${t.pendingFor}: ${t.seats[pending.power]} · ${pendingPrompt}`
    : G.battle
      ? `${bi(locale, G.battle.kind === "naval" ? "Naval battle" : "Land battle", G.battle.kind === "naval" ? "海战" : "陆战")} · ${spaceLabel(G.battle.from, locale)} → ${spaceLabel(G.battle.to, locale)}`
      : G.result
        ? `${t.gameOver}: ${G.result.winners.map((p) => t.seats[p]).join(", ")}`
        : "";

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

  return (
    <IEPanel
      className={dock ? "ie-dock-panel" : ""}
      title={t.pending}
      actions={pendingKind !== null || toggle !== null ? (
        <div className="ie-panel-actions">
          {pendingKind !== null && <IEBadge tone="warn">{pendingKind}</IEBadge>}
          {toggle}
        </div>
      ) : undefined}
    >
      {collapsed ? (
        <div className="ie-dock-summary" data-testid="ie-dock-summary">{summary}</div>
      ) : (
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
                            actions={options.map((o) => ({
                              // A card with several printed modes needs the mode
                              // named on the buttons; a single use of a card keeps
                              // a short verb under the face.
                              label: options.length > 1 || optionAction === undefined ? optionLabel(o) : optionAction(o),
                              testId: `ie-pending-option-${o.id}`,
                              title: optionLabel(o),
                              onChoose: () => doAction(() => moves.resolvePending(o.id)),
                            }))}
                          />
                        );
                      })}
                    </div>
                  )}
                  {(rest.length > 0 || canDecline) && (
                    <div className="ie-pending-options">
                      {rest.map((o) => (
                        <button key={o.id} data-testid={`ie-pending-option-${o.id}`} onClick={() => doAction(() => moves.resolvePending(o.id))}>{optionLabel(o)}</button>
                      ))}
                      {canDecline && <button className="ie-btn secondary" onClick={() => doAction(() => moves.declinePending())}>{t.decline}</button>}
                    </div>
                  )}
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
        </>
      )}
    </IEPanel>
  );
};
