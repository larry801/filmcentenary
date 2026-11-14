/**
 * Card-effect combination sweep.
 *
 * The existing `src/imperialElegy/fuzz.test.ts` plays each action card once on
 * a fresh state.  That cannot catch an effect that only misbehaves when some
 * earlier card has already changed the board: overlapping stability/industry
 * order, a marker that must be consumed once, a card that removes another
 * card, two `targetPower` prompts in a row, and so on.
 *
 * This sweep plays every ordered pair (A, B) on one state — A resolved
 * completely, then B — and re-checks the structural invariants after each step.
 * Ordered (not unordered) because resolution order is what these effects are
 * sensitive to.
 */
import {Ctx} from "boardgame.io";
import {ImperialElegyState, POWERS, Power} from "../../src/imperialElegy/types";
import {setupImperialElegy} from "../../src/imperialElegy/engine/setup";
import {ACTION_CARDS} from "../../src/imperialElegy/constant/cards.data";
import {cardById} from "../../src/imperialElegy/engine/deck";
import {playCard, resolvePending, declinePending} from "../../src/imperialElegy/moves";
import {checkInvariants} from "./harness";
import {eventPlayability} from "../../src/imperialElegy/engine/playability";

jest.setTimeout(3600000);

const SEATS: string[] = [...POWERS];

/**
 * `Die` must respect `sides`: the engine also uses it for shuffling
 * (`shuffle` draws `Die(i+1)` per card), so a mock that ignores the argument
 * produces duplicate cards and out-of-range indexes that a real die can never
 * produce.
 */
const makeCtx = (seat = "0", die = 3): Ctx =>
  ({
    playerID: seat,
    random: {
      Die: (sides = 6) => Math.min(die, sides),
      Number: () => 0.5,
      Shuffle: (a: unknown[]) => a,
    },
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const ctx = makeCtx();

/** Answer every open decision by taking its first option, to exhaustion. */
const settle = (G: ImperialElegyState, limit = 40): {ok: boolean; reason?: string} => {
  let guard = 0;
  while (G.pending !== null) {
    if (guard++ > limit) return {ok: false, reason: `still pending after ${limit} decisions (${G.pending.kind})`};
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
const readyToPlay = (G: ImperialElegyState, power: Power): void => {
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

/** Play one card for its event and settle, returning a failure string or null. */
const playAndSettle = (G: ImperialElegyState, power: Power, cardId: string): string | null => {
  const def = cardById(cardId);
  if (def.kind !== "action") return "not-an-action-card";
  if (!G.powers[power].hand.includes(cardId)) {
    // Move the single physical copy into this power's hand.  It may already sit
    // in *any* zone — the setup deal hands a specific card to a specific seat,
    // so pulling only from deck/discard left a second copy in another power's
    // hand and tripped the duplicate-card invariant for a harness reason.
    for (const zone of [G.deck, G.discard, G.removed] as string[][]) {
      for (let index = zone.indexOf(cardId); index >= 0; index = zone.indexOf(cardId)) zone.splice(index, 1);
    }
    for (const holder of POWERS) {
      G.powers[holder].hand = G.powers[holder].hand.filter((id) => id !== cardId);
      if (G.powers[holder].industryCard === cardId) G.powers[holder].industryCard = null;
      G.powers[holder].cpChain = G.powers[holder].cpChain.filter((id) => id !== cardId);
    }
    G.powers[power].hand.push(cardId);
  }
  readyToPlay(G, power);
  try {
    const result = playCard(G, makeCtx(String(POWERS.indexOf(power))), cardId as never, "event");
    // A refusal is a printed playability gate and is expected once A has
    // changed the board (A013 raises the WTT, A070 unifies Italy, …).  It is
    // reported separately and is not a failure.
    if (result === "INVALID_MOVE") return "REFUSED";
    const settled = settle(G);
    if (!settled.ok) return settled.reason ?? "settle failed";
    return null;
  } catch (error) {
    return `threw: ${(error as Error)?.message ?? String(error)}`;
  }
};

// Response and combat cards are battle-window only (12.0), except A041, which is
// printed as also playable as a standard event.  Pairing them here would only
// measure the printed gate, not effect interaction.
const ACTION_IDS = ACTION_CARDS
  .filter((card) => (card.type !== "response" && card.type !== "combat") || card.id === "IE-A041")
  .map((card) => card.id);

/** Both orders, on one fresh state per order, with invariants after each card. */
const runPair = (first: string, second: string, power: Power): {failure: string | null; refused: boolean} => {
  const G = setupImperialElegy(makeCtx(String(POWERS.indexOf(power))));
  const beforeFirst = G.powers[power].hand.slice();

  // Some cards are printed "Playable if …" (A031 needs an Afghanistan marker,
  // A049 an Austrian-aligned Bavaria).  On a fresh board those are correctly
  // refused; asking the engine first keeps the sweep about effect interaction
  // rather than about playability gates.
  const playable = eventPlayability(G, power, first as never);
  if (!playable.ok) return {failure: null, refused: false};

  const stepOne = playAndSettle(G, power, first);
  if (stepOne === "REFUSED") {
    return {failure: `A=${first}: refused despite passing eventPlayability`, refused: false};
  }
  if (stepOne !== null) return {failure: `A=${first}: ${stepOne}`, refused: false};
  const afterFirst = checkInvariants(G);
  if (afterFirst.length > 0) return {failure: `A=${first}: invariant ${afterFirst[0]}`, refused: false};

  // A card may have been removed from the game or the power eliminated; only
  // continue when the power can still act.
  if (G.powers[power].eliminated) return {failure: null, refused: false};
  const stepTwo = playAndSettle(G, power, second);
  if (stepTwo === "REFUSED") return {failure: null, refused: true};
  if (stepTwo !== null) return {failure: `A=${first} B=${second}: ${stepTwo}`, refused: false};
  const afterSecond = checkInvariants(G);
  if (afterSecond.length > 0) return {failure: `A=${first} B=${second}: invariant ${afterSecond[0]}`, refused: false};
  void beforeFirst;
  return {failure: null, refused: false};
};

test("every ordered pair of action cards resolves and keeps the invariants", () => {
  const failures: string[] = [];
  let pairs = 0;
  let refused = 0;
  const started = Date.now();

  for (const first of ACTION_IDS) {
    for (const second of ACTION_IDS) {
      if (first === second) continue;
      // Rotate the acting power so the pair is not always seen from GE.
      const power = POWERS[ACTION_IDS.indexOf(first) % POWERS.length];
      pairs += 1;
      const outcome = runPair(first, second, power);
      if (outcome.refused) refused += 1;
      if (outcome.failure !== null) failures.push(outcome.failure);
      if (failures.length >= 40) break;
    }
    if (failures.length >= 40) break;
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`ran ${pairs} ordered pairs in ${elapsed}s, ${refused} second card(s) refused by a printed gate, ${failures.length} failure(s)`);
  for (const failure of failures.slice(0, 40)) console.log(`  ${failure}`);
  expect(failures).toEqual([]);
});
