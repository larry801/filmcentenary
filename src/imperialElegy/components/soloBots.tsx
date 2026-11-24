/**
 * The headless bot seat of a solo match.
 *
 * A solo match is *not* the six-board hotseat shell: only the player's own
 * board is mounted, so the five bot seats need a driver that does not render a
 * seat interface at all.  boardgame.io still gives every seat its own client
 * (and therefore its own credentials); this component mounts one of those
 * clients and submits the same Rule 34 decision the hotseat shell's board
 * would have submitted.
 *
 * Keeping the driver on the board props is deliberate: `moves` are owned by the
 * seat's own client, exactly as in an online match, so the engine sees the
 * bot's player id and cannot mistake the move for the human seat's.
 *
 * The loop itself lives in `useBotAutoSubmit`, shared with the hotseat shell —
 * the same rule, the same timing and one place to change them.
 */
import React from "react";
import {Ctx} from "boardgame.io";
import {ImperialElegyState} from "../types";
import {powerForPlayer, useBotAutoSubmit} from "./botDriver";

export interface SoloBotSeatProps {
  G: ImperialElegyState;
  ctx: Ctx;
  moves: Record<string, (...args: any[]) => void>;
  playerID: string | null;
}

export {powerForPlayer};

/** Drive one bot seat and render nothing. */
export const SoloBotSeat = ({G, ctx, moves, playerID}: SoloBotSeatProps) => {
  useBotAutoSubmit({
    G,
    ctx,
    moves,
    viewer: powerForPlayer(playerID),
    enabled: true,
    label: "[IE solo bot]",
  });
  return null;
};
