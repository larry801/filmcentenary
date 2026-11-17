/**
 * Imperial Elegy — server-side Rule 34 bot driver for online matches.
 *
 * A match is always created with six boardgame.io seats, because the engine
 * needs all six powers (every power owns a hand, a deck and a national
 * characteristic, and the phase flow walks `POWERS` by name).  The lobby's
 * `setupData.bots` names the seats no human takes; `engine/setup.ts` copies
 * that list into the public `G.bots`, and this module plays them.
 *
 * boardgame.io's Master only accepts moves from active players, and the
 * Socket.IO transport has no `bots` hook (`Local()` is client-side only), so
 * the server drives those seats itself: after every stored state change the
 * driver asks `botDecision` what the bot seat does and dispatches the move
 * through a Master authenticated with that seat's own credentials.
 *
 * The pure half (which seat owes an action, which move it plays, which move
 * unsticks a refused decision) is at the top of the file and is unit tested
 * without a server; `createIEBotDriver` is the storage/transport wiring used by
 * `server.ts`.
 */

import type {Ctx} from "boardgame.io";
import {Master} from "boardgame.io/master";
import {ImperialElegyState, Power, POWERS} from "../imperialElegy/types";
import {botDecision} from "../imperialElegy/engine/bot";
import {powerOfSeat} from "../imperialElegy/engine/pending";
import {botPowersOf, powerSeat} from "../imperialElegy/configuration";

/** A move name and its arguments, the shape `botDecision` returns. */
export interface BotMove {
  move: string;
  args?: unknown[];
}

/** How many identical refusals a decision gets before the escape move. */
export const BOT_REFUSAL_LIMIT = 3;

/**
 * The power that owes the next action, or `null` when nobody does.
 *
 * The seat is chosen the way the hotseat board and the self-play harness
 * (`tools/ie-sim/harness.ts`) choose it:
 *
 *  - an open pending decision belongs to its deciding power, whoever that is;
 *  - prep and diplomacy are framework turns, so `ctx.currentPlayer` is the seat
 *    the engine will accept a move from;
 *  - the end phase asks every power once (`flags.endDone`);
 *  - action, wartime and the Great War maneuver step are the engine's
 *    `activePower`.
 *
 * The GW planning step is deliberately `null`: it is one table-wide "start the
 * maneuver" action (`endGwPlanningMove`), not a per-seat obligation, so a bot
 * must not press it while a human still has planning transfers to spend.  When
 * every living seat is a bot there is nobody else to press it, so the bot does.
 */
export const botSeatToAct = (
  G: ImperialElegyState,
  ctx: Pick<Ctx, "currentPlayer" | "gameover">,
): Power | null => {
  if (G.result) return null;
  if (ctx.gameover !== undefined) return null;
  if (G.pending !== null && G.pending !== undefined) return G.pending.power;
  const phase = String(G.phase);
  if (phase === "prep" || phase === "diplomacy") return powerOfSeat(ctx.currentPlayer) ?? null;
  if (phase === "end") {
    return POWERS.find((power) => !G.powers[power]?.eliminated && G.powers[power]?.flags.endDone !== true) ?? null;
  }
  if (phase === "gwPlanning") return allSeatsAreBots(G) ? G.activePower ?? null : null;
  return G.activePower ?? null;
};

/** True when no living seat is played by a human. */
const allSeatsAreBots = (G: ImperialElegyState): boolean => {
  const bots = botPowersOf(G);
  return POWERS.filter((power) => G.powers[power]?.eliminated !== true).every((power) => bots.includes(power));
};

/**
 * The move that unsticks a seat whose decision the engine keeps refusing.
 *
 * Mirrors the escape map the hotseat board uses (`useBoardModel.ts`), which was
 * written after a repeated refusal froze a live match: a rejected move leaves
 * the state untouched, so the driver sees the same decision forever unless it
 * takes the phase's own exit.  An open decision is answered with its first
 * option (the same rule the bot applies), never declined blindly, and a
 * diplomacy seat that has not chosen a home card yet chooses one instead of
 * asking to close a phase the engine will refuse.
 */
export const botEscapeMove = (G: ImperialElegyState, phase: string): BotMove | null => {
  if (G.pending !== null && G.pending !== undefined) {
    const option = G.pending.options[0];
    return option === undefined ? {move: "declinePending"} : {move: "resolvePending", args: [option.id]};
  }
  switch (phase) {
    case "action": return {move: "pass"};
    case "wartime": return {move: "passWarMove"};
    case "prep": return {move: "finishPrep"};
    case "diplomacy": {
      // `endDiplomacy` refuses until every power has chosen, and the deciding
      // seat's own choice is the part it can still make.
      const unchosen = POWERS.find((power) => (
        !G.powers[power]?.eliminated && G.powers[power]?.flags.homeChosen !== true && (G.powers[power]?.homeCards.length ?? 0) > 0
      ));
      const power = unchosen ?? null;
      if (power !== null) return {move: "chooseHomeCard", args: [G.powers[power].homeCards[0]]};
      return {move: "endDiplomacy"};
    }
    case "end": return {move: "endPhaseTurn"};
    case "gwPlanning": return {move: "endGwPlanningMove"};
    case "gwWinter": return {move: "gwResolveWinter"};
    default: return {move: "gwPass"};
  }
};

/** Short, stable description of the state a decision was made from. */
export const botStateKey = (G: ImperialElegyState, ctx: Pick<Ctx, "currentPlayer">): string =>
  [
    String(G.phase),
    G.turn,
    G.activePower,
    G.cpRemaining,
    G.pending?.id ?? "-",
    G.log.length,
    String(ctx.currentPlayer ?? "-"),
  ].join("|");

/**
 * Deterministic stand-in for `ctx.random` outside the reducer.
 *
 * A stored `ctx` carries no plugin APIs (they are attached while a move runs),
 * and consuming the real seeded PRNG here would desync it from the moves.  The
 * Rule 34 tables only use a die to pick a priority row, so a small hash of the
 * state keeps the bot from collapsing onto one branch while staying stable
 * across a retry — a roll that changed every attempt would defeat the refusal
 * counter above.
 */
export const botRandom = (G: ImperialElegyState, power: Power): Ctx["random"] => {
  const seedText = `${G.seed}|${G.turn}|${G.phase}|${G.activePower}|${power}|${G.decisionSeq}|${G.log.length}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedText.length; i += 1) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const next = (): number => {
    h ^= h << 13;
    h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 4294967296;
  };
  const Die = (spotvalue = 6, diceCount?: number): number | number[] => {
    const roll = (): number => Math.floor(next() * spotvalue) + 1;
    return diceCount === undefined ? roll() : Array.from({length: diceCount}, roll);
  };
  const Shuffle = <T,>(deck: T[]): T[] => {
    const clone = [...deck];
    for (let i = clone.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [clone[i], clone[j]] = [clone[j], clone[i]];
    }
    return clone;
  };
  return {Die, Number: next, Shuffle} as unknown as Ctx["random"];
};

/** The move the bot plays for `power` in this state. */
export const botMoveForSeat = (G: ImperialElegyState, ctx: Ctx, power: Power): BotMove => {
  const withRandom = {...ctx, random: ctx.random ?? botRandom(G, power)} as Ctx;
  return botDecision(G, withRandom, power);
};

/**
 * True when the match still needs a bot.  A hotseat game never reaches a
 * server, and a finished match needs nobody, so both short-circuit the driver.
 */
export const stateNeedsBots = (state: any): boolean =>
  Boolean(
    state &&
    state.ctx &&
    state.ctx.gameover === undefined &&
    state.G?.result == null &&
    botPowersOf(state.G).length > 0,
  );

/**
 * Give every bot seat a name and credentials, and remember that it is a bot.
 *
 * boardgame.io's `join` endpoint refuses a seat that already has a name, so
 * naming the bots is also what keeps humans out of them: the lobby's join links
 * point at the first seat without a name.  The credentials never reach a client
 * (`createClientMatchData` strips them) and let the driver's Master
 * authenticate exactly like a human player.
 */
export const seedBotPlayers = (
  metadata: any,
  state: any,
  makeCredentials: () => string,
  botName: (power: Power) => string = (power) => `Bot ${power}`,
): boolean => {
  const bots = botPowersOf(state?.G);
  if (bots.length === 0 || !metadata?.players) return false;
  let changed = false;
  for (const power of bots) {
    const player = metadata.players[powerSeat(power)];
    if (!player) continue;
    if (player.name || player.credentials) continue;
    player.name = botName(power);
    player.credentials = makeCredentials();
    player.isBot = true;
    changed = true;
  }
  return changed;
};

// ---------------------------------------------------------------------------
// Server wiring
// ---------------------------------------------------------------------------

/** Minimal structural types, so this module does not import server internals. */
interface StorageLike {
  fetch(matchID: string, opts: {state?: boolean; metadata?: boolean}): Promise<any>;
  setState?(matchID: string, state: any, deltalog?: any[]): Promise<void> | void;
  setMetadata?(matchID: string, metadata: any): Promise<void> | void;
  createMatch?(matchID: string, opts: any): Promise<void> | void;
}

interface QueueLike {
  add(fn: () => Promise<unknown> | unknown): Promise<unknown>;
}

export interface BotDriverOptions {
  db: StorageLike;
  /** The processed boardgame.io game definition the Master runs. */
  game: any;
  /** The server's `Auth`, so a bot's credentials are checked like a human's. */
  auth: any;
  /** The Socket.IO pub-sub the server broadcasts state changes on. */
  pubSub: {publish(channel: string, payload: unknown): void};
  /** Per-match queue shared with the socket transport, so writes stay ordered. */
  queueFor?: (matchID: string) => QueueLike | null;
  log?: (...args: unknown[]) => void;
  /** Decisions dispatched in one drain before yielding to the event loop. */
  maxStepsPerTick?: number;
}

/** boardgame.io's socket transport keys its broadcast channels this way. */
const channelOf = (matchID: string): string => `MATCH-${matchID}`;

export interface BotDriver {
  /** Drain one match's bot seats until a human is asked, or nothing is owed. */
  tick: (matchID: string) => Promise<void>;
  /** Queue a drain after the current call stack, collapsing repeat requests. */
  schedule: (matchID: string) => void;
  /**
   * Drop every queued drain and the per-match bookkeeping.  The server never
   * calls this, but a test (or a shutdown hook) must be able to release the
   * timers instead of leaving them to fire into a closed storage.
   */
  stop: () => void;
  /** Number of matches the driver currently tracks (diagnostics). */
  active: () => number;
}

export const createIEBotDriver = (options: BotDriverOptions): BotDriver => {
  const {db, game, auth, pubSub} = options;
  const maxSteps = options.maxStepsPerTick ?? 400;
  const log = options.log ?? ((...args: unknown[]) => console.warn("[IE bot]", ...args));

  interface MatchState {
    running: boolean;
    dirty: boolean;
    failure: {key: string; stateKey: string; count: number} | null;
    master: any;
    timer: ReturnType<typeof setTimeout> | null;
  }
  const matches = new Map<string, MatchState>();

  const ensure = (matchID: string): MatchState => {
    let entry = matches.get(matchID);
    if (!entry) {
      entry = {running: false, dirty: false, failure: null, master: null, timer: null};
      matches.set(matchID, entry);
    }
    return entry;
  };

  /** Set by `stop()`; a running drain checks it between decisions. */
  let stopped = false;

  /**
   * A Master whose only job is to apply the move and broadcast it.  Its
   * transport mirrors the Socket.IO one's `sendAll`: publish the raw payload on
   * the match channel, where each connected client applies its own
   * `playerView` and log redaction.
   */
  const masterFor = (matchID: string, entry: MatchState): any => {
    if (entry.master !== null) return entry.master;
    entry.master = new Master(
      game,
      // The caller passes the server's real StorageAPI; the structural type
      // here only names the two methods this module calls directly.
      db as never,
      {
        send: () => undefined,
        sendAll: (payload: unknown) => pubSub.publish(channelOf(matchID), payload),
      },
      auth,
    );
    return entry.master;
  };

  const fetchState = async (matchID: string): Promise<{state: any; metadata: any}> => {
    const result = await db.fetch(matchID, {state: true, metadata: true});
    return {state: result?.state, metadata: result?.metadata};
  };

  const dispatch = async (
    matchID: string,
    stateID: number,
    seat: string,
    credentials: string,
    decision: BotMove,
  ): Promise<void> => {
    const action = {
      type: "MAKE_MOVE",
      payload: {type: decision.move, args: decision.args ?? [], playerID: seat, credentials},
    };
    const run = async (): Promise<void> => {
      await masterFor(matchID, ensure(matchID)).onUpdate(action, stateID, matchID, seat);
    };
    const queue = options.queueFor?.(matchID) ?? null;
    if (queue === null) {
      await run();
      return;
    }
    await queue.add(run);
  };

  const schedule = (matchID: string): void => {
    if (stopped) return;
    const entry = ensure(matchID);
    if (entry.running) {
      entry.dirty = true;
      return;
    }
    if (entry.timer !== null) return;
    // Defer so a caller inside a storage write never re-enters the Master
    // before that write has been acknowledged.
    entry.timer = setTimeout(() => {
      entry.timer = null;
      void tick(matchID);
    }, 0);
    // A server process stays alive for its socket, but a test runner (and a
    // server shutting down) should not wait on a deferred drain.
    (entry.timer as unknown as {unref?: () => void}).unref?.();
  };

  const tick = async (matchID: string): Promise<void> => {
    const entry = ensure(matchID);
    if (entry.running) {
      // A drain is already running and will pick this change up; collapsing it
      // here is also what stops a bot's own writes from stacking up drains.
      entry.dirty = true;
      return;
    }
    entry.running = true;
    /** True when the drain stopped because its per-tick step budget ran out. */
    let hitStepCap = false;
    try {
      for (let step = 0; step < maxSteps; step += 1) {
        if (stopped) { hitStepCap = false; break; }
        const {state, metadata} = await fetchState(matchID);
        if (!state || !metadata) { hitStepCap = false; break; }
        if (!stateNeedsBots(state)) { hitStepCap = false; break; }

        const G = state.G as ImperialElegyState;
        const power = botSeatToAct(G, state.ctx);
        if (power === null || !botPowersOf(G).includes(power)) { hitStepCap = false; break; }

        const seat = powerSeat(power);
        const credentials = metadata.players?.[seat]?.credentials;
        if (typeof credentials !== "string") { hitStepCap = false; break; }

        const decision = botMoveForSeat(G, state.ctx, power);
        const stateKey = botStateKey(G, state.ctx);
        const key = `${power}#${decision.move}#${JSON.stringify(decision.args ?? [])}`;
        const before = state._stateID as number;

        await dispatch(matchID, before, seat, credentials, decision);

        const after = await fetchState(matchID);
        if (!after.state || after.state._stateID !== before) {
          // The move landed, or another player moved first: decide again from
          // the fresh state, and forget the refusal history.
          entry.failure = null;
          // Only a full pass through the budget means "there may be more".
          hitStepCap = step === maxSteps - 1;
          continue;
        }

        const previous = entry.failure;
        const count = previous !== null && previous.key === key && previous.stateKey === stateKey
          ? previous.count + 1
          : 1;
        entry.failure = {key, stateKey, count};
        if (count < BOT_REFUSAL_LIMIT) {
          hitStepCap = step === maxSteps - 1;
          continue;
        }

        // The engine keeps refusing this decision on an unchanged state.  Take
        // the phase's own exit so the match continues instead of stalling.
        const escape = botEscapeMove(G, String(G.phase));
        if (escape === null || escape.move === decision.move) {
          log(`giving up on ${matchID} ${power}: ${decision.move} is refused`);
          hitStepCap = false;
          break;
        }
        log(`falling back to ${escape.move} for ${matchID} ${power} (refused ${decision.move})`);
        await dispatch(matchID, before, seat, credentials, escape);
        const escaped = await fetchState(matchID);
        if (!escaped.state || escaped.state._stateID === before) {
          log(`escape ${escape.move} was refused too; leaving ${matchID} ${power} alone`);
          hitStepCap = false;
          break;
        }
        entry.failure = null;
        hitStepCap = step === maxSteps - 1;
      }
    } catch (error) {
      log(`driver error on ${matchID}`, error);
    } finally {
      const finished = matches.get(matchID) ?? entry;
      finished.running = false;
      if (stopped) {
        matches.delete(matchID);
      } else if (finished.dirty || hitStepCap) {
        // `dirty` means a write arrived while this drain ran; `hitStepCap` means
        // the budgets ran out with a bot still to play.  Either way the match
        // owes another drain.
        finished.dirty = false;
        schedule(matchID);
      } else {
        // Drop the bookkeeping (including the cached Master) once the match
        // needs no bots; a later write re-creates it from storage.
        const final = await fetchState(matchID).catch(() => null);
        if (!final || !stateNeedsBots(final.state)) matches.delete(matchID);
      }
    }
  };

  return {
    tick,
    schedule,
    stop: () => {
      stopped = true;
      for (const entry of matches.values()) {
        if (entry.timer !== null) {
          clearTimeout(entry.timer);
          entry.timer = null;
        }
        entry.dirty = false;
      }
      matches.clear();
    },
    active: () => matches.size,
  };
};

/**
 * Wrap a storage API so every write drains that match's bot seats.
 *
 * This is the only hook that sees *every* state change (human moves included),
 * and it is the same delegation the match-data wrapper uses, so the two wraps
 * compose in either order.  `createMatch` additionally seats the bots, which is
 * what makes the human join links skip them.
 */
export const attachBotDriverToStorage = (
  db: StorageLike,
  driver: BotDriver,
  makeCredentials: () => string,
  botName?: (power: Power) => string,
): void => {
  if (typeof db.createMatch === "function") {
    const originalCreate = db.createMatch.bind(db);
    db.createMatch = async function createMatchWithBots(matchID: string, opts: any) {
      // Seat the bots before the delegate writes anything, so the metadata that
      // reaches storage — and the match-data backup's cached copy of it — has
      // the bot names, which is what keeps humans out of those seats.
      seedBotPlayers(opts?.metadata, opts?.initialState, makeCredentials, botName);
      await originalCreate(matchID, opts);
      if (stateNeedsBots(opts?.initialState)) driver.schedule(matchID);
    };
  }

  if (typeof db.setState === "function") {
    const originalSetState = db.setState.bind(db);
    db.setState = async function setStateWithBots(matchID: string, state: any, deltalog?: any[]) {
      await originalSetState(matchID, state, deltalog);
      if (stateNeedsBots(state)) driver.schedule(matchID);
    };
  }
};

export default createIEBotDriver;
