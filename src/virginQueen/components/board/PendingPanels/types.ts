import {BoardProps} from "boardgame.io/react";
import {VQGame} from "../../../constant/general";

/** Shared props for every pending-response panel. */
export interface PendingPanelProps {
    G: VQGame;
    moves: BoardProps<VQGame>["moves"];
    playerID: string | null;
    /** Present when a panel needs the active-seat/stage information. */
    ctx?: BoardProps<VQGame>["ctx"];
}
