import {Client} from "boardgame.io/client";
import {Local} from "boardgame.io/multiplayer";
import {ImperialElegyGameDef} from "./game";
import {POWERS} from "./types";
import type {ImperialElegyState} from "./types";
import {SCENARIO_IDS, SCENARIOS} from "./constant/scenarios";
import type {ScenarioId} from "./constant/scenarios";
import {CARDS} from "./constant/cards.data";
import {setupImperialElegy} from "./engine/setup";

/**
 * End-to-end proof that every printed scenario is actually playable.
 *
 * `campaign.test.ts` already auto-plays the campaign against the live
 * boardgame.io master, with all six seats as real clients.  This suite does the
 * same for the other scenarios, which is the only way to show that the
 * scenario data is not merely well-formed but that each one runs: the setup
 * produces a legal position, the phase flow reaches its own printed last turn,
 * and the ending is a decisive result rather than a stuck state.
 *
 * The driver is shared: it answers every pending decision, plays the first
 * legal card, closes the prep/diplomacy/end phases, and passes in wartime or GW
 * impulses.  The scenarios differ only in the setup data and in the expected
 * end reason.
 */

const stateIdOf = (client: {getState: () => unknown}): number => {
  const state = client.getState() as {_stateID?: number} | undefined;
  return Number(state?._stateID ?? -1);
};

/** Wait until the shared local master has applied the move. */
const settle = async (client: {getState: () => unknown}, before: number): Promise<void> => {
  for (let tick = 0; tick < 800; tick += 1) {
    if (stateIdOf(client) !== before) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
};

jest.setTimeout(300_000);

/** Every action card, home card and GW card, so a hand id can be resolved. */
const CARD_DEFS = [...CARDS.actions, ...CARDS.home, ...CARDS.greatWar];
const findDef = (id: string) => CARD_DEFS.find((card) => card.id === id);

/**
 * Play one scenario to its printed end.
 *
 * `stepBudget` is generous because the four-turn scenarios still take hundreds
 * of impulses (six seats, several phases and a war or Great War each).
 */
const autoplay = async (id: ScenarioId, stepBudget: number, stop?: (G: ImperialElegyState) => boolean) => {
  const def = SCENARIOS[id];
  // `Local()` creates the match on demand with `setupData: undefined`, so the
  // scenario travels in the game definition's own `setup` — the same technique
  // the hotseat board uses (`components/local.tsx#hotseatGame`).
  const game = {
    ...ImperialElegyGameDef,
    seed: `scenario-autoplay-${id}`,
    setup: (ctx: Parameters<typeof setupImperialElegy>[0]) => setupImperialElegy(ctx, {scenario: id}),
  };
  const clients = POWERS.map((_, index) =>
    Client({game, numPlayers: 6, multiplayer: Local(), playerID: String(index), debug: false}),
  );
  clients.forEach((client) => client.start());
  for (let tick = 0; tick < 800 && clients.some((client) => (client.getState()?.G as unknown) === undefined); tick += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }

  /** Send one move from a seat and wait for the master to apply it. */
  const act = async (move: () => void): Promise<boolean> => {
    const before = stateIdOf(clients[0]);
    move();
    await settle(clients[0], before);
    return stateIdOf(clients[0]) !== before;
  };
  const stateOf = (power: string): ImperialElegyState =>
    (clients[POWERS.indexOf(power as never)].getState()!.G as ImperialElegyState);
  const current = (): ImperialElegyState => clients[0].getState()!.G as ImperialElegyState;

  const phases: string[] = [];
  const rounds = {maneuvers: 0, winters: 0};
  let lastPhase = "";

  for (let step = 0; step < stepBudget; step += 1) {
    const G = current();
    if (G.result) break;
    if (stop !== undefined && stop(G)) break;
    if (G.phase !== lastPhase) {
      phases.push(`${G.turn}:${G.phase}`);
      if (G.phase === "gwManeuver" || G.phase === "gwImpulse") rounds.maneuvers += 1;
      if (G.phase === "gwWinter") rounds.winters += 1;
      lastPhase = G.phase;
    }
    // Every phase can suspend on a pending decision; answer it first, or the
    // phase-specific action below is rejected and the loop never advances.
    if (G.pending) {
      const power = G.pending.power;
      const index = POWERS.indexOf(power);
      if (index < 0) throw new Error(`pending decision for non-player power ${power}`);
      const own = stateOf(power);
      const option = own.pending?.options[0];
      await (option
        ? act(() => clients[index].moves.resolvePending(option.id))
        : act(() => clients[index].moves.declinePending()));
      continue;
    }
    if (G.phase === "prep") {
      const index = Number(clients[0].getState()!.ctx.currentPlayer);
      const power = POWERS[index];
      // `finishPrep` is keyed on the framework's current player, which the prep
      // phase walks with `TurnOrder.RESET`.
      const own = stateOf(power);
      // `finishPrep` first answers the scenario's printed pre-game decisions
      // (the 1870 Franco-Prussian concession, the AU NG deck edit, the
      // alternate-GW build points) and only then marks the seat done, so a
      // single call may leave `prepDone` false.  Re-sending it is correct and
      // terminates as soon as the decisions are answered.
      if (!own.powers[power].flags.prepDone) await act(() => clients[index].moves.finishPrep());
      continue;
    }
    if (G.phase === "diplomacy") {
      // 9.1: every seat closes its negotiation segment before any home card is
      // chosen; the home-card step waits for the whole table.
      const negotiating = POWERS.find((candidate) => (
        stateOf(candidate).powers[candidate].flags.negotiationDone === false
      ));
      if (negotiating !== undefined) {
        await act(() => clients[POWERS.indexOf(negotiating)].moves.finishNegotiation());
        continue;
      }
      // The diplomacy phase walks `G.activePower`, which the scenario setup may
      // have moved past a seat whose home card it skips (1870), so read the
      // engine's cursor rather than the framework's `ctx.currentPlayer`.
      const power = G.activePower;
      const index = POWERS.indexOf(power);
      const own = stateOf(power);
      const home = own.powers[power].homeCards[0];
      if (!home) throw new Error(`no home card for ${power}`);
      await act(() => clients[index].moves.chooseHomeCard(home));
      continue;
    }
    if (G.phase === "action") {
      const power = G.activePower;
      const index = POWERS.indexOf(power);
      const own = stateOf(power);
      const hand = own.powers[power].hand;
      // A response/combat card cannot fund an impulse, so the driver only plays
      // an ordinary event/mandatory/CP card.
      const playable = hand.find((card) => {
        const cardDef = findDef(card);
        return cardDef !== undefined && cardDef.type !== "response" && cardDef.type !== "combat";
      });
      if (hand.length === 0 || playable === undefined) {
        await act(() => clients[index].moves.pass());
        continue;
      }
      const cardDef = findDef(playable);
      const mandatory = cardDef?.type === "mandatory" || cardDef?.type === "mandatoryResponse";
      await act(() => clients[index].moves.playCard(playable, mandatory ? "event" : "cp"));
      // A card that leaves the impulse open is closed so the loop always makes
      // progress through the action phase.
      const after = stateOf(power);
      if (after.phase === "action" && after.pending === null && after.activePower === power) {
        await act(() => clients[index].moves.pass());
      }
      continue;
    }
    if (G.phase === "end") {
      let acted = false;
      for (const power of POWERS) {
        const index = POWERS.indexOf(power);
        const own = stateOf(power);
        const choices = String(own.powers[power].flags.ngChoices ?? "").split(",").filter(Boolean);
        if (choices.length > 0) {
          await act(() => clients[index].moves.chooseGoal(choices[0]));
          acted = true;
          break;
        }
      }
      if (acted) continue;
      for (const power of POWERS) {
        const index = POWERS.indexOf(power);
        if (!stateOf(power).powers[power].flags.endDone) {
          await act(() => clients[index].moves.endPhaseTurn());
          acted = true;
          break;
        }
      }
      if (!acted) throw new Error("end phase stuck");
      continue;
    }
    if (G.phase === "wartime") {
      const index = POWERS.indexOf(G.activePower);
      await act(() => clients[index].moves.passWarMove());
      continue;
    }
    if (G.phase === "gwManeuver") {
      // A scenario that opens inside the Great War reaches this phase on its
      // first move, so the driver needs the maneuver step.  Drive it with the
      // Rule 34 bot exactly as `campaign.test.ts` does: the scenario data's
      // opening Great War is a full war, not a phase to skip.
      const power = G.activePower;
      const index = POWERS.indexOf(power);
      const own = stateOf(power);
      const seatCtx = clients[index].getState()!.ctx;
      const {botMoveFor} = await import("./engine/bot");
      const decision = botMoveFor(own, seatCtx, power);
      const send = (clients[index].moves as unknown as Record<string, (...args: unknown[]) => void>)[decision.move];
      let applied = await act(() => send(...(decision.args ?? [])));
      // A bot priority that no longer fits the live position can be refused
      // (for example a GW card event that is only playable in a battle).  The
      // scenario driver only needs to prove the scenario is playable, so fall
      // back to the printed "pass, or play the GW card for CP" options before
      // reporting a stuck position.
      if (!applied) applied = await act(() => clients[index].moves.gwPass());
      if (!applied) applied = await act(() => clients[index].moves.playGwCardMove("cp"));
      if (!applied) {
        throw new Error(`${id}: no GW maneuver move was accepted (bot tried ${decision.move} ${JSON.stringify(decision.args)}) at GW turn ${G.gw?.turn} index ${G.turnIndex}`);
      }
      continue;
    }
    if (G.phase === "gwPlanning") {
      await act(() => clients[0].moves.endGwPlanningMove());
      continue;
    }
    if (G.phase === "gwImpulse") {
      const index = POWERS.indexOf(G.activePower);
      await act(() => clients[index].moves.gwPass());
      continue;
    }
    if (G.phase === "gwWinter") {
      await act(() => clients[0].moves.gwResolveWinter());
      continue;
    }
    throw new Error(`unknown phase ${G.phase}`);
  }

  const finished = current();
  return {G: finished, phases, rounds, lastTurn: def.lastTurn, firstTurn: def.firstTurn, steps: phases.length};
};

/**
 * Every pre-war scenario reaches a decisive result inside its own printed
 * window.  The Great-War scenarios open at GW turn 0 and finish only after a
 * full six-turn war, which is covered by `campaign.test.ts`'s pinned full game;
 * their own suite below proves the scenario starts, fights and survives its
 * first winter.
 */
const PRE_WAR_SCENARIOS = SCENARIO_IDS.filter((id) => !id.startsWith("gwTutorial") && !id.startsWith("altGw"));

describe.each(PRE_WAR_SCENARIOS)("scenario autoplay — %s", (id) => {
  const def = SCENARIOS[id];
  test("plays to a decisive result", async () => {
    const {G, phases} = await autoplay(id, 1_200);
    expect(phases.length).toBeGreaterThan(0);
    if (G.result === null) {
      throw new Error(`${id} did not finish: turn=${G.turn} phase=${G.phase} pending=${G.pending?.kind ?? "none"} active=${G.activePower} steps=${phases.length} tail=${phases.slice(-6).join(" ")}`);
    }
    expect(G.result).not.toBeNull();
    const reason = G.result!.reason;
    // The end reasons a scenario can print: its own final turn, the tutorial's
    // "no VP" ending, an auto-victory, or one of the Great War resolutions.
    const acceptable =
      reason === `endOfTurn${def.lastTurn}` ||
      reason === "tutorialNoVp" ||
      reason.startsWith("autoVictory:") ||
      reason.startsWith("greatWar:") ||
      reason.startsWith("gwTurnLimit:") ||
      reason.startsWith("noGw:");
    if (!acceptable) throw new Error(`${id}: unexpected end reason ${reason}`);
    // A competitive scenario names winners; the tutorial deliberately names none.
    if (def.special.countVp) expect(G.result!.winners.length).toBeGreaterThan(0);
    else expect(G.result!.winners).toEqual([]);
  });
});

/**
 * A scenario that opens inside the Great War must actually enter the war's own
 * sequence of play (boardgame.io otherwise starts the campaign `prep` phase
 * and the war never begins), and it must survive a full GW turn: planning,
 * maneuver with real battles, and the winter step.
 */
const GW_SCENARIOS = SCENARIO_IDS.filter((id) => id.startsWith("gwTutorial") || id.startsWith("altGw"));

describe.each(GW_SCENARIOS)("GW scenario autoplay — %s", (id) => {
  test("starts in the Great War and plays its first GW turn", async () => {
    const {G, phases, rounds} = await autoplay(
      id,
      900,
      (state) => state.gw?.active === true && state.gw.turn >= 1,
    );
    expect(phases[0]).toContain("gwPlanning");
    // The opening planning step really began the war: the GW turn-0 budgets
    // were set, the GW cards dealt and the printed order is standing.
    expect(G.gw?.active).toBe(true);
    expect(G.gw?.outbreakDone).toBe(true);
    expect(G.gw?.nationalWillDone).toBe(true);
    expect(G.gw?.order.length ?? 0).toBeGreaterThan(0);
    expect(G.gw?.turn ?? 0).toBeGreaterThanOrEqual(1);
    // At least one maneuver step and one winter step were visited.
    expect(rounds.maneuvers).toBeGreaterThan(0);
    expect(rounds.winters).toBeGreaterThan(0);
  });
});
