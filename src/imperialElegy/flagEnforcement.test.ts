/**
 * GW flags stored by cards and enforced by the live engine:
 *  - GW-08/09 Political Pressure (must attack this GW turn);
 *  - GW-10 Exhaustion (stability or VP mode, never on GW turn 0);
 *  - GW-07 Submarines (blockade condition, +-2 DRM, printed budget table);
 *  - A093 Nicholas II (God Save the Tsar needs a 3+);
 *  - A106 The Young Turks (permanent +1 manpower, 2 ECs).
 */
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {beginLandBattle, finishBattle} from "./engine/combat";
import {placeUnit} from "./engine/effects";
import {recomputeTracks} from "./engine/rules";
import {
  activateGwExhaustion,
  adjacentToEnemyArmies,
  resolveGwWinter,
  usAllianceBox,
} from "./engine/greatWarFlow";
import {
  playCard,
  playGwCardMove,
  recruit,
  resolvePending,
} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {
      Die: (sides: number) => Math.min(sides, dice[Math.min(index++, dice.length - 1)] ?? 3),
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

const seat = (power: Power): string => String(POWERS.indexOf(power));
const ctxFor = (power: Power, dice: number[] = []): Ctx => makeCtx(dice, seat(power));
const fresh = (dice: number[] = []): ImperialElegyState => setupImperialElegy(makeCtx(dice));

const baseGw = (overrides: Partial<GreatWarState> = {}): ImperialElegyState => {
  const G = fresh();
  G.gw = {
    active: true,
    turn: 2,
    order: ["GE", "FR"],
    belligerents: ["GE", "FR"],
    neutrals: ["UK", "AU", "RU", "OT"],
    te: ["FR"],
    ta: ["GE"],
    usIn: false,
    italyIn: false,
    usStability: 3,
    usManpower: 3,
    usBudget: 4,
    italyStability: 3,
    italyManpower: 3,
    italyBudget: 2,
    trenches: {},
    lastColonialWar: null,
    victor: null,
    outbreakDone: true,
    nationalWillDone: true,
    bonusImpulses: [],
    ...overrides,
  };
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.phase = "gwManeuver";
  G.activePower = "GE";
  G.turnIndex = 0;
  return G;
};

/** Play the active power's GW card as an event and leave its decision open. */
const playGwEvent = (G: ImperialElegyState, cardId: string, power: Power = "GE", dice: number[] = []): Ctx => {
  G.powers[power].gwCard = cardId;
  G.phase = "gwManeuver";
  G.activePower = power;
  const ctx = makeCtx(dice, seat(power));
  expect(playGwCardMove(G, ctx, "event")).toBeUndefined();
  return ctx;
};

/**
 * Run a decisive land battle where the defender loses with two armies, driving
 * the printed 30.0 "defeat in a decisive battle" stability path.
 */
const decisiveDefeat = (
  G: ImperialElegyState,
  attacker: Power,
  from: string,
  to: string,
  defender: Power,
): void => {
  const ctx = makeCtx([3]);
  placeUnit(G, attacker, "army", from, 2);
  placeUnit(G, defender, "army", to, 2);
  placeUnit(G, defender, "army", to, 2);
  const battle = beginLandBattle(G, ctx, attacker, from, to);
  if (!battle) throw new Error("battle did not start");
  G.pending = null;
  battle.winner = "attacker";
  battle.decisive = true;
  battle.attackerLosses = 0;
  battle.defenderLosses = 0;
  finishBattle(G, ctx);
  G.pending = null;
};

// ---------------------------------------------------------------------------
// GW-08 / GW-09 Political Pressure
// ---------------------------------------------------------------------------
describe("GW-08 Political Pressure", () => {
  const pressureSetup = (): ImperialElegyState => {
    const G = baseGw();
    // A German army next to a French one: both are "adjacent to enemy armies".
    placeUnit(G, "GE", "army", "berlin", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    G.powers.GE.gwBudget = 4;
    G.powers.FR.gwBudget = 3;
    return G;
  };

  test("only a player with a budget of 2+ adjacent to an enemy can be chosen", () => {
    const G = pressureSetup();
    playGwEvent(G, "IE-GW-08");
    expect(G.pending?.kind).toBe("eventTargetPower");
    const targets = (G.pending?.options ?? []).map((o) => o.id);
    expect(targets).toEqual(["FR"]);
    // A poor player is not a legal target even when adjacent.
    G.pending = null;
    G.powers.FR.gwBudget = 1;
    playGwEvent(G, "IE-GW-08", "GE", []);
    // No legal target: the event resolves without a decision and is logged.
    expect(G.pending).toBeNull();
    expect(G.log.some((entry) => entry.key === "noLegalTarget")).toBe(true);
  });

  test("records who is pressured and in which turn", () => {
    const G = pressureSetup();
    playGwEvent(G, "IE-GW-08");
    expect(resolvePending(G, ctxFor("GE"), "FR")).toBeUndefined();
    expect(G.persistent.politicalPressure).toBe("FR");
    expect(G.persistent.politicalPressureTurn).toBe(2);
    expect(G.pending).toBeNull();
  });

  test("a pressured player that does not attack loses one stability at turn end", () => {
    const G = pressureSetup();
    playGwEvent(G, "IE-GW-08");
    resolvePending(G, ctxFor("GE"), "FR");
    const before = G.powers.FR.stability;

    G.phase = "gwWinter";
    const res = resolveGwWinter(G, makeCtx([3]));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.politicalPressureLosses).toEqual(["FR"]);
    expect(G.powers.FR.stability).toBe(before - 1);
    expect(G.persistent.politicalPressure).toBeUndefined();
    expect(G.persistent.politicalPressureTurn).toBeUndefined();
  });

  test("a land attack after the card satisfies the pressure", () => {
    const G = pressureSetup();
    playGwEvent(G, "IE-GW-08");
    resolvePending(G, ctxFor("GE"), "FR");

    // The pressured player attacks: the land-battle entry records the turn.
    const battle = beginLandBattle(G, makeCtx([3]), "FR", "saxony", "berlin");
    expect(battle).not.toBeNull();
    G.pending = null;
    G.battle = null;
    expect(G.powers.FR.flags.landAttackTurn).toBe(2);

    const before = G.powers.FR.stability;
    G.phase = "gwWinter";
    const res = resolveGwWinter(G, makeCtx([3]));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.politicalPressureLosses).toEqual([]);
    expect(G.powers.FR.stability).toBe(before);
  });

  test("both Pressures (GW-08 and GW-09) are enforced independently", () => {
    const G = pressureSetup();
    placeUnit(G, "GE", "army", "saxony", 2);
    placeUnit(G, "FR", "army", "bohemia", 2);
    // FR and GE are both adjacent to an enemy army; each is pressured by a
    // different copy of the card.
    playGwEvent(G, "IE-GW-08", "GE");
    expect(resolvePending(G, ctxFor("GE"), "FR")).toBeUndefined();
    G.pending = null;
    playGwEvent(G, "IE-GW-09", "UK");
    expect(resolvePending(G, ctxFor("UK"), "GE")).toBeUndefined();
    expect(G.persistent.politicalPressure).toBe("FR,GE");

    const frBefore = G.powers.FR.stability;
    // GE attacks: only GE satisfied its Pressure.
    expect(beginLandBattle(G, makeCtx([3]), "GE", "saxony", "bohemia")).not.toBeNull();
    G.pending = null;
    G.battle = null;
    G.phase = "gwWinter";
    const res = resolveGwWinter(G, makeCtx([3]));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.politicalPressureLosses).toEqual(["FR"]);
    expect(G.powers.FR.stability).toBe(frBefore - 1);
    // GE's own stability may also move with the colonial-war roll, but it is
    // not in the Pressure list: its attack satisfied the card.
    expect(res.politicalPressureLosses).not.toContain("GE");
  });

  test("a player no longer adjacent to any enemy is not affected", () => {
    const G = pressureSetup();
    playGwEvent(G, "IE-GW-08");
    resolvePending(G, ctxFor("GE"), "FR");
    // The French army leaves: no enemy army is adjacent any more.
    for (const id of [...G.spaces.saxony.units]) {
      const unit = G.units[id];
      if (unit?.owner === "FR") {
        G.spaces.saxony.units = G.spaces.saxony.units.filter((u) => u !== id);
        delete G.units[id];
      }
    }
    expect(adjacentToEnemyArmies(G, "FR")).toBe(false);
    const before = G.powers.FR.stability;
    G.phase = "gwWinter";
    const res = resolveGwWinter(G, makeCtx([3]));
    expect(res.ok).toBe(true);
    expect(G.powers.FR.stability).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// GW-10 Exhaustion
// ---------------------------------------------------------------------------
describe("GW-10 Exhaustion", () => {
  test("does not trigger on GW turn 0", () => {
    const G = baseGw({turn: 0});
    playGwEvent(G, "IE-GW-10");
    expect(G.pending).toBeNull();
    expect(G.persistent.exhaustion).toBeUndefined();
  });

  test("offers both modes only while a neutral player exists", () => {
    const G = baseGw();
    playGwEvent(G, "IE-GW-10");
    expect(G.pending?.kind).toBe("eventChoice");
    expect((G.pending?.options ?? []).map((o) => o.id)).toEqual(["stability", "vp"]);

    G.pending = null;
    G.gw!.neutrals = [];
    playGwEvent(G, "IE-GW-10");
    expect((G.pending?.options ?? []).map((o) => o.id)).toEqual(["stability"]);
  });

  test("stability mode takes effect at the end of the impulse, then a major defeat costs 2 stability", () => {
    const G = baseGw();
    playGwEvent(G, "IE-GW-10");
    expect(resolvePending(G, ctxFor("GE"), "stability")).toBeUndefined();
    // "This event takes effect at the end of this impulse": the choice is only
    // queued while the impulse is still running.
    expect(G.persistent.exhaustion).toBeUndefined();
    expect(G.gw?.exhaustionPending).toMatchObject({mode: "stability"});
    expect(activateGwExhaustion(G)).toBe("stability");
    expect(G.persistent.exhaustion).toBe("stability");
    const before = G.powers.FR.stability;
    decisiveDefeat(G, "GE", "berlin", "saxony", "FR");
    expect(G.powers.FR.stability).toBe(before - 2);
  });

  test("without Exhaustion the same defeat costs 1 stability", () => {
    const G = baseGw();
    const before = G.powers.FR.stability;
    decisiveDefeat(G, "GE", "berlin", "saxony", "FR");
    expect(G.powers.FR.stability).toBe(before - 1);
  });

  test("VP mode takes one VP from every GW belligerent at activation", () => {
    const G = baseGw();
    const geBefore = G.powers.GE.vp;
    const frBefore = G.powers.FR.vp;
    playGwEvent(G, "IE-GW-10");
    expect(resolvePending(G, ctxFor("GE"), "vp")).toBeUndefined();
    expect(G.persistent.exhaustion).toBeUndefined();
    expect(G.powers.GE.vp).toBe(geBefore);
    expect(activateGwExhaustion(G)).toBe("vp");
    expect(G.persistent.exhaustion).toBe("vp");
    expect(G.powers.GE.vp).toBe(geBefore - 1);
    expect(G.powers.FR.vp).toBe(frBefore - 1);
    // A neutral player is not "fighting in the GW".
    expect(G.powers.UK.vp).toBe(0);
  });

  test("the mode is cleared at the end of the GW turn", () => {
    const G = baseGw();
    G.persistent.exhaustion = "stability";
    G.gw!.exhaustionPending = {mode: "vp", power: "GE", turn: 2};
    G.powers.FR.flags.frLandDrm = -1;
    G.phase = "gwWinter";
    const res = resolveGwWinter(G, makeCtx([3]));
    expect(res.ok).toBe(true);
    expect(G.persistent.exhaustion).toBeUndefined();
    expect(G.gw?.exhaustionPending ?? null).toBeNull();
    // "For the rest of the turn" card flags die with the GW turn too.
    expect(G.powers.FR.flags.frLandDrm).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GW-07 Submarines
// ---------------------------------------------------------------------------
describe("GW-07 Submarines", () => {
  test("a player blockaded now or last turn cannot be chosen", () => {
    const G = baseGw({blockaded: ["AU"], blockadedLastTurn: ["RU"]});
    playGwEvent(G, "IE-GW-07");
    expect(G.pending?.kind).toBe("eventTargetPower");
    const targets = (G.pending?.options ?? []).map((o) => o.id);
    expect(targets).not.toContain("AU");
    expect(targets).not.toContain("RU");
    expect(targets).toContain("FR");
  });

  test("the +-2 DRM is chosen before the roll and applies to the table", () => {
    const G = baseGw();
    G.powers.FR.gwBudget = 5;
    playGwEvent(G, "IE-GW-07");
    expect(resolvePending(G, ctxFor("GE"), "FR")).toBeUndefined();
    expect(G.pending?.kind).toBe("eventChoice");
    expect((G.pending?.options ?? []).map((o) => o.id)).toEqual(["plus2", "zero", "minus2"]);

    // d6(4) + 2 = 6: 2 CP and the US chit shifts toward FR's alliance.
    expect(resolvePending(G, ctxFor("GE", [4]), "plus2")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.powers.FR.gwBudget).toBe(3);
    expect(usAllianceBox(G)).toBe("teAligned");
  });

  test("4-6 cannot reduce the budget below 1", () => {
    const G = baseGw();
    G.powers.FR.gwBudget = 2;
    playGwEvent(G, "IE-GW-07");
    resolvePending(G, ctxFor("GE"), "FR");
    expect(resolvePending(G, ctxFor("GE", [4]), "zero")).toBeUndefined();
    expect(G.powers.FR.gwBudget).toBe(1);
  });

  test("1-3 costs one CP and 4-5 costs two", () => {
    const G = baseGw();
    G.powers.FR.gwBudget = 5;
    playGwEvent(G, "IE-GW-07");
    resolvePending(G, ctxFor("GE"), "FR");
    expect(resolvePending(G, ctxFor("GE", [2]), "zero")).toBeUndefined();
    expect(G.powers.FR.gwBudget).toBe(4);

    G.pending = null;
    G.powers.FR.gwBudget = 5;
    playGwEvent(G, "IE-GW-07");
    resolvePending(G, ctxFor("GE"), "FR");
    expect(resolvePending(G, ctxFor("GE", [5]), "zero")).toBeUndefined();
    expect(G.powers.FR.gwBudget).toBe(3);
  });

  test("a 6 without a shift direction still costs two CP", () => {
    const G = baseGw();
    G.powers.FR.gwBudget = 6;
    G.powers.FR.alliance = "neutral";
    playGwEvent(G, "IE-GW-07");
    resolvePending(G, ctxFor("GE"), "FR");
    expect(resolvePending(G, ctxFor("GE", [6]), "zero")).toBeUndefined();
    expect(G.powers.FR.gwBudget).toBe(4);
    expect(usAllianceBox(G)).toBe("neutral");
  });
});

// ---------------------------------------------------------------------------
// A093 Nicholas II
// ---------------------------------------------------------------------------
describe("A093 Nicholas II", () => {
  const godSaveTheTsar = (nicholas: boolean, roll: number): number => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "RU";
    if (nicholas) {
      G.powers.RU.hand.push("IE-A093");
      expect(playCard(G, makeCtx([3], seat("RU")), "IE-A093", "event")).toBeUndefined();
    }
    G.phase = "action";
    G.activePower = "RU";
    G.powers.RU.hand.push("IE-H-RU-10");
    const before = G.powers.RU.stability;
    expect(playCard(G, makeCtx([roll], seat("RU")), "IE-H-RU-10", "event")).toBeUndefined();
    return G.powers.RU.stability - before;
  };

  test("without Nicholas II the home card always grants stability", () => {
    expect(godSaveTheTsar(false, 1)).toBe(1);
  });

  test("with Nicholas II a 2 or less grants nothing and a 3+ does", () => {
    expect(godSaveTheTsar(true, 2)).toBe(0);
    expect(godSaveTheTsar(true, 3)).toBe(1);
    expect(godSaveTheTsar(true, 6)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// A106 The Young Turks
// ---------------------------------------------------------------------------
describe("A106 The Young Turks", () => {
  const youngTurks = (): ImperialElegyState => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "OT";
    G.powers.OT.hand.push("IE-A106");
    const before = G.powers.OT.manpower;
    expect(playCard(G, makeCtx([3], seat("OT")), "IE-A106", "event")).toBeUndefined();
    expect(G.powers.OT.manpower).toBe(before + 1);
    recomputeTracks(G);
    // The permanent +1 survives the track recomputation.
    expect(G.powers.OT.manpower).toBe(before + 1);
    return G;
  };

  test("grants an elite corps and permanent manpower", () => {
    const G = youngTurks();
    expect(G.persistent.otTwoElite).toBe(true);
    expect(G.persistent.otManpowerBonus).toBe(1);
    expect(
      Object.values(G.units).filter((unit) => unit.owner === "OT" && unit.kind === "eliteCorps"),
    ).toHaveLength(1);
  });

  test("the Ottomans may field two elite corps, not three", () => {
    const G = youngTurks();
    G.phase = "action";
    G.activePower = "OT";
    G.cpRemaining = 6;
    expect(recruit(G, ctxFor("OT"), "istanbul", "eliteCorps")).toBeUndefined();
    expect(recruit(G, ctxFor("OT"), "istanbul", "eliteCorps")).toBe("INVALID_MOVE");
    expect(
      Object.values(G.units).filter((unit) => unit.owner === "OT" && unit.kind === "eliteCorps"),
    ).toHaveLength(2);
  });

  test("other players are still limited to one elite corps", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "AU";
    G.cpRemaining = 6;
    // AU starts with a full army in Vienna and no elite corps.
    expect(recruit(G, ctxFor("AU"), "vienna", "eliteCorps")).toBeUndefined();
    expect(recruit(G, ctxFor("AU"), "vienna", "eliteCorps")).toBe("INVALID_MOVE");
  });
});
