/**
 * The Orders list's reading order.
 *
 * `spaceActions` decides *what* the panel offers; this suite pins the two
 * layout rules the panel then applies, because both are invisible to the model
 * tests and both exist for one reason — a typical space refuses ten of its
 * twelve rows, so the two legal ones must not be below the fold:
 *
 * 1. an "available now" strip repeats the legal rows above the grouped list;
 * 2. inside each group, legal rows sort before refused ones.
 *
 * The grouped list itself is unchanged: every row the rules offer is still
 * rendered with its reason (`UI_CHECKLIST.md` §4), and the strip is a shortcut,
 * not a replacement.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";

// The theme module imports the stylesheet, which the node test environment
// cannot parse; the list's order is what is under test, not its paint.
jest.mock("./theme", () => {
  const React = require("react");
  return {
    IEPanel: ({title, children}: any) => React.createElement("section", null, React.createElement("h3", null, title), children),
    IEBadge: ({children}: any) => React.createElement("span", null, children),
  };
});

import {SpacePanel} from "./SpacePanel";
import {setupImperialElegy} from "../engine/setup";
import {placeUnit} from "../engine/effects";
import {ieStringsFor} from "./i18n";
import type {ImperialElegyState, Power} from "../types";
import * as moves from "../moves";

const testCtx = {
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => {}, setPhase: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "action",
} as unknown as Ctx;

const freshGame = (cp: number): ImperialElegyState => {
  const G = setupImperialElegy(testCtx);
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = cp;
  return G;
};

const render = (G: ImperialElegyState, over: Partial<React.ComponentProps<typeof SpacePanel>> = {}): string =>
  renderToStaticMarkup(
    <SpacePanel
      G={G}
      selected="berlin"
      selectedUnit={null}
      setSelectedUnit={() => undefined}
      battleFrom={null}
      setBattleFrom={() => undefined}
      navalFrom={null}
      setNavalFrom={() => undefined}
      viewer={"GE" as Power}
      me={G.powers.GE}
      locale="en"
      t={ieStringsFor("en")}
      phase="action"
      canAct
      canSpend={() => true}
      cpRemaining={G.cpRemaining}
      canActionCard
      pending={null}
      canDecide={false}
      war={null}
      gwJointNavalAllies={[]}
      gwJointNavalUnitIds={() => []}
      polishReserve={false}
      setPolishReserve={() => undefined}
      deployLimit={0}
      deployFree={false}
      canDeployHere={false}
      canGwDraft={false}
      canGwDeployHere={false}
      polishArmyDecision={null}
      polishReserveDecision={null}
      myOnMapArmies={1}
      myForts={0}
      myMinorAllies={0}
      ownLandInSelected={[]}
      ownNavalInSelected={[]}
      potentialLandTargets={[]}
      potentialNavalTargets={[]}
      selectedUnitDef={undefined}
      doAction={(fn) => fn()}
      moves={moves as unknown as Record<string, (...args: any[]) => void>}
      {...over}
    />,
  );

/** The row ids in document order, from the grouped list only. */
const groupedRowIds = (html: string): string[] => {
  const list = html.slice(html.indexOf('data-testid="ie-action-list"'));
  return [...list.matchAll(/data-testid="ie-action-([a-zA-Z]+)"/g)].map((match) => match[1]);
};

const stripButtonCount = (html: string): number =>
  (html.match(/data-testid="ie-action-now-/g) ?? []).length;

describe("the available-now strip", () => {
  test("repeats exactly the legal rows above the grouped list", () => {
    const G = freshGame(6);
    placeUnit(G, "GE", "army", "berlin", 2);
    const html = render(G);
    const enabled = (html.match(/data-enabled="true"/g) ?? []).length;
    expect(enabled).toBeGreaterThan(0);
    expect(stripButtonCount(html)).toBe(enabled);
    // The strip precedes the first group, so it is reachable without scrolling.
    expect(html.indexOf('data-testid="ie-action-available"'))
      .toBeLessThan(html.indexOf('data-testid="ie-actions-recruit"'));
  });

  test("is omitted when nothing is legal", () => {
    const G = freshGame(0);
    // Zero CP refuses every spending row on a home key.
    const html = render(G, {canSpend: () => false});
    if ((html.match(/data-enabled="true"/g) ?? []).length === 0) {
      expect(html).not.toContain('data-testid="ie-action-available"');
    }
  });

  test("the grouped list still renders every row, legal or not", () => {
    const G = freshGame(6);
    const html = render(G);
    // UI_CHECKLIST §4: a disabled row stays visible with its reason, so the
    // strip must not have replaced the list.
    expect(groupedRowIds(html).length).toBeGreaterThan(stripButtonCount(html));
    expect(html).toContain("ie-action-reason");
  });
});

describe("rows inside a group", () => {
  test("legal rows sort before refused ones", () => {
    const G = freshGame(6);
    placeUnit(G, "GE", "army", "berlin", 2);
    const html = render(G);
    const groups = [...html.matchAll(/data-testid="ie-actions-([a-zA-Z]+)"[^>]*>(.*?)<\/section>/gs)];
    expect(groups.length).toBeGreaterThan(0);
    for (const [, name, body] of groups) {
      const flags = [...body.matchAll(/data-enabled="(true|false)"/g)].map((match) => match[1]);
      const firstDisabled = flags.indexOf("false");
      if (firstDisabled === -1) continue;
      // Nothing legal may follow a refused row within the same group.
      expect({group: name, trailing: flags.slice(firstDisabled).filter((flag) => flag === "true")})
        .toEqual({group: name, trailing: []});
    }
  });
});
