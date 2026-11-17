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

test("the framing bar offers the whole map, the player's capital and every theatre", () => {
  const html = renderToStaticMarkup(<MapPanel {...props()} viewer="GE" />);
  expect(html).toContain('data-testid="ie-map-views"');
  expect(html).toContain('data-testid="ie-map-fit"');
  expect(html).toContain("全图");
  expect(html).toContain('data-testid="ie-map-capital"');
  // The capital chip names the space it will frame, so the player knows where
  // it goes before pressing it.
  expect(html).toContain('title="柏林"');
  expect(html).toContain('data-testid="ie-map-theatre"');
  for (const label of ["西欧", "中欧与意大利", "东欧与俄国", "巴尔干与近东", "非洲", "亚洲", "美洲"]) {
    expect(html).toContain(label);
  }
});

test("the theatre list does not repeat the whole-map chip as an option", () => {
  const html = renderToStaticMarkup(<MapPanel {...props()} viewer="GE" />);
  const select = html.slice(html.indexOf('data-testid="ie-map-theatre"'));
  const options = select.slice(0, select.indexOf("</select>"));
  // "全图" appears once, in the hidden value that keeps the chip and the select
  // in sync — never as a second visible choice.
  expect(options.match(/>全图</g) ?? []).toHaveLength(1);
  expect(options).toContain('value="all" hidden');
});

test("a spectator gets the framing bar without a capital to frame", () => {
  const html = renderToStaticMarkup(<MapPanel {...props()} />);
  expect(html).toContain('data-testid="ie-map-views"');
  expect(html).toContain('data-testid="ie-map-capital"');
  expect(html).not.toContain('title="柏林"');
});
