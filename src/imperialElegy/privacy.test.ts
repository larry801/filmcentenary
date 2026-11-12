/**
 * Privacy tests for `redactForView`.
 *
 * Every test that reproduces a leak first checks the authoritative state still
 * contains the secret, then checks the owner's view still sees it and every
 * other seat/spectator view does not.
 */

import {setupImperialElegy} from "./engine/setup";
import {playCard} from "./moves";
import {HIDDEN_CARD, redactForView, RedactedView} from "./engine/privacy";
import {ImperialElegyState, PendingDecision, Power, POWERS} from "./types";

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

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const asView = (G: ImperialElegyState, seat: string | null): RedactedView =>
  redactForView(G, seat);

const SEATS = ["0", "1", "2", "3", "4", "5"] as const;
const NON_GE = [...SEATS.slice(1), null];

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

test("redactForView is pure and returns a JSON-serializable state", () => {
  const G = fresh();
  plantPrivateData(G);
  G.discard = ["IE-A017"];
  G.removed = ["IE-A018"];
  const before = JSON.parse(JSON.stringify(G)) as ImperialElegyState;

  const view = redactForView(G, "1");

  // Input untouched, including nested objects.
  expect(G).toEqual(before);
  expect(view).not.toBe(G);
  expect(view.powers.GE).not.toBe(G.powers.GE);
  expect(view.log).not.toBe(G.log);

  // Round-tripping must not lose or change anything.
  expect(JSON.parse(JSON.stringify(view))).toEqual(view);
});

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

test("public counters and faceup combat cards survive redaction", () => {
  const G = fresh();
  G.flags.gwFaceupCombat = "GE:IE-GW-03,FR:IE-GW-04";

  for (const playerID of [...SEATS, null]) {
    const view = asView(G, playerID);
    expect(view.handCounts).toEqual(
      Object.fromEntries(POWERS.map((p) => [p, G.powers[p].hand.length])),
    );
    expect(view.goalCounts).toEqual(
      Object.fromEntries(POWERS.map((p) => [p, G.powers[p].goals.length])),
    );
    expect(view.deckCount).toBe(G.deck.length);
    expect(view.faceupCombat).toEqual({GE: "IE-GW-03", FR: "IE-GW-04"});
  }
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

  for (const playerID of NON_GE) {
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

test("KNOWN LEAK FIXED: an open decision hides resolvingCard, impulseCard and pendingCard flags", () => {
  const G = openAssassinationDecision();
  expect(G.resolvingCard).toBe("IE-A017");
  expect(G.impulseCard).toBe("IE-A017");
  expect(G.flags.pendingCard).toBe("IE-A017");
  expect(G.flags.pendingMandatory).toBe(true);

  // The deciding seat keeps the real values.
  const ownerView = asView(G, "0");
  expect(ownerView.resolvingCard).toBe("IE-A017");
  expect(ownerView.impulseCard).toBe("IE-A017");
  expect(ownerView.flags.pendingCard).toBe("IE-A017");
  expect(ownerView.flags.pendingMandatory).toBe(true);

  // Everybody else sees neither the fields nor the card id anywhere.
  for (const playerID of NON_GE) {
    const view = asView(G, playerID);
    expect(view.resolvingCard).toBeNull();
    expect(view.impulseCard).toBeNull();
    expect(view.flags.pendingCard).toBeUndefined();
    expect(view.flags.pendingMandatory).toBeUndefined();
    expect(view.flags.pendingResponse).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain("IE-A017");
  }

  // Authoritative state is untouched.
  expect(G.flags.pendingCard).toBe("IE-A017");
});

test("KNOWN LEAK FIXED: pendingStack decisions are redacted for non-owners", () => {
  const G = openAssassinationDecision();
  const suspended: PendingDecision = {
    id: "suspended-1",
    kind: "giveCard",
    power: "FR",
    prompt: "Choose a card to give",
    promptArgs: {card: "FR-SECRET-CARD"},
    options: [{id: "FR-SECRET", label: "FR-SECRET-OPTION", data: {card: "FR-SECRET-CARD"}}],
    context: {card: "FR-SECRET-CARD"},
    createdAt: 99,
  };
  G.pendingStack.push(suspended);

  // GE owns the active decision, but not the suspended FR decision.
  const geView = asView(G, "0");
  expect(geView.pending!.options).toEqual(G.pending!.options);
  expect(geView.pendingStack[0].options).toEqual([]);
  expect(geView.pendingStack[0].context).toEqual({});
  expect(geView.pendingStack[0].promptArgs).toEqual({});
  expect(JSON.stringify(geView)).not.toContain("FR-SECRET");

  // FR owns the suspended decision, but not the active GE decision.
  const frView = asView(G, "2");
  expect(frView.pending!.options).toEqual([]);
  expect(frView.pending!.context).toEqual({});
  expect(frView.pending!.promptArgs).toEqual({});
  expect(frView.pendingStack[0].options).toEqual(suspended.options);
  expect(frView.pendingStack[0].context).toEqual(suspended.context);
  expect(frView.pendingStack[0].promptArgs).toEqual(suspended.promptArgs);

  // A spectator owns neither.
  const spectatorView = asView(G, null);
  expect(spectatorView.pending!.options).toEqual([]);
  expect(spectatorView.pendingStack[0].options).toEqual([]);
  expect(spectatorView.pendingStack[0].context).toEqual({});
  expect(spectatorView.pendingStack[0].promptArgs).toEqual({});
  expect(JSON.stringify(spectatorView)).not.toContain("FR-SECRET");

  // Metadata stays public and the source is not mutated.
  expect(spectatorView.pendingStack[0].kind).toBe("giveCard");
  expect(spectatorView.pendingStack[0].power).toBe("FR");
  expect(G.pendingStack[0]).toEqual(suspended);
});

test("KNOWN LEAK FIXED: cardRemoved entries with power undefined are masked for non-owners", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.powers.GE.hand.push("IE-A082");
  playCard(G, makeCtx("0"), "IE-A082", "event");

  expect(G.removed).toContain("IE-A082");
  const undefinedRemovals = G.log.filter(
    (entry) => entry.key === "cardRemoved" && entry.power === undefined,
  );
  expect(undefinedRemovals.length).toBeGreaterThan(0);
  expect(undefinedRemovals.some((entry) => entry.args?.card === "IE-A082")).toBe(true);

  // Even the owner's own view can still see the removed card.
  const ownerRemoved = asView(G, "0").log
    .filter((entry) => entry.key === "cardRemoved")
    .map((entry) => entry.args?.card);
  expect(ownerRemoved).toContain("IE-A082");

  for (const playerID of NON_GE) {
    const view = asView(G, playerID);
    const removedCards = view.log
      .filter((entry) => entry.key === "cardRemoved")
      .map((entry) => entry.args?.card);
    // Bismarck's home card may be public; the played card must not be.
    expect(removedCards).not.toContain("IE-A082");
    expect(removedCards.every((card) => card === HIDDEN_CARD)).toBe(true);
    expect(JSON.stringify(view)).not.toContain("IE-A082");
  }
});

test("log card and incitingCard args are masked regardless of entry.power; public entries stay public", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.wtt = 4;
  G.powers.GE.hand.push("IE-A017");
  playCard(G, makeCtx("0"), "IE-A017", "event");

  // `wttMax` is logged without a power, but names the inciting card.
  const wttMax = G.log.find((entry) => entry.key === "wttMax")!;
  expect(wttMax.power).toBeUndefined();
  expect(wttMax.args?.incitingCard).toBe("IE-A017");

  const ownerEntry = asView(G, "0").log.find((entry) => entry.id === wttMax.id)!;
  expect(ownerEntry.args?.incitingCard).toBe("IE-A017");

  for (const playerID of NON_GE) {
    const entry = asView(G, playerID).log.find((e) => e.id === wttMax.id)!;
    expect(entry.args?.incitingCard).toBe(HIDDEN_CARD);
    expect(entry.key).toBe("wttMax");
  }

  // A genuinely public entry is byte-for-byte unchanged for every viewer.
  const publicEntry = G.log.find((entry) => entry.key === "campaignStarted")!;
  expect(publicEntry.power).toBeUndefined();
  for (const playerID of [...SEATS, null]) {
    const entry = asView(G, playerID).log.find((e) => e.id === publicEntry.id)!;
    expect(entry).toEqual(publicEntry);
    expect(entry.args).toEqual({});
  }
});
