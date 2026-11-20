/**
 * Named battle-DRM bookkeeping.
 *
 * A battle's two DRM totals are the sum of many printed clauses: rule 18.2.1's
 * land list, 19.5's naval list, national characteristics, event flags, combat
 * cards, the committed elite bonus and the force-point differential.  Seeing
 * only `+3 / -1` in the result report told the table nothing about *why*, so
 * every site that changes a total also records the clause it came from here.
 *
 * The stored list is deliberately partial: entries are appended only by the
 * code that knows the clause.  Derived entries (the FP differential and the
 * committed elite bonus) are computed on read by
 * `combat.ts#battleDrmBreakdown`, because support can still change after the
 * battle is created and must not be recorded twice.
 *
 * This module has no engine imports beyond the types, so `combatCards.ts` can
 * record a card's DRM without importing `combat.ts` (which imports *it*).
 */
import type {BattleDrmSource, BattleState} from "../types";

export type BattleSideName = "attacker" | "defender";

export interface BattleDrmDetail {
  space?: string;
  card?: string;
  count?: number;
  power?: string;
  value?: number;
}

/**
 * Add `drm` to one side's total and remember which clause it was.
 *
 * A zero contribution is not recorded: the printed lists include informational
 * entries (Bewegungskrieg, Endless Space, Jihad availability) whose DRM is 0,
 * and they would only clutter the breakdown.  Callers that want an
 * informational line push it themselves.
 */
export const recordBattleDrm = (
  battle: BattleState,
  side: BattleSideName,
  drm: number,
  key: string,
  detail?: BattleDrmDetail,
  origin?: BattleDrmSource["origin"],
): void => {
  if (drm === 0) return;
  if (side === "attacker") battle.attackerDrm += drm;
  else battle.defenderDrm += drm;
  const sources = (battle.drmSources ??= {attacker: [], defender: []});
  const entry: BattleDrmSource = {
    key,
    side,
    drm,
    ...(origin === undefined ? {} : {origin}),
    ...(detail === undefined ? {} : {detail}),
  };
  sources[side].push(entry);
};

/** A saved battle's recorded sources, defaulted to empty lists. */
export const battleDrmRecords = (battle: BattleState): {attacker: BattleDrmSource[]; defender: BattleDrmSource[]} => ({
  attacker: battle.drmSources?.attacker ?? [],
  defender: battle.drmSources?.defender ?? [],
});
