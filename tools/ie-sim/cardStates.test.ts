/**
 * Card effects against deliberately extreme board states.
 *
 * The pair/triple sweeps answer "do two (or three) cards interact safely?".
 * They start from a normal setup, so they never reach the states that make an
 * effect's *arithmetic* fail: an empty hand where the text says "discard a
 * random card", a power with exactly one card, a hand full of mandatory cards,
 * an eliminated power, a hand that is entirely the industrialization card.
 *
 * Each scenario below builds one such state and plays every action card whose
 * text could touch it, asserting the engine neither throws nor breaks the
 * invariants.  A refusal is fine (the printed gate says so); a crash is not.
 */
import {ImperialElegyState, POWERS, Power} from "../../src/imperialElegy/types";
import {setupImperialElegy} from "../../src/imperialElegy/engine/setup";
import {ACTION_CARDS} from "../../src/imperialElegy/constant/cards.data";
import {eventPlayability} from "../../src/imperialElegy/engine/playability";
import {checkInvariants} from "./harness";
import {makeCtx, playAndSettle, report, takeCardIntoHand} from "./cardSweep";

jest.setTimeout(3600000);

interface Scenario {
  name: string;
  /** Mutate the fresh state into the extreme case. */
  apply: (G: ImperialElegyState, power: Power) => void;
}

const EVERY_OTHER_POWER = (power: Power): Power[] => POWERS.filter((candidate) => candidate !== power);

const SCENARIOS: Scenario[] = [
  {
    name: "every-hand-empty",
    apply: (G, power) => {
      for (const candidate of POWERS) G.powers[candidate].hand = [];
      G.deck = [];
      G.discard = [];
      void power;
    },
  },
  {
    name: "one-card-hands",
    apply: (G, power) => {
      // Exactly one card everywhere, so `die(1) - 1` is the only legal index.
      // The cards removed from the hands go back to the deck so the physical
      // copy still lives in exactly one zone.
      for (const candidate of POWERS) {
        const kept = G.powers[candidate].hand.slice(0, 1);
        const dropped = G.powers[candidate].hand.slice(1);
        G.powers[candidate].hand = kept;
        for (const cardId of dropped) if (!G.deck.includes(cardId as never)) G.deck.push(cardId as never);
      }
      void power;
    },
  },
  {
    name: "hand-is-mandatory-only",
    apply: (G, power) => {
      // Every power holds only mandatory cards, but each gets *different* ones:
      // handing the same card to six players would break the one-copy rule for
      // a harness reason instead of stressing the engine.
      const mandatory = ACTION_CARDS.filter((card) => card.type === "mandatory").map((card) => card.id);
      for (const cardId of mandatory) {
        for (const zone of [G.deck, G.discard] as string[][]) {
          for (let index = zone.indexOf(cardId); index >= 0; index = zone.indexOf(cardId)) zone.splice(index, 1);
        }
        for (const candidate of POWERS) {
          G.powers[candidate].hand = G.powers[candidate].hand.filter((id) => id !== cardId);
        }
      }
      POWERS.forEach((candidate, index) => {
        G.powers[candidate].hand = mandatory
          .filter((_, offset) => offset % POWERS.length === index)
          .slice(0, 3) as never;
      });
      void power;
    },
  },
  {
    name: "no-reserve-armies",
    apply: (G) => {
      for (const candidate of POWERS) {
        for (const id of G.powers[candidate].reserves) delete G.units[id];
        G.powers[candidate].reserves = [];
      }
    },
  },
  {
    name: "no-manpower-or-industry",
    apply: (G) => {
      for (const candidate of POWERS) {
        G.powers[candidate].manpower = 0;
        G.powers[candidate].industry = 0;
        G.powers[candidate].secondaryManpower = 0;
      }
    },
  },
  {
    name: "stability-at-both-extremes",
    apply: (G) => {
      // GE cannot fall further, FR cannot rise further: any "lose/gain 1" effect
      // has to clamp instead of running off the end of the track.
      G.powers.GE.stability = 0;
      G.powers.FR.stability = 6;
      G.powers.AU.stability = 1;
    },
  },
  {
    name: "every-space-fortified",
    apply: (G) => {
      for (const [id, space] of Object.entries(G.spaces)) {
        if (space.control === null) continue;
        space.fort = {power: space.control as never, level: 3};
        void id;
      }
    },
  },
  {
    name: "one-power-eliminated",
    apply: (G, power) => {
      const victim = EVERY_OTHER_POWER(power)[0];
      G.powers[victim].eliminated = true;
      G.powers[victim].hand = [];
      G.powers[victim].reserves = [];
    },
  },
  {
    name: "industry-card-widely-set",
    apply: (G, power) => {
      // A027 parks a card as an industry slot; give every power a *different*
      // card so the "one physical card, one zone" rule is still respected.
      const pool = ACTION_CARDS.filter((card) => card.type === "event" && !card.warOnly && !card.gwOnly);
      POWERS.forEach((candidate, index) => {
        const card = pool[index % pool.length];
        for (const zone of [G.deck, G.discard, G.removed] as string[][]) {
          for (let at = zone.indexOf(card.id); at >= 0; at = zone.indexOf(card.id)) zone.splice(at, 1);
        }
        for (const holder of POWERS) {
          G.powers[holder].hand = G.powers[holder].hand.filter((id) => id !== card.id);
          G.powers[holder].cpChain = G.powers[holder].cpChain.filter((id) => id !== card.id);
        }
        G.powers[candidate].industryCard = card.id;
        G.powers[candidate].autoIndustry = true;
      });
      void power;
    },
  },
  {
    name: "wtt-pinned-at-five",
    apply: (G) => {
      G.wtt = 5;
      G.gw = null;
    },
  },
];

const ALL_IDS = ACTION_CARDS.map((card) => card.id);

const runScenario = (scenario: Scenario, cardId: string, power: Power): {failure: string | null; refused: boolean} => {
  const G = setupImperialElegy(makeCtx(String(POWERS.indexOf(power))));
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = 0;
  scenario.apply(G, power);

  if (!eventPlayability(G, power, cardId as never).ok) return {failure: null, refused: false};

  const outcome = playAndSettle(G, power, cardId);
  if (outcome.refused) return {failure: null, refused: true};
  if (outcome.failure !== null) return {failure: `${scenario.name}/${power}: ${outcome.failure}`, refused: false};
  const problems = checkInvariants(G);
  if (problems.length > 0) return {failure: `${scenario.name}/${power}: invariant ${problems[0]}`, refused: false};
  return {failure: null, refused: false};
};

test("card effects survive extreme board states", () => {
  const failures: string[] = [];
  let runs = 0;
  let refused = 0;
  const started = Date.now();

  for (const scenario of SCENARIOS) {
    for (const power of POWERS) {
      for (const cardId of ALL_IDS) {
        runs += 1;
        const outcome = runScenario(scenario, cardId, power);
        if (outcome.refused) refused += 1;
        if (outcome.failure !== null) failures.push(outcome.failure);
        if (failures.length >= 40) break;
      }
      if (failures.length >= 40) break;
    }
    if (failures.length >= 40) break;
  }

  report("states", {
    runs,
    refused,
    elapsedSeconds: ((Date.now() - started) / 1000).toFixed(1),
  }, failures);
  expect(failures).toEqual([]);
  void takeCardIntoHand;
});
