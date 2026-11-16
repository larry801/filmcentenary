import React from "react";
import {ImperialElegyState, Power} from "../types";

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
}

export const SeatUiContext = React.createContext<SeatUi>({currentSeat: null});
