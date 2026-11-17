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
    hand: me.hand, saveList: [], giveCards: [], giveCardId: "", setGiveCardId: () => undefined,
    giveTarget: "UK" as const, setGiveTarget: () => undefined, giveCardValue: "",
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

test("svg is the zero-image default and print mode uses the stored card scan", () => {
  const G = game();
  const svg = renderToStaticMarkup(<HandTray {...props(G, true)}/>);
  expect(svg).toContain("svg");
  expect(svg).not.toContain("img class=\"ie-card-face");

  const print = renderToStaticMarkup(<HandTray {...props(G, true)} cardFaceMode="print"/>);
  expect(print).toContain('img class="ie-card-face ie-card-print"');
  expect(print).toContain("/imperial-elegy/cards/");
});

test("card play is a two-step confirm: the armed state is data, never a modal", () => {
  const G = game();
  const open = renderToStaticMarkup(<HandTray {...props(G, true)}/>);
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

  const on = playTags(renderToStaticMarkup(<HandTray {...props(G, true)} confirmActions/>));
  expect(on.length).toBeGreaterThan(0);
  for (const tag of on) {
    expect(tag).toContain('data-confirm="true"');
    expect(tag).toContain('data-armed="false"');
  }

  const offHtml = renderToStaticMarkup(<HandTray {...props(G, true)} confirmActions={false}/>);
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
    renderToStaticMarkup(<HandTray {...props(G, true)} confirmActions/>));
  for (const tag of playTags(enabled)) expect(tag).toContain('data-confirm="true"');

  // Storage says on, the switch is off (the fast-play path the e2e helpers use).
  const disabled = withStoredPreference("on", () =>
    renderToStaticMarkup(<HandTray {...props(G, true)} confirmActions={false}/>));
  for (const tag of playTags(disabled)) expect(tag).toContain('data-confirm="false"');
});

test("without the prop the tray still uses the stored preference", () => {
  const G = game();
  // A caller that renders the tray alone (no board) keeps the persisted value.
  const stored = withStoredPreference("off", () =>
    renderToStaticMarkup(<HandTray {...props(G, true)}/>));
  const buttons = playTags(stored);
  expect(buttons.length).toBeGreaterThan(0);
  for (const tag of buttons) expect(tag).toContain('data-confirm="false"');
});
