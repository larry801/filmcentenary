/**
 * Remaining printed playability gates (round 3, agent 4):
 *  - the "Playable by …" power lists (A34/A36/A37/A75/A78/A79/A88/A110) and
 *    the "(Germany only after unification)" qualifier;
 *  - A70 Papal Influence's FR/AU clause and its "remove from the game if played
 *    for CP and Italy is unified" clause;
 *  - A54 Failed Reforms' "cannot be played after The Young Turks" window.
 *
 * The same `engine/playability.ts` predicate backs the live move and the board
 * event button, so the button tests assert the exact printed reason.
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
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {playCard, playResponseCard, responseCardEligibility} from "./moves";
import {eventPlayability, removeAfterCpPlay} from "./engine/playability";
import {ImperialElegyBoard} from "./components/board";
import {ieStringsFor} from "./components/i18n";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (sides: number) => Math.min(sides, dice[Math.min(index++, dice.length - 1)] ?? 3)},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const setActive = (G: ImperialElegyState, power: Power, cp = 0): void => {
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = cp;
  G.pending = null;
  G.battle = null;
  delete G.powers[power].flags.actionCpSpentThisImpulse;
};

const rejection = (G: ImperialElegyState, cardId: string) =>
  G.log.find((entry) => entry.key === "eventNotPlayable" && entry.args?.card === cardId);

/** Put the card in `power`'s hand and try to start its event. */
const playEvent = (G: ImperialElegyState, cardId: string, power: Power, dice: number[] = []): string | void => {
  setActive(G, power);
  if (!G.powers[power].hand.includes(cardId)) G.powers[power].hand.push(cardId);
  return playCard(G, makeCtx(dice, seat(power)), cardId, "event");
};

// ---------------------------------------------------------------------------
// Power lists
// ---------------------------------------------------------------------------
describe("printed power lists", () => {
  test("A34/A36 allow UK, FR, RU and a unified GE", () => {
    for (const card of ["IE-A034", "IE-A036"]) {
      for (const power of ["UK", "FR", "RU"] as Power[]) {
        expect(eventPlayability(fresh(), power, card)).toEqual({ok: true});
      }
      const notUnified = fresh();
      expect(eventPlayability(notUnified, "GE", card)).toEqual({ok: false, reason: "germany-unified"});
      notUnified.powers.GE.unified = true;
      expect(eventPlayability(notUnified, "GE", card)).toEqual({ok: true});
      const other = fresh();
      expect(eventPlayability(other, "OT", card)).toEqual({ok: false, reason: "power-list"});
      expect(eventPlayability(other, "AU", card)).toEqual({ok: false, reason: "power-list"});
    }
  });

  test("A37 allows the UK, Ottomans, France and Russia but not Germany", () => {
    for (const power of ["UK", "OT", "FR", "RU"] as Power[]) {
      expect(eventPlayability(fresh(), power, "IE-A037")).toEqual({ok: true});
    }
    expect(eventPlayability(fresh(), "GE", "IE-A037")).toEqual({ok: false, reason: "power-list"});
    expect(eventPlayability(fresh(), "AU", "IE-A037")).toEqual({ok: false, reason: "power-list"});
  });

  test("A75 excludes only the Ottomans", () => {
    for (const power of ["GE", "UK", "FR", "AU", "RU"] as Power[]) {
      expect(eventPlayability(fresh(), power, "IE-A075")).toEqual({ok: true});
    }
    expect(eventPlayability(fresh(), "OT", "IE-A075")).toEqual({ok: false, reason: "power-list"});
  });

  test("A78 allows GE without a unification qualifier", () => {
    for (const power of ["UK", "FR", "RU", "GE"] as Power[]) {
      expect(eventPlayability(fresh(), power, "IE-A078")).toEqual({ok: true});
    }
    expect(eventPlayability(fresh(), "AU", "IE-A078")).toEqual({ok: false, reason: "power-list"});
    expect(eventPlayability(fresh(), "OT", "IE-A078")).toEqual({ok: false, reason: "power-list"});
  });

  test("A79 and A88 need a unified Germany", () => {
    for (const card of ["IE-A079", "IE-A088"]) {
      expect(eventPlayability(fresh(), "UK", card)).toEqual({ok: true});
      expect(eventPlayability(fresh(), "FR", card)).toEqual({ok: true});
      if (card === "IE-A088") expect(eventPlayability(fresh(), "RU", card)).toEqual({ok: true});
      const notUnified = fresh();
      expect(eventPlayability(notUnified, "GE", card)).toEqual({ok: false, reason: "germany-unified"});
      notUnified.powers.GE.unified = true;
      expect(eventPlayability(notUnified, "GE", card)).toEqual({ok: true});
      expect(eventPlayability(fresh(), "OT", card)).toEqual({ok: false, reason: "power-list"});
    }
  });

  test("A110 excludes only the UK", () => {
    for (const power of ["GE", "FR", "AU", "RU", "OT"] as Power[]) {
      expect(eventPlayability(fresh(), power, "IE-A110")).toEqual({ok: true});
    }
    expect(eventPlayability(fresh(), "UK", "IE-A110")).toEqual({ok: false, reason: "power-list"});
  });

  test("the live event move rejects an illegal power but CP play still works", () => {
    const blocked = fresh();
    expect(playEvent(blocked, "IE-A110", "UK")).toBe(INVALID_MOVE);
    expect(rejection(blocked, "IE-A110")?.args?.reason).toBe("power-list");
    expect(blocked.powers.UK.hand).toContain("IE-A110");

    const cp = fresh();
    setActive(cp, "UK", 0);
    cp.powers.UK.hand.push("IE-A110");
    expect(playCard(cp, makeCtx([], seat("UK")), "IE-A110", "cp")).toBeUndefined();
    expect(cp.powers.UK.hand).not.toContain("IE-A110");

    const notUnified = fresh();
    expect(playEvent(notUnified, "IE-A034", "GE")).toBe(INVALID_MOVE);
    expect(rejection(notUnified, "IE-A034")?.args?.reason).toBe("germany-unified");
  });
});

// ---------------------------------------------------------------------------
// A70 Papal Influence
// ---------------------------------------------------------------------------
describe("A70 Papal Influence", () => {
  test("the event is printed for France and Austria only", () => {
    expect(eventPlayability(fresh(), "FR", "IE-A070")).toEqual({ok: true});
    expect(eventPlayability(fresh(), "AU", "IE-A070")).toEqual({ok: true});
    for (const power of ["GE", "UK", "RU", "OT"] as Power[]) {
      expect(eventPlayability(fresh(), power, "IE-A070")).toEqual({ok: false, reason: "power-list"});
    }
  });

  test("the Italy-unified reason wins over the power list", () => {
    const G = fresh();
    G.persistent.italyUnified = true;
    expect(eventPlayability(G, "FR", "IE-A070")).toEqual({ok: false, reason: "italy-unified"});
    expect(eventPlayability(G, "GE", "IE-A070")).toEqual({ok: false, reason: "italy-unified"});
  });

  test("the live event is rejected for a non-FR/AU power with the printed reason", () => {
    const G = fresh();
    expect(playEvent(G, "IE-A070", "UK")).toBe(INVALID_MOVE);
    expect(rejection(G, "IE-A070")?.args?.reason).toBe("power-list");
    expect(G.powers.UK.hand).toContain("IE-A070");
  });

  test("played for CP it is removed from the game once Italy is unified", () => {
    const G = fresh();
    G.persistent.italyUnified = true;
    setActive(G, "FR", 0);
    G.powers.FR.hand.push("IE-A070");
    expect(playCard(G, makeCtx([], seat("FR")), "IE-A070", "cp")).toBeUndefined();
    expect(G.removed).toContain("IE-A070");
    expect(G.discard).not.toContain("IE-A070");
    expect(removeAfterCpPlay(G, "IE-A070")).toBe(true);
  });

  test("played for CP before unification it is only discarded", () => {
    const G = fresh();
    setActive(G, "FR", 0);
    G.powers.FR.hand.push("IE-A070");
    expect(playCard(G, makeCtx([], seat("FR")), "IE-A070", "cp")).toBeUndefined();
    expect(G.discard).toContain("IE-A070");
    expect(G.removed).not.toContain("IE-A070");
    expect(removeAfterCpPlay(G, "IE-A070")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// A54 Failed Reforms / A106 The Young Turks
// ---------------------------------------------------------------------------
describe("A54 Failed Reforms", () => {
  test("the response is legal at the start of the Ottoman impulse", () => {
    const G = fresh();
    setActive(G, "OT", 0);
    G.powers.OT.hand.push("IE-A054");
    expect(responseCardEligibility(G, "OT", "IE-A054")).toEqual({ok: true});
  });

  test("The Young Turks closes the response window", () => {
    const G = fresh();
    setActive(G, "OT", 0);
    G.powers.OT.hand.push("IE-A054");
    G.persistent.youngTurks = true;
    expect(responseCardEligibility(G, "OT", "IE-A054")).toEqual({ok: false, reason: "young-turks"});
    expect(playResponseCard(G, makeCtx([], seat("OT")), "IE-A054")).toBe(INVALID_MOVE);
    expect(G.powers.OT.hand).toContain("IE-A054");
  });

  test("resolving A106 records the turn gate live", () => {
    const G = fresh();
    setActive(G, "OT", 0);
    G.powers.OT.hand.push("IE-A106");
    expect(playCard(G, makeCtx([], seat("OT")), "IE-A106", "event")).toBeUndefined();
    expect(G.persistent.youngTurks).toBe(true);
    // A mandatory play grants its CP; the response window needs a fresh impulse.
    G.cpRemaining = 0;
    G.pending = null;
    delete G.powers.OT.flags.actionCpSpentThisImpulse;
    G.powers.OT.hand.push("IE-A054");
    expect(responseCardEligibility(G, "OT", "IE-A054")).toEqual({ok: false, reason: "young-turks"});
  });

  test("a different response card is unaffected by The Young Turks", () => {
    const G = fresh();
    setActive(G, "OT", 0);
    G.persistent.youngTurks = true;
    G.powers.OT.hand.push("IE-A044");
    expect(responseCardEligibility(G, "OT", "IE-A044")).toEqual({ok: true});
  });
});

// ---------------------------------------------------------------------------
// Board event button
// ---------------------------------------------------------------------------
describe("board event button follows the printed gate", () => {
  const buttonTag = (markup: string, testId: string): string =>
    markup.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>[\\s\\S]*?</button>`))?.[0] ?? "";

  const boardMarkup = (G: ImperialElegyState, power: Power): string =>
    renderToStaticMarkup(React.createElement(ImperialElegyBoard, {
      G,
      ctx: makeCtx([], seat(power)),
      moves: {},
      playerID: seat(power),
    }));

  test("A110 is disabled for the UK with the power-list reason", () => {
    const G = fresh();
    setActive(G, "UK", 0);
    G.powers.UK.hand.push("IE-A110");
    const button = buttonTag(boardMarkup(G, "UK"), "ie-play-event-IE-A110");
    expect(button).toContain("disabled");
    expect(button).toContain("data-blocked=\"power-list\"");
    expect(button).toContain(ieStringsFor("zh_CN").playBlock["power-list"]);
  });

  test("A34 is disabled for an ununified Germany with the unification reason", () => {
    const G = fresh();
    setActive(G, "GE", 0);
    G.powers.GE.hand.push("IE-A034");
    const button = buttonTag(boardMarkup(G, "GE"), "ie-play-event-IE-A034");
    expect(button).toContain("disabled");
    expect(button).toContain("data-blocked=\"germany-unified\"");
    expect(button).toContain(ieStringsFor("zh_CN").playBlock["germany-unified"]);

    G.powers.GE.unified = true;
    const enabled = buttonTag(boardMarkup(G, "GE"), "ie-play-event-IE-A034");
    expect(enabled).not.toBe("");
    expect(enabled).not.toContain("disabled");
    expect(enabled).not.toContain("data-blocked");
  });

  test("A54's response button is disabled after The Young Turks", () => {
    const G = fresh();
    setActive(G, "OT", 0);
    G.powers.OT.hand.push("IE-A054");
    const open = buttonTag(boardMarkup(G, "OT"), "ie-response-IE-A054");
    expect(open).not.toBe("");
    expect(open).not.toContain("disabled");

    G.persistent.youngTurks = true;
    const closed = buttonTag(boardMarkup(G, "OT"), "ie-response-IE-A054");
    expect(closed).toContain("disabled");
    // The suite renders with the default (zh_CN) locale, like the board gates.
    expect(closed).toContain("青年土耳其党");
  });
});
