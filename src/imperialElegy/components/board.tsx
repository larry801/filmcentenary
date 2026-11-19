import React from "react";
import {Ctx} from "boardgame.io";
import {ImperialElegyState} from "../types";
import {useBoardModel} from "./useBoardModel";
import {BoardLayout} from "./BoardLayout";

export interface IEBoardProps {
  G: ImperialElegyState;
  ctx: Ctx;
  moves: Record<string, (...args: any[]) => void>;
  playerID: string | null;
  matchID?: string;
  hotseat?: boolean;
  /**
   * Whether the hand tray starts expanded.  It defaults to collapsed: the map
   * needs the height, the tray's title bar already carries the hand count and
   * the CP chain, and a single press opens it.  A host that wants the cards
   * visible from the first frame (tests, an embedded board) sets this.
   */
  handOpen?: boolean;
  /**
   * Draw every hand card's operations inline.  A desktop row prints its own
   * operations anyway; this opens the full body (face, buttons, translation)
   * for rules-level tests and for an embedder that wants the whole card
   * visible without opening the inspector.
   */
  expandHand?: boolean;
}

/**
 * The board is a thin composition of the state hook and the presentational
 * layout.  Both halves are independently testable: the hook holds the rules
 * wiring, effects and derived values; the layout holds every test id and CSS
 * class the existing suites and Playwright specs rely on.
 */
export const ImperialElegyBoard = (props: IEBoardProps) => {
  const model = useBoardModel(props);
  return <BoardLayout model={model}/>;
};
