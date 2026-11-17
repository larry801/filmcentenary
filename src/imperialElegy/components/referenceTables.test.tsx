/**
 * ReferenceTables — the inline tables, rendered from the engine's own data.
 *
 * The drawer promises that what it prints can never drift from the rules, so
 * these tests render the real component with a real `setupImperialElegy` game
 * and read the markup back: the CRT has one row per printed differential and
 * the `crt()` values, the cost list is `ACTION_COSTS` in the player aid's
 * order, and the sequence of play is `phaseSteps` — not a second copy of it.
 *
 * Jest runs in the `node` environment (no jsdom, no testing-library), so this
 * is `renderToStaticMarkup`: a static, deterministic reading of the component's
 * contract.  The slice is built through `sliceModel`, the same function the
 * board model uses, so the props are exactly the ones the drawer passes.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";

// The node test environment cannot parse the stylesheet import (see
// `theme.test.tsx`); the panel itself is the real one.
jest.mock("./imperial-elegy.css", () => ({}));

import {CRT_ROWS, ReferenceTables} from "./referenceTables";
import {crt} from "../engine/combat";
import {setupImperialElegy} from "../engine/setup";
import type {ImperialElegyState} from "../types";
import {ieStringsFor} from "./i18n";
import {phaseSteps} from "./phaseSteps";
import {ACTION_COSTS, ACTION_COST_ORDER, actionCostLabel} from "./actionAvailability";
import {sliceModel, type ModelValues, type ReferenceSlice} from "./boardSlices";

type Locale = "en" | "zh_CN";
type ActionId = (typeof ACTION_COST_ORDER)[number];

const game = (): ImperialElegyState =>
  setupImperialElegy({
    random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
    events: {setActivePlayers: () => {}, setPhase: () => {}, endGame: () => {}, endTurn: () => {}},
    turn: 1,
    phase: "prep",
  } as unknown as Parameters<typeof setupImperialElegy>[0]);

/**
 * A reference slice for `G`, built the way the board builds it (through
 * `sliceModel`) but with only the members the reference drawer reads.  The bag
 * is cast because the hook assembles it at run time, exactly as `sliceModel`
 * documents.
 */
const referenceSlice = (
  G: ImperialElegyState,
  locale: Locale,
  over: Partial<ReferenceSlice> = {},
): ReferenceSlice => {
  const values = {
    G,
    t: ieStringsFor(locale),
    locale,
    actualLocale: locale,
    viewer: "GE",
    me: G.powers.GE,
    active: "GE",
    war: G.war,
    gw: G.gw,
    pending: null,
    handCounts: {},
    goalCounts: {},
    minorMarkerRows: [],
    homeCardTitle: (id: string) => id,
    cpBudget: () => 0,
    canAct: false,
    canSpend: () => false,
    doAction: () => undefined,
    moves: {},
    trayOpen: false,
    ...over,
  };
  return sliceModel(values as unknown as ModelValues).reference;
};

const renderTables = (
  G: ImperialElegyState,
  locale: Locale = "zh_CN",
  over: Partial<ReferenceSlice> = {},
  anchor: string | null = null,
): string =>
  renderToStaticMarkup(<ReferenceTables {...referenceSlice(G, locale, over)} anchor={anchor} />);

/** The markup from a section's `data-testid` up to the next `<section>`. */
const sectionOf = (html: string, testId: string): string => {
  const at = html.indexOf(`data-testid="${testId}"`);
  expect(at).toBeGreaterThanOrEqual(0);
  const next = html.indexOf("<section", at);
  return html.slice(at, next === -1 ? html.length : next);
};

/** One element, located by its `data-testid`. */
const elementOf = (html: string, testId: string, tag = "tr"): string => {
  const match = html.match(new RegExp(`<${tag}[^>]*data-testid="${testId}"[^>]*>[\\s\\S]*?</${tag}>`));
  expect(match).not.toBeNull();
  return match![0];
};

/** The visible text of a markup fragment, with tags stripped. */
const textOf = (markup: string): string => markup.replace(/<[^>]*>/g, "").trim();

describe("the combat results table", () => {
  test("has one row per printed differential and no others", () => {
    const html = renderTables(game());
    const crtSection = sectionOf(html, "ie-ref-crt");

    const rowIds = [...crtSection.matchAll(/data-testid="ie-crt-row-(-?\d+)"/g)].map((m) => Number(m[1]));
    expect(rowIds).toEqual([...CRT_ROWS]);
    // The table is exactly the printed range: no +5, no -5.
    expect(crtSection).not.toContain("ie-crt-row-5");
    expect(crtSection).not.toContain("ie-crt-row--5");

    // The headers name the columns the rules add up.
    for (const heading of ["骰值±差值", "攻方损失", "守方损失", "胜利方"]) {
      expect(crtSection).toContain(heading);
    }
  });

  test("each row prints the row label and the crt() result", () => {
    const html = renderTables(game());
    const crtSection = sectionOf(html, "ie-ref-crt");

    for (const differential of CRT_ROWS) {
      const result = crt(differential);
      const row = elementOf(crtSection, `ie-crt-row-${differential}`);
      const label = differential >= 4 ? "4+" : String(differential);

      expect(row).toContain(`<th scope="row">${label}</th>`);
      expect(row).toContain(`<td>${result.attackerLosses}</td>`);
      expect(row).toContain(`<td>${result.defenderLosses}</td>`);
      const victor = result.victor === "attacker" ? "攻方" : "守方";
      const stars = `${result.decisive ? " · ★" : ""}${result.doubleStar ? " · ★★" : ""}`;
      expect(textOf(row)).toContain(`${victor}${stars}`);
    }
  });

  test("shows the extremes the printed CRT is known for", () => {
    const crtSection = sectionOf(renderTables(game()), "ie-ref-crt");

    // 4+: attacker wins without a loss, decisively.
    const best = elementOf(crtSection, "ie-crt-row-4");
    expect(best).toContain('<th scope="row">4+</th>');
    expect(best).toContain("<td>0</td><td>2</td>");
    expect(textOf(best)).toContain("攻方 · ★");

    // -4: the attacker is wiped out and the defender wins decisively.
    const worst = elementOf(crtSection, "ie-crt-row--4");
    expect(worst).toContain('<th scope="row">-4</th>');
    expect(worst).toContain("<td>2</td><td>0</td>");
    expect(textOf(worst)).toContain("守方 · ★");

    // 0: one loss each, but the attacker holds the field — white peace.
    const even = elementOf(crtSection, "ie-crt-row-0");
    expect(even).toContain("<td>1</td><td>1</td>");
    expect(textOf(even)).toContain("攻方 · ★★");
  });

  test("prints the English column names in the en UI", () => {
    const crtSection = sectionOf(renderTables(game(), "en"), "ie-ref-crt");
    expect(crtSection).toContain("Attacker losses");
    expect(crtSection).toContain("Defender losses");
    expect(crtSection).toContain("Attacker · ★");
  });
});

describe("the action costs", () => {
  test("lists every fixed-cost action, in the player aid's order, at ACTION_COSTS", () => {
    const costs = sectionOf(renderTables(game()), "ie-ref-costs");

    // The rendered CP values, in order, are the table's values in order.
    const shown = [...costs.matchAll(/<b class="ie-ref-cost">(\d+) CP<\/b>/g)].map((m) => Number(m[1]));
    expect(shown).toEqual(ACTION_COST_ORDER.map((id) => ACTION_COSTS[id]));

    const ids = [...costs.matchAll(/data-testid="ie-ref-cost-([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual([...ACTION_COST_ORDER]);
  });

  test("each row carries the localized label and its CP", () => {
    const costs = sectionOf(renderTables(game()), "ie-ref-costs");

    for (const id of ACTION_COST_ORDER) {
      const row = elementOf(costs, `ie-ref-cost-${id}`, "li");
      expect(row).toContain(`ie-ref-cost-label">${actionCostLabel(id, "zh_CN")}<`);
      expect(row).toContain(`${ACTION_COSTS[id]} CP`);
    }
  });

  test("prints the distinctive costs the player aid is remembered for", () => {
    const costs = sectionOf(renderTables(game()), "ie-ref-costs");
    const cpOf = (id: ActionId): string => textOf(elementOf(costs, `ie-ref-cost-${id}`, "li"));

    expect(cpOf("buildDreadnought")).toBe("建造无畏舰3 CP");
    expect(cpOf("breakAlliance")).toBe("解除小国联盟4 CP");
    expect(cpOf("rapidDeploy")).toContain("0 CP");
    expect(ACTION_COSTS.buildDreadnought).toBe(3);
    expect(ACTION_COSTS.breakAlliance).toBe(4);
    expect(ACTION_COSTS.rapidDeploy).toBe(0);
  });

  test("uses the English labels in the en UI", () => {
    const costs = sectionOf(renderTables(game(), "en"), "ie-ref-costs");
    expect(costs).toContain(actionCostLabel("buildDreadnought", "en"));
    expect(costs).toContain("Build dreadnought");
  });
});

describe("the sequence of play", () => {
  const keysIn = (sequence: string): string[] =>
    [...sequence.matchAll(/data-testid="ie-ref-step-([^"]+)"/g)].map((m) => m[1]);

  test("follows phaseSteps for the campaign turn", () => {
    const G = game();
    const expected = phaseSteps({phase: G.phase, war: G.war, gw: G.gw, endPhase: G.endPhase});
    const sequence = sectionOf(renderTables(G), "ie-ref-sequence");

    expect(keysIn(sequence)).toEqual(expected.map((step) => step.key));
    // The campaign turn is the printed four-step ladder, not a copied literal.
    expect(keysIn(sequence)).toEqual(["prep", "diplomacy", "action", "end"]);
  });

  test("prints the localized title and rule number of each step, current flagged once", () => {
    const G = game();
    const expected = phaseSteps({phase: G.phase, war: G.war, gw: G.gw, endPhase: G.endPhase});
    const sequence = sectionOf(renderTables(G), "ie-ref-sequence");

    for (const step of expected) {
      const item = elementOf(sequence, `ie-ref-step-${step.key}`, "li");
      expect(textOf(item).startsWith(step.titleZh)).toBe(true);
      if (step.rule !== undefined) expect(textOf(item)).toContain(step.rule);
      expect(item).toContain(`data-current="${step.current ? "true" : "false"}"`);
    }

    const currentCount = [...sequence.matchAll(/data-current="true"/g)].length;
    expect(currentCount).toBe(expected.filter((step) => step.current).length);
    expect(currentCount).toBe(1);
    expect(elementOf(sequence, "ie-ref-step-prep", "li")).toContain('data-current="true"');
  });

  test("a war replaces the Action step with the WAR_STEPS ladder, from phaseSteps", () => {
    const G: ImperialElegyState = {...game(), phase: "wartime"};
    const war = {status: "maneuver"} as unknown as ReferenceSlice["war"];
    const expected = phaseSteps({phase: G.phase, war, gw: G.gw, endPhase: G.endPhase});
    const sequence = sectionOf(renderTables(G, "zh_CN", {war}), "ie-ref-sequence");

    expect(keysIn(sequence)).toEqual(expected.map((step) => step.key));
    expect(keysIn(sequence)).toEqual([
      "prep", "diplomacy",
      "war:warAim", "war:alliance", "war:shift", "war:initiative",
      "war:maneuver", "war:victory", "war:demobilization",
    ]);
    expect(sequence).not.toContain('data-testid="ie-ref-step-action"');
    // Only the war's current rung is marked.
    expect(elementOf(sequence, "ie-ref-step-war:maneuver", "li")).toContain('data-current="true"');
    expect([...sequence.matchAll(/data-current="true"/g)].length).toBe(1);
  });

  test("uses the English titles in the en UI", () => {
    const sequence = sectionOf(renderTables(game(), "en"), "ie-ref-sequence");
    expect(textOf(elementOf(sequence, "ie-ref-step-diplomacy", "li"))).toBe("Diplomacy · 6.1");
    expect(textOf(elementOf(sequence, "ie-ref-step-prep", "li"))).toBe("Prep · 5.1");
  });
});

describe("the headings", () => {
  const headingOf = (html: string, testId: string): string => {
    const match = sectionOf(html, testId).match(/<h3>([\s\S]*?)<\/h3>/);
    expect(match).not.toBeNull();
    return textOf(match![1]);
  };

  test("are Chinese in zh_CN", () => {
    const html = renderTables(game(), "zh_CN");
    expect(headingOf(html, "ie-ref-crt")).toBe("战斗结果表");
    expect(headingOf(html, "ie-ref-costs")).toBe("行动花费");
    expect(headingOf(html, "ie-ref-sequence")).toBe("游戏流程");
    expect(headingOf(html, "ie-ref-charts")).toBe(ieStringsFor("zh_CN").charts);
    expect(headingOf(html, "ie-ref-log")).toBe(ieStringsFor("zh_CN").log);
    // Spelled out, so a missing translation shows up as the English string.
    for (const heading of ["战斗结果表", "行动花费", "游戏流程"]) expect(html).toContain(heading);
  });

  test("are English in the en UI", () => {
    const html = renderTables(game(), "en");
    expect(headingOf(html, "ie-ref-crt")).toBe("Combat Results Table");
    expect(headingOf(html, "ie-ref-costs")).toBe("Action costs");
    expect(headingOf(html, "ie-ref-sequence")).toBe("Sequence of play");
  });

  test("never print a raw template placeholder", () => {
    // The doubled brace is the tell for an interpolation token that reached
    // the page unrendered; the tables must hand the reader finished text.
    for (const locale of ["zh_CN", "en"] as const) {
      const html = renderTables(game(), locale);
      expect(html).not.toContain("{{");
      expect(html).not.toMatch(/\{\{\s*[A-Za-z0-9_$.-]+\s*\}\}/);
      for (const testId of ["ie-ref-crt", "ie-ref-costs", "ie-ref-sequence", "ie-ref-charts", "ie-ref-log"]) {
        const heading = headingOf(html, testId);
        expect(heading).not.toContain("{{");
        expect(heading).not.toContain("undefined");
        expect(heading).not.toContain("NaN");
      }
    }
  });
});

describe("the panel as a whole", () => {
  test("renders every section from one slice, deterministically", () => {
    const html = renderTables(game());
    expect(html).toBe(renderTables(game()));
    for (const testId of [
      "ie-ref-crt", "ie-ref-costs", "ie-ref-sequence", "ie-ref-charts", "ie-ref-log",
    ]) {
      expect(html).toContain(`data-testid="${testId}"`);
    }
  });

  test("highlights the section an anchor names, and only that one", () => {
    expect(renderTables(game(), "zh_CN")).not.toContain('data-highlighted="true"');

    const anchored = renderTables(game(), "zh_CN", {}, "costs");
    expect(anchored).toContain('data-highlighted="true"');
    expect([...anchored.matchAll(/data-highlighted="true"/g)].length).toBe(1);
    expect(sectionOf(anchored, "ie-ref-costs")).toContain('data-highlighted="true"');
    expect(sectionOf(anchored, "ie-ref-crt")).toContain('data-highlighted="false"');
  });
});
