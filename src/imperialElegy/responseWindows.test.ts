import {INVALID_MOVE} from "boardgame.io/core";
import {setupImperialElegy} from "./engine/setup";
import {ImperialElegyGameDef} from "./game";
import {playResponseCard, resolvePending} from "./moves";
import {beginLandBattle, beginNavalBattle, chooseSupport} from "./engine/combat";
import {placeUnit} from "./engine/effects";
import {cardById} from "./engine/deck";
import {POWERS, type WarState} from "./types";

const makeCtx = (playerID: string | null = "0") => ({
  playerID,
  random: {Die: (n: number) => 3},
  events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "action",
}) as any;

const fresh = () => setupImperialElegy(makeCtx());

const clearHands = (G: ReturnType<typeof fresh>) => {
  for (const p of POWERS) G.powers[p].hand = [];
};

const warState = (attacker: "GE" | "UK", defender: "RU" | "GE"): WarState => ({
  attacker,
  defender,
  attackerAllies: [],
  defenderAllies: [],
  attackerMinors: [],
  defenderMinors: [],
  warAim: "conquest",
  objectives: [],
  status: "maneuver",
  budgets: {},
  initiative: [],
  treaties: [],
  victor: null,
  truceTurns: 2,
  passed: [],
  startedTurn: 1,
});

const openLandCardWindow = () => {
  const G = fresh();
  G.phase = "wartime";
  G.activePower = "GE";
  G.war = warState("GE", "RU");
  placeUnit(G, "RU", "army", "saxony", 2);
  clearHands(G);
  G.powers.GE.hand = ["IE-A043"];
  const ctx = makeCtx("0");
  const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
  expect(battle).not.toBeNull();
  expect(battle!.defender).toBe("RU");
  chooseSupport(G, ctx, "done");
  chooseSupport(G, ctx, "done");
  return {G, ctx, battle: battle!};
};

const openNavalCardWindow = () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "UK";
  G.war = warState("UK", "GE");
  placeUnit(G, "GE", "squadron", "north-atlantic", 2);
  clearHands(G);
  G.powers.UK.hand = ["IE-A061"];
  // Give the defender a card so the window pauses after the attacker's card;
  // the assertions below then read the still-live battle copy.
  G.powers.GE.hand = ["IE-A066"];
  const ctx = makeCtx("1");
  const battle = beginNavalBattle(G, ctx, "UK", "london", "north-atlantic");
  expect(battle).not.toBeNull();
  expect(battle!.defender).toBe("GE");
  return {G, ctx, battle: battle!};
};

test("playResponseCard resolves a response card at impulse start without ending the impulse", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  clearHands(G);
  G.powers.GE.hand = ["IE-A041"];
  const ctx = makeCtx("0");

  expect(playResponseCard(G, ctx, "IE-A041")).toBeUndefined();

  expect(G.powers.GE.hand).not.toContain("IE-A041");
  expect(G.discard.filter((id) => id === "IE-A041")).toHaveLength(1);
  expect(G.resolvingCard).toBeNull();
  expect(G.impulseCard).toBeNull();
  // Every hand is now empty, so a completed impulse would move the phase to
  // "end"; the response card must leave the impulse open.
  expect(G.phase).toBe("action");
  expect(G.activePower).toBe("GE");
});

test("playResponseCard rejects a non-response card", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  G.powers.GE.hand = ["IE-A018"];
  const before = JSON.stringify(G);

  expect(playResponseCard(G, makeCtx("0"), "IE-A018")).toBe(INVALID_MOVE);

  expect(JSON.stringify(G)).toBe(before);
});

test("playResponseCard rejects an out-of-turn seat", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  G.powers.UK.hand = ["IE-A041"];
  const before = JSON.stringify(G);

  expect(playResponseCard(G, makeCtx("1"), "IE-A041")).toBe(INVALID_MOVE);

  expect(JSON.stringify(G)).toBe(before);
});

test("playResponseCard rejects a play while CP remains", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 1;
  G.powers.GE.hand = ["IE-A041"];
  const before = JSON.stringify(G);

  expect(playResponseCard(G, makeCtx("0"), "IE-A041")).toBe(INVALID_MOVE);

  expect(JSON.stringify(G)).toBe(before);
});

test("a response card that opens a pending choice keeps the impulse alive and discards the card", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  clearHands(G);
  G.powers.GE.hand = ["IE-A041"];
  const ctx = makeCtx("0");

  // No printed response card currently opens a decision, so give this one a
  // card-style option in memory. This exercises the generic pending path that
  // `flags.pendingResponse` is meant to protect.
  const card = cardById("IE-A041");
  const originalOptions = card.options;
  try {
    card.options = [{label: "Resolve", labelZh: "结算", text: "", textZh: "", effects: []}];

    expect(playResponseCard(G, ctx, "IE-A041")).toBeUndefined();
    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending?.power).toBe("GE");
    expect(G.flags.pendingResponse).toBe(true);
    expect(G.powers.GE.hand).not.toContain("IE-A041");

    resolvePending(G, ctx, "opt0");

    expect(G.pending).toBeNull();
    expect(G.flags.pendingResponse).toBeUndefined();
    expect(G.flags.pendingCard).toBeUndefined();
    expect(G.discard.filter((id) => id === "IE-A041")).toHaveLength(1);
    // If the response flag were lost, resolving the pending would finish the
    // impulse (all hands are empty) and advance to "end".
    expect(G.phase).toBe("action");
    expect(G.activePower).toBe("GE");
  } finally {
    card.options = originalOptions;
  }
});

test("land battle combat-card window plays a card and hands the window to the defender", () => {
  const {G, ctx, battle} = openLandCardWindow();
  const beforeDrm = battle.attackerDrm;

  expect(G.pending?.kind).toBe("combatCard");
  expect(G.pending?.power).toBe("GE");
  expect(G.pending?.options.some((o) => o.id === "card:IE-A043")).toBe(true);

  resolvePending(G, ctx, "card:IE-A043");

  expect(G.powers.GE.hand).not.toContain("IE-A043");
  expect(G.discard.filter((id) => id === "IE-A043")).toHaveLength(1);
  // `playCombatCard` applies the card to a copy and assigns it to `G.battle`.
  const resolved = G.battle;
  expect(resolved).not.toBeNull();
  expect(resolved!.attackerDrm).toBe(beforeDrm + 1);
  // With no defender card the window resolves to the roll, but either way it
  // must leave the attacker's card stage.
  expect(resolved!.cardSide).toBe("defender");
  expect(resolved!.stage).not.toBe("cards");
});

test("naval battle combat-card window plays a naval card exactly once", () => {
  const {G, ctx, battle} = openNavalCardWindow();
  const beforeDrm = battle.attackerDrm;

  expect(G.pending?.kind).toBe("combatCard");
  expect(G.pending?.power).toBe("UK");
  expect(G.pending?.options.some((o) => o.id === "card:IE-A061:navalDrm")).toBe(true);
  expect(G.pending?.options.some((o) => o.id === "card:IE-A061:noMines")).toBe(true);

  resolvePending(G, ctx, "card:IE-A061:navalDrm");

  expect(G.powers.UK.hand).not.toContain("IE-A061");
  expect(G.discard.filter((id) => id === "IE-A061")).toHaveLength(1);
  // Ironclads is worth +2: applied once, not once per window.  The defender's
  // card window keeps the applied battle copy live for these reads.
  const resolved = G.battle;
  expect(resolved).not.toBeNull();
  expect(resolved!.attackerDrm).toBe(beforeDrm + 2);
  expect(G.pending?.kind === "combatCard" && G.pending.power === "UK").toBe(false);

  const drmAfter = resolved!.attackerDrm;
  expect(resolvePending(G, ctx, "card:IE-A061:navalDrm")).toBe(INVALID_MOVE);
  expect(G.battle!.attackerDrm).toBe(drmAfter);
});

test("non-deciding seats see empty pending options and context in playerView", () => {
  const {G} = openLandCardWindow();

  const opponentView = ImperialElegyGameDef.playerView!(G, makeCtx("1"), "1");
  expect(opponentView.pending?.options).toEqual([]);
  expect(opponentView.pending?.context).toEqual({});

  const ownerView = ImperialElegyGameDef.playerView!(G, makeCtx("0"), "0");
  expect(ownerView.pending?.options.length).toBeGreaterThan(0);
});
