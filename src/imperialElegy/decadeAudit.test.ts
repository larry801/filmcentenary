/**
 * Imperial Elegy — decade / card-band audit (read-only; no production changes).
 *
 * Two related notions of "decade" are in play:
 *
 *  1. the printed card-entry band on an action card's face
 *     (1850s / 1870s / 1880s / 1890s / 1900s); and
 *  2. the campaign-turn decade label printed in the playbook
 *     (turn 1 = 1850s … turn 7 = 1910s, one decade per turn), which is what
 *     `decadeForTurn` returns.
 *
 * `constant/cards.ts`'s `Decade` union covers both, so it includes the 1860s and
 * 1910s even though no card is printed for those entry bands.  The tests below
 * pin the turn -> label mapping, the five printed band counts, and the fact
 * that widening the labels moved no cards: turns 2 and 7 add zero cards exactly
 * as they did when their labels were collapsed onto 1850s/1900s.  See
 * docs/imperial-elegy/DECADE_AUDIT.md for sources.
 */

import fs from "fs";
import path from "path";

import {Decade} from "./constant/cards";
import {ACTION_CARDS, GREAT_WAR_CARDS, HOME_CARDS} from "./constant/cards.data";
import {CardId} from "./types";
import {
  cardById,
  cardsForDecade,
  decadeForTurn as deckDecadeForTurn,
} from "./engine/deck";
import {
  beginTurnDecade,
  decadeForTurn,
} from "./engine/economy";
import {setupImperialElegy} from "./engine/setup";

const ctx: any = {
  playerID: "0",
  random: {Die: () => 3},
  events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}},
};

const CAMPAIGN_TURNS = [1, 2, 3, 4, 5, 6, 7];

/** The full widened union: five printed bands plus two label-only bands. */
const ALL_DECADES: Decade[] = ["1850s", "1860s", "1870s", "1880s", "1890s", "1900s", "1910s"];

/** The five bands actually printed on action cards, in campaign order. */
const PRINTED_BANDS: Decade[] = ["1850s", "1870s", "1880s", "1890s", "1900s"];

/** `decadeForTurn` as implemented (turns 1-7). */
const TURN_DECADES: Decade[] = [
  "1850s", // turn 1
  "1860s", // turn 2 — label only; no cards printed in this band
  "1870s", // turn 3
  "1880s", // turn 4
  "1890s", // turn 5
  "1900s", // turn 6
  "1910s", // turn 7 — label only; no cards printed in this band
];

/** The playbook's own labels (IE_playbook.pdf pp. 3-5), one decade per turn. */
const PLAYBOOK_TURN_DECADES = [
  "1850s",
  "1860s",
  "1870s",
  "1880s",
  "1890s",
  "1900s",
  "1910s",
];

/** Action cards whose `entry` equals `band` (string-keyed so absent bands work). */
const cardsInBand = (band: string): CardId[] =>
  ACTION_CARDS.filter((card) => (card.entry as string) === band).map((card) => card.id);

const countInBand = (band: string): number => cardsInBand(band).length;

/**
 * Cards the prep phase would add per turn if every turn is played, following
 * `labels`.  Turn 1's entry is the setup deal; a band already seen adds 0.
 */
const additionsByTurn = (labels: readonly string[]): number[] => {
  const seen = new Set<CardId>();
  return labels.map((band) => {
    const entering = cardsInBand(band).filter((id) => !seen.has(id));
    for (const id of entering) seen.add(id);
    return entering.length;
  });
};

/** Every action card a sequence of labels makes available, each exactly once. */
const cardsReachedBy = (labels: readonly string[]): CardId[] => {
  const seen = new Set<CardId>();
  for (const band of labels) for (const id of cardsInBand(band)) seen.add(id);
  return [...seen].sort();
};

// ---------------------------------------------------------------------------
// 1. Turn -> decade mapping
// ---------------------------------------------------------------------------

test("turn mapping: one playbook decade per campaign turn, 1850s → 1910s", () => {
  expect(CAMPAIGN_TURNS.map(decadeForTurn)).toEqual(TURN_DECADES);
  // deck.ts re-exports economy.ts's function, so the two names must agree.
  expect(CAMPAIGN_TURNS.map(deckDecadeForTurn)).toEqual(TURN_DECADES);

  // The implementation now matches the playbook headers, including the two
  // label-only bands, and every turn has its own label.
  expect(TURN_DECADES).toEqual(PLAYBOOK_TURN_DECADES);
  expect([...new Set(TURN_DECADES)]).toEqual(ALL_DECADES);

  // Out-of-range turns clamp rather than throw (UI/logs may read turn 8+).
  expect(decadeForTurn(0)).toBe("1850s");
  expect(decadeForTurn(-3)).toBe("1850s");
  expect(decadeForTurn(8)).toBe("1910s");
});

test("deck.ts re-exports economy's decadeForTurn: one canonical mapping", () => {
  // `engine/deck.ts` is now just `export {decadeForTurn} from "./economy"`, so
  // the two names are the *same* function object.  Identity is the strongest
  // guard against a second implementation reappearing in deck.ts.
  expect(deckDecadeForTurn).toBe(decadeForTurn);

  // Integer campaign turns agree (and match the pinned mapping above).
  expect(CAMPAIGN_TURNS.map(deckDecadeForTurn)).toEqual(CAMPAIGN_TURNS.map(decadeForTurn));
  expect(CAMPAIGN_TURNS.map(deckDecadeForTurn)).toEqual(TURN_DECADES);

  // Inputs off the integer turn path agree too: non-finite values clamp to the
  // first band and fractional turns floor before clamping, in both names.
  const OFF_PATH_TURNS = [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    0.5,
    2.5,
    6.5,
    7.9,
  ];
  for (const turn of OFF_PATH_TURNS) {
    expect(deckDecadeForTurn(turn)).toBe(decadeForTurn(turn));
  }

  // Pin the canonical answers so a mapping change is still reviewable.
  expect(deckDecadeForTurn(Number.NaN)).toBe("1850s");
  expect(deckDecadeForTurn(2.5)).toBe("1860s");
  expect(deckDecadeForTurn(7.9)).toBe("1910s");
  expect(deckDecadeForTurn(Number.POSITIVE_INFINITY)).toBe("1850s");
});

// ---------------------------------------------------------------------------
// 2. Cards per printed band (current data)
// ---------------------------------------------------------------------------

test("action-card bands stay 58 / 11 / 10 / 8 / 13; 1860s and 1910s are empty", () => {
  const counts: Record<string, number> = {};
  for (const band of ALL_DECADES) counts[band] = countInBand(band);
  expect(counts).toEqual({
    "1850s": 58,
    "1860s": 0,
    "1870s": 11,
    "1880s": 10,
    "1890s": 8,
    "1900s": 13,
    "1910s": 0,
  });
  expect(ACTION_CARDS).toHaveLength(100);
  expect(ALL_DECADES.reduce((sum, band) => sum + countInBand(band), 0)).toBe(100);
  expect(PRINTED_BANDS.reduce((sum, band) => sum + countInBand(band), 0)).toBe(100);

  // 1860s and 1910s are in the `Decade` union but absent from the card data.
  expect(cardsForDecade("1860s")).toEqual([]);
  expect(cardsForDecade("1910s")).toEqual([]);
  expect([...new Set(ACTION_CARDS.map((card) => card.entry as string))].sort())
    .toEqual([...PRINTED_BANDS].sort());

  // cardsForDecade is the only deck selector and must keep the same counts.
  for (const band of ALL_DECADES) {
    expect(cardsForDecade(band)).toHaveLength(countInBand(band));
  }

  // Home and GW cards carry `entry` too, but never enter the action deck.
  expect(HOME_CARDS).toHaveLength(12);
  expect(HOME_CARDS.every((card) => card.entry === "1850s")).toBe(true);
  expect(GREAT_WAR_CARDS).toHaveLength(10);
  expect(GREAT_WAR_CARDS.every((card) => card.entry === "1900s")).toBe(true);
});

// ---------------------------------------------------------------------------
// 3. Cards added per turn under the new mapping
// ---------------------------------------------------------------------------

test("per-turn additions: 58 at setup, then 0 / 11 / 10 / 8 / 13 / 0", () => {
  // Includes the turn-1 setup deal; turn 1 is not a prep-phase addition.
  const additions = additionsByTurn(TURN_DECADES);
  expect(additions).toEqual([58, 0, 11, 10, 8, 13, 0]);
  expect(additions.reduce((sum, n) => sum + n, 0)).toBe(100);

  // Turns 2 and 7 select no cards because the 1860s and 1910s bands are
  // unprinted — not because they reuse an already-entered band.
  expect(cardsInBand("1860s")).toEqual([]);
  expect(cardsInBand("1910s")).toEqual([]);
  expect(additions[1]).toBe(0);
  expect(additions[6]).toBe(0);
});

test("beginTurnDecade is stateless: it reports a band, not campaign additions", () => {
  const G = setupImperialElegy(ctx);

  // The 1850s band was dealt by setup, so turn 1 adds nothing.
  expect(beginTurnDecade(G, 1)).toMatchObject({decade: "1850s", entering: []});
  // 1860s has no printed cards at all, so turn 2 is empty too.
  expect(beginTurnDecade(G, 2)).toMatchObject({decade: "1860s", entering: []});

  expect(beginTurnDecade(G, 3)).toMatchObject({decade: "1870s"});
  expect(beginTurnDecade(G, 3).entering).toHaveLength(11);
  expect(beginTurnDecade(G, 4).entering).toHaveLength(10);
  expect(beginTurnDecade(G, 5).entering).toHaveLength(8);
  expect(beginTurnDecade(G, 6).entering).toHaveLength(13);

  // 1910s likewise selects no cards, even on a state where the 1900s band has
  // not entered yet: the label and the card band are separate notions.
  expect(beginTurnDecade(G, 7)).toMatchObject({decade: "1910s", entering: []});

  // Pure; assigning the reported decade to `G.decade` is the caller's job
  // (game.ts#prepBegin / moves.ts#resolveEnd).
  expect(G.decade).toBe("1850s");
});

// ---------------------------------------------------------------------------
// 4. Widening the labels moved no cards
// ---------------------------------------------------------------------------

test("relabelling turns 2/7 as 1860s/1910s leaves deck composition unchanged", () => {
  // The pre-widening mapping collapsed those turns onto 1850s/1900s.
  const collapsed: Decade[] = ["1850s", "1850s", "1870s", "1880s", "1890s", "1900s", "1900s"];

  const widenedAdditions = additionsByTurn(TURN_DECADES);
  expect(additionsByTurn(collapsed)).toEqual(widenedAdditions);
  expect(widenedAdditions).toEqual([58, 0, 11, 10, 8, 13, 0]);

  // Those two turns were already zero-card turns...
  expect(cardsInBand("1860s")).toEqual([]);
  expect(cardsInBand("1910s")).toEqual([]);
  expect(widenedAdditions[1]).toBe(0);
  expect(widenedAdditions[6]).toBe(0);

  // ...and both mappings reach exactly the same 100 cards, each once.
  expect(cardsReachedBy(TURN_DECADES)).toEqual(cardsReachedBy(collapsed));
  expect(cardsReachedBy(TURN_DECADES)).toHaveLength(100);
  expect(cardsReachedBy(TURN_DECADES)).toEqual(ACTION_CARDS.map((card) => card.id).sort());
});

// ---------------------------------------------------------------------------
// 5. Corrected data: card 100 is filed with its printed band
// ---------------------------------------------------------------------------
//
// The card face prints "1900s" (public/imperial-elegy/cards/action-100.jpg),
// and the module's saved deck
// (src/imperialElegy/data/generated/deck-entry.json) also places The Balkan
// Wars in 1900s.  `cards.data.ts` was corrected from `n <= 100` to `n <= 99`,
// moving IE-A100 from 1890s to 1900s; these assertions stop it from silently
// regressing.
test("IE-A100 is filed in 1900s, matching its printed face", () => {
  const balkanWars = cardById("IE-A100");
  expect(balkanWars.title).toBe("The Balkan Wars");
  expect(balkanWars.entry).toBe("1900s");
  expect(cardsForDecade("1890s")).not.toContain("IE-A100");
  expect(cardsForDecade("1900s")).toContain("IE-A100");

  // Corrected bands: 1890s is 92-99 and 1900s is 100-112.
  expect(cardsForDecade("1890s")).toHaveLength(8);
  expect(cardsForDecade("1900s")).toHaveLength(13);
});

test("module placement corroborates the printed faces at the last boundary", () => {
  const decks = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data/generated/deck-entry.json"), "utf8"),
  ) as Record<string, string[]>;

  // Module saved-deck sizes: 42 later cards + 58 already in the start deck.
  expect(decks["1870s"]).toHaveLength(11);
  expect(decks["1880s"]).toHaveLength(10);
  expect(decks["1890s"]).toHaveLength(8);
  expect(decks["1900s"]).toHaveLength(13);
  expect(decks["1900s"]).toContain("The Balkan Wars/");
  expect(decks["1890s"]).not.toContain("The Balkan Wars/");
  // No module decade deck exists for the two unprinted bands either, which is
  // why widening the labels moved no card into them.
  expect(decks["1860s"]).toBeUndefined();
  expect(decks["1910s"]).toBeUndefined();
});
