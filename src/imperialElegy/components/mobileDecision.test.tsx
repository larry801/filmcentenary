/**
 * The phone decision contract: while a decision is owed the turn panel shows
 * only the decision body and the hand tray folds itself to a one-line peek, so
 * the map target the decision points at stays visible.
 *
 * Both are static-markup contracts: the hiding is CSS-only (the tab strip and
 * every body stay mounted so their state and test ids survive), so the tests
 * assert the data attributes and the DOM presence of the hidden parts, never a
 * computed style.  Node environment, no jsdom.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";

// `theme` pulls in MUI and the app stylesheet; the tray only needs the chip
// primitives, and `HandTray.test.tsx` stubs them the same way.
jest.mock("./theme", () => {
  const React = require("react");
  return {
    IEBadge: ({children}: any) => React.createElement("span", null, children),
    IEChip: ({children}: any) => React.createElement("span", null, children),
  };
});

import {TurnPanel, TurnPanelProps} from "./TurnPanel";
import {HandTray} from "./HandTray";
import {ImperialElegyState} from "../types";
import {setupImperialElegy} from "../engine/setup";
import {ieT} from "./i18n";

/* ------------------------------- TurnPanel ------------------------------- */

const turnProps = (overrides: Partial<TurnPanelProps> = {}): TurnPanelProps => ({
  locale: "en",
  t: ieT(),
  cp: 3,
  phaseActions: [{key: "pass", label: "Pass", onClick: () => undefined}],
  phaseLabel: "Action",
  activeLabel: "Germany",
  turn: 1,
  summary: "Choose an action",
  hasDecision: false,
  tabs: {
    action: <p data-testid="ie-action-body-marker">the decision body</p>,
    war: <p data-testid="ie-war-body-marker">war</p>,
    log: <p data-testid="ie-log-body-marker">log</p>,
  },
  ...overrides,
});

test("decisionOnlyOnPhone keeps the tab strip and bodies mounted but marks the panel decision-only", () => {
  const html = renderToStaticMarkup(
    <TurnPanel {...turnProps({decisionOnlyOnPhone: true, hasDecision: true})}/>,
  );

  expect(html).toContain('data-testid="ie-dock"');
  expect(html).toContain('data-decision-only="true"');
  expect(html).toContain("ie-turn-panel-decision");

  // The tab strip is still in the DOM: on a phone the stylesheet hides it, it
  // is never unmounted (so its state survives).  We assert presence, not CSS.
  expect(html).toContain('class="ie-turn-tabs"');
  expect(html).toContain('role="tablist"');
  expect(html).toContain('data-testid="ie-turn-tab-action"');
  expect(html).toContain('data-testid="ie-turn-tab-log"');

  // The decision (action) body is rendered, and so is the marker inside it.
  expect(html).toContain('data-testid="ie-turn-panel-action"');
  expect(html).toContain('data-testid="ie-action-body-marker"');

  // The action tab is the one selected, and it is labelled as the decision.
  expect(html).toContain('id="ie-turn-tab-action"');
  expect(html).toMatch(/<button[^>]*id="ie-turn-tab-action"[^>]*aria-selected="true"/);
  expect(html).toContain("Decision");
});

test("decisionOnlyOnPhone={false} renders the normal, fully readable panel", () => {
  const html = renderToStaticMarkup(
    <TurnPanel {...turnProps({decisionOnlyOnPhone: false, hasDecision: true})}/>,
  );

  expect(html).toContain('data-decision-only="false"');
  expect(html).not.toContain("ie-turn-panel-decision");
  // The flag is the phone contract alone: a decision without it (desktop) still
  // renders the panel normally with its tab strip and action body.
  expect(html).toContain('class="ie-turn-tabs"');
  expect(html).toContain('data-testid="ie-action-body-marker"');

  // Omitting the prop means the same thing.
  const omitted = renderToStaticMarkup(<TurnPanel {...turnProps({hasDecision: true})}/>);
  expect(omitted).toContain('data-decision-only="false"');
  expect(omitted).not.toContain("ie-turn-panel-decision");
});

/* -------------------------------- HandTray ------------------------------- */

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

const trayProps = (G: ImperialElegyState, open: boolean) => {
  const me = G.powers.GE;
  return {
    G, viewer: "GE" as const, me, locale: "zh_CN" as const, t: ieT(),
    phase: "action", isActive: true, eliminated: false, pending: null,
    canActionCard: true, isBelligerent: false, war: null, forcedCardIds: [],
    hand: me.hand, saveList: [], shownCards: [], cardsShownToMe: [],
    responseInHand: false, responseWindow: false, chainNonEmpty: false, chainSpendable: 0,
    chainCap: 4, chainReady: false, chainDisabledReason: undefined,
    cpBudget: () => 3, doAction: (fn: () => void) => fn(), moves: {},
    handChoicesHint: null, cardFaceMode: "svg" as const,
    open, onToggleOpen: () => undefined,
  };
};

test("decisionPeek folds the tray to a one-line peek even when the reader had it open", () => {
  const html = renderToStaticMarkup(<HandTray {...trayProps(game(), true)} decisionPeek/>);

  expect(html).toContain('data-testid="ie-hand-tray"');
  // The reader asked for it open, but the decision wins: `shownOpen` is false.
  expect(html).toContain('data-open="false"');
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain('data-decision-peek="true"');
  expect(html).toContain("ie-hand-tray-decision");

  // One line, not the hand: the peek text is present and the hand body is not.
  expect(html).toContain('data-testid="ie-tray-decision-peek"');
  expect(html).toContain('class="ie-tray-decision-line"');
  expect(html).toContain("有决策待处理——请在面板中作答");
  expect(html).not.toContain('class="ie-tray-body"');
  expect(html).not.toContain('class="ie-hand"');
  expect(html).toContain("手牌 · 德国");

  // Without the peek the same "open" prop really does open the tray, so the
  // fold above comes from the decision flag and nothing else.
  const plain = renderToStaticMarkup(<HandTray {...trayProps(game(), true)}/>);
  expect(plain).toContain('data-decision-peek="false"');
  expect(plain).toContain('data-open="true"');
  expect(plain).toContain('class="ie-tray-body"');
  expect(plain).not.toContain('data-testid="ie-tray-decision-peek"');
});

test("a decisionPeekLabel names another player's decision instead of asking the reader to answer", () => {
  const html = renderToStaticMarkup(
    <HandTray {...trayProps(game(), true)} decisionPeek decisionPeekLabel="法国决策中"/>,
  );
  expect(html).toContain('data-testid="ie-tray-decision-peek"');
  expect(html).toContain("法国决策中");
  expect(html).not.toContain("请在面板中作答");
});
