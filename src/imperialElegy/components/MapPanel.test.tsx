import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {MapPanel} from "./MapPanel";
import {ieT} from "./i18n";
import {createSpaceStates} from "../constant/spaces";
import {ImperialElegyState, SpaceId} from "../types";

jest.mock("./theme", () => {
  const React = require("react");
  return {
    IEPanel: ({title, children, actions, className, collapsed, collapsedHint}: any) =>
      React.createElement("section", {className, "data-collapsed": collapsed ? "true" : "false"},
        React.createElement("header", {className: "ie-panel-head"},
          React.createElement("h3", null, title), actions, collapsedHint),
        collapsed ? null : React.createElement("div", {className: "ie-panel-body"}, children)),
  };
});

jest.mock("./map", () => {
  const React = require("react");
  return {
    IEMap: (props: any) => React.createElement("svg", {
      "data-testid": "ie-map",
      "data-targets": (props.targets ?? []).map((target: {id: string}) => target.id).join(","),
    }),
  };
});

const props = (overrides: Record<string, unknown> = {}) => ({
  G: {spaces: createSpaceStates()} as unknown as ImperialElegyState,
  selected: null,
  onSelect: () => {},
  pendingSpaceTargets: [] as SpaceId[],
  targets: [] as SpaceId[],
  locale: "zh_CN" as const,
  t: ieT(),
  mapHint: "点击空间",
  ...overrides,
});

describe("the map panel", () => {
  test("starts expanded with the map and no board tabs", () => {
    const html = renderToStaticMarkup(<MapPanel {...props()} />);
    expect(html).toContain('data-testid="ie-map"');
    // The panel no longer folds: it is the map column, and the turn panel owns
    // the interactions.  The stage must still be present.
    expect(html).toContain('class="ie-map-stage"');
    // Phase 2 dropped the dead Great War JPG tab: one board, one panel.
    expect(html).not.toContain("大战地图");
    expect(html).not.toContain("ie-tabs");
  });

  test("a selection stays readable in the title bar", () => {
    const html = renderToStaticMarkup(<MapPanel {...props({selected: "berlin"})} />);
    expect(html).toContain("柏林");
  });

  test("the find-space control opens the picker", () => {
    const html = renderToStaticMarkup(<MapPanel {...props()} />);
    expect(html).toContain('data-testid="ie-map-find"');
    expect(html).toContain("查找空间");
  });

  test("an explicit targeting mode renders an aria-live pill with a keyboard target list", () => {
    const html = renderToStaticMarkup(
      <MapPanel
        {...props()}
        modePill={{
          label: "陆战：选择相邻目标",
          from: "柏林",
          count: 2,
          cancelLabel: "取消",
          onCancel: () => undefined,
          targets: [{id: "saxony", label: "萨克森"}, {id: "hanover", label: "汉诺威"}],
          onChoose: () => undefined,
        }}
      />,
    );
    expect(html).toContain('data-testid="ie-mode-pill"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("陆战：选择相邻目标");
    expect(html).toContain("2 个合法目标");
    expect(html).toContain('data-testid="ie-mode-pill-targets"');
    expect(html).toContain("萨克森");
    expect(html).toContain('data-testid="ie-mode-pill-cancel"');
  });

  test("the legal targets are handed to the map as data, not merged into one list", () => {
    const html = renderToStaticMarkup(
      <MapPanel {...props({targets: [{id: "saxony", style: "move"}, {id: "bohemia", style: "attack"}] as never})} />,
    );
    expect(html).toContain('data-targets="saxony,bohemia"');
  });
});
