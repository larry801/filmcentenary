/**
 * Response-window coverage for the limited-war alliance step.
 *
 * A064 Secret Treaty is printed for the alliance step, and A063 Rapid
 * Mobilization is printed for the start of the Maneuver Step but is also legal
 * at the alliance-to-maneuver transition.  A023/A024 stay maneuver-only, and
 * only the active belligerent may use the maneuver window.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";

jest.mock("./components/theme", () => {
  const React = require("react");
  return {
    IESurface: ({children, className}: any) => React.createElement("div", {className}, children),
    IEPanel: ({title, children, actions}: any) => React.createElement("section", null, React.createElement("h3", null, title), actions, children),
    IEBadge: ({children}: any) => React.createElement("span", null, children),
    IEChip: ({children}: any) => React.createElement("span", null, children),
  };
});

jest.mock("./components/map", () => {
  const React = require("react");
  return {
    IEMap: (props: any) => React.createElement("svg", {
      "data-testid": "ie-map",
      "data-move": (props.moveTargets ?? []).join(","),
      "data-battle": (props.battleTargets ?? []).join(","),
      "data-legal": (props.legalTargets ?? []).join(","),
    }),
  };
});

import {ImperialElegyBoard} from "./components/board";
import {setupImperialElegy} from "./engine/setup";
import {createWarState, initiativeOrder} from "./engine/limitedWar";
import {
  clearWarDurationFlags,
  playResponseCard,
  responseCardEligibility,
  responseWindowFor,
  startWarManeuver,
} from "./moves";
import {POWERS, type ImperialElegyState, type WarState} from "./types";

const makeCtx = (playerID: string | null = "0") => ({
  playerID,
  random: {Die: (n: number) => 3, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "action",
}) as any;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const clearHands = (G: ImperialElegyState): void => {
  for (const p of POWERS) G.powers[p].hand = [];
};

/** GE attacks AU; the alliance step is open and RU may have joined as an ally. */
const allianceWar = (G: ImperialElegyState, withAlly = false): WarState => {
  G.phase = "wartime";
  G.activePower = "GE";
  G.pending = null;
  G.war = createWarState(G, "GE", "AU", "conquest", ["bohemia"], 2);
  G.war.status = "alliance";
  if (withAlly) G.war.attackerAllies = ["RU"];
  return G.war;
};

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

test("A064 and A063 are legal at the alliance step for every belligerent", () => {
  const G = fresh();
  allianceWar(G, true);

  for (const power of ["GE", "AU", "RU"] as const) {
    expect(responseWindowFor(G, power)).toEqual({ok: true});
    expect(responseCardEligibility(G, power, "IE-A064")).toEqual({ok: true});
    expect(responseCardEligibility(G, power, "IE-A063")).toEqual({ok: true});
  }

  // The alliance window does not open the maneuver-only cards.
  expect(responseCardEligibility(G, "GE", "IE-A023")).toEqual({ok: false, reason: "war-status"});
  expect(responseCardEligibility(G, "GE", "IE-A024")).toEqual({ok: false, reason: "war-status"});

  // A non-belligerent is not the active power and has no alliance voice.
  expect(responseWindowFor(G, "UK")).toEqual({ok: false, reason: "not-active"});
  expect(responseCardEligibility(G, "UK", "IE-A064")).toEqual({ok: false, reason: "not-active"});
  expect(responseCardEligibility(G, "UK", "IE-A063")).toEqual({ok: false, reason: "not-active"});
});

test("A064 resolves at the alliance step for the attacker and for an ally", () => {
  const attacker = fresh();
  allianceWar(attacker);
  clearHands(attacker);
  attacker.powers.GE.hand = ["IE-A064"];
  attacker.spaces.hanover.ally = "AU";

  expect(playResponseCard(attacker, makeCtx("0"), "IE-A064")).toBeUndefined();
  expect(attacker.powers.GE.hand).not.toContain("IE-A064");
  expect(attacker.spaces.hanover.ally).toBe("GE");

  const ally = fresh();
  allianceWar(ally, true);
  clearHands(ally);
  ally.powers.RU.hand = ["IE-A064"];
  ally.spaces.hanover.ally = "AU";

  expect(playResponseCard(ally, makeCtx("4"), "IE-A064")).toBeUndefined();
  expect(ally.powers.RU.hand).not.toContain("IE-A064");
  expect(ally.spaces.hanover.ally).toBe("RU");
});

test("the maneuver step keeps A063 for the active belligerent and rejects A064", () => {
  const G = fresh();
  const war = allianceWar(G, true);
  war.status = "maneuver";

  expect(responseWindowFor(G, "GE")).toEqual({ok: true});
  expect(responseCardEligibility(G, "GE", "IE-A064")).toEqual({ok: false, reason: "war-status"});
  expect(responseCardEligibility(G, "GE", "IE-A063")).toEqual({ok: true});
  expect(responseCardEligibility(G, "GE", "IE-A023")).toEqual({ok: true});
  expect(responseCardEligibility(G, "GE", "IE-A024")).toEqual({ok: true});

  // The ally is participating but does not hold the maneuver impulse.
  expect(responseWindowFor(G, "RU")).toEqual({ok: false, reason: "not-active"});
  expect(responseCardEligibility(G, "RU", "IE-A063")).toEqual({ok: false, reason: "not-active"});
});

test("a battle blocks the alliance response window", () => {
  const G = fresh();
  allianceWar(G);
  G.battle = {} as ImperialElegyState["battle"];

  expect(responseWindowFor(G, "GE")).toEqual({ok: false, reason: "battle"});
  expect(responseCardEligibility(G, "GE", "IE-A064")).toEqual({ok: false, reason: "battle"});
});

// ---------------------------------------------------------------------------
// Rapid Mobilization initiative
// ---------------------------------------------------------------------------

test("startWarManeuver puts the A063 player first, ahead of the initiative order", () => {
  const G = fresh();
  const war = allianceWar(G, true);
  G.powers.GE.industry = 1;
  G.powers.AU.industry = 1;
  G.powers.RU.industry = 1;
  // Card CP 3 / 5 / 4: without A063 the order is AU, RU, GE.
  war.budgets = {GE: 4, AU: 6, RU: 5};
  expect(initiativeOrder(G, war)).toEqual(["AU", "RU", "GE"]);

  clearHands(G);
  G.powers.RU.hand = ["IE-A063"];
  const rapidCtx = makeCtx("4");
  expect(playResponseCard(G, rapidCtx, "IE-A063")).toBeUndefined();
  expect(G.flags.rapidMobilization).toBe(true);
  expect(G.powers.RU.flags.rapidMobilization).toBe(true);

  // The attacker still starts the maneuver, but A063 gives RU the first impulse.
  const attackerCtx = makeCtx("0");
  expect(startWarManeuver(G, attackerCtx)).toBeUndefined();
  expect(G.war?.status).toBe("maneuver");
  expect(G.war?.initiative).toEqual(["RU", "AU", "GE"]);
  expect(G.activePower).toBe("RU");
});

test("war settlement cleanup clears the recorded A063 belligerent", () => {
  const G = fresh();
  allianceWar(G);
  clearHands(G);
  G.powers.GE.hand = ["IE-A063"];
  expect(playResponseCard(G, makeCtx("0"), "IE-A063")).toBeUndefined();
  expect(G.powers.GE.flags.rapidMobilization).toBe(true);

  clearWarDurationFlags(G);

  expect(G.flags.rapidMobilization).toBe(false);
  expect(G.powers.GE.flags.rapidMobilization).toBeUndefined();
});

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

const html = (G: ImperialElegyState, playerID: string | null): string =>
  renderToStaticMarkup(React.createElement(ImperialElegyBoard, {
    G,
    ctx: makeCtx(),
    moves: {},
    playerID,
  }));

const buttonTag = (markup: string, testId: string): string =>
  markup.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>[\\s\\S]*?</button>`))?.[0] ?? "";

test("the alliance step renders A063/A064 response controls for belligerents only", () => {
  const G = fresh();
  const war = allianceWar(G, true);
  clearHands(G);
  G.powers.GE.hand = ["IE-A063", "IE-A064"];
  G.powers.RU.hand = ["IE-A064"];
  G.powers.UK.hand = ["IE-A064"];

  const attacker = html(G, "0");
  expect(buttonTag(attacker, "ie-response-IE-A063")).toContain("打出响应");
  expect(buttonTag(attacker, "ie-response-IE-A063")).not.toContain("disabled");
  expect(buttonTag(attacker, "ie-response-IE-A064")).toContain("打出响应");
  expect(buttonTag(attacker, "ie-response-IE-A064")).not.toContain("disabled");

  // A participating ally is not the active power but still gets the window.
  const ally = html(G, "4");
  expect(buttonTag(ally, "ie-response-IE-A064")).toContain("打出响应");
  expect(buttonTag(ally, "ie-response-IE-A064")).not.toContain("disabled");

  // A non-belligerent sees its card but no response control.
  const outsider = html(G, "1");
  expect(outsider).toContain("ie-card-IE-A064");
  expect(outsider).not.toContain("ie-response-IE-A064");

  // Spectators never receive private hand controls.
  expect(html(G, null)).not.toContain("ie-response-IE-A064");

  // Once the maneuver step starts, only the active belligerent gets a control.
  war.status = "maneuver";
  const maneuver = html(G, "0");
  expect(buttonTag(maneuver, "ie-response-IE-A064")).toContain("disabled");
  expect(buttonTag(maneuver, "ie-response-IE-A063")).not.toContain("disabled");
  expect(html(G, "4")).not.toContain("ie-response-IE-A064");
});
