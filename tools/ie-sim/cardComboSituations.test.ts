/**
 * Card-effect pairs under different board situations.
 *
 * `cardCombo.test.ts` runs every ordered pair of *event* cards in the plain
 * action phase.  That leaves two kinds of card untested:
 *
 *   - the four `warOnly` responses (A023/A024 maneuver, A063/A064 alliance),
 *     which are played with `playResponseCard` and only inside a war;
 *   - generic response cards, which are battle-window only and are refused by
 *     `playCard` in every situation.
 *
 * This suite re-runs the pairs in each board situation, using the move the card
 * actually expects (`playCard` for events, `playResponseCard` for responses), and
 * only pairs the cards the engine says are playable *there*.  The per-situation
 * counts therefore differ — that is the measurement.
 */
import {Ctx} from "boardgame.io";
import {ImperialElegyState, POWERS, Power} from "../../src/imperialElegy/types";
import {setupImperialElegy} from "../../src/imperialElegy/engine/setup";
import {ACTION_CARDS} from "../../src/imperialElegy/constant/cards.data";
import {responseCardEligibility} from "../../src/imperialElegy/moves";
import {eventPlayability} from "../../src/imperialElegy/engine/playability";
import {checkInvariants} from "./harness";
import {makeCtx, settle, takeCardIntoHand} from "./cardSweep";
import {playCard, playResponseCard} from "../../src/imperialElegy/moves";

jest.setTimeout(3600000);

type Situation = "action" | "warManeuver" | "warAlliance" | "greatWar";

interface SituationSpec {
  name: Situation;
  prepare: (G: ImperialElegyState, power: Power) => void;
}

const opponentOf = (power: Power): Power => POWERS.find((candidate) => candidate !== power)!;

const warState = (
  G: ImperialElegyState,
  attacker: Power,
  defender: Power,
  status: "maneuver" | "alliance",
): void => {
  G.war = {
    attacker,
    defender,
    attackerAllies: [],
    defenderAllies: [],
    attackerMinors: [],
    defenderMinors: [],
    warAim: "conquest",
    objectives: [],
    status,
    budgets: {[attacker]: 4, [defender]: 4},
    initiative: [attacker, defender],
    initiativeRolls: {},
    truceTurns: 0,
    turn: G.turn,
    declarations: [],
  } as never;
};

const gwState = (G: ImperialElegyState, power: Power): void => {
  G.gw = {
    active: true, turn: 2, order: [power], belligerents: [power], neutrals: [],
    te: [power], ta: [], usIn: false, italyIn: false,
    usStability: 3, usManpower: 3, usBudget: 4,
    italyStability: 3, italyManpower: 3, italyBudget: 2,
    trenches: {}, lastColonialWar: null, victor: null,
    outbreakDone: true, nationalWillDone: true, bonusImpulses: [], discard: [],
  } as never;
};

const SITUATIONS: SituationSpec[] = [
  {
    name: "action",
    prepare: (G, power) => {
      G.phase = "action";
      G.activePower = power;
      G.war = null;
    },
  },
  {
    name: "warManeuver",
    prepare: (G, power) => {
      G.phase = "wartime";
      G.activePower = power;
      warState(G, power, opponentOf(power), "maneuver");
      G.powers[power].flags.warCpSpentThisImpulse = false;
    },
  },
  {
    name: "warAlliance",
    prepare: (G, power) => {
      G.phase = "wartime";
      G.activePower = power;
      warState(G, power, opponentOf(power), "alliance");
    },
  },
  {
    name: "greatWar",
    prepare: (G, power) => {
      G.phase = "action";
      G.activePower = power;
      G.war = null;
      gwState(G, power);
    },
  },
];

/** The move a card expects, or null when it cannot be played in this situation. */
const entryFor = (G: ImperialElegyState, power: Power, cardId: string): "event" | "response" | null => {
  const def = ACTION_CARDS.find((card) => card.id === cardId);
  if (def === undefined) return null;
  if (def.type === "response" || def.type === "combat") {
    return responseCardEligibility(G, power, cardId as never).ok ? "response" : null;
  }
  return eventPlayability(G, power, cardId as never).ok ? "event" : null;
};

/** Playing a response does not open an impulse, so restore the window before the second card. */
const play = (G: ImperialElegyState, power: Power, cardId: string, entry: "event" | "response"): {failure: string | null; refused: boolean} => {
  takeCardIntoHand(G, power, cardId);
  if (!G.powers[power].hand.includes(cardId as never)) return {failure: `card ${cardId} unavailable`, refused: false};
  G.pending = null;
  G.pendingStack = [];
  G.battle = null;
  G.cpRemaining = 0;
  G.resolvingCard = null;
  G.impulseCard = null;
  try {
    const ctx: Ctx = makeCtx(String(POWERS.indexOf(power)));
    const result = entry === "response"
      ? playResponseCard(G, ctx, cardId as never)
      : playCard(G, ctx, cardId as never, "event");
    if (result === "INVALID_MOVE") return {failure: null, refused: true};
    const settled = settle(G);
    if (!settled.ok) return {failure: settled.reason ?? "settle failed", refused: false};
    return {failure: null, refused: false};
  } catch (error) {
    return {failure: `threw: ${(error as Error)?.message ?? String(error)}`, refused: false};
  }
};

const runPair = (
  spec: SituationSpec,
  first: string,
  second: string,
  power: Power,
): {failure: string | null; refused: boolean; tested: boolean} => {
  const G = setupImperialElegy(makeCtx(String(POWERS.indexOf(power))));
  spec.prepare(G, power);

  const firstEntry = entryFor(G, power, first);
  if (firstEntry === null) return {failure: null, refused: false, tested: false};

  const stepOne = play(G, power, first, firstEntry);
  if (stepOne.failure !== null) return {failure: `A=${first}: ${stepOne.failure}`, refused: false, tested: true};
  if (stepOne.refused) return {failure: `A=${first}: refused after passing its gate`, refused: false, tested: true};
  const afterFirst = checkInvariants(G);
  if (afterFirst.length > 0) return {failure: `A=${first}: invariant ${afterFirst[0]}`, refused: false, tested: true};
  if (G.powers[power].eliminated) return {failure: null, refused: false, tested: true};

  // A card may have ended the war; re-establish the window for card two.
  spec.prepare(G, power);
  const secondEntry = entryFor(G, power, second);
  if (secondEntry === null) return {failure: null, refused: true, tested: true};

  const stepTwo = play(G, power, second, secondEntry);
  if (stepTwo.refused) return {failure: null, refused: true, tested: true};
  if (stepTwo.failure !== null) return {failure: `A=${first} B=${second}: ${stepTwo.failure}`, refused: false, tested: true};
  const afterSecond = checkInvariants(G);
  if (afterSecond.length > 0) return {failure: `A=${first} B=${second}: invariant ${afterSecond[0]}`, refused: false, tested: true};
  return {failure: null, refused: false, tested: true};
};

test("ordered pairs resolve in every board situation", () => {
  const failures: string[] = [];
  const ALL_IDS = ACTION_CARDS.map((card) => card.id);

  for (const spec of SITUATIONS) {
    const started = Date.now();
    let runs = 0;
    let refused = 0;

    for (const power of POWERS) {
      // Only the cards this situation actually admits, so the pair count shows
      // what the situation adds (the warOnly responses appear only in wars).
      const probe = setupImperialElegy(makeCtx(String(POWERS.indexOf(power))));
      spec.prepare(probe, power);
      const cards = ALL_IDS.filter((cardId) => entryFor(probe, power, cardId) !== null);
      if (cards.length < 2) continue;

      for (const first of cards) {
        for (const second of cards) {
          if (first === second) continue;
          runs += 1;
          const outcome = runPair(spec, first, second, power);
          if (!outcome.tested) { runs -= 1; continue; }
          if (outcome.refused) refused += 1;
          if (outcome.failure !== null) failures.push(`[${spec.name}/${power}] ${outcome.failure}`);
          if (failures.length >= 40) break;
        }
        if (failures.length >= 40) break;
      }
      if (failures.length >= 40) break;
    }

    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`${spec.name}: ${runs} pairs in ${elapsed}s, ${refused} refused by a printed gate, ${failures.length === 0 ? "0" : failures.length} failure(s)`);
    if (failures.length >= 40) break;
  }

  for (const failure of failures.slice(0, 40)) console.log(`  ${failure}`);
  expect(failures).toEqual([]);
});
