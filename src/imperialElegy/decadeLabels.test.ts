/**
 * Imperial Elegy — decade labels.
 *
 * Pins the widened `Decade` union and the playbook's one-decade-per-turn
 * mapping (turns 1-7 = 1850s … 1910s).  The 1860s and 1910s are label-only
 * bands: no action card is printed there, so turns 2 and 7 add zero cards and
 * no card changed bands when the labels were widened.  The display labels in
 * `components/logText.ts` are checked in both locales.
 */

import fs from "fs";
import path from "path";

import {Decade} from "./constant/cards";
import {ACTION_CARDS} from "./constant/cards.data";
import {cardsForDecade} from "./engine/deck";
import {beginTurnDecade, decadeForTurn} from "./engine/economy";
import {setupImperialElegy} from "./engine/setup";
import {logText} from "./components/logText";

const ctx: any = {
  playerID: "0",
  random: {Die: () => 3},
  events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}},
};

const CAMPAIGN_TURNS = [1, 2, 3, 4, 5, 6, 7];

/** The full union, in campaign order.  A type-level check follows below. */
const DECADE_UNION: Decade[] = [
  "1850s",
  "1860s",
  "1870s",
  "1880s",
  "1890s",
  "1900s",
  "1910s",
];

/** Campaign labels as printed in the playbook scenario headers. */
const PLAYBOOK_TURN_DECADES: Decade[] = [
  "1850s",
  "1860s",
  "1870s",
  "1880s",
  "1890s",
  "1900s",
  "1910s",
];

/** The five entry bands actually printed on action cards. */
const PRINTED_BANDS: Decade[] = ["1850s", "1870s", "1880s", "1890s", "1900s"];

/** Pre-widening mapping, which collapsed turns 2 and 7 onto 1850s/1900s. */
const COLLAPSED_TURN_DECADES: Decade[] = [
  "1850s",
  "1850s",
  "1870s",
  "1880s",
  "1890s",
  "1900s",
  "1900s",
];

// ---------------------------------------------------------------------------
// Compile-time: `Decade` is exactly the seven campaign labels.
// ---------------------------------------------------------------------------
type Assert<T extends true> = T;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type DecadeUnionIsExact = Assert<
  Same<Decade, "1850s" | "1860s" | "1870s" | "1880s" | "1890s" | "1900s" | "1910s">
>;

/** Cards added per turn, where a band already seen adds nothing. */
const additionsByTurn = (labels: readonly Decade[]): number[] => {
  const seen = new Set<string>();
  return labels.map((decade) => {
    const entering = cardsForDecade(decade).filter((id) => !seen.has(id));
    for (const id of entering) seen.add(id);
    return entering.length;
  });
};

/** Every card a sequence of decades selects, each once. */
const cardsReachedBy = (labels: readonly Decade[]): string[] => [
  ...new Set(labels.flatMap((decade) => cardsForDecade(decade))),
].sort();

// ---------------------------------------------------------------------------
// 1. The union
// ---------------------------------------------------------------------------

test("Decade union enumerates the seven campaign labels, including 1860s/1910s", () => {
  expect(DECADE_UNION).toHaveLength(7);
  expect(new Set(DECADE_UNION).size).toBe(7);
  expect(DECADE_UNION).toEqual(PLAYBOOK_TURN_DECADES);
  expect(DECADE_UNION[0]).toBe("1850s");
  expect(DECADE_UNION[1]).toBe("1860s");
  expect(DECADE_UNION[6]).toBe("1910s");

  // Type-level guard: the union above is `Decade` itself, not a superset.
  const decadeUnionIsExact: DecadeUnionIsExact = true;
  expect(decadeUnionIsExact).toBe(true);
});

// ---------------------------------------------------------------------------
// 2. Per-turn labels
// ---------------------------------------------------------------------------

test("campaign turns 1-7 map one-for-one to 1850s … 1910s", () => {
  expect(CAMPAIGN_TURNS.map(decadeForTurn)).toEqual(PLAYBOOK_TURN_DECADES);
  expect(CAMPAIGN_TURNS.map(decadeForTurn)).toEqual(DECADE_UNION);

  // Each turn has its own label; no two turns share a decade.
  expect(new Set(CAMPAIGN_TURNS.map(decadeForTurn)).size).toBe(7);

  // Out-of-range turns clamp to the first/last label.
  expect(decadeForTurn(0)).toBe("1850s");
  expect(decadeForTurn(-1)).toBe("1850s");
  expect(decadeForTurn(8)).toBe("1910s");
  expect(decadeForTurn(Number.NaN)).toBe("1850s");
  expect(decadeForTurn(2.5)).toBe("1860s");
  expect(decadeForTurn(7.9)).toBe("1910s");
});

// ---------------------------------------------------------------------------
// 3. The new bands are label-only: they select zero cards
// ---------------------------------------------------------------------------

test("1860s and 1910s are label-only bands with no printed cards", () => {
  expect(cardsForDecade("1860s")).toEqual([]);
  expect(cardsForDecade("1910s")).toEqual([]);
  expect(ACTION_CARDS.filter((card) => card.entry === "1860s")).toEqual([]);
  expect(ACTION_CARDS.filter((card) => card.entry === "1910s")).toEqual([]);
});

test("prep reports the new labels while turns 2 and 7 enter zero cards", () => {
  const G = setupImperialElegy(ctx);

  expect(beginTurnDecade(G, 1)).toMatchObject({turn: 1, decade: "1850s", entering: []});
  expect(beginTurnDecade(G, 2)).toMatchObject({turn: 2, decade: "1860s", entering: []});
  expect(beginTurnDecade(G, 3)).toMatchObject({turn: 3, decade: "1870s"});
  expect(beginTurnDecade(G, 3).entering).toHaveLength(11);
  expect(beginTurnDecade(G, 4).entering).toHaveLength(10);
  expect(beginTurnDecade(G, 5).entering).toHaveLength(8);
  expect(beginTurnDecade(G, 6).entering).toHaveLength(13);
  expect(beginTurnDecade(G, 7)).toMatchObject({turn: 7, decade: "1910s", entering: []});

  // Every non-empty band still reports only cards printed for that band.
  for (const turn of [3, 4, 5, 6]) {
    const entry = beginTurnDecade(G, turn);
    for (const id of entry.entering) {
      expect(ACTION_CARDS.find((card) => card.id === id)?.entry).toBe(entry.decade);
    }
  }
});

// ---------------------------------------------------------------------------
// 4. Widening the labels moved no cards
// ---------------------------------------------------------------------------

test("per-turn entering counts are unchanged: 58/0/11/10/8/13/0", () => {
  const additions = additionsByTurn(DECADE_UNION);
  expect(additions).toEqual([58, 0, 11, 10, 8, 13, 0]);
  expect(additions.reduce((sum, n) => sum + n, 0)).toBe(100);
});

test("no card changed band and both mappings reach the same 100 cards", () => {
  // Card faces still use only the five printed bands, with unchanged counts.
  expect(ACTION_CARDS).toHaveLength(100);
  expect(new Set(ACTION_CARDS.map((card) => card.entry))).toEqual(new Set(PRINTED_BANDS));

  const counts: Record<string, number> = {};
  for (const card of ACTION_CARDS) counts[card.entry] = (counts[card.entry] ?? 0) + 1;
  expect(counts).toEqual({
    "1850s": 58,
    "1870s": 11,
    "1880s": 10,
    "1890s": 8,
    "1900s": 13,
  });

  // The old collapsed labels and the widened labels select the same card set,
  // and it is exactly the printed action deck.
  expect(cardsReachedBy(DECADE_UNION)).toEqual(cardsReachedBy(COLLAPSED_TURN_DECADES));
  expect(cardsReachedBy(DECADE_UNION)).toHaveLength(100);
  expect(cardsReachedBy(DECADE_UNION)).toEqual(ACTION_CARDS.map((card) => card.id).sort());

  // The module's saved decks corroborate that no 1860s/1910s deck exists.
  const deckEntry = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data/generated/deck-entry.json"), "utf8"),
  ) as Record<string, string[]>;
  expect(deckEntry["1860s"]).toBeUndefined();
  expect(deckEntry["1910s"]).toBeUndefined();
  expect(Object.keys(deckEntry).sort()).toEqual(["1870s", "1880s", "1890s", "1900s", "greatwar"]);
});

// ---------------------------------------------------------------------------
// 5. Display labels (EN / ZH) for every decade, including the new bands
// ---------------------------------------------------------------------------

const DISPLAY_LABELS: Array<[Decade, string, string]> = [
  ["1850s", "1850s", "1850 年代"],
  ["1860s", "1860s", "1860 年代"],
  ["1870s", "1870s", "1870 年代"],
  ["1880s", "1880s", "1880 年代"],
  ["1890s", "1890s", "1890 年代"],
  ["1900s", "1900s", "1900 年代"],
  ["1910s", "1910s", "1910 年代"],
];

const deckPreparedText = (decade: Decade, locale: "en" | "zh_CN"): string =>
  logText({key: "deckPrepared", args: {decade, entering: 0, deck: 58}}, locale);

test("logText renders every decade label in EN and ZH, including 1860s/1910s", () => {
  for (const [decade, en, zh] of DISPLAY_LABELS) {
    expect(deckPreparedText(decade, "en")).toBe(`Deck prepared for the ${en}: 0 new cards, 58 in deck.`);
    expect(deckPreparedText(decade, "zh_CN")).toBe(`为${zh}准备了牌堆：新增 0 张牌，牌堆共 58 张。`);
  }

  // The labels actually produced by the turn mapping are the new ones.
  expect(deckPreparedText(decadeForTurn(2), "en")).toContain("1860s");
  expect(deckPreparedText(decadeForTurn(2), "zh_CN")).toContain("1860 年代");
  expect(deckPreparedText(decadeForTurn(7), "en")).toContain("1910s");
  expect(deckPreparedText(decadeForTurn(7), "zh_CN")).toContain("1910 年代");
});
