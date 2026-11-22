/**
 * Rules 11.0 / 11.1 — the diplomacy negotiation table's rules engine.
 *
 * 11.1 is the only binding diplomacy clause and it is narrow: a **formal
 * agreement between both players** to exchange a **number** of randomly drawn
 * action cards, done at the **end of the diplomacy phase**, announced "in full
 * view of all players", and never naming a card ("Players cannot give other
 * players specific cards, all card draws must be random and home cards can never
 * be drawn from a player's hand").
 *
 * `negotiationSettlement.test.ts` covers the settlement itself; this suite pins
 * the table: what may be offered, who may answer, refusals, withdrawals and the
 * 11.1 counter-offer, plus 11.0's shown cards.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {dealProblem, dealsOf, negotiationOf, shownCardsFor} from "./engine/negotiation";
import {
  chooseHomeCard,
  finishNegotiation,
  hideCard,
  proposeDeal,
  respondDeal,
  counterDeal,
  showCard,
  withdrawDeal,
} from "./moves";

const seat = (power: Power): string => String(POWERS.indexOf(power));

/** `Die(sides)` is 1-based: face `n` selects index `n - 1`. */
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

const FIXED_HAND = ["IE-A018", "IE-A019", "IE-A020"];

/** A diplomacy-phase state with a known hand for GE and FR. */
const diplomacy = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "diplomacy";
  G.activePower = "GE";
  G.powers.GE.hand = [...FIXED_HAND];
  G.powers.FR.hand = [...FIXED_HAND];
  return G;
};

describe("11.1 what may be offered", () => {
  test("a deal must move at least one card", () => {
    const G = diplomacy();
    expect(dealProblem(G, "GE", "FR", 0, 0)).toBe("nothing-moved");
    expect(dealProblem(G, "GE", "FR", 1, 0)).toBeNull();
    expect(dealProblem(G, "GE", "FR", 0, 1)).toBeNull();
    expect(dealProblem(G, "GE", "FR", 2, 1)).toBeNull();
  });

  test("a power cannot deal with itself", () => {
    const G = diplomacy();
    expect(dealProblem(G, "GE", "GE", 1, 0)).toBe("same-power");
    expect(proposeDeal(G, makeCtx(), "GE", 1, 0)).toBe(INVALID_MOVE);
    expect(dealsOf(G).offers).toEqual([]);
  });

  test("deals exist only in the diplomacy phase", () => {
    const G = diplomacy();
    G.phase = "action";
    expect(dealProblem(G, "GE", "FR", 1, 0)).toBe("not-diplomacy");
    expect(proposeDeal(G, makeCtx(), "FR", 1, 0)).toBe(INVALID_MOVE);
  });

  test("an eliminated power cannot be offered a deal", () => {
    const G = diplomacy();
    G.powers.FR.eliminated = true;
    expect(dealProblem(G, "GE", "FR", 1, 0)).toBe("eliminated");
  });

  test("neither side can promise more cards than it holds", () => {
    const G = diplomacy();
    expect(dealProblem(G, "GE", "FR", FIXED_HAND.length + 1, 0)).toBe("too-many-cards");
    expect(dealProblem(G, "GE", "FR", 0, FIXED_HAND.length + 1)).toBe("too-many-cards");
    // Home cards never count: they can never be drawn (11.1).
    G.powers.FR.hand = [G.powers.FR.homeCards[0]];
    expect(dealProblem(G, "GE", "FR", 1, 1)).toBe("too-many-cards");
    expect(dealProblem(G, "GE", "FR", 1, 0)).toBeNull();
  });

  test("a proposal records counts only, and nothing moves yet", () => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 2, 1)).toBeUndefined();
    const offers = dealsOf(G).offers;
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({from: "GE", to: "FR", give: 2, take: 1, status: "proposed"});
    // 11.1: "it is done at the end of the diplomacy phase".
    expect(G.powers.GE.hand).toEqual(FIXED_HAND);
    expect(G.powers.FR.hand).toEqual(FIXED_HAND);
  });

  test("promises are text, bounded in count and length, and never enforced", () => {
    const G = diplomacy();
    const long = "x".repeat(400);
    expect(proposeDeal(G, makeCtx(), "FR", 1, 0, [
      {from: "GE", text: "free passage"},
      {from: "GE", text: ""},
      {from: "GE", text: long},
      {from: "GE", text: "fourth is dropped"},
    ])).toBeUndefined();
    const offer = dealsOf(G).offers[0];
    expect(offer.promises).toHaveLength(2);
    expect(offer.promises[0]).toEqual({from: "GE", text: "free passage"});
    expect(offer.promises[1].text.length).toBeLessThanOrEqual(120);
    expect(offer.promises.some((promise) => promise.text === "fourth is dropped")).toBe(false);
  });
});

describe("11.1 confirmation", () => {
  const offered = (): ImperialElegyState => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 2, 0)).toBeUndefined();
    return G;
  };

  test("only the receiving power may answer", () => {
    const G = offered();
    const id = dealsOf(G).offers[0].id;
    expect(respondDeal(G, makeCtx([], "GE"), id, true)).toBe(INVALID_MOVE);
    expect(respondDeal(G, makeCtx([], "RU"), id, true)).toBe(INVALID_MOVE);
    // Still open: a refusal from the wrong seat writes nothing.
    expect(dealsOf(G).offers[0].status).toBe("proposed");
  });

  test("accepting marks the deal but does not draw", () => {
    const G = offered();
    const id = dealsOf(G).offers[0].id;
    expect(respondDeal(G, makeCtx([], "FR"), id, true)).toBeUndefined();
    expect(dealsOf(G).offers[0].status).toBe("accepted");
    expect(G.powers.GE.hand).toEqual(FIXED_HAND);
    expect(G.powers.FR.hand).toEqual(FIXED_HAND);
  });

  test("an already answered offer cannot be answered twice", () => {
    const G = offered();
    const id = dealsOf(G).offers[0].id;
    expect(respondDeal(G, makeCtx([], "FR"), id, true)).toBeUndefined();
    expect(respondDeal(G, makeCtx([], "FR"), id, false)).toBe(INVALID_MOVE);
    expect(dealsOf(G).offers[0].status).toBe("accepted");
  });

  test("refusing removes the offer and moves nothing", () => {
    const G = offered();
    const id = dealsOf(G).offers[0].id;
    expect(respondDeal(G, makeCtx([], "FR"), id, false)).toBeUndefined();
    expect(dealsOf(G).offers).toEqual([]);
    expect(G.powers.GE.hand).toEqual(FIXED_HAND);
    expect(G.log.find((entry) => entry.key === "dealRefused")).toBeDefined();
  });

  test("a hand that shrank since the offer cannot still confirm it", () => {
    const G = offered();
    const id = dealsOf(G).offers[0].id;
    // GE gave a card away at another table, so it can no longer pay two.
    G.powers.GE.hand = ["IE-A018"];
    expect(respondDeal(G, makeCtx([], "FR"), id, true)).toBe(INVALID_MOVE);
    expect(dealsOf(G).offers[0].status).toBe("proposed");
  });

  test("the proposing side may withdraw an unconfirmed offer", () => {
    const G = offered();
    const id = dealsOf(G).offers[0].id;
    expect(withdrawDeal(G, makeCtx([], "FR"), id)).toBe(INVALID_MOVE);
    expect(withdrawDeal(G, makeCtx([], "GE"), id)).toBeUndefined();
    expect(dealsOf(G).offers).toEqual([]);
    expect(G.log.find((entry) => entry.key === "dealWithdrawn")).toBeDefined();
  });
});

describe("11.1 counter-offer", () => {
  const offered = (): ImperialElegyState => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 2, 1)).toBeUndefined();
    return G;
  };

  test("only the receiving power may counter", () => {
    const G = offered();
    const id = dealsOf(G).offers[0].id;
    expect(counterDeal(G, makeCtx([], "GE"), id, 1, 0)).toBe(INVALID_MOVE);
    expect(counterDeal(G, makeCtx([], "RU"), id, 1, 0)).toBe(INVALID_MOVE);
    expect(dealsOf(G).offers[0].status).toBe("proposed");
  });

  test("a counter turns the table around and retires the old offer", () => {
    const G = offered();
    const id = dealsOf(G).offers[0].id;
    // FR now offers 1 card and asks for 2: the counts are the countering
    // side's own, so the form needs no direction switch.
    expect(counterDeal(G, makeCtx([], "FR"), id, 1, 2)).toBeUndefined();
    const offers = dealsOf(G).offers;
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({from: "FR", to: "GE", give: 1, take: 2, status: "proposed"});
    expect(offers[0].counterOf).toBe(id);
    expect(G.log.find((entry) => entry.key === "dealCountered")?.args).toMatchObject({previous: id, from: "GE"});
  });

  test("countering twice restores the original direction", () => {
    const G = offered();
    const first = dealsOf(G).offers[0].id;
    expect(counterDeal(G, makeCtx([], "FR"), first, 1, 2)).toBeUndefined();
    const second = dealsOf(G).offers[0].id;
    expect(counterDeal(G, makeCtx([], "GE"), second, 3, 0)).toBeUndefined();
    const offer = dealsOf(G).offers[0];
    expect(offer).toMatchObject({from: "GE", to: "FR", give: 3, take: 0});
    expect(offer.counterOf).toBe(second);
  });

  test("a countered offer cannot be countered again by id", () => {
    const G = offered();
    const id = dealsOf(G).offers[0].id;
    expect(counterDeal(G, makeCtx([], "FR"), id, 1, 1)).toBeUndefined();
    expect(counterDeal(G, makeCtx([], "FR"), id, 1, 1)).toBe(INVALID_MOVE);
  });

  test("a counter re-validates the counts against the current hands", () => {
    const G = offered();
    const id = dealsOf(G).offers[0].id;
    G.powers.FR.hand = ["IE-A018"];
    expect(counterDeal(G, makeCtx([], "FR"), id, 3, 0)).toBe(INVALID_MOVE);
    expect(counterDeal(G, makeCtx([], "FR"), id, 1, 0)).toBeUndefined();
  });

  test("the counter may be accepted by the original proposer", () => {
    const G = offered();
    const id = dealsOf(G).offers[0].id;
    expect(counterDeal(G, makeCtx([], "FR"), id, 1, 2)).toBeUndefined();
    const counter = dealsOf(G).offers[0].id;
    expect(respondDeal(G, makeCtx([], "FR"), counter, true)).toBe(INVALID_MOVE);
    expect(respondDeal(G, makeCtx([], "GE"), counter, true)).toBeUndefined();
    expect(dealsOf(G).offers[0].status).toBe("accepted");
  });
});

describe("11.0 showing action cards", () => {
  test("a card may be shown to the table", () => {
    const G = diplomacy();
    expect(showCard(G, makeCtx(), "IE-A019", null)).toBeUndefined();
    expect(dealsOf(G).shown).toEqual([{card: "IE-A019", from: "GE", to: null, turn: G.turn}]);
    // Every seat and every spectator sees a public show.
    for (const power of POWERS) expect(shownCardsFor(G, power)).toContain("IE-A019");
    expect(shownCardsFor(G, null)).toContain("IE-A019");
    expect(G.log.find((entry) => entry.key === "cardShownPublic")?.args).toMatchObject({card: "IE-A019"});
  });

  test("a private show is visible to the two powers only", () => {
    const G = diplomacy();
    expect(showCard(G, makeCtx(), "IE-A019", "FR")).toBeUndefined();
    expect(shownCardsFor(G, "GE")).toContain("IE-A019");
    expect(shownCardsFor(G, "FR")).toContain("IE-A019");
    expect(shownCardsFor(G, "RU")).not.toContain("IE-A019");
    expect(shownCardsFor(G, null)).not.toContain("IE-A019");
    // The public log must not name a privately shown card.
    expect(G.log.find((entry) => entry.key === "cardShownPrivate")?.args).toMatchObject({to: "FR"});
    expect(JSON.stringify(G.log.find((entry) => entry.key === "cardShownPrivate")?.args)).not.toContain("IE-A019");
  });

  test("only a card in hand may be shown, and not to yourself", () => {
    const G = diplomacy();
    expect(showCard(G, makeCtx(), "IE-A020", "GE")).toBe(INVALID_MOVE);
    expect(showCard(G, makeCtx(), "IE-A999", null)).toBe(INVALID_MOVE);
    expect(dealsOf(G).shown).toEqual([]);
  });

  test("showing the same card twice to the same target is refused", () => {
    const G = diplomacy();
    expect(showCard(G, makeCtx(), "IE-A019", null)).toBeUndefined();
    expect(showCard(G, makeCtx(), "IE-A019", null)).toBe(INVALID_MOVE);
  });

  test("the owner may take a shown card back", () => {
    const G = diplomacy();
    expect(showCard(G, makeCtx(), "IE-A019", null)).toBeUndefined();
    expect(hideCard(G, makeCtx([], "FR"), "IE-A019")).toBe(INVALID_MOVE);
    expect(hideCard(G, makeCtx(), "IE-A019")).toBeUndefined();
    expect(dealsOf(G).shown).toEqual([]);
  });

  test("showing is diplomacy-only", () => {
    const G = diplomacy();
    G.phase = "action";
    expect(showCard(G, makeCtx(), "IE-A019", null)).toBe(INVALID_MOVE);
  });
});

describe("9.1 finishing negotiation before the home card", () => {
  /** The phase opens in the negotiation segment, as `diplomacyBegin` writes it. */
  const negotiating = (): ImperialElegyState => {
    const G = diplomacy();
    for (const power of POWERS) G.powers[power].flags.negotiationDone = false;
    return G;
  };

  test("a home card is refused while any seat is still negotiating", () => {
    const G = negotiating();
    expect(chooseHomeCard(G, makeCtx(), G.powers.GE.homeCards[0])).toBe(INVALID_MOVE);
    expect(G.powers.GE.selectedHomeCard).toBeNull();
  });

  test("finishing marks only the acting seat and is not repeatable", () => {
    const G = negotiating();
    expect(finishNegotiation(G, makeCtx([], "FR"))).toBeUndefined();
    expect(G.powers.FR.flags.negotiationDone).toBe(true);
    expect(G.powers.GE.flags.negotiationDone).toBe(false);
    expect(G.log.find((entry) => entry.key === "negotiationFinished")?.power).toBe("FR");
    expect(finishNegotiation(G, makeCtx([], "FR"))).toBe(INVALID_MOVE);
  });

  test("one finished seat does not unlock the home card for the table", () => {
    const G = negotiating();
    expect(finishNegotiation(G, makeCtx([], "GE"))).toBeUndefined();
    expect(chooseHomeCard(G, makeCtx(), G.powers.GE.homeCards[0])).toBe(INVALID_MOVE);
  });

  test("once every seat is done the home card is accepted", () => {
    const G = negotiating();
    for (const power of POWERS) expect(finishNegotiation(G, makeCtx([], power))).toBeUndefined();
    const card = G.powers.GE.homeCards[0];
    expect(chooseHomeCard(G, makeCtx(), card)).toBeUndefined();
    expect(G.powers.GE.selectedHomeCard).toBe(card);
  });

  test("a legacy state without the flag is treated as already finished", () => {
    const G = diplomacy();
    for (const power of POWERS) delete G.powers[power].flags.negotiationDone;
    expect(chooseHomeCard(G, makeCtx(), G.powers.GE.homeCards[0])).toBeUndefined();
  });

  test("an eliminated seat cannot hold the table at the negotiation step", () => {
    const G = negotiating();
    G.powers.FR.eliminated = true;
    for (const power of POWERS) {
      if (power !== "FR") expect(finishNegotiation(G, makeCtx([], power))).toBeUndefined();
    }
    expect(chooseHomeCard(G, makeCtx(), G.powers.GE.homeCards[0])).toBeUndefined();
  });
});

describe("the table is created lazily", () => {
  test("a fresh setup carries no negotiation record until it is used", () => {
    const G = diplomacy();
    expect(G.negotiation).toBeUndefined();
    expect(dealsOf(G).offers).toEqual([]);
    expect(dealsOf(G).shown).toEqual([]);
    // Reading must not write: `playerView` calls `dealsOf`.
    expect(G.negotiation).toBeUndefined();
  });

  test("proposing creates the record with the documented shape", () => {
    const G = diplomacy();
    proposeDeal(G, makeCtx(), "FR", 1, 0);
    expect(G.negotiation).toEqual({
      offers: [expect.objectContaining({from: "GE", to: "FR"})],
      history: [],
      shown: [],
      nextId: 2,
    });
    // Idempotent: a second read does not renumber anything.
    expect(negotiationOf(G).nextId).toBe(2);
  });
});
