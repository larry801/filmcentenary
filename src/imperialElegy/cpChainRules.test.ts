/**
 * 12.14 CP Chain — the spending side.
 *
 * "Players may spend the CP in their CP Chain when they play a card for CP on a
 * future impulse."  The errata adds that the two-card limit "does not include
 * the card played to expend CP in the chain".  The engine used to start a
 * card-less impulse from the chain alone, and then allowed its CP to fund any
 * number of actions in that impulse.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {CardId, ImperialElegyState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {ALL_CARDS} from "./engine/deck";
import {spendCpFor} from "./engine/rules";
import {cpChain, pass, useCpChain} from "./moves";

const makeCtx = (playerID: string | null = "0"): Ctx => ({
  playerID,
  random: {Die: () => 3},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "action",
} as unknown as Ctx);

const fresh = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  G.pending = null;
  G.battle = null;
  G.war = null;
  G.powers.GE.flags.homeChosen = true;
  return G;
};

const actionCard = (cp: number): CardId => {
  const card = ALL_CARDS.find(
    (c) => c.kind === "action" && c.cp === cp && !["mandatory", "mandatoryResponse", "response", "combat"].includes(c.type),
  );
  if (!card) throw new Error(`no ${cp} CP event card`);
  return card.id;
};

const give = (G: ImperialElegyState, id: CardId): void => {
  for (const power of POWERS) {
    const p = G.powers[power];
    p.hand = p.hand.filter((card) => card !== id);
    p.cpChain = p.cpChain.filter((card) => card !== id);
    p.homeCards = p.homeCards.filter((card) => card !== id);
  }
  G.deck = G.deck.filter((id2) => id2 !== id);
  G.discard = G.discard.filter((id2) => id2 !== id);
  G.powers.GE.hand.push(id);
};

const chain = (G: ImperialElegyState, id: CardId): void => {
  give(G, id);
  G.activePower = "GE";
  expect(cpChain(G, makeCtx(), id)).toBeUndefined();
};

const seedChain = (G: ImperialElegyState): {fund: CardId; chained: CardId[]} => {
  const twos = ALL_CARDS.filter(
    (c) => c.kind === "action" && c.cp === 2 && !["mandatory", "mandatoryResponse", "response", "combat"].includes(c.type),
  );
  const a = twos[0].id;
  const b = twos[1].id;
  chain(G, a);
  chain(G, b);
  const fund = actionCard(1);
  give(G, fund);
  G.activePower = "GE";
  return {fund, chained: [a, b]};
};

describe("12.14 spending the CP chain", () => {
  test("the chain needs a card played for CP from hand", () => {
    const G = fresh();
    const {fund} = seedChain(G);
    const notInHand = actionCard(3);
    expect(useCpChain(G, makeCtx(), notInHand)).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(0);
    expect(useCpChain(G, makeCtx(), fund)).toBeUndefined();
  });

  test("the funding card is discarded and its CP joins the chain, capped at 4", () => {
    const G = fresh();
    const {fund, chained} = seedChain(G);
    expect(useCpChain(G, makeCtx(), fund)).toBeUndefined();
    expect(G.powers.GE.hand).not.toContain(fund);
    expect(G.discard).toContain(fund);
    // 1 CP card + 4 chained CP = 5, but one action cannot exceed 4.
    expect(G.cpRemaining).toBe(4);
    // The two chained cards stay faceup until the action phase ends.
    expect(G.powers.GE.cpChain).toEqual(chained);
    expect(G.flags.cpChainActive).toBe(true);
    expect(G.flags.cpChainSpent).toBe(true);
  });

  test("only one CP-funded action is allowed", () => {
    const G = fresh();
    const {fund} = seedChain(G);
    expect(useCpChain(G, makeCtx(), fund)).toBeUndefined();
    expect(spendCpFor(G, "GE", 1)).toBe(true);
    expect(G.flags.cpChainActionUsed).toBe(true);
    expect(spendCpFor(G, "GE", 1)).toBe(false);
  });

  test("a mandatory or home card cannot be the chain's funding card", () => {
    const G = fresh();
    const {fund} = seedChain(G);
    const mandatory = ALL_CARDS.find((c) => c.kind === "action" && c.type === "mandatory")!;
    give(G, mandatory.id);
    expect(useCpChain(G, makeCtx(), mandatory.id)).toBe(INVALID_MOVE);
    // The funding card is still available afterwards.
    expect(G.powers.GE.hand).toContain(fund);
    expect(useCpChain(G, makeCtx(), fund)).toBeUndefined();
  });

  test("the impulse hand-over clears the single-action marker but keeps the phase's chain use", () => {
    const G = fresh();
    const {fund} = seedChain(G);
    expect(useCpChain(G, makeCtx(), fund)).toBeUndefined();
    expect(pass(G, makeCtx())).toBeUndefined();
    expect(G.flags.cpChainActive).toBeUndefined();
    expect(G.flags.cpChainActionUsed).toBeUndefined();
    expect(G.flags.cpChainSpent).toBe(true);
  });
});
