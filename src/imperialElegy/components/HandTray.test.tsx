import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";

jest.mock("./theme", () => {
  const React = require("react");
  return {
    IEBadge: ({children}: any) => React.createElement("span", null, children),
    IEChip: ({children}: any) => React.createElement("span", null, children),
  };
});

/**
 * The live preference is only observable on `ConfirmButton`'s `confirm` prop:
 * a server render never clicks, so `data-armed` is `"false"` either way.  The
 * mock keeps the real button (its markup contract is asserted below) and
 * mirrors `confirm` into an attribute, so the tray's wiring is assertable.
 */
jest.mock("./ConfirmButton", () => {
  const React = require("react");
  const actual = jest.requireActual("./ConfirmButton");
  return {
    ...actual,
    ConfirmButton: (props: any) => React.createElement(actual.ConfirmButton, {
      ...props,
      "data-confirm": String(props.confirm),
    }),
  };
});

import {HandTray} from "./HandTray";
import {ImperialElegyState} from "../types";
import {setupImperialElegy} from "../engine/setup";
import {ieT} from "./i18n";

const testCtx = {
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => {}, setPhase: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "action",
} as unknown as Ctx;

const game = (): ImperialElegyState => {
  const G = setupImperialElegy(testCtx);
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  return G;
};

const props = (G: ImperialElegyState, open: boolean) => {
  const me = G.powers.GE;
  return {
    G, viewer: "GE" as const, me, locale: "zh_CN" as const, t: ieT(),
    phase: "action", isActive: true, eliminated: false, pending: null,
    canActionCard: true, isBelligerent: false, war: null, forcedCardIds: [],
    hand: me.hand, saveList: [], giveCards: [],
    giveTarget: "UK" as const, setGiveTarget: () => undefined,
    responseInHand: false, responseWindow: false, chainNonEmpty: false, chainSpendable: 0,
    chainCap: 4, chainReady: false, chainDisabledReason: undefined,
    cpBudget: () => 3, doAction: (fn: () => void) => fn(), moves: {},
    handChoicesHint: null, cardFaceMode: "svg" as const,
    open, onToggleOpen: () => undefined,
  };
};

test("the desktop tray defaults to its 220 px hand row and can fold to a header", () => {
  const open = renderToStaticMarkup(<HandTray {...props(game(), true)}/>);
  expect(open).toContain('data-testid="ie-hand-tray"');
  expect(open).toContain('data-open="true"');
  expect(open).toContain('class="ie-hand"');
  expect(open).toContain(".ie-card".slice(1)); // cards are present
  expect(open).toContain('data-testid="ie-tray-toggle"');
  expect(open).toContain('aria-expanded="true"');

  const folded = renderToStaticMarkup(<HandTray {...props(game(), false)}/>);
  expect(folded).toContain('data-open="false"');
  expect(folded).toContain('aria-expanded="false"');
  expect(folded).not.toContain('class="ie-hand"');
  // The heading stays so the spectator/heading contract and the seat label remain.
  expect(folded).toContain("手牌 · 德国");
});

test("a card row is its CP value and name, with its operations on the row", () => {
  const G = game();
  // A plain event card: a mandatory event deliberately has no CP control (its
  // CP play *is* its event), so it cannot stand in for "every operation".
  G.powers.GE.hand = ["IE-A029"];
  const id = "IE-A029";
  const html = renderToStaticMarkup(<HandTray {...props(G, true)}/>);
  const row = html.slice(html.lastIndexOf("<article", html.indexOf(`data-testid="ie-card-${id}"`)));
  const rowHtml = row.slice(0, row.indexOf("</article>"));

  expect(rowHtml).toContain(`data-testid="ie-card-cp-${id}"`);
  expect(rowHtml).toContain("ie-card-name");
  // The printed type glyph used to sit over the CP number; the row carries the
  // type as data for the suites, not as an icon.
  expect(rowHtml).not.toContain("ie-card-type");
  expect(rowHtml).toContain('data-card-type="');
  expect(rowHtml).toContain('data-expanded="false"');
  // The name is still a dialog opener, so the full face and the aggregated
  // reasons stay one click away.
  expect(rowHtml).toContain('aria-haspopup="dialog"');
  expect(rowHtml).not.toContain("aria-expanded");
  // The operations are printed on the row itself on a desktop (no phone mode
  // here): CP, event, industrialization, CP chain and Save are all in place.
  expect(rowHtml).toContain('data-row-actions="true"');
  expect(rowHtml).toContain(`data-testid="ie-card-row-actions-${id}"`);
  expect(rowHtml).toContain(`data-testid="ie-play-cp-${id}"`);
  expect(rowHtml).toContain(`data-testid="ie-play-event-${id}"`);
  expect(rowHtml).toContain(`data-testid="ie-industrialize-${id}"`);
  expect(rowHtml).toContain(`data-testid="ie-cp-chain-add-${id}"`);
  expect(rowHtml).toContain(`data-testid="ie-save-${id}"`);
  // The row is not an in-place disclosure: no face and no translation.
  expect(rowHtml).not.toContain(`data-testid="ie-card-face-${id}"`);
  expect(rowHtml).not.toContain("ie-card-face");
  expect(rowHtml).not.toContain("ie-card-translation");
});

test("a phone row keeps its operations in the inspector, not on the row", () => {
  const G = game();
  const id = G.powers.GE.hand[0];
  const html = renderToStaticMarkup(<HandTray {...props(G, true)} isPhone/>);
  const row = html.slice(html.lastIndexOf("<article", html.indexOf(`data-testid="ie-card-${id}"`)));
  const rowHtml = row.slice(0, row.indexOf("</article>"));

  expect(rowHtml).toContain('data-expanded="false"');
  expect(rowHtml).toContain('data-row-actions="false"');
  expect(rowHtml).toContain(`data-testid="ie-open-card-${id}"`);
  expect(rowHtml).not.toContain(`data-testid="ie-play-cp-${id}"`);
  expect(rowHtml).not.toContain(`data-testid="ie-industrialize-${id}"`);
  expect(rowHtml).not.toContain("ie-card-row-actions");
});

test("every card in the hand is listed and the tray has no sort control", () => {
  const G = game();
  const html = renderToStaticMarkup(<HandTray {...props(G, true)}/>);
  expect(html).not.toContain('data-testid="ie-hand-filter"');
  expect(html).not.toContain('data-testid="ie-hand-empty-filter"');
  for (const id of G.powers.GE.hand) expect(html).toContain(`data-testid="ie-card-${id}"`);
  // The sort select is gone: the hand is always printed order, and every row
  // carries its own operations instead of a re-ordering control.
  expect(html).not.toContain('data-testid="ie-hand-sort"');
  expect(html).not.toContain('data-testid="ie-hand-tools"');
});

test("cards are listed in the order they are held", () => {
  const G = game();
  G.powers.GE.hand = ["IE-A029", "IE-A104", "IE-A041"];
  const html = renderToStaticMarkup(<HandTray {...props(G, true)}/>);
  const positions = ["IE-A029", "IE-A104", "IE-A041"]
    .map((id) => html.indexOf(`data-testid="ie-card-${id}"`));
  expect(positions.every((at) => at >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
});

test("a home card is pinned to the front of the row, ahead of the rest of the hand", () => {
  const G = game();
  // A home card dealt into the middle of a long hand: the row must not push it
  // off the right edge, where a player would never find the card they are
  // required to keep.
  const home = G.powers.GE.homeCards[0];
  G.powers.GE.hand = ["IE-A029", "IE-A104", home, "IE-A041"];
  const html = renderToStaticMarkup(<HandTray {...props(G, true)}/>);
  const positions = [home, "IE-A029", "IE-A104", "IE-A041"]
    .map((id) => html.indexOf(`data-testid="ie-card-${id}"`));
  expect(positions.every((at) => at >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  // The row is the hand: every card is still drawn exactly once.
  expect(html.match(/data-testid="ie-card-IE-/g)?.length ?? 0).toBe(4);
});

test("a card that forbids passing is still one row; its event is on the row", () => {
  const G = game();
  const id = G.powers.GE.hand[0];
  const html = renderToStaticMarkup(<HandTray {...props(G, true)} forcedCardIds={[id]}/>);
  const row = html.slice(html.lastIndexOf("<article", html.indexOf(`data-testid="ie-card-${id}"`)));
  const rowHtml = row.slice(0, row.indexOf("</article>"));
  // Nothing unfolds in place: the buttons sit on the row and the reasons stay
  // one click away in the inspector.
  expect(rowHtml).toContain('data-expanded="false"');
  expect(rowHtml).toContain(`data-testid="ie-card-row-actions-${id}"`);
  expect(rowHtml).not.toContain(`data-testid="ie-card-face-${id}"`);
});

test("expandAll draws the operations inline for embeds and rules-level tests", () => {
  const G = game();
  const id = G.powers.GE.hand[0];
  const html = renderToStaticMarkup(<HandTray {...props(G, true)} expandAll/>);
  const row = html.slice(html.lastIndexOf("<article", html.indexOf(`data-testid="ie-card-${id}"`)));
  const rowHtml = row.slice(0, row.indexOf("</article>"));
  expect(rowHtml).toContain('data-expanded="true"');
  expect(rowHtml).toContain('class="ie-card-actions"');
  expect(rowHtml).toMatch(/data-testid="ie-play-(?:cp|event)-/);
  expect(rowHtml).toContain(`data-testid="ie-card-face-${id}"`);
});

test("a mandatory card's button says 打出强制事件, not 打出事件", () => {
  const G = game();
  // Give GE a mandatory event (A104 The Funeral of Edward VII, 2 CP) and no
  // ordinary card, so the unfolded row's event button is the one under test.
  G.powers.GE.hand = ["IE-A104"];
  const html = renderToStaticMarkup(<HandTray {...props(G, true)} expandAll/>);
  const eventButton = html.match(/<button[^>]*data-testid="ie-play-event-IE-A104"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
  expect(eventButton).not.toBe("");
  expect(eventButton).toContain("打出强制事件");
  expect(eventButton).not.toContain(">打出事件<");
});

test("a mandatory event is one control: 打出强制事件, with no CP alternative", () => {
  const G = game();
  G.powers.GE.hand = ["IE-A104"];
  const html = renderToStaticMarkup(<HandTray {...props(G, true)} expandAll/>);
  // 12.0: a mandatory event has no CP-only mode — its CP play resolves the
  // printed event — so the CP/event pair is a false choice on the card.
  expect(html).not.toContain('data-testid="ie-play-cp-IE-A104"');
  const eventButton = html.match(/<button[^>]*data-testid="ie-play-event-IE-A104"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
  expect(eventButton).not.toBe("");
  expect(eventButton).toContain(">打出强制事件<");
});

test("A105 keeps its CP control: its printed CP play does not trigger the event", () => {
  const G = game();
  G.powers.GE.hand = ["IE-A105"];
  const html = renderToStaticMarkup(<HandTray {...props(G, true)} expandAll/>);
  expect(html).toContain('data-testid="ie-play-cp-IE-A105"');
  const eventButton = html.match(/<button[^>]*data-testid="ie-play-event-IE-A105"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
  expect(eventButton).toContain(">打出强制响应<");
});

test("an ordinary card keeps the plain 打出事件 label", () => {
  const G = game();
  G.powers.GE.hand = ["IE-A029"];
  const html = renderToStaticMarkup(<HandTray {...props(G, true)} expandAll/>);
  const eventButton = html.match(/<button[^>]*data-testid="ie-play-event-IE-A029"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
  expect(eventButton).not.toBe("");
  expect(eventButton).toContain(">打出事件<");
  expect(eventButton).not.toContain("打出强制事件");
});

test("svg is the zero-image default and print mode uses the stored card scan", () => {
  const G = game();
  // The card face is what the inspector draws; drive it through `expandAll`
  // so it is present in a static render.
  const svg = renderToStaticMarkup(<HandTray {...props(G, true)} expandAll/>);
  expect(svg).toContain("<svg");
  expect(svg).not.toContain("img class=\"ie-card-face");

  const print = renderToStaticMarkup(<HandTray {...props(G, true)} cardFaceMode="print" expandAll/>);
  expect(print).toContain('img class="ie-card-face ie-card-print"');
  expect(print).toContain("/imperial-elegy/cards/");
});

test("card play is a two-step confirm: the armed state is data, never a modal", () => {
  const G = game();
  const open = renderToStaticMarkup(<HandTray {...props(G, true)} expandAll/>);
  // Every card-play control carries the confirm state, and starts disarmed.
  const cpButtons = open.match(/<button[^>]*data-testid="ie-play-cp-[^"]*"[^>]*>/g) ?? [];
  expect(cpButtons.length).toBeGreaterThan(0);
  for (const tag of cpButtons) {
    expect(tag).toContain('data-armed="false"');
    expect(tag).not.toContain("dialog");
  }
  // The tray itself is unchanged: no overlay element is inserted for the
  // confirmation, so the static-markup contract holds.
  expect(open).not.toContain("ie-confirm-dialog");
});

/** The opening tag of every CP/event card-play control, attribute order ignored. */
const playTags = (html: string): string[] =>
  html.match(/<button[^>]*data-testid="ie-play-(?:cp|event)-[^"]*"[^>]*>/g) ?? [];

/**
 * Run `render` with a fake `localStorage` holding `raw` for every key, so the
 * mount-time fallback can be exercised.  Jest runs in the `node` environment,
 * where `globalThis.localStorage` does not exist, so the descriptor is removed
 * again afterwards.
 */
const withStoredPreference = (raw: string, render: () => string): string => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {getItem: () => raw, setItem: () => undefined},
  });
  try {
    return render();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
};

/**
 * The Display menu's switch must reach the card buttons on the next render,
 * with no remount: the prop the board forwards is the live value, and it wins
 * over whatever `readConfirmActions()` saw when the tray mounted.
 */
test("the live confirmActions prop governs every card-play control", () => {
  const G = game();

  const on = playTags(renderToStaticMarkup(<HandTray {...props(G, true)} expandAll confirmActions/>));
  expect(on.length).toBeGreaterThan(0);
  for (const tag of on) {
    expect(tag).toContain('data-confirm="true"');
    expect(tag).toContain('data-armed="false"');
  }

  const offHtml = renderToStaticMarkup(<HandTray {...props(G, true)} expandAll confirmActions={false}/>);
  const off = playTags(offHtml);
  expect(off.length).toBe(on.length);
  for (const tag of off) {
    expect(tag).toContain('data-confirm="false"');
    expect(tag).toContain('data-armed="false"');
  }
  // Off is still a plain button, never an armed label or an overlay.
  expect(offHtml).not.toContain("Confirm:");
  expect(offHtml).not.toContain("ie-confirm-dialog");
});

test("the prop wins over the value stored at mount, in both directions", () => {
  const G = game();

  // Storage says off, but the Display menu has switched confirmations back on:
  // the live prop wins without a remount.
  const enabled = withStoredPreference("off", () =>
    renderToStaticMarkup(<HandTray {...props(G, true)} expandAll confirmActions/>));
  for (const tag of playTags(enabled)) expect(tag).toContain('data-confirm="true"');

  // Storage says on, the switch is off (the fast-play path the e2e helpers use).
  const disabled = withStoredPreference("on", () =>
    renderToStaticMarkup(<HandTray {...props(G, true)} expandAll confirmActions={false}/>));
  for (const tag of playTags(disabled)) expect(tag).toContain('data-confirm="false"');
});

test("without the prop the tray still uses the stored preference", () => {
  const G = game();
  // A caller that renders the tray alone (no board) keeps the persisted value.
  const stored = withStoredPreference("off", () =>
    renderToStaticMarkup(<HandTray {...props(G, true)} expandAll/>));
  const buttons = playTags(stored);
  expect(buttons.length).toBeGreaterThan(0);
  for (const tag of buttons) expect(tag).toContain('data-confirm="false"');
});
