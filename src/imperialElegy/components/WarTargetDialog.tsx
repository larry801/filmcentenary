/**
 * The target chooser for a home-card war declaration.
 *
 * Bismarck, Aux Armes, the Russo-Turkish Wars and Jihad all print "declare war
 * using this card's CP value".  The declaration entitlement those cards leave
 * used to be silent: the seat had to guess which space on the map was a legal
 * objective before the Orders panel would even show a Declare war control.  The
 * board now opens this dialog as soon as the entitlement is live, so the player
 * decides the target first and the ordinary declaration form (aim, CP, second
 * objective, 14.1 clauses) then opens on the chosen space.
 *
 * The list itself comes from `engine/declarationTargets.ts`: every row is a
 * declaration `declareWar` accepts, so the dialog can never offer a refused
 * move.  Rows are grouped by the defending power; when the card leaves the aim
 * open (Aux Armes, RU-9, Jihad) an aim chip row filters the groups.
 */
import React from "react";
import {bi} from "./boardHelpers";
import {useFocusTrap} from "./useFocusTrap";
import {spaceLabel} from "../constant/spaces";
import {MINOR_POWER_HOMES} from "../constant/setup";
import type {WarTargetCandidate} from "../engine/declarationTargets";
import type {WarDeclarationAim} from "../engine/rules";
import type {Power} from "../types";
import type {ieT} from "./i18n";

export interface WarTargetDialogProps {
  open: boolean;
  candidates: readonly WarTargetCandidate[];
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  /** The card sentence that funds the declaration, e.g. "Otto von Bismarck". */
  cardTitle: string;
  onChoose: (candidate: WarTargetCandidate) => void;
  /** Dismisses the dialog; the prompt in the Orders panel reopens it. */
  onClose: () => void;
}

/** The stable grouping key of a candidate's defender. */
const targetKey = (candidate: WarTargetCandidate): string =>
  typeof candidate.target === "string" ? candidate.target : `minor:${candidate.target.minor}`;

/** The printed name of a candidate's target (a player power or a minor home). */
const targetLabel = (candidate: WarTargetCandidate, locale: "en" | "zh_CN", t: ReturnType<typeof ieT>): string => {
  if (typeof candidate.target === "string") return t.seats[candidate.target as Power];
  const home = MINOR_POWER_HOMES[candidate.target.minor];
  return home === undefined ? candidate.target.minor : spaceLabel(home, locale);
};

const aimLabel = (aim: WarDeclarationAim, t: ReturnType<typeof ieT>): string =>
  aim === "conquest" ? t.conquest : aim === "liberation" ? t.liberation : t.unification;

export const WarTargetDialog = ({
  open, candidates, locale, t, cardTitle, onChoose, onClose,
}: WarTargetDialogProps) => {
  const dialogRef = useFocusTrap<HTMLDivElement>({active: open, onEscape: onClose});
  // A stale choice from a previous card falls back to the first aim this card
  // offers; the dialog is reopened for each new entitlement, so it cannot drift.
  const [aimChoice, setAimChoice] = React.useState<WarDeclarationAim | null>(null);
  if (!open) return null;
  if (candidates.length === 0) return null;

  const aims = [...new Set(candidates.map((candidate) => candidate.aim))];
  const aim = aimChoice !== null && aims.includes(aimChoice) ? aimChoice : aims[0];
  const shown = candidates.filter((candidate) => candidate.aim === aim);

  // Group in candidate order: players first (seat order), then independent
  // minors.  The engine's enumeration already produces that order.
  const groups: {key: string; label: string; rows: WarTargetCandidate[]}[] = [];
  for (const candidate of shown) {
    const key = targetKey(candidate);
    const last = groups[groups.length - 1];
    if (last !== undefined && last.key === key) last.rows.push(candidate);
    else groups.push({key, label: targetLabel(candidate, locale, t), rows: [candidate]});
  }

  const title = bi(locale, `Choose the war target — ${cardTitle}`, `选择战争目标 — ${cardTitle}`);

  return (
    <div
      className="ie-choice-backdrop"
      data-testid="ie-war-target-dialog"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        className="ie-choice-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="ie-choice-head">
          <h2 className="ie-choice-title">{title}</h2>
          <button
            type="button"
            className="ie-btn secondary"
            data-testid="ie-war-target-close"
            aria-label={bi(locale, "Close", "关闭")}
            title={bi(locale, "Close (Esc)", "关闭（Esc）")}
            onClick={onClose}
          >
            ✕
          </button>
        </header>
        <div className="ie-choice-body">
          <p className="ie-hint" data-testid="ie-war-target-hint">
            {bi(locale,
              "This card funds the declaration with its printed CP. Pick the defending power and the objective space; the declaration form then opens on that space for the optional clauses.",
              "本牌以印制的 CP 支付宣战费用。先选择防守方与目标空间；选定后可在宣战面板确认并添加可选条款。")}
          </p>
          {aims.length > 1 && (
            <div
              className="ie-inline"
              role="group"
              aria-label={bi(locale, "War aim", "战争目标")}
              data-testid="ie-war-target-aims"
            >
              {aims.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="ie-chip"
                  data-testid={`ie-war-target-aim-${option}`}
                  aria-pressed={option === aim}
                  onClick={() => setAimChoice(option)}
                >
                  {aimLabel(option, t)}
                </button>
              ))}
            </div>
          )}
          {groups.map((group) => (
            <section key={group.key} className="ie-action-group" data-testid={`ie-war-target-group-${group.key}`}>
              <h5 className="ie-action-group-title">{group.label}</h5>
              <div className="ie-actions-grid">
                {group.rows.map((candidate) => (
                  <button
                    key={`${candidate.aim}:${candidate.objective}`}
                    type="button"
                    className="ie-btn secondary ie-mini"
                    data-testid={`ie-war-target-${candidate.objective}`}
                    onClick={() => onChoose(candidate)}
                  >
                    {spaceLabel(candidate.objective, locale)}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <footer className="ie-choice-foot">
          <span className="ie-muted" data-testid="ie-war-target-count">
            {bi(locale, `${shown.length} declarations`, `${shown.length} 个可选宣战`)}
          </span>
        </footer>
      </div>
    </div>
  );
};
