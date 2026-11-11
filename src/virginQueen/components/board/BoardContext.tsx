import React from "react";
import type {useBoardState} from "./useBoardState";

/** Shared board state, so phase panels can live in their own files without prop drilling. */
export type VQBoardCtx = ReturnType<typeof useBoardState>;

export const VQBoardContext = React.createContext<VQBoardCtx | null>(null);

export const useVQBoard = (): VQBoardCtx => {
    const value = React.useContext(VQBoardContext);
    if (value === null) throw new Error("useVQBoard must be used inside VirginQueenBoard");
    return value;
};
