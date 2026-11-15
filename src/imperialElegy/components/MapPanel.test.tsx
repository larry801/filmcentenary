import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {MapPanel} from "./MapPanel";
import {ieT} from "./i18n";
import {createSpaceStates} from "../constant/spaces";
import {ImperialElegyState} from "../types";

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
  return {IEMap: () => React.createElement("svg", {"data-testid": "ie-map"})};
});

const props = () => ({
  G: {spaces: createSpaceStates()} as unknown as ImperialElegyState,
  selected: null,
  onSelect: () => {},
  board: "world" as const,
  setBoard: () => {},
  pendingSpaceTargets: [],
  unitMoveTargets: [],
  battleTargets: [],
  locale: "zh_CN" as const,
  t: ieT(),
  mapHint: "点击空间",
});

test("the map panel starts expanded with its tabs", () => {
  const html = renderToStaticMarkup(<MapPanel {...props()} />);
  expect(html).toContain('data-testid="ie-map"');
  expect(html).toContain("大战地图");
});

test("a selection stays readable in the title bar", () => {
  const html = renderToStaticMarkup(<MapPanel {...props()} selected="berlin" />);
  expect(html).toContain("柏林");
});
