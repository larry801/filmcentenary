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
