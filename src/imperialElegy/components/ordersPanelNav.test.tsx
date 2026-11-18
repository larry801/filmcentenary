/**
 * The Orders panel's page navigation.
 *
 * The panel is four pages behind one segmented control, and both the pages and
 * the control have non-obvious rules worth pinning without a browser:
 *
 * 1. every page stays mounted and only the inactive ones are `hidden`, so an
 *    armed confirmation, a half-filled naval form and the bots' effects survive
 *    a switch;
 * 2. the naval page exists only while a naval flow is offered, and a request
 *    for a page that no longer exists falls back to the actions page;
 * 3. the strip is one tab stop with arrow/Home/End movement, like the turn
 *    panel's own strip and the seat strip.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {OrdersPanel, ordersTabKeys, resolveOrdersTab, type OrdersTab} from "./OrdersPanel";

const labels = {actions: "Actions", space: "Space", influence: "Influence", naval: "Naval"};

const render = (over: Partial<React.ComponentProps<typeof OrdersPanel>> = {}): string =>
  renderToStaticMarkup(
    <OrdersPanel
      locale="en"
      labels={labels}
      active="actions"
      onTab={() => undefined}
      navalVisible={false}
      tabs={{
        actions: <p data-testid="marker-actions">a</p>,
        space: <p data-testid="marker-space">s</p>,
        influence: <p data-testid="marker-influence">i</p>,
        naval: <p data-testid="marker-naval">n</p>,
      }}
      {...over}
    />,
  );

describe("which pages exist", () => {
  test("the naval page joins only while a naval flow is offered", () => {
    expect(ordersTabKeys(false)).toEqual(["actions", "space", "influence"]);
    expect(ordersTabKeys(true)).toEqual(["actions", "space", "influence", "naval"]);
  });

  test("a page that stops existing falls back to actions", () => {
    expect(resolveOrdersTab("naval", false)).toBe("actions");
    expect(resolveOrdersTab("naval", true)).toBe("naval");
    expect(resolveOrdersTab("influence", false)).toBe("influence");
  });
});

describe("the rendered panel", () => {
  test("three pages by default, four while a naval flow is offered", () => {
    const peace = render();
    expect((peace.match(/role="tab"/g) ?? []).length).toBe(3);
    expect(peace).not.toContain('data-testid="ie-orders-tab-naval"');

    const naval = render({navalVisible: true});
    expect((naval.match(/role="tab"/g) ?? []).length).toBe(4);
    expect(naval).toContain('data-testid="ie-orders-tab-naval"');
  });

  test("every page stays mounted; only the inactive ones are hidden", () => {
    const html = render({navalVisible: true, active: "space"});
    for (const key of ["actions", "space", "influence", "naval"]) {
      expect(html).toContain(`id="ie-orders-panel-${key}"`);
      expect(html).toContain(`data-testid="marker-${key}"`);
    }
    // The selected page is the one without `hidden`.
    expect(html).toMatch(/<div[^>]*data-testid="ie-orders-panel-space"[^>]*>/);
    expect(html.match(/data-testid="ie-orders-panel-space"[^>]*hidden/g)).toBeNull();
    for (const key of ["actions", "influence", "naval"]) {
      expect(html.match(new RegExp(`data-testid="ie-orders-panel-${key}"[^>]*hidden`))).not.toBeNull();
    }  });

  test("the selected tab is the only tab stop and carries aria-selected", () => {
    const html = render({active: "influence"});
    expect(html).toMatch(/<button[^>]*aria-selected="true"[^>]*data-testid="ie-orders-tab-influence"/);
    // `data-testid` is emitted before the roving props, so tabindex follows it.
    expect(html).toMatch(/data-testid="ie-orders-tab-influence"[^>]*tabindex="0"/);
    expect(html).toMatch(/data-testid="ie-orders-tab-actions"[^>]*tabindex="-1"/);
    // Exactly one tab stop in the strip.
    expect((html.match(/tabindex="0"/g) ?? []).length).toBe(1);
  });

  test("each tab names its own panel", () => {
    const html = render({navalVisible: true});
    for (const key of ["actions", "space", "influence", "naval"]) {
      expect(html).toContain(`aria-controls="ie-orders-panel-${key}"`);
      expect(html).toContain(`aria-labelledby="ie-orders-tab-${key}"`);
    }
  });

  test("the interception window marks the naval tab", () => {
    const quiet = render({navalVisible: true});
    expect(quiet).not.toContain("ie-orders-tab-badge");
    const urgent = render({navalVisible: true, navalUrgent: true});
    expect(urgent).toContain("ie-orders-tab-badge");
    expect(urgent).toMatch(/ie-orders-tab urgent/);
  });

  test("a requested page that no longer exists renders the actions page", () => {
    const html = render({navalVisible: false, active: "naval" as OrdersTab});
    expect(html.match(/data-testid="ie-orders-panel-actions"[^>]*hidden/)).toBeNull();
    expect(html).not.toContain("ie-orders-panel-naval");
  });
});
