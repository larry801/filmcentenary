/**
 * Rules 11.0 / 11.1 through the real boardgame.io reducer.
 *
 * `negotiation.test.ts` calls the moves directly; this suite drives six real
 * `Client`s over `Local()` multiplayer, so the parts a unit test cannot see are
 * covered: that a seat may answer an offer **outside its own diplomacy turn**
 * (all seats are active during the phase), that the settlement happens on the
 * real phase change into the action phase, and that every client's view agrees
 * about what is public.
 */
import {Ctx} from "boardgame.io";
import {Client} from "boardgame.io/client";
import {Local} from "boardgame.io/multiplayer";
import {ImperialElegyGameDef} from "./game";
import {ImperialElegyState, POWERS, Power} from "./types";
import {negotiationOf} from "./engine/negotiation";

const HAND = ["IE-A018", "IE-A019", "IE-A020"];

/**
 * A campaign definition that opens directly in the diplomacy phase.
 *
 * Marking `diplomacy` as the starting phase (and `prep` as non-starting) is what
 * the VQ negotiation stage suite does too: boardgame.io's own `ctx.phase` has
 * to agree with the engine's `G.phase`, otherwise the transport refuses every
 * move before the engine ever sees it.
 */
const diplomacyGame = () => ({
  ...ImperialElegyGameDef,
  seed: "ie-negotiation-stage",
  setup: (ctx: Ctx): ImperialElegyState => {
    const G = ImperialElegyGameDef.setup!(ctx) as ImperialElegyState;
    G.phase = "diplomacy";
    G.activePower = "GE";
    for (const power of POWERS) {
      G.powers[power].hand = [...HAND];
      G.powers[power].flags.homeChosen = false;
    }
    return G;
  },
  phases: {
    ...ImperialElegyGameDef.phases!,
    prep: {...ImperialElegyGameDef.phases!.prep, start: false},
    diplomacy: {...ImperialElegyGameDef.phases!.diplomacy, start: true},
  },
});

const clientsFor = () => {
  const game = diplomacyGame();
  const multiplayer = Local();
  return [0, 1, 2, 3, 4, 5].map((id) =>
    Client({game, multiplayer, numPlayers: 6, playerID: String(id)}));
};

/** The shared match counter every seat's client exposes. */
const stateId = (client: Client<ImperialElegyState>): number =>
  Number(client.getState()?._stateID ?? -1);

/** Wait until the shared `Local` master has applied a move (as `client.test.ts` does). */
const settle = async (client: Client<ImperialElegyState>, before: number): Promise<void> => {
  for (let tick = 0; tick < 500; tick += 1) {
    if (stateId(client) !== before) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
};

/** Start the clients and wait for their asynchronous initial sync. */
const startAll = async (clients: Client<ImperialElegyState>[]): Promise<void> => {
  for (let tick = 0; tick < 500 && clients.some((client) => client.getState()?.G === undefined); tick += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

/**
 * boardgame.io's client applies a move optimistically and the master applies it
 * again; a one-way move (answering the same offer twice, acting after a phase
 * closed) therefore logs one refused replay.  These suites assert on the state,
 * so the framework's console line is silenced for the call.
 */
const quiet = async (run: () => void): Promise<void> => {
  const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    run();
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    error.mockRestore();
  }
};

/** Run one move per seat, waiting for each to land. */
const all = async (
  clients: Client<ImperialElegyState>[],
  run: (client: Client<ImperialElegyState>, power: Power) => void,
): Promise<void> => {
  for (const [index, client] of clients.entries()) {
    const before = stateId(clients[0]);
    run(client, POWERS[index]);
    await settle(clients[0], before);
  }
};

describe("11.1 over the running game", () => {
  test("the other side answers out of turn, and the phase close draws", async () => {
    const clients = clientsFor();
    clients.forEach((client) => client.start());
    await startAll(clients);

    const ge = clients[POWERS.indexOf("GE")];
    const fr = clients[POWERS.indexOf("FR")];
    expect(ge.getState()!.G.phase).toBe("diplomacy");

    // Germany opens the table; France is not the active seat, but every seat is
    // active during the diplomacy phase, so it may answer immediately.
    const before = stateId(clients[0]);
    ge.moves.proposeDeal("FR", 1, 0, []);
    await settle(clients[0], before);
    const offer = negotiationOf(ge.getState()!.G).offers[0];
    expect(offer).toMatchObject({from: "GE", to: "FR", give: 1, take: 0});
    // Nothing has moved yet (11.1: "done at the end of the diplomacy phase").
    expect(fr.getState()!.G.powers.FR.hand).toEqual(HAND);

    const answering = stateId(clients[0]);
    await quiet(() => fr.moves.respondDeal(offer.id, true));
    await settle(clients[0], answering);
    expect(negotiationOf(ge.getState()!.G).offers[0].status).toBe("accepted");
    expect(fr.getState()!.G.powers.FR.hand).toEqual(HAND);

    // 9.1: every seat first ends its negotiation segment, then picks a home
    // card; the last pick closes the phase and settles.
    await all(clients, (client) => client.moves.finishNegotiation());
    await all(clients, (client, power) => {
      const G = client.getState()!.G;
      client.moves.chooseHomeCard(G.powers[power].homeCards[0]);
    });

    const after = clients[0].getState()!.G;
    expect(after.phase).toBe("action");
    expect(negotiationOf(after).offers).toEqual([]);
    expect(negotiationOf(after).history).toHaveLength(1);
    // Every client agrees on the settled record, including a seat that was not
    // party to the deal.
    const history = negotiationOf(after).history;
    for (const client of clients) expect(negotiationOf(client.getState()!.G).history).toEqual(history);
  });

  test("an offer cannot be answered after the phase closes", async () => {
    const clients = clientsFor();
    clients.forEach((client) => client.start());
    await startAll(clients);

    const ge = clients[POWERS.indexOf("GE")];
    const before = stateId(clients[0]);
    ge.moves.proposeDeal("FR", 1, 0, []);
    await settle(clients[0], before);
    const id = negotiationOf(ge.getState()!.G).offers[0].id;

    await all(clients, (client) => client.moves.finishNegotiation());
    await all(clients, (client, power) => {
      const G = client.getState()!.G;
      client.moves.chooseHomeCard(G.powers[power].homeCards[0]);
    });
    expect(clients[0].getState()!.G.phase).toBe("action");

    const fr = clients[POWERS.indexOf("FR")];
    const afterClose = stateId(clients[0]);
    const frBefore = negotiationOf(fr.getState()!.G).history.length;
    // boardgame.io logs a refused move; the refusal is what this asserts.
    await quiet(() => fr.moves.respondDeal(id, true));
    await settle(clients[0], afterClose);
    // The offer lapsed, so nothing settled and no card moved for it.
    expect(negotiationOf(clients[0].getState()!.G).history).toHaveLength(frBefore);
    expect(negotiationOf(clients[0].getState()!.G).offers).toEqual([]);
  });

  test("a shown card is faceup for every client until the phase closes", async () => {
    const clients = clientsFor();
    clients.forEach((client) => client.start());
    await startAll(clients);

    const ge = clients[POWERS.indexOf("GE")];
    const before = stateId(clients[0]);
    ge.moves.showCard("IE-A019", null);
    await settle(clients[0], before);
    const shown = (power: Power): number =>
      (clients[POWERS.indexOf(power)].getState()!.G.negotiation?.shown ?? []).length;
    for (const power of POWERS) expect(shown(power)).toBe(1);

    await all(clients, (client) => client.moves.finishNegotiation());
    await all(clients, (client, power) => {
      const G = client.getState()!.G;
      client.moves.chooseHomeCard(G.powers[power].homeCards[0]);
    });
    // 11.0: the show lasts only for the diplomacy phase that made it.
    const hand = clients[0].getState()!.G;
    expect(negotiationOf(hand).shown).toEqual([]);
  });
});
