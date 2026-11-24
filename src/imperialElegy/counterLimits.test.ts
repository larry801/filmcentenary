import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {addReserve, gainMinorAlliance, placeUnit} from "./engine/effects";
import {
  counterPool,
  counterRemaining,
  countersOwned,
  hasCounterFor,
  navalCounterLimit,
  raiseNavalCounterLimit,
} from "./engine/counters";
import {outbreakGreatWar} from "./engine/greatWar";
import {GOALS_BY_ID} from "./constant/goals";
import {constructFleet, minorAlliance, recruit} from "./moves";
import {minorAlliesOf} from "./engine/rules";

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

const actionContext = (G: ImperialElegyState): Ctx => {
  G.phase = "action";
  G.activePower = "GE";
  G.pending = null;
  G.battle = null;
  G.cpRemaining = 30;
  return makeCtx();
};

// ---------------------------------------------------------------------------
// 4.2 printed naval counter limits
// ---------------------------------------------------------------------------

describe("4.2 naval counter limits", () => {
  test("GE/AU/OT start at 2/2; UK/FR/RU use their printed chart counters", () => {
    const G = fresh();
    for (const power of ["GE", "AU", "OT"] as const) {
      expect(navalCounterLimit(G, power)).toEqual({squadrons: 2, dreadnoughts: 2});
    }
    // counter-count.png: UK 6/6, FR 4/4, RU 4/4.
    expect(navalCounterLimit(G, "UK")).toEqual({squadrons: 6, dreadnoughts: 6});
    expect(navalCounterLimit(G, "FR")).toEqual({squadrons: 4, dreadnoughts: 4});
    expect(navalCounterLimit(G, "RU")).toEqual({squadrons: 4, dreadnoughts: 4});
  });

  test("A092 Naval Arms Race raises the cap to 4/4", () => {
    const G = fresh();
    expect(raiseNavalCounterLimit(G, "AU")).toBe(true);
    expect(navalCounterLimit(G, "AU")).toEqual({squadrons: 4, dreadnoughts: 4});
    // The printed clause only applies to the three Central Powers.
    expect(raiseNavalCounterLimit(G, "UK")).toBe(false);
    expect(navalCounterLimit(G, "UK")).toEqual({squadrons: 6, dreadnoughts: 6});
  });

  test("GE Continental Focus keeps 2/2 until unification", () => {
    const G = fresh();
    expect(navalCounterLimit(G, "GE")).toEqual({squadrons: 2, dreadnoughts: 2});
    G.powers.GE.unified = true;
    // Continental Focus lapses at unification: the chart's 4/4 physical mix is
    // available (GE holds two NAR counters like AU/OT).
    expect(navalCounterLimit(G, "GE")).toEqual({squadrons: 4, dreadnoughts: 4});
    // A092 still applies its printed 4/4.
    raiseNavalCounterLimit(G, "GE");
    expect(navalCounterLimit(G, "GE")).toEqual({squadrons: 4, dreadnoughts: 4});
  });

  test("constructFleet rejects a third GE squadron and a third dreadnought", () => {
    const G = fresh();
    const ctx = actionContext(G);
    G.persistent.dreadnoughts = true;
    expect(constructFleet(G, ctx, "prussia", "squadron")).toBeUndefined();
    expect(constructFleet(G, ctx, "prussia", "squadron")).toBeUndefined();
    expect(constructFleet(G, ctx, "prussia", "squadron")).toBe(INVALID_MOVE);
    expect(countersOwned(G, "GE", "squadron")).toBe(2);
    expect(constructFleet(G, ctx, "prussia", "dreadnought")).toBeUndefined();
    expect(constructFleet(G, ctx, "prussia", "dreadnought")).toBeUndefined();
    expect(constructFleet(G, ctx, "prussia", "dreadnought")).toBe(INVALID_MOVE);
  });

  test("A092 lets the same builds through at 4/4", () => {
    const G = fresh();
    const ctx = actionContext(G);
    raiseNavalCounterLimit(G, "GE");
    for (let i = 0; i < 4; i += 1) {
      expect(constructFleet(G, ctx, "prussia", "squadron")).toBeUndefined();
    }
    expect(constructFleet(G, ctx, "prussia", "squadron")).toBe(INVALID_MOVE);
  });

  test("the dreadnought event gate is unchanged", () => {
    const G = fresh();
    const ctx = actionContext(G);
    expect(constructFleet(G, ctx, "prussia", "dreadnought")).toBe(INVALID_MOVE);
    G.persistent.dreadnoughts = true;
    expect(constructFleet(G, ctx, "prussia", "dreadnought")).toBeUndefined();
  });

  test("a port holds at most four naval units (5.5.4)", () => {
    const G = fresh();
    const ctx = actionContext(G);
    // Bypass the counter limit by owning the ships directly.
    for (let i = 0; i < 4; i += 1) placeUnit(G, "GE", "squadron", "prussia", 2);
    expect(constructFleet(G, ctx, "prussia", "dreadnought")).toBe(INVALID_MOVE);
  });
});

// ---------------------------------------------------------------------------
// 4.2 general counter pool
// ---------------------------------------------------------------------------

describe("4.2 counter pool", () => {
  test("the pool is the transcribed counter chart", () => {
    const G = fresh();
    const pool = counterPool(G, "GE");
    expect(pool.army).toBe(5);
    expect(pool.reserveArmy).toBe(11);
    expect(pool.eliteCorps).toBe(4);
    expect(pool.expeditionary).toBe(4);
    expect(pool.squadron).toBe(2);
    expect(pool.dreadnought).toBe(2);
    expect(counterRemaining(G, "GE", "expeditionary")).toBe(4);
  });

  test("a build cannot create an army counter the power does not own", () => {
    const G = fresh();
    const ctx = actionContext(G);
    const pool = counterPool(G, "GE").army!;
    // Fill the pool with armies stationed at sea, so stacking/manpower never
    // masks the counter check.
    const alreadyOwned = countersOwned(G, "GE", "army");
    for (let i = alreadyOwned; i < pool; i += 1) placeUnit(G, "GE", "army", "north-atlantic", 2);
    expect(counterRemaining(G, "GE", "army")).toBe(0);
    expect(hasCounterFor(G, "GE", "army")).toBe(false);
    G.powers.GE.manpower = 30;
    expect(recruit(G, ctx, "berlin", "army")).toBe(INVALID_MOVE);
  });

  test("a card that grants reserve armies cannot exceed the pool", () => {
    const G = fresh();
    const pool = counterPool(G, "FR").reserveArmy!;
    for (let i = countersOwned(G, "FR", "reserveArmy"); i < pool; i += 1) {
      placeUnit(G, "FR", "reserveArmy", null, 2);
    }
    const before = countersOwned(G, "FR", "reserveArmy");
    expect(before).toBe(pool);
    // Aux Armes' "gain 2 reserve army steps" goes through this helper.
    addReserve(G, "FR", 2);
    expect(countersOwned(G, "FR", "reserveArmy")).toBe(pool);
    expect(G.log.some((entry) => entry.key === "reserveArmyLimited" && entry.power === "FR")).toBe(true);
  });

  test("25.6 grants no Elite Corps beyond the pool", () => {
    const G = fresh();
    const pool = counterPool(G, "GE").eliteCorps!;
    for (let i = countersOwned(G, "GE", "eliteCorps"); i < pool; i += 1) {
      placeUnit(G, "GE", "eliteCorps", "berlin", 1);
    }
    expect(countersOwned(G, "GE", "eliteCorps")).toBe(pool);
    // The National Will Step only grants at 3+ VP, which the outbreak scores
    // from the NGs the player is holding.
    const best = Object.entries(GOALS_BY_ID)
      .sort(([, a], [, b]) => (b.vp ?? 0) - (a.vp ?? 0))
      .slice(0, 3)
      .map(([id]) => id);
    G.powers.GE.goals = best;
    G.pending = null;
    outbreakGreatWar(G, makeCtx(4), "GE", "IE-A001");
    expect(countersOwned(G, "GE", "eliteCorps")).toBe(pool);
    expect(G.log.some((entry) => entry.key === "nationalWillEcLimited" && entry.power === "GE")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4.2.1 maximum of five minor power allies
// ---------------------------------------------------------------------------

describe("4.2.1 minor ally cap", () => {
  const minorSpace = (G: ImperialElegyState, minor: string): string => {
    const space = Object.entries(G.spaces).find(([, state]) => state.control === minor)?.[0];
    if (space === undefined) throw new Error(`no space starts controlled by ${minor}`);
    return space;
  };

  test("five distinct minor allies are the limit; a multi-space minor counts once", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.pending = null;
    G.battle = null;
    G.cpRemaining = 20;
    const ctx = makeCtx();

    const allies = ["Belgium", "Netherlands", "Hanover", "Saxony", "Bavaria"];
    for (const minor of allies) G.spaces[minorSpace(G, minor)].ally = "GE";
    // Bavaria controlling a second space is still one minor ally.
    G.spaces.picardy.control = "Bavaria";
    G.spaces.picardy.ally = "GE";
    expect(minorAlliesOf(G, "GE")).toHaveLength(5);
    expect(minorAlliesOf(G, "GE")).toEqual([...new Set(minorAlliesOf(G, "GE"))]);

    // A sixth distinct minor power is refused.
    G.spaces.greece.diplomacy = "GE";
    expect(minorAlliance(G, ctx, "greece")).toBe(INVALID_MOVE);

    // Dropping one ally makes room for it.
    G.spaces.belgium.ally = null;
    expect(minorAlliance(G, ctx, "greece")).toBeUndefined();
    expect(minorAlliesOf(G, "GE")).toHaveLength(5);
  });
});

describe("4.2.1 — the five-minor-ally limit on the event paths", () => {
  /** The space a minor controls at setup. */
  const minorSpace = (G: ImperialElegyState, minor: string): string => {
    const space = Object.entries(G.spaces).find(([, state]) => state.control === minor)?.[0];
    if (space === undefined) throw new Error(`no space starts controlled by ${minor}`);
    return space;
  };

  const fiveAllies = (G: ImperialElegyState): void => {
    for (const minor of ["Belgium", "Netherlands", "Hanover", "Saxony", "Bavaria"]) {
      G.spaces[minorSpace(G, minor)].ally = "GE";
    }
  };

  test("a card event cannot take a power to a sixth minor ally", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    fiveAllies(G);
    const sixth = minorSpace(G, "Greece");
    G.spaces[sixth].diplomacy = "GE";

    // The event-path setter (RU-9's Balkan alliance, A097's follow-up) reads the
    // same 4.2.1 cap the 12.8 move does.
    expect(gainMinorAlliance(G, "GE", sixth)).toBe(false);
    expect(minorAlliesOf(G, "GE")).toHaveLength(5);
    expect(G.spaces[sixth].ally).toBeNull();
    expect(G.log.some((entry) => entry.key === "minorAllyCapRefused")).toBe(true);
  });

  test("re-affirming an existing ally is always allowed", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    fiveAllies(G);
    // 22.1.1's petition may re-affirm one of the five: that is not a sixth.
    const existing = minorSpace(G, "Belgium");
    G.spaces[existing].diplomacy = "GE";
    expect(gainMinorAlliance(G, "GE", existing)).toBe(true);
    expect(minorAlliesOf(G, "GE")).toHaveLength(5);
  });

  test("a player's own space is never a minor-ally target", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    expect(gainMinorAlliance(G, "GE", "berlin")).toBe(false);
    expect(gainMinorAlliance(G, "GE", minorSpace(G, "Greece"))).toBe(true);
  });
});
