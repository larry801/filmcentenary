import {Client} from "boardgame.io/client";
import {Local} from "boardgame.io/multiplayer";
import {ImperialElegyGameDef} from "./game";
import {POWERS} from "./types";
const wait = (ms=12) => new Promise(r=>setTimeout(r,ms));

test("prep, diplomacy and the first action-phase card", async () => {
  const clients = ["0","1","2","3","4","5"].map(playerID => Client({game: ImperialElegyGameDef, numPlayers: 6, multiplayer: Local(), playerID, debug: false}));
  clients.forEach(c => c.start());
  await wait(120);
  for (const c of clients) { c.moves.finishPrep(); await wait(6); }
  expect(clients[0].getState()!.G.phase).toBe("diplomacy");
  for (const c of clients) {
    const G = c.getState()!.G;
    const p = POWERS[Number(c.playerID)];
    c.moves.chooseHomeCard(G.powers[p].homeCards[0]);
    await wait(6);
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
