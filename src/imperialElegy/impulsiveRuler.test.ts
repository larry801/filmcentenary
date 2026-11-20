/**
 * A105 Impulsive Ruler — the game's one mandatory response card (9.1.5).
 *
 * "It must be played as a response card when its conditions are met. Once its
 * event is resolved, the player who played it does not get any CP to spend (as
 * it would with a mandatory event) but instead draws another card."
 *
 * The card text adds the response-play WTT increase and the printed CP gate
 * ("May be played for CP if you have 3 or fewer cards in your hand (including
 * this). If played for CP the event does not trigger.").  Before this pass the
 * handler was a no-op that left the mandatory 2 CP in the wallet and drew
 * nothing, which is exactly the compensation 9.1.5 denies and grants.
 *
 * `card.type` is `mandatoryResponse`, so the hand plays it through `playCard`
 * (the mandatory-event path) rather than the `response` battle-window path;
 * A105's own printed CP gate is the only CP-mode restriction.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {cpPlayability} from "./engine/playability";
import {playCard} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "5"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));
const OTHER = "IE-A018";

/** OT's own unused impulse with only A105 in hand, and no crisis on the WTT. */
const fresh = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = "OT";
  G.pending = null;
  G.battle = null;
  G.cpRemaining = 0;
  G.wtt = 1;
  for (const power of POWERS) {
    G.powers[power].hand = [];
    G.powers[power].flags.actionCpSpentThisImpulse = false;
    delete G.powers[power].flags.savedCards;
  }
  G.powers.OT.hand = ["IE-A105"];
  return G;
};

test("a mandatory response grants no CP and draws a card instead", () => {
  const G = fresh();
  const handBefore = G.powers.OT.hand.length;
  expect(playCard(G, makeCtx([], seat("OT")), "IE-A105", "event")).toBeUndefined();
  // 9.1.5: no CP to spend, and the printed compensation is one extra card.
  expect(G.cpRemaining).toBe(0);
  expect(G.powers.OT.hand.length).toBe(handBefore);
  expect(G.powers.OT.hand).not.toContain("IE-A105");
  expect(G.discard).toContain("IE-A105");
  expect(G.log.some((entry) => entry.key === "impulsiveRuler")).toBe(true);
});

test("the mandatory response increases the WTT as printed", () => {
  const G = fresh();
  G.wtt = 2;
  expect(playCard(G, makeCtx([], seat("OT")), "IE-A105", "event")).toBeUndefined();
  expect(G.wtt).toBe(3);
});

test("the printed CP gate refuses a CP play with four cards in hand", () => {
  const G = fresh();
  G.powers.OT.hand = ["IE-A105", OTHER, OTHER, OTHER];
  expect(cpPlayability(G, "OT", "IE-A105")).toMatchObject({ok: false, reason: "impulsive-ruler-hand"});
  G.powers.OT.hand = ["IE-A105", OTHER, OTHER];
  expect(cpPlayability(G, "OT", "IE-A105")).toMatchObject({ok: true});
});

test("a CP play of the mandatory response does not resolve its event", () => {
  const G = fresh();
  G.powers.OT.hand = ["IE-A105", OTHER, OTHER];
  const wtt = G.wtt;
  expect(playCard(G, makeCtx([], seat("OT")), "IE-A105", "cp")).toBeUndefined();
  // 12.0 + the card text: "If played for CP the event does not trigger."
  expect(G.wtt).toBe(wtt);
  expect(G.cpRemaining).toBe(2);
  expect(G.log.some((entry) => entry.key === "impulsiveRuler")).toBe(false);
});
