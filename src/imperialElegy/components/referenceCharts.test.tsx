/**
 * The nine printed reference charts, transcribed for the UI.
 *
 * The charts are published English PNGs; `referenceCharts/` gives each one a
 * bilingual transcription and `ChartLightbox` opens it in the reader's
 * language.  These tests pin the contract from both sides:
 *
 *   1. all nine published chart ids resolve to a transcription, and the ids are
 *      exactly the catalogue's (`CHARTS`), so a new chart cannot ship without
 *      its text;
 *   2. every string has a real Chinese translation — not the English text, not
 *      an empty string, no unrendered placeholder;
 *   3. the tables the engine already owns (the counter mix, the crisis rows,
 *      the non-player alliance rows) agree with the transcription, so a printed
 *      table cannot drift from the rules it documents;
 *   4. the component renders the language it is asked for, and the lightbox
 *      picks that language's view by default.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";

// The node test environment cannot parse the stylesheet import (see
// `referenceTables.test.tsx`).
jest.mock("./imperial-elegy.css", () => ({}));

import {CHART_TEXTS, chartTextById} from "./referenceCharts";
import type {Bi, ChartBlock, ChartText} from "./referenceCharts";
import {ChartTextView} from "./ChartTextView";
import {CHARTS, initialChartMode, playerDisplayChart} from "./ChartLightbox";
import {PLAYER_COUNTER_CHART} from "../engine/counters";
import {PRINTED_CRISIS_ROWS, BALKAN_STATE_TABLE} from "../engine/crisisTable";
import {NON_PLAYER_ALLIANCE_TABLE} from "../engine/limitedWar";

type Locale = "en" | "zh_CN";

/** Every bilingual string of one chart, flattened for the parity checks. */
const stringsOf = (chart: ChartText): Bi[] => {
  const out: Bi[] = [chart.title];
  const block = (entry: ChartBlock): void => {
    switch (entry.kind) {
      case "prose":
      case "sub":
        out.push(entry.text);
        return;
      case "bullets":
        out.push(...entry.items);
        return;
      case "sublist":
        out.push(...entry.items);
        return;
      case "table":
        out.push(...entry.columns);
        for (const row of entry.rows) out.push(...row);
        if (entry.note !== undefined) out.push(entry.note);
        return;
      default:
        return;
    }
  };
  for (const section of chart.sections) {
    out.push(section.title);
    for (const entry of section.blocks) block(entry);
  }
  return out;
};

const allStrings = (): Bi[] => CHART_TEXTS.flatMap((chart) => stringsOf(chart));

/** The visible text of a markup fragment, with tags stripped. */
const textOf = (html: string): string => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

describe("the catalogue and the transcriptions", () => {
  test("all nine published charts are transcribed, and only those", () => {
    expect(CHART_TEXTS).toHaveLength(9);
    expect(CHART_TEXTS.map((chart) => chart.id)).toEqual(CHARTS.map((chart) => chart.id));
    for (const entry of CHARTS) {
      expect(chartTextById(entry.id)).toBeDefined();
      // The title is the same pair the catalogue shows, so the lightbox heading
      // and the transcription cannot disagree.
      expect(chartTextById(entry.id)!.title).toEqual({en: entry.title, zh: entry.titleZh});
    }
  });

  test("a chart that is not published has no transcription", () => {
    expect(chartTextById("display-ge")).toBeUndefined();
    expect(chartTextById("")).toBeUndefined();
  });

  test("every chart has at least one section with content", () => {
    for (const chart of CHART_TEXTS) {
      expect(chart.sections.length).toBeGreaterThan(0);
      for (const section of chart.sections) expect(section.blocks.length).toBeGreaterThan(0);
    }
  });
});

describe("bilingual parity", () => {
  /**
   * A cell that prints the same in both languages: a number, a power code
   * (`GE`, `UK/GE*`), an icon letter (`M`, `R`, `G`), `FP`, `MPIT`, `VP`.
   * Those are the printed sheet's own notation, not prose; everything else
   * must be translated.
   */
  const isNotation = (entry: Bi): boolean =>
    /^[A-Z0-9\s/*+\-=<>≤≥·.()%½†]+$/.test(entry.en) || /^[a-z]\.$/.test(entry.en) || /^\d{4}s$/.test(entry.en);

  test("every prose string has a Chinese translation that is not the English one", () => {
    for (const entry of allStrings()) {
      expect(entry.en.trim()).not.toBe("");
      expect(entry.zh.trim()).not.toBe("");
      if (isNotation(entry)) continue;
      // A copy of the English is a missed translation, not a translation.
      expect(entry.zh).not.toBe(entry.en);
    }
  });

  test("no string is an unrendered placeholder or a hole", () => {
    for (const entry of allStrings()) {
      for (const value of [entry.en, entry.zh]) {
        expect(value).not.toContain("{{");
        expect(value).not.toContain("undefined");
        expect(value).not.toContain("NaN");
        expect(value).not.toContain("[object Object]");
      }
    }
  });

  test("the Chinese text really is Chinese", () => {
    // Every chart's first prose or bullet carries a Han character; a chart that
    // silently fell back to the English sheet would fail here.
    for (const chart of CHART_TEXTS) {
      const zh = stringsOf(chart).map((entry) => entry.zh).join(" ");
      expect(zh).toMatch(/[\u4e00-\u9fff]/);
    }
  });
});

describe("the transcriptions agree with the engine", () => {
  /** The body rows of one table block, located by its first column heading. */
  const rowOf = (chart: ChartText, firstColumn: string): string[][] => {
    const found: string[][] = [];
    for (const section of chart.sections) {
      for (const block of section.blocks) {
        if (block.kind !== "table") continue;
        if (block.columns[0]?.en !== firstColumn) continue;
        for (const row of block.rows) found.push(row.map((cell) => cell.en));
      }
    }
    return found;
  };

  test("the counter chart prints the same player rows rule 4.2 enforces", () => {
    const chart = chartTextById("counter-count")!;
    const rows = rowOf(chart, "Counter");
    const byLabel = new Map(rows.map((row) => [row[0], row.slice(1, 7)]));

    // The sheet prints a dash for "no counter" and a figure otherwise; the
    // engine stores zero for the same thing.
    const numbers = (pick: (power: "GE" | "UK" | "FR" | "AU" | "RU" | "OT") => number): string[] =>
      (["GE", "UK", "FR", "AU", "RU", "OT"] as const).map((power) => String(pick(power)));
    expect(byLabel.get("Standing Armies")).toEqual(numbers((power) => PLAYER_COUNTER_CHART[power].standingArmies));
    expect(byLabel.get("Reserve Armies")).toEqual(numbers((power) => PLAYER_COUNTER_CHART[power].reserveArmies));
    expect(byLabel.get("EFs")).toEqual(numbers((power) => PLAYER_COUNTER_CHART[power].expeditionary));
    expect(byLabel.get("ECs")).toEqual(numbers((power) => PLAYER_COUNTER_CHART[power].eliteCorps));
    expect(byLabel.get("Squadrons")).toEqual(numbers((power) => PLAYER_COUNTER_CHART[power].squadrons));
    expect(byLabel.get("Dreadnoughts")).toEqual(numbers((power) => PLAYER_COUNTER_CHART[power].dreadnoughts));
    // The chart splits the special armies into standing and reserve; the engine
    // stores the two halves, so the printed figure is their sum, and a power
    // with none prints the sheet's dash.
    expect(byLabel.get("Special Armies")).toEqual(
      (["GE", "UK", "FR", "AU", "RU", "OT"] as const).map((power) => {
        const total = PLAYER_COUNTER_CHART[power].specialStandingArmies + PLAYER_COUNTER_CHART[power].specialReserveArmies;
        return total === 0 ? "-" : String(total);
      }),
    );
  });

  test("the crisis chart prints one row per crisis-table row, in printed order", () => {
    const chart = chartTextById("crisis")!;
    const rows = rowOf(chart, "Event");
    expect(rows).toHaveLength(PRINTED_CRISIS_ROWS.length);
    expect(rows.map((row) => row[0])).toEqual(PRINTED_CRISIS_ROWS.map((row) => row.event));
    // Every printed result cell is present for every row.
    for (const row of rows) expect(row).toHaveLength(8);
  });

  test("the crisis chart's Balkan table is the engine's own table", () => {
    const chart = chartTextById("crisis")!;
    const rows = rowOf(chart, "Roll");
    expect(rows).toHaveLength(BALKAN_STATE_TABLE.length);
    for (const cell of BALKAN_STATE_TABLE) {
      const printed = rows[cell.roll - 1];
      expect(printed[0]).toBe(String(cell.roll));
      if (cell.choice === true) expect(printed[1]).toBe("Choice");
      else expect(printed[1]).toBe(cell.minor);
    }
  });

  test("the war-aims chart prints the non-player alliance rows the engine uses", () => {
    const chart = chartTextById("war-aims-minors")!;
    const rows = rowOf(chart, "Nation");
    expect(rows).toHaveLength(NON_PLAYER_ALLIANCE_TABLE.length);
    // The printed sheet names one row "Italy/Italian Minor" and marks the two
    // late-independent nations with `**`; normalise those before matching.
    // The printed sheet prints a third column of "Germany" for Denmark, which
    // the March 2026 errata corrects to Austria.  The chart shows the errata
    // cell (AU), matching `engine/limitedWar.ts`; the errata note is still
    // rendered so the printed misprint remains documented.
    const CELL_CODE: Record<string, string> = {
      France: "FR", Russia: "RU", Ottomans: "OT", Germany: "GE", UK: "UK", AU: "AU",
    };
    const codes = (cell: string): string =>
      cell
        .replace(/Germany|France|Russia|Ottomans|AU|UK/g, (name) => CELL_CODE[name] ?? name)
        .replace(/\*/g, "");
    const printed = new Map(
      rows.map((row) => [row[0].replace(/\*\*$/, "").replace("Italy/Italian Minor", "Italy/IT Minor"), row]),
    );
    // Engine choices are compared against the printed row's *prefix*: every
    // choice the engine carries must equal the printed cell in that column.
    // A trailing printed column the engine has no choice for is collected and
    // asserted separately (see `printedOnly`), never silently dropped.
    const printedOnly = new Map<string, string[]>();
    for (const row of NON_PLAYER_ALLIANCE_TABLE) {
      const cells = printed.get(row.nation);
      expect(cells).toBeDefined();
      const printedChoices = cells!.slice(1);
      const lastEngineChoice = row.choices.reduce((last, choice, index) => (choice === null ? last : index), -1);
      for (let column = 0; column <= lastEngineChoice; column += 1) {
        const choice = row.choices[column];
        const cell = printedChoices[column];
        if (choice === null) {
          expect(cell).toBe("-");
          continue;
        }
        expect(codes(cell).split("/")).toEqual([...choice.candidates]);
        // A roll-off cell is marked with the printed `*`.
        expect(cell.endsWith("*")).toBe(choice.rollOff);
      }
      const extra = printedChoices.slice(lastEngineChoice + 1).filter((cell) => cell !== "-");
      if (extra.length > 0) printedOnly.set(row.nation, extra);
    }
    // Every engine choice now has a printed cell: the March 2026 errata's
    // Austria cell is the chart's Denmark 3rd Choice, so nothing is
    // printed-only.  The errata note still names the sheet's "Germany" misprint.
    expect([...printedOnly.entries()]).toEqual([]);
    const errata = stringsOf(chartTextById("war-aims-minors")!)
      .find((entry) => entry.en.includes("Denmark's 3rd choice"));
    expect(errata).toBeDefined();
    expect(errata!.zh).toContain("奥匈");    // The printed order is the sheet's: Qing China precedes Japan.
    expect(rows.map((row) => row[0]).indexOf("Qing China"))
      .toBeLessThan(rows.map((row) => row[0]).indexOf("Japan"));
  });
});

describe("the text view", () => {
  const render = (chart: ChartText, locale: Locale): string =>
    renderToStaticMarkup(<ChartTextView chart={chart} locale={locale}/>);

  test("renders the chart id, one section per printed panel, and the rule numbers", () => {
    const chart = chartTextById("combat-crt")!;
    const html = render(chart, "zh_CN");
    expect(html).toContain('data-chart-text="combat-crt"');
    for (let index = 0; index < chart.sections.length; index += 1) {
      expect(html).toContain(`data-testid="ie-chart-text-combat-crt-${index}"`);
    }
    expect(html).toContain("[18.4]");
    expect(html).toContain("[18.2]");
  });

  test("prints the Chinese text in zh_CN and the English text in en", () => {
    const chart = chartTextById("crisis")!;
    const zh = textOf(render(chart, "zh_CN"));
    const en = textOf(render(chart, "en"));
    expect(zh).toContain("危机表");
    expect(zh).toContain("国际会议");
    expect(zh).not.toContain("International Conference");
    expect(en).toContain("Crisis Track");
    expect(en).toContain("International Conference");
    expect(en).not.toContain("危机表");
  });

  test("renders every chart in both languages without an error", () => {
    for (const chart of CHART_TEXTS) {
      for (const locale of ["en", "zh_CN"] as const) {
        const html = render(chart, locale);
        expect(html).toContain(`data-chart-text="${chart.id}"`);
        expect(html).not.toContain("undefined");
      }
    }
  });

  test("carries the language it rendered as, for the document root", () => {
    const html = render(chartTextById("italy-legend")!, "zh_CN");
    // `index.html` hardcodes `<html lang="en">`, so the region declares its own.
    expect(html).toContain('lang="zh_CN"');
  });
});

describe("the lightbox's default view", () => {
  test("a zh_CN reader opens a transcribed chart as text", () => {
    const chart = CHARTS.find((entry) => entry.id === "crisis")!;
    expect(initialChartMode(chart, "zh_CN")).toBe("text");
  });

  test("an English reader opens the printed sheet", () => {
    const chart = CHARTS.find((entry) => entry.id === "crisis")!;
    expect(initialChartMode(chart, "en")).toBe("print");
  });

  test("a player display has no text view, so it always opens as art", () => {
    expect(initialChartMode(playerDisplayChart("GE", "zh_CN"), "zh_CN")).toBe("print");
  });
});
