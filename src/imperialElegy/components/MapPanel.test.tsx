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

/** The footer card is the only place the map names a space's state. */
const spaceCard = (html: string): string => {
  const match = html.match(/data-testid="ie-space-card"[^>]*>([\s\S]*?)<\/div>/);
  if (!match) throw new Error(`no space card in ${html}`);
  return match[1];
};

const cardText = (html: string, className: string): string => {
  const match = spaceCard(html).match(new RegExp(`class="${className}"[^>]*>([\\s\\S]*?)</span>`));
  if (!match) throw new Error(`no ${className} in space card`);
  // React's server renderer separates adjacent text nodes with `<!-- -->`.
  return match[1].replace(/<!-- -->/g, "");
};

/** Berlin and Vienna carry different units/forts, so the card cannot pass one off as the other. */
const twoSpaces = (): ImperialElegyState => {
  const spaces = createSpaceStates();
  spaces.berlin = {...spaces.berlin, units: ["ge-1"], fort: {power: "GE", level: 1}};
  spaces.vienna = {...spaces.vienna, units: ["au-1", "au-2", "au-3"], fort: {power: "AU", level: 2}};
  return {spaces} as unknown as ImperialElegyState;
};

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

  test("the map is split into Europe/America, Asia and Africa sheets", () => {
    const html = renderToStaticMarkup(<MapPanel {...props()} />);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('data-testid="ie-map-section-europeAmerica"');
    expect(html).toContain('data-testid="ie-map-section-asia"');
    expect(html).toContain('data-testid="ie-map-section-africa"');
    for (const label of ["欧美", "亚洲", "非洲"]) expect(html).toContain(label);
  });

  test("a selection stays readable in the title bar", () => {
    const html = renderToStaticMarkup(<MapPanel {...props({selected: "berlin"})} />);
    expect(html).toContain("柏林");
  });

  test("the keyboard-focused target owns the space card, not the selection", () => {
    const html = renderToStaticMarkup(
      <MapPanel
        {...props({
          G: twoSpaces(),
          selected: "berlin",
          focusedTarget: "vienna",
          targets: [{id: "vienna", style: "move"}] as never,
        })}
      />,
    );

    expect(cardText(html, "ie-space-card-title")).toBe("维也纳");
    expect(cardText(html, "ie-space-card-tag")).toContain("聚焦目标");
    // The line must describe Vienna's garrison, not Berlin's.
    const line = cardText(html, "ie-space-card-line");
    expect(line).toContain("单位: 3");
    expect(line).toContain("要塞: 2");
    expect(line).not.toContain("单位: 1");
    expect(line).not.toContain("要塞: 1");
  });

  test("without a keyboard focus the space card falls back to the selection", () => {
    const html = renderToStaticMarkup(
      <MapPanel
        {...props({
          G: twoSpaces(),
          selected: "berlin",
          targets: [{id: "vienna", style: "move"}] as never,
        })}
      />,
    );

    expect(cardText(html, "ie-space-card-title")).toBe("柏林");
    expect(html).not.toContain("ie-space-card-tag");
    const line = cardText(html, "ie-space-card-line");
    expect(line).toContain("单位: 1");
    expect(line).toContain("要塞: 1");
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
  // The interactive board links to the 1:1 printed sheet in a new tab.
  expect(html).toContain('data-testid="ie-map-printed-board"');
  expect(html).toContain('href="/board/imperialElegy"');
  expect(html).toContain("印刷版图");
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
