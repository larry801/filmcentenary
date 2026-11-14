import {Client} from "boardgame.io/client";
import {Local} from "boardgame.io/multiplayer";
import {ImperialElegyGameDef} from "./game";
import {setupImperialElegy} from "./engine/setup";
import {cardById, drawCards} from "./engine/deck";
import {playCard} from "./moves";
import {ImperialElegyState, Power, POWERS} from "./types";

type Counts = {
  handCounts: Record<Power, number>;
  goalCounts: Record<Power, number>;
  deckCount: number;
  discardCount: number;
  removedCount: number;
};

type PrivateView = ImperialElegyState & Counts;

const wait = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));

const makeCtx = (playerID: string | null = "0") => ({
  playerID,
  random: {Die: (n: number) => 3},
  events: {
    setPhase: () => {},
    setActivePlayers: () => {},
    endGame: () => {},
    endTurn: () => {},
  },
  turn: 1,
  phase: "action",
}) as any;

const fresh = () => setupImperialElegy(makeCtx());

const asView = (G: ImperialElegyState, playerID: string | null): PrivateView =>
  ImperialElegyGameDef.playerView!(G, makeCtx(playerID), playerID) as unknown as PrivateView;

const SEATS = ["0", "1", "2", "3", "4", "5"] as const;

/** Give every power distinguishable private-looking values. */
const plantPrivateData = (G: ImperialElegyState): void => {
  for (const p of POWERS) {
    G.powers[p].goals = [`GOAL-${p}`];
    G.powers[p].gwCard = `GW-${p}`;
    G.powers[p].flags = {...G.powers[p].flags, privateFlag: `FLAG-${p}`};
  }
};

const openAssassinationDecision = (): ImperialElegyState => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.powers.GE.hand.push("IE-A017");
  playCard(G, makeCtx("0"), "IE-A017", "event");
  return G;
};

test("each seat sees only its own hand, goals, GW card and private flags", () => {
  const G = fresh();
  plantPrivateData(G);

  for (let i = 0; i < POWERS.length; i += 1) {
    const own = POWERS[i];
    const view = asView(G, String(i));

    // Own private zones are intact.
    expect(view.powers[own].hand).toEqual(G.powers[own].hand);
    expect(view.powers[own].goalDeck).toEqual(G.powers[own].goalDeck);
    expect(view.powers[own].goals).toEqual([`GOAL-${own}`]);
    expect(view.powers[own].gwCard).toBe(`GW-${own}`);
    expect(view.powers[own].flags).toEqual(G.powers[own].flags);
    expect(view.handCounts[own]).toBe(G.powers[own].hand.length);
    expect(view.goalCounts[own]).toBe(1);

    // Every other seat is fully redacted, while counts stay public.
    for (let j = 0; j < POWERS.length; j += 1) {
      if (j === i) continue;
      const other = POWERS[j];
      expect(view.powers[other].hand).toEqual([]);
      expect(view.powers[other].goalDeck).toEqual([]);
      expect(view.powers[other].goals).toEqual([]);
      expect(view.powers[other].gwCard).toBeNull();
      // Public per-power flags (the printed power-projection track) stay
      // visible; the planted private flag does not (rule 12.4 / privacy split).
      expect(view.powers[other].flags).toEqual({powerProjection: G.powers[other].flags.powerProjection});
      expect(view.powers[other].flags.privateFlag).toBeUndefined();
      expect(view.handCounts[other]).toBe(G.powers[other].hand.length);
      expect(view.goalCounts[other]).toBe(1);
    }

    // No other seat's private identifiers survive anywhere in the payload.
    const serialized = JSON.stringify(view);
    for (let j = 0; j < POWERS.length; j += 1) {
      if (j === i) continue;
      const other = POWERS[j];
      for (const id of G.powers[other].hand) expect(serialized).not.toContain(id);
      expect(serialized).not.toContain(`GOAL-${other}`);
      expect(serialized).not.toContain(`GW-${other}`);
      expect(serialized).not.toContain(`FLAG-${other}`);
    }
  }
});

test("spectator view hides every private zone and exposes only public counts", () => {
  const G = fresh();
  plantPrivateData(G);

  const view = asView(G, null);
  const serialized = JSON.stringify(view);

  for (const p of POWERS) {
    expect(view.powers[p].hand).toEqual([]);
    expect(view.powers[p].goalDeck).toEqual([]);
    expect(view.powers[p].goals).toEqual([]);
    expect(view.powers[p].gwCard).toBeNull();
    expect(view.powers[p].flags).toEqual({powerProjection: G.powers[p].flags.powerProjection});
    expect(view.powers[p].flags.privateFlag).toBeUndefined();
    expect(view.handCounts[p]).toBe(G.powers[p].hand.length);
    expect(view.goalCounts[p]).toBe(G.powers[p].goals.length);

    for (const id of G.powers[p].hand) expect(serialized).not.toContain(id);
    expect(serialized).not.toContain(`GOAL-${p}`);
    expect(serialized).not.toContain(`GW-${p}`);
    expect(serialized).not.toContain(`FLAG-${p}`);
  }

  expect(view.handCounts).toEqual(
    Object.fromEntries(POWERS.map((p) => [p, G.powers[p].hand.length])),
  );
  expect(view.goalCounts).toEqual(Object.fromEntries(POWERS.map((p) => [p, 1])));
});

test("pending decision exposes options and context only to its owner", () => {
  const G = openAssassinationDecision();
  expect(G.pending).not.toBeNull();
  expect(G.pending!.power).toBe("GE");

  const ownerView = asView(G, "0");
  expect(ownerView.pending).not.toBeNull();
  expect(ownerView.pending!.options).toEqual(G.pending!.options);
  expect(ownerView.pending!.options.length).toBeGreaterThan(0);
  expect(ownerView.pending!.context).toEqual(G.pending!.context);
  expect(ownerView.pending!.promptArgs).toEqual(G.pending!.promptArgs);

  for (const playerID of [...SEATS.slice(1), null]) {
    const view = asView(G, playerID);
    expect(view.pending).not.toBeNull();
    expect(view.pending!.options).toEqual([]);
    expect(view.pending!.context).toEqual({});
    expect(view.pending!.promptArgs).toEqual({});
    // Non-secret metadata is deliberately public.
    expect(view.pending!.kind).toBe(G.pending!.kind);
    expect(view.pending!.power).toBe("GE");
    expect(view.pending!.prompt).toBe(G.pending!.prompt);
  }

  // Redaction must not mutate the authoritative state.
  expect(G.pending!.options.length).toBeGreaterThan(0);
});

test("pending decision does not expose the inciting card to non-owners", () => {
  const G = openAssassinationDecision();

  for (const playerID of [...SEATS.slice(1), null]) {
    const view = asView(G, playerID);
    expect(view.resolvingCard).toBeNull();
    expect(view.impulseCard).toBeNull();
    expect((view.flags as Record<string, unknown>).pendingCard).toBeUndefined();
  }
});

test("an event play is public; a CP play is private to its owner", () => {
  const G = openAssassinationDecision();
  const cardPlayed = G.log.find((entry) => entry.key === "cardPlayed")!;
  expect(cardPlayed.power).toBe("GE");
  expect(cardPlayed.args?.card).toBe("IE-A017");
  expect(cardPlayed.args?.mode).toBe("event");

  // Events are resolved faceup: every seat and the spectator may name the card.
  for (const playerID of [...SEATS, null]) {
    const entry = asView(G, playerID).log.find((e) => e.id === cardPlayed.id)!;
    expect(entry.args?.card).toBe("IE-A017");
    expect(entry.key).toBe("cardPlayed");
    expect(entry.power).toBe("GE");
  }

  // A card spent for CP never leaves the owner's hand faceup.
  const cp = fresh();
  cp.phase = "action";
  cp.activePower = "GE";
  cp.powers.GE.hand.push("IE-A021");
  playCard(cp, makeCtx("0"), "IE-A021", "cp");
  const cpPlayed = cp.log.find((entry) => entry.key === "cardPlayed")!;
  expect(cpPlayed.args).toMatchObject({card: "IE-A021", mode: "cp"});
  expect(asView(cp, "0").log.find((e) => e.id === cpPlayed.id)!.args?.card).toBe("IE-A021");
  for (const playerID of [...SEATS.slice(1), null]) {
    const entry = asView(cp, playerID).log.find((e) => e.id === cpPlayed.id)!;
    expect(entry.args?.card).toBe("hidden");
    expect(entry.key).toBe("cardPlayed");
  }

  const publicEntry = G.log.find((entry) => entry.key === "campaignStarted")!;
  expect(publicEntry.power).toBeUndefined();
  for (const playerID of [...SEATS, null]) {
    const entry = asView(G, playerID).log.find((e) => e.id === publicEntry.id)!;
    expect(entry).toEqual(publicEntry);
    expect(entry.args).toEqual({});
  }
});

test("removal of a card that was played faceup is public; a hidden removal is not", () => {
  // Wilhelm II removes itself after its faceup event, so its removal follows the
  // public play line rather than contradicting it with "a hidden card".
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.powers.GE.hand.push("IE-A082");
  playCard(G, makeCtx("0"), "IE-A082", "event");

  expect(G.removed).toContain("IE-A082");
  expect(
    asView(G, "0").log.filter((entry) => entry.key === "cardRemoved").map((entry) => entry.args?.card),
  ).toContain("IE-A082");
  for (const playerID of [...SEATS.slice(1), null]) {
    const removedCards = asView(G, playerID).log
      .filter((entry) => entry.key === "cardRemoved")
      .map((entry) => String(entry.args?.card));
    expect(removedCards).toContain("IE-A082");
  }

  // A card removed without ever being revealed (Ironclads after Dreadnoughts) is
  // still private to the power whose draw removed it.
  const hidden = fresh();
  hidden.persistent.dreadnoughts = true;
  hidden.deck = ["IE-A061"];
  hidden.discard = [];
  drawCards(hidden, makeCtx("0"), "GE", 1);
  expect(hidden.removed).toContain("IE-A061");
  for (const playerID of [...SEATS.slice(1), null]) {
    const removedCards = asView(hidden, playerID).log
      .filter((entry) => entry.key === "cardRemoved")
      .map((entry) => String(entry.args?.card));
    expect(removedCards).not.toContain("IE-A061");
  }
});

test("deck, discard and removed order cannot be reconstructed from any view", () => {
  const G = fresh();
  expect(G.deck.length).toBeGreaterThan(0);
  G.discard = ["IE-A017", "IE-A018"];
  G.removed = ["IE-A019", "IE-A020"];

  const reordered = JSON.parse(JSON.stringify(G)) as ImperialElegyState;
  reordered.deck = [...G.deck].reverse();
  reordered.discard = [...G.discard].reverse();
  reordered.removed = [...G.removed].reverse();

  for (const playerID of [...SEATS, null]) {
    const view = asView(G, playerID);
    expect(view.deck).toEqual([]);
    expect(view.discard).toEqual([]);
    expect(view.removed).toEqual([]);
    expect(view.deckCount).toBe(G.deck.length);
    expect(view.discardCount).toBe(G.discard.length);
    expect(view.removedCount).toBe(G.removed.length);
  }

  // Two states that differ only in the hidden ordering produce identical views.
  expect(asView(G, "0")).toEqual(asView(reordered, "0"));
  expect(asView(G, null)).toEqual(asView(reordered, null));
});

test("reconnecting the GE client preserves its private hand and keeps other views blind", async () => {
  const ge = Client({
    game: ImperialElegyGameDef,
    numPlayers: 6,
    multiplayer: Local(),
    playerID: "0",
    debug: false,
  });
  const observer = Client({
    game: ImperialElegyGameDef,
    numPlayers: 6,
    multiplayer: Local(),
    playerID: "1",
    debug: false,
  });

  ge.start();
  observer.start();
  await wait(150);

  const initial = ge.getState()!.G as PrivateView;
  expect(initial.phase).toBe("prep");
  const handBefore = [...initial.powers.GE.hand];
  expect(handBefore.length).toBeGreaterThan(0);
  expect(initial.pending).toBeNull();

  // Reaching the action phase needs moves from all six seats, so this
  // reconnect-style test uses a prep-phase private action. Pending-decision
  // redaction is covered separately with playerView above.
  // A prep-phase private action: discard a card from the GE hand for stability.
  const discardable = handBefore.find((id) => {
    const def = cardById(id);
    return def.kind !== "home" && def.type !== "mandatory" && def.type !== "mandatoryResponse";
  });
  expect(discardable).toBeDefined();

  ge.moves.discardForStability(discardable!);
  await wait(80);

  const afterAction = ge.getState()!.G as PrivateView;
  expect(afterAction.powers.GE.hand).toEqual(handBefore.filter((id) => id !== discardable));
  expect(afterAction.pending).toBeNull();

  const observerAfter = observer.getState()!.G as PrivateView;
  expect(observerAfter.powers.GE.hand).toEqual([]);
  expect(observerAfter.handCounts.GE).toBe(afterAction.powers.GE.hand.length);
  expect(observerAfter.pending).toBeNull();

  const discardLog = afterAction.log.find((entry) => entry.key === "prepStabilityDiscard")!;
  expect(discardLog.args?.card).toBe(discardable);
  expect(observerAfter.log.find((entry) => entry.id === discardLog.id)!.args?.card).toBe("hidden");

  // Stop and restart the GE client, as a reconnecting tab would.
  ge.stop();
  await wait(30);
  ge.start();
  await wait(150);

  const reconnected = ge.getState()!.G as PrivateView;
  expect(reconnected.powers.GE.hand).toEqual(afterAction.powers.GE.hand);
  expect(reconnected.powers.GE.hand).not.toContain(discardable);
  expect(reconnected.pending).toBeNull();

  const observerAgain = observer.getState()!.G as PrivateView;
  expect(observerAgain.powers.GE.hand).toEqual([]);
  expect(observerAgain.handCounts.GE).toBe(reconnected.powers.GE.hand.length);
  expect(observerAgain.pending).toBeNull();

  ge.stop();
  observer.stop();
});
