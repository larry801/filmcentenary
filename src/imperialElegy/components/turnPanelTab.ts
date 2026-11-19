/**
 * Which turn-panel body is in front.
 *
 * The three bodies (Orders, War, Log) are chosen in two places — the desktop
 * turn panel's own tab strip and the phone's one bottom sheet — and a war
 * starting has to move both of them.  Keeping the mapping here means the shell
 * cannot drift from the panel: the model stores one `railTab`, and the dock
 * stores one `mobileTab`, but both name the same three bodies.
 *
 * The phone sheet also owns Hand and Mat, which have no counterpart in the turn
 * panel; those fold to Orders exactly as the sheet already folds a War body
 * that disappeared when its war ended.
 */
import type {MobileTab} from "./modelValues";

/** The bodies a turn panel can show. */
export type TurnTab = "action" | "war" | "log";

/** The reading order of the bodies that exist this render. */
export const turnTabKeys = (warVisible: boolean): TurnTab[] =>
  warVisible ? ["action", "war", "log"] : ["action", "log"];

/** The requested body, or Orders when that body no longer exists. */
export const resolveTurnTab = (requested: string, warVisible: boolean): TurnTab =>
  turnTabKeys(warVisible).includes(requested as TurnTab) ? requested as TurnTab : "action";

/** The dock body that shows a turn-panel body; Hand/Mat have no counterpart. */
export const mobileTabForTurnTab = (tab: TurnTab): MobileTab =>
  tab === "war" ? "war" : tab === "log" ? "log" : "orders";

/** The turn-panel body a dock tab leaves in front. */
export const turnTabForMobileTab = (tab: MobileTab): TurnTab =>
  tab === "war" ? "war" : tab === "log" ? "log" : "action";
