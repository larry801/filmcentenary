/**
 * Imperial Elegy — pure privacy redaction for player views.
 *
 * `redactForView` builds a fresh, JSON-serializable copy of the authoritative
 * state in which every private zone and every secret decision detail is
 * hidden from everybody except the seat that owns it.  The input state is
 * never mutated.
 *
 * The module deliberately has no React dependency: it is the reusable piece
 * behind the boardgame.io `playerView` hook, and can also be used by bots,
 * tests and server-side observers.
 */

import {
  CardId,
  ImperialElegyState,
  LogEntry,
  PendingDecision,
  Power,
  POWERS,
  PowerState,
} from "../types";
import {cardById, isCardId} from "./deck";
import {FaceupCombatMap, faceupCombatCards} from "./greatWarFlow";

/** Placeholder written where a hidden card id used to be. */
export const HIDDEN_CARD = "hidden" as const;

/** Public counters added to every redacted view. */
export interface RedactedView extends ImperialElegyState {
  handCounts: Record<Power, number>;
  goalCounts: Record<Power, number>;
  deckCount: number;
  discardCount: number;
  removedCount: number;
  /**
   * Public size of the Great War discard pile.  Its card order is hidden for
   * every viewer, exactly like the top-level `discard` pile.
   */
  gwDiscardCount: number;
  /** Faceup Great War combat cards are public by rule. */
  faceupCombat: FaceupCombatMap;
}

/**
 * The only part of boardgame.io's `Ctx` this module can use.  `viewerSeat`
 * is authoritative; `ctx` is accepted so a `playerView` call site can pass
 * its context through unchanged.
 */
export interface RedactContext {
  playerID?: string | null;
}

/**
 * Per-power flags that are **public** by rule and are therefore copied into
 * every opponent/spectator view.  Everything else in `PowerState.flags` stays
 * private: that bag also holds hand/decision bookkeeping (`savedCards`,
 * `ngChoices`, `pendingCard`, `cpChain*`), which must never leak.
 *
 * Rule basis for each entry:
 *  - `powerProjection` — the power-projection limit is a printed track on the
 *    player display (12.4/12.6; the playbook prints the starting limits), and
 *    naval construction raises it publicly.
 *  - `professionalArmy` — 33.2 UK national characteristic printed on the UK
 *    player display (the British army limit is public).
 *  - `rapidMobilization`, `rapidFreeDeployUsed` — A063 Rapid Mobilization: the
 *    card is played faceup, so the first-impulse priority and its one free
 *    deploy are public; the flag only marks that the public grant was used.
 *  - `reserveLimitBonus` — card 110 Extreme Militarism is a permanent, visible
 *    display bonus ("increased by 1 until the end of the game").
 *  - `navalLimit` — 12.4: the Dreadnought/Naval Arms Race events are public and
 *    decide which powers may build dreadnoughts (and their fleet limit).
 *  - `navalDiscount` — Naval Arms Race's public construction discount.
 *  - `plusCards` — 10.2/10.3 plus-card markers sit on the player display and
 *    change how many action cards a power draws; both are public.
 *  - `industryDrm` — 20.6 industrialisation DRMs come from public events such
 *    as World's Fair; the roll itself is public.
 *  - `warDeclaration` — a home-card war declaration entitlement (Bismarck,
 *    Aux Armes, Russo-Turkish Wars, Jihad) is public once the card resolves.
 *  - `balanceOfPower` — the UK home card's public declaration response.
 *  - `modernization` — the OT Modernization home-card event, public.
 *  - `noBuildArmiesThisImpulse` — Liberal Reforms' public restriction.
 *  - `freeColonialCp` — a public event grant of free colonial CP (Sun Never
 *    Sets, Our Place in the Sun).
 */
export const PUBLIC_POWER_FLAGS: readonly string[] = [
  "powerProjection",
  "professionalArmy",
  "rapidMobilization",
  "rapidFreeDeployUsed",
  "reserveLimitBonus",
  "navalLimit",
  "navalDiscount",
  "plusCards",
  "industryDrm",
  "warDeclaration",
  "balanceOfPower",
  "modernization",
  "noBuildArmiesThisImpulse",
  "freeColonialCp",
] as const;

const PUBLIC_POWER_FLAG_SET = new Set<string>(PUBLIC_POWER_FLAGS);

/** Copy only the public flags of `flags` (a fresh object, safe to hand to a client). */
export const publicPowerFlags = (
  flags: Record<string, number | boolean | string>,
): Record<string, number | boolean | string> => {
  const publicFlags: Record<string, number | boolean | string> = {};
  for (const key of PUBLIC_POWER_FLAGS) {
    if (Object.prototype.hasOwnProperty.call(flags, key)) publicFlags[key] = flags[key];
  }
  return publicFlags;
};

/** True when `flag` is one of the public per-power flags. */
export const isPublicPowerFlag = (flag: string): boolean => PUBLIC_POWER_FLAG_SET.has(flag);

/** Log argument keys whose values identify a card and must be private. */
const SENSITIVE_CARD_ARGS = ["card", "incitingCard"] as const;

/** Top-level flags that describe the card behind an open decision. */
const SENSITIVE_PENDING_FLAGS = ["pendingCard", "pendingMandatory", "pendingResponse"] as const;

/**
 * Great War card-order arrays that are private ordering, not public state.
 * Only `discard` qualifies today; `combatCardsInFront` is deliberately absent
 * because cards in front of a player (faceup or facedown) are public by rule
 * 26.1.  New hidden GW piles belong in this list so they are redacted too.
 */
const GW_PRIVATE_CARD_ORDERINGS = ["discard"] as const;

const seatOf = (power: Power): string => String(POWERS.indexOf(power));

const powerOfSeat = (seat: string | null): Power | null => {
  if (seat === null) return null;
  const index = Number(seat);
  // Only canonical seat ids ("0"…"5") carry private access; "" must not
  // accidentally coerce to seat 0.
  if (!Number.isInteger(index) || String(index) !== seat) return null;
  return index >= 0 && index < POWERS.length ? POWERS[index] : null;
};

const isOwner = (seat: string | null, power: Power): boolean => seatOf(power) === seat;

/** Hide every secret detail of a suspended/active decision. */
const hideDecision = (decision: PendingDecision): PendingDecision => ({
  ...decision,
  options: [],
  context: {},
  promptArgs: {},
});

/**
 * Card → owner attribution gathered from the action log.  A card that was
 * played (and therefore logged with its owner) is still attributable after it
 * leaves the hand and is removed from the game.
 */
const cardOwnersFromLog = (G: ImperialElegyState): Map<CardId, Power> => {
  const owners = new Map<CardId, Power>();
  // A legacy save (or a partial fixture) may predate the log container.
  for (const entry of G.log ?? []) {
    if (entry.power === undefined) continue;
    for (const key of SENSITIVE_CARD_ARGS) {
      const card = entry.args?.[key];
      if (typeof card === "string" && card !== HIDDEN_CARD) owners.set(card, entry.power);
    }
  }
  return owners;
};

const ownerFromCardDefinition = (card: CardId): Power | null => {
  if (!isCardId(card)) return null;
  return cardById(card).power ?? null;
};

/**
 * Resolve the power a log entry is private to.  `entry.power` is preferred;
 * for entries without a power (card removals and WTT changes log no actor) we
 * fall back to the card's recorded player, its printed home power, and
 * finally the power whose action produced the entry.
 */
const logEntryOwner = (
  G: ImperialElegyState,
  entry: LogEntry,
  owners: Map<CardId, Power>,
): Power | null => {
  if (entry.power !== undefined) return entry.power;

  for (const key of SENSITIVE_CARD_ARGS) {
    const card = entry.args?.[key];
    if (typeof card !== "string" || card === HIDDEN_CARD) continue;
    const fromLog = owners.get(card);
    if (fromLog !== undefined) return fromLog;
    const fromDefinition = ownerFromCardDefinition(card);
    if (fromDefinition !== null) return fromDefinition;
  }

  // Action-scoped entries (card removal, WTT max) are caused by the active
  // power's action and are that power's information.
  return G.activePower;
};

const redactLog = (G: ImperialElegyState, entries: LogEntry[], seat: string | null): LogEntry[] => {
  const owners = cardOwnersFromLog(G);
  return entries.map((entry) => {
    const hasSensitiveArg = SENSITIVE_CARD_ARGS.some((key) => typeof entry.args?.[key] === "string");
    if (!hasSensitiveArg) return entry;

    const owner = logEntryOwner(G, entry, owners);
    if (owner !== null && isOwner(seat, owner)) return entry;

    const args: Record<string, unknown> = {...entry.args};
    for (const key of SENSITIVE_CARD_ARGS) {
      if (typeof args[key] === "string") args[key] = HIDDEN_CARD;
    }
    return {...entry, args};
  });
};

/**
 * Build the view of `G` that `viewerSeat` (a boardgame.io player id, or
 * `null` for a spectator) is allowed to see.
 *
 * Guarantees:
 *  - the returned state is a new object graph and the input is untouched;
 *  - hand, goal deck, goals and the Great War card are visible only to their
 *    owner;
 *  - per-power flags are split by rule: only the documented `PUBLIC_POWER_FLAGS`
 *    (printed display tracks and resolved public events) are copied to other
 *    viewers; hand, goal, decision and card-identity flags stay hidden;
 *  - deck/discard/removed ordering is replaced by public counts;
 *  - the Great War discard pile is emptied for every viewer, including its
 *    owner, and replaced by the public `gwDiscardCount`; cards in front of a
 *    player (`gw.combatCardsInFront`) stay visible because they are public;
 *  - pending decisions and suspended pending decisions expose their options,
 *    context and prompt arguments only to their owner;
 *  - while a decision is open, the inciting card fields at the top level and
 *    in `flags` are hidden from non-owners;
 *  - log arguments naming a card (`card`, `incitingCard`) are masked for
 *    non-owners even when the log entry has no `power` attribution.  Entries
 *    that do not name a card are left untouched.
 */
export const redactForView = (
  G: ImperialElegyState,
  viewerSeat: string | null,
  ctx?: RedactContext,
): RedactedView => {
  // The explicit seat is authoritative. `ctx` only supplies a fallback if a
  // caller omits the seat at runtime (playerView always passes it).
  const requestedSeat = viewerSeat as string | null | undefined;
  const seat = requestedSeat === undefined ? ctx?.playerID ?? null : requestedSeat;
  const viewerPower = powerOfSeat(seat);

  const view = JSON.parse(JSON.stringify(G)) as RedactedView;

  // Public counts replace the hidden orderings.  `?? 0` keeps a save that
  // predates one of the piles loadable: `playerView` must never throw.
  view.deckCount = G.deck?.length ?? 0;
  view.discardCount = G.discard?.length ?? 0;
  view.removedCount = G.removed?.length ?? 0;
  view.faceupCombat = faceupCombatCards(G);
  view.deck = [];
  view.discard = [];
  view.removed = [];

  // The Great War discard pile follows the same precedent as the top-level
  // discard: its size is public, its order and card ids are not.  Owners do
  // not get an exception either, so a view can never be used to reconstruct
  // which GW combat card was played after the dice.
  view.gwDiscardCount = G.gw?.discard?.length ?? 0;
  if (view.gw) {
    for (const key of GW_PRIVATE_CARD_ORDERINGS) view.gw[key] = [];
  }

  const sourcePowers = G.powers as Record<Power, PowerState | undefined> | undefined;
  const viewPowers = view.powers as Record<Power, PowerState | undefined> | undefined;
  view.handCounts = {} as Record<Power, number>;
  view.goalCounts = {} as Record<Power, number>;
  for (const power of POWERS) {
    // A legacy save or partial fixture may lack a seat (or one of its bags);
    // the public counts fall back to 0 instead of throwing in this hook.
    view.handCounts[power] = sourcePowers?.[power]?.hand?.length ?? 0;
    view.goalCounts[power] = sourcePowers?.[power]?.goals?.length ?? 0;

    if (viewerPower !== power) {
      const hidden = viewPowers?.[power];
      if (hidden === undefined || hidden === null) continue;
      hidden.hand = [];
      hidden.goalDeck = [];
      hidden.goals = [];
      hidden.gwCard = null;
      // Split the flag bag: harmless, rule-public flags stay visible; hand,
      // decision and card bookkeeping stays hidden.
      hidden.flags = publicPowerFlags(sourcePowers?.[power]?.flags ?? {});
    }
  }

  // Active and suspended decisions are redacted per deciding power.  A save
  // that predates `pendingStack` (or one of the decision containers) is read
  // with `??` fallbacks so the view is always buildable.
  const openPending = (G.pending ?? null) as PendingDecision | null;
  if (openPending !== null && viewerPower !== openPending.power) {
    view.pending = hideDecision(view.pending!);
  }
  const pendingStack = (G.pendingStack ?? []).filter(
    (decision): decision is PendingDecision => decision !== undefined && decision !== null,
  );
  view.pendingStack = pendingStack.map((decision) =>
    viewerPower === decision.power ? decision : hideDecision(decision),
  );

  // The inciting card of an open decision is part of the deciding power's
  // private information.  A suspended decision also keeps the card hidden.
  const decisionOpen = openPending !== null || pendingStack.length > 0;
  const ownsOpenDecision = openPending !== null && viewerPower === openPending.power;
  if (decisionOpen && !ownsOpenDecision) {
    view.resolvingCard = null;
    view.impulseCard = null;
    const flags = view.flags as Record<string, boolean | number | string> | undefined;
    if (flags !== undefined && flags !== null) {
      for (const key of SENSITIVE_PENDING_FLAGS) delete flags[key];
    }
  }

  view.log = redactLog(G, view.log ?? [], seat);
  return view;
};

export default redactForView;
