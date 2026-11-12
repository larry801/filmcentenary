import type {Ctx} from "boardgame.io";
import type {ImperialElegyState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {
  beginImpulseUpkeep,
  brokenLoc,
  impulsePenalties,
  isOverstacked,
  landStackingLimit,
  landUnitsIn,
  navalUnitsIn,
  overstackedSpaces,
  PORT_NAVAL_LIMIT,
} from "./engine/rules";
import {endDiplomacy, endImpulse, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {
      Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3,
    },
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const clearLand = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...landUnitsIn(G, space)]) removeUnit(G, unit.id);
};

const clearNaval = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...navalUnitsIn(G, space)]) removeUnit(G, unit.id);
};

// ---------------------------------------------------------------------------
// 5.5.1 / 5.5.2 / 5.5.4 stacking limits
// ---------------------------------------------------------------------------

describe("stacking limits", () => {
  test("3 in Europe, 2 elsewhere, 2 for every Ottoman home space", () => {
    expect(landStackingLimit("berlin")).toBe(3);
    expect(landStackingLimit("paris")).toBe(3);
    expect(landStackingLimit("india")).toBe(2);
    expect(landStackingLimit("istanbul")).toBe(2);
    expect(landStackingLimit("macedonia")).toBe(2);
  });

  test("ECs and EFs never count against the army limit", () => {
    const G = fresh();
    clearLand(G, "berlin");
    for (let i = 0; i < 3; i += 1) placeUnit(G, "GE", "army", "berlin", 2);
    placeUnit(G, "GE", "eliteCorps", "berlin", 1);
    placeUnit(G, "GE", "eliteCorps", "berlin", 1);
    placeUnit(G, "GE", "expeditionary", "berlin", 1);
    expect(isOverstacked(G, "berlin")).toBe(false);
    expect(overstackedSpaces(G, "GE")).not.toContain("berlin");
  });

  test("a fourth army in a European key and a third in an OT home space overstack", () => {
    const G = fresh();
    clearLand(G, "berlin");
    clearLand(G, "macedonia");
    for (let i = 0; i < 4; i += 1) placeUnit(G, "GE", "army", "berlin", 2);
    for (let i = 0; i < 3; i += 1) placeUnit(G, "GE", "army", "macedonia", 2);
    expect(overstackedSpaces(G, "GE")).toEqual(expect.arrayContaining(["berlin", "macedonia"]));
  });

  test("ports hold 4 naval units; naval boxes have no limit", () => {
    const G = fresh();
    clearNaval(G, "london");
    for (let i = 0; i < PORT_NAVAL_LIMIT + 1; i += 1) placeUnit(G, "GE", "squadron", "london", 2);
    expect(isOverstacked(G, "london")).toBe(true);
    expect(overstackedSpaces(G, "GE")).toContain("london");
    clearNaval(G, "north-atlantic");
    for (let i = 0; i < 8; i += 1) placeUnit(G, "GE", "squadron", "north-atlantic", 2);
    expect(isOverstacked(G, "north-atlantic")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5.5.3 overstacking losses at the start of the owning player's impulse
// ---------------------------------------------------------------------------

describe("5.5.3 overstacking losses", () => {
  test("the stack loses one step total, and the owning player chooses the unit", () => {
    const G = fresh();
    clearLand(G, "berlin");
    const ids = [0, 1, 2, 3].map(() => placeUnit(G, "GE", "army", "berlin", 2).id);
    const ctx = makeCtx();
    const opened = beginImpulseUpkeep(G, ctx, "GE");
    expect(opened).toBe(true);
    expect(G.pending?.kind).toBe("impulseLoss");
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.options.map((o) => o.id).sort()).toEqual([...ids].sort());

    expect(resolvePending(G, ctx, ids[1])).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.units[ids[1]].steps).toBe(1);
    expect(G.units[ids[0]].steps).toBe(2);
    expect(G.units[ids[2]].steps).toBe(2);
  });

  test("only the owning player's units are candidates; other players lose their own step on their impulse", () => {
    const G = fresh();
    // A port overstack with two owners: naval units are never displaced by the
    // peacetime broken-LoC rule, so the stack persists across impulses.
    clearNaval(G, "london");
    const ge = [0, 1, 2].map(() => placeUnit(G, "GE", "squadron", "london", 2).id);
    const fr = [placeUnit(G, "FR", "squadron", "london", 2).id, placeUnit(G, "FR", "squadron", "london", 2).id];
    expect(navalUnitsIn(G, "london").length).toBe(5);
    const ctx = makeCtx();
    beginImpulseUpkeep(G, ctx, "GE");
    expect(G.pending?.options.map((o) => o.id).sort()).toEqual([...ge].sort());
    expect(G.pending?.options.some((o) => o.id === fr[0])).toBe(false);
    resolvePending(G, ctx, ge[0]);
    expect(G.units[fr[0]].steps).toBe(2);
    // France's own impulse: one of its two ships takes a step.
    beginImpulseUpkeep(G, makeCtx([], "2"), "FR");
    expect(G.pending?.power).toBe("FR");
    resolvePending(G, makeCtx([], "2"), fr[1]);
    expect(G.units[fr[1]].steps).toBe(1);
    expect(G.units[fr[0]].steps).toBe(2);
  });

  test("a single eligible unit takes the step deterministically and the penalty fires once per impulse", () => {
    const G = fresh();
    clearNaval(G, "london");
    const only = placeUnit(G, "GE", "squadron", "london", 2).id;
    for (let i = 0; i < PORT_NAVAL_LIMIT; i += 1) placeUnit(G, "UK", "squadron", "london", 2);
    const ctx = makeCtx();
    expect(beginImpulseUpkeep(G, ctx, "GE")).toBe(false);
    expect(G.units[only].steps).toBe(1);
    expect(G.pending).toBeNull();
    // A second call for the same impulse must not fire again.
    expect(beginImpulseUpkeep(G, ctx, "GE")).toBe(false);
    expect(G.units[only].steps).toBe(1);
  });

  test("the penalty is applied when the impulse passes to the overstacked player", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.passed = [];
    G.pending = null;
    G.battle = null;
    G.cpRemaining = 1;
    clearLand(G, "india");
    const uk = [0, 1, 2].map(() => placeUnit(G, "UK", "army", "india", 2).id);
    const geCtx = makeCtx([], "0");
    expect(endImpulse(G, geCtx)).toBeUndefined();
    expect(G.activePower).toBe("UK");
    expect(G.pending?.kind).toBe("impulseLoss");
    expect(G.pending?.power).toBe("UK");
    resolvePending(G, makeCtx([], "1"), uk[2]);
    expect(G.units[uk[2]].steps).toBe(1);
    // No double fire when the impulse-start helper is called again.
    const before = uk.map((id) => G.units[id].steps);
    beginImpulseUpkeep(G, makeCtx([], "1"), "UK");
    expect(uk.map((id) => G.units[id].steps)).toEqual(before);
  });

  test("the first impulse of an action phase runs the upkeep", () => {
    const G = fresh();
    G.phase = "diplomacy";
    G.activePower = "GE";
    G.pending = null;
    G.battle = null;
    for (const power of POWERS) G.powers[power].flags.homeChosen = true;
    clearLand(G, "berlin");
    [0, 1, 2, 3].forEach(() => placeUnit(G, "GE", "army", "berlin", 2));
    expect(endDiplomacy(G, makeCtx([], "0"))).toBeUndefined();
    expect(G.phase).toBe("action");
    // 33.4 Metternich's Legacy opens the AU choice before Germany's first
    // impulse; answer it so the 5.5.3 upkeep runs.
    while (G.pending?.kind === "metternich") {
      const option = G.pending.options[0];
      expect(resolvePending(G, makeCtx([], "3"), option.id)).toBeUndefined();
    }
    expect(G.pending?.kind).toBe("impulseLoss");
    expect(G.pending?.power).toBe("GE");
  });

  test("impulsePenalties reports the cause and only enumerates the power's own step units", () => {
    const G = fresh();
    clearNaval(G, "london");
    placeUnit(G, "GE", "squadron", "london", 2);
    placeUnit(G, "GE", "squadron", "london", 2);
    for (let i = 0; i < PORT_NAVAL_LIMIT; i += 1) placeUnit(G, "UK", "squadron", "london", 2);
    const penalties = impulsePenalties(G, "GE");
    const entry = penalties.find((p) => p.space === "london");
    expect(entry?.cause).toBe("overstack");
    expect(entry?.candidates.length).toBe(2);
    expect(penalties.every((p) => p.candidates.every((id) => G.units[id]?.owner === "GE"))).toBe(true);
  });

  test("POWERS is the only seat source of candidates (sanity)", () => {
    expect(POWERS).toContain("GE");
    // A broken-LoC space is not produced in peacetime; only overstack does.
    const G = fresh();
    clearLand(G, "paris");
    placeUnit(G, "GE", "army", "paris", 2);
    expect(brokenLoc(G, "GE", "paris")).toBe(true);
    expect(impulsePenalties(G, "GE").some((p) => p.space === "paris")).toBe(false);
  });
});
