/**
 * One Rule 34 bot driver, shared by every shell that gives a bot its own client.
 *
 * Three boards need it and they must behave identically:
 *
 *   • the hotseat shell's board, when the seat in front of the reader is a bot
 *     (the person may only watch it);
 *   • the hotseat shell's five seats that are *not* in front: they render no
 *     interface at all, but their bot must keep playing;
 *   • the solo page's five headless bot seats.
 *
 * The timing and the failure policy live here, once: wait half a second so the
 * human can follow the log, and after three refused decisions on an unchanged
 * state take the phase's legal escape move instead of re-sending the same
 * illegal move forever (boardgame.io re-syncs the view even when a move is
 * rejected, so a naive retry flooded the console and froze the match).
 */
import React from "react";
import {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "../types";
import {POWER_KEYS} from "./boardHelpers";
import {botMoveFor} from "../engine/bot";
import {negotiationConcluded, negotiationDoneFor} from "../engine/negotiation";

export interface BotDriverOptions {
  G: ImperialElegyState;
  ctx: Ctx;
  moves: Record<string, (...args: any[]) => void>;
  /** The seat this client belongs to. */
  viewer: Power | null;
  /** Whether this seat is a bot that may submit on its own credentials. */
  enabled: boolean;
  /** Console prefix for the repeated-refusal path, e.g. "[IE bot]". */
  label?: string;
}

/** The legal escape move when the bot's decided move keeps being refused. */
export const ESCAPE_MOVE: Record<string, string> = {
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
 * Submit this seat's bot decision whenever it is the bot's turn to act.
 *
 * The bot needs to act when there is an open pending decision addressed to this
 * power, or when it is this power's normal turn (action / wartime / prep /
 * diplomacy / gwManeuver all use `isActive`; end / gwPlanning / gwWinter ask
 * every power to take its turn sequentially, so the phase alone is enough).
 *
 * 9.1 adds two cases.  During the negotiation segment every seat may close its
 * own segment (and answer an offer addressed to it) out of turn, so a bot must
 * not wait behind the active power.  And because the home-card step stays
 * closed until *every* seat has finished negotiating, a bot that has already
 * closed its own segment has to park instead of proposing a card the engine
 * refuses.
 */
export const useBotAutoSubmit = ({G, ctx, moves, viewer, enabled, label = "[IE bot]"}: BotDriverOptions) => {
  const phase = G.phase;
  const pending = G.pending;
  const eliminated = viewer === null || G.powers[viewer]?.eliminated === true;
  const isActive = viewer !== null && viewer === G.activePower;
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const failureRef = React.useRef<{key: string; state: string; count: number} | null>(null);

  React.useEffect(() => {
    if (!enabled || viewer === null || eliminated) return;

    const negotiatingBot = phase === "diplomacy" && (
      !negotiationDoneFor(G, viewer) ||
      (G.negotiation?.offers ?? []).some((offer) => offer.status === "proposed" && offer.to === viewer)
    );
    // 9.1: the home-card step stays closed until every seat has finished
    // negotiating, so a bot that has closed its own segment parks.
    const parkedUntilNegotiationCloses = phase === "diplomacy"
      && negotiationConcluded(G) === false
      && !negotiatingBot;
    const needsAct =
      (pending !== null && pending.power === viewer) ||
      (pending === null && !parkedUntilNegotiationCloses && (
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
        // A rejected move leaves the state untouched, so "same decision on an
        // unchanged state" is the reliable failure signal.
        const stateKey = `${G.turn}|${phase}|${G.activePower}|${G.cpRemaining}|${G.log.length}|${pending?.id ?? "-"}`;
        const previous = failureRef.current;
        const count = previous !== null && previous.key === key && previous.state === stateKey
          ? previous.count + 1
          : 0;
        if (count >= 3) {
          // The engine keeps refusing this decision.  Take a legal escape move
          // so the match can continue instead of spinning forever.
          failureRef.current = {key, state: stateKey, count};
          const fallback = ESCAPE_MOVE[phase];
          console.warn(`${label} repeated invalid decision`, key, "→ falling back to", fallback);
          const fn = fallback === undefined ? undefined : moves[fallback];
          if (typeof fn === "function") fn();
          return;
        }
        failureRef.current = {key, state: stateKey, count};
        const fn = moves[decision.move];
        if (typeof fn === "function") fn(...(decision.args ?? []));
      } catch (err) {
        console.warn(`${label} auto-submit error`, err);
      }
    }, 500);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  // G and ctx change on every game-state update — that is the correct trigger.
  // `moves` is a stable boardgame.io object.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [G, ctx, enabled, viewer, eliminated, pending, isActive, phase]);
};
