/**
 * The headless bot seat of a solo match.
 *
 * A solo match is *not* the six-board hotseat shell: only the player's own
 * board is mounted, so the five bot seats need a driver that does not render a
 * seat interface at all.  boardgame.io still gives every seat its own client
 * (and therefore its own credentials); this component mounts one of those
 * clients and submits the same Rule 34 decision the hotseat shell's board
 * would have submitted.
 *
 * Keeping the driver on the board props is deliberate: `moves` are owned by the
 * seat's own client, exactly as in an online match, so the engine sees the
 * bot's player id and cannot mistake the move for the human seat's.
 */
import React from "react";
import {Ctx} from "boardgame.io";
import {ImperialElegyState, Power} from "../types";
import {POWER_KEYS} from "./boardHelpers";
import {botMoveFor} from "../engine/bot";
import {negotiationDoneFor} from "../engine/negotiation";

export interface SoloBotSeatProps {
  G: ImperialElegyState;
  ctx: Ctx;
  moves: Record<string, (...args: any[]) => void>;
  playerID: string | null;
}

/** The legal escape move when the bot's decided move keeps being refused. */
const ESCAPE_MOVE: Record<string, string> = {
  action: "pass",
  wartime: "passWarMove",
  prep: "finishPrep",
  diplomacy: "endDiplomacy",
  end: "endPhaseTurn",
  gwPlanning: "endGwPlanningMove",
  gwManeuver: "gwPass",
  gwWinter: "gwResolveWinter",
};

export const powerForPlayer = (playerID: string | null): Power | null =>
  playerID === null || playerID === undefined ? null : POWER_KEYS[Number(playerID)] ?? null;

/**
 * Drive one bot seat and render nothing.
 *
 * The timing and failure policy mirror `useBoardModel`'s hotseat bot driver:
 * wait half a second so the human can follow the log, and after three refused
 * decisions on an unchanged state take the phase's legal escape move instead of
 * re-sending the same illegal move forever.
 */
export const SoloBotSeat = ({G, ctx, moves, playerID}: SoloBotSeatProps) => {
  const viewer = powerForPlayer(playerID);
  const phase = G.phase;
  const pending = G.pending;
  const eliminated = viewer === null ? true : G.powers[viewer]?.eliminated === true;
  const isActive = viewer !== null && viewer === G.activePower;
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const failureRef = React.useRef<{key: string; state: string; count: number} | null>(null);

  React.useEffect(() => {
    if (viewer === null || eliminated) return;

    // A decision addressed to this seat, or this seat's own turn.  This is the
    // same gate the hotseat board uses, so a solo match advances exactly like
    // a hotseat match whose other five seats are bots.  9.1 adds one case: in
    // the diplomacy negotiation segment every seat may close its own segment
    // (and answer an offer addressed to it) out of turn, so a bot must not wait
    // behind the active power — the home-card step stays blocked until it does.
    const negotiatingBot = phase === "diplomacy" && (
      !negotiationDoneFor(G, viewer) ||
      (G.negotiation?.offers ?? []).some((offer) => offer.status === "proposed" && offer.to === viewer)
    );
    const needsAct =
      (pending !== null && pending.power === viewer) ||
      (pending === null && (
        isActive ||
        negotiatingBot ||
        phase === "end" ||
        phase === "gwPlanning" ||
        phase === "gwWinter"
      ));
    if (!needsAct) return;

    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      try {
        const decision = botMoveFor(G, ctx, viewer);
        const key = `${decision.move}|${JSON.stringify(decision.args ?? [])}`;
        const stateKey = `${G.turn}|${phase}|${G.activePower}|${G.cpRemaining}|${G.log.length}|${pending?.id ?? "-"}`;
        const previous = failureRef.current;
        const count = previous !== null && previous.key === key && previous.state === stateKey
          ? previous.count + 1
          : 0;
        if (count >= 3) {
          failureRef.current = {key, state: stateKey, count};
          const fallback = ESCAPE_MOVE[phase];
          console.warn("[IE solo bot] repeated invalid decision", key, "→ falling back to", fallback);
          const fn = fallback === undefined ? undefined : moves[fallback];
          if (typeof fn === "function") fn();
          return;
        }
        failureRef.current = {key, state: stateKey, count};
        const fn = moves[decision.move];
        if (typeof fn === "function") fn(...(decision.args ?? []));
      } catch (err) {
        console.warn("[IE solo bot] auto-submit error", err);
      }
    }, 500);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  // G and ctx change on every game-state update — that is the correct trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [G, ctx, viewer, eliminated, pending, isActive, phase]);

  return null;
};
