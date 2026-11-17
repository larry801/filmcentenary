/**
 * Move feedback: telling a refused action apart from one the engine accepted.
 *
 * boardgame.io answers a refused move with a bare `INVALID_MOVE` — no reason,
 * and the rejection is still broadcast to the client.  What it does *not* do is
 * advance `_stateID`: a successful move increments the state counter once, a
 * refused one leaves it exactly where it was.  Comparing the counter before
 * and after the click is therefore a reliable, engine-owned signal, whereas
 * comparing `G` by reference is not (a successful move can leave every field
 * the UI happens to look at unchanged, and the old `G` closure never sees the
 * new state anyway).
 *
 * The local hotseat client applies a move within a tick, so 400 ms is generous;
 * a remote client can queue the update behind another packet, so it gets four
 * seconds before the board dares to call the move refused.  The probe only
 * ever runs for a move the player started through a labelled control — the bot
 * driver keeps calling raw moves and must never raise a toast.
 *
 * Pure: no React, no timers, no game state.  The hook owns the scheduling.
 */

/** How long to wait for `_stateID` to move before calling an action refused. */
export const FEEDBACK_TIMEOUT_MS = 400;
/** Remote updates can arrive after another player's packet; wait longer. */
export const FEEDBACK_TIMEOUT_REMOTE_MS = 4000;
/** How often the probe re-reads the state counter while it waits. */
export const FEEDBACK_POLL_MS = 40;

/**
 * A refusal probe is only meaningful while the host actually supplies the
 * boardgame.io state counter.  Static-markup suites render the board without
 * one; they must not schedule toasts that can never be resolved.
 */
export const canProbeRefusal = (stateId: number | undefined): stateId is number =>
  typeof stateId === "number";

/** True when the counter did not advance — i.e. the engine refused the move. */
export const moveWasRefused = (before: number, after: number | undefined): boolean =>
  canProbeRefusal(after) && after === before;

/** The probe budget for this board: local hotseat reacts immediately. */
export const feedbackTimeoutMs = (hotseat: boolean): number =>
  hotseat ? FEEDBACK_TIMEOUT_MS : FEEDBACK_TIMEOUT_REMOTE_MS;

/** The human-readable description a control attaches to the move it runs. */
export interface MoveDescription {
  /** The action the player pressed ("Play for 3 CP", "Declare war"). */
  label: string;
  /** The UI's own best reason, when it already knows one. */
  reason?: string;
}

/** The board's action wrapper, shared by every panel that can run a move. */
export type DoAction = (fn: () => void, describe?: MoveDescription) => void;

export interface RefusalNotice {
  title: string;
  body: string;
  tone: "warn";
}

/**
 * The toast copy for a refused move.  The engine supplies no reason, so the
 * body is either the reason the control computed or a generic "the rules do
 * not allow that right now"; the title always names the action.
 */
export const refusalNotice = (
  describe: MoveDescription,
  bi: (en: string, zh: string) => string,
): RefusalNotice => ({
  title: bi(`Not allowed: ${describe.label}`, `无法执行：${describe.label}`),
  body: describe.reason ?? bi(
    "The rules do not allow that action right now.",
    "当前规则不允许该操作。",
  ),
  tone: "warn",
});
