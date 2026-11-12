/**
 * Imperial Elegy — pure turn / decade / card-economy helpers.
 *
 * Everything in this module is pure: no helper mutates `G` or any card data.
 * The helpers own the five economy concerns and are wired into the live game:
 *
 *  - `decadeForTurn`/`beginTurnDecade` supply the turn -> decade mapping and the
 *    "not already in play" filter used by `game.ts#prepBegin` and
 *    `moves.ts#resolveEnd`, both of which advance `G.decade` (rules 10.1 / 10.2);
 *  - `cpChainResolution` backs the live `cpChain`/`useCpChain` path, which banks
 *    up to two cards, caps one action at 4 CP and discards the chain when the
 *    action phase ends (rule 12.14);
 *  - `industryTarget`/`industryRollNeeded`/`autoIndustrySuccess` drive the
 *    end-phase industrialization roll in `moves.ts#resolveEnd` (12.13 / 20.6);
 *  - `reserveAllowance`/`reserveRemaining` drive end-phase reserve growth
 *    (rule 7.3 plus national characteristics);
 *  - `endPhaseOrder` lists the printed twelve-step sequence for reference.
 *
 * The helpers are intentionally side-effect free so they can be called from
 * moves, the board UI, tests, and future bots with identical results.
 */

import {CardId, ImperialElegyState, Power, POWERS} from "../types";
import {Decade} from "../constant/cards";
import {PowerDef, POWER_DEFS} from "../constant/powers";
import {cardById, cardsForDecade} from "./deck";

// ---------------------------------------------------------------------------
// 10.1 / 10.2 — The decade and the cards that enter with it
// ---------------------------------------------------------------------------

/**
 * Campaign turn -> decade label, one decade per turn, matching the playbook's
 * scenario headers (`IE_playbook.pdf` pp. 3-4): turn 1 = 1850s, turn 2 = 1860s,
 * turn 3 = 1870s, turn 4 = 1880s, turn 5 = 1890s, turn 6 = 1900s, turn 7 =
 * 1910s.
 *
 * The campaign label is not the same thing as a card's printed entry band.  No
 * action card is printed for the 1860s or 1910s (`docs/imperial-elegy/
 * CORRECTIONS.md` §5), so `cardsForDecade` selects nothing for turns 2 and 7:
 * those two turns add zero cards, while every printed card still enters the
 * deck exactly once.  Turn 1's 1850s band is dealt during setup.
 */
const CAMPAIGN_TURN_DECADES: readonly Decade[] = [
  "1850s", // turn 1
  "1860s", // turn 2 — label only; no cards printed in this band
  "1870s", // turn 3
  "1880s", // turn 4
  "1890s", // turn 5
  "1900s", // turn 6
  "1910s", // turn 7 — label only; no cards printed in this band
];

/**
 * Decade shown for a campaign turn (1-7).  Out-of-range turns clamp to the
 * first/last band instead of throwing, so UI and log code can call this with a
 * turn that has already advanced past turn 7.
 *
 * Rule 10.1: "Many cards do not start in the deck. Instead, these cards are
 * marked with the turn/decade they come into play."
 */
export const decadeForTurn = (turn: number): Decade => {
  if (!Number.isFinite(turn)) return CAMPAIGN_TURN_DECADES[0];
  const index = Math.min(Math.max(Math.floor(turn), 1), CAMPAIGN_TURN_DECADES.length) - 1;
  return CAMPAIGN_TURN_DECADES[index];
};

export interface TurnDecadeEntry {
  /** Normalized campaign turn (>= 1). */
  turn: number;
  /** The decade `G.decade` should show for this turn. */
  decade: Decade;
  /**
   * Action cards printed for `decade` that are not yet in play anywhere (deck,
   * discard, removed pile, a hand, a home-card slot, a CP Chain, or the
   * industrialization slot).  Empty when the band has already entered, and
   * always empty for the label-only 1860s/1910s bands because no card is
   * printed there.
   */
  entering: CardId[];
}

/** Every card currently accounted for in `G`, without touching it. */
const cardsInPlay = (G: ImperialElegyState): Set<CardId> => {
  const inPlay = new Set<CardId>();
  for (const id of G.deck) inPlay.add(id);
  for (const id of G.discard) inPlay.add(id);
  for (const id of G.removed) inPlay.add(id);
  for (const power of POWERS) {
    const p = G.powers[power];
    for (const id of p.hand) inPlay.add(id);
    for (const id of p.homeCards) inPlay.add(id);
    for (const id of p.cpChain) inPlay.add(id);
    if (p.industryCard !== null) inPlay.add(p.industryCard);
  }
  return inPlay;
};

/**
 * The prep-phase view of rules 10.1/10.2: which decade this turn belongs to and
 * which printed cards should be added to the deck before the discard pile is
 * shuffled in.  Pure: `G` is only read.
 *
 * Integration: `game.ts#prepBegin` calls this, assigns `G.decade = decade`, and
 * passes exactly `entering` to `prepareDeck` before reshuffling.
 */
export const beginTurnDecade = (G: ImperialElegyState, turn: number): TurnDecadeEntry => {
  const normalizedTurn = Number.isFinite(turn) ? Math.max(Math.floor(turn), 1) : 1;
  const decade = decadeForTurn(normalizedTurn);
  const inPlay = cardsInPlay(G);
  const entering = [...new Set(cardsForDecade(decade))].filter((id) => !inPlay.has(id));
  return {turn: normalizedTurn, decade, entering};
};

// ---------------------------------------------------------------------------
// 12.14 — CP Chain
// ---------------------------------------------------------------------------

/** Rule 12.14: "A maximum of 2 cards can be played into a player's CP Chain." */
export const CP_CHAIN_MAX_CARDS = 2;
/** Rule 12.14: the chained CP funds "a single action which cannot exceed 4 CP". */
export const CP_CHAIN_SINGLE_ACTION_CAP = 4;

export interface CpChainResolution {
  power: Power;
  /** Cards currently sitting faceup under the player's CP Chain chit. */
  cards: CardId[];
  cardCount: number;
  /** True when state already violates the two-card limit (should never happen). */
  overLimit: boolean;
  /** Printed CP saved on the chained cards (what the chain "grants"). */
  cpGranted: number;
  /** CP that can actually be spent: one action, capped at 4 CP (12.14). */
  cpSpendable: number;
  /** CP lost to the single-action cap if the whole chain is used. */
  cpWasted: number;
  maxCards: number;
  singleActionCap: number;
  /** Mandatory events in the chain still trigger; the active player controls them. */
  mandatoryEvents: CardId[];
  /** 12.14: "CP chained cards cannot be used to industrialize." */
  canIndustrialize: false;
  /** 12.14: every chained card is discarded at the end of the action phase. */
  discardAtEndOfActionPhase: CardId[];
  /** 12.14: chained cards are never returned to hand ... */
  returnsToHand: CardId[];
  /** ... and no chained CP survives into the next turn. */
  cpNextTurn: 0;
}

/**
 * Rule 12.14 — CP Chain (IE_rule.pdf, p. 28):
 *
 *   "Playing a card into CP chain saves the CP on that card for a future
 *    impulse to conduct a single action. When cards are played into CP Chain
 *    they are placed faceup, and that player's CP Chain chit is placed on the
 *    card. Players may spend the CP in their CP Chain when they play a card for
 *    CP on a future impulse. Below is a list of special rules that apply to CP
 *    Chained cards:
 *     • A maximum of 2 cards can be played into a player's CP Chain.
 *     • The spent CP can only be used to conduct a single action which cannot
 *       exceed 4 CP.
 *     • CP chained cards cannot be used to industrialize.
 *     • Mandatory events played into the CP chain still trigger their event,
 *       and the active player controls the event.
 *     • Cards played into CP Chain are always discarded at the end of the
 *       action phase (so don't forget to use them)."
 *
 * Consequently the chain grants CP *within the current action phase only*:
 * `cpSpendable` is the most that one action may draw from it, and at the end of
 * the action phase `discardAtEndOfActionPhase` must be discarded and the chain
 * emptied.  Nothing is returned to hand and no CP carries into the next turn —
 * the rulebook has no next-turn grant.  Pure: `G` is only read.
 */
export const cpChainResolution = (G: ImperialElegyState, power: Power): CpChainResolution => {
  const cards = [...G.powers[power].cpChain];
  const cpGranted = cards.reduce((sum, id) => sum + cardById(id).cp, 0);
  const cpSpendable = Math.min(cpGranted, CP_CHAIN_SINGLE_ACTION_CAP);
  const mandatoryEvents = cards.filter((id) => {
    const type = cardById(id).type;
    return type === "mandatory" || type === "mandatoryResponse";
  });
  return {
    power,
    cards,
    cardCount: cards.length,
    overLimit: cards.length > CP_CHAIN_MAX_CARDS,
    cpGranted,
    cpSpendable,
    cpWasted: cpGranted - cpSpendable,
    maxCards: CP_CHAIN_MAX_CARDS,
    singleActionCap: CP_CHAIN_SINGLE_ACTION_CAP,
    mandatoryEvents,
    canIndustrialize: false,
    discardAtEndOfActionPhase: [...cards],
    returnsToHand: [],
    cpNextTurn: 0,
  };
};

// ---------------------------------------------------------------------------
// 12.13 / 20.6 — Industrialization
// ---------------------------------------------------------------------------

/** 12.13: "the total is ≥ 5 (≥6 for RU and OT)" — the die + card CP + DRMs. */
export type IndustryTarget = 5 | 6;

/**
 * Rule 12.13: "During the end phase each player rolls a die and adds the CP
 * value of the card they played into industrialization. If the total is ≥ 5
 * (≥6 for RU and OT) that player successfully industrializes."
 *
 * RU's national characteristic (Agrarian) and OT's (Europeanization) are what
 * make their printed target 6; the target itself is not a card/flag value.
 * `G` is accepted so the signature matches the other economy helpers and so a
 * future event could modify the target without changing every call site.
 */
export const industryTarget = (_G: ImperialElegyState, power: Power): IndustryTarget =>
  power === "RU" || power === "OT" ? 6 : 5;

/**
 * Die face needed for this power to industrialize with a card of `cp` value,
 * after the turn's `industryDrm` (e.g. World's Fair gives other players +2).
 *
 * The return value is not clamped: ≤ 1 means any die roll succeeds, and > 6
 * means only the auto-industrialization chit can succeed.
 */
export const industryRollNeeded = (G: ImperialElegyState, power: Power, cp: number): number => {
  const drm = Number(G.powers[power].flags.industryDrm ?? 0);
  return industryTarget(G, power) - cp - (Number.isFinite(drm) ? drm : 0);
};

/**
 * Rule 12.13: a failed industrialization flips the chit to its auto side, and
 * "they will automatically industrialize during the next end phase if they play
 * a card of any CP value into industrialization."
 *
 * True only when the auto chit is present *and* a card was played into the
 * industrialization slot this turn; without a card there is no roll at all.
 */
export const autoIndustrySuccess = (G: ImperialElegyState, power: Power): boolean =>
  G.powers[power].autoIndustry === true && G.powers[power].industryCard !== null;

// ---------------------------------------------------------------------------
// 7.3 / national characteristics — Reserve armies holding box
// ---------------------------------------------------------------------------

export type ReserveFormula = PowerDef["reserveFormula"];

/** Extra capacity granted by a persistent flag (card 110, Extreme Militarism). */
const reserveBonusFor = (G: ImperialElegyState, power: Power): number => {
  const bonus = Number(G.powers[power].flags.reserveLimitBonus ?? 0);
  return Number.isFinite(bonus) ? bonus : 0;
};

/**
 * Maximum reserve armies allowed in the holding box.
 *
 * Rule 7.3: "Players can hold reserve armies equal to their industry or
 * manpower, whichever is lower."
 * UK — Professional Army (33.2): the UK can never build reserve armies.
 * RU — Russian Steamroller (33.5): "reserve army limit is the lower of manpower
 * or industry, +1."
 * Extreme Militarism (card 110): "Your reserve armies holding box limit is
 * increased by 1 until the end of the game."
 *
 * The UK stays at 0 even if the bonus flag is somehow set, because the
 * prohibition is absolute.  Pure: `G` is only read.
 */
export const reserveAllowance = (G: ImperialElegyState, power: Power): number => {
  const formula: ReserveFormula = POWER_DEFS[power].reserveFormula;
  if (formula === "none") return 0;
  const p = G.powers[power];
  const lower = Math.min(p.manpower, p.industry);
  const base = formula === "manpowerPlusOne" ? lower + 1 : lower;
  return Math.max(0, base + reserveBonusFor(G, power));
};

/**
 * Rule 5.1.2 / 7.3: how many more reserve armies the power may add to its box.
 * Never negative, even if the box is over its limit after a manpower/industry
 * drop.
 */
export const reserveRemaining = (G: ImperialElegyState, power: Power): number =>
  Math.max(0, reserveAllowance(G, power) - G.powers[power].reserves.length);

// ---------------------------------------------------------------------------
// 20.0 — End phase step order
// ---------------------------------------------------------------------------

export type EndPhaseRule =
  | "20.1"
  | "20.2"
  | "20.3"
  | "20.4"
  | "20.5"
  | "20.6"
  | "20.7"
  | "20.8"
  | "20.9"
  | "20.10"
  | "20.11"
  | "20.12";

export type EndPhaseStepKey =
  | "militarism"
  | "degradeForts"
  | "nonPlayerBuild"
  | "navalUnitsToPort"
  | "setManpower"
  | "industrialization"
  | "progressTruces"
  | "progressWarsOfIndependence"
  | "allianceResolution"
  | "decreaseWorldTension"
  | "drawNationalGoals"
  | "advanceTurn";

export interface EndPhaseStep {
  /** 1-based position in the printed sequence. */
  order: number;
  /** Rulebook reference (20.0 lists them as (1) 20.1 … (12) 20.12). */
  rule: EndPhaseRule;
  key: EndPhaseStepKey;
  title: string;
  titleZh: string;
  /** Steps that only happen on certain turns (20.11: turns 1, 3, and 5). */
  turns?: readonly number[];
}

const END_PHASE_STEPS: readonly EndPhaseStep[] = Object.freeze([
  Object.freeze({order: 1, rule: "20.1", key: "militarism", title: "Militarism", titleZh: "军事主义"} as const),
  Object.freeze({order: 2, rule: "20.2", key: "degradeForts", title: "Degrade forts", titleZh: "堡垒降级"} as const),
  Object.freeze({order: 3, rule: "20.3", key: "nonPlayerBuild", title: "Non-Player Power Build Step", titleZh: "非玩家势力建造步骤"} as const),
  Object.freeze({order: 4, rule: "20.4", key: "navalUnitsToPort", title: "Naval Units Go to Port", titleZh: "海军单位回港"} as const),
  Object.freeze({order: 5, rule: "20.5", key: "setManpower", title: "Set manpower", titleZh: "设定人力"} as const),
  Object.freeze({order: 6, rule: "20.6", key: "industrialization", title: "Industrialization", titleZh: "工业化"} as const),
  Object.freeze({order: 7, rule: "20.7", key: "progressTruces", title: "Progress truces", titleZh: "推进停战"} as const),
  Object.freeze({order: 8, rule: "20.8", key: "progressWarsOfIndependence", title: "Progress Wars of Independence", titleZh: "推进独立战争"} as const),
  Object.freeze({order: 9, rule: "20.9", key: "allianceResolution", title: "Conduct an Alliance Resolution Step", titleZh: "进行联盟结算"} as const),
  Object.freeze({order: 10, rule: "20.10", key: "decreaseWorldTension", title: "Decrease World Tension", titleZh: "降低世界紧张"} as const),
  Object.freeze({order: 11, rule: "20.11", key: "drawNationalGoals", title: "Draw NGs", titleZh: "抽取国家目标牌", turns: Object.freeze([1, 3, 5]) as readonly number[]} as const),
  Object.freeze({order: 12, rule: "20.12", key: "advanceTurn", title: "Advance Turn", titleZh: "推进回合"} as const),
]);

/**
 * Rule 20.0 — the twelve end-phase steps in printed order:
 * (1) 20.1 Militarism, (2) 20.2 Degrade forts, (3) 20.3 Non-Player Power Build,
 * (4) 20.4 Naval Units Go to Port, (5) 20.5 Set manpower,
 * (6) 20.6 Industrialization, (7) 20.7 Progress truces,
 * (8) 20.8 Progress Wars of Independence, (9) 20.9 Alliance Resolution,
 * (10) 20.10 Decrease World Tension, (11) 20.11 Draw NGs (turns 1/3/5),
 * (12) 20.12 Advance Turn.
 *
 * The returned list is frozen; `resolveEnd` should walk it rather than rely on
 * its own implicit ordering.
 */
export const endPhaseOrder = (): readonly EndPhaseStep[] => END_PHASE_STEPS;
