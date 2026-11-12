import fs from "fs";
import path from "path";

import {Decade} from "./constant/cards";
import {ACTION_CARDS} from "./constant/cards.data";

/** Module saved-deck placement, extracted from the VASSAL archive. */
const deckEntry = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data/generated/deck-entry.json"), "utf8"),
) as Record<string, string[]>;

/**
 * Deck-entry titles come from the module and use loose spelling
 * (for example "Dreadnaught"), so compare on a normalized title.
 */
const normalizeTitle = (title: string): string =>
  title
    .trim()
    .replace(/\/$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/dreadnaught/g, "dreadnought");

const moduleDecadeByTitle = new Map<string, Decade>();
for (const [decade, titles] of Object.entries(deckEntry)) {
  // Great War cards have their own deck; the action-card bands are decade keys.
  if (decade === "greatwar") continue;
  for (const title of titles) {
    moduleDecadeByTitle.set(normalizeTitle(title), decade as Decade);
  }
}

const byNumber = (number: number) => ACTION_CARDS.find((card) => card.number === number)!;

/** Cards whose band depends on the 1890s/1900s boundary. */
const affectedCards = ACTION_CARDS.filter((card) => card.number! >= 92 && card.number! <= 112);

test("card 100 The Balkan Wars is filed in the printed 1900s band", () => {
  const balkanWars = byNumber(100);
  expect(balkanWars.title).toBe("The Balkan Wars");
  expect(balkanWars.entry).toBe("1900s");

  // The adjacent cards keep their own bands.
  expect(byNumber(99).entry).toBe("1890s");
  expect(byNumber(101).entry).toBe("1900s");
});

test("every card in the affected 1890s/1900s range matches the module deck placement", () => {
  expect(affectedCards).toHaveLength(21);

  for (const card of affectedCards) {
    const moduleDecade = moduleDecadeByTitle.get(normalizeTitle(card.title));
    expect(moduleDecade).toBeDefined();
    expect(moduleDecade).toBe(card.entry);
  }
});

test("module deck sizes agree with the corrected 1890s and 1900s counts", () => {
  expect(deckEntry["1890s"]).toHaveLength(8);
  expect(deckEntry["1900s"]).toHaveLength(13);

  expect(deckEntry["1890s"]).toContain("Dreadnaught/");
  expect(deckEntry["1890s"]).not.toContain("The Balkan Wars/");
  expect(deckEntry["1900s"]).toContain("The Balkan Wars/");
});

test("widening Decade adds label-only bands without moving any card", () => {
  // The playbook labels turns 2 and 7 as the 1860s and 1910s, but the module
  // has no saved deck for either band and no action card is printed there.
  expect(deckEntry["1860s"]).toBeUndefined();
  expect(deckEntry["1910s"]).toBeUndefined();

  const printedBands: Decade[] = ["1850s", "1870s", "1880s", "1890s", "1900s"];
  expect(ACTION_CARDS).toHaveLength(100);
  expect(ACTION_CARDS.filter((card) => card.entry === "1860s" || card.entry === "1910s")).toEqual([]);
  expect(new Set(ACTION_CARDS.map((card) => card.entry))).toEqual(new Set(printedBands));

  // Per-band counts are unchanged: no card crossed into another band.
  const counts: Record<string, number> = {};
  for (const card of ACTION_CARDS) counts[card.entry] = (counts[card.entry] ?? 0) + 1;
  expect(counts).toEqual({"1850s": 58, "1870s": 11, "1880s": 10, "1890s": 8, "1900s": 13});
});
