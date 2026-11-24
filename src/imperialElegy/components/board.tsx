import React from "react";
import {Ctx} from "boardgame.io";
import {ImperialElegyState} from "../types";
import {useBoardModel} from "./useBoardModel";
import {BoardLayout} from "./BoardLayout";
import {BotSeatsContext} from "./botContext";
import {SeatUiContext} from "./seatUiContext";
import {powerForPlayer, useBotAutoSubmit} from "./botDriver";

export interface IEBoardProps {
  G: ImperialElegyState;
  ctx: Ctx;
  moves: Record<string, (...args: any[]) => void>;
  playerID: string | null;
  matchID?: string;
  hotseat?: boolean;
  /**
   * Whether Rule 34's seat hand-over control is offered.  It defaults to true
   * (an online match can hand a seat to the bot); the dedicated solo page turns
   * it off, because the player's one seat is not a hotseat seat to give away.
   */
  allowSeatHandover?: boolean;
  /**
   * Whether the hand tray starts expanded.  It defaults to collapsed: the map
   * needs the height, the tray's title bar already carries the hand count and
   * the CP chain, and a single press opens it.  A host that wants the cards
   * visible from the first frame (tests, an embedded board) sets it.
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

/** The full board for the seat that is in front of the reader. */
const VisibleSeat = (props: IEBoardProps) => {
  const model = useBoardModel(props);
  return <BoardLayout model={model}/>;
};

/**
 * A hotseat seat that is *not* in front.
 *
 * The hotseat shell mounts one client per seat, and five of the six boards used
 * to build their whole interface — map SVG, counters, panels, hand, mat — only
 * to be hidden by CSS, and then re-render on every game-state update.  That was
 * 81 % of the page's DOM (≈2,000 nodes and 800 KB of markup per hidden seat on
 * a 390 px phone) for something nobody can see.
 *
 * What a hidden seat still owes the match is its bot: Rule 34 needs that seat's
 * own client (and therefore its own credentials) to submit the bot's moves.
 * `useBotAutoSubmit` does exactly that and draws nothing — the same driver the
 * solo page's headless `SoloBotSeat` uses — so a hidden bot seat keeps playing
 * and a hidden human seat costs nothing.  The interface is built again the
 * moment the reader switches to the seat.
 */
const HiddenSeat = (props: IEBoardProps) => {
  const botSeats = React.useContext(BotSeatsContext)?.seats;
  const viewer = powerForPlayer(props.playerID);
  useBotAutoSubmit({
    G: props.G,
    ctx: props.ctx,
    moves: props.moves,
    viewer,
    enabled: props.hotseat === true && viewer !== null && (botSeats?.has(viewer) ?? false),
  });
  return null;
};

/**
 * The board is a thin composition of the state hook and the presentational
 * layout.  Both halves are independently testable: the hook holds the rules
 * wiring, effects and derived values; the layout holds every test id and CSS
 * class the existing suites and Playwright specs rely on.
 *
 * In the hotseat shell only the seat in front of the reader gets that interface;
 * see `HiddenSeat`.  An online board and the solo page's own board have no seat
 * strip and therefore no `currentSeat`, so they always render in full.
 */
export const ImperialElegyBoard = (props: IEBoardProps) => {
  const currentSeat = React.useContext(SeatUiContext).currentSeat;
  const seat = powerForPlayer(props.playerID);
  const hidden = props.hotseat === true && currentSeat !== null && seat !== currentSeat;
  return hidden ? <HiddenSeat {...props}/> : <VisibleSeat {...props}/>;
};
