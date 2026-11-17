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

test("a card row shows only its CP value, name and type until it is opened", () => {
  const G = game();
  const id = G.powers.GE.hand[0];
  const html = renderToStaticMarkup(<HandTray {...props(G, true)}/>);
  const row = html.slice(html.indexOf(`data-testid="ie-card-${id}"`));
  const rowHtml = row.slice(0, row.indexOf("</article>"));

  expect(rowHtml).toContain(`data-testid="ie-card-cp-${id}"`);
  expect(rowHtml).toContain(`data-testid="ie-card-type-${id}"`);
  expect(rowHtml).toContain('data-expanded="false"');
  expect(rowHtml).toContain('aria-expanded="false"');
  // Folded rows carry no face, no buttons and no translation: that is the whole
  // point of the redesign.
  expect(rowHtml).not.toContain(`data-testid="ie-card-face-${id}"`);
  expect(rowHtml).not.toContain(`data-testid="ie-play-cp-${id}"`);
  expect(rowHtml).not.toContain("ie-card-face");
  expect(rowHtml).not.toContain("ie-card-translation");
});

test("a card that forbids passing starts unfolded so its event is reachable", () => {
  const G = game();
  const id = G.powers.GE.hand[0];
  const html = renderToStaticMarkup(<HandTray {...props(G, true)} forcedCardIds={[id]}/>);
  const row = html.slice(html.indexOf(`data-testid="ie-card-${id}"`));
  const rowHtml = row.slice(0, row.indexOf("</article>"));
  expect(rowHtml).toContain('data-expanded="true"');
  expect(rowHtml).toContain('aria-expanded="true"');
  expect(rowHtml).toContain(`data-testid="ie-card-face-${id}"`);
});

test("svg is the zero-image default and print mode uses the stored card scan", () => {
  const G = game();
  // The scan is what the unfolded face draws, so the forced card opens them.
  const forced = [G.powers.GE.hand[0]];
  const svg = renderToStaticMarkup(<HandTray {...props(G, true)} forcedCardIds={forced}/>);
  expect(svg).toContain("<svg");
  expect(svg).not.toContain("img class=\"ie-card-face");

  const print = renderToStaticMarkup(<HandTray {...props(G, true)} cardFaceMode="print" forcedCardIds={forced}/>);
  expect(print).toContain('img class="ie-card-face ie-card-print"');
  expect(print).toContain("/imperial-elegy/cards/");
});
