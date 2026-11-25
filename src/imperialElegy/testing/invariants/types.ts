/**
 * Invariant vocabulary for the Imperial Elegy test system.
 *
 * A *violation* is one observed break of one numbered constraint.  Numbering
 * follows `docs/imperial-elegy/INVARIANTS.md`: `A` structural, `B` printed-rule
 * state, `C` transition (before/after), `D` protocol, `E` terminal.
 *
 * Two axes decide when a violation is worth paying for:
 *
 * - `level` — `cheap` runs after every dispatched action (~0.2 ms); `full` runs
 *   at phase boundaries and on a step cadence because it recomputes board
 *   derivations (~2-5 ms).
 * - `severity` — `error` means the state is impossible under the printed rules
 *   and the strict gate fails on it.  `warn` means the printed rules permit the
 *   state transiently (5.5.3 lets a retreating stack overstack until its owner's
 *   next impulse) or the check is known to be incomplete; warns are reported
 *   but never gate.
 */
import type {ImperialElegyState} from "../../types";

export type CheckLevel = "cheap" | "full";

export type Severity = "error" | "warn";

export interface Violation {
  /** Catalog id, e.g. `A01`. */
  code: string;
  /** Printed rule citation, e.g. `9.x / 10.x`. */
  rule: string;
  severity: Severity;
  /** Where in `G` the break is visible, e.g. `powers.GE.hand[2]`. */
  path: string;
  /** The offending value (JSON-serializable). */
  observed: unknown;
  /** What the printed constraint requires. */
  expected: string;
  /** One sentence for a report line. */
  msg: string;
}

export interface CheckContext {
  level: CheckLevel;
  /**
   * The state before the action that produced `G`.  Reserved for the `C`
   * (transition) group; the `A` group ignores it.
   */
  before?: ImperialElegyState;
  /**
   * True when `G` is the state after a phase change.  Whole-state work (A16's
   * JSON round trip serializes the full state) is only worth its cost there: on
   * a mid-phase cadence step the structural scan covers the same failure modes
   * for a fraction of the time.
   */
  phaseBoundary: boolean;
}

export interface Invariant {
  code: string;
  rule: string;
  level: CheckLevel;
  severity: Severity;
  title: string;
  check(G: ImperialElegyState, ctx: CheckContext): Violation[];
}

/** Bind a violation factory to one catalog entry. */
export const violationAt = (inv: Invariant) =>
  (path: string, observed: unknown, expected: string, msg: string): Violation => ({
    code: inv.code,
    rule: inv.rule,
    severity: inv.severity,
    path,
    observed,
    expected,
    msg,
  });
