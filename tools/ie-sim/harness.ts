/**
 * Seeded self-play harness for Imperial Elegy.
 *
 * Runs the *real* boardgame.io reducer (seeded random plugin, phase/turn flow,
 * move validation, playerView) and drives every seat with `botDecision`.
 * Everything except the UI is exercised, so a failure here is an engine or
 * rule-implementation bug.
 */
import {Ctx} from "boardgame.io";
import {CreateGameReducer, InitializeGame, ProcessGameConfig} from "boardgame.io/internal";
import {ImperialElegyGameDef} from "../../src/imperialElegy/game";
import {redactForView} from "../../src/imperialElegy/engine/privacy";
import {botDecision} from "../../src/imperialElegy/engine/bot";
import {ImperialElegyState, POWERS, Power} from "../../src/imperialElegy/types";
import {ensureStateDefaults} from "../../src/imperialElegy/engine/migrations";
import {SPACES, neighboursOf} from "../../src/imperialElegy/constant/spaces";
import {friendlySpace, hostileOwner} from "../../src/imperialElegy/engine/rules";
import {performGwManeuver} from "../../src/imperialElegy/engine/greatWarFlow";
import {outbreakGreatWar} from "../../src/imperialElegy/engine/greatWar";

export interface SimOptions {
  seed: string | number;
  /**
   * Start the match in the Great War (25.x) instead of 1850.  The pre-war
   * decade loop is the same either way; this only moves the start so the GW
   * half of the engine gets the same coverage.
   */
  greatWar?: boolean;
  /**
   * Aggressive player: when the bot has nothing better to do, advance a unit
   * toward the nearest enemy instead of passing.  That is what drives contact,
   * battles, retreats and occupation through the real engine.
   */
  aggressive?: boolean;
  /** Hard cap on dispatched actions. */
  maxSteps?: number;
  /** Randomised pending choices (chaos exploration) instead of first option. */
  chaos?: number;
  /** RNG for the chaos option picker. */
  rng?: () => number;
  /** Called on every dispatched action (for tracing). */
  trace?: (step: number, event: SimEvent) => void;
}

export interface SimEvent {
  step: number;
  phase: string;
  turn: number;
  power: Power | null;
  move: string;
  args: unknown[];
  status: "ok" | "invalid" | "no-such-move" | "threw";
  error?: string;
}

export interface SimIssue {
  kind: "illegal" | "stall" | "invariant" | "exception" | "unfinished";
  step: number;
  turn: number;
  phase: string;
  power: Power | null;
  move?: string;
  args?: unknown[];
  detail: string;
}

export interface SimResult {
  seed: string | number;
  steps: number;
  phase: string;
  turn: number;
  finished: boolean;
  result: ImperialElegyState["result"];
  issues: SimIssue[];
  gw: boolean;
  events: SimEvent[];
}

const cloneCtx = (ctx: Ctx): Ctx => JSON.parse(JSON.stringify(ctx)) as Ctx;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The seat the board (or the hotseat driver) would click for right now. */
export function actingSeatFor(G: ImperialElegyState, ctx: Ctx, states: Map<string, ImperialElegyState>): string | null {
  if (G.pending) {
    const owner = G.pending.power;
    return String(POWERS.indexOf(owner));
  }
  if (G.phase === "end" || G.phase === "gwPlanning" || G.phase === "gwWinter") {
    // Sequential per-player turns: pick the first power that has not acted yet.
    const undone = POWERS.find((p) => {
      const own = states.get(String(POWERS.indexOf(p))) ?? G;
      return !own.powers[p].flags.endDone;
    });
    if (G.phase === "end" && undone) return String(POWERS.indexOf(undone));
    return ctx.currentPlayer ?? null;
  }
  if (G.phase === "prep" || G.phase === "diplomacy") {
    return ctx.currentPlayer ?? null;
  }
  return String(POWERS.indexOf(G.activePower));
}

/** Cards that live in a power's `homeCards` list by design. */
const isHomeCard = (G: ImperialElegyState, card: string): boolean =>
  POWERS.some((p) => G.powers[p].homeCards.includes(card));

/** Structural invariants that must hold after every action. */
export function checkInvariants(G: ImperialElegyState): string[] {
  const problems: string[] = [];
  // A home card legitimately appears in both `homeCards` and `hand` when it is
  // selected for the turn; `homeCards` is the permanent pool, not a zone.  Only
  // track real card zones here.
  const seenCards = new Map<string, string>();
  const noteCard = (card: string, where: string) => {
    if (isHomeCard(G, card)) return;
    const prev = seenCards.get(card);
    if (prev !== undefined) problems.push(`card ${card} is in both ${prev} and ${where}`);
    else seenCards.set(card, where);
  };
  G.deck.forEach((c) => noteCard(c, "deck"));
  G.discard.forEach((c) => noteCard(c, "discard"));
  G.removed.forEach((c) => noteCard(c, "removed"));
  for (const p of POWERS) {
    const ps = G.powers[p];
    ps.hand.forEach((c) => noteCard(c, `${p} hand`));
    (ps.cpChain ?? []).forEach((c) => noteCard(c, `${p} cpChain`));
    if (ps.industryCard) noteCard(ps.industryCard, `${p} industryCard`);
    if (ps.stability < 0) problems.push(`${p} stability ${ps.stability} < 0`);
    if (ps.manpower < 0) problems.push(`${p} manpower ${ps.manpower} < 0`);
    if (ps.industry < 0) problems.push(`${p} industry ${ps.industry} < 0`);
  }
  // Unit bookkeeping: a unit lives exactly once, in its space and the units map.
  const counted = new Set<string>();
  for (const [spaceId, space] of Object.entries(G.spaces)) {
    for (const uid of space.units) {
      if (counted.has(uid)) problems.push(`unit ${uid} listed twice (second in ${spaceId})`);
      counted.add(uid);
      const unit = G.units[uid];
      if (!unit) problems.push(`space ${spaceId} references missing unit ${uid}`);
      else if (unit.space !== spaceId && !unit.naval) {
        // Naval boxes: movement bookkeeping may keep space in sync; flag only land.
        problems.push(`unit ${uid} in ${spaceId}.units but unit.space=${String(unit.space)}`);
      }
    }
  }
  for (const [uid, unit] of Object.entries(G.units)) {
    if (unit.space !== null && unit.space !== undefined && !counted.has(uid)) {
      problems.push(`unit ${uid} has space ${String(unit.space)} but is not in that space's units list`);
    }
  }
  if (G.pending) {
    if (!G.pending.options || G.pending.options.length === 0) {
      problems.push(`pending ${G.pending.kind} has no options`);
    }
    if (!POWERS.includes(G.pending.power) && !G.pending.power.startsWith("IT") && !G.pending.power.startsWith("US")) {
      problems.push(`pending ${G.pending.kind} has unknown owner ${String(G.pending.power)}`);
    }
  }
  if (G.cpRemaining < 0) problems.push(`cpRemaining ${G.cpRemaining}`);
  return problems;
}

/**
 * A harness-only move that opens the Great War from inside a real move, so the
 * outbreak runs with the engine's seeded random plugin (an out-of-move call has
 * no `ctx.random`).  Boardgame.io resolves moves from the phase stage, so the
 * move is injected there as well.
 */
const simOutbreak = (G: ImperialElegyState, ctx: Ctx): void => {
  for (const p of POWERS) {
    G.powers[p].alliance = p === "GE" || p === "AU" || p === "OT" ? "taCommitted" : "teCommitted";
  }
  G.wtt = 5;
  outbreakGreatWar(G, ctx, "GE", "sim" as any, undefined);
  G.phase = "gwPlanning";
};

const withSimMoves = (def: typeof ImperialElegyGameDef): typeof ImperialElegyGameDef => {
  const phases: Record<string, any> = {};
  for (const [name, phase] of Object.entries(def.phases ?? {})) {
    phases[name] = {
      ...phase,
      turn: {
        ...phase.turn,
        stages: {play: {moves: {...(phase.turn as any)?.stages?.play?.moves, simOutbreak}}},
      },
    };
  }
  return {...def, moves: {...def.moves, simOutbreak}, phases: phases as any};
};

/** Opposing alliance of `power`, from the GW boxes. */
const gwEnemiesOf = (G: ImperialElegyState, power: Power): Power[] => {
  if (!G.gw) return [];
  const side = G.gw.te.includes(power) ? "te" : G.gw.ta.includes(power) ? "ta" : null;
  if (side === null) return [];
  const rivals = side === "te" ? G.gw.ta : G.gw.te;
  return rivals.filter((p) => !G.powers[p].eliminated);
};

/**
 * One aggressive GW maneuver for a seat: deploy/refit/march into contact.
 * Deliberately engine-shaped (it only reads state and names a real move), so
 * a refusal here is a genuine engine refusal rather than a bot heuristic.
 */
const aggressiveGwMove = (
  G: ImperialElegyState,
  power: Power,
  phase: "gwPlanning" | "gwManeuver",
): {move: string; args: unknown[]} | null => {
  if (!G.gw) return null;
  const me = G.powers[power];
  if (me.eliminated) return null;
  const enemies = gwEnemiesOf(G, power);
  if (enemies.length === 0) return null;
  // Both GW steps spend the same war budget.
  if ((me.gwBudget ?? 0) < 1) return null;

  // 26.x planning: draft onto a home key so there is something to march with.
  if (phase === "gwPlanning") {
    if (me.manpower < 1) return null;
    const home = Object.keys(G.spaces).find((id) => G.spaces[id].control === power
      && G.spaces[id].units.length === 0
      && G.spaces[id].trench);
    if (home === undefined) return null;
    return {move: "gwDraft", args: [home]};
  }

  // Maneuver: attack when already adjacent, otherwise march toward contact.
  const enemySpaces = new Set<string>();
  for (const [id, space] of Object.entries(G.spaces)) {
    if (space.units.some((uid) => {
      const unit = G.units[uid];
      if (!unit || unit.naval) return false;
      return hostileOwner(G, power, unit.owner);
    })) enemySpaces.add(id);
  }
  // 26.x: a land battle is declared from an adjacent friendly space; marching
  // *into* an enemy-held space is illegal (the destination must be friendly).
  for (const [id, space] of Object.entries(G.spaces)) {
    for (const uid of space.units) {
      const unit = G.units[uid];
      if (!unit || unit.naval || unit.owner !== power) continue;
      for (const to of neighboursOf(id)) {
        if (enemySpaces.has(to)) return {move: "landBattle", args: [id, to]};
      }
    }
  }
  // Otherwise march one hop toward the nearest enemy, but only into a space the
  // engine will accept: a friendly destination with no hostile army in it.
  for (const [id, space] of Object.entries(G.spaces)) {
    for (const uid of space.units) {
      const unit = G.units[uid];
      if (!unit || unit.naval || unit.owner !== power) continue;
      if (!friendlySpace(G, id, power)) continue;
      const step = nextHopToward(G, id, enemySpaces);
      if (step === null || enemySpaces.has(step)) continue;
      const target = G.spaces[step];
      if (!target || !friendlySpace(G, step, power)) continue;
      if (target.units.some((other) => {
        const candidate = G.units[other];
        return candidate && !candidate.naval && hostileOwner(G, power, candidate.owner);
      })) continue;
      return {move: "gwMarch", args: [unit.id, step]};
    }
  }
  // Refit a reduced unit rather than wasting the impulse.
  const reduced = Object.values(G.units).find(
    (unit) => unit.owner === power && !unit.naval && unit.steps < 2,
  );
  if (reduced) return {move: "gwRefit", args: [reduced.id]};
  return null;
};

/** One BFS step from `from` toward any space in `targets`. */
const nextHopToward = (G: ImperialElegyState, from: string, targets: Set<string>): string | null => {
  if (targets.has(from)) return null;
  const prev = new Map<string, string>();
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of neighboursOf(current)) {
      if (!G.spaces[next] || seen.has(next)) continue;
      seen.add(next);
      prev.set(next, current);
      if (targets.has(next)) {
        // Walk back to the first hop off `from`.
        let hop = next;
        while (prev.get(hop) !== undefined && prev.get(hop) !== from) hop = prev.get(hop)!;
        return hop;
      }
      queue.push(next);
    }
  }
  return null;
};

/**
 * Probe a GW maneuver on a deep clone with the real flow, so the aggressive
 * driver only ever names a move the engine accepts (a refused move would look
 * like an engine bug but is really a bad heuristic).
 */
const probeGwManeuver = (
  G: ImperialElegyState,
  power: Power,
  move: string,
  args: unknown[],
): boolean => {
  const clone = JSON.parse(JSON.stringify(G)) as ImperialElegyState;
  const ctx = {
    playerID: String(POWERS.indexOf(power)),
    random: {Die: () => 3, Number: () => 0, Shuffle: (a: unknown[]) => a},
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    phase: clone.phase,
  } as unknown as Ctx;
  let request: Parameters<typeof performGwManeuver>[2];
  if (move === "gwMarch") request = {kind: "march", power, unitId: String(args[0]), to: String(args[1])};
  else if (move === "gwRail") request = {kind: "rail", power, unitId: String(args[0]), to: String(args[1])};
  else if (move === "gwRefit") request = {kind: "refit", power, unitId: String(args[0])};
  else if (move === "gwDraft") request = {kind: "draft", power, space: String(args[0])};
  else if (move === "landBattle") request = {kind: "landBattle", power, from: String(args[0]), to: String(args[1])};
  else return false;
  try {
    return performGwManeuver(clone, ctx, request).ok;
  } catch {
    return false;
  }
};

export function runSeededGame(opts: SimOptions): SimResult {
  const def = opts.greatWar ? withSimMoves(ImperialElegyGameDef) : ImperialElegyGameDef;
  const game = ProcessGameConfig({...def, seed: opts.seed} as any);
  const reducer = CreateGameReducer({game, isClient: false});
  const rng = opts.rng ?? mulberry32(0x51ed);
  const maxSteps = opts.maxSteps ?? 20000;

  // One authoritative server state.  Per-seat views are derived with the same
  // `playerView` the online server uses, mirroring the hotseat board.
  let state: any = InitializeGame({game, numPlayers: 6});
  if (opts.greatWar) {
    state = reducer(state, {type: "MAKE_MOVE", payload: {type: "simOutbreak", args: [], playerID: state.ctx.currentPlayer}});
    if (!(state.G as ImperialElegyState).gw?.active) {
      throw new Error("harness: simOutbreak did not start the Great War");
    }
  }
  const views = new Map<string, ImperialElegyState>();

  const viewFor = (seat: string | null): ImperialElegyState => {
    const cached = seat === null ? undefined : views.get(seat);
    if (cached !== undefined) return cached;
    const G = redactForView(JSON.parse(JSON.stringify(state.G)) as ImperialElegyState, seat, state.ctx) as ImperialElegyState;
    ensureStateDefaults(G);
    if (seat !== null) views.set(seat, G);
    return G;
  };

  const events: SimEvent[] = [];
  const issues: SimIssue[] = [];
  let steps = 0;
  /** Repeated identical rejected decision detector (mirrors the board's escape). */
  let repeat = {key: "", count: 0};

  for (; steps < maxSteps; steps += 1) {
    const G = state.G as ImperialElegyState;
    if (G.result) break;
    if (state.ctx.gameover !== undefined) break;

    let seat = actingSeatFor(G, state.ctx, views);
    if (seat === null) {
      issues.push({kind: "stall", step: steps, turn: G.turn, phase: G.phase, power: null, detail: "no acting seat"});
      break;
    }
    // In sequential phases the bot must be asked for the seat that still owes
    // an action; the pending owner wins.
    const view = viewFor(seat);
    const power = POWERS[Number(seat)] ?? (G.pending?.power as Power) ?? null;

    const decision = (() => {
      try {
        if (G.pending) {
          const pendingView = view.pending ?? G.pending;
          if (opts.chaos && opts.chaos > 0 && rng() < opts.chaos && pendingView.options.length > 1) {
            const pick = pendingView.options[Math.floor(rng() * pendingView.options.length)];
            return {move: "resolvePending", args: [pick.id]};
          }
          if (!pendingView.options || pendingView.options.length === 0) return {move: "declinePending", args: []};
          return {move: "resolvePending", args: [pendingView.options[0].id]};
        }
        return botDecision(view, state.ctx, power as Power);
      } catch (err) {
        issues.push({
          kind: "exception", step: steps, turn: G.turn, phase: G.phase, power,
          detail: `botDecision threw: ${(err as Error)?.stack ?? String(err)}`,
        });
        return {move: "__none__", args: []};
      }
    })();
    // Aggressive mode: override a passive decision with a real maneuver so the
    // contact/battle/retreat paths are exercised through the engine.  The move
    // is probed with the real flow first, so a refusal reported below is always
    // an engine refusal rather than a heuristic mistake.
    if (opts.aggressive && !G.pending && (G.phase === "gwManeuver" || G.phase === "gwPlanning")) {
      const attacking = aggressiveGwMove(view, power as Power, G.phase as "gwPlanning" | "gwManeuver");
      const probed = attacking !== null && probeGwManeuver(G, power as Power, attacking.move, attacking.args);
      if (
        attacking !== null &&
        probed &&
        (decision.move === "gwPass" || decision.move === "endGwPlanningMove")
      ) {
        decision.move = attacking.move;
        decision.args = attacking.args;
      }
    }

    const before = state.G as ImperialElegyState;
    const beforePhase = before.phase;
    const beforeStepSignature = `${before.phase}|${before.turn}|${before.cpRemaining}|${before.log.length}|${before.pending?.id ?? "-"}`;
    const action = {type: "MAKE_MOVE", payload: {type: decision.move, args: decision.args ?? [], playerID: seat}};
    let next: any;
    try {
      next = reducer(state, action);
    } catch (err) {
      issues.push({
        kind: "exception", step: steps, turn: before.turn, phase: before.phase, power,
        move: decision.move, args: decision.args ?? [],
        detail: String((err as Error)?.stack ?? err),
      });
      break;
    }
    const transient = next.transients;
    const changed = next.G !== before || next.ctx !== state.ctx;
    const event: SimEvent = {
      step: steps, phase: beforePhase, turn: before.turn, power,
      move: decision.move, args: (decision.args ?? []) as unknown[],
      status: "ok",
    };
    if (transient?.error) {
      const err = transient.error;
      event.status = err.type === "InactivePlayer" ? "invalid" : "invalid";
      event.error = `${err.type}: ${JSON.stringify(err.payload ?? null)}`;
      // Ask the flow itself why a GW maneuver was refused; the reducer only
      // says "invalid_move", which cannot distinguish a real engine refusal
      // from a bad heuristic in this harness.
      let reason = "";
      if (err.type === "action/invalid_move" && before.phase === "gwManeuver" && power !== null) {
        const probeArgs = decision.args ?? [];
        const request =
          decision.move === "landBattle" ? {kind: "landBattle" as const, power, from: String(probeArgs[0]), to: String(probeArgs[1])} :
          decision.move === "gwMarch" ? {kind: "march" as const, power, unitId: String(probeArgs[0]), to: String(probeArgs[1])} :
          decision.move === "gwRail" ? {kind: "rail" as const, power, unitId: String(probeArgs[0]), to: String(probeArgs[1])} :
          decision.move === "gwRefit" ? {kind: "refit" as const, power, unitId: String(probeArgs[0])} :
          decision.move === "gwDraft" ? {kind: "draft" as const, power, space: String(probeArgs[0])} :
          null;
        if (request !== null) {
          try {
            const res = performGwManeuver(JSON.parse(JSON.stringify(before)), state.ctx, request);
            reason = res.ok ? " (probe accepted — sees a stale/different state)" : ` ${res.error}: ${res.message ?? ""}`;
          } catch (probeError) {
            reason = ` probe threw ${String(probeError)}`;
          }
        }
      }
      issues.push({
        kind: err.type === "InactivePlayer" ? "illegal" : "illegal",
        step: steps, turn: before.turn, phase: before.phase, power,
        move: decision.move, args: decision.args ?? [],
        detail: `${err.type} ${JSON.stringify(err.payload ?? null)}${reason}`,
      });
    } else if (!changed) {
      issues.push({
        kind: "illegal", step: steps, turn: before.turn, phase: before.phase, power,
        move: decision.move, args: decision.args ?? [],
        detail: "reducer returned an unchanged state (move rejected)",
      });
      event.status = "invalid";
    }
    events.push(event);
    opts.trace?.(steps, event);
    state = next;
    views.clear();
    const after = state.G as ImperialElegyState;
    const problems = checkInvariants(after);
    if (problems.length > 0) {
      issues.push({
        kind: "invariant", step: steps, turn: after.turn, phase: after.phase, power,
        move: decision.move, args: decision.args ?? [],
        detail: problems.slice(0, 8).join("; "),
      });
    }
    // A rejected move leaves the state untouched, so an identical decision on
    // an identical state is the board's "bot is stuck" signal.  Report it once
    // and escape with a legal move so the rest of the game can be explored
    // (the hotseat board does the same).
    if (event.status === "invalid" || !changed) {
      const decisionKey = `${decision.move}|${JSON.stringify(decision.args ?? [])}|${beforeStepSignature}`;
      repeat = repeat.key === decisionKey ? {key: decisionKey, count: repeat.count + 1} : {key: decisionKey, count: 1};
      if (repeat.count >= 3) {
        issues.push({
          kind: "stall", step: steps, turn: after.turn, phase: after.phase, power,
          move: decision.move, args: decision.args ?? [],
          detail: "bot repeated a rejected decision three times (deadlock)",
        });
        const escape: Record<string, {move: string; args: unknown[]}> = {
          action: {move: "endImpulse", args: []},
          wartime: {move: "passWarMove", args: []},
          prep: {move: "finishPrep", args: []},
          diplomacy: {move: "endDiplomacy", args: []},
          end: {move: "endPhaseTurn", args: []},
          gwPlanning: {move: "endGwPlanningMove", args: []},
          gwManeuver: {move: "gwPass", args: []},
          gwWinter: {move: "gwResolveWinter", args: []},
        };
        const fallback = escape[after.phase];
        if (fallback) {
          const escaped = reducer(state, {type: "MAKE_MOVE", payload: {type: fallback.move, args: fallback.args, playerID: seat}});
          views.clear();
          if (escaped.transients?.error) {
            issues.push({
              kind: "exception", step: steps, turn: after.turn, phase: after.phase, power,
              move: fallback.move, args: fallback.args,
              detail: `escape move also rejected: ${escaped.transients.error.type}`,
            });
            break;
          }
          state = escaped;
          repeat = {key: "", count: 0};
          steps += 1;
          if (steps >= maxSteps) break;
          continue;
        }
        break;
      }
    } else {
      repeat = {key: "", count: 0};
    }

    // Keep the loop bounded but let the game finish naturally.
    if (steps > 0 && steps % 500 === 0) {
      // Cheap progress guard: a game that never leaves turn 1 is stalled.
      if (after.turn === 1 && after.log.length < 10) {
        issues.push({kind: "stall", step: steps, turn: after.turn, phase: after.phase, power, detail: "no progress in 500 steps"});
        break;
      }
    }
  }

  const finalG = state.G as ImperialElegyState;
  return {
    seed: opts.seed,
    steps,
    phase: finalG.phase,
    turn: finalG.turn,
    finished: Boolean(finalG.result) || state.ctx.gameover !== undefined,
    result: finalG.result ?? null,
    issues,
    gw: Boolean(finalG.gw?.outbreakDone),
    events,
  };
}

export const ALL_POWER_SEATS = ["0", "1", "2", "3", "4", "5"];
export {SPACES, cloneCtx};
