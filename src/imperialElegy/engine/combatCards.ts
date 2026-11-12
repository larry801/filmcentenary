/**
 * Imperial Elegy — data-driven combat cards.
 *
 * Every printed action/GW combat card is described once here, and the helpers
 * are pure decision functions over `G`, the acting power and the active
 * `BattleState`.  `combat.ts` uses them for the live card window: attacker
 * then defender before the dice, plus the GW-05/GW-06 post-dice window.
 *
 * Design notes
 * ------------
 * - Nothing here mutates game state.  `applyCombatCardToBattle` and
 *   `applyCombatCardModeToBattle` return a modified *copy*; the caller assigns
 *   it back to `G.battle`.
 * - Cards printed with an alternative store their options in `modes`;
 *   `combatCardModes` exposes those (or one synthesized default), while
 *   `applyCombatCardToBattle` remains the backward-compatible single-mode
 *   wrapper over the card's top-level fields.  IE-A061 exposes its +2 and
 *   no-mines clauses; IE-A066 its no-mines and +1 naval modes.
 * - Action combat cards (`source: "action"`) are only available before the
 *   Great War; GW combat cards (`source: "greatWar"`) are read from the
 *   power's `gwCard`, never from the hand.
 * - `afterDice` is a timing restriction, not an effect.  Cards printed "at the
 *   start of a battle" have `afterDice: false` (they must be played before the
 *   dice), while GW-05/GW-06 have `afterDice: true` and run after the roll.
 * - GW-03/GW-04 always give their printed +2.  Their "cancel all effects of
 *   trenches" clause is gated on GW turn 3+, so it is resolved by
 *   `applyCombatCardToBattle(battle, def, gwTurn)` rather than availability.
 * - Mines are rolled after the pre-dice card window, so a `noMines` mode
 *   cancels them before any ship is lost.
 *
 * Integration points and remaining gaps are listed in the module's final
 * comment block.
 */

import type {
  BattleState,
  CardId,
  GwCombatCardInFront,
  ImperialElegyState,
  Power,
  SpaceId,
} from "../types";
import {isNavalBox, neighboursOf} from "../constant/spaces";
import {allied, isArmyKind, isPower, landUnitsIn} from "./rules";
import {cardById} from "./deck";

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

/** The mechanical family of a combat card. */
export type CombatCardKind =
  | "drm"
  | "reroll"
  | "noRetreat"
  | "cancelTrenches"
  | "noMines"
  | "flipFaceDown";

/** Which side of the battle may play the card. */
export type CombatCardSide = "attacker" | "defender" | "either";

/** Where the card comes from: the hand (action) or `gwCard` (Great War). */
export type CombatCardSource = "action" | "greatWar";

/** Which side receives the printed DRM. */
export type CombatCardDrmTarget = "self" | "opponent";

export interface CombatCardConditions {
  /** Only the attacking power may play this card. */
  attackerOnly?: boolean;
  /** Only the defending power may play this card. */
  defenderOnly?: boolean;
  /** Restrict the card to one power (IE-A043 is Germany-only). */
  power?: Power;
  /** Restrict the card to land or naval battles. */
  battleKind?: "land" | "naval";
  /** Action cards: not available once the Great War has broken out. */
  nonGwOnly?: boolean;
  /** GW cards: only available while the Great War is active. */
  gwOnly?: boolean;
  /**
   * Timing.  `true` = only after the battle dice have been rolled;
   * `false`/omitted = only before the dice (the printed "start of battle"
   * wording).
   */
  afterDice?: boolean;
  /** IE-A061 cannot be used once Dreadnoughts has been played. */
  requiresNoDreadnoughts?: boolean;
  /** The battle space must contain a fort belonging to the enemy (A058). */
  requiresEnemyFort?: boolean;
  /** The main defense force must contain an enemy ARMY (A059). */
  requiresEnemyArmy?: boolean;
  /**
   * The playing power's main force must contain an elite corps (IE-A043's
   * "a German elite corps provides an additional +1").  Without one the card
   * has no printed effect, so it is not offered.
   */
  requiresEliteCorps?: boolean;
  /**
   * There must be at least one land space adjacent to the battle that holds an
   * army A062 could deny (A062).
   */
  requiresSupportDenySpace?: boolean;
  /**
   * The trench-cancelling clause only applies from this GW turn onwards
   * (0-based `G.gw.turn`).  The printed DRM applies regardless.
   */
  cancelTrenchesFromGwTurn?: number;
}

/**
 * One printed mode of a combat card.
 *
 * A mode is self-contained: the caller picks one and hands it to
 * `applyCombatCardModeToBattle`.  Cards whose printed text offers a choice
 * list their alternatives in `CombatCardDefinition.modes`; single-mode cards
 * omit `modes` and keep using the top-level `kind`/`drm`/`notes` fields.
 */
export interface CombatCardMode {
  /** Stable id, unique within the card (for example `"noMines"`). */
  id: string;
  /** English label for the card-window option. */
  label: string;
  /** Chinese label for the card-window option. */
  labelZh: string;
  /** Mechanical family of this mode. */
  kind: CombatCardKind;
  /** DRM applied to `target` when this mode resolves. */
  drm: number;
  /** Which side receives `drm`, relative to the playing side. */
  target: CombatCardDrmTarget;
  /** Battle-note flags applied by this mode. */
  notes: readonly string[];
}

export interface CombatCardDefinition {
  id: CardId;
  title: string;
  /** Chinese title; used for the synthesized single-mode label. */
  titleZh?: string;
  source: CombatCardSource;
  side: CombatCardSide;
  kind: CombatCardKind;
  /** Printed DRM applied to `drmTarget` when the card resolves. */
  drm: number;
  /** Which side the DRM belongs to; defaults to the playing side. */
  drmTarget?: CombatCardDrmTarget;
  conditions: CombatCardConditions;
  /** Battle-note flags applied unconditionally when the card resolves. */
  notes?: readonly string[];
  /**
   * Printed alternative modes.  Omitted when the card has a single fixed
   * effect; `combatCardModes` then synthesizes a default mode from the
   * top-level fields above, so old callers are unaffected.
   */
  modes?: readonly CombatCardMode[];
}

const ACTION: CombatCardSource = "action";
const GW: CombatCardSource = "greatWar";

/**
 * Every printed combat card, transcribed from `constant/cards.data.ts`.
 *
 * IE-GW-06 is printed as a *response* card in the data but is played from the
 * GW combat-card slot when units are forced to retreat, so it is included here
 * alongside the four cards printed with type "combat".
 */
export const COMBAT_CARD_DEFS: readonly CombatCardDefinition[] = [
  {
    id: "IE-A043",
    title: "At Any Cost",
    titleZh: "不惜一切",
    source: ACTION,
    side: "attacker",
    kind: "drm",
    drm: 1,
    conditions: {
      attackerOnly: true,
      power: "GE",
      battleKind: "land",
      afterDice: false,
      nonGwOnly: true,
      requiresEliteCorps: true,
    },
  },
  {
    id: "IE-A058",
    title: "Siege Guns",
    titleZh: "攻城炮",
    source: ACTION,
    side: "either",
    kind: "drm",
    drm: 0,
    conditions: {
      battleKind: "land",
      afterDice: false,
      nonGwOnly: true,
      requiresEnemyFort: true,
    },
    // Reduces an enemy fort by two levels before the dice; combat.ts owns the
    // fort, so the note is the integration hand-off.
    notes: ["siegeGuns"],
  },
  {
    id: "IE-A059",
    title: "Flank Attack",
    titleZh: "侧翼攻击",
    source: ACTION,
    side: "attacker",
    kind: "drm",
    drm: 0,
    conditions: {
      attackerOnly: true,
      battleKind: "land",
      afterDice: false,
      nonGwOnly: true,
      requiresEnemyArmy: true,
    },
    notes: ["flankAttack"],
  },
  {
    id: "IE-A060",
    title: "Charge of the Light Brigade",
    titleZh: "轻骑兵冲锋",
    source: ACTION,
    side: "either",
    kind: "drm",
    drm: -1,
    drmTarget: "opponent",
    conditions: {
      battleKind: "land",
      afterDice: false,
      nonGwOnly: true,
    },
  },
  {
    id: "IE-A061",
    title: "Ironclads",
    titleZh: "铁甲舰",
    source: ACTION,
    side: "either",
    kind: "drm",
    drm: 2,
    conditions: {
      battleKind: "naval",
      afterDice: false,
      nonGwOnly: true,
      requiresNoDreadnoughts: true,
    },
    notes: ["noMines"],
    // Both printed clauses apply (this is not a choice), but they are exposed
    // as two modes so a caller can resolve either clause on its own.  Applying
    // both modes reproduces the single-mode fields above.
    modes: [
      {
        id: "navalDrm",
        label: "Ironclads: +2 naval battle modifier",
        labelZh: "铁甲舰：+2 海战修正",
        kind: "drm",
        drm: 2,
        target: "self",
        notes: [],
      },
      {
        id: "noMines",
        label: "Ironclads: the defender does not roll for mines",
        labelZh: "铁甲舰：防守方不掷水雷",
        kind: "noMines",
        drm: 0,
        target: "self",
        notes: ["noMines"],
      },
    ],
  },
  {
    id: "IE-A062",
    title: "Miscommunication",
    titleZh: "通讯失误",
    source: ACTION,
    side: "either",
    kind: "drm",
    drm: 0,
    conditions: {
      battleKind: "land",
      afterDice: false,
      nonGwOnly: true,
      requiresSupportDenySpace: true,
    },
    notes: ["miscommunication"],
  },
  {
    id: "IE-A066",
    title: "Damn the Torpedoes",
    titleZh: "去他的鱼雷",
    source: ACTION,
    side: "either",
    kind: "noMines",
    drm: 0,
    conditions: {
      battleKind: "naval",
      afterDice: false,
      nonGwOnly: true,
    },
    notes: ["noMines"],
    // Printed choice: cancel the defender's mine roll, or give one side +1.
    modes: [
      {
        id: "noMines",
        label: "The defender does not roll for mines",
        labelZh: "防守方不掷水雷",
        kind: "noMines",
        drm: 0,
        target: "self",
        notes: ["noMines"],
      },
      {
        id: "navalDrm",
        label: "Give one side a +1 naval battle modifier",
        labelZh: "给一方 +1 海战修正",
        kind: "drm",
        drm: 1,
        target: "self",
        notes: [],
      },
    ],
  },
  {
    id: "IE-GW-03",
    title: "Technological Terror",
    titleZh: "技术恐怖",
    source: GW,
    side: "attacker",
    kind: "cancelTrenches",
    drm: 2,
    conditions: {
      attackerOnly: true,
      battleKind: "land",
      afterDice: false,
      gwOnly: true,
      cancelTrenchesFromGwTurn: 3,
    },
  },
  {
    id: "IE-GW-04",
    title: "Dawn of Modern Warfare",
    titleZh: "现代战争黎明",
    source: GW,
    side: "attacker",
    kind: "cancelTrenches",
    drm: 2,
    conditions: {
      attackerOnly: true,
      battleKind: "land",
      afterDice: false,
      gwOnly: true,
      cancelTrenchesFromGwTurn: 3,
    },
  },
  {
    id: "IE-GW-05",
    title: "Capable Commander",
    titleZh: "能干的指挥官",
    source: GW,
    side: "either",
    kind: "reroll",
    drm: 0,
    conditions: {
      afterDice: true,
      gwOnly: true,
    },
    notes: ["reroll"],
  },
  {
    id: "IE-GW-06",
    title: "They Shall Not Pass",
    titleZh: "他们不会通过",
    source: GW,
    side: "either",
    kind: "noRetreat",
    drm: 0,
    conditions: {
      afterDice: true,
      gwOnly: true,
    },
    notes: ["noRetreat"],
  },
];

/** Lookup by card id.  Only ids present in `COMBAT_CARD_DEFS` are keys. */
export const COMBAT_CARD_BY_ID: Readonly<Record<CardId, CombatCardDefinition>> = Object.freeze(
  Object.fromEntries(COMBAT_CARD_DEFS.map((def) => [def.id, def])) as Record<CardId, CombatCardDefinition>,
);

export const combatCardById = (id: CardId): CombatCardDefinition | undefined =>
  COMBAT_CARD_BY_ID[id];

export const isCombatCardId = (id: unknown): id is CardId =>
  typeof id === "string" && id in COMBAT_CARD_BY_ID;

// ---------------------------------------------------------------------------
// Facedown GW combat cards (rule 26.1)
// ---------------------------------------------------------------------------

/**
 * GW combat cards currently lying in front of a player.  Both the facedown
 * and the faceup cards live here: facedown means "not usable until a later
 * planning step", not hidden information (26.1 makes them public).
 */
export const gwCombatCardsInFront = (G: ImperialElegyState): GwCombatCardInFront[] =>
  G.gw?.combatCardsInFront ?? [];

export const facedownGwCombatCards = (G: ImperialElegyState): GwCombatCardInFront[] =>
  gwCombatCardsInFront(G).filter((entry) => !entry.faceup);

export const faceupGwCombatCardsInFront = (G: ImperialElegyState): GwCombatCardInFront[] =>
  gwCombatCardsInFront(G).filter((entry) => entry.faceup);

/** Faceup in-front cards usable by `power` during the current GW turn. */
export const faceupCombatCardIdsInFront = (
  G: ImperialElegyState,
  power: Power,
): CardId[] =>
  faceupGwCombatCardsInFront(G)
    .filter((entry) => entry.holder === power)
    .map((entry) => entry.cardId);

/**
 * After its battle, a played GW-03/GW-04 is not discarded: it is placed
 * facedown in front of the opponent (26.1).  A player may hold both cards.
 */
export const placeGwCombatCardFaceDown = (
  G: ImperialElegyState,
  holder: Power,
  cardId: CardId,
): GwCombatCardInFront => {
  // 26.1: a GW-03/GW-04 played for its event is never discarded.  Defensively
  // remove any stray copy from either discard pile (older saves/event paths)
  // before it sits in front of its new holder.
  G.discard = G.discard.filter((id) => id !== cardId);
  if (G.gw) G.gw.discard = (G.gw.discard ?? []).filter((id) => id !== cardId);
  if (!G.gw) return {holder, cardId, faceup: false};
  const cards = G.gw.combatCardsInFront ?? (G.gw.combatCardsInFront = []);
  const existing = cards.find((entry) => entry.cardId === cardId);
  if (existing) {
    existing.holder = holder;
    existing.faceup = false;
    return existing;
  }
  const entry: GwCombatCardInFront = {holder, cardId, faceup: false};
  cards.push(entry);
  return entry;
};

/** Remove an in-front card (used when its new holder plays it). */
export const removeGwCombatCardInFront = (
  G: ImperialElegyState,
  holder: Power,
  cardId: CardId,
): boolean => {
  const cards = G.gw?.combatCardsInFront;
  if (!cards) return false;
  const index = cards.findIndex((entry) => entry.holder === holder && entry.cardId === cardId);
  if (index === -1) return false;
  cards.splice(index, 1);
  return true;
};

/**
 * Flip one facedown in-front card faceup.  `holder`/`cardId` narrow the
 * choice; both are optional so GW-05's event can flip any facedown card and
 * the planning step can flip everything.  Returns the flipped entry.
 */
export const flipGwCombatCardFaceup = (
  G: ImperialElegyState,
  holder?: Power,
  cardId?: CardId,
): GwCombatCardInFront | null => {
  const entry = facedownGwCombatCards(G).find(
    (candidate) =>
      (holder === undefined || candidate.holder === holder) &&
      (cardId === undefined || candidate.cardId === cardId),
  );
  if (!entry) return null;
  entry.faceup = true;
  return entry;
};

/** Planning step (26.1): every facedown in-front card is flipped faceup. */
export const flipFacedownGwCombatCards = (G: ImperialElegyState): GwCombatCardInFront[] => {
  const flipped = facedownGwCombatCards(G);
  for (const entry of flipped) entry.faceup = true;
  return flipped;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True once either battle die has been recorded (GW-05/GW-06 timing). */
export const battleDiceRolled = (battle: BattleState): boolean =>
  battle.attackerRoll !== undefined || battle.defenderRoll !== undefined;

/** The battle side controlled by `power`, or null if it is a bystander. */
export const combatSideOfPower = (
  power: Power,
  battle: BattleState,
): CombatCardSide | null => {
  if (power === battle.attacker) return "attacker";
  if (power === battle.defender) return "defender";
  return null;
};

/**
 * Land spaces A062 may deny: a neighbour of either battle space that holds at
 * least one army (an empty or naval-only neighbour has nothing to deny).  This
 * is shared with `combat.ts`, which opens the actual decision, so availability
 * and the option list cannot drift apart.
 */
export const supportDenySpaces = (
  G: ImperialElegyState,
  battle: BattleState,
): SpaceId[] => {
  const out = new Set<SpaceId>();
  for (const adjacent of [...neighboursOf(battle.from), ...neighboursOf(battle.to)]) {
    if (adjacent === battle.from || adjacent === battle.to) continue;
    if (isNavalBox(adjacent) || !G.spaces[adjacent]) continue;
    if (!landUnitsIn(G, adjacent).some((unit) => isArmyKind(unit.kind))) continue;
    out.add(adjacent);
  }
  return [...out];
};

/**
 * Availability guard shared by `availableCombatCards` and future validation.
 * Checks side, power, battle kind, GW era, Dreadnoughts and dice timing.
 */
export const combatCardConditionsMet = (
  G: ImperialElegyState,
  power: Power,
  battle: BattleState,
  def: CombatCardDefinition,
): boolean => {
  const conditions = def.conditions;
  const side = combatSideOfPower(power, battle);
  if (side === null) return false;
  if (def.side !== "either" && def.side !== side) return false;
  if (conditions.attackerOnly && side !== "attacker") return false;
  if (conditions.defenderOnly && side !== "defender") return false;
  if (conditions.power && conditions.power !== power) return false;
  if (conditions.battleKind && conditions.battleKind !== battle.kind) return false;
  const gwActive = Boolean(G.gw?.active);
  if (conditions.nonGwOnly && gwActive) return false;
  if (conditions.gwOnly && !gwActive) return false;
  if (conditions.requiresNoDreadnoughts && G.persistent?.dreadnoughts === true) return false;
  if (conditions.requiresEnemyFort) {
    const state = G.spaces[battle.to];
    const fort = state?.fort;
    if (!fort) return false;
    const friendlyFort =
      fort.power === power ||
      (isPower(fort.power) ? allied(G, power, fort.power) : state?.ally === power);
    if (friendlyFort) return false;
  }
  if (conditions.requiresEnemyArmy) {
    const hasEnemyArmy = battle.mainDefense.some((id) => {
      const unit = G.units[id];
      return Boolean(unit) && isArmyKind(unit.kind) && unit.owner !== power;
    });
    if (!hasEnemyArmy) return false;
  }
  if (conditions.requiresEliteCorps) {
    // The elite unit must be in this power's main force (18.2.1).
    const force = side === "attacker" ? battle.mainAttack : battle.mainDefense;
    const hasElite = force.some((id) => {
      const unit = G.units[id];
      return Boolean(unit) && unit.kind === "eliteCorps" && unit.owner === power;
    });
    if (!hasElite) return false;
  }
  if (conditions.requiresSupportDenySpace && supportDenySpaces(G, battle).length === 0) {
    return false;
  }
  // GW-05 may reroll only once per battle, even if the card somehow remains
  // available from another zone.
  if (def.kind === "reroll" && battle.rerollUsed === true) return false;
  // Both flags matter: before-dice cards close once the dice are rolled, and
  // after-dice cards are not offered during the pre-roll card window.
  if (Boolean(conditions.afterDice) !== battleDiceRolled(battle)) return false;
  return true;
};

/**
 * Combat cards the power may play in this battle:
 *
 * 1. action combat cards in the power's hand, then
 * 2. the power's `gwCard` when that card is a GW combat card, then
 * 3. faceup GW combat cards lying in front of the power (26.1, including a
 *    card just flipped by GW-05's event).
 *
 * Restrictions are applied per definition (side, Germany-only, land/naval,
 * GW/non-GW, Dreadnoughts, before/after dice).  Returns card ids in hand order
 * (GW sources last) so `combat.ts` can keep building `card:` options.
 */
export const availableCombatCards = (
  G: ImperialElegyState,
  power: Power,
  battle: BattleState,
): CardId[] => {
  const player = G.powers[power];
  if (!player) return [];
  if (combatSideOfPower(power, battle) === null) return [];

  const available: CardId[] = [];
  const seen = new Set<CardId>();
  const consider = (id: CardId | null | undefined): void => {
    if (!id || seen.has(id)) return;
    const def = combatCardById(id);
    if (!def) return;
    if (!combatCardConditionsMet(G, power, battle, def)) return;
    seen.add(id);
    available.push(id);
  };

  for (const id of player.hand) {
    if (combatCardById(id)?.source === "action") consider(id);
  }
  if (player.gwCard && combatCardById(player.gwCard)?.source === "greatWar") {
    consider(player.gwCard);
  }
  for (const id of faceupCombatCardIdsInFront(G, power)) {
    if (combatCardById(id)?.source === "greatWar") consider(id);
  }
  return available;
};

/** One playable `(card, mode)` pair for the active battle. */
export interface AvailableCombatCardMode {
  cardId: CardId;
  mode: CombatCardMode;
}

/**
 * Cards in hand that IE-A043 may discard to play itself from the discard pile:
 * anything except a mandatory event or a home card.
 */
export const a043DiscardCostCards = (
  G: ImperialElegyState,
  power: Power,
): CardId[] => {
  const player = G.powers[power];
  if (!player) return [];
  return player.hand.filter((id) => {
    const card = cardById(id);
    return card.kind !== "home" && card.type !== "mandatory" && card.type !== "mandatoryResponse";
  });
};

/**
 * IE-A043 At Any Cost's special: the German player may play it from the
 * discard pile by discarding a card of their choice.  It is available only
 * when the normal printed conditions are already met (GE attacker, land,
 * pre-GW, an elite corps in the main attack force) and there is a legal card
 * to discard.
 */
export const canPlayA043FromDiscard = (
  G: ImperialElegyState,
  power: Power,
  battle: BattleState,
): boolean => {
  if (power !== "GE") return false;
  if (!G.discard.includes("IE-A043")) return false;
  const def = combatCardById("IE-A043");
  if (!def || !combatCardConditionsMet(G, power, battle, def)) return false;
  return a043DiscardCostCards(G, power).length > 0;
};

/**
 * Every playable mode of every available combat card.
 *
 * Card-level availability (side, land/naval, era, Dreadnoughts, timing) comes
 * from `availableCombatCards`, so this preserves hand order with the GW card
 * last.  Single-mode cards contribute exactly one synthesized default mode;
 * IE-A066 contributes its two printed alternatives and IE-A061 its two printed
 * clauses.
 */
export const availableCombatCardModes = (
  G: ImperialElegyState,
  power: Power,
  battle: BattleState,
): AvailableCombatCardMode[] => {
  const available: AvailableCombatCardMode[] = [];
  for (const cardId of availableCombatCards(G, power, battle)) {
    const def = combatCardById(cardId);
    if (!def) continue;
    for (const mode of combatCardModes(def)) available.push({cardId, mode});
  }
  return available;
};

/**
 * The printed DRM for the card in this battle.  Battle-kind restrictions are
 * enforced here (Ironclads only gives its +2 at sea); all other restrictions
 * belong to `availableCombatCards`.  GW-03/GW-04 always return +2 — their
 * trench clause is handled by `applyCombatCardToBattle`.
 */
export const combatCardDrm = (
  def: CombatCardDefinition,
  battle: BattleState,
): number => {
  if (def.conditions.battleKind && def.conditions.battleKind !== battle.kind) return 0;
  return def.drm;
};

const addNote = (battle: BattleState, note: string): void => {
  if (!battle.notes.includes(note)) battle.notes.push(note);
};

/** A single-mode card's effect, derived from its legacy top-level fields. */
const defaultCombatCardMode = (def: CombatCardDefinition): CombatCardMode => ({
  id: "default",
  label: def.title,
  labelZh: def.titleZh ?? def.title,
  kind: def.kind,
  drm: def.drm,
  target: def.drmTarget ?? "self",
  notes: def.notes ?? [],
});

/**
 * The card's selectable modes.  Cards without a printed choice get one
 * synthesized `"default"` mode built from the top-level fields, so the mode
 * API works for every combat card.
 */
export const combatCardModes = (def: CombatCardDefinition): readonly CombatCardMode[] =>
  def.modes && def.modes.length > 0 ? def.modes : [defaultCombatCardMode(def)];

const cloneBattle = (battle: BattleState): BattleState => ({
  ...battle,
  mainAttack: [...battle.mainAttack],
  mainDefense: [...battle.mainDefense],
  supportAttack: battle.supportAttack.map((support) => ({
    ...support,
    units: [...support.units],
  })),
  supportDefense: battle.supportDefense.map((support) => ({
    ...support,
    units: [...support.units],
  })),
  notes: [...battle.notes],
  supportDenied: battle.supportDenied ? [...battle.supportDenied] : undefined,
  extraDraws: battle.extraDraws ? [...battle.extraDraws] : undefined,
  faceDownCards: battle.faceDownCards ? battle.faceDownCards.map((entry) => ({...entry})) : undefined,
});

/** Battle-kind restrictions apply to modes just as they do to whole cards. */
const combatCardModeDrm = (
  def: CombatCardDefinition,
  mode: CombatCardMode,
  battle: BattleState,
): number => {
  if (def.conditions.battleKind && def.conditions.battleKind !== battle.kind) return 0;
  return mode.drm;
};

/**
 * Condition-driven notes that are not tied to one printed mode: the GW-03/
 * GW-04 trench clause and the "no mines" marker's effect on the battle.
 */
const applyBattleWideModeNotes = (
  next: BattleState,
  battle: BattleState,
  def: CombatCardDefinition,
  gwTurn: number,
): void => {
  const cancelFrom = def.conditions.cancelTrenchesFromGwTurn;
  if (cancelFrom !== undefined && battle.trench && gwTurn >= cancelFrom) {
    addNote(next, "cancelTrenches");
  }
  if (next.notes.includes("cancelTrenches")) next.trench = false;
  if (next.notes.includes("noMines")) next.mines = 0;
};

/**
 * Pure application of one printed combat-card mode.  Returns a modified copy:
 *
 * - adds `mode.drm` to the playing side (or to the opponent when
 *   `mode.target === "opponent"`), respecting the card's battle-kind
 *   restriction,
 * - appends `mode.notes` without duplicating an existing note,
 * - from GW turn 3, GW-03/GW-04 append `cancelTrenches` and clear
 *   `battle.trench` (a mode inherits its card's conditions),
 * - `noMines` modes clear `battle.mines` (the caller should keep mine losses
 *   out of `attackerLosses`, or undo them, because mines are rolled before the
 *   pre-roll card window today).
 *
 * `gwTurn` is `G.gw?.turn ?? 0`.  The input battle and its arrays are never
 * mutated.
 */
export const applyCombatCardModeToBattle = (
  battle: BattleState,
  def: CombatCardDefinition,
  mode: CombatCardMode,
  gwTurn = 0,
): BattleState => {
  const next = cloneBattle(battle);

  const drm = combatCardModeDrm(def, mode, battle);
  if (drm !== 0) {
    const playingSide = battle.cardSide ?? "attacker";
    const attackerGetsDrm = mode.target === "opponent"
      ? playingSide !== "attacker"
      : playingSide === "attacker";
    if (attackerGetsDrm) next.attackerDrm += drm;
    else next.defenderDrm += drm;
  }

  for (const note of mode.notes) addNote(next, note);
  applyBattleWideModeNotes(next, battle, def, gwTurn);

  return next;
};

/**
 * Backward-compatible single-mode application.  Uses the card's legacy
 * top-level `drm`/`drmTarget`/`notes`, which for IE-A061 is the combined
 * "+2 and no mines" printed effect and for IE-A066 is the primary no-mines
 * mode.  Multi-mode callers should use `applyCombatCardModeToBattle`.
 *
 * `gwTurn` is `G.gw?.turn ?? 0`.  The input battle and its arrays are never
 * mutated.
 */
export const applyCombatCardToBattle = (
  battle: BattleState,
  def: CombatCardDefinition,
  gwTurn = 0,
): BattleState => applyCombatCardModeToBattle(battle, def, defaultCombatCardMode(def), gwTurn);

// ---------------------------------------------------------------------------
// Live integration (combat.ts / moves.ts / greatWarFlow.ts)
// ---------------------------------------------------------------------------
//
// The card window is wired end to end:
//
// combat.ts
//   * `openCombatCardWindow` builds one option per
//     `availableCombatCardModes(G, power, battle)` entry
//     (`card:<id>:<modeId>`); synthesized single modes keep the historical
//     `card:<id>` id.
//   * `playCombatCard` parses the optional `:<modeId>` suffix, validates the
//     `(cardId, modeId)` pair against the same helper, and resolves it with
//     `applyCombatCardModeToBattle`.  A bare card id keeps the legacy combined
//     `applyCombatCardToBattle` effect.
//   * `resolveBattleRoll` rolls mines only after the pre-dice window, so a
//     `noMines` mode cancels them; `finishBattle` honours `cancelTrenches` and
//     `noRetreat`.
//   * `afterCombatCardWindow` opens the post-dice GW-05/GW-06 window before
//     losses are applied.
//   * `moves.ts` forwards the selection unchanged from the `combatCard` pending
//     decision (it strips only the `card:` prefix).
//
//   * `applyPreDiceCardEffects` (combat.ts) resolves A058's fort reduction
//     (enemy-fort availability is a card condition) and A059's pre-dice step
//     loss on a main-defense army, winning the battle decisively if the last
//     step is removed; A062 opens an explicit support-denial decision.  All
//     three queue one end-of-battle draw in `battle.extraDraws`.
//   * GW-05 opens a side choice, rerolls that die from the recorded
//     `attackDrmTotal`/`defenceDrmTotal`, and resumes the loss step once.
//     Its normal event mode is wired through `effects.gwCapableCommander`,
//     which offers the facedown cards and flips the chosen one.
//   * GW-03/GW-04 queue `battle.faceDownCards`; `finishBattle` places them
//     facedown in front of the opponent via `placeGwCombatCardFaceDown`.
//
// greatWarFlow.ts
//   * `faceupCombatCards` / `revealGwCombatCard` accept the printed combat
//     cards, including IE-GW-06.  It is type "response" in `cards.data.ts` but
//     is played from the GW combat-card slot, so it may be marked face-up.
//   * `beginGwTurn` flips every facedown in-front card faceup; the helpers in
//     this module (`flipFaceDownGwCombatCard`, `flipFacedownGwCombatCards`,
//     `placeGwCombatCardFaceDown`, `removeGwCombatCardInFront`) own the 26.1
//     lifecycle and are re-exported there.
//
// Card-text specials:
//   * A043 requires an elite corps in the German main attack force and may be
//     played from the discard pile (`combatDiscard` + `resolveCombatDiscard`),
//     discarding a hand card and skipping its end-of-battle draw.
//   * A061's post-Dreadnoughts draw replacement lives in `deck.ts#drawOne`.
//   * GW-05's event flip uses an `eventChoice` pending decision; the board's
//     generic pending renderer displays its card options without a bespoke UI.
