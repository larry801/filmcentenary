import {Client} from "boardgame.io/client";
import {Local} from "boardgame.io/multiplayer";
import {ImperialElegyGameDef} from "./game";
import {POWERS} from "./types";
import type {ImperialElegyState} from "./types";

/** The shared match counter every seat's client exposes. */
const stateIdOf = (c: {getState: () => any}) => Number(c.getState()?._stateID ?? -1);

/**
 * Wait until the embedded boardgame.io master has applied the move.
 *
 * The six `Client`s share one `Local` master whose `onUpdate` chain is
 * promise-based, so an action only becomes visible to the other seats once the
 * master settles.  The previous version slept a fixed 30 ms after each of the
 * campaign's ~370 steps, which dominated this test's runtime; this waits on the
 * observable outcome (a new `_stateID`) instead, so it costs a few ticks and
 * scales with real engine work only.
 *
 * The bounded wait means a *rejected* move does not hang the run: the caller's
 * own assertion or the step limit reports it.
 */
const settle = async (client: {getState: () => any}, before: number) => {
  for (let tick = 0; tick < 500; tick += 1) {
    if (stateIdOf(client) !== before) return;
    await new Promise(r => setImmediate(r));
  }
};

jest.setTimeout(120000);
test("campaign auto-play reaches a result", async () => {
  const cs = ["0","1","2","3","4","5"].map(playerID => Client({game: ImperialElegyGameDef, numPlayers: 6, multiplayer: Local(), playerID, debug: false}));
  cs.forEach(c => c.start());
  // `start()` performs the initial sync asynchronously.
  for (let tick = 0; tick < 500 && cs.some(c => c.getState()?.G === undefined); tick += 1) {
    await new Promise(r => setImmediate(r));
  }
  /** Send one move and wait for the master to apply it. */
  const act = async (move: () => void) => {
    const before = stateIdOf(cs[0]);
    move();
    await settle(cs[0], before);
  };

  const phases: string[] = [];
  let lastPhase = "";
  for (let step = 0; step < 900; step++) {
    const G = cs[0].getState()!.G as ImperialElegyState;
    const seatState = (p: string) => cs[POWERS.indexOf(p as any)].getState()!.G as ImperialElegyState;
    if (G.result) { break; }
    if (G.phase !== lastPhase) { phases.push(`${G.turn}:${G.phase}`); lastPhase = G.phase; }
    // Every phase can suspend on a pending decision (the GW draft's second
    // space, colonial transfers, neutral entry, ...).  Answer it before the
    // phase-specific action, otherwise the loop sends an action the engine
    // rejects and never reaches a result.
    if (G.pending) {
      const p = G.pending.power; const i = POWERS.indexOf(p); const own = seatState(p);
      const opt = own.pending?.options[0];
      await act(() => opt ? cs[i].moves.resolvePending(opt.id) : cs[i].moves.declinePending());
      continue;
    }
    if (G.phase === "prep") {
      const i = Number(cs[0].getState()!.ctx.currentPlayer);
      const p = POWERS[i]; const own = seatState(p);
      if (!own.powers[p].flags.prepDone) await act(() => cs[i].moves.finishPrep());
      continue;
    }
    if (G.phase === "diplomacy") {
      const i = Number(cs[0].getState()!.ctx.currentPlayer);
      const p = POWERS[i]; const own = seatState(p); const h = own.powers[p].homeCards[0];
      if (!h) { throw new Error("no home card"); }
      await act(() => cs[i].moves.chooseHomeCard(h));
      continue;
    }
    if (G.phase === "action") {
      const p = G.activePower; const i = POWERS.indexOf(p); const own = seatState(p); const hand = own.powers[p].hand;
      if (own.cpRemaining > 0) { await act(() => cs[i].moves.pass()); continue; }
      const defs = (await import("./constant/cards.data")).CARDS;
      const findDef = (id: string) => defs.actions.find(c => c.id === id) ?? defs.home.find(c => c.id === id) ?? defs.greatWar.find(c => c.id === id);
      const playable = hand.find(id => { const d = findDef(id); return d && (!["response","combat"].includes(d.type)); });
      if (hand.length === 0 || !playable) { await act(() => cs[i].moves.pass()); continue; }
      const card = playable;
      const cardDef = findDef(card);
      const mandatory = cardDef?.type === "mandatory" || cardDef?.type === "mandatoryResponse";
      await act(() => cs[i].moves.playCard(card, mandatory ? "event" : "cp"));
      const after = seatState(p);
      if (after.phase === "action" && !after.pending && after.activePower === p) {
        await act(() => cs[i].moves.pass());
      }
      continue;
    }
    if (G.phase === "end") {
      let did = false;
      for (const p of POWERS) { const i = POWERS.indexOf(p); const own = seatState(p); const choices = String(own.powers[p].flags.ngChoices ?? "").split(",").filter(Boolean); if (choices.length) { await act(() => cs[i].moves.chooseGoal(choices[0])); did = true; break; } }
      if (did) continue;
      for (const p of POWERS) { const i = POWERS.indexOf(p); const own = seatState(p); if (!own.powers[p].flags.endDone) { await act(() => cs[i].moves.endPhaseTurn()); did = true; break; } }
      if (!did) { throw new Error("end phase stuck"); }
      continue;
    }
    if (G.phase === "wartime") {
      const p = G.activePower; const i = POWERS.indexOf(p);
      await act(() => cs[i].moves.passWarMove()); continue;
    }
    if (G.phase === "gwPlanning") { await act(() => cs[0].moves.endGwPlanningMove()); continue; }
    if (G.phase === "gwImpulse") {
      const p = G.activePower; const i = POWERS.indexOf(p); await act(() => cs[i].moves.gwPass()); continue;
    }
    throw new Error(`unknown phase ${G.phase}`);
  }
  const G = cs[0].getState()!.G as ImperialElegyState;
  expect(G.result).not.toBeNull();
  // The auto-play path now takes the printed decisions added in rounds 1-2
  // (crisis, consent, auctions, end-phase choices), so the campaign may end
  // either at turn 7 or with a Great War alliance victory.  The invariant is
  // that it reaches a decisive, non-empty result.
  expect(["endOfTurn7", "greatWar:te", "greatWar:ta"]).toContain(G.result!.reason);
  expect(G.result!.winners.length).toBeGreaterThan(0);
  expect(phases.length).toBeGreaterThan(0);
});
