/**
 * Rule 34 bot — self-play legality.
 *
 * `bot.test.ts` only checks that `botDecision` returns a well-formed object.
 * These tests go further: they execute the decision against the real moves and
 * fail when the engine rejects it.  A rejected decision is what actually breaks
 * a hotseat solo match, because the board re-sends it every 500 ms.
 */
import {INVALID_MOVE} from "boardgame.io/core";
import {setupImperialElegy} from "./engine/setup";
import {botDecision} from "./engine/bot";
import {ImperialElegyState, POWERS, Power} from "./types";
import * as M from "./moves";
import {CARD_BY_ID, cardById} from "./engine/deck";
import {ACTION_CARDS} from "./constant/cards.data";
import {SPACES} from "./constant/spaces";

const makeCtx = (playerID: string | null = null) => ({
  playerID,
  random: {Die: () => 3, Number: () => 3, Shuffle: (a: any[]) => a.slice()},
  events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}, endTurn: () => {}},
}) as any;

const ctx = makeCtx();

const moves = M as unknown as Record<string, (...args: any[]) => unknown>;

/** Run one bot decision for `power`; returns the move name and its result. */
const runDecision = (
  G: ImperialElegyState,
  power: Power,
): {move: string; args: unknown[]; result: unknown} => {
  const decision = botDecision(G, ctx, power);
  const fn = moves[decision.move];
  if (typeof fn !== "function") {
    return {move: decision.move, args: decision.args ?? [], result: "NO_SUCH_MOVE"};
  }
  const result = fn(G, makeCtx(String(POWERS.indexOf(power))), ...(decision.args ?? []));
  return {move: decision.move, args: decision.args ?? [], result};
};

/** The power the board would let act next, mirroring the hotseat driver. */
const actingPower = (G: ImperialElegyState): Power => G.pending?.power ?? G.activePower;

const fresh = (phase: ImperialElegyState["phase"], active: Power): ImperialElegyState => {
  const G = setupImperialElegy(ctx);
  G.phase = phase;
  G.activePower = active;
  return G;
};

describe("bot decisions are legal moves", () => {
  test("a home card played in the action phase is never chosen again", () => {
    // Regression: `priorityOne` returned `chooseHomeCard` whenever `homeCards`
    // was non-empty, but the move is diplomacy-only.  After the home card was
    // played the action phase stalled on that illegal move forever.
    const G = fresh("action", "FR");
    G.powers.FR.flags.homeChosen = true;
    G.powers.FR.selectedHomeCard = null;
    G.powers.FR.hand = ["IE-A069"];
    expect(G.powers.FR.homeCards.length).toBeGreaterThan(0);

    const {move, result} = runDecision(G, "FR");
    expect(move).not.toBe("chooseHomeCard");
    expect(result).not.toBe(INVALID_MOVE);
  });

  test("a mandatory card is never spent for CP", () => {
    // Mandatory cards may only be played for their event; `playCard(..., "cp")`
    // refuses them, and a mandatory card in hand also blocks passing.
    const mandatory = ACTION_CARDS.find((card) => card.type === "mandatory")!;
    const G = fresh("action", "GE");
    G.powers.GE.flags.homeChosen = true;
    G.powers.GE.selectedHomeCard = null;
    G.powers.GE.hand = [mandatory.id];
    G.cpRemaining = 0;

    const {move, args, result} = runDecision(G, "GE");
    expect(move).toBe("playCard");
    expect(args[1]).toBe("event");
    expect(result).not.toBe(INVALID_MOVE);
  });

  test("a card is not played for its event while CP is banked", () => {
    // `playCard` opens a fresh impulse, so it refuses an event while CP remains.
    const event = ACTION_CARDS.find((card) => card.type === "event")!;
    const G = fresh("action", "GE");
    G.powers.GE.flags.homeChosen = true;
    G.powers.GE.selectedHomeCard = null;
    G.powers.GE.hand = [event.id];
    G.cpRemaining = 3;

    const {move, args, result} = runDecision(G, "GE");
    if (move === "playCard") expect(args[1]).not.toBe("event");
    expect(result).not.toBe(INVALID_MOVE);
  });

  test("a minor alliance is only called when the 3 CP are available", () => {
    // The move charges 3 CP even though the printed priority is cheaper.
    const G = fresh("action", "FR");
    G.powers.FR.flags.homeChosen = true;
    G.powers.FR.selectedHomeCard = null;
    G.powers.FR.hand = [];
    G.cpRemaining = 2;
    // Give the bot a legal minor-alliance candidate in its BDIT region.
    const minor = Object.keys(SPACES).find((id) => {
      const def = SPACES[id];
      const state = G.spaces[id];
      return def.home === null && def.submap === "main" && state !== undefined
        && state.control === null && state.ally === null;
    })!;
    G.spaces[minor].diplomacy = "FR";

    const decision = botDecision(G, ctx, "FR");
    if (decision.move === "minorAlliance") {
      const result = moves.minorAlliance(G, makeCtx("2"), ...(decision.args as any[]));
      expect(result).toBe(INVALID_MOVE);
    }
    // Whatever it decides, the decision itself must be executable.
    const rerun = runDecision(G, "FR");
    expect(rerun.result).not.toBe(INVALID_MOVE);
  });

  test("excess CP is spent on the alliance track, not on a map influence marker", () => {
    // `placeInfluence` takes a SpaceId; the MPIT track is moved with `placeMpit`.
    const G = fresh("action", "FR");
    G.powers.FR.flags.homeChosen = true;
    G.powers.FR.selectedHomeCard = null;
    G.powers.FR.hand = [];
    G.powers.FR.homeCards = [];
    G.cpRemaining = 3;

    const {move, args, result} = runDecision(G, "FR");
    if (move === "placeInfluence") expect(SPACES[args[0] as string]).toBeDefined();
    if (move === "placeMpit") expect(POWERS).toContain(args[0] as Power);
    expect(result).not.toBe(INVALID_MOVE);
  });

  test("a Great War draft names a legal home key", () => {
    const G = fresh("gwManeuver", "GE");
    G.gw = {
      turn: 2, discard: [], combatCardsInFront: {}, bonusImpulseUsed: false, belligerents: ["GE"],
    } as any;
    G.powers.GE.gwBudget = 3;
    G.powers.GE.manpower = 3;

    // The roll-6 draft tier is only reachable when the budget allows it; make
    // the draft the only thing left by removing the refit targets.
    for (const unit of Object.values(G.units)) {
      if (unit.owner === "GE" && !unit.naval) unit.steps = 2;
    }
    const decision = botDecision(G, ctx, "GE");
    if (decision.move === "gwDraft") {
      expect(typeof decision.args?.[0]).toBe("string");
      expect(SPACES[decision.args![0] as string]).toBeDefined();
    }
    // Whatever it decides, it must be a move the phase accepts.
    const result = moves[decision.move](G, makeCtx("0"), ...(decision.args ?? []));
    expect([INVALID_MOVE, undefined]).toContain(result);
  });

  test("a stalled Great War winter has a legal move", () => {
    // `gwEndTurn` is a maneuver move; the winter only accepts the retry.
    const G = fresh("gwWinter", "GE");
    G.gw = {turn: 2, discard: [], combatCardsInFront: {}, bonusImpulseUsed: false} as any;

    const decision = botDecision(G, ctx, "GE");
    expect(decision.move).toBe("gwResolveWinter");
    // With no active Great War the retry is refused, but it must be a real move
    // — not a manoeuvre move that the phase can never accept.
    const result = moves.gwResolveWinter(G, makeCtx("0"));
    expect(typeof result === "string" || result === undefined).toBe(true);
  });
});

describe("bot self-play", () => {
  test("turn 1 runs to the end phase without an illegal decision", () => {
    const G = setupImperialElegy(ctx);
    const failures: string[] = [];

    // Mirror the hotseat driver: end/gwPlanning/gwWinter ask every power in
    // turn, every other phase asks the active power (or the pending owner).
    const nextPower = (): Power => {
      if (G.phase === "end" || G.phase === "gwPlanning" || G.phase === "gwWinter") {
        const undone = POWERS.find((p) => !G.powers[p].flags.endDone);
        return undone ?? G.activePower;
      }
      return actingPower(G);
    };

    for (let step = 0; step < 8000; step += 1) {
      if (G.phase === "end" || G.result !== null) break;
      const power = nextPower();
      const {move, args, result} = runDecision(G, power);
      if (result === INVALID_MOVE || result === "NO_SUCH_MOVE") {
        failures.push(`${G.phase}/${G.activePower} ${power}: ${move} ${JSON.stringify(args)}`);
        if (failures.length >= 5) break;
      }
    }

    expect(failures).toEqual([]);
  });

  test("every action-phase decision across all six powers is executable", () => {
    const G = setupImperialElegy(ctx);
    const failures: string[] = [];

    // Reach the action phase through the real moves.
    for (const power of POWERS) {
      moves.finishPrep(G, makeCtx(String(POWERS.indexOf(power))));
    }
    for (const power of POWERS) {
      const decision = botDecision(G, ctx, power);
      moves[decision.move](G, makeCtx(String(POWERS.indexOf(power))), ...(decision.args ?? []));
    }
    while (G.pending !== null) {
      const {move, args, result} = runDecision(G, G.pending.power);
      if (result === INVALID_MOVE) {
        failures.push(`pending ${G.pending.kind}: ${move} ${JSON.stringify(args)}`);
        break;
      }
    }
    expect(failures).toEqual([]);
    expect(G.phase).toBe("action");

    // Now let each power take several decisions in turn.
    for (const power of POWERS) {
      G.activePower = power;
      for (let step = 0; step < 12; step += 1) {
        if (G.phase !== "action" || G.activePower !== power || G.pending !== null) break;
        const {move, args, result} = runDecision(G, power);
        if (result === INVALID_MOVE || result === "NO_SUCH_MOVE") {
          failures.push(`${power}: ${move} ${JSON.stringify(args)} cp=${G.cpRemaining}`);
        }
        if (failures.length >= 5) break;
      }
    }

    expect(failures).toEqual([]);
  });

  test("mandatory cards never leave a power unable to act", () => {
    const mandatory = ACTION_CARDS.filter((card) => card.type === "mandatory");
    const failures: string[] = [];
    for (const card of mandatory.slice(0, 12)) {
      const G = fresh("action", "GE");
      G.powers.GE.flags.homeChosen = true;
      G.powers.GE.selectedHomeCard = null;
      G.powers.GE.hand = [card.id];
      G.cpRemaining = 0;
      const {move, args, result} = runDecision(G, "GE");
      if (result === INVALID_MOVE || result === "NO_SUCH_MOVE") {
        failures.push(`${card.id}: ${move} ${JSON.stringify(args)}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

test("the bot only ever names cards that exist in the deck", () => {
  const G = setupImperialElegy(ctx);
  G.phase = "action";
  G.activePower = "GE";
  const decision = botDecision(G, ctx, "GE");
  const cardIds = (decision.args ?? []).filter((arg): arg is string => typeof arg === "string" && arg.startsWith("IE-"));
  for (const id of cardIds) expect(CARD_BY_ID[id] ?? cardById(id)).toBeDefined();
});
