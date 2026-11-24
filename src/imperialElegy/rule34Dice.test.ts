/**
 * Rule 34 — the bot PAC dice and the unlisted-decision die.
 *
 * Hotseat/solo bots are driven from the board, where `ctx` carries no random
 * plugin.  The old fallback was a constant 3, so every PAC priority collapsed
 * onto the 3–4 row and every unlisted decision took option 0.  These tests pin
 * the state-keyed fallback and the 34.3 "roll a die" answer.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, PendingDecision, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {botChoiceIndex, botMoveFor, botPendingMove} from "./engine/bot";
import {botRandom, ctxWithBotRandom} from "./engine/botRandom";

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    events: {},
    turn: 1,
    phase: "action",
    random: {Die: () => 3, Number: () => 0.5, Shuffle: <T,>(a: T[]): T[] => a},
  }) as unknown as Ctx;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const seat = (power: Power): string => String(POWERS.indexOf(power));

test("a bare board ctx gets the state-keyed bot random, a real ctx is untouched", () => {
  const G = fresh();
  const bare = makeCtx(seat("FR"));
  const withFallback = ctxWithBotRandom(G, bare, "FR");
  expect(withFallback.random).toBeDefined();
  expect(withFallback.random!.Die(6)).toBeGreaterThanOrEqual(1);
  expect(withFallback.random!.Die(6)).toBeLessThanOrEqual(6);

  const realRandom = {Die: () => 4, Number: () => 0.5, Shuffle: <T,>(a: T[]): T[] => a} as unknown as Ctx["random"];
  const real = {...bare, random: realRandom} as Ctx;
  expect(ctxWithBotRandom(G, real, "FR")).toBe(real);
});

test("different states produce different PAC rolls instead of a constant 3", () => {
  const G = fresh();
  const first = botRandom(G, "FR");
  const second = botRandom({...G, log: [...G.log, {id: 999, turn: G.turn, phase: G.phase, key: "test"}]} as ImperialElegyState, "FR");
  const rolls = Array.from({length: 8}, () => first.Die(6) as number);
  const nextRolls = Array.from({length: 8}, () => second.Die(6) as number);
  expect(rolls.some((roll, index) => roll !== nextRolls[index])).toBe(true);
  expect(new Set(rolls).size).toBeGreaterThan(1);
});

test("34.3 rolls an unlisted decision instead of always taking option 0", () => {
  const G = fresh();
  const pending = {
    id: "d1",
    kind: "eventChoice",
    power: "FR",
    prompt: "Choose",
    options: [
      {id: "a", label: "A"},
      {id: "b", label: "B"},
      {id: "c", label: "C"},
    ],
    createdAt: 1,
  } as unknown as PendingDecision;
  G.pending = pending;
  const ctx = { ...makeCtx(seat("FR")), random: {Die: (sides: number) => 2} } as unknown as Ctx;
  expect(botPendingMove(G, "FR", ctx)?.args).toEqual(["b"]);
  const last = {...ctx, random: {Die: (sides: number) => 3}} as unknown as Ctx;
  expect(botPendingMove(G, "FR", last)?.args).toEqual(["c"]);
});

test("botChoiceIndex rolls within bounds and falls back to 0 without a plugin", () => {
  expect(botChoiceIndex(undefined, 4)).toBe(0);
  expect(botChoiceIndex({random: {Die: () => 4}} as unknown as Ctx, 4)).toBe(3);
  expect(botChoiceIndex({random: {Die: () => 99}} as unknown as Ctx, 4)).toBe(2);
});

test("botMoveFor injects the fallback so the PAC die is not fixed", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "FR";
  G.powers.FR.flags.homeChosen = true;
  G.powers.FR.selectedHomeCard = null;
  G.cpRemaining = 3;
  const bare = { ...makeCtx(seat("FR")), random: undefined } as unknown as Ctx;
  const move = botMoveFor(G, bare, "FR");
  expect(typeof move.move).toBe("string");
});
