/**
 * Coverage for the two documented fallbacks:
 *  - rule 16.2 realignment asks the winner which legal minor to realign;
 *  - response cards work at the start of wartime and GW maneuver impulses,
 *    while respecting their printed `warOnly` / `gwOnly` era restrictions.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {INVALID_MOVE} from "boardgame.io/core";

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
import {classifyVictory, createWarState, type VictoryClassification} from "./engine/limitedWar";
import {treatyOptionsFor} from "./engine/treatyChoice";
import {cardById} from "./engine/deck";
import {MINOR_POWER_HOMES} from "./constant/setup";
import {placeMpit, playResponseCard, resolvePending, resolveWar} from "./moves";
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

const warState = (status: WarState["status"] = "maneuver"): WarState => ({
  attacker: "GE",
  defender: "AU",
  attackerAllies: [],
  defenderAllies: [],
  attackerMinors: [],
  defenderMinors: [],
  warAim: "conquest",
  objectives: ["bohemia"],
  status,
  budgets: {GE: 5},
  initiative: ["GE", "AU"],
  treaties: [],
  victor: null,
  truceTurns: 2,
  passed: [],
  startedTurn: 1,
});

/** GE occupies AU-controlled Bohemia, which is a normal victory for GE. */
const makeWar = (G: ImperialElegyState, aim: "conquest" | "unification" = "conquest"): WarState => {
  G.phase = "wartime";
  G.activePower = "GE";
  G.pending = null;
  G.spaces.bohemia.control = "AU";
  G.spaces.bohemia.occupiedBy = "GE";
  const war = createWarState(G, "GE", "AU", aim, ["bohemia"], 2);
  G.war = war;
  return war;
};

const openTreatyChooser = (G: ImperialElegyState): void => {
  const ctx = makeCtx("0");
  expect(resolveWar(G, ctx)).toBeUndefined();
  expect(G.pending?.kind).toBe("treatyOption");
};

// ---------------------------------------------------------------------------
// Rule 16.2 — realignment minor chooser
// ---------------------------------------------------------------------------

test("realignment with three legal minors opens a minor chooser and applies the chosen minor", () => {
  const G = fresh();
  G.spaces.hanover.ally = "AU";
  G.spaces.saxony.ally = "AU";
  G.spaces.bavaria.ally = "AU";
  makeWar(G);
  const ctx = makeCtx("0");

  const war = G.war!;
  const victory = classifyVictory(G, war);
  const entry = treatyOptionsFor(G, war, victory).find((option) => option.option === "realignment")!;
  expect(entry.minors).toEqual(["Hanover", "Saxony", "Bavaria"]);
  expect(entry.requiresMinor).toBe(true);
  // The engine's default is the first legal minor; the chooser must override it.
  expect(entry.choice.minor).toBe("Hanover");

  openTreatyChooser(G);
  expect(resolvePending(G, ctx, "realignment")).toBeUndefined();

  expect(G.pending?.kind).toBe("treatySpace");
  expect(G.pending?.context?.kind).toBe("minor");
  expect(G.pending?.power).toBe("GE");
  const minors = G.pending!.options.map((option) => option.id);
  expect(minors).toEqual(["Hanover", "Saxony", "Bavaria"]);

  // Pick the second minor; the default (Hanover) must not win silently.
  const chosen = minors[1];
  expect(resolvePending(G, ctx, chosen)).toBeUndefined();

  const home = MINOR_POWER_HOMES[chosen];
  expect(G.spaces[home].ally).toBe("GE");
  expect(G.spaces[MINOR_POWER_HOMES.Hanover].ally).toBe("AU");
  expect(G.wars.at(-1)?.treaties).toContain("realignment");
  expect(G.war).toBeNull();
});

test("realignment without a named minor keeps the GE unification special", () => {
  const G = fresh();
  // A German-flashpoint space allied to the loser, but not one of the named
  // MINOR_POWER_HOMES minors: the entry can only apply the unification special.
  G.spaces.silesia.ally = "AU";
  const war = makeWar(G, "unification");
  const victory: VictoryClassification = classifyVictory(G, war);
  const entry = treatyOptionsFor(G, war, victory).find((option) => option.option === "realignment")!;
  expect(entry.minors).toEqual([]);
  expect(entry.requiresMinor).toBe(false);

  openTreatyChooser(G);
  const ctx = makeCtx("0");
  expect(resolvePending(G, ctx, "realignment")).toBeUndefined();

  expect(G.spaces.silesia.ally).toBe("GE");
  expect(G.wars.at(-1)?.treaties).toContain("realignment");
  expect(G.war).toBeNull();
});

test("an invalid minor choice leaves the chooser and the board unchanged", () => {
  const G = fresh();
  G.spaces.hanover.ally = "AU";
  G.spaces.saxony.ally = "AU";
  G.spaces.bavaria.ally = "AU";
  makeWar(G);
  const ctx = makeCtx("0");

  openTreatyChooser(G);
  expect(resolvePending(G, ctx, "realignment")).toBeUndefined();
  expect(G.pending?.context?.kind).toBe("minor");

  const before = JSON.stringify(G);
  expect(resolvePending(G, ctx, "NotAMinor")).toBe(INVALID_MOVE);
  expect(JSON.stringify(G)).toBe(before);

  // A legal id that has become stale is re-validated by applyTreaty and must
  // not mutate either.
  G.spaces.saxony.ally = null;
  const stale = JSON.stringify(G);
  expect(resolvePending(G, ctx, "Saxony")).toBe(INVALID_MOVE);
  expect(JSON.stringify(G)).toBe(stale);
  expect(G.war?.treaties ?? []).not.toContain("realignment");
  expect(G.pending?.context?.kind).toBe("minor");
});

// ---------------------------------------------------------------------------
// Response timing — wartime and Great War maneuver
// ---------------------------------------------------------------------------

const minimalGw = (): NonNullable<ImperialElegyState["gw"]> => ({
  active: true,
  turn: 2,
  order: ["GE", "UK", "FR", "AU", "RU", "OT"],
  belligerents: ["GE", "FR"],
  neutrals: [],
  te: ["GE"],
  ta: ["FR"],
  usIn: false,
  italyIn: false,
  usStability: 0,
  usManpower: 0,
  usBudget: 0,
  italyStability: 0,
  italyManpower: 0,
  italyBudget: 0,
  trenches: {},
  lastColonialWar: null,
  victor: null,
  outbreakDone: true,
  nationalWillDone: false,
  bonusImpulses: [],
});

test("a warOnly response resolves at the start of a wartime maneuver impulse", () => {
  const G = fresh();
  G.phase = "wartime";
  G.activePower = "GE";
  G.war = warState("maneuver");
  clearHands(G);
  G.powers.GE.hand = ["IE-A023"];
  const ctx = makeCtx("0");

  expect(playResponseCard(G, ctx, "IE-A023")).toBeUndefined();

  expect(G.flags.warLandDrm).toBe(1);
  expect(G.powers.GE.hand).not.toContain("IE-A023");
  expect(G.discard).toContain("IE-A023");
  // The response window is an impulse start, not a phase transition.
  expect(G.phase).toBe("wartime");
  expect(G.activePower).toBe("GE");
});

test("a response resolves at the start of a GW maneuver impulse", () => {
  const G = fresh();
  G.phase = "gwManeuver";
  G.activePower = "GE";
  G.gw = minimalGw();
  G.powers.GE.flags.gwActionsThisImpulse = 0;
  clearHands(G);
  // A41/A98 are printed "no effect during the Great War"; this test is about
  // the generic GW response window, so use another printed impulse response.
  G.powers.GE.hand = ["IE-A089"];
  const ctx = makeCtx("0");

  expect(playResponseCard(G, ctx, "IE-A089")).toBeUndefined();

  expect(G.powers.GE.hand).not.toContain("IE-A089");
  expect(G.discard).toContain("IE-A089");
  expect(G.phase).toBe("gwManeuver");
});

test("warOnly responses are rejected outside a limited war", () => {
  const ctx = makeCtx("0");

  // Action phase with no war: the printed limited-war window is not open.
  const action = fresh();
  action.phase = "action";
  action.activePower = "GE";
  action.cpRemaining = 0;
  clearHands(action);
  action.powers.GE.hand = ["IE-A023"];
  const actionBefore = JSON.stringify(action);
  expect(playResponseCard(action, ctx, "IE-A023")).toBe(INVALID_MOVE);
  expect(JSON.stringify(action)).toBe(actionBefore);

  // Great War maneuver: warOnly is still wrong.
  const gw = fresh();
  gw.phase = "gwManeuver";
  gw.activePower = "GE";
  gw.gw = minimalGw();
  gw.powers.GE.flags.gwActionsThisImpulse = 0;
  clearHands(gw);
  gw.powers.GE.hand = ["IE-A023"];
  const gwBefore = JSON.stringify(gw);
  expect(playResponseCard(gw, ctx, "IE-A023")).toBe(INVALID_MOVE);
  expect(JSON.stringify(gw)).toBe(gwBefore);
});

test("gwOnly responses are rejected outside an active Great War", () => {
  // A41 is printed "no effect during the Great War", so the generic gwOnly
  // window is exercised through another printed impulse response.
  const card = cardById("IE-A089");
  card.gwOnly = true;
  try {
    const ctx = makeCtx("0");

    const action = fresh();
    action.phase = "action";
    action.activePower = "GE";
    action.cpRemaining = 0;
    clearHands(action);
    action.powers.GE.hand = ["IE-A089"];
    const before = JSON.stringify(action);
    expect(playResponseCard(action, ctx, "IE-A089")).toBe(INVALID_MOVE);
    expect(JSON.stringify(action)).toBe(before);

    const wartime = fresh();
    wartime.phase = "wartime";
    wartime.activePower = "GE";
    wartime.war = warState("maneuver");
    clearHands(wartime);
    wartime.powers.GE.hand = ["IE-A089"];
    const warBefore = JSON.stringify(wartime);
    expect(playResponseCard(wartime, ctx, "IE-A089")).toBe(INVALID_MOVE);
    expect(JSON.stringify(wartime)).toBe(warBefore);

    // The same card is legal during the GW maneuver when gwOnly is set.
    const gw = fresh();
    gw.phase = "gwManeuver";
    gw.activePower = "GE";
    gw.gw = minimalGw();
    gw.powers.GE.flags.gwActionsThisImpulse = 0;
    clearHands(gw);
    gw.powers.GE.hand = ["IE-A089"];
    expect(playResponseCard(gw, ctx, "IE-A089")).toBeUndefined();
    expect(gw.discard).toContain("IE-A089");
  } finally {
    delete card.gwOnly;
  }
});

test("a response cannot be played mid-action after CP has been spent", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 1;
  clearHands(G);
  G.powers.GE.hand = ["IE-A041"];
  const ctx = makeCtx("0");

  expect(placeMpit(G, ctx, "RU", "te")).toBeUndefined();
  expect(G.cpRemaining).toBe(0);

  const before = JSON.stringify(G);
  expect(playResponseCard(G, ctx, "IE-A041")).toBe(INVALID_MOVE);
  expect(JSON.stringify(G)).toBe(before);
  expect(G.powers.GE.hand).toContain("IE-A041");
});

test("combat-window cards are rejected by the impulse response path", () => {
  const ctx = makeCtx("0");

  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  clearHands(G);
  G.powers.GE.hand = ["IE-A043"];
  const before = JSON.stringify(G);
  expect(playResponseCard(G, ctx, "IE-A043")).toBe(INVALID_MOVE);
  expect(JSON.stringify(G)).toBe(before);

  const gw = fresh();
  gw.phase = "gwManeuver";
  gw.activePower = "GE";
  gw.gw = minimalGw();
  gw.powers.GE.flags.gwActionsThisImpulse = 0;
  clearHands(gw);
  gw.powers.GE.hand = ["IE-GW-06"];
  const gwBefore = JSON.stringify(gw);
  expect(playResponseCard(gw, ctx, "IE-GW-06")).toBe(INVALID_MOVE);
  expect(JSON.stringify(gw)).toBe(gwBefore);
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

test("the response button follows the impulse window and hides from other seats", () => {
  const warGame = fresh();
  warGame.phase = "wartime";
  warGame.activePower = "GE";
  warGame.war = warState("maneuver");
  clearHands(warGame);
  warGame.powers.GE.hand = ["IE-A023"];

  const warMarkup = html(warGame, "0");
  expect(buttonTag(warMarkup, "ie-response-IE-A023")).toContain("打出响应");
  expect(buttonTag(warMarkup, "ie-response-IE-A023")).not.toContain("disabled");

  const gwGame = fresh();
  gwGame.phase = "gwManeuver";
  gwGame.activePower = "GE";
  gwGame.gw = minimalGw();
  gwGame.powers.GE.flags.gwActionsThisImpulse = 0;
  clearHands(gwGame);
  gwGame.powers.GE.hand = ["IE-A089"];
  const gwMarkup = html(gwGame, "0");
  expect(buttonTag(gwMarkup, "ie-response-IE-A089")).toContain("打出响应");
  expect(buttonTag(gwMarkup, "ie-response-IE-A089")).not.toContain("disabled");

  // Action phase: a warOnly card is visible but disabled with a reason.
  const actionGame = fresh();
  actionGame.phase = "action";
  actionGame.activePower = "GE";
  actionGame.cpRemaining = 0;
  clearHands(actionGame);
  actionGame.powers.GE.hand = ["IE-A023"];
  const actionMarkup = html(actionGame, "0");
  const disabled = buttonTag(actionMarkup, "ie-response-IE-A023");
  expect(disabled).toContain("disabled");
  expect(disabled).toMatch(/title="[^"]*(limited war|有限战争)/);

  // A non-active seat never gets the response control.
  const inactive = fresh();
  inactive.phase = "wartime";
  inactive.activePower = "FR";
  inactive.war = warState("maneuver");
  clearHands(inactive);
  inactive.powers.GE.hand = ["IE-A023"];
  const inactiveMarkup = html(inactive, "0");
  expect(inactiveMarkup).toContain("ie-card-IE-A023");
  expect(inactiveMarkup).not.toContain("ie-response-IE-A023");

  // Spectators do not see hands or response controls at all.
  expect(html(actionGame, null)).not.toContain("ie-response-IE-A023");
});
