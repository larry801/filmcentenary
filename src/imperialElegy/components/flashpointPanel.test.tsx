/**
 * The panels that now carry the flashpoint / projection hints.
 *
 * `SpaceDetailPanel` answers "what is this space"; `DashboardPanel` prints the
 * six public displays.  Both were silent about flashpoint membership and the
 * projection track, so the numbers only existed in the reference chart.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import type {Ctx} from "boardgame.io";
import {SpaceDetailPanel} from "./SpacePanel";
import {DashboardPanel} from "./DashboardPanel";
import {ieT} from "./i18n";
import {setupImperialElegy} from "../engine/setup";
import type {ImperialElegyState} from "../types";

// The panels sit on the themed surface; Jest does not parse the stylesheet, so
// the surface components are the same plain shells the other node tests use.
jest.mock("./theme", () => {
  const React = require("react");
  const Panel = ({title, children}: {title?: React.ReactNode; children?: React.ReactNode}) =>
    React.createElement("section", null, React.createElement("h3", null, title), children);
  return {
    IEPanel: Panel,
    IEBadge: ({children}: {children?: React.ReactNode}) => React.createElement("span", null, children),
    IEChip: ({children}: {children?: React.ReactNode}) => React.createElement("span", null, children),
  };
});

const makeCtx = (): Ctx =>
  ({
    playerID: "0",
    random: {Die: () => 3},
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    turn: 1,
    phase: "prep",
  }) as unknown as Ctx;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const spacePanel = (G: ImperialElegyState): string =>
  renderToStaticMarkup(
    <SpaceDetailPanel
      G={G}
      selected="silesia"
      viewer="GE"
      me={G.powers.GE}
      locale="zh_CN"
      t={ieT()}
      phase="action"
      canAct={false}
      pending={null}
      canDecide={false}
      doAction={() => undefined}
      moves={{}}
      onOpenReference={() => undefined}
    />,
  );

test("the space panel names every theatre the space belongs to", () => {
  const html = spacePanel(fresh());
  expect(html).toContain('data-testid="ie-space-flashpoints"');
  expect(html).toContain("德意志");
  expect(html).toContain("中欧");
  // The chart's printed thresholds, not the old 6 / 5.
  expect(html).toContain("/8");
  expect(html).toContain("/3");
  expect(html).toContain('data-testid="ie-space-flashpoint-ref"');
});

test("the space panel's link opens the flashpoint chart", () => {
  const html = spacePanel(fresh());
  expect(html).toContain('data-anchor="chart:map-flashpoints"');
  expect(html).not.toContain('data-testid="ie-space-flashpoint-ref" disabled');
});

test("the dashboard prints all six public projection tracks", () => {
  const G = fresh();
  const html = renderToStaticMarkup(
    <DashboardPanel
      G={G}
      active="GE"
      viewer="GE"
      locale="zh_CN"
      t={ieT()}
      handCounts={{}}
      goalCounts={{}}
      homeCardTitle={(id) => id}
      minorMarkerRows={[]}
    />,
  );
  for (const power of ["GE", "UK", "FR", "AU", "RU", "OT"]) {
    expect(html).toContain(`data-testid="ie-dash-projection-${power}"`);
  }
  expect(html).toContain("力量投射");
  // The UK leads the printed track; the other five carry a value too.
  expect(html).toContain('data-leader="true"');
  expect(html).toContain("工业化 +1 DRM");
});
