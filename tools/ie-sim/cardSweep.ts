/**
 * Shared scaffolding for the card-effect sweeps.
 *
 * `cardCombo.test.ts` (ordered pairs), `cardTriple.test.ts` (ordered triples)
 * and `cardComboSituations.test.ts` (pairs under a wartime / Great War board)
 * all need the same four things: a deterministic ctx whose `Die` respects
 * `sides`, a way to put one physical card into a power's hand from wherever the
 * setup deal put it, a settle loop for pending decisions, and the
 * "isolate the failure" reporting shape.
 */
import {Ctx} from "boardgame.io";
import {ImperialElegyState, Power, POWERS} from "../../src/imperialElegy/types";
import {ACTION_CARDS} from "../../src/imperialElegy/constant/cards.data";
import {cardById} from "../../src/imperialElegy/engine/deck";
import {declinePending, playCard, resolvePending} from "../../src/imperialElegy/moves";

/**
 * `Die` must respect `sides`: the engine also uses it for shuffling (`shuffle`
 * draws `Die(i+1)` per card), so a mock that ignores the argument produces
 * duplicate cards and out-of-range indexes that a real die can never produce.
 */
export const makeCtx = (seat = "0", die = 3): Ctx =>
  ({
    playerID: seat,
    random: {
      Die: (sides = 6) => Math.min(die, sides),
      Number: () => 0.5,
      Shuffle: (a: unknown[]) => a,
    },
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

/** Response and combat cards are battle-window only (12.0), except A041. */
export const PLAYABLE_EVENT_IDS: string[] = ACTION_CARDS
  .filter((card) => (card.type !== "response" && card.type !== "combat") || card.id === "IE-A041")
  .map((card) => card.id);

/** Answer every open decision by taking its first option, to exhaustion. */
export const settle = (G: ImperialElegyState, limit = 60): {ok: boolean; reason?: string} => {
  let guard = 0;
  while (G.pending !== null) {
    if (guard++ > limit) {
      return {ok: false, reason: `still pending after ${limit} decisions (${G.pending.kind})`};
    }
    const pending = G.pending;
    const option = pending.options[0];
    const seat = String(POWERS.indexOf(pending.power as Power));
    const answer = makeCtx(seat, 3 + (guard % 4));
    if (option === undefined) declinePending(G, answer);
    else resolvePending(G, answer, option.id);
  }
  return {ok: true};
};

/** Put the state back into "this power may play an event now". */
export const readyToPlay = (G: ImperialElegyState, power: Power): void => {
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = 0;
  G.pending = null;
  G.pendingStack = [];
  G.battle = null;
  G.passed = G.passed.filter((p) => p !== power);
  G.powers[power].flags.passed = false;
  G.powers[power].flags.actionCpSpentThisImpulse = false;
  G.impulseCard = null;
  G.resolvingCard = null;
};

/**
 * Move the single physical copy of `cardId` into `power`'s hand.
 *
 * The setup deal hands a specific card to a specific seat, so pulling only from
 * deck/discard left a second copy in another power's hand and tripped the
 * duplicate-card invariant for a harness reason.
 */
export const takeCardIntoHand = (G: ImperialElegyState, power: Power, cardId: string): void => {
  if (G.powers[power].hand.includes(cardId as never)) return;
  for (const zone of [G.deck, G.discard, G.removed] as string[][]) {
    for (let index = zone.indexOf(cardId); index >= 0; index = zone.indexOf(cardId)) zone.splice(index, 1);
  }
  for (const holder of POWERS) {
    G.powers[holder].hand = G.powers[holder].hand.filter((id) => id !== cardId);
    if (G.powers[holder].industryCard === cardId) G.powers[holder].industryCard = null;
    G.powers[holder].cpChain = G.powers[holder].cpChain.filter((id) => id !== cardId);
  }
  G.powers[power].hand.push(cardId as never);
};

export type PlayOutcome = {failure: string | null; refused: boolean};

/**
 * Play one card for its event and settle.
 *
 * A refusal is a printed playability gate and is expected once an earlier card
 * has changed the board (A013 raises the WTT, A070 unifies Italy, …), so it is
 * reported as `refused` and is not a failure.
 */
export const playAndSettle = (G: ImperialElegyState, power: Power, cardId: string): PlayOutcome => {
  const def = cardById(cardId as never);
  if (def === undefined) return {failure: `unknown card ${cardId}`, refused: false};
  if (def.kind !== "action") return {failure: `not-an-action-card ${cardId}`, refused: false};
  takeCardIntoHand(G, power, cardId);
  readyToPlay(G, power);
  try {
    const result = playCard(G, makeCtx(String(POWERS.indexOf(power))), cardId as never, "event");
    if (result === "INVALID_MOVE") return {failure: null, refused: true};
    const settled = settle(G);
    if (!settled.ok) return {failure: settled.reason ?? "settle failed", refused: false};
    return {failure: null, refused: false};
  } catch (error) {
    return {failure: `threw: ${(error as Error)?.message ?? String(error)}`, refused: false};
  }
};

/** Format the first few failures for the console, plus the total. */
export const report = (
  label: string,
  counters: {runs: number; refused: number; elapsedSeconds: string},
  failures: string[],
): void => {
  console.log(
    `${label}: ${counters.runs} run(s) in ${counters.elapsedSeconds}s, `
    + `${counters.refused} card(s) refused by a printed gate, ${failures.length} failure(s)`,
  );
  for (const failure of failures.slice(0, 40)) console.log(`  ${failure}`);
};
