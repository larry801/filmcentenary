/**
 * Rule 34's die, outside a boardgame.io reducer.
 *
 * A bot seat is often driven from the board (hotseat/solo) or from the server
 * driver, where the stored `ctx` has no plugin APIs (they are attached only
 * while a move runs).  Consuming the real seeded PRNG there would also desync
 * it from the moves.  This state-keyed stand-in gives every PAC die, BDIT/BMPIT
 * roll and unlisted-decision roll a different result from the same state while
 * staying stable across a retry — a roll that changed on every retry would
 * defeat the driver's repeated-refusal guard.
 */
import type {Ctx} from "boardgame.io";
import {Power} from "../types";
import type {ImperialElegyState} from "../types";

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

/**
 * A context carrying a usable random plugin.  Inside a real move the engine's
 * seeded PRNG is already present and must be used; outside one, fall back to
 * the state-keyed stand-in so a hotseat bot still rolls the PAC dice.
 */
export const ctxWithBotRandom = (
  G: ImperialElegyState,
  ctx: Ctx,
  power: Power,
): Ctx => (ctx.random === undefined ? ({...ctx, random: botRandom(G, power)} as Ctx) : ctx);
