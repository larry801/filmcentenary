/**
 * Public auction reveal (round 3, agent 4).
 *
 * The printed card auctions (A71 Urabi Revolt, A102 Moroccan Crisis) keep the
 * face-down card and the CP it bids secret until every bidder has decided.  Once
 * the auction fully resolves the played cards are no longer secret, so the
 * engine logs their titles publicly (`auctionCardsRevealed`) while the bids
 * themselves stay in redacted per-power flags.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {CARD_BY_ID} from "./engine/deck";
import {CARDS} from "./constant/cards.data";
import {ImperialElegyGameDef} from "./game";
import {playCard, resolvePending} from "./moves";
import {logText} from "./components/logText";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (sides: number) => Math.min(sides, dice[Math.min(index++, dice.length - 1)] ?? 3)},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));
const ctxFor = (power: Power, dice: number[] = []): Ctx => makeCtx(dice, seat(power));
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const optionIds = (G: ImperialElegyState): string[] => (G.pending?.options ?? []).map((o) => o.id);

/** Put a card in `power`'s hand and play it as an event. */
const playEvent = (G: ImperialElegyState, cardId: string, power: Power = "GE", dice: number[] = []): Ctx => {
  G.phase = "action";
  G.activePower = power;
  if (!G.powers[power].hand.includes(cardId)) G.powers[power].hand.push(cardId);
  const ctx = makeCtx(dice, seat(power));
  expect(playCard(G, ctx, cardId, "event")).toBeUndefined();
  return ctx;
};

/** An action event card with the requested printed CP value. */
const cardOfCp = (cp: number): string => {
  const card = CARDS.actions.find(
    (entry) => entry.cp === cp && entry.type === "event" && entry.kind === "action",
  );
  if (!card) throw new Error(`no event card with CP ${cp}`);
  return card.id;
};

const viewFor = (G: ImperialElegyState, power: Power): ImperialElegyState =>
  ImperialElegyGameDef.playerView!(G, ctxFor(power), seat(power)) as unknown as ImperialElegyState;

const revealEntry = (G: ImperialElegyState) => G.log.find((entry) => entry.key === "auctionCardsRevealed");

// ---------------------------------------------------------------------------
// A71 Urabi Revolt
// ---------------------------------------------------------------------------
describe("A71 Urabi Revolt auction reveal", () => {
  test("the played cards are logged publicly after the last bidder", () => {
    const G = fresh();
    const ukCard = cardOfCp(3);
    G.powers.UK.hand = [ukCard];
    G.powers.FR.hand = [];
    G.powers.OT.hand = [];

    playEvent(G, "IE-A071", "GE");
    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending?.power).toBe("UK");
    expect(revealEntry(G)).toBeUndefined();

    expect(resolvePending(G, ctxFor("UK", [4, 2, 1]), `card:${ukCard}`)).toBeUndefined();
    expect(G.pending).toBeNull();

    const reveal = revealEntry(G);
    expect(reveal).toBeDefined();
    expect(reveal?.args?.auction).toBe("urabi");
    expect(reveal?.args?.cards).toBe(ukCard);
    // The reveal is a public, unattributed sentence; bids stay private.
    expect(reveal?.power).toBeUndefined();
    expect(Object.keys(reveal?.args ?? {}).sort()).toEqual(["auction", "cards"]);
    expect(G.powers.UK.flags.auctionBid).toBeUndefined();
    expect(G.powers.UK.flags.auctionCard).toBeUndefined();
    // The played card is still discarded; the reveal did not change that.
    expect(G.discard).toContain(ukCard);
  });

  test("no face-down card leaks before the last bidder decides", () => {
    const G = fresh();
    const ukCard = cardOfCp(2);
    const frCard = cardOfCp(1);
    G.powers.UK.hand = [ukCard];
    G.powers.FR.hand = [frCard];
    G.powers.OT.hand = [];

    playEvent(G, "IE-A071", "GE");
    expect(G.pending?.power).toBe("UK");
    expect(revealEntry(viewFor(G, "FR"))).toBeUndefined();

    // The UK bids; the auction moves to France, which must not see the card.
    expect(resolvePending(G, ctxFor("UK", [6, 4, 2]), `card:${ukCard}`)).toBeUndefined();
    expect(G.pending?.power).toBe("FR");
    const frView = viewFor(G, "FR");
    expect(revealEntry(frView)).toBeUndefined();
    expect(frView.powers.UK.flags.auctionCard).toBeUndefined();
    expect(frView.powers.UK.flags.auctionBid).toBeUndefined();
    // Nor can the French seat reconstruct the bid from a visible pile.
    expect(JSON.stringify(frView.log)).not.toContain(ukCard);
    expect((frView.pending?.options ?? []).map((option) => option.data?.card)).not.toContain(ukCard);

    // France bids too; now that every bid is in, both titles are public.
    expect(resolvePending(G, ctxFor("FR", [1, 5, 3]), `card:${frCard}`)).toBeUndefined();
    expect(G.pending).toBeNull();
    const reveal = revealEntry(G);
    expect(reveal?.args?.cards).toBe(`${ukCard},${frCard}`);
    const publicView = viewFor(G, "OT");
    expect(revealEntry(publicView)?.args?.cards).toBe(`${ukCard},${frCard}`);
  });

  test("the log formatter shows the card titles in both languages", () => {
    const G = fresh();
    const ukCard = cardOfCp(3);
    G.powers.UK.hand = [ukCard];
    G.powers.FR.hand = [];
    G.powers.OT.hand = [];
    playEvent(G, "IE-A071", "GE");
    resolvePending(G, ctxFor("UK", [4]), `card:${ukCard}`);

    const reveal = revealEntry(G)!;
    const card = CARD_BY_ID[ukCard];
    expect(logText(reveal, "en")).toContain(card.title);
    expect(logText(reveal, "en")).toContain("Urabi Revolt");
    expect(logText(reveal, "zh_CN")).toContain(card.titleZh);
    expect(logText(reveal, "zh_CN")).toContain("阿拉比起义");
  });

  test("an auction with no cards played logs no reveal", () => {
    const G = fresh();
    G.powers.UK.hand = [];
    G.powers.FR.hand = [];
    G.powers.OT.hand = [];
    playEvent(G, "IE-A071", "GE");
    // With no playable card every bidder auto-passes and the auction resolves.
    expect(G.pending).toBeNull();
    expect(revealEntry(G)).toBeUndefined();
    expect(G.powers.UK.flags.auctionBid).toBeUndefined();
    expect(G.powers.UK.flags.auctionCard).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// A102 Moroccan Crisis
// ---------------------------------------------------------------------------
describe("A102 Moroccan Crisis auction reveal", () => {
  test("the reveal includes the UK's optional aid card", () => {
    const G = fresh();
    const geCard = cardOfCp(1);
    const frCard = cardOfCp(1);
    const ukCard = cardOfCp(2);
    G.spaces.morocco.control = "FR";
    G.powers.GE.hand = [geCard];
    G.powers.FR.hand = [frCard];
    G.powers.UK.hand = [ukCard];

    playEvent(G, "IE-A102", "GE");
    expect(G.pending?.power).toBe("GE");
    expect(resolvePending(G, ctxFor("GE", [1]), `card:${geCard}`)).toBeUndefined();
    expect(G.pending?.power).toBe("FR");
    expect(resolvePending(G, ctxFor("FR", [1]), `card:${frCard}`)).toBeUndefined();
    expect(G.pending?.power).toBe("UK");
    // The UK's aid is offered for either side and is still secret.
    expect(optionIds(G)).toEqual(expect.arrayContaining([`card:${ukCard}:a`, `card:${ukCard}:b`]));
    expect(revealEntry(G)).toBeUndefined();

    expect(resolvePending(G, ctxFor("UK", [1, 1, 1]), `card:${ukCard}:b`)).toBeUndefined();
    expect(G.pending).toBeNull();
    const reveal = revealEntry(G);
    expect(reveal?.args?.auction).toBe("morocco");
    expect(reveal?.args?.cards).toBe(`${geCard},${frCard},${ukCard}`);
    expect(Object.values(G.powers).every((power) => power.flags.auctionCard === undefined)).toBe(true);
    // The UK's private aid bookkeeping is cleared after resolution.
    expect(G.powers.UK.flags.moroccoUkCp).toBeUndefined();
    expect(G.powers.UK.flags.moroccoUkSide).toBeUndefined();
  });
});
