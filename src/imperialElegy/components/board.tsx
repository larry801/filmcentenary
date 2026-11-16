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
