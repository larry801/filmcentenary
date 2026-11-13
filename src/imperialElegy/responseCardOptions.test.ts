import {ACTION_CARDS} from "./constant/cards.data";
import {placeUnit} from "./engine/effects";
import {setupImperialElegy} from "./engine/setup";
import {playResponseCard, resolvePending} from "./moves";
import {POWERS} from "./types";

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

test("International Conference offers both printed options when played as a response", () => {
  const {G} = startResponse("IE-A067");

  expect(G.pending?.options.map((o) => o.id)).toEqual(["opt0", "opt1"]);
  expect(G.pending?.options.map((o) => o.label)).toEqual([
    "Apply +2 DRM to the crisis roll",
    "Decrease the WTT by 1",
  ]);
  // One-off card option labels keep their printed Chinese text in the pending.
  expect(G.pending?.options.map((o) => o.labelZh)).toEqual([
    "危机掷骰 +2 DRM",
    "世界紧张 -1",
  ]);
  expect(G.powers.GE.hand).not.toContain("IE-A067");
});

test("International Conference option 1 applies +2 DRM to the crisis roll", () => {
  const {G, ctx} = startResponse("IE-A067");

  expect(G.flags.crisisDrm).toBeUndefined();
  resolvePending(G, ctx, "opt0");

  expect(G.flags.crisisDrm).toBe(2);
  expect(G.wtt).toBe(0);
  expect(G.pending).toBeNull();
  expect(G.flags.pendingResponse).toBeUndefined();
  expect(G.discard.filter((id) => id === "IE-A067")).toHaveLength(1);
  // A response card must not end the impulse when its pending choice resolves.
  expect(G.phase).toBe("action");
  expect(G.activePower).toBe("GE");
});

test("International Conference option 2 decreases the WTT by 1", () => {
  const {G, ctx} = startResponse("IE-A067");
  G.wtt = 3;

  resolvePending(G, ctx, "opt1");

  expect(G.wtt).toBe(2);
  expect(G.flags.crisisDrm ?? 0).toBe(0);
  expect(G.pending).toBeNull();
  expect(G.flags.pendingResponse).toBeUndefined();
  expect(G.discard.filter((id) => id === "IE-A067")).toHaveLength(1);
  expect(G.phase).toBe("action");
  expect(G.activePower).toBe("GE");
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

test("Indian Ocean Arms Trade offers both printed options when played as a response", () => {
  const {G} = startResponse("IE-A065");

  expect(G.pending?.options.map((o) => o.id)).toEqual(["opt0", "opt1"]);
  expect(G.pending?.options.map((o) => o.label)).toEqual([
    "Decrease a pacification marker by 1",
    "Flip a reduced rebel army to full strength",
  ]);
  expect(G.powers.GE.hand).not.toContain("IE-A065");
});

test("Indian Ocean Arms Trade option 1 decreases a pacification marker and draws a card", () => {
  const {G, ctx} = startResponse("IE-A065");
  for (const space of Object.values(G.spaces)) space.pacification = 0;
  G.spaces.dagestan.pacification = 2;
  const handBefore = G.powers.GE.hand.length;

  resolvePending(G, ctx, "opt0");

  expect(G.spaces.dagestan.pacification).toBe(1);
  expect(G.powers.GE.hand.length).toBe(handBefore + 1);
  expect(G.pending).toBeNull();
  expect(G.flags.pendingResponse).toBeUndefined();
  expect(G.discard.filter((id) => id === "IE-A065")).toHaveLength(1);
  expect(G.phase).toBe("action");
  expect(G.activePower).toBe("GE");
});

test("Indian Ocean Arms Trade option 2 flips a reduced rebel to full strength and draws", () => {
  const {G, ctx} = startResponse("IE-A065");
  const reduced = placeUnit(G, "REBEL:Poland", "rebelArmy", "poland", 1);
  const full = placeUnit(G, "REBEL:Ireland", "rebelArmy", "ireland", 2);
  G.spaces.poland.pacification = 1;
  const handBefore = G.powers.GE.hand.length;

  resolvePending(G, ctx, "opt1");

  expect(G.units[reduced.id].steps).toBe(2);
  expect(G.units[full.id].steps).toBe(2);
  expect(G.powers.GE.hand.length).toBe(handBefore + 1);
  expect(G.pending).toBeNull();
  expect(G.flags.pendingResponse).toBeUndefined();
  expect(G.discard.filter((id) => id === "IE-A065")).toHaveLength(1);
  expect(G.phase).toBe("action");
  expect(G.activePower).toBe("GE");
});
