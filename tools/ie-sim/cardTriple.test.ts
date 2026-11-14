/**
 * Card-effect triple sweep.
 *
 * The pair sweep (`cardCombo.test.ts`) proves that any two playable events can
 * follow each other.  Some state only becomes reachable after three: a third
 * card can overlap a marker the first two both wrote, or replay a chain the
 * second one armed.
 *
 * There are ~1.6M ordered triples, so this samples them: a deterministic
 * stratification (seeded PRNG, fixed seed) that guarantees every card appears
 * as the first, middle and last element, then keeps a fixed budget.  The sample
 * is reproducible — the same seed always probes the same triples — so a
 * reported failure can be re-run exactly.
 */
import {ImperialElegyState, POWERS, Power} from "../../src/imperialElegy/types";
import {setupImperialElegy} from "../../src/imperialElegy/engine/setup";
import {eventPlayability} from "../../src/imperialElegy/engine/playability";
import {checkInvariants} from "./harness";
import {makeCtx, PLAYABLE_EVENT_IDS, playAndSettle, report} from "./cardSweep";

jest.setTimeout(3600000);

/** How many triples to probe; `IE_TRIPLES` overrides. */
const BUDGET = Number(process.env.IE_TRIPLES ?? 20000);

/** mulberry32 — small, fast, and identical across runs for a given seed. */
const prng = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Build the triple list.  The first pass is a deliberate cover — every card in
 * each position, rotated across the six powers — and the rest is a seeded
 * sample, so widening `BUDGET` never re-shuffles the early probes.
 */
const buildTriples = (budget: number): {cards: [string, string, string]; power: Power}[] => {
  const ids = PLAYABLE_EVENT_IDS;
  const triples: {cards: [string, string, string]; power: Power}[] = [];
  const random = prng(0x1e5e1ec7);

  // 1. Cover: each card as first / middle / last against two rotating partners.
  for (let i = 0; i < ids.length; i += 1) {
    const first = ids[i];
    const middle = ids[(i + 37) % ids.length];
    const last = ids[(i + 71) % ids.length];
    if (new Set([first, middle, last]).size === 3) {
      triples.push({cards: [first, middle, last], power: POWERS[i % POWERS.length]});
    }
  }
  for (let i = 0; i < ids.length; i += 1) {
    const first = ids[(i + 11) % ids.length];
    const middle = ids[i];
    const last = ids[(i + 53) % ids.length];
    if (new Set([first, middle, last]).size === 3) {
      triples.push({cards: [first, middle, last], power: POWERS[(i + 2) % POWERS.length]});
    }
  }
  for (let i = 0; i < ids.length; i += 1) {
    const first = ids[(i + 19) % ids.length];
    const middle = ids[(i + 61) % ids.length];
    const last = ids[i];
    if (new Set([first, middle, last]).size === 3) {
      triples.push({cards: [first, middle, last], power: POWERS[(i + 4) % POWERS.length]});
    }
  }

  // 2. Seeded sample up to the budget.
  const seen = new Set(triples.map((entry) => entry.cards.join(">")));
  let attempts = 0;
  while (triples.length < budget && attempts < budget * 12) {
    attempts += 1;
    const first = ids[Math.floor(random() * ids.length)];
    const middle = ids[Math.floor(random() * ids.length)];
    const last = ids[Math.floor(random() * ids.length)];
    if (new Set([first, middle, last]).size !== 3) continue;
    const key = `${first}>${middle}>${last}`;
    if (seen.has(key)) continue;
    seen.add(key);
    triples.push({cards: [first, middle, last], power: POWERS[Math.floor(random() * POWERS.length)]});
  }
  return triples;
};

/** Play three cards in order on one fresh state, checking invariants after each. */
const runTriple = (cards: [string, string, string], power: Power): {failure: string | null; refused: number} => {
  const G: ImperialElegyState = setupImperialElegy(makeCtx(String(POWERS.indexOf(power))));
  let refused = 0;

  for (let step = 0; step < cards.length; step += 1) {
    const cardId = cards[step];

    // A printed playability gate only matters for the leading card: once an
    // earlier card has changed the board, a refusal is legitimate.
    if (step === 0 && !eventPlayability(G, power, cardId as never).ok) {
      return {failure: null, refused: 0};
    }
    if (G.powers[power].eliminated) return {failure: null, refused};

    const outcome = playAndSettle(G, power, cardId);
    if (outcome.refused) {
      refused += 1;
      // Later cards were gated off; stop rather than play out of turn.
      return {failure: null, refused};
    }
    if (outcome.failure !== null) {
      const label = cards.slice(0, step + 1).join(" > ");
      return {failure: `${label}: ${outcome.failure}`, refused};
    }
    const problems = checkInvariants(G);
    if (problems.length > 0) {
      const label = cards.slice(0, step + 1).join(" > ");
      return {failure: `${label}: invariant ${problems[0]}`, refused};
    }
  }
  return {failure: null, refused};
};

test("sampled ordered triples of action cards keep the invariants", () => {
  const triples = buildTriples(BUDGET);
  const failures: string[] = [];
  const started = Date.now();
  let refused = 0;
  let runs = 0;

  for (const triple of triples) {
    runs += 1;
    const outcome = runTriple(triple.cards, triple.power);
    refused += outcome.refused;
    if (outcome.failure !== null) failures.push(`[${triple.power}] ${outcome.failure}`);
    if (failures.length >= 40) break;
  }

  report("triples", {
    runs,
    refused,
    elapsedSeconds: ((Date.now() - started) / 1000).toFixed(1),
  }, failures);
  expect(failures).toEqual([]);
});
