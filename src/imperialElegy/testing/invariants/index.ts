/**
 * The invariant registry and the one entry point the harness and the tests use.
 *
 * `checkAll(G, {level})` runs every registered check at or below `level`.
 * Cheap work runs after every action; full work also recomputes the board
 * derivations, so the harness only pays for it at phase boundaries and on a
 * step cadence.
 */
import type {ImperialElegyState} from "../../types";
import {STRUCTURAL} from "./structural";
import type {CheckContext, CheckLevel, Invariant, Violation} from "./types";

export const INVARIANTS: readonly Invariant[] = [...STRUCTURAL];

export interface CheckOptions {
  level?: CheckLevel;
  before?: ImperialElegyState;
}

/** Run the registry.  `full` implies every `cheap` check. */
export const checkAll = (G: ImperialElegyState, options: CheckOptions = {}): Violation[] => {
  const level: CheckLevel = options.level ?? "cheap";
  const ctx: CheckContext = {level, before: options.before};
  const out: Violation[] = [];
  for (const invariant of INVARIANTS) {
    if (level !== "full" && invariant.level !== "cheap") continue;
    try {
      out.push(...invariant.check(G, ctx));
    } catch (err) {
      out.push({
        code: invariant.code,
        rule: invariant.rule,
        severity: "error",
        path: "G",
        observed: String(err),
        expected: "the check runs",
        msg: `${invariant.code} threw: ${String((err as Error)?.stack ?? err)}`,
      });
    }
  }
  return out;
};

export const errorsOf = (violations: readonly Violation[]): Violation[] =>
  violations.filter((v) => v.severity === "error");

export const formatViolation = (v: Violation): string =>
  `${v.code} ${v.rule} ${v.path}: ${v.msg}`;

export const formatViolations = (violations: readonly Violation[], limit = 8): string =>
  violations.slice(0, limit).map(formatViolation).join("; ");

/** Count violations per catalog id, for a batch report. */
export const countByCode = (violations: readonly Violation[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const v of violations) counts[v.code] = (counts[v.code] ?? 0) + 1;
  return counts;
};

export type {CheckContext, CheckLevel, Invariant, Violation};
export {STRUCTURAL};
