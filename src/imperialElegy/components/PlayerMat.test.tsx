import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";

import {PlayerMat, stabilityNote, trackRanges} from "./PlayerMat";
import {ImperialElegyState, Power} from "../types";
import {setupImperialElegy} from "../engine/setup";
import {ieT} from "./i18n";
import {POWER_DEFS} from "../constant/powers";
import {cardsToDraw} from "../engine/rules";
import {reserveAllowance} from "../engine/economy";

const testCtx = {
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => {}, setPhase: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "prep",
} as unknown as Ctx;

const game = (): ImperialElegyState => setupImperialElegy(testCtx);

const render = (G: ImperialElegyState, viewer: Power | null = "GE"): string =>
  renderToStaticMarkup(
    <PlayerMat
      G={G}
      viewer={viewer}
      me={viewer === null ? null : G.powers[viewer]}
      active="GE"
      locale="zh_CN"
      t={ieT()}
    />,
  );

test("the mat prints the player display's numbers and slots", () => {
  const G = game();
  const me = G.powers.GE;
  const html = render(G);

  expect(html).toContain('data-testid="ie-mat"');
  expect(html).toContain('data-power="GE"');
  expect(html).toContain('data-active="true"');
  // The compact figures the printed display leads with.
  expect(html).toContain('data-testid="ie-mat-stability"');
  expect(html).toContain('data-testid="ie-mat-manpower"');
  expect(html).toContain('data-testid="ie-mat-industry"');
  expect(html).toContain('data-testid="ie-mat-keys"');
  expect(html).toContain('data-testid="ie-mat-colonial"');
  expect(html).toContain(`>${me.stability}<`);
  expect(html).toContain(`>${me.industry}<`);
  // Reserves, the Industry Card slot and the CP chain are actual slots.
  expect(html).toContain(`data-testid="ie-mat-reserves"`);
  expect(html).toContain('data-testid="ie-mat-industry-card"');
  expect(html).toContain('data-testid="ie-mat-cp-chain"');
  expect(html).toContain("0/2");
  // The printed display is one click away.
  expect(html).toContain('data-testid="ie-mat-display"');
  expect(html).toContain("印刷面板");
});

test("the reserve limit is the engine's Reserve Armies holding box", () => {
  const G = game();
  const html = render(G);
  // 7.3: the lower of manpower or industry, not the industry level alone.
  expect(html).toContain(`${G.powers.GE.reserves.length}<small>/${reserveAllowance(G, "GE")}</small>`);
  expect(html).toContain("人力与工业中较低者");
});

test("the chip row and the popover carry the same figures as the grid", () => {
  const html = render(game());
  expect(html).toContain('data-testid="ie-mat-chips"');
  expect(html).toContain('data-testid="ie-mat-figures"');
  expect(html).toContain('data-testid="ie-mat-popover"');
  const chips = (html.match(/class="ie-chip"/g) ?? []).length;
  const figures = (html.match(/class="ie-mat-figure"/g) ?? []).length;
  expect(chips).toBeGreaterThanOrEqual(6);
  expect(figures).toBeGreaterThanOrEqual(6);
});

test("the Austrian mat prints the eight nationalities with rights and citizenship", () => {
  const G = game();
  G.powers.AU.rights = ["Italians"];
  G.powers.AU.citizenship = ["Italians"];
  const html = render(G, "AU");
  expect(html).toContain('data-testid="ie-mat-au-nationalities"');
  // 33.4.1 prints Italians with both states; Czechs have neither.
  expect(html).toContain('data-nationality="Italians" data-state="citizen"');
  expect(html).toContain('data-nationality="Czechs" data-state="none"');
  // The state is spelled out in the UI language, not left in the log only.
  expect(html).toContain("意大利");
  expect(html).toContain("完整公民权");
  expect(html).toContain("权利");
  // Another power's display has no such table.
  expect(render(G, "GE")).not.toContain('data-testid="ie-mat-au-nationalities"');
});

test("no mat is rendered for a spectator", () => {
  expect(render(game(), null)).toBe("");
});

test("each mat string is Chinese in the zh_CN UI", () => {
  const html = render(game());
  // `ieT("zh_CN").stability` is 稳定, not the longer 稳定度.
  for (const text of ["稳定", "人力", "工业", "预备军", "工业牌", "CP 链", "印刷面板"]) {
    expect(html).toContain(text);
  }
  // The figures print the label in its own element, not just somewhere in the markup.
  for (const label of ["稳定", "人力", "工业", "预备军"]) {
    expect(html).toContain(`<span class="ie-mat-figure-label">${label}</span>`);
  }
});

// ---------------------------------------------------------------------------
// The printed display: every track box and every value under it.
// ---------------------------------------------------------------------------

/** The boxes of one track, read back from the markup as their printed labels. */
const boxesOf = (html: string, testId: string): string[] => {
  const block = html.split(`data-testid="${testId}"`)[1] ?? "";
  const body = block.split("</div>")[0];
  const found = [...body.matchAll(/class="ie-mat-track-box" data-index="\d+" data-current="(?:true|false)" title="[^"]*"><b>([^<]+)<\/b>/g)];
  return found.map((match) => match[1]);
};

test("the industry track prints one box per level, with the cards under it", () => {
  const G = game();
  const geo = POWER_DEFS.GE;
  const html = render(G);

  // GE is the only display with an Industry box 7.
  expect(boxesOf(html, "ie-mat-industry-boxes")).toEqual(geo.industryCards.map((_, i) => String(i)));

  // "3 cards / 4 cards / 5 cards" — the printed card counts, banded.
  expect(html).toContain('data-testid="ie-mat-industry-ranges"');
  for (const cards of new Set(geo.industryCards)) {
    expect(html).toContain(`${cards} 张卡`);
  }
  // 0-2 grants 3 cards on the German display.
  expect(html).toContain("0–2: 3 张卡");
  expect(html).toContain("3–5: 4 张卡");
});

test("the industry hint prints the End Phase industrialization target", () => {
  const html = render(game());
  // "End Phase: a roll ≥ 5 successfully industrializes".
  expect(html).toContain('data-testid="ie-mat-industry-hint"');
  expect(html).toContain("结束阶段：骰＋CP≥5");
});

test("the stability track prints the VP, BM and card of each box", () => {
  const G = game();
  const html = render(G);
  const stability = boxesOf(html, "ie-mat-stability-boxes");
  expect(stability).toEqual(POWER_DEFS.GE.stability.map((_, i) => String(i)));
  // The 0 box prints "-2 VP · -2 BM · 1 card"; the 6 box prints "+1 card".
  const zero = stabilityNote(POWER_DEFS.GE.stability[0], (n, signed) => `${signed && n > 0 ? "+" : ""}${n} card${Math.abs(n) === 1 ? "" : "s"}`);
  expect(zero).toBe("-2 VP · -2 BM · 1 card");
  const six = stabilityNote(POWER_DEFS.GE.stability[6], (n, signed) => `${signed && n > 0 ? "+" : ""}${n} card${Math.abs(n) === 1 ? "" : "s"}`);
  expect(six).toBe("+1 card");
  // The mat prints the current box's effect in words.
  expect(html).toContain('data-testid="ie-mat-stability-effect"');
  expect(html).toContain("当前 3");
});

test("the key track prints an MP under each box and stops at AUTO VICTORY", () => {
  const G = game();
  const html = render(G);
  const keys = boxesOf(html, "ie-mat-keys-boxes");
  // GE prints boxes 0-14 plus the AUTO VICTORY box 15.
  expect(keys).toHaveLength(POWER_DEFS.GE.keyManpower.length + 1);
  expect(keys[keys.length - 1]).toBe("15");
  // The manpower ladder is grouped the way the display prints it.
  expect(trackRanges(POWER_DEFS.GE.keyManpower)).toEqual([
    {from: 0, to: 2, value: 1},
    {from: 3, to: 5, value: 2},
    {from: 6, to: 8, value: 3},
    {from: 9, to: 11, value: 4},
    {from: 12, to: 14, value: 5},
  ]);
  expect(html).toContain("0–2: MP 1");
  expect(html).toContain("MP＝人力");
  expect(html).toContain("自动胜利 15");
});

test("the UK prints its Colonial Keys track with the open-ended 17+ box", () => {
  const G = game();
  const html = render(G, "UK");
  expect(html).toContain('data-testid="ie-mat-colonial"');
  const colonial = boxesOf(html, "ie-mat-secondary-boxes");
  // 18 printed boxes, the last one "17+".
  expect(colonial).toHaveLength(POWER_DEFS.UK.secondaryKeyManpower!.length);
  expect(colonial[colonial.length - 1]).toBe("17+");
  // The colonial MP ladder is printed as MP values, not cards.
  expect(html).toContain('data-testid="ie-mat-secondary-ranges"');
  expect(html).toContain("MP 4");
  // The UK's holding box refuses reserves outright.
  expect(html).toContain("职业陆军：不能持有预备军");
});

test("the Ottomans print Arab keys with AMP, and the industrialize target of 6", () => {
  const html = render(game(), "OT");
  expect(html).toContain('data-testid="ie-mat-arab-keys"');
  const arab = boxesOf(html, "ie-mat-secondary-boxes");
  expect(arab).toEqual(POWER_DEFS.OT.secondaryKeyManpower!.map((_, i) => String(i)));
  expect(html).toContain("AMP 2");
  // 33.6 Europeanization: the Ottomans need a 6, not a 5.
  expect(html).toContain("结束阶段：骰＋CP≥6");
});

test("the draw figure is the engine's 10.2 count, not the industry column", () => {
  const G = game();
  const html = render(G);
  const draw = cardsToDraw(G, "GE");
  expect(html).toContain('data-testid="ie-mat-draw"');
  expect(html).toContain(`>${draw}<small> 张卡</small>`);
  // The data chip line carries it too, so a collapsed mat still reads it.
  expect(html).toContain(`抽牌 ${draw}`);
});

test("the national characteristics are folded under the tracks", () => {
  const html = render(game());
  expect(html).toContain('data-testid="ie-mat-characteristics"');
  // GE's first characteristic, in the zh_CN UI.
  expect(html).toContain("运动战");
});

test("a blockade caps the industry track at the current maximum", () => {
  const G = game();
  G.powers.GE.maxIndustry = 4;
  const html = render(G);
  // The printed maximum is 7; the blockade ceiling stops the track at 4.
  expect(boxesOf(html, "ie-mat-industry-boxes")).toEqual(["0", "1", "2", "3", "4"]);
  expect(html).toContain("工业 1");
});

test("only the displays that print a secondary manpower track show one", () => {
  // `ensureStateDefaults` fills `secondaryManpower`/`arabKeys` on every power,
  // but only the UK and OT displays print those ladders.  A German mat must not
  // claim "2/0" or offer an Arab-keys chip.
  const G = game();
  const german = render(G, "GE");
  expect(german).not.toContain("人力 <b>2/0</b>");
  expect(german).toContain("人力 <b>2</b>");
  expect(german).not.toContain("阿拉伯关键区");
  expect(german).toContain(`<b>${G.powers.GE.manpower}</b>`);

  const british = render(G, "UK");
  expect(british).toContain("人力 <b>3/1</b>");
  expect(british).toContain("殖民地关键区 <b>7</b>");

  const ottoman = render(G, "OT");
  expect(ottoman).toContain("人力 <b>3/1</b>");
  expect(ottoman).toContain("阿拉伯关键区 <b>5</b>");
});
