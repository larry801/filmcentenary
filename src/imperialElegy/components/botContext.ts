/**
 * React context that carries the hotseat bot-seat set into every BoardClient
 * instance without circular imports between local.tsx and board.tsx.
 *
 * The value is not just the set: the shell also publishes a handover callback
 * so a seat's own board can hand itself to the bot (or take itself back) while
 * the match is running.  A standalone online board gets the default value: no
 * bot seats, no in-match handover from the board (the join page owns that
 * through the lobby API).
 */
import React from "react";
import {Power} from "../types";

export interface BotSeatsValue {
  /** Seats the bot plays right now. */
  seats: ReadonlySet<Power>;
  /**
   * Hand `power` to the bot (`bot: true`) or take it back.  Present only in the
   * local hotseat shell, where the person at the keyboard owns every seat.
   */
  setSeatBot?: (power: Power, bot: boolean) => void;
}
export const DEFAULT_BOT_SEATS: BotSeatsValue = {seats: new Set<Power>()};

export const BotSeatsContext = React.createContext<BotSeatsValue>(DEFAULT_BOT_SEATS);
