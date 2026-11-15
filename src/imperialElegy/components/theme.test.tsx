import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
// The node test environment cannot parse the stylesheet import.
jest.mock("./imperial-elegy.css", () => ({}));

import {IEPanel, isHeaderControl} from "./theme";

const render = (ui: React.ReactElement) => renderToStaticMarkup(ui);

describe("foldable panels", () => {
  test("a panel folds from its title bar", () => {
    const html = render(<IEPanel title="Hand">cards</IEPanel>);
    expect(html).toContain('class="ie-panel-head collapsible"');
    // The caret is the keyboard/assistive control for the same action.
    expect(html).toContain("ie-panel-caret");
    expect(html).toContain('aria-expanded="true"');
  });

  test("every panel is foldable by default", () => {
    expect(render(<IEPanel title="Log">line</IEPanel>)).toContain("ie-panel-caret");
  });

  test("a panel can opt out, and then has no caret", () => {
    const html = render(<IEPanel title="Decision" collapsible={false}>body</IEPanel>);
    expect(html).not.toContain("ie-panel-caret");
    expect(html).not.toContain("collapsible");
  });

  test("a folded panel renders its title but not its body", () => {
    const html = render(<IEPanel title="History" defaultCollapsed>entries</IEPanel>);
    expect(html).toContain("History");
    expect(html).not.toContain("entries");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('data-collapsed="true"');
  });

  test("a folded panel can still say what it holds", () => {
    const html = render(
      <IEPanel title="Map" defaultCollapsed collapsedHint="3 legal targets">board</IEPanel>,
    );
    expect(html).toContain("3 legal targets");
    expect(html).toContain("ie-panel-folded-hint");
  });

  test("a filter panel with no title still renders its body", () => {
    const html = render(<IEPanel>only body</IEPanel>);
    expect(html).toContain("only body");
  });
});

describe("header clicks", () => {
  const fake = (selector: string | null) => ({
    closest: () => (selector === null ? null : ({} as Element)),
  });

  test("a click on the title folds the panel", () => {
    expect(isHeaderControl(fake(null) as unknown as EventTarget)).toBe(false);
  });

  test("a click on a control in the bar does not fold it", () => {
    expect(isHeaderControl(fake("button") as unknown as EventTarget)).toBe(true);
  });

  test("a missing target is treated as the bar itself", () => {
    expect(isHeaderControl(null)).toBe(false);
  });

  test("a target without closest cannot be a control", () => {
    expect(isHeaderControl({} as unknown as EventTarget)).toBe(false);
  });
});
