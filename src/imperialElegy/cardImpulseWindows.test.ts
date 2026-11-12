/**
 * Printed card timing/window gates (round 4, agent 5):
 *  - A41 Prussian Military Tradition / A98 Dreyfus Affair / A54 Failed
 *    Reforms are only playable in the printed power's impulse window;
 *  - A41 and A98 have "no effect during the Great War";
 *  - A41's second, printed normal-event mode still works;
 *  - A59 Flank Attack stays attacker-only in the live battle window;
 *  - GW-10 Exhaustion never triggers on GW turn 0 (and stays playable, 27.3).
 */
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
  return {IEMap: () => React.createElement("svg", {"data-testid": "ie-map"})};
});

import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {INVALID_MOVE} from "boardgame.io/core";
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  playCard,
  playGwCardMove,
  playResponseCard,
  resolvePending,
  responseCardEligibility,
} from "./moves";
import {beginLandBattle, chooseSupport} from "./engine/combat";
import {placeUnit} from "./engine/effects";
import {eventPlayability, gwEventHint} from "./engine/playability";
import {ImperialElegyBoard} from "./components/board";

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    random: {Die: (n: number) => Math.min(n, 3)},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const clearHands = (G: ImperialElegyState): void => {
  for (const power of POWERS) G.powers[power].hand = [];
};

const setAction = (G: ImperialElegyState, power: Power, cp = 0): Ctx => {
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = cp;
  return makeCtx(seat(power));
};

const warState = (attacker: Power, defender: Power, status: WarState["status"]): WarState => ({
  attacker,
  defender,
  attackerAllies: [],
  defenderAllies: [],
  attackerMinors: [],
  defenderMinors: [],
  warAim: "conquest",
  objectives: [],
  status,
  budgets: {[attacker]: 2, [defender]: 2},
  initiative: [],
  treaties: [],
  victor: null,
  truceTurns: 2,
  passed: [],
  startedTurn: 1,
});

const gwState = (overrides: Partial<GreatWarState> = {}): ImperialElegyState => {
  const G = fresh();
  G.gw = {
    active: true,
    turn: 1,
    order: ["GE", "FR"],
    belligerents: ["GE", "FR"],
    neutrals: ["UK", "AU", "RU", "OT"],
    te: ["FR"],
    ta: ["GE"],
    usIn: false,
    italyIn: false,
    usStability: 3,
    usManpower: 3,
    usBudget: 4,
    italyStability: 3,
    italyManpower: 3,
    italyBudget: 2,
    trenches: {},
    lastColonialWar: null,
    victor: null,
    outbreakDone: true,
    nationalWillDone: true,
    bonusImpulses: [],
    ...overrides,
  };
  G.phase = "gwManeuver";
  G.activePower = "GE";
  return G;
};

// ---------------------------------------------------------------------------
// A41 Prussian Military Tradition
// ---------------------------------------------------------------------------
describe("A41 Prussian Military Tradition", () => {
  test("Germany may play it as a response at the start of its own action impulse", () => {
    const G = fresh();
    clearHands(G);
    const ctx = setAction(G, "GE");
    G.powers.GE.hand = ["IE-A041"];

    expect(responseCardEligibility(G, "GE", "IE-A041")).toEqual({ok: true});
    expect(playResponseCard(G, ctx, "IE-A041")).toBeUndefined();
    expect(G.powers.GE.flags.landDrm).toBe(1);
    expect(G.discard).toContain("IE-A041");
  });

  test("another power's impulse is the printed-power gate, not a silent no-op", () => {
    const G = fresh();
    clearHands(G);
    const ctx = setAction(G, "UK");
    G.powers.UK.hand = ["IE-A041"];
    const before = JSON.stringify(G);

    expect(responseCardEligibility(G, "UK", "IE-A041")).toEqual({ok: false, reason: "printed-power"});
    expect(playResponseCard(G, ctx, "IE-A041")).toBe(INVALID_MOVE);
    expect(JSON.stringify(G)).toBe(before);
  });

  test("it is legal at the start of a German wartime maneuver impulse", () => {
    const G = fresh();
    clearHands(G);
    G.phase = "wartime";
    G.activePower = "GE";
    G.war = warState("GE", "RU", "maneuver");
    G.powers.GE.hand = ["IE-A041"];
    const ctx = makeCtx(seat("GE"));

    expect(responseCardEligibility(G, "GE", "IE-A041")).toEqual({ok: true});
    expect(playResponseCard(G, ctx, "IE-A041")).toBeUndefined();
    expect(G.powers.GE.flags.landDrm).toBe(1);
  });

  test("the limited-war alliance step is not an impulse window", () => {
    const G = fresh();
    clearHands(G);
    G.phase = "wartime";
    G.activePower = "GE";
    G.war = warState("GE", "RU", "alliance");
    G.powers.GE.hand = ["IE-A041"];

    expect(responseCardEligibility(G, "GE", "IE-A041")).toEqual({ok: false, reason: "war-status"});
  });

  test("the printed no-effect-during-the-GW clause closes the response window", () => {
    const G = gwState();
    clearHands(G);
    G.powers.GE.flags.gwActionsThisImpulse = 0;
    G.powers.GE.hand = ["IE-A041"];
    const before = JSON.stringify(G);

    expect(responseCardEligibility(G, "GE", "IE-A041")).toEqual({ok: false, reason: "no-effect-gw"});
    expect(playResponseCard(G, makeCtx(seat("GE")), "IE-A041")).toBe(INVALID_MOVE);
    expect(JSON.stringify(G)).toBe(before);
  });

  test("its second printed mode is a normal event during the German impulse", () => {
    const G = fresh();
    clearHands(G);
    G.powers.UK.hand = ["IE-A018"];
    const ctx = setAction(G, "GE");
    G.powers.GE.hand = ["IE-A041"];

    expect(eventPlayability(G, "GE", "IE-A041")).toEqual({ok: true});
    expect(playCard(G, ctx, "IE-A041", "event")).toBeUndefined();
    expect(G.powers.GE.flags.landDrm).toBe(1);
    expect(G.discard).toContain("IE-A041");
  });

  test("the normal-event mode is still Germany-only", () => {
    const G = fresh();
    clearHands(G);
    const ctx = setAction(G, "UK");
    G.powers.UK.hand = ["IE-A041"];

    expect(eventPlayability(G, "UK", "IE-A041")).toEqual({ok: false, reason: "power-list"});
    expect(playCard(G, ctx, "IE-A041", "event")).toBe(INVALID_MOVE);
    expect(G.powers.UK.hand).toContain("IE-A041");
    expect(G.powers.GE.flags.landDrm).toBeUndefined();
    expect(G.discard).not.toContain("IE-A041");
  });

  test("the event mode has no effect during the Great War", () => {
    const G = gwState();
    clearHands(G);
    const ctx = setAction(G, "GE");
    G.powers.GE.flags.landDrm = 0;
    G.powers.GE.hand = ["IE-A041"];

    expect(playCard(G, ctx, "IE-A041", "event")).toBeUndefined();
    expect(G.powers.GE.flags.landDrm ?? 0).toBe(0);
    expect(G.discard).toContain("IE-A041");
  });
});

// ---------------------------------------------------------------------------
// A98 Dreyfus Affair
// ---------------------------------------------------------------------------
describe("A98 Dreyfus Affair", () => {
  test("France may play it at the start of the French impulse", () => {
    const G = fresh();
    clearHands(G);
    const ctx = setAction(G, "FR");
    G.powers.FR.hand = ["IE-A098"];

    expect(responseCardEligibility(G, "FR", "IE-A098")).toEqual({ok: true});
    expect(playResponseCard(G, ctx, "IE-A098")).toBeUndefined();
    expect(G.powers.FR.flags.frLandDrm).toBe(-1);
    expect(G.discard).toContain("IE-A098");
  });

  test("another power cannot play it for France", () => {
    const G = fresh();
    clearHands(G);
    const ctx = setAction(G, "GE");
    G.powers.GE.hand = ["IE-A098"];

    expect(responseCardEligibility(G, "GE", "IE-A098")).toEqual({ok: false, reason: "printed-power"});
    expect(playResponseCard(G, ctx, "IE-A098")).toBe(INVALID_MOVE);
    expect(G.powers.GE.flags.frLandDrm).toBeUndefined();
  });

  test("the printed no-effect-during-the-GW clause closes the response window", () => {
    const G = gwState();
    clearHands(G);
    G.activePower = "FR";
    G.powers.GE.flags.gwActionsThisImpulse = 0;
    G.powers.FR.hand = ["IE-A098"];

    expect(responseCardEligibility(G, "FR", "IE-A098")).toEqual({ok: false, reason: "no-effect-gw"});
    expect(playResponseCard(G, makeCtx(seat("FR")), "IE-A098")).toBe(INVALID_MOVE);
    expect(G.powers.FR.flags.frLandDrm).toBeUndefined();
  });

  test("it has no normal-event mode", () => {
    const G = fresh();
    clearHands(G);
    G.powers.FR.hand = ["IE-A098"];

    expect(eventPlayability(G, "FR", "IE-A098")).toEqual({ok: false, reason: "battle-window"});
  });
});

// ---------------------------------------------------------------------------
// A54 Failed Reforms
// ---------------------------------------------------------------------------
describe("A54 Failed Reforms", () => {
  test("only the Ottoman impulse window is open", () => {
    const G = fresh();
    clearHands(G);
    setAction(G, "OT");
    G.powers.OT.hand = ["IE-A054"];

    expect(responseCardEligibility(G, "OT", "IE-A054")).toEqual({ok: true});
    expect(responseCardEligibility(G, "GE", "IE-A054")).toEqual({ok: false, reason: "not-active"});
  });

  test("at the Ottoman impulse the printed-power gate still excludes other seats", () => {
    const G = fresh();
    clearHands(G);
    setAction(G, "OT");
    G.powers.GE.hand = ["IE-A054"];

    // The window is OT's, so a non-active seat fails the window first.
    expect(responseCardEligibility(G, "GE", "IE-A054")).toEqual({ok: false, reason: "not-active"});
    // At the GE seat's own window the printed-power gate is what refuses it.
    setAction(G, "GE");
    G.powers.GE.hand = ["IE-A054"];
    expect(responseCardEligibility(G, "GE", "IE-A054")).toEqual({ok: false, reason: "printed-power"});
  });
});

// ---------------------------------------------------------------------------
// A59 Flank Attack
// ---------------------------------------------------------------------------
describe("A59 Flank Attack", () => {
  test("the live battle window offers it only to the attacker", () => {
    const G = fresh();
    G.phase = "wartime";
    G.activePower = "GE";
    G.war = warState("GE", "RU", "maneuver");
    placeUnit(G, "GE", "army", "berlin", 2);
    placeUnit(G, "RU", "army", "saxony", 2);
    clearHands(G);
    G.powers.GE.hand = ["IE-A059"];
    G.powers.RU.hand = ["IE-A059", "IE-A060"];
    const ctx = makeCtx(seat("GE"));

    const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    expect(battle).not.toBeNull();
    chooseSupport(G, ctx, "done");
    chooseSupport(G, ctx, "done");

    expect(G.pending?.kind).toBe("combatCard");
    expect(G.pending?.power).toBe("GE");
    expect((G.pending?.options ?? []).map((option) => option.id)).toContain("card:IE-A059");

    resolvePending(G, ctx, "done");
    expect(G.pending?.kind).toBe("combatCard");
    expect(G.pending?.power).toBe("RU");
    const defenderOptions = (G.pending?.options ?? []).map((option) => option.id);
    expect(defenderOptions).toContain("card:IE-A060");
    expect(defenderOptions).not.toContain("card:IE-A059");
  });
});

// ---------------------------------------------------------------------------
// GW-10 Exhaustion
// ---------------------------------------------------------------------------
describe("GW-10 Exhaustion", () => {
  test("playing it as an event on GW turn 0 triggers neither effect", () => {
    const G = gwState({turn: 0});
    G.powers.GE.gwCard = "IE-GW-10";
    G.powers.GE.gwBudget = 2;
    const ctx = makeCtx(seat("GE"));

    expect(playGwCardMove(G, ctx, "event")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.persistent.exhaustion).toBeUndefined();
    expect(G.gw!.discard).toContain("IE-GW-10");
    const logged = G.log.filter((entry) => entry.key === "gwTurnZero");
    expect(logged).toHaveLength(1);
    expect(logged[0].args).toMatchObject({card: "IE-GW-10"});
    // The card is mandatory (27.3), so the play stays legal; only the trigger
    // is gated.  The printed reason is exposed for the board.
    expect(gwEventHint(G, "IE-GW-10")).toBe("gw-turn-0");
  });

  test("its CP mode still works on GW turn 0", () => {
    const G = gwState({turn: 0});
    G.powers.GE.gwCard = "IE-GW-10";
    G.powers.GE.gwBudget = 2;
    const ctx = makeCtx(seat("GE"));

    expect(playGwCardMove(G, ctx, "cp")).toBeUndefined();
    expect(G.powers.GE.gwBudget).toBe(3);
    expect(G.persistent.exhaustion).toBeUndefined();
    expect(G.gw!.discard).toContain("IE-GW-10");
  });

  test("from GW turn 1 it opens the printed event choice and queues the mode", () => {
    const G = gwState({turn: 1});
    G.powers.GE.gwCard = "IE-GW-10";
    G.powers.GE.gwBudget = 2;
    const ctx = makeCtx(seat("GE"));

    expect(gwEventHint(G, "IE-GW-10")).toBeNull();
    expect(playGwCardMove(G, ctx, "event")).toBeUndefined();
    expect(G.pending?.kind).toBe("eventChoice");
    expect(resolvePending(G, ctx, "stability")).toBeUndefined();
    // "takes effect at the end of this impulse", not when the card resolves.
    expect(G.persistent.exhaustion).toBeUndefined();
    expect(G.gw?.exhaustionPending).toMatchObject({mode: "stability", turn: 1});
  });
});

// ---------------------------------------------------------------------------
// Board reasons (bilingual)
// ---------------------------------------------------------------------------
describe("board response reasons", () => {
  const buttonTag = (markup: string, testId: string): string =>
    markup.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>[\\s\\S]*?</button>`))?.[0] ?? "";

  const boardMarkup = (G: ImperialElegyState, power: Power): string =>
    renderToStaticMarkup(React.createElement(ImperialElegyBoard, {
      G,
      ctx: makeCtx(seat(power)),
      moves: {},
      playerID: seat(power),
    }));

  test("A98 at the wrong seat prints the printed-power reason", () => {
    const G = fresh();
    clearHands(G);
    setAction(G, "UK");
    G.powers.UK.hand = ["IE-A098"];
    const button = buttonTag(boardMarkup(G, "UK"), "ie-response-IE-A098");
    expect(button).toContain("disabled");
    expect(button).toContain("此响应牌只能在卡面指定国家的行动轮开始时打出");
  });

  test("A41's GW response is disabled with the no-effect reason", () => {
    const G = gwState();
    clearHands(G);
    G.powers.GE.flags.gwActionsThisImpulse = 0;
    G.powers.GE.hand = ["IE-A041"];
    const button = buttonTag(boardMarkup(G, "GE"), "ie-response-IE-A041");
    expect(button).toContain("disabled");
    expect(button).toContain("此事件在大战期间无效");
  });

  test("A41's normal event button is enabled for Germany", () => {
    const G = fresh();
    clearHands(G);
    setAction(G, "GE");
    G.powers.GE.hand = ["IE-A041"];
    const button = buttonTag(boardMarkup(G, "GE"), "ie-play-event-IE-A041");
    expect(button).not.toBe("");
    expect(button).not.toContain("disabled");
  });
});
