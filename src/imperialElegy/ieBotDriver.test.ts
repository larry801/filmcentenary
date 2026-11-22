/**
 * Imperial Elegy — the online Rule 34 bot driver.
 *
 * `multiplayerBots.test.ts` covers the lobby/setup half of online multi-human
 * play.  This suite covers the server half: which seat owes an action, that a
 * human seat is never touched, and that the driver really advances a match by
 * dispatching bot moves through a Master with that seat's credentials.
 */

import {CreateGameReducer, InitializeGame, ProcessGameConfig, createMatch} from "boardgame.io/internal";
import {ImperialElegyGameDef} from "./game";
import {ImperialElegyState, POWERS} from "./types";
import {botsForHumanCount} from "./configuration";
import {
  attachBotDriverToStorage,
  botEscapeMove,
  botRandom,
  botSeatToAct,
  botStateKey,
  createIEBotDriver,
  seedBotPlayers,
  stateNeedsBots,
} from "../game/ieBotDriver";

const game = ProcessGameConfig(ImperialElegyGameDef as any);

/** Minimal async StorageAPI with the two hooks the driver needs. */
const makeStorage = () => {
  const state = new Map<string, any>();
  const metadata = new Map<string, any>();
  const db: any = {
    type: () => "async",
    connect: async () => undefined,
    createMatch: async (matchID: string, opts: any) => {
      state.set(matchID, opts.initialState);
      metadata.set(matchID, opts.metadata);
    },
    setState: async (matchID: string, next: any) => { state.set(matchID, next); },
    setMetadata: async (matchID: string, next: any) => { metadata.set(matchID, next); },
    fetch: async (matchID: string, opts: any) => ({
      state: opts.state ? state.get(matchID) : undefined,
      metadata: opts.metadata ? metadata.get(matchID) : undefined,
    }),
    wipe: async (matchID: string) => { state.delete(matchID); metadata.delete(matchID); },
    listMatches: async () => [...state.keys()],
  };
  return {db, state, metadata};
};

const makeAuth = () => ({
  authenticateCredentials: ({playerID, credentials, metadata}: any): boolean =>
    metadata?.players?.[playerID]?.credentials !== undefined
      && metadata.players[playerID].credentials === credentials,
});

describe("botSeatToAct", () => {
  const stateWith = (overrides: Partial<ImperialElegyState>, ctx: any = {currentPlayer: "0"}) => {
    const initialized: any = InitializeGame({game, numPlayers: 6});
    // `InitializeGame` hands back an immer-frozen state; these tests mutate it.
    const G = {...JSON.parse(JSON.stringify(initialized.G)), bots: [], ...overrides} as ImperialElegyState;
    return {G, ctx: {...initialized.ctx, ...ctx}};
  };

  test("prep and diplomacy follow the framework's current player", () => {
    const {G, ctx} = stateWith({phase: "prep"});
    expect(botSeatToAct(G, {...ctx, currentPlayer: "0"})).toBe("GE");
    expect(botSeatToAct(G, {...ctx, currentPlayer: "4"})).toBe("RU");
    expect(botSeatToAct({...G, phase: "diplomacy"}, {...ctx, currentPlayer: "5"})).toBe("OT");
  });

  test("action and wartime follow the engine's active power", () => {
    const {G, ctx} = stateWith({phase: "action", activePower: "AU"});
    expect(botSeatToAct(G, {...ctx, currentPlayer: "0"})).toBe("AU");
    expect(botSeatToAct({...G, phase: "wartime", activePower: "RU"}, ctx)).toBe("RU");
  });

  test("an open decision belongs to its deciding power", () => {
    const {G, ctx} = stateWith({
      phase: "action",
      activePower: "GE",
      pending: {id: "d1", kind: "eventChoice", power: "OT", prompt: "", options: [], createdAt: 1} as any,
    });
    expect(botSeatToAct(G, ctx)).toBe("OT");
  });

  test("the end phase asks every power once, skipping eliminated ones", () => {
    const {G, ctx} = stateWith({phase: "end"});
    for (const power of POWERS) G.powers[power].flags.endDone = true;
    expect(botSeatToAct(G, ctx)).toBeNull();
    G.powers.FR.flags.endDone = false;
    G.powers.AU.flags.endDone = false;
    G.powers.AU.eliminated = true;
    expect(botSeatToAct(G, ctx)).toBe("FR");
  });

  test("Great War planning is not a per-seat obligation while a human plays", () => {
    const bots = botsForHumanCount(2);
    const {G, ctx} = stateWith({phase: "gwPlanning", bots, gw: {turn: 1, active: true} as any});
    expect(botSeatToAct(G, ctx)).toBeNull();
    // An all-bot table has nobody else to press "start maneuver".
    const solo = stateWith({phase: "gwPlanning", bots: [...POWERS], gw: {turn: 1, active: true} as any});
    expect(botSeatToAct(solo.G, solo.ctx)).toBe(solo.G.activePower);
  });

  test("a finished match needs nobody", () => {
    const {G, ctx} = stateWith({result: {winners: ["GE"], reason: "test", scores: {}} as any});
    expect(botSeatToAct(G, ctx)).toBeNull();
    expect(botSeatToAct(G, {...ctx, gameover: {winner: "0"}})).toBeNull();
  });
});

describe("botEscapeMove", () => {
  const {G} = (() => {
    const initialized: any = InitializeGame({game, numPlayers: 6});
    return {G: initialized.G as ImperialElegyState};
  })();

  test("every phase names the move the board's escape map names", () => {
    expect(botEscapeMove(G, "action")).toEqual({move: "pass"});
    expect(botEscapeMove(G, "wartime")).toEqual({move: "passWarMove"});
    expect(botEscapeMove(G, "prep")).toEqual({move: "finishPrep"});
    // Diplomacy refuses to close until every power has chosen, so the escape is
    // the seat's own choice first.
    const diplomacy = botEscapeMove(G, "diplomacy");
    expect(["chooseHomeCard", "endDiplomacy"]).toContain(diplomacy!.move);
    expect(botEscapeMove(G, "end")).toEqual({move: "endPhaseTurn"});
    expect(botEscapeMove(G, "gwPlanning")).toEqual({move: "endGwPlanningMove"});
    expect(botEscapeMove(G, "gwWinter")).toEqual({move: "gwResolveWinter"});
    expect(botEscapeMove(G, "gwManeuver")).toEqual({move: "gwPass"});
  });

  test("an unfinished negotiation is closed before a home card is chosen", () => {
    const G2 = { ...G, powers: JSON.parse(JSON.stringify(G.powers)) } as ImperialElegyState;
    G2.powers.GE.flags.negotiationDone = false;
    expect(botEscapeMove(G2, "diplomacy", "GE")).toEqual({move: "finishNegotiation"});
  });

  test("an open decision is answered with its first option, never declined blindly", () => {
    const pending = {
      id: "d1", kind: "eventChoice", power: "GE", prompt: "", createdAt: 1,
      options: [{id: "a", label: "A"}, {id: "b", label: "B"}],
    } as any;
    expect(botEscapeMove({...G, pending}, "action")).toEqual({move: "resolvePending", args: ["a"]});
    expect(botEscapeMove({...G, pending: {...pending, options: []}}, "action")).toEqual({move: "declinePending"});
  });
});

describe("botRandom", () => {
  test("is deterministic for one state and bounded to the die's faces", () => {
    const initialized: any = InitializeGame({game, numPlayers: 6});
    const G = initialized.G as ImperialElegyState;
    const a = botRandom(G, "GE");
    const b = botRandom(G, "GE");
    for (let i = 0; i < 20; i += 1) {
      const roll = a.Die(6) as number;
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(6);
      expect(roll).toBe(b.Die(6));
    }
    expect(a.Number()).toBe(b.Number());
    expect((a.Die(6, 3) as number[])).toHaveLength(3);
    expect(a.Shuffle([1, 2, 3, 4])).toHaveLength(4);
  });

  test("different seats do not share a roll stream", () => {
    const initialized: any = InitializeGame({game, numPlayers: 6});
    const G = initialized.G as ImperialElegyState;
    const ge = Array.from({length: 8}, () => botRandom(G, "GE").Die(6));
    const ot = Array.from({length: 8}, () => botRandom(G, "OT").Die(6));
    expect(ge).not.toEqual(ot);
  });
});

describe("seedBotPlayers", () => {
  const {metadata, initialState} = (() => {
    const match = createMatch({game, numPlayers: 6, setupData: {bots: botsForHumanCount(2)}, unlisted: false} as any);
    return {metadata: match.metadata as any, initialState: match.initialState};
  })();

  test("names and credentials every bot seat, and marks it as a bot", () => {
    const meta = JSON.parse(JSON.stringify(metadata));
    const changed = seedBotPlayers(meta, initialState, () => "cred", (power) => `Bot ${power}`);
    expect(changed).toBe(true);
    for (const power of botsForHumanCount(2)) {
      const player = meta.players[POWERS.indexOf(power)];
      expect(player.name).toBe(`Bot ${power}`);
      expect(player.credentials).toBe("cred");
      expect(player.isBot).toBe(true);
    }
    // Human seats are untouched, so the lobby still offers them.
    expect(meta.players[0].name).toBeUndefined();
    expect(meta.players[0].credentials).toBeUndefined();
  });

  test("is idempotent and never overwrites a seated player", () => {
    const meta = JSON.parse(JSON.stringify(metadata));
    seedBotPlayers(meta, initialState, () => "cred");
    expect(seedBotPlayers(meta, initialState, () => "other")).toBe(false);
    expect(meta.players[POWERS.indexOf("FR")].credentials).toBe("cred");
  });

  test("does nothing for a hotseat state or a finished match", () => {
    const meta = JSON.parse(JSON.stringify(metadata));
    expect(seedBotPlayers(meta, {G: {}}, () => "cred")).toBe(false);
    expect(stateNeedsBots({ctx: {gameover: {winner: "0"}}, G: {bots: ["FR"]}})).toBe(false);
    expect(stateNeedsBots({ctx: {}, G: {bots: ["FR"]}})).toBe(true);
    expect(stateNeedsBots({ctx: {}, G: {bots: []}})).toBe(false);
  });
});

describe("the driver advances a match through its bot seats", () => {
  test("a human seat is never played by the driver", async () => {
    const {db} = makeStorage();
    const published: unknown[] = [];
    const driver = createIEBotDriver({
      db, game, auth: makeAuth(),
      pubSub: {publish: (_channel, payload) => published.push(payload)},
      log: () => undefined,
    });
    attachBotDriverToStorage(db, driver, () => "bot-cred");

    // GE (seat 0) is a human seat and owes prep first, so a drain must leave
    // the state (and the broadcast channel) untouched.
    const match = createMatch({game, numPlayers: 6, setupData: {bots: botsForHumanCount(2)}, unlisted: false} as any);
    const metadata = match.metadata as any;
    metadata.players[0].name = "human-ge";
    metadata.players[0].credentials = "h0";
    metadata.players[1].name = "human-uk";
    metadata.players[1].credentials = "h1";
    await db.createMatch("match-1", {metadata, initialState: match.initialState});

    await driver.tick("match-1");
    driver.stop();
    const stored = await db.fetch("match-1", {state: true});
    expect(stored.state._stateID).toBe(match.initialState._stateID);
    expect(stored.state.G.powers.GE.flags.prepDone).toBe(false);
    expect(published).toHaveLength(0);
  });

  test("the driver keeps an all-bot remainder moving without spinning", async () => {
    const {db, state} = makeStorage();
    const logs: string[] = [];
    const published: any[] = [];
    const driver = createIEBotDriver({
      db, game, auth: makeAuth(),
      pubSub: {publish: (_channel, payload) => published.push(payload)},
      log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
      maxStepsPerTick: 120,
    });
    attachBotDriverToStorage(db, driver, () => "bot-cred");

    const match = createMatch({game, numPlayers: 6, setupData: {bots: botsForHumanCount(2)}, unlisted: false} as any);
    const metadata = match.metadata as any;
    metadata.players[0].name = "human-ge";
    metadata.players[0].credentials = "h0";
    metadata.players[1].name = "human-uk";
    metadata.players[1].credentials = "h1";
    await db.createMatch("match-5", {metadata, initialState: match.initialState});

    // The two human seats play their prep and diplomacy steps with the real
    // reducer (exactly what a human move looks like on the wire), and the
    // driver fills in the four bot seats in between.
    const reducer = CreateGameReducer({game, isClient: false});
    let live = match.initialState;
    const play = async (seat: string, type: string, args: unknown[] = []) => {
      live = reducer(live, {type: "MAKE_MOVE", payload: {type, args, playerID: seat}});
      await db.setState("match-5", live);
    };
    for (const seat of ["0", "1"]) await play(seat, "finishPrep");
    await driver.tick("match-5");
    live = state.get("match-5");
    expect((live.G as ImperialElegyState).phase).toBe("diplomacy");
    // 9.1: the two humans close their negotiation segments first; the next
    // drain lets the four bots do the same before any home card is chosen.
    for (const seat of ["0", "1"]) await play(seat, "finishNegotiation");
    await driver.tick("match-5");
    live = state.get("match-5");
    for (const seat of ["0", "1"]) {
      const power = POWERS[Number(seat)];
      const card = (live.G as ImperialElegyState).powers[power].homeCards[0];
      await play(seat, "chooseHomeCard", [card]);
    }
    await driver.tick("match-5");
    live = state.get("match-5");
    expect((live.G as ImperialElegyState).phase).toBe("action");
    expect((live.G as ImperialElegyState).activePower).toBe("GE");

    // GE is a human and holds the first impulse, so a drain changes nothing.
    const beforeHuman = live._stateID;
    await driver.tick("match-5");
    expect(state.get("match-5")._stateID).toBe(beforeHuman);

    // Both humans take a spare card for CP and then end their impulse, which is
    // the only way to hand the impulse on (`pass` refuses a power that has not
    // acted while it still holds cards).  The deal is random, so plant one
    // always-spendable card per human seat first; it lands on FR, a bot seat.
    const SPENDABLE = "IE-A037";
    const stored = state.get("match-5");
    const setup = JSON.parse(JSON.stringify(stored));
    for (const seat of ["0", "1"]) {
      const power = POWERS[Number(seat)];
      if (!setup.G.powers[power].hand.includes(SPENDABLE)) setup.G.powers[power].hand.push(SPENDABLE);
    }
    await db.setState("match-5", setup);
    live = state.get("match-5");
    expect((live.G as ImperialElegyState).phase).toBe("action");
    for (const seat of ["0", "1"]) {
      await play(seat, "playCard", [SPENDABLE, "cp"]);
      await play(seat, "pass");
    }
    expect((live.G as ImperialElegyState).activePower).toBe("FR");

    await driver.tick("match-5");
    const after = state.get("match-5");
    const G = after.G as ImperialElegyState;
    expect(after._stateID).toBeGreaterThan(live._stateID);
    expect(G.result ?? null).toBeNull();
    expect(["prep", "diplomacy", "action", "wartime", "end", "gwPlanning", "gwWinter"]).toContain(G.phase);
    // No seat got stuck on a decision the engine refuses.
    expect(logs.filter((line) => line.includes("giving up"))).toEqual([]);
    expect(published.length).toBeGreaterThan(0);
    driver.stop();
  });

  test("a bot seat without credentials is left alone instead of crashing", async () => {
    const {db, state} = makeStorage();
    const driver = createIEBotDriver({
      db, game, auth: makeAuth(),
      pubSub: {publish: () => undefined},
      log: () => undefined,
    });
    // No wrapper: nothing seats the bots, so no seat carries credentials.
    const match = createMatch({game, numPlayers: 6, setupData: {bots: botsForHumanCount(2)}, unlisted: false} as any);
    const metadata = match.metadata as any;
    metadata.players[0].name = "human-ge";
    metadata.players[0].credentials = "h0";
    metadata.players[1].name = "human-uk";
    metadata.players[1].credentials = "h1";
    await db.createMatch("match-4", {metadata, initialState: match.initialState});

    await driver.tick("match-4");
    driver.stop();
    const stored = state.get("match-4");
    expect(stored._stateID).toBe(match.initialState._stateID);
    expect(stored.G.bots).toEqual(botsForHumanCount(2));
  });

  test("a drain that hits its step cap is rescheduled instead of idling", async () => {
    const {db, state} = makeStorage();
    const driver = createIEBotDriver({
      db, game, auth: makeAuth(),
      pubSub: {publish: () => undefined},
      log: () => undefined,
      // Two decisions per drain: the four bot prep steps need a reschedule.
      maxStepsPerTick: 2,
    });
    attachBotDriverToStorage(db, driver, () => "bot-cred");

    const match = createMatch({game, numPlayers: 6, setupData: {bots: botsForHumanCount(2)}, unlisted: false} as any);
    const metadata = match.metadata as any;
    metadata.players[0].name = "human-ge";
    metadata.players[0].credentials = "h0";
    metadata.players[1].name = "human-uk";
    metadata.players[1].credentials = "h1";
    await db.createMatch("match-6", {metadata, initialState: match.initialState});

    const reducer = CreateGameReducer({game, isClient: false});
    let live = reducer(match.initialState, {type: "MAKE_MOVE", payload: {type: "finishPrep", args: [], playerID: "0"}});
    live = reducer(live, {type: "MAKE_MOVE", payload: {type: "finishPrep", args: [], playerID: "1"}});
    await db.setState("match-6", live);

    // A single drain can only make two moves, so four bots need two drains.
    await driver.tick("match-6");
    const afterOne = state.get("match-6");
    expect(afterOne._stateID).toBe(live._stateID + 2);
    expect(afterOne.G.powers.OT.flags.prepDone).toBe(false);

    // The capped drain queued the next one, and the chain runs to completion
    // without another human write.  Each bot now has two steps: prep, then its
    // 9.1 negotiation close, so the four bots need four drains.
    const deadline = Date.now() + 15000;
    const botsDone = () => botsForHumanCount(2).every((power) =>
      (state.get("match-6").G as ImperialElegyState).powers[power].flags.negotiationDone === true);
    while (Date.now() < deadline && !botsDone()) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const done = state.get("match-6");
    expect(done.G.powers.OT.flags.prepDone).toBe(true);
    expect(done.ctx.phase).toBe("diplomacy");
    expect(done._stateID - live._stateID).toBe(botsForHumanCount(2).length * 2);
    driver.stop();
  });

  test("stop() releases queued drains and stops scheduling", async () => {
    const {db, state} = makeStorage();
    const driver = createIEBotDriver({
      db, game, auth: makeAuth(),
      pubSub: {publish: () => undefined},
      log: () => undefined,
    });
    attachBotDriverToStorage(db, driver, () => "bot-cred");
    const match = createMatch({game, numPlayers: 6, setupData: {bots: botsForHumanCount(2)}, unlisted: false} as any);
    await db.createMatch("match-7", {metadata: match.metadata, initialState: match.initialState});
    expect(driver.active()).toBe(1);

    driver.stop();
    expect(driver.active()).toBe(0);
    // A write after stop must not bring the driver back.
    await db.setState("match-7", match.initialState);
    expect(driver.active()).toBe(0);
    expect(state.get("match-7")._stateID).toBe(match.initialState._stateID);
  });

  test("bot preps are dispatched in turn and stop at the next human", async () => {
    const {db, state, metadata: meta} = makeStorage();
    const setupData = {bots: botsForHumanCount(2)};
    const published: any[] = [];
    const driver = createIEBotDriver({
      db, game, auth: makeAuth(),
      pubSub: {publish: (_channel, payload) => published.push(payload)},
      log: () => undefined,
    });
    // The server attaches the wrapper before serving, so match creation itself
    // is what seats the bots (exactly like server.ts).
    attachBotDriverToStorage(db, driver, () => "bot-cred");

    const match = createMatch({game, numPlayers: 6, setupData, unlisted: false} as any);
    const metadata = match.metadata as any;
    // Two humans: GE (0) and UK (1); FR/AU/RU/OT are bots and were seated above.
    metadata.players[0].name = "human-ge";
    metadata.players[0].credentials = "h0";
    metadata.players[1].name = "human-uk";
    metadata.players[1].credentials = "h1";
    await db.createMatch("match-2", {metadata, initialState: match.initialState});

    // The two humans take their prep step through the real reducer, which is
    // what keeps the engine's `activePower` and the framework's `currentPlayer`
    // in step — the same thing the online Master does for a human move.
    const reducer = CreateGameReducer({game, isClient: false});
    let live = match.initialState;
    for (const seat of ["0", "1"]) {
      live = reducer(live, {type: "MAKE_MOVE", payload: {type: "finishPrep", args: [], playerID: seat}});
      await db.setState("match-2", live);
    }
    expect((live.G as ImperialElegyState).powers.GE.flags.prepDone).toBe(true);
    expect(live.ctx.currentPlayer).toBe("2");

    await driver.tick("match-2");
    driver.stop();
    const after = state.get("match-2");
    const G = after.G as ImperialElegyState;
    // All four bot seats finished prep; the humans' steps stay as they were.
    for (const power of botsForHumanCount(2)) expect(G.powers[power].flags.prepDone).toBe(true);
    expect(G.powers.GE.flags.prepDone).toBe(true);
    expect(G.powers.UK.flags.prepDone).toBe(true);
    // The engine moved on to diplomacy once every power had prepped, and the
    // same drain also closed the four bots' 9.1 negotiation segments.  The
    // home-card turn now belongs to a human (GE), so no bot owes a move.
    expect(botSeatToAct(G, after.ctx)).toBe(null);
    // Every dispatch was broadcast for the clients to pick up.
    expect(published.length).toBeGreaterThanOrEqual(4);
    expect(published.every((payload) => payload.type === "update" || payload.type === "patch")).toBe(true);
    // The seated metadata kept the bots out of the human join links.
    expect(meta.get("match-2").players[2].name).toBe("Bot FR");
    expect(meta.get("match-2").players[2].credentials).toBe("bot-cred");
  });
});

test("botStateKey changes when the state a decision was made from changes", () => {
  const initialized: any = InitializeGame({game, numPlayers: 6});
  const G = initialized.G as ImperialElegyState;
  const ctx = {...initialized.ctx, currentPlayer: "0"};
  const a = botStateKey(G, ctx);
  expect(botStateKey({...G}, ctx)).toBe(a);
  expect(botStateKey(G, {...ctx, currentPlayer: "1"})).not.toBe(a);
  expect(botStateKey({...G, cpRemaining: G.cpRemaining + 1}, ctx)).not.toBe(a);
  expect(botStateKey({...G, log: [...G.log, {id: 999, turn: 1, phase: "prep", key: "x", args: {}}]}, ctx)).not.toBe(a);
});
