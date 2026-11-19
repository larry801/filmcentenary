/**
 * Elite-corps / elite-colonial-EF combat bonus.
 *
 * A078 Crack Colonial Troops prints "This unit provides a +1 modifier during
 * pacification actions and **may** provide a +1 modifier during land battles.
 * If it uses its bonus against a non-rebel army it is automatically destroyed."
 * A080 Machine Guns and A091 Hydraulic Recoil both add "ECs and elite colonial
 * EFs are automatically eliminated if their combat bonus is used against a
 * non-rebel army in a land battle."
 *
 * So the bonus is a *choice*, not an automatic contribution: the controlling
 * player decides whether to commit the elite unit. Committing it is what makes
 * the printed auto-elimination clause fire, which is why the engine keeps the
 * decision (`combatElite`) separate from the ordinary DRM sources.
 *
 * This module owns the pure decision logic; `combat.ts` opens and resolves the
 * pending, and `greatWarFlow.ts` reads the same predicate for refits.
 */
import type {BattleState, ImperialElegyState, Power, Unit} from "../types";

/**
 * The printed unit kinds that carry the optional land-battle bonus.  5.1.6
 * says the Zouave "functions identically to elite colonial EFs", so it carries
 * the same +1 / auto-elimination clause as A078.
 */
export type EliteBonusKind = "eliteCorps" | "eliteColonialEf" | "zouave";

export const isEliteBonusKind = (kind: string): kind is EliteBonusKind =>
  kind === "eliteCorps" || kind === "eliteColonialEf" || kind === "zouave";

/** The printed bonus these units may contribute once committed. */
export const ELITE_COMBAT_BONUS = 1;

/**
 * Does this side's main force contain an elite unit that could still be
 * committed?  Support-only units do not qualify: the cards speak of the unit
 * "in a land battle", and the engine records support separately.
 */
export const eliteBonusCandidates = (
  G: ImperialElegyState,
  battle: BattleState,
  side: "attacker" | "defender",
): Unit[] => {
  if (battle.kind !== "land") return [];
  // A078's elite colonial EF is a pre-war colonial unit: during the Great War
  // the printed +1/auto-elimination clause is not part of the GW combat rules,
  // and asking mid-GW would stall the automated GW impulse sequence.
  if (G.gw?.active === true) return [];
  const ids = side === "attacker" ? battle.mainAttack : battle.mainDefense;
  return ids
    .map((id) => G.units[id])
    .filter((unit): unit is Unit => unit !== undefined && isEliteBonusKind(unit.kind) && unit.steps > 0);
};

/**
 * The opposing main force is a non-rebel army, which is the printed condition
 * for the auto-elimination clause.  A rebel opponent leaves the elite unit
 * intact after using its bonus.
 */
export const opponentIsNonRebelArmy = (
  G: ImperialElegyState,
  battle: BattleState,
  side: "attacker" | "defender",
): boolean => {
  const ids = side === "attacker" ? battle.mainDefense : battle.mainAttack;
  const opponents = ids.map((id) => G.units[id]).filter((unit): unit is Unit => unit !== undefined);
  if (opponents.length === 0) return false;
  return opponents.every((unit) => unit.kind !== "rebelArmy");
};

/** Committed elite unit ids for one side (recorded when the decision resolves). */
export const committedEliteIds = (
  battle: BattleState,
  side: "attacker" | "defender",
): string[] => (side === "attacker" ? battle.eliteBonusAttack : battle.eliteBonusDefense) ?? [];

/**
 * The kinds of the committed elite units.  The decision records them at commit
 * time so the end-of-battle destruction still knows what it is destroying after
 * the counters have left the board.
 */
export const committedEliteKinds = (
  G: ImperialElegyState,
  battle: BattleState,
  side: "attacker" | "defender",
): string[] => {
  const recorded = side === "attacker" ? battle.eliteBonusKinds?.attacker : battle.eliteBonusKinds?.defender;
  if (recorded !== undefined) return recorded;
  return committedEliteIds(battle, side).map((id) => G.units[id]?.kind ?? "");
};

/**
 * The owners of the committed elite units, recorded alongside the kinds so the
 * end-of-battle destruction can be attributed after the counter is gone.
 */
export const committedEliteOwners = (
  battle: BattleState,
  side: "attacker" | "defender",
): string[] => {
  const recorded = side === "attacker" ? battle.eliteBonusOwners?.attacker : battle.eliteBonusOwners?.defender;
  return recorded ?? [];
};

/**
 * A078 / 5.1.6: the elite colonial EF and the Zouave print the
 * auto-elimination clause on their own counter, so it always applies.
 * A080 Machine Guns and A091 Hydraulic Recoil add the clause to ordinary ECs
 * only once the mandatory event is in effect (5.3.1/18.6.2 "Important").
 */
const eliteKindAutoDestroys = (G: ImperialElegyState, kind: string): boolean =>
  kind === "eliteColonialEf"
  || kind === "zouave"
  || (kind === "eliteCorps" && (G.persistent.machineGuns === true || G.persistent.hydraulicRecoil === true));

/** The bonus actually applied to a side, for the BDRM total and the log. */
export const eliteBonusDrm = (
  battle: BattleState,
  side: "attacker" | "defender",
): number => committedEliteIds(battle, side).length * ELITE_COMBAT_BONUS;

/**
 * True when committing the bonus on `side` must destroy the elite unit(s)
 * afterwards: the printed rule needs a non-rebel army opponent.
 *
 * The check is *recorded when the bonus is committed*, because by the time the
 * battle ends its units may already have been removed by step losses — reading
 * the board then would find an empty main force and wrongly spare the elite
 * unit.  `eliteBonusVsRebel` carries that earlier answer.
 */
export const eliteBonusDestroys = (
  G: ImperialElegyState,
  battle: BattleState,
  side: "attacker" | "defender",
): boolean => {
  if (committedEliteIds(battle, side).length === 0) return false;
  // 5.3.1/18.6.2: an ordinary EC keeps its counter after using the bonus until
  // Machine Guns or Hydraulic Recoil is in effect.  A078's elite colonial EF
  // (and 5.1.6's Zouave) carry the clause on their own counter.
  if (!committedEliteKinds(G, battle, side).some((kind) => eliteKindAutoDestroys(G, kind))) return false;
  const recorded = side === "attacker" ? battle.eliteBonusVsRebel?.attacker : battle.eliteBonusVsRebel?.defender;
  if (recorded !== undefined) return recorded === false;
  return opponentIsNonRebelArmy(G, battle, side);
};

/** Whether a specific committed unit's counter is destroyed by the clause. */
export const eliteUnitAutoDestroys = (G: ImperialElegyState, kind: string): boolean =>
  eliteKindAutoDestroys(G, kind);

/** Which power decides whether to commit this side's elite bonus. */
export const eliteDecisionPower = (
  G: ImperialElegyState,
  battle: BattleState,
  side: "attacker" | "defender",
): Power | null => {
  if (side === "attacker") return battle.attacker;
  // A minor defending alone never owns a prompt; the ordinary defender window
  // helpers already encode that rule, so mirror them here.
  const defender = battle.defender;
  if (defender && G.powers[defender] && defender !== battle.attacker) return defender;
  return null;
};
