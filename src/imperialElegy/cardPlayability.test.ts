/**
 * Printed "Playable if / after" event gates (12.x card play).
 *
 * The predicate is engine-wide and the board renders the same decision, so a
 * disabled event button and a rejected `playCard(..., "event")` always agree.
 * CP play is deliberately untouched: a card may still be spent for CP unless
 * its own printed text says otherwise.
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
  return {IEMap: (props: any) => React.createElement("svg", {"data-testid": "ie-map"})};
});

import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {playCard} from "./moves";
import {canPlayEvent, eventPlayability, type PlayBlockReason} from "./engine/playability";
import {flashpointController} from "./engine/rules";
import {SPACES} from "./constant/spaces";
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

const setActive = (G: ImperialElegyState, power: Power): void => {
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = 0;
  G.pending = null;
  G.battle = null;
};

/** Put the card in `power`'s hand and try to start its event. */
const playEvent = (G: ImperialElegyState, cardId: string, power: Power = "GE", dice: number[] = []): string | void => {
  setActive(G, power);
  if (!G.powers[power].hand.includes(cardId)) G.powers[power].hand.push(cardId);
  return playCard(G, makeCtx(dice, seat(power)), cardId, "event");
};

const rejection = (G: ImperialElegyState, cardId: string) =>
  G.log.find((entry) => entry.key === "eventNotPlayable" && entry.args?.card === cardId);

const clearAfricanMarkers = (G: ImperialElegyState): void => {
  for (const def of Object.values(SPACES)) {
    if (def.region !== "africa") continue;
    G.spaces[def.id].control = null;
    G.spaces[def.id].influence = null;
  }
};

const clearBalkans = (G: ImperialElegyState): void => {
  for (const id of ["bosnia-herzegovina", "serbia", "bulgaria", "macedonia", "istanbul"]) {
    G.spaces[id].control = "Serbia";
  }
};

interface GateCase {
  card: string;
  reason: PlayBlockReason;
  block: (G: ImperialElegyState) => void;
  allow: (G: ImperialElegyState) => void;
  power?: Power;
}

const CASES: GateCase[] = [
  {
    card: "IE-A031",
    reason: "afghanistan-marker",
    block: () => undefined,
    allow: (G) => { G.spaces.afghanistan.influence = "UK"; },
  },
  {
    card: "IE-A049",
    reason: "bavaria-austrian",
    block: () => undefined,
    allow: (G) => { G.spaces.bavaria.ally = "AU"; },
  },
  {
    card: "IE-A068",
    reason: "acw",
    block: (G) => { G.persistent.acw = true; },
    allow: () => undefined,
  },
  {
    card: "IE-A070",
    reason: "italy-unified",
    block: (G) => { G.persistent.italyUnified = true; },
    allow: () => undefined,
    // A70 is printed "Playable by France and Austria"; use a legal power so the
    // specific Italy-unified reason is what this case pins.
    power: "FR",
  },
  {
    card: "IE-A071",
    reason: "egypt-minor",
    block: (G) => { G.spaces.egypt.control = "OT"; },
    allow: () => undefined,
  },
  {
    card: "IE-A081",
    reason: "central-asia",
    block: () => undefined,
    allow: (G) => { G.spaces["central-asia"].control = "RU"; },
  },
  {
    card: "IE-A087",
    reason: "mahdist-target",
    block: clearAfricanMarkers,
    allow: (G) => { G.spaces.algeria.influence = "FR"; },
  },
  {
    card: "IE-A096",
    reason: "meiji",
    block: () => undefined,
    allow: (G) => { G.persistent.meiji = true; },
  },
  {
    card: "IE-A102",
    reason: "morocco-other",
    block: (G) => { G.spaces.morocco.control = "GE"; },
    allow: (G) => { G.spaces.morocco.control = "FR"; },
  },
  {
    card: "IE-A103",
    reason: "balkans-ottoman",
    block: () => undefined,
    allow: clearBalkans,
  },
  {
    card: "IE-A108",
    reason: "dreadnought",
    block: () => undefined,
    allow: (G) => { G.persistent.dreadnoughts = true; },
  },
  {
    card: "IE-A112",
    reason: "franz-joseph",
    block: () => undefined,
    allow: (G) => { G.persistent.franzJosephDead = true; },
  },
  {
    card: "IE-H-AU-8",
    reason: "dual-monarchy",
    block: () => undefined,
    allow: (G) => { G.persistent.dualMonarchyPlayed = true; },
    power: "AU",
  },
];

describe("printed event playability — pure predicate", () => {
  test.each(CASES)("$card blocks and unblocks on its printed condition", ({card, reason, block, allow, power}) => {
    const blocked = fresh();
    block(blocked);
    const decision = eventPlayability(blocked, power ?? "GE", card);
    expect(decision).toEqual({ok: false, reason});
    expect(canPlayEvent(blocked, power ?? "GE", card)).toBe(false);

    const allowed = fresh();
    allow(allowed);
    expect(eventPlayability(allowed, power ?? "GE", card)).toEqual({ok: true});
    expect(canPlayEvent(allowed, power ?? "GE", card)).toBe(true);
  });

  test("unknown, response and combat cards are not event-playable", () => {
    const G = fresh();
    expect(eventPlayability(G, "GE", "IE-A999")).toEqual({ok: false, reason: "unknown-card"});
    expect(eventPlayability(G, "GE", "IE-A023")).toEqual({ok: false, reason: "battle-window"});
    expect(eventPlayability(G, "GE", "IE-A043")).toEqual({ok: false, reason: "battle-window"});
  });

  test("Bosnian Crisis is blocked only while the Ottomans dominate the Balkans", () => {
    const G = fresh();
    expect(flashpointController(G, "balkans")).toEqual(["OT"]);
    expect(canPlayEvent(G, "GE", "IE-A103")).toBe(false);
    clearBalkans(G);
    expect(flashpointController(G, "balkans")).toEqual([]);
    expect(canPlayEvent(G, "GE", "IE-A103")).toBe(true);
  });

  test("Meiji Restoration also opens Empire of the Sun through the turn flag", () => {
    const G = fresh();
    G.flags.meiji = true;
    expect(canPlayEvent(G, "GE", "IE-A096")).toBe(true);
  });

  test("playing A95 Death of Franz Joseph records its prerequisite for A112", () => {
    const G = fresh();
    expect(canPlayEvent(G, "GE", "IE-A112")).toBe(false);
    expect(playEvent(G, "IE-A095")).toBeUndefined();
    expect(G.persistent.franzJosephDead).toBe(true);
    expect(canPlayEvent(G, "GE", "IE-A112")).toBe(true);
  });

  test("playing A47 The Dual Monarchy records its prerequisite for AU-8", () => {
    const G = fresh();
    expect(canPlayEvent(G, "AU", "IE-H-AU-8")).toBe(false);
    expect(playEvent(G, "IE-A047", "AU")).toBeUndefined();
    expect(G.persistent.dualMonarchyPlayed).toBe(true);
    expect(canPlayEvent(G, "AU", "IE-H-AU-8")).toBe(true);
  });
});

describe("printed event playability — live playCard rejection", () => {
  test.each(CASES)("$card is rejected in event mode with a logged reason", ({card, reason, block, power}) => {
    const G = fresh();
    block(G);
    const actor = power ?? "GE";
    expect(playEvent(G, card, actor)).toBe(INVALID_MOVE);
    expect(G.powers[actor].hand).toContain(card);
    expect(G.pending).toBeNull();
    expect(rejection(G, card)?.args?.reason).toBe(reason);
    expect(G.resolvingCard).toBeNull();
  });

  test("a blocked event stays playable for CP", () => {
    const G = fresh();
    G.spaces.egypt.control = "OT";
    setActive(G, "GE");
    G.powers.GE.hand.push("IE-A071");
    expect(playCard(G, makeCtx([], seat("GE")), "IE-A071", "cp")).toBeUndefined();
    expect(G.cpRemaining).toBe(2);
    expect(G.powers.GE.hand).not.toContain("IE-A071");
  });

  test("a gated event plays through when its condition is met", () => {
    const G = fresh();
    G.persistent.dreadnoughts = true;
    expect(playEvent(G, "IE-A108")).toBeUndefined();
    expect(G.pending?.kind).toBe("eventTargetPower");
    expect(G.pending?.options.map((option) => option.id)).toContain("FR");
  });

  test("Empire of the Sun plays after Meiji and opens the Korea/Manchuria choice", () => {
    const G = fresh();
    G.persistent.meiji = true;
    const wttBefore = G.wtt;
    expect(playEvent(G, "IE-A096")).toBeUndefined();
    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending?.options.map((option) => option.id)).toEqual(["korea", "manchuria"]);
    expect(G.wtt).toBe(wttBefore);
  });
});

describe("printed event playability — board gate", () => {
  const buttonTag = (markup: string, testId: string): string =>
    markup.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>[\\s\\S]*?</button>`))?.[0] ?? "";

  const boardMarkup = (G: ImperialElegyState): string => renderToStaticMarkup(React.createElement(ImperialElegyBoard, {
    G,
    ctx: makeCtx([], "0"),
    moves: {},
    playerID: "0",
  }));

  test("the event button is disabled with the printed reason", () => {
    const G = fresh();
    setActive(G, "GE");
    G.spaces.egypt.control = "OT";
    G.powers.GE.hand.push("IE-A071");
    const button = buttonTag(boardMarkup(G), "ie-play-event-IE-A071");
    expect(button).toContain("disabled");
    expect(button).toContain("data-blocked=\"egypt-minor\"");
    expect(button).toContain(ieStringsFor("zh_CN").playBlock["egypt-minor"]);
  });

  test("the event button is enabled when the printed condition is met", () => {
    const G = fresh();
    setActive(G, "GE");
    G.powers.GE.hand.push("IE-A071");
    // The campaign starts with Egypt under the Egypt minor, so A71 is legal.
    const button = buttonTag(boardMarkup(G), "ie-play-event-IE-A071");
    expect(button).not.toBe("");
    expect(button).not.toContain("disabled");
    expect(button).not.toContain("data-blocked");
  });
});
