import React from "react";
import {ImperialElegyState, Power} from "../types";
import type {SeatStatus} from "./SeatStrip";

/**
 * Hotseat-only bridge between the single seat strip (owned by local.tsx) and
 * the six mounted boards.  Each board reports the game state it renders and
 * may ask the shell to switch seats; a standalone online board simply gets the
 * default no-op context.
 */
export interface SeatUi {
  currentSeat: Power | null;
  onSwitchSeat?: (power: Power) => void;
  onGameState?: (G: ImperialElegyState) => void;
  /**
   * Which seats have their home-card chooser open.
   *
   * A hotseat board is built only while its seat is in front (see `board.tsx`),
   * so a per-seat dialog flag would reset every time the reader looks elsewhere
   * and comes back.  The shell owns it instead: switching seats never closes a
   * chooser this seat had opened, and never answers the choice behind it.
   */
  choiceOpen?: Partial<Record<Power, boolean>>;
  setChoiceOpen?: (power: Power, open: boolean) => void;
  /** The seat tabs the shell derives, rendered inside the board's top row. */
  seats?: SeatStatus[];
  /**
   * The hotseat shell's own controls (new game, help, difficulty).  They live
   * in the board's menu so the shell adds no second header row.
   */
  shellMenu?: React.ReactNode;
}

export const SeatUiContext = React.createContext<SeatUi>({currentSeat: null});
