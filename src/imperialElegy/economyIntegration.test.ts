/**
 * Imperial Elegy — economy integration tests.
 *
 * These exercise the live `game.ts` phase hooks and `moves.ts` end/action
 * paths against `engine/economy.ts`:
 *  - the decade advances with the turn and entering cards never duplicate a
 *    card already in a hand, home slot, CP chain, or industry slot;
 *  - end-phase reserve growth respects the reserve-box allowance (UK: none);
 *  - industrialization uses the RU/OT target of 6 and the auto chit;
 *  - the CP Chain funds one action of at most 4 CP per action phase, mandatory
 *    events played into the chain still trigger, chained cards are discarded
 *    at the end of the action phase, and chain CP cannot industrialize.
 */

import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {CardId, ImperialElegyState, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {ALL_CARDS, cardsForDecade, decadeForTurn as deckDecadeForTurn} from "./engine/deck";
import {
  cpChainResolution,
  decadeForTurn,
  industryTarget,
  reserveAllowance,
  reserveRemaining,
} from "./engine/economy";
import {cpChain, endImpulse, industrialize, resolveEnd, surrender, useCpChain} from "./moves";
import {createWarState} from "./engine/limitedWar";
import {ImperialElegyGameDef} from "./game";

const makeCtx = (playerID: string | null = "0", dieFace = 3): Ctx =>
  ({
    playerID,
    random: {Die: (_sides: number) => dieFace},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

type PhaseOnBegin = (G: ImperialElegyState, ctx: Ctx) => void;
const onBegin = (phase: "prep" | "action" | "end"): PhaseOnBegin =>
  (ImperialElegyGameDef.phases as unknown as Record<string, {onBegin: PhaseOnBegin}>)[phase].onBegin;

/** Every zone economy.ts treats as "already in play". */
const allCardsInPlay = (G: ImperialElegyState): CardId[] => [
  ...G.deck,
  ...G.discard,
  ...G.removed,
  ...POWERS.flatMap((power) => {
    const p = G.powers[power];
    return [...p.hand, ...p.homeCards, ...p.cpChain, ...(p.industryCard ? [p.industryCard] : [])];
  }),
];

/** Pull a card out of every zone so a test can place it deliberately. */
const takeCard = (G: ImperialElegyState, id: CardId): void => {
  G.deck = G.deck.filter((card) => card !== id);
  G.discard = G.discard.filter((card) => card !== id);
  G.removed = G.removed.filter((card) => card !== id);
  for (const power of POWERS) {
    const p = G.powers[power];
    p.hand = p.hand.filter((card) => card !== id);
    p.homeCards = p.homeCards.filter((card) => card !== id);
    p.cpChain = p.cpChain.filter((card) => card !== id);
    if (p.industryCard === id) p.industryCard = null;
  }
};

const giveToHand = (G: ImperialElegyState, power: (typeof POWERS)[number], id: CardId): void => {
  takeCard(G, id);
  G.powers[power].hand.push(id);
};

const beginAction = (G: ImperialElegyState, active: (typeof POWERS)[number] = "GE"): void => {
  onBegin("action")(G, makeCtx(String(POWERS.indexOf(active))));
  G.activePower = active;
  G.cpRemaining = 0;
};

const actionCard = (cp: number): CardId => {
  const card = ALL_CARDS.find(
    (c) =>
      c.kind === "action" &&
      c.cp === cp &&
      c.type !== "mandatory" &&
      c.type !== "mandatoryResponse" &&
      c.type !== "response" &&
      c.type !== "combat",
  );
  if (!card) throw new Error(`no ${cp} CP action card`);
  return card.id;
};

const oneCpCards = (count: number): CardId[] =>
  ALL_CARDS.filter(
    (c) =>
      c.kind === "action" &&
      c.cp === 1 &&
      c.type !== "mandatory" &&
      c.type !== "mandatoryResponse" &&
      c.type !== "response" &&
      c.type !== "combat",
  )
    .slice(0, count)
    .map((c) => c.id);

// ---------------------------------------------------------------------------
// Decades and entering cards
// ---------------------------------------------------------------------------

test("deck.ts and economy.ts share one canonical turn -> decade mapping", () => {
  const turns = [0, 1, 2, 3, 4, 5, 6, 7, 8, Number.NaN];
  for (const turn of turns) {
    expect(deckDecadeForTurn(turn)).toBe(decadeForTurn(turn));
  }
  expect([1, 2, 3, 4, 5, 6, 7].map(decadeForTurn)).toEqual([
    "1850s",
    "1860s",
    "1870s",
    "1880s",
    "1890s",
    "1900s",
    "1910s",
  ]);
});

test("prepBegin advances G.decade with the campaign turn", () => {
  const G = fresh();
  const ctx = makeCtx();
  const expected: Record<number, string> = {
    1: "1850s",
    2: "1860s",
    3: "1870s",
    4: "1880s",
    5: "1890s",
    6: "1900s",
    7: "1910s",
  };
  for (const turn of [1, 2, 3, 4, 5, 6, 7]) {
    G.turn = turn;
    onBegin("prep")(G, ctx);
    expect(G.decade).toBe(expected[turn]);
  }
});

test("prepBegin deals each new decade exactly once", () => {
  const G = fresh();
  const ctx = makeCtx();
  G.turn = 3;
  onBegin("prep")(G, ctx);
  expect(G.decade).toBe("1870s");
  const played = allCardsInPlay(G);
  for (const id of cardsForDecade("1870s")) {
    expect(played.filter((card) => card === id)).toHaveLength(1);
  }
});

test.each(["hand", "home", "cpChain", "industry"])(
  "prepBegin does not duplicate an entering 1870s card already in the %s zone",
  (zone) => {
    const G = fresh();
    const ctx = makeCtx();
    const id = cardsForDecade("1870s")[0];
    takeCard(G, id);

    if (zone === "hand") {
      G.powers.GE.hand.push(id);
    } else if (zone === "home") {
      G.powers.GE.homeCards.push(id);
    } else if (zone === "cpChain") {
      G.powers.GE.cpChain.push(id);
    } else {
      G.powers.GE.industryCard = id;
    }

    G.turn = 3;
    onBegin("prep")(G, ctx);

    const played = allCardsInPlay(G);
    expect(played.filter((card) => card === id)).toHaveLength(1);
    for (const entering of cardsForDecade("1870s")) {
      expect(played.filter((card) => card === entering)).toHaveLength(1);
    }
  },
);

test("resolveEnd advances G.decade after the turn increment", () => {
  const G = fresh();
  G.turn = 2;
  resolveEnd(G, makeCtx());
  expect(G.turn).toBe(3);
  expect(G.decade).toBe("1870s");

  G.turn = 7;
  resolveEnd(G, makeCtx());
  expect(G.turn).toBe(8);
  expect(G.decade).toBe("1910s");
});

// ---------------------------------------------------------------------------
// Reserves (7.3 / national characteristics)
// ---------------------------------------------------------------------------

test("end-phase reserve growth is capped by reserveAllowance and the UK gets none", () => {
  const G = fresh();
  G.powers.GE.manpower = 3;
  G.powers.GE.industry = 2;
  G.powers.GE.reserves = [];
  G.powers.UK.manpower = 6;
  G.powers.UK.industry = 6;
  G.powers.UK.reserves = [];

  resolveEnd(G, makeCtx());

  expect(reserveAllowance(G, "UK")).toBe(0);
  expect(G.powers.UK.reserves).toHaveLength(0);
  expect(G.powers.GE.reserves).toHaveLength(1);

  // Fill Germany to its cap; another end phase must not add a third army.
  G.powers.GE.manpower = 3;
  G.powers.GE.industry = 2;
  G.powers.GE.reserves = ["reserve-a", "reserve-b"];
  resolveEnd(G, makeCtx());
  expect(G.powers.GE.reserves).toHaveLength(2);
  expect(reserveRemaining(G, "GE")).toBe(0);

  for (const power of POWERS) {
    expect(G.powers[power].reserves.length).toBeLessThanOrEqual(reserveAllowance(G, power));
  }
});

// ---------------------------------------------------------------------------
// Industrialization (12.13 / 20.6)
// ---------------------------------------------------------------------------

test("resolveEnd uses the RU/OT target 6 and the auto-industrialization chit", () => {
  const G = fresh();
  const [geCard, ruCard, otCard, ruAuto, otAuto] = oneCpCards(5);

  G.powers.GE.industry = 1;
  G.powers.RU.industry = 1;
  G.powers.OT.industry = 1;
  G.powers.GE.industryCard = geCard;
  G.powers.RU.industryCard = ruCard;
  G.powers.OT.industryCard = otCard;

  // The same die of 4 succeeds against the ordinary target 5 and fails the
  // RU/OT target 6 (1 CP card + 4 = 5).
  resolveEnd(G, makeCtx("0", 4));
  expect(industryTarget(G, "GE")).toBe(5);
  expect(industryTarget(G, "RU")).toBe(6);
  expect(industryTarget(G, "OT")).toBe(6);
  expect(G.powers.GE.industry).toBe(2);
  expect(G.powers.RU.industry).toBe(1);
  expect(G.powers.OT.industry).toBe(1);
  expect(G.powers.RU.autoIndustry).toBe(true);
  expect(G.powers.OT.autoIndustry).toBe(true);

  // Without a card the auto chit does not fire on its own.
  resolveEnd(G, makeCtx("0", 1));
  expect(G.powers.RU.industry).toBe(1);
  expect(G.powers.OT.industry).toBe(1);
  expect(G.powers.RU.autoIndustry).toBe(true);
  expect(G.powers.OT.autoIndustry).toBe(true);

  // With the auto chit and any card, a low die still industrializes.
  G.powers.RU.industryCard = ruAuto;
  G.powers.OT.industryCard = otAuto;
  resolveEnd(G, makeCtx("0", 1));
  expect(G.powers.RU.industry).toBe(2);
  expect(G.powers.OT.industry).toBe(2);
  expect(G.powers.RU.autoIndustry).toBe(false);
  expect(G.powers.OT.autoIndustry).toBe(false);
  expect(G.discard).toEqual(expect.arrayContaining([ruAuto, otAuto]));
});

// ---------------------------------------------------------------------------
// CP Chain (12.14)
// ---------------------------------------------------------------------------

test("two chained cards fund one action of at most 4 CP and are discarded at action end", () => {
  const G = fresh();
  const ctx = makeCtx("0");
  beginAction(G);

  const four = actionCard(4);
  const two = actionCard(2);
  giveToHand(G, "GE", four);
  giveToHand(G, "GE", two);

  expect(cpChain(G, ctx, four)).toBeUndefined();
  G.activePower = "GE";
  expect(cpChain(G, ctx, two)).toBeUndefined();
  G.activePower = "GE";

  expect(G.powers.GE.cpChain).toEqual([four, two]);
  // 6 CP are banked, but a single action may draw at most 4.
  expect(useCpChain(G, ctx)).toBeUndefined();
  expect(G.cpRemaining).toBe(4);
  expect(G.flags.cpChainActive).toBe(true);
  expect(G.flags.cpChainSpent).toBe(true);
  // The physical cards stay faceup until the action phase ends.
  expect(G.powers.GE.cpChain).toEqual([four, two]);

  // One chain-funded action per action phase.
  expect(useCpChain(G, ctx)).toBe(INVALID_MOVE);

  G.passed = [...POWERS];
  G.activePower = "GE";
  endImpulse(G, ctx);

  expect(G.powers.GE.cpChain).toEqual([]);
  expect(G.discard).toEqual(expect.arrayContaining([four, two]));
  expect(G.flags.cpChainActive).toBeUndefined();
  expect(G.flags.cpChainSpent).toBeUndefined();

  // No chained card or CP survives into the next action phase.
  beginAction(G);
  expect(G.cpRemaining).toBe(0);
  expect(G.powers.GE.cpChain).toEqual([]);
});

test("a mandatory event played into the CP chain still resolves", () => {
  const G = fresh();
  const ctx = makeCtx("0");
  beginAction(G);

  // The Funeral of Edward VII: mandatory, 2 CP, "decrease the WTT by 1".
  const funeral = "IE-A104";
  giveToHand(G, "GE", funeral);
  G.wtt = 2;

  expect(cpChain(G, ctx, funeral)).toBeUndefined();
  expect(G.wtt).toBe(1);
  expect(G.powers.GE.cpChain).toContain(funeral);
  // It is chained, not discarded as a normally played mandatory card.
  expect(G.discard).not.toContain(funeral);

  G.activePower = "GE";
  expect(useCpChain(G, ctx)).toBeUndefined();
  expect(G.cpRemaining).toBe(2);

  G.passed = [...POWERS];
  endImpulse(G, ctx);
  expect(G.powers.GE.cpChain).toEqual([]);
  expect(G.discard).toContain(funeral);
});

test("chained cards and their CP cannot be used to industrialize", () => {
  const G = fresh();
  const ctx = makeCtx("0");
  beginAction(G);

  const card = actionCard(2);
  giveToHand(G, "GE", card);
  expect(cpChain(G, ctx, card)).toBeUndefined();
  G.activePower = "GE";

  expect(cpChainResolution(G, "GE").canIndustrialize).toBe(false);
  const industryBefore = G.powers.GE.industry;
  expect(industrialize(G, ctx, card)).toBe(INVALID_MOVE);
  expect(G.powers.GE.industryCard).toBeNull();

  expect(useCpChain(G, ctx)).toBeUndefined();
  expect(G.cpRemaining).toBe(2);
  expect(G.powers.GE.industryCard).toBeNull();
  expect(G.powers.GE.industry).toBe(industryBefore);
});

// ---------------------------------------------------------------------------
// Surrender guard (15.5 / 16.0)
// ---------------------------------------------------------------------------

test("surrender rejects allies, outsiders, pending decisions, and a second surrender", () => {
  const G = fresh();
  G.phase = "wartime";
  G.activePower = "GE";
  G.war = createWarState(G, "GE", "FR", "conquest", ["alsace-lorraine"], 2);
  G.war.defenderAllies = ["UK"];

  // An ally is not a primary belligerent; an uninvolved power is not either.
  expect(surrender(G, makeCtx("1"))).toBe(INVALID_MOVE); // UK ally
  expect(surrender(G, makeCtx("3"))).toBe(INVALID_MOVE); // AU outsider
  expect(G.war.victor).toBeNull();
  expect(G.war.status).toBe("warAim");

  // An open decision blocks surrender.
  G.pending = {id: "d-test", kind: "confirm", power: "GE", prompt: "test", options: [], createdAt: 1};
  expect(surrender(G, makeCtx("0"))).toBe(INVALID_MOVE);
  G.pending = null;

  // The attacker's surrender resolves exactly once.
  expect(surrender(G, makeCtx("0"))).toBeUndefined();
  expect(G.war.status).toBe("victory");
  expect(G.war.victor).toBe("defender");

  // Neither the attacker nor the defender can rewrite the result.
  expect(surrender(G, makeCtx("0"))).toBe(INVALID_MOVE);
  expect(surrender(G, makeCtx("2"))).toBe(INVALID_MOVE);
  expect(G.war.victor).toBe("defender");
});
