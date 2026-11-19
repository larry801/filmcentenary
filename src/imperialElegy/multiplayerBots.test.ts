/**
 * Imperial Elegy — online multi-human / Rule 34 bot seats.
 *
 * The engine always runs all six printed powers, so a match is always six
 * boardgame.io seats.  "2–6 human players" is the lobby's bot list:
 * `setupData.bots` names the powers the server drives, the engine stores that
 * list in the public `G.bots`, and the lobby's `validateSetupData` refuses a
 * table that would leave fewer than two humans (that entrance is the local
 * solo hotseat, not an online match).
 */

import {
  IE_BOTS_SETUP_KEY,
  IE_MAX_HUMANS,
  IE_MIN_HUMANS,
  IE_SEATS,
  botPowersOf,
  botsForHumanCount,
  canToggleBotSeat,
  firstHumanSeat,
  humanPowers,
  isBotPower,
  parseBotPowers,
  toggleBotSeat,
  validateIESetupData,
} from "./configuration";
import {setupImperialElegy} from "./engine/setup";
import {ImperialElegyGameDef} from "./game";
import {POWERS, Power} from "./types";

const makeCtx = (playerID: string | null = "0") => ({
  playerID,
  random: {Die: () => 3, Number: () => 0.5, Shuffle: (a: unknown[]) => a.slice()},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "prep",
}) as any;

describe("bot list parsing", () => {
  test("an absent list is an empty list", () => {
    expect(parseBotPowers(undefined)).toEqual([]);
    expect(parseBotPowers(null)).toEqual([]);
    expect(parseBotPowers({})).toEqual([]);
  });

  test("a well-formed list is kept in the order it was written", () => {
    // `parseBotPowers` is a raw read; `botPowersOf` normalises to seat order.
    expect(parseBotPowers({[IE_BOTS_SETUP_KEY]: ["OT", "RU"]})).toEqual(["OT", "RU"]);
    expect(parseBotPowers({[IE_BOTS_SETUP_KEY]: []})).toEqual([]);
  });

  test("anything that is not a distinct subset of the six powers is rejected", () => {
    expect(parseBotPowers({bots: ["IT"]})).toBeUndefined();
    expect(parseBotPowers({bots: ["GE", "GE"]})).toBeUndefined();
    expect(parseBotPowers({bots: "GE"})).toBeUndefined();
    expect(parseBotPowers(["GE"])).toBeUndefined();
  });

  test("the bot list survives `setupData` carrying other keys", () => {
    expect(parseBotPowers({scenario: "campaign", bots: ["GE"]})).toEqual(["GE"]);
  });
});

describe("human/bot split", () => {
  test("the lobby's human count fills the tail seats with bots", () => {
    expect(botsForHumanCount(6)).toEqual([]);
    expect(botsForHumanCount(5)).toEqual(["OT"]);
    expect(botsForHumanCount(2)).toEqual(["FR", "AU", "RU", "OT"]);
    // A stale or out-of-range value clamps instead of producing an unseat; the
    // two-human minimum is the validator's job, tested below.
    expect(botsForHumanCount(1)).toEqual(["UK", "FR", "AU", "RU", "OT"]);
    expect(botsForHumanCount(0)).toEqual([...POWERS]);
    expect(botsForHumanCount(-4)).toEqual([...POWERS]);
    expect(botsForHumanCount(IE_MAX_HUMANS + 3)).toEqual([]);
  });

  test("humanPowers is the complement and keeps seat order", () => {
    expect(humanPowers([])).toEqual([...POWERS]);
    expect(humanPowers(botsForHumanCount(2))).toEqual(["GE", "UK"]);
  });

  test("the first joinable seat is the first human seat", () => {
    expect(firstHumanSeat([])).toBe(0);
    expect(firstHumanSeat(botsForHumanCount(2))).toBe(0);
    // A future lobby that lets the creator pick seats must still resolve, even
    // when every seat is a bot (there is then nothing joinable).
    expect(firstHumanSeat(POWERS)).toBe(0);
  });
});


describe("choosing which seats are bots", () => {
  test("any seat can be flipped, not just the tail seats", () => {
    // The lobby used to derive bots from a human count, so only the last seats
    // could ever be bots.  A seat toggle must reach the front of the order too.
    expect(toggleBotSeat([], "GE")).toEqual(["GE"]);
    expect(toggleBotSeat([], "UK")).toEqual(["UK"]);
    expect(toggleBotSeat(["GE"], "UK")).toEqual(["GE", "UK"]);
  });

  test("the result is always in printed seat order", () => {
    expect(toggleBotSeat(["OT", "GE"], "AU")).toEqual(["GE", "AU", "OT"]);
    expect(toggleBotSeat(["OT", "GE"], "GE")).toEqual(["OT"]);
  });

  test("flipping back restores the human seat", () => {
    const bots = toggleBotSeat([], "FR");
    expect(bots).toEqual(["FR"]);
    expect(toggleBotSeat(bots, "FR")).toEqual([]);
  });

  test("the lobby keeps at least two humans", () => {
    // Five bots would leave one human, which is the local solo entrance rather
    // than an online table; the last legal flip is refused (not applied).
    const fourBots = toggleBotSeat(toggleBotSeat(toggleBotSeat(toggleBotSeat([], "FR"), "AU"), "RU"), "OT");
    expect(fourBots).toEqual(["FR", "AU", "RU", "OT"]);
    expect(canToggleBotSeat(fourBots, "UK")).toBe(false);
    expect(canToggleBotSeat(fourBots, "OT")).toBe(true);
    // A refused flip leaves the roster untouched.
    expect(toggleBotSeat(fourBots, "UK")).toEqual(["FR", "AU", "RU", "OT"]);
  });

  test("one bot may still be removed from the largest table", () => {
    expect(toggleBotSeat(["FR", "AU", "RU", "OT"], "OT")).toEqual(["FR", "AU", "RU"]);
  });
});

describe("validateIESetupData", () => {
  test("six seats with no bots is a six-human match", () => {
    expect(validateIESetupData(undefined, 6)).toBeUndefined();
    expect(validateIESetupData({bots: []}, 6)).toBeUndefined();
  });

  test("two humans and four bots is the largest legal table", () => {
    expect(validateIESetupData({bots: botsForHumanCount(2)}, 6)).toBeUndefined();
    expect(IE_SEATS.length - botPowersOf({bots: botsForHumanCount(2)}).length).toBe(IE_MIN_HUMANS);
  });

  test("five bots would leave one human, which is the local solo entrance", () => {
    const error = validateIESetupData({bots: botsForHumanCount(1)}, 6);
    expect(error).toContain("at least 2 human");
  });

  test("the engine needs all six seats, so another count is refused", () => {
    expect(validateIESetupData(undefined, 4)).toContain("always seats 6");
    expect(validateIESetupData({bots: []}, 2)).toContain("always seats 6");
  });

  test("a malformed bot list is refused", () => {
    expect(validateIESetupData({bots: ["NOPE"]}, 6)).toContain("Invalid bot seats");
    expect(validateIESetupData({bots: ["GE", "GE"]}, 6)).toContain("Invalid bot seats");
  });
});

describe("the game definition", () => {
  test("keeps six boardgame.io seats and exposes the lobby validator", () => {
    expect(ImperialElegyGameDef.minPlayers).toBe(6);
    expect(ImperialElegyGameDef.maxPlayers).toBe(6);
    expect(typeof ImperialElegyGameDef.validateSetupData).toBe("function");
    expect(ImperialElegyGameDef.validateSetupData!(undefined, 4)).toContain("always seats 6");
    expect(ImperialElegyGameDef.validateSetupData!(undefined, 6)).toBeUndefined();
    expect(ImperialElegyGameDef.validateSetupData!({bots: botsForHumanCount(2)}, 6)).toBeUndefined();
    expect(ImperialElegyGameDef.validateSetupData!({bots: botsForHumanCount(1)}, 6)).toContain("at least 2 human");
  });
});

describe("setup stores the bot seats", () => {
  const fresh = (setupData?: unknown) => setupImperialElegy(makeCtx(), setupData);

  test("a hotseat-style setup with no data has no bot seats", () => {
    expect(fresh().bots).toEqual([]);
    expect(botPowersOf(fresh())).toEqual([]);
  });

  test("setupData.bots becomes the public bot list in seat order", () => {
    const G = fresh({bots: ["OT", "AU"]});
    expect(G.bots).toEqual(["AU", "OT"]);
    expect(botPowersOf(G)).toEqual(["AU", "OT"]);
    expect(isBotPower(G, "AU")).toBe(true);
    expect(isBotPower(G, "GE")).toBe(false);
  });

  test("every power still exists, with a hand and a deck", () => {
    const G = fresh({bots: botsForHumanCount(2)});
    for (const power of POWERS) {
      expect(G.powers[power]).toBeDefined();
      expect(Array.isArray(G.powers[power].goalDeck)).toBe(true);
    }
    // Turn 1 dealt to all six seats, bots included: a bot power plays the same
    // game a human does.
    expect(POWERS.every((power) => G.powers[power].hand.length > 0)).toBe(true);
  });

  test("a garbage bot list degrades to no bots instead of throwing", () => {
    // `parseBotPowers` is the strict read the lobby validates against, so a
    // malformed list (a "nope" power, a non-string entry) never seats bots.
    expect(fresh({bots: ["nope"]}).bots).toEqual([]);
    expect(fresh({bots: [1, "GE", null]}).bots).toEqual([]);
    // `botPowersOf` reads a live state leniently, because that list came over
    // the wire; it drops the unknown entries and keeps the real seat.
    expect(botPowersOf({bots: [1, "GE", null] as unknown as Power[]})).toEqual(["GE"]);
  });
});
