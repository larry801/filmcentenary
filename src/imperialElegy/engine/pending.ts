import {Ctx} from "boardgame.io";
import {ImperialElegyState, PendingDecision, PendingKind, PendingOption, Power, POWERS} from "../types";

export const seatOf = (power: Power): string => String(POWERS.indexOf(power));

export const powerOfSeat = (seat: string | null | undefined): Power | undefined =>
  seat === null || seat === undefined ? undefined : POWERS[Number(seat)];

export const currentDecision = (G: ImperialElegyState): PendingDecision | null => G.pending;

/** Create a decision and give the deciding player the pending stage. */
export const openDecision = (
  G: ImperialElegyState,
  ctx: Ctx | undefined,
  decision: Omit<PendingDecision, "id" | "createdAt">,
): PendingDecision => {
  const id = `d${G.decisionSeq++}`;
  const pending: PendingDecision = {
    id,
    createdAt: G.decisionSeq,
    ...decision,
  };
  if (G.pending !== null) {
    G.pendingStack.push(G.pending);
  }
  G.pending = pending;
  // The deciding power is often not the power that played the card ("choose
  // another player to do the same", the printed card auctions, a defender's
  // combat windows).  boardgame.io only dispatches moves for active players, so
  // every seat is made active while a decision is open.  This widens move
  // dispatch, not the rules: every other move still checks `G.activePower`, and
  // `resolvePending`/`declinePending` only accept the deciding seat.
  ctx?.events?.setActivePlayers?.({all: "play"});
  return pending;
};

/** Pop the next suspended decision, or return control to the active power. */
export const closeDecision = (G: ImperialElegyState, ctx?: Ctx): PendingDecision | null => {
  const next = G.pendingStack.pop() ?? null;
  G.pending = next;
  if (next !== null && ctx) return next;
  return null;
};

export const option = (
  id: string,
  label: string,
  data?: Record<string, unknown>,
  secret = false,
  labelZh?: string,
): PendingOption => ({id, label, labelZh, data, secret});

export const requireDecision = (G: ImperialElegyState, playerID: string | null): PendingDecision => {
  const pending = G.pending;
  if (!pending) throw new Error("no pending decision");
  if (playerID !== seatOf(pending.power)) throw new Error("not your decision");
  return pending;
};

export const findOption = (pending: PendingDecision, optionId: string): PendingOption => {
  const found = pending.options.find((o) => o.id === optionId);
  if (!found) throw new Error(`illegal option ${optionId}`);
  return found;
};

/** Generic decision factory used by card effects. */
export const decision = (
  kind: PendingKind,
  power: Power,
  prompt: string,
  options: PendingOption[],
  context?: Record<string, unknown>,
  promptArgs?: Record<string, unknown>,
): Omit<PendingDecision, "id" | "createdAt"> => ({
  kind,
  power,
  prompt,
  promptArgs,
  options,
  context,
  blocking: true,
});
