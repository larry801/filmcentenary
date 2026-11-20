import {INVALID_MOVE} from "boardgame.io/core";
import {ACTION_CARDS} from "./constant/cards.data";
import {placeUnit} from "./engine/effects";
import {setupImperialElegy} from "./engine/setup";
import {pacify, playCard, playResponseCard, resolvePending, responseCardEligibility} from "./moves";
import {openCrisisDecision} from "./engine/greatWar";
import {POWERS} from "./types";

const makeCtx = (playerID: string | null = "0") => ({
  playerID,
  random: {Die: (n: number) => 3},
  events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "action",
}) as any;

const fresh = () => setupImperialElegy(makeCtx());

const makeCtxWith = (dice: number[]) => ({
  ...makeCtx("0"),
  random: {Die: () => dice.shift() ?? 3},
}) as any;

const clearHands = (G: ReturnType<typeof fresh>) => {
  for (const p of POWERS) G.powers[p].hand = [];
};

/** Put a response card in GE's hand and play it, stopping on its option choice. */
const startResponse = (cardId: string) => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  clearHands(G);
  G.powers.GE.hand = [cardId];
  const ctx = makeCtx("0");

  expect(playResponseCard(G, ctx, cardId)).toBeUndefined();
  expect(G.pending?.kind).toBe("eventChoice");
  expect(G.pending?.power).toBe("GE");
  expect(G.flags.pendingResponse).toBe(true);
  return {G, ctx};
};

test("International Conference prints two distinct, non-empty options", () => {
  const card = ACTION_CARDS.find((c) => c.id === "IE-A067")!;
  expect(card.type).toBe("response");
  expect(card.options).toHaveLength(2);

  const [crisis, reduceWtt] = card.options!;
  for (const option of card.options!) {
    expect(option.label.length).toBeGreaterThan(0);
    expect(option.labelZh.length).toBeGreaterThan(0);
    expect(option.text.length).toBeGreaterThan(0);
    expect(option.textZh.length).toBeGreaterThan(0);
    expect(option.effects.length).toBeGreaterThan(0);
    expect(option.effects.some((e) => e.type !== "note")).toBe(true);
  }
  expect(crisis.effects).not.toEqual(reduceWtt.effects);
  expect(JSON.stringify(crisis.effects)).toContain("internationalConference");
  expect(JSON.stringify(reduceWtt.effects)).toContain('"wtt"');
});

/** A67's printed response window is the open crisis decision itself. */
const startCrisisResponse = (inciting: string | null = null) => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  clearHands(G);
  G.powers.GE.hand = ["IE-A067"];
  G.wtt = 5;
  G.resolvingCard = inciting;
  const ctx = makeCtx("0");
  openCrisisDecision(G, ctx, "GE", []);
  expect(G.pending?.kind).toBe("crisis");
  return {G, ctx};
};

test("International Conference is not a generic impulse response", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  G.powers.GE.hand = ["IE-A067"];

  expect(responseCardEligibility(G, "GE", "IE-A067")).toMatchObject({
    ok: false,
    reason: "crisis-window",
  });
  expect(playResponseCard(G, makeCtx("0"), "IE-A067")).toBe(INVALID_MOVE);
  expect(G.powers.GE.hand).toContain("IE-A067");
});

test("International Conference adds its +2 DRM and keeps the crisis roll open", () => {
  const {G, ctx} = startCrisisResponse();

  expect(G.flags.crisisDrm).toBeUndefined();
  expect(playResponseCard(G, ctx, "IE-A067")).toBeUndefined();

  expect(G.flags.crisisDrm).toBe(2);
  expect(G.pending?.kind).toBe("crisis");
  expect(G.pending?.options.map((o) => o.id)).toEqual(["roll"]);
  expect(G.flags.pendingResponse).toBeUndefined();
  expect(G.powers.GE.hand).not.toContain("IE-A067");
  expect(G.discard.filter((id) => id === "IE-A067")).toHaveLength(1);
});

test("International Conference cannot answer Impulsive Ruler's crisis", () => {
  const {G} = startCrisisResponse("IE-A105");

  expect(responseCardEligibility(G, "GE", "IE-A067")).toMatchObject({
    ok: false,
    reason: "impulsive-ruler",
  });
});

test("International Conference's event mode is the printed WTT decrease", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  clearHands(G);
  G.powers.GE.hand = ["IE-A067"];
  G.wtt = 3;
  const ctx = makeCtx("0");

  expect(playCard(G, ctx, "IE-A067", "event")).toBeUndefined();
  // Only the WTT branch: the +2 DRM is exclusive to the open crisis window.
  expect(G.wtt).toBe(2);
  expect(G.flags.crisisDrm ?? 0).toBe(0);
  expect(G.pending).toBeNull();
  expect(G.discard).toContain("IE-A067");
});

test("Indian Ocean Arms Trade prints two distinct, non-empty options", () => {
  const card = ACTION_CARDS.find((c) => c.id === "IE-A065")!;
  expect(card.type).toBe("response");
  expect(card.options).toHaveLength(2);

  const [armsTrade, flipRebel] = card.options!;
  for (const option of card.options!) {
    expect(option.label.length).toBeGreaterThan(0);
    expect(option.labelZh.length).toBeGreaterThan(0);
    expect(option.text.length).toBeGreaterThan(0);
    expect(option.textZh.length).toBeGreaterThan(0);
    expect(option.effects.length).toBeGreaterThan(0);
    expect(option.effects.some((e) => e.type !== "note")).toBe(true);
  }
  expect(armsTrade.effects).not.toEqual(flipRebel.effects);
  expect(JSON.stringify(armsTrade.effects)).toContain("indianOceanArms");
  expect(JSON.stringify(flipRebel.effects)).toContain("flipReducedRebelToFull");
});

/**
 * A65 is printed "Play prior to a pacification roll", so it no longer resolves
 * from the generic impulse window: `pacify`'s printed `a065` mode offers it at
 * the roll itself.
 */
const startPacifyWithArmsTrade = (mode: "marker" | "rebel", dice: number[] = [3, 3]) => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 5;
  clearHands(G);
  G.powers.GE.hand = ["IE-A065"];
  for (const space of Object.values(G.spaces)) space.pacification = 0;
  G.spaces.dagestan.influence = "GE";
  G.spaces.dagestan.pacification = 3;
  // 12.11 requires a land unit in the space to pacify it.
  placeUnit(G, "GE", "army", "dagestan", 2);
  const ctx = makeCtxWith(dice);

  expect(pacify(G, ctx, "dagestan", mode)).toBeUndefined();
  return {G, ctx};
};

test("Indian Ocean Arms Trade is only offered in the pacification window", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  G.powers.GE.hand = ["IE-A065"];
  expect(responseCardEligibility(G, "GE", "IE-A065")).toMatchObject({
    ok: false,
    reason: "pacification-window",
  });
  expect(playResponseCard(G, makeCtx("0"), "IE-A065")).toBe(INVALID_MOVE);
  expect(G.powers.GE.hand).toContain("IE-A065");
});

test("the marker mode decreases the marker before the roll and draws a card", () => {
  // 5 + 5 + the reduced marker (2) = 12: the roll only reaches 10+ if the
  // card's -1 was applied before it.
  const {G} = startPacifyWithArmsTrade("marker", [5, 5]);

  expect(G.powers.GE.hand).not.toContain("IE-A065");
  expect(G.powers.GE.hand).toHaveLength(1);
  expect(G.discard.filter((id) => id === "IE-A065")).toHaveLength(1);
  expect(G.spaces.dagestan.control).toBe("GE");
  expect(G.spaces.dagestan.pacification).toBe(0);
  expect(G.log.some((entry) => entry.key === "pacified" && entry.args?.space === "dagestan" && entry.args?.roll === 12)).toBe(true);
  expect(G.pending).toBeNull();
});

test("the rebel mode flips a reduced rebel to full strength and draws", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 5;
  clearHands(G);
  G.powers.GE.hand = ["IE-A065"];
  for (const space of Object.values(G.spaces)) space.pacification = 0;
  G.spaces.dagestan.influence = "GE";
  const reduced = placeUnit(G, "REBEL:Poland", "rebelArmy", "dagestan", 1);

  expect(pacify(G, makeCtxWith([3, 3]), "dagestan", "rebel")).toBeUndefined();

  expect(G.units[reduced.id].steps).toBe(2);
  expect(G.powers.GE.hand).toHaveLength(1);
  expect(G.discard.filter((id) => id === "IE-A065")).toHaveLength(1);
  expect(G.pending).toBeNull();
});

test("declining the card rolls the pacification as printed", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 5;
  clearHands(G);
  G.powers.GE.hand = ["IE-A065"];
  for (const space of Object.values(G.spaces)) space.pacification = 0;
  G.spaces.dagestan.influence = "GE";
  G.spaces.dagestan.pacification = 0;
  // 12.11 requires a land unit in the space to pacify it.
  placeUnit(G, "GE", "army", "dagestan", 2);

  expect(pacify(G, makeCtxWith([6, 6]), "dagestan")).toBeUndefined();

  expect(G.powers.GE.hand).toContain("IE-A065");
  expect(G.spaces.dagestan.control).toBe("GE");
});

test("asking for the card without holding it is refused before any CP is spent", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 5;
  clearHands(G);
  G.spaces.dagestan.influence = "GE";
  const before = G.cpRemaining;

  expect(pacify(G, makeCtx("0"), "dagestan", "marker")).toBe(INVALID_MOVE);
  expect(G.cpRemaining).toBe(before);
  expect(G.pending ?? null).toBeNull();
});
