/**
 * 8.0 — placing a major-power influence marker.
 *
 * The panel used to be two dropdowns (target power, track) plus a "place"
 * button: three interactions for a 1 CP action.  The matrix below is now the
 * control itself — every track value is a button, so one click on "GE · TE 3"
 * places a marker on Germany's TE track.  Nothing is preselected and no state
 * survives between placements, which also removes the stale-target mistake of
 * the old form (pick a power, forget which one is still selected).
 *
 * A marker cannot be taken back (the client runs without undo), so each track
 * button still arms before it fires unless the `confirmActions` preference is
 * off.  Spectators and non-active seats see the same matrix as plain text.
 */
import React from "react";
import {ImperialElegyState, Power} from "../types";
import {IEBadge, IEPanel} from "./theme";
import {ieT} from "./i18n";
import {POWER_KEYS, bi} from "./boardHelpers";
import {ConfirmButton} from "./ConfirmButton";
import {readConfirmActions} from "./preferences";

export type MpitTrack = "te" | "ta" | "neutral";

export interface MpitPanelProps {
  G: ImperialElegyState;
  canAct: boolean;
  viewer: Power | null;
  me: ImperialElegyState["powers"][Power] | null;
  cpBudget: () => number;
  canSpend: (cost: number) => boolean;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  doAction: (fn: () => void, describe?: {label: string; reason?: string}) => void;
  moves: Record<string, (...args: any[]) => void>;
  /** The live `confirmActions` preference; omitted means "read the stored one". */
  confirmActions?: boolean;
}

const TRACKS: readonly MpitTrack[] = ["te", "ta", "neutral"];

export const mpitTrackLabel = (t: ReturnType<typeof ieT>, track: MpitTrack): string =>
  track === "te" ? t.mpitTe : track === "ta" ? t.mpitTa : t.mpitNeutral;

export const MpitPanel = ({
  G, canAct, viewer, me, cpBudget, canSpend, locale, t, doAction, moves, confirmActions: liveConfirm,
}: MpitPanelProps) => {
  // One read per mount, like PhaseActions: the preference is display-only.
  const storedConfirm = React.useMemo(() => readConfirmActions(), []);
  const confirmActions = liveConfirm ?? storedConfirm;
  const place = (power: Power, track: MpitTrack) =>
    doAction(() => moves.placeMpit(power, track), {label: t.placeMpit});

  return (
    <IEPanel
      title={`${t.mpit} · ${bi(locale, "Influence track", "影响力轨")}`}
      actions={<IEBadge>{bi(locale, "1 CP per marker", "每标记 1 CP")}</IEBadge>}
    >
      <div data-testid="ie-mpit">
        {canAct ? (
          <div className="ie-inline" data-testid="ie-mpit-controls">
            <IEBadge tone={me ? (viewer as string).toLowerCase() : "default"}>{t.cp}: {cpBudget()}</IEBadge>
            <span className="ie-muted">
              {bi(locale, "Tap a track value to place a marker there (1 CP).", "点按轨道数字，即在该轨放置 1 个标记（1 CP）。")}
            </span>
          </div>
        ) : <div className="ie-muted">{bi(locale, "Available during your own impulse.", "仅在你的行动轮可用。")}</div>}
        <div
          className="ie-mpit-grid"
          role={canAct ? "group" : undefined}
          aria-label={canAct ? bi(locale, "Place major-power influence", "放置大国影响力") : undefined}
        >
          {POWER_KEYS.map((p) => (
            <div key={p} className={`ie-mpit-cell${p === viewer ? " mine" : ""}`}>
              <b>{t.seats[p]}</b>
              {TRACKS.map((track) => {
                const label = mpitTrackLabel(t, track);
                const count = G.powers[p].mpit[track];
                if (!canAct) {
                  return <span key={track} className="ie-mpit-value">{label} {count}</span>;
                }
                return (
                  <ConfirmButton
                    key={track}
                    type="button"
                    className="ie-mpit-track"
                    data-testid={`ie-mpit-place-${p}-${track}`}
                    disabled={!canSpend(1)}
                    title={`${t.placeMpit} · ${t.seats[p]} ${label}`}
                    aria-label={`${t.placeMpit} · ${t.seats[p]} ${label}`}
                    confirmLabel={`${confirmActions ? bi(locale, "Confirm", "确认") : ""} ${t.seats[p]} ${label}`.trim()}
                    confirm={confirmActions}
                    onConfirm={() => place(p, track)}
                  >
                    <span aria-hidden="true">{label}</span>
                    <b>{count}</b>
                  </ConfirmButton>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </IEPanel>
  );
};
