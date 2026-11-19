/**
 * Rule 34 — handing a seat to the bot, or taking it back, mid-match.
 *
 * The lobby fills the seats nobody took when a match is created.  These tests
 * cover the other half: a player who steps out during play (or comes back).
 * The engine writes the public `G.bots` list, which every board redraws from
 * and the server driver reads, so the handover must be:
 *
 *  - any seat, not only the tail seats a lobby would have filled;
 *  - callable by that seat's own client only;
 *  - reversible without restarting the match;
 *  - logged so the table can see who is playing the seat.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {Client} from "boardgame.io/client";
import {Local} from "boardgame.io/multiplayer";
import {botPowersOf} from "./configuration";
import {ImperialElegyGameDef} from "./game";
import {setSeatBot} from "./moves";

const seat = (power: Power): string => String(POWERS.indexOf(power));

const makeCtx = (power: Power | null): Ctx => ({
  playerID: power === null ? null : seat(power),
  random: {Die: () => 3, Number: () => 0.5, Shuffle: (a: unknown[]) => a.slice()},
  events: {
    setPhase: () => undefined,
    setActivePlayers: () => undefined,
    endGame: () => undefined,
    endTurn: () => undefined,
  },
  turn: 1,
  phase: "prep",
}) as unknown as Ctx;

const fresh = (bots: Power[] = []): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx(null), bots.length > 0 ? {bots} : undefined);
  // The handover is legal in any phase; a running action phase is the realistic
  // case (a player stepping out mid-turn).
  G.phase = "action";
  G.activePower = "GE";
  return G;
};

describe("handing a seat to the bot", () => {
  test("any seat can be handed over, not just the tail seats", () => {
    for (const power of POWERS) {
      const G = fresh();
      expect(setSeatBot(G, makeCtx(power), true)).toBeUndefined();
      expect(botPowersOf(G)).toEqual([power]);
    }
  });

  test("the list stays in printed seat order", () => {
    const G = fresh();
    setSeatBot(G, makeCtx("OT"), true);
    setSeatBot(G, makeCtx("GE"), true);
    setSeatBot(G, makeCtx("AU"), true);
    expect(botPowersOf(G)).toEqual(["GE", "AU", "OT"]);
  });

  test("it is logged so the table sees who is playing the seat", () => {
    const G = fresh();
    setSeatBot(G, makeCtx("FR"), true);
    const entry = G.log.find((line) => line.key === "botSeatChanged");
    expect(entry?.power).toBe("FR");
    expect(entry?.args?.bot).toBe("yes");
  });

  test("only the seat itself may hand itself over", () => {
    const G = fresh();
    // GE's client cannot give FR to the bot, and a spectator cannot at all.
    expect(setSeatBot(G, makeCtx("GE"), true)).toBeUndefined();
    expect(setSeatBot(G, makeCtx("GE"), true)).toBeUndefined();
    expect(botPowersOf(G)).toEqual(["GE"]);
    const other = fresh();
    expect(setSeatBot(other, makeCtx(null), true)).toBe(INVALID_MOVE);
    expect(botPowersOf(other)).toEqual([]);
  });

  test("a seat's own client is the one that flips it", () => {
    // Two different seats in one state: each changes only itself.
    const G = fresh();
    expect(setSeatBot(G, makeCtx("UK"), true)).toBeUndefined();
    expect(botPowersOf(G)).toEqual(["UK"]);
    // GE cannot undo UK's choice.
    expect(setSeatBot(G, makeCtx("GE"), false)).toBeUndefined();
    expect(botPowersOf(G)).toEqual(["UK"]);
  });
});

describe("taking a seat back", () => {
  test("a bot seat can be reclaimed without restarting the match", () => {
    const G = fresh(["FR"]);
    expect(botPowersOf(G)).toEqual(["FR"]);
    expect(setSeatBot(G, makeCtx("FR"), false)).toBeUndefined();
    expect(botPowersOf(G)).toEqual([]);
    // The rest of the state is untouched: it is the same match.
    expect(G.phase).toBe("action");
  });

  test("reclaiming is logged too", () => {
    const G = fresh(["FR"]);
    setSeatBot(G, makeCtx("FR"), false);
    const entry = G.log.find((line) => line.key === "botSeatChanged");
    expect(entry?.args?.bot).toBe("no");
  });

  test("a human seat's client cannot reclaim another seat's bots", () => {
    const G = fresh(["FR", "AU"]);
    // GE is a human and tries to take AU back; its own id only flips GE.
    expect(setSeatBot(G, makeCtx("GE"), true)).toBeUndefined();
    expect(botPowersOf(G)).toEqual(["GE", "FR", "AU"]);
  });

  test("the flip is idempotent", () => {
    const G = fresh(["FR"]);
    // Already a bot: handing over again is a no-op, not an error (a double click
    // or a retried move must not be refused).
    expect(setSeatBot(G, makeCtx("FR"), true)).toBeUndefined();
    expect(botPowersOf(G)).toEqual(["FR"]);
    expect(G.log.filter((line) => line.key === "botSeatChanged")).toEqual([]);
    setSeatBot(G, makeCtx("FR"), false);
    expect(setSeatBot(G, makeCtx("FR"), false)).toBeUndefined();
    expect(botPowersOf(G)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Through the real boardgame.io master
// ---------------------------------------------------------------------------

describe("a handover from a non-acting seat reaches the engine", () => {
  const clientsFor = () => ["0", "1", "2", "3", "4", "5"].map((playerID) =>
    Client({game: ImperialElegyGameDef, numPlayers: 6, multiplayer: Local(), playerID, debug: false}));

  const stateIdOf = (c: {getState: () => unknown}) => Number((c.getState() as {_stateID?: number} | null)?._stateID ?? -1);
  const startAll = async (clients: Array<{getState: () => unknown}>) => {
    for (let tick = 0; tick < 500 && clients.some((c) => c.getState() === null); tick += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  const settled = async (clients: Array<{getState: () => unknown}>, before: number) => {
    for (let tick = 0; tick < 500; tick += 1) {
      if (stateIdOf(clients[0]) !== before) return;
      await new Promise((resolve) => setImmediate(resolve));
    }
  };

  test("in prep, a seat that is not the current player can still hand over", async () => {
    // `prep` is a framework turn (GE is current), so this is exactly the case a
    // move gated on `IsPlayerActive` would refuse.  The phase hook widens the
    // active seats so the move reaches the engine's own seat check instead.
    const clients = clientsFor();
    clients.forEach((client) => (client as unknown as {start?: () => void}).start?.());
    await startAll(clients);

    const before = stateIdOf(clients[0]);
    // Seat 3 is AU, not the current player at the start of prep.
    (clients[3] as unknown as {moves: Record<string, (...args: unknown[]) => void>}).moves.setSeatBot(true);
    await settled(clients, before);

    const G = (clients[0].getState() as {G?: ImperialElegyState} | null)?.G;
    expect(G?.bots).toEqual(["AU"]);
    expect(G?.log.some((line) => line.key === "botSeatChanged")).toBe(true);
  });
});
