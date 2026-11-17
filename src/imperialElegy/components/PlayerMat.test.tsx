import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";

import {PlayerMat} from "./PlayerMat";
import {ImperialElegyState} from "../types";
import {setupImperialElegy} from "../engine/setup";
import {ieT} from "./i18n";

const testCtx = {
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => {}, setPhase: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "prep",
} as unknown as Ctx;

const game = (): ImperialElegyState => setupImperialElegy(testCtx);

const render = (G: ImperialElegyState, viewer: "GE" | null = "GE"): string =>
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
  expect(html).toContain(`${me.reserves.length}<small>/${me.industry}</small>`);
  expect(html).toContain('data-testid="ie-mat-industry-card"');
  expect(html).toContain('data-testid="ie-mat-cp-chain"');
  expect(html).toContain("0/2");
  // The printed display is one click away.
  expect(html).toContain('data-testid="ie-mat-display"');
  expect(html).toContain("印刷面板");
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
