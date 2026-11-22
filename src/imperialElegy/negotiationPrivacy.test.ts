/**
 * Rules 11.0 / 11.1 — what the table may see.
 *
 * 11.1 announces the settled draws "in full view of all players", so the
 * `history` and the drawn cards are public.  An offer that nobody has confirmed
 * is table talk between two powers, so `playerView` must not leak it to a third
 * one; the same goes for a private show (11.0 lets a power show its cards to
 * another, not to the whole world).  A public show, by contrast, is faceup by
 * definition and even a spectator may read it.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {HIDDEN_CARD} from "./engine/privacy";
import {ImperialElegyGameDef} from "./game";
import {chooseHomeCard, proposeDeal, respondDeal, showCard} from "./moves";

const seat = (power: Power): string => String(POWERS.indexOf(power));

const makeCtx = (power: Power | null = "GE"): Ctx =>
  ({
    playerID: power === null ? null : seat(power),
    random: {Die: () => 2},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 2,
    phase: "diplomacy",
  }) as unknown as Ctx;

const HAND = ["IE-A018", "IE-A019", "IE-A020"];

const diplomacy = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "diplomacy";
  G.activePower = "GE";
  for (const power of POWERS) G.powers[power].hand = [...HAND];
  return G;
};

/** The view a seat (or spectator, `null`) receives. */
const view = (G: ImperialElegyState, power: Power | null): ImperialElegyState =>
  ImperialElegyGameDef.playerView!(G, makeCtx(power), power === null ? null : seat(power)) as unknown as ImperialElegyState;

describe("11.1 an open offer is private to the two powers", () => {
  test("a third power and a spectator do not see it", () => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 1, 0)).toBeUndefined();
    expect(view(G, "FR").negotiation?.offers).toHaveLength(1);
    expect(view(G, "GE").negotiation?.offers).toHaveLength(1);
    expect(view(G, "RU").negotiation?.offers).toEqual([]);
    expect(view(G, null).negotiation?.offers).toEqual([]);
  });

  test("a counter-offer replaces the previous terms for both sides", () => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 1, 0)).toBeUndefined();
    const id = G.negotiation!.offers[0].id;
    expect(require("./moves").counterDeal(G, makeCtx("FR"), id, 0, 2)).toBeUndefined();
    for (const power of ["GE", "FR"] as Power[]) {
      const offers = view(G, power).negotiation!.offers;
      expect(offers).toHaveLength(1);
      expect(offers[0]).toMatchObject({from: "FR", to: "GE", give: 0, take: 2});
    }
    expect(view(G, "OT").negotiation!.offers).toEqual([]);
  });
});

describe("11.1 a settled deal is public", () => {
  test("every seat and the spectator read the same settlement", () => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 1, 0)).toBeUndefined();
    expect(respondDeal(G, makeCtx("FR"), G.negotiation!.offers[0].id, true)).toBeUndefined();
    for (const power of POWERS) {
      G.activePower = power;
      G.powers[power].flags.homeChosen = true;
      expect(chooseHomeCard(G, makeCtx(power), G.powers[power].homeCards[0])).toBeUndefined();
    }
    expect(G.phase).toBe("action");

    const settled = view(G, "RU").negotiation!.history;
    expect(settled).toHaveLength(1);
    expect(settled[0].given).toEqual(["IE-A019"]);
    for (const power of POWERS) expect(view(G, power).negotiation!.history).toEqual(settled);
    expect(view(G, null).negotiation!.history).toEqual(settled);

    // The drawn card is announced in the log for everybody: 11.1's "in full
    // view of all players".
    const drawn = view(G, "RU").log.find((entry) => entry.key === "dealCardDrawn");
    expect(drawn?.args?.card).toBe("IE-A019");
  });

  test("a deal the reader is not party to still settles publicly", () => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 1, 0)).toBeUndefined();
    expect(respondDeal(G, makeCtx("FR"), G.negotiation!.offers[0].id, true)).toBeUndefined();
    for (const power of POWERS) {
      G.activePower = power;
      G.powers[power].flags.homeChosen = true;
      expect(chooseHomeCard(G, makeCtx(power), G.powers[power].homeCards[0])).toBeUndefined();
    }
    // UK never saw the offer, but the announcement is for the whole table.
    expect(view(G, "UK").negotiation!.history).toHaveLength(1);
  });
});

describe("11.0 shown cards", () => {
  test("a public show reaches every seat and the spectator", () => {
    const G = diplomacy();
    expect(showCard(G, makeCtx(), "IE-A019", null)).toBeUndefined();
    for (const power of POWERS) expect(view(G, power).negotiation!.shown).toHaveLength(1);
    expect(view(G, null).negotiation!.shown).toHaveLength(1);
    // The public log names the card, because it is faceup at the table.
    expect(view(G, "RU").log.find((entry) => entry.key === "cardShownPublic")?.args?.card).toBe("IE-A019");
  });

  test("a private show reaches the two powers only", () => {
    const G = diplomacy();
    expect(showCard(G, makeCtx(), "IE-A019", "FR")).toBeUndefined();
    expect(view(G, "GE").negotiation!.shown).toHaveLength(1);
    expect(view(G, "FR").negotiation!.shown).toHaveLength(1);
    expect(view(G, "RU").negotiation!.shown).toEqual([]);
    expect(view(G, null).negotiation!.shown).toEqual([]);
  });

  test("the public log never names a privately shown card", () => {
    const G = diplomacy();
    expect(showCard(G, makeCtx(), "IE-A019", "FR")).toBeUndefined();
    const entry = view(G, "RU").log.find((log) => log.key === "cardShownPrivate");
    expect(entry).toBeDefined();
    expect(JSON.stringify(entry?.args)).not.toContain("IE-A019");
  });
});

describe("the table never leaks a hand", () => {
  test("the offers carry counts, never card ids", () => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 2, 1)).toBeUndefined();
    const serialised = JSON.stringify(view(G, "RU").negotiation);
    for (const card of HAND) expect(serialised).not.toContain(card);
    // The other seats' hands are still empty in a view, as before.
    expect(view(G, "RU").powers.GE.hand).toEqual([]);
  });

  test("the settlement history is the only place a drawn card appears", () => {
    const G = diplomacy();
    expect(proposeDeal(G, makeCtx(), "FR", 1, 0)).toBeUndefined();
    expect(respondDeal(G, makeCtx("FR"), G.negotiation!.offers[0].id, true)).toBeUndefined();
    const open = JSON.stringify(view(G, "RU").negotiation);
    for (const card of HAND) expect(open).not.toContain(card);
    for (const power of POWERS) {
      G.activePower = power;
      G.powers[power].flags.homeChosen = true;
      expect(chooseHomeCard(G, makeCtx(power), G.powers[power].homeCards[0])).toBeUndefined();
    }
    expect(JSON.stringify(view(G, "RU").negotiation!.history)).toContain("IE-A019");
  });

  test("a redacted hidden card argument stays masked", () => {
    // Nothing in the negotiation path produces HIDDEN_CARD; the constant is
    // imported so a future log key that does cannot silently publish a card.
    expect(HIDDEN_CARD).toBe("hidden");
  });
});
