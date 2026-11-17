/**
 * The MPIT matrix is the control.
 *
 * It replaced two `<select>`s (target power, track) plus a "place" button with
 * one button per power/track value, so a placement is a single click on the
 * number that will change.  Jest here is the static-markup environment (no
 * jsdom), so these tests pin what Playwright and a screen reader receive: the
 * dropdowns are gone, all 18 buttons carry the full action name, and a
 * spectator gets the same numbers as read-only text.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";

// The theme module imports the stylesheet, which the node test environment
// cannot parse; the matrix's structure is what is under test, not its paint.
jest.mock("./theme", () => {
  const React = require("react");
  return {
    IEPanel: ({title, children, actions}: any) => React.createElement("section", null, React.createElement("h3", null, title), actions, children),
    IEBadge: ({children}: any) => React.createElement("span", null, children),
  };
});

import {MpitPanel} from "./MpitPanel";
import {setupImperialElegy} from "../engine/setup";
import {ieStringsFor} from "./i18n";
import {ImperialElegyState, Power} from "../types";

const testCtx = {
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => {}, setPhase: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "action",
} as unknown as Ctx;

const freshGame = (): ImperialElegyState => setupImperialElegy(testCtx);

const render = (over: Partial<React.ComponentProps<typeof MpitPanel>> = {}): string => {
  const G = over.G ?? freshGame();
  return renderToStaticMarkup(
    <MpitPanel
      G={G}
      canAct
      viewer={"GE" as Power}
      me={G.powers.GE}
      cpBudget={() => 3}
      canSpend={() => true}
      locale="zh_CN"
      t={ieStringsFor("zh_CN")}
      doAction={() => undefined}
      moves={{}}
      {...over}
    />,
  );
};

const buttons = (html: string): string[] => html.match(/<button[^>]*>/g) ?? [];

test("the target and track dropdowns are gone", () => {
  const html = render();
  expect(html).not.toContain("<select");
  expect(html).not.toContain("ie-select");
});

test("every power/track value is its own placement button", () => {
  const html = render();
  expect(html.match(/data-testid="ie-mpit-place-/g) ?? []).toHaveLength(18);
  for (const power of ["GE", "UK", "FR", "AU", "RU", "OT"]) {
    for (const track of ["te", "ta", "neutral"]) {
      expect(html).toContain(`data-testid="ie-mpit-place-${power}-${track}"`);
    }
  }
  // The visible label stays terse (track + count); the accessible name is the
  // full action, so 18 similar buttons are still distinguishable by voice.
  expect(html).toContain('aria-label="放置大国影响力（1 CP） · 德国 TE"');
  expect(html).toContain('aria-label="放置大国影响力（1 CP） · 德国 中立"');
  expect(html).toContain('title="放置大国影响力（1 CP） · 德国 TA"');
});

test("no affordable CP disables every placement button", () => {
  const html = render({canSpend: () => false, cpBudget: () => 0});
  const tags = buttons(html);
  expect(tags).toHaveLength(18);
  for (const tag of tags) expect(tag).toContain("disabled");
});

test("the acting seat gets the controls and a one-line hint, not a form", () => {
  const html = render();
  expect(html).toContain('data-testid="ie-mpit-controls"');
  expect(html).toContain("点按轨道数字");
  expect(html).toContain("CP: 3");
});

test("a spectator sees the same matrix as read-only text", () => {
  const G = freshGame();
  const html = render({G, canAct: false, viewer: null, me: null, canSpend: () => false});
  expect(html).toContain('data-testid="ie-mpit"');
  expect(html).not.toContain('data-testid="ie-mpit-controls"');
  expect(html).not.toContain("ie-mpit-place-");
  expect(buttons(html)).toHaveLength(0);
  expect(html.match(/class="ie-mpit-cell/g) ?? []).toHaveLength(6);
  expect(html).toContain("仅在你的行动轮可用。");
});

test("with the confirm preference off a placement still gets the plain button contract", () => {
  const html = render({confirmActions: false});
  expect(buttons(html)).toHaveLength(18);
  for (const tag of buttons(html)) {
    expect(tag).toContain('type="button"');
    expect(tag).toContain('data-armed="false"');
    expect(tag).not.toContain("aria-live");
  }
});
