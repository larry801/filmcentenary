import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {RailTabs} from "./RailTabs";

const tabs = [
  {key: "action", label: "行动", content: React.createElement("div", {"data-testid": "body-action"}, "行动内容")},
  {key: "war", label: "战局", content: React.createElement("div", {"data-testid": "body-war"}, "战局内容"), badge: "⚔"},
  {key: "reference", label: "参考", content: React.createElement("div", {"data-testid": "body-reference"}, "参考内容")},
];

describe("the desktop rail", () => {
  test("shows the active panel and keeps the others mounted but hidden", () => {
    const html = renderToStaticMarkup(
      React.createElement(RailTabs, {tabs, active: "action", onChange: () => undefined, label: "语境栏"}),
    );
    expect(html).not.toContain("ie-rail-sheet");
    expect(html).toContain("行动内容");
    // Hidden, not unmounted: the board's derived state must not depend on which
    // tab the player is looking at.
    expect(html).toContain("战局内容");
    expect(html).toContain("参考内容");
    expect(html.match(/hidden=""/g) ?? []).toHaveLength(2);
    // No drawer affordances on a desktop.
    expect(html).not.toContain('data-testid="ie-rail-close"');
    expect(html).not.toContain("aria-expanded");
  });

  test("a closed drawer renders only its tab strip", () => {
    const html = renderToStaticMarkup(
      React.createElement(RailTabs, {
        tabs, active: "action", onChange: () => undefined, label: "语境栏",
        drawer: {open: false, setOpen: () => undefined},
      }),
    );
    expect(html).toContain('class="ie-rail ie-rail-sheet"');
    expect(html).toContain('data-open="false"');
    // Every panel is collapsed: the map owns the screen.
    expect(html.match(/hidden=""/g) ?? []).toHaveLength(3);
    expect(html).not.toContain('data-testid="ie-rail-close"');
  });

  test("an open drawer shows the active panel and offers a way back", () => {
    const html = renderToStaticMarkup(
      React.createElement(RailTabs, {
        tabs, active: "action", onChange: () => undefined, label: "语境栏",
        drawer: {open: true, setOpen: () => undefined},
      }),
    );
    expect(html).toContain('data-open="true"');
    expect(html).toContain("行动内容");
    expect(html.match(/hidden=""/g) ?? []).toHaveLength(2);
    expect(html).toContain('data-testid="ie-rail-close"');
    expect(html).toContain('aria-expanded="true"');
  });

  test("a tab with no visible condition at all is dropped", () => {
    const html = renderToStaticMarkup(
      React.createElement(RailTabs, {
        tabs: [...tabs, {key: "gw", label: "大战", content: null, visible: false}],
        active: "action", onChange: () => undefined, label: "语境栏",
      }),
    );
    expect(html).not.toContain("大战");
  });

  test("the war tab carries its badge", () => {
    const html = renderToStaticMarkup(
      React.createElement(RailTabs, {tabs, active: "action", onChange: () => undefined, label: "语境栏"}),
    );
    expect(html).toContain("ie-rail-badge");
    expect(html).toContain("⚔");
  });
});
