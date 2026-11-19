/**
 * Which turn-panel body is in front.
 *
 * The three bodies (Orders, War, Log) are chosen in two places — the desktop
 * turn panel's own tab strip and the phone's one bottom sheet — and a war
 * starting has to move both of them.  Keeping the mapping here means the shell
 * cannot drift from the panel: the model stores one `railTab`, and the dock
 * stores one `mobileTab`, but both name the same three bodies.
 *
 * The War body is always present now.  It used to exist only while a war ran,
 * which is exactly what pushed war declarations back into the Orders panel and
 * onto the map: a declaration happens before any war exists, so it has no
 * place in a tab that is hidden until the war starts.  It now carries the
 * declaration form and the war controls, so it is reachable in every phase.
 *
 * The phone sheet also owns Hand and Mat, which have no counterpart in the turn
 * panel.
 */
import type {MobileTab} from "./modelValues";

/** The bodies a turn panel can show. */
export type TurnTab = "action" | "war" | "log";

/** The reading order of the bodies. */
export const turnTabKeys = (): TurnTab[] => ["action", "war", "log"];

/** The requested body, or Orders when the name is not one of the three. */
export const resolveTurnTab = (requested: string): TurnTab =>
  turnTabKeys().includes(requested as TurnTab) ? requested as TurnTab : "action";

/** The dock body that shows a turn-panel body; Hand/Mat have no counterpart. */
export const mobileTabForTurnTab = (tab: TurnTab): MobileTab =>
  tab === "war" ? "war" : tab === "log" ? "log" : "orders";

/** The turn-panel body a dock tab leaves in front. */
export const turnTabForMobileTab = (tab: MobileTab): TurnTab =>
  tab === "war" ? "war" : tab === "log" ? "log" : "action";
