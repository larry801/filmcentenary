/**
 * Cross-check the card decade bands against the module's deck layout.
 *
 * `constant/cards.data.ts` assigns each action card to a printed decade band by
 * its number (`entryFor`), which the README documents as
 * 13–70 / 71–81 / 82–91 / 92–99 / 100–112.  That mapping is a transcription from
 * the printed sheets, so — like the setup — a logic test cannot catch a slip.
 *
 * `data/generated/deck-entry.json` is the module's own saved deck placement: 42
 * card names listed under the decade bands they belong to.  Matching a card's
 * printed *title* to our card records gives an independent witness that the
 * band assignment is right, not merely that the counts are.
 */
import deckEntry from "../../src/imperialElegy/data/generated/deck-entry.json";
import {ACTION_CARDS} from "../../src/imperialElegy/constant/cards.data";
import {Decade} from "../../src/imperialElegy/constant/cards";

jest.setTimeout(300000);

/** The bands the module actually stores, keyed by the decade label we use. */
const MODULE_BANDS: Record<string, Decade> = {
  "1870s": "1870s",
  "1880s": "1880s",
  "1890s": "1890s",
  "1900s": "1900s",
};

const ENTRIES = deckEntry as unknown as Record<string, string[]>;

/**
 * A module deck entry is `"<printed title>/<suffix>"`.  Matching is done on the
 * title, normalised so punctuation, case and the printed ampersand/spelling
 * variants do not matter.
 */
const deckTitle = (entry: string): string => entry.replace(/\/.*$/, "");

/**
 * Printed spelling variants the module uses for the same card.  The module is a
 * beta and its deck labels carry a few older spellings ("Dreadnaught"), so the
 * comparison is about the card and its band, not about how it was typed.
 */
const SPELLING_VARIANTS: Record<string, string> = {
  dreadnaught: "dreadnought",
  dreadnoughts: "dreadnought",
};

const normalize = (value: string): string => {
  const cleaned = value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return SPELLING_VARIANTS[cleaned] ?? cleaned;
};

const cardByTitle = new Map<string, (typeof ACTION_CARDS)[number]>();
for (const card of ACTION_CARDS) {
  cardByTitle.set(normalize(card.title), card);
}

/**
 * Our card for a module deck entry, or undefined when the title has no match.
 *
 * Deliberately exact after normalisation: a probe showed all 42 module entries
 * match a card title directly, so a prefix/fuzzy fallback would only hide a
 * future misfiling behind a plausible-looking match.
 */
const cardForEntry = (entry: string): (typeof ACTION_CARDS)[number] | undefined =>
  cardByTitle.get(normalize(deckTitle(entry)));

describe("card decade bands against the module deck", () => {
  test("every decade group in the module is represented", () => {
    const bands = Object.keys(ENTRIES).filter((key) => key !== "greatwar");
    expect(bands.sort()).toEqual(Object.keys(MODULE_BANDS).sort());
  });

  test("the module's band sizes match our printed bands", () => {
    // Sizes first: a wrong size means a card was filed in the wrong decade.
    const byBand = new Map<Decade, number>();
    for (const card of ACTION_CARDS) {
      byBand.set(card.entry, (byBand.get(card.entry) ?? 0) + 1);
    }
    for (const [moduleBand, decade] of Object.entries(MODULE_BANDS)) {
      expect({ band: moduleBand, count: byBand.get(decade) ?? 0 }).toEqual({
        band: moduleBand,
        count: ENTRIES[moduleBand].length,
      });
    }
  });

  test("each card the module lists sits in the band the module files it under", () => {
    const mismatches: string[] = [];
    const unknown: string[] = [];

    for (const [moduleBand, entries] of Object.entries(ENTRIES)) {
      if (moduleBand === "greatwar") continue; // separate deck, checked below
      const decade = MODULE_BANDS[moduleBand];
      for (const entry of entries) {
        const card = cardForEntry(entry);
        if (card === undefined) {
          unknown.push(`${moduleBand}: ${deckTitle(entry)}`);
          continue;
        }
        if (card.entry !== decade) {
          mismatches.push(
            `${card.id} ${card.title}: our band ${card.entry}, module band ${decade}`,
          );
        }
      }
    }

    if (unknown.length > 0) console.log(`unmatched module titles: ${unknown.join(", ")}`);
    if (mismatches.length > 0) console.log(`band mismatches: ${mismatches.join("; ")}`);
    expect(unknown).toEqual([]);
    expect(mismatches).toEqual([]);
  });

  test("the module lists every card we place after the 1850s band", () => {
    // The other direction: a card we file in 1870s+ that the module never lists
    // means its band was invented here, not transcribed.
    const listed = new Set(
      Object.entries(ENTRIES)
        .filter(([band]) => band !== "greatwar")
        .flatMap(([, entries]) => entries.map((entry) => cardForEntry(entry)?.id))
        .filter((id): id is string => typeof id === "string"),
    );
    const missing = ACTION_CARDS
      .filter((card) => card.entry !== "1850s")
      .filter((card) => !listed.has(card.id))
      .map((card) => `${card.id} ${card.title} (${card.entry})`);
    if (missing.length > 0) console.log(`not listed by the module: ${missing.join(", ")}`);
    expect(missing).toEqual([]);
  });

  test("the Great War deck is the module's ten cards", () => {
    // `greatwar` is a separate deck; assert its size here so a stray action card
    // cannot be filed into it by accident.
    expect(ENTRIES.greatwar).toHaveLength(10);
    expect(ACTION_CARDS.filter((card) => card.entry === "1910s")).toHaveLength(0);
  });
});
