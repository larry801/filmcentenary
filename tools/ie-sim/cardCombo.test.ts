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
import {ImperialElegyState, POWERS, Power} from "../../src/imperialElegy/types";
import {setupImperialElegy} from "../../src/imperialElegy/engine/setup";
import {checkInvariants} from "./harness";
import {eventPlayability} from "../../src/imperialElegy/engine/playability";
import {makeCtx, PLAYABLE_EVENT_IDS, playAndSettle, report} from "./cardSweep";

jest.setTimeout(3600000);

const ACTION_IDS = PLAYABLE_EVENT_IDS;

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
  if (stepOne.refused) {
    return {failure: `A=${first}: refused despite passing eventPlayability`, refused: false};
  }
  if (stepOne.failure !== null) return {failure: `A=${first}: ${stepOne.failure}`, refused: false};
  const afterFirst = checkInvariants(G);
  if (afterFirst.length > 0) return {failure: `A=${first}: invariant ${afterFirst[0]}`, refused: false};

  // A card may have been removed from the game or the power eliminated; only
  // continue when the power can still act.
  if (G.powers[power].eliminated) return {failure: null, refused: false};
  const stepTwo = playAndSettle(G, power, second);
  if (stepTwo.refused) return {failure: null, refused: true};
  if (stepTwo.failure !== null) return {failure: `A=${first} B=${second}: ${stepTwo.failure}`, refused: false};
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

  report("pairs", {
    runs: pairs,
    refused,
    elapsedSeconds: ((Date.now() - started) / 1000).toFixed(1),
  }, failures);
  expect(failures).toEqual([]);
});
