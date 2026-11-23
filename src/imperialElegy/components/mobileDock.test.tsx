/**
 * The phone's one-sheet dock: Orders / Hand / Mat / Log behind a single tab
 * bar, collapsed to a bar or open at half/full height.
 *
 * Like `mobileDecision.test.tsx`, this is a static-markup contract: every
 * show/hide and height is CSS driven by `data-open` / `data-expanded` /
 * `data-tab` / `data-decision`, so the suite asserts the attributes and the
 * DOM presence of the parts that stay mounted, never a computed style.  Node
 * environment, no jsdom, `renderToStaticMarkup` only.
 *
 * SSR cannot click.  The tab strip is a real tablist, so this suite also pins
 * its roving `tabindex` (one tab stop, the selected tab) and the ARIA wiring;
 * the click behaviour itself is covered by the phone Playwright spec.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";

import {MobileDock, MobileDockProps, MobileDockTab} from "./MobileDock";

/* -------------------------------- fixtures ------------------------------- */

const tabs = (): MobileDockTab[] => [
  {key: "orders", label: "Orders"},
  {key: "hand", label: "Hand"},
  {key: "mat", label: "Mat"},
  {key: "log", label: "Log"},
];

const dockProps = (overrides: Partial<MobileDockProps> = {}): MobileDockProps => ({
  open: false,
  expanded: false,
  tab: "orders",
  tabs: tabs(),
  onTab: () => undefined,
  onToggleOpen: () => undefined,
  onToggleExpanded: () => undefined,
  decision: false,
  locale: "en",
  children: <p data-testid="ie-orders-body-marker">the orders body</p>,
  ...overrides,
});

const markup = (overrides: Partial<MobileDockProps> = {}): string =>
  renderToStaticMarkup(<MobileDock {...dockProps(overrides)}/>);

/** The opening tag of the element carrying `data-testid`, attributes intact. */
const openTag = (html: string, testId: string): string => {
  const match = html.match(new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`));
  if (match === null) throw new Error(`no element with data-testid="${testId}" in the markup`);
  return match[0];
};

/** How many times `needle` occurs — for "exactly one tab is selected". */
const count = (html: string, needle: string): number => html.split(needle).length - 1;

/** The whole button element (opening tag, children and closing tag). */
const buttonMarkup = (html: string, testId: string): string => {
  const at = html.indexOf(`data-testid="${testId}"`);
  if (at < 0) throw new Error(`no button with data-testid="${testId}" in the markup`);
  const start = html.lastIndexOf("<button", at);
  const end = html.indexOf("</button>", at);
  return html.slice(start, end + "</button>".length);
};

/* --------------------------- closed by default --------------------------- */

test("a closed dock keeps the body mounted, marks itself closed and selects one tab", () => {
  const html = markup();

  expect(html).toContain('data-testid="ie-mobile-dock"');
  expect(html).toContain('class="ie-mobile-dock"');
  expect(html).toContain('data-open="false"');
  expect(html).toContain('data-tab="orders"');
  expect(html).toContain('data-decision="false"');

  // One selected tab and it is Orders; every other tab is explicitly not.
  expect(count(html, 'aria-selected="true"')).toBe(1);
  expect(openTag(html, "ie-mobile-tab-orders")).toContain('aria-selected="true"');
  expect(openTag(html, "ie-mobile-tab-hand")).toContain('aria-selected="false"');
  expect(openTag(html, "ie-mobile-tab-mat")).toContain('aria-selected="false"');
  expect(openTag(html, "ie-mobile-tab-log")).toContain('aria-selected="false"');

  // Closing is CSS: the body and the caller's children stay in the DOM.
  expect(html).toContain('class="ie-mobile-body"');
  expect(html).toContain('id="ie-mobile-body"');
  expect(html).toContain('data-testid="ie-mobile-body"');
  expect(html).toContain('role="tabpanel"');
  expect(html).toContain('aria-labelledby="ie-mobile-tab-orders"');
  expect(html).toContain('data-testid="ie-orders-body-marker"');
  expect(html).toContain("the orders body");

  // The bar is present with its toggle, and no decision line is owed.
  expect(html).toContain('class="ie-mobile-bar"');
  expect(openTag(html, "ie-mobile-toggle")).toContain('aria-expanded="false"');
  expect(html).not.toContain("ie-mobile-decision-peek");
});

/* ------------------------- a decision is owed ---------------------------- */

test("a decision owed while closed shows the peek line and stays on orders", () => {
  const html = markup({decision: true, locale: "zh_CN"});

  expect(html).toContain('data-decision="true"');
  expect(html).toContain('data-open="false"');
  expect(html).toContain('data-tab="orders"');

  const peek = openTag(html, "ie-mobile-decision-peek");
  expect(peek).toContain('role="status"');
  expect(html).toContain("有决策待处理");
  expect(openTag(html, "ie-mobile-tab-orders")).toContain('aria-selected="true"');

  // The line is a bar affordance: showing it never unmounts the sheet body.
  expect(html).toContain('data-testid="ie-mobile-body"');
  expect(html).toContain('role="tabpanel"');
  expect(html).toContain('aria-labelledby="ie-mobile-tab-orders"');
  expect(html).toContain('data-testid="ie-orders-body-marker"');

  // The same line is bilingual, not a hard-coded Chinese string.
  expect(markup({decision: true})).toContain("A decision is waiting");
});

test("a decision label names the deciding seat when another player owes it", () => {
  const html = markup({decision: true, locale: "zh_CN", decisionLabel: "法国决策中"});
  expect(openTag(html, "ie-mobile-decision-peek")).toContain('role="status"');
  expect(html).toContain("法国决策中");
  expect(html).not.toContain("有决策待处理");

  const open = markup({decision: true, open: true, locale: "zh_CN", decisionLabel: "法国决策中"});
  expect(open).toContain("ie-mobile-decision-live");
  expect(open).toContain("法国决策中");

  // Without a label the generic line is unchanged, so a battle or the final
  // score (no seat to name) keeps its old wording.
  expect(markup({decision: true, locale: "zh_CN"})).toContain("有决策待处理");
});

test("an open dock drops the peek line while still reporting the decision", () => {
  const html = markup({decision: true, open: true, locale: "zh_CN"});

  expect(html).toContain('data-open="true"');
  expect(html).toContain('data-decision="true"');
  expect(html).not.toContain("ie-mobile-decision-peek");
  // The open sheet still announces the decision through a visually hidden
  // live region, so an arriving decision is not silent just because the sheet
  // is already open.
  expect(html).toContain("ie-mobile-decision-live");
  expect(html).toContain("有决策待处理");
  expect(openTag(html, "ie-mobile-toggle")).toContain('aria-expanded="true"');
});

/* ------------------------------- tab strip ------------------------------- */

test("the tabs prop decides which sections exist and which one is selected", () => {
  const html = markup({
    tab: "hand",
    locale: "zh_CN",
    tabs: [
      {key: "orders", label: "指令"},
      {key: "hand", label: "手牌"},
      {key: "mat", label: "面板"},
      {key: "log", label: "记录"},
    ],
  });

  // Exactly the four provided tabs, each a real tab button with a panel link.
  expect(count(html, 'role="tab"')).toBe(4);
  for (const key of ["orders", "hand", "mat", "log"]) {
    const tab = openTag(html, `ie-mobile-tab-${key}`);
    expect(tab).toContain('role="tab"');
    expect(tab).toContain('aria-controls="ie-mobile-body"');
  }
  expect(openTag(html, "ie-mobile-tab-hand")).toContain('aria-selected="true"');
  expect(openTag(html, "ie-mobile-tab-orders")).toContain('aria-selected="false"');
  expect(openTag(html, "ie-mobile-tab-mat")).toContain('aria-selected="false"');
  expect(openTag(html, "ie-mobile-tab-log")).toContain('aria-selected="false"');
  expect(count(html, 'aria-selected="true"')).toBe(1);
  expect(html).toContain("手牌");

  // A section that is not provided has no button and no body (no War tab
  // unless the caller asks for it).
  expect(html).not.toContain('data-testid="ie-mobile-tab-war"');

  const withWar = markup({tabs: [...tabs(), {key: "war", label: "War", badge: "⚔"}]});
  expect(count(withWar, 'role="tab"')).toBe(5);
  expect(openTag(withWar, "ie-mobile-tab-war")).toContain('aria-selected="false"');
  expect(withWar).toContain("⚔");
});

test("a tab badge is rendered inside its own button", () => {
  const html = markup({
    tabs: [
      {key: "orders", label: "Orders", badge: "!"},
      {key: "hand", label: "Hand"},
    ],
  });

  const orders = buttonMarkup(html, "ie-mobile-tab-orders");
  expect(orders).toContain('class="ie-mobile-tab-badge"');
  expect(orders).toContain("!");
  expect(buttonMarkup(html, "ie-mobile-tab-hand")).not.toContain("ie-mobile-tab-badge");
});

/* ------------------------------- expansion ------------------------------- */

test("the expanded flag marks the full-height position on the root and its control", () => {
  const expanded = markup({open: true, expanded: true});

  expect(expanded).toContain('data-expanded="true"');
  expect(openTag(expanded, "ie-mobile-expand")).toContain('aria-pressed="true"');

  // The flag is independent of the open one and defaults to half height.
  const half = markup({open: true, expanded: false});
  expect(half).toContain('data-expanded="false"');
  expect(openTag(half, "ie-mobile-expand")).toContain('aria-pressed="false"');
  expect(markup()).toContain('data-expanded="false"');
});

/* ------------------------------- roving tabs ------------------------------ */

test("the tab strip is a roving tablist with one tab stop", () => {
  const html = renderToStaticMarkup(<MobileDock {...dockProps({tab: "hand"})}/>);
  const buttons = html.match(/<button[^>]*data-testid="ie-mobile-tab-[^"]*"[^>]*>/g) ?? [];
  expect(buttons).toHaveLength(4);
  const zero = buttons.filter((tag) => tag.includes('tabindex="0"'));
  expect(zero).toHaveLength(1);
  expect(zero[0]).toContain('data-testid="ie-mobile-tab-hand"');
  for (const tag of buttons) {
    expect(tag).toContain('role="tab"');
    expect(tag).toContain('aria-controls="ie-mobile-body"');
    if (!tag.includes('tabindex="0"')) expect(tag).toContain('tabindex="-1"');
  }
  expect(buttons.filter((tag) => tag.includes('aria-selected="true"'))).toHaveLength(1);
});
