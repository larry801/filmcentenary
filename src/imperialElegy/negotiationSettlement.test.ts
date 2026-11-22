/**
 * Rule 11.1 — settlement at the end of the diplomacy phase.
 *
 *   "Players can give other players a number of cards in the diplomacy phase.
 *    This must be a formal agreement between both players and it is done at the
 *    end of the diplomacy phase.  Players cannot give other players specific
 *    cards, all card draws must be random and home cards can never be drawn from
 *    a player's hand.  Once all negotiations have been concluded players
 *    announce the card draws they will be giving and/or receiving in turn order.
 *    An announced card draw must be confirmed by the other player in order for
 *    it to take place.  The random card draw is done in full view of all
 *    players."
 *
 * The suite drives the real diplomacy close (`chooseHomeCard` for every seat,
 * which is what actually enters the action phase) so the draw happens exactly
 * where the printed rule puts it.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {cardById} from "./engine/deck";
import {dealsOf, negotiationOf, settleDeals} from "./engine/negotiation";
import {chooseHomeCard, counterDeal, proposeDeal, respondDeal, resolvePending} from "./moves";

const seat = (power: Power): string => String(POWERS.indexOf(power));

/** `Die(sides)` is 1-based; faces repeat their last value once the list runs out. */
const makeCtx = (faces: number[] = [], power: Power = "GE"): Ctx => {
  let index = 0;
  return {
    playerID: seat(power),
    random: {
      Die: (sides: number) => Math.min(sides, faces[Math.min(index++, faces.length - 1)] ?? 1),
    },
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 2,
    phase: "diplomacy",
  } as unknown as Ctx;
};

/** Three plain action cards, dealt directly, so the die face is unambiguous. */
const HAND = ["IE-A018", "IE-A019", "IE-A020"];

/**
 * The dealable hand.  Choosing a home card adds it to the hand (11.2: "A
 * player's home card is always taken in addition to the cards they received in
 * the Prep phase"), and home cards never take part in a draw.
 */
const dealable = (G: ImperialElegyState, power: Power): string[] =>
  G.powers[power].hand.filter((id) => cardById(id).kind !== "home");

const diplomacy = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "diplomacy";
  G.activePower = "GE";
  for (const power of POWERS) G.powers[power].hand = [...HAND];
  return G;
};

/** Close diplomacy the way the board does: every seat picks a home card. */
const closeDiplomacy = (G: ImperialElegyState, faces: number[] = []): void => {
  G.phase = "diplomacy";
  for (const power of POWERS) {
    G.activePower = power;
    G.powers[power].flags.homeChosen = true;
    expect(chooseHomeCard(G, makeCtx(faces, power), G.powers[power].homeCards[0])).toBeUndefined();
  }
};

describe("11.1 the draw is random", () => {
  test("the die, not the caller, selects the cards", () => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 1, 0)).toBeUndefined();
    expect(respondDeal(G, makeCtx([], "FR"), dealsOf(G).offers[0].id, true)).toBeUndefined();

    // Face 2 selects hand index 1 for the draw.
    closeDiplomacy(G, [2]);

    expect(dealable(G, "GE")).not.toContain(HAND[1]);
    expect(dealable(G, "FR")).toContain(HAND[1]);
    const settled = dealsOf(G).history[0];
    expect(settled.given).toEqual([HAND[1]]);
    expect(settled.taken).toEqual([]);
    // 11.1: the random card draw is public.
    expect(G.log.find((entry) => entry.key === "dealCardDrawn")).toMatchObject({
      power: "GE",
      args: {card: HAND[1], from: "GE", to: "FR"},
    });
  });

  test("home cards are never drawn", () => {
    const G = diplomacy();
    // Leave only home cards plus one action card: a naive draw would pick a
    // home card at index 0.
    const home = G.powers.GE.homeCards[0];
    G.powers.GE.hand = [home, HAND[2]];
    expect(proposeDeal(G, makeCtx(), "FR", 1, 0)).toBeUndefined();
    expect(respondDeal(G, makeCtx([], "FR"), dealsOf(G).offers[0].id, true)).toBeUndefined();

    // Face 1 selects the first *dealable* card, not the home card.
    closeDiplomacy(G, [1]);

    expect(dealable(G, "FR")).toContain(HAND[2]);
    expect(G.powers.FR.hand).not.toContain(home);
    expect(G.powers.GE.hand).toContain(home);
    expect(cardById(home).kind).toBe("home");
  });

  test("a two-way deal draws both directions", () => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 1, 2)).toBeUndefined();
    expect(respondDeal(G, makeCtx([], "FR"), dealsOf(G).offers[0].id, true)).toBeUndefined();

    // Face 3 → index 2 each time, then the list shrinks.
    closeDiplomacy(G, [3]);

    const settled = dealsOf(G).history[0];
    expect(settled.given).toEqual([HAND[2]]);
    expect(settled.taken).toHaveLength(2);
    for (const card of settled.taken) expect(dealable(G, "GE")).toContain(card);
    expect(dealable(G, "GE")).toHaveLength(HAND.length - 1 + 2);
  });
});

describe("11.1 the settlement point", () => {
  test("nothing moves when the deal is merely accepted", () => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 2, 1)).toBeUndefined();
    expect(respondDeal(G, makeCtx([], "FR"), dealsOf(G).offers[0].id, true)).toBeUndefined();
    expect(G.powers.GE.hand).toEqual(HAND);
    expect(G.powers.FR.hand).toEqual(HAND);
    expect(dealsOf(G).history).toEqual([]);
  });

  test("a refusal never reaches the settlement", () => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 1, 0)).toBeUndefined();
    expect(respondDeal(G, makeCtx([], "FR"), dealsOf(G).offers[0].id, false)).toBeUndefined();
    closeDiplomacy(G);
    expect(dealsOf(G).history).toEqual([]);
    expect(dealable(G, "FR")).toEqual(HAND);
  });

  test("an unanswered offer lapses instead of settling", () => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 1, 0)).toBeUndefined();
    closeDiplomacy(G);
    expect(dealsOf(G).offers).toEqual([]);
    expect(dealsOf(G).history).toEqual([]);
    expect(dealable(G, "FR")).toEqual(HAND);
    expect(G.log.find((entry) => entry.key === "dealsExpired")?.args).toMatchObject({count: 1});
  });

  test("a countered offer never settles either", () => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 1, 0)).toBeUndefined();
    expect(counterDeal(G, makeCtx([], "FR"), dealsOf(G).offers[0].id, 1, 1)).toBeUndefined();
    closeDiplomacy(G);
    expect(dealsOf(G).history).toEqual([]);
    expect(dealable(G, "GE")).toEqual(HAND);
    expect(dealable(G, "FR")).toEqual(HAND);
  });

  test("an accepted counter settles in the countering side's direction", () => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 2, 0)).toBeUndefined();
    expect(counterDeal(G, makeCtx([], "FR"), dealsOf(G).offers[0].id, 1, 2)).toBeUndefined();
    expect(respondDeal(G, makeCtx([], "GE"), dealsOf(G).offers[0].id, true)).toBeUndefined();
    closeDiplomacy(G, [2]);
    const settled = dealsOf(G).history[0];
    // FR was the countering party, so it gives one and receives two.
    expect(settled.from).toBe("FR");
    expect(settled.to).toBe("GE");
    expect(settled.given).toHaveLength(1);
    expect(settled.taken).toHaveLength(2);
  });

  test("settlement is idempotent per turn", () => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 1, 0)).toBeUndefined();
    expect(respondDeal(G, makeCtx([], "FR"), dealsOf(G).offers[0].id, true)).toBeUndefined();
    closeDiplomacy(G, [2]);
    const handAfter = [...G.powers.FR.hand];
    // Re-entering the action phase (a resumed save, a second close) must never
    // draw the same cards twice.
    expect(settleDeals(G, makeCtx([2]))).toEqual([]);
    expect(G.powers.FR.hand).toEqual(handAfter);
    expect(dealsOf(G).history).toHaveLength(1);
    expect(dealsOf(G).settledTurn).toBe(G.turn);
  });
});

describe("11.1 announcements", () => {
  test("deals settle in printed seat order", () => {
    const G = diplomacy();
    // UK opens first (seat 1) and GE second (seat 0); 11.1 announces in turn
    // order, so Germany's deal settles before the UK's.
    expect(proposeDeal(G, makeCtx([], "UK"), "OT", 1, 0)).toBeUndefined();
    expect(proposeDeal(G, makeCtx([], "GE"), "RU", 1, 0)).toBeUndefined();
    expect(respondDeal(G, makeCtx([], "OT"), dealsOf(G).offers[0].id, true)).toBeUndefined();
    expect(respondDeal(G, makeCtx([], "RU"), dealsOf(G).offers[1].id, true)).toBeUndefined();
    closeDiplomacy(G, [1]);
    expect(dealsOf(G).history.map((record) => record.from)).toEqual(["GE", "UK"]);
  });

  test("the settled record is public, the open offers are not", () => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 1, 0)).toBeUndefined();
    expect(respondDeal(G, makeCtx([], "FR"), dealsOf(G).offers[0].id, true)).toBeUndefined();
    closeDiplomacy(G, [2]);
    const record = dealsOf(G).history[0];
    expect(record).toMatchObject({from: "GE", to: "FR", turn: G.turn, shortfall: false});
    expect(record.given).toEqual([HAND[1]]);
  });

  test("a short hand moves what it has and reports the shortfall", () => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 3, 0)).toBeUndefined();
    expect(respondDeal(G, makeCtx([], "FR"), dealsOf(G).offers[0].id, true)).toBeUndefined();
    // A third-party event took a card before the phase closed.
    G.powers.GE.hand = [HAND[0]];
    closeDiplomacy(G, [1]);
    const settled = dealsOf(G).history[0];
    expect(settled.shortfall).toBe(true);
    expect(settled.given).toEqual([HAND[0]]);
    expect(dealable(G, "GE")).toEqual([]);
    expect(dealable(G, "FR")).toContain(HAND[0]);
    expect(G.log.find((entry) => entry.key === "dealShortfall")).toMatchObject({args: {id: settled.id, to: "FR"}});
  });
});

describe("the action phase is still entered", () => {
  test("closing diplomacy with deals still reaches the action phase", () => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 1, 0)).toBeUndefined();
    expect(respondDeal(G, makeCtx([], "FR"), dealsOf(G).offers[0].id, true)).toBeUndefined();
    closeDiplomacy(G, [2]);
    // 33.4 Metternich's Legacy resolves at the end of diplomacy, before the
    // action phase opens; answer AU's choice and then the phase advances.
    while (G.pending?.kind === "metternich") {
      expect(resolvePending(G, makeCtx([2], "AU"), G.pending.options[0].id)).toBeUndefined();
    }
    expect(G.phase).toBe("action");
    expect(G.activePower).toBe("GE");
    expect(negotiationOf(G).offers).toEqual([]);
  });

  test("a stale offer cannot be accepted after the phase", () => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 1, 0)).toBeUndefined();
    const id = dealsOf(G).offers[0].id;
    G.phase = "action";
    expect(respondDeal(G, makeCtx([], "FR"), id, true)).toBe(INVALID_MOVE);
  });
});
