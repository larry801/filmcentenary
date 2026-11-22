import {Client} from "boardgame.io/client";
import {Local} from "boardgame.io/multiplayer";
import {ImperialElegyGameDef} from "./game";
import {POWERS} from "./types";

/** The shared match counter every seat's client exposes. */
const stateIdOf = (c: {getState: () => any}) => Number(c.getState()?._stateID ?? -1);

/**
 * Wait until the shared `Local` master has applied a move.
 *
 * All six clients sit on one embedded master, so `_stateID` is the observable
 * "the move landed" signal.  The fixed `setTimeout` this replaced both raced it
 * on a loaded runner and paid the delay on every move.
 */
const settled = async (client: {getState: () => any}, before: number) => {
  for (let tick = 0; tick < 500; tick += 1) {
    if (stateIdOf(client) !== before) return;
    await new Promise(resolve => setImmediate(resolve));
  }
};

/** Start the clients and wait for their asynchronous initial sync. */
const startAll = async (clients: Array<{getState: () => any}>) => {
  for (let tick = 0; tick < 500 && clients.some(c => c.getState()?.G === undefined); tick += 1) {
    await new Promise(resolve => setImmediate(resolve));
  }
};

test("prep, diplomacy and the first action-phase card", async () => {
  const clients = ["0","1","2","3","4","5"].map(playerID => Client({game: ImperialElegyGameDef, numPlayers: 6, multiplayer: Local(), playerID, debug: false}));
  clients.forEach(c => c.start());
  await startAll(clients);
  for (const c of clients) {
    const before = stateIdOf(clients[0]);
    c.moves.finishPrep();
    await settled(clients[0], before);
  }
  expect(clients[0].getState()!.G.phase).toBe("diplomacy");
  // 9.1: each seat first ends its negotiation segment; the home-card step
  // opens only after the whole table has done so.
  for (const c of clients) {
    const before = stateIdOf(clients[0]);
    c.moves.finishNegotiation();
    await settled(clients[0], before);
  }
  for (const c of clients) {
    const G = c.getState()!.G;
    const p = POWERS[Number(c.playerID)];
    const before = stateIdOf(clients[0]);
    c.moves.chooseHomeCard(G.powers[p].homeCards[0]);
    await settled(clients[0], before);
  }
  // 33.4: the AU player answers Metternich's Legacy before the action phase
  // opens, so closing diplomacy leaves that decision pending in diplomacy.
  expect(clients[0].getState()!.G.phase).toBe("diplomacy");
  expect(clients[0].getState()!.G.pending?.kind).toBe("metternich");
  const auClient = clients[POWERS.indexOf("AU")];
  // Only the deciding seat receives the option list (privacy.ts#hideDecision);
  // the other five views deliberately see an empty one.
  for (let pick = 0; pick < 3; pick += 1) {
    const pending = auClient.getState()!.G.pending;
    if (pending?.kind !== "metternich") break;
    const before = stateIdOf(clients[0]);
    auClient.moves.resolvePending(pending.options[0].id);
    await settled(clients[0], before);
  }
  expect(clients[0].getState()!.G.phase).toBe("action");
  const G = clients[0].getState()!.G;
  expect(G.powers.GE.hand.length).toBeGreaterThan(0);
  expect(G.activePower).toBe("GE");
  // Every seat is mounted; the active power is still Germany, and no legal
  // impulse has been started yet.
  expect(clients[0].getState()!.G.activePower).toBe("GE");
  expect(clients[0].getState()!.G.cpRemaining).toBe(0);
});
