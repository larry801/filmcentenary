/**
 * Stable state hashing for the simulation suites.
 *
 * `JSON.stringify` output depends on insertion order, which is not something a
 * golden test can rely on across refactors, so keys are sorted.  FNV-1a 32-bit
 * keeps the digest short enough to paste into a golden file while staying
 * stable across Node versions (no crypto dependency, no endianness).
 */
import type {ImperialElegyState} from "../types";

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value === null || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    if (record[key] === undefined) continue;
    sorted[key] = sortValue(record[key]);
  }
  return sorted;
};

/** Deterministic JSON for a state: sorted keys, `undefined` dropped. */
export const stableStringify = (value: unknown): string => JSON.stringify(sortValue(value));

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a over the UTF-16 code units of `text`, as 8 lowercase hex digits. */
export const fnv1a = (text: string): string => {
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

/**
 * The fields that make one position in the flow, so a golden entry can be
 * named without storing the whole state.
 */
export interface Position {
  turn: number;
  phase: string;
  gwTurn: number | null;
  cpRemaining: number;
  pending: string | null;
}

export const positionOf = (G: ImperialElegyState): Position => ({
  turn: G.turn,
  phase: G.phase,
  gwTurn: G.gw?.active ? G.gw.turn : null,
  cpRemaining: G.cpRemaining,
  pending: G.pending ? `${G.pending.kind}:${G.pending.power}` : null,
});

/** `hash` is the state digest; `position` is the cheap label beside it. */
export const hashState = (G: ImperialElegyState): {hash: string; position: Position} => ({
  hash: fnv1a(stableStringify(G)),
  position: positionOf(G),
});
