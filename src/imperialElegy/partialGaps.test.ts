/**
 * Regression coverage for the IMPLEMENTATION_STATUS "partial" items closed in
 * the 2026-11-12 follow-up:
 *  - 13.5 truces block declarations and ally calls;
 *  - 14.3 initiative roll-off for remaining ties;
 *  - 7.3 / A110 manual reserve recruiting uses the shared allowance;
 *  - GE Imperial Germany +1 manpower survives the end-phase recomputation;
 *  - 30.0 GW key loss / recapture stability (RU Scorched Earth reachable);
 *  - GW #2 Major Power Entry, US entry and the US impulse (26.3 / 32.1).
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {GreatWarState, ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {beginLandBattle, finishBattle} from "./engine/combat";
import {placeUnit, removeUnit} from "./engine/effects";
import {landUnitsIn, navalUnitsIn, recomputeTracks} from "./engine/rules";
import {
  createWarState,
  hasTruce,
  initiativeOrder,
  initiativeRollOff,
  truceRivals,
} from "./engine/limitedWar";
import {applyGwKeyCapture} from "./engine/greatWar";
import {enterGwAlly, majorEntryOptions, usAllianceBox} from "./engine/greatWarFlow";
import {checkGermanUnification} from "./engine/victory";
import {SPACES, neighboursOf} from "./constant/spaces";
import {CARDS} from "./constant/cards.data";
import {reserveAllowance} from "./engine/economy";
import {
  callWarAlly,
  declareWar,
  gwPass,
  navalMove,
  playGwCardMove,
  recruit,
  resolveEnd,
  resolvePending,
  startWarManeuver,
} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
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

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const settledWar = (G: ImperialElegyState, attacker: Power, defender: Power, truceTurns: number): WarState => {
  const war = createWarState(G, attacker, defender, "conquest", ["bohemia"], 1);
  war.status = "done";
  war.victor = "attacker";
  war.truceTurns = truceTurns;
  return war;
};

const gwState = (overrides: Partial<GreatWarState> = {}): GreatWarState => ({
  active: true,
  turn: 1,
  order: ["GE", "RU"],
  belligerents: ["GE", "RU"],
  neutrals: ["UK", "FR", "AU", "OT"],
  te: ["RU"],
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
  combatCardsInFront: [],
  ...overrides,
});

const clearSpace = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...landUnitsIn(G, space), ...navalUnitsIn(G, space)]) removeUnit(G, unit.id);
};

// ---------------------------------------------------------------------------
// 13.5 Truces
// ---------------------------------------------------------------------------

describe("13.5 truces are enforced", () => {
  test("truceRivals lists the other side of a settled war until it counts down", () => {
    const G = fresh();
    const war = settledWar(G, "GE", "AU", 2);
    war.defenderAllies = ["RU"];
    G.wars = [war];

    expect(truceRivals(G, "GE").sort()).toEqual(["AU", "RU"]);
    expect(truceRivals(G, "RU")).toEqual(["GE"]);
    expect(hasTruce(G, "AU", "RU")).toBe(false);

    war.truceTurns = 0;
    expect(truceRivals(G, "GE")).toEqual([]);
  });

  test("declareWar cannot target a power under truce", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.cpRemaining = 4;
    G.wars = [settledWar(G, "GE", "AU", 1)];
    const ctx = makeCtx([3], seat("GE"));

    expect(declareWar(G, ctx, "AU", "conquest", ["bohemia"], 2)).toBe(INVALID_MOVE);
    expect(G.war).toBeNull();
    expect(G.cpRemaining).toBe(4);

    G.wars[0].truceTurns = 0;
    expect(declareWar(G, ctx, "AU", "conquest", ["bohemia"], 2)).toBeUndefined();
    expect(G.war?.defender).toBe("AU");
  });

  test("an ally cannot be called into a war against a truce partner", () => {
    const G = fresh();
    G.powers.GE.alliance = "taAligned";
    G.powers.AU.alliance = "taAligned";
    const joinCard = CARDS.actions.find((card) => card.type === "event")!.id;
    G.powers.AU.hand = [joinCard];
    G.war = createWarState(G, "GE", "FR", "conquest", ["alsace"], 2);
    G.war.status = "alliance";
    G.phase = "wartime";
    // AU and FR exchanged truces in an earlier war.
    G.wars = [settledWar(G, "FR", "AU", 2)];
    const ctx = makeCtx([3], seat("GE"));

    expect(callWarAlly(G, ctx, "AU")).toBe(INVALID_MOVE);
    expect(G.war.attackerAllies).toEqual([]);
    expect(G.powers.AU.hand).toEqual([joinCard]);

    G.wars[0].truceTurns = 0;
    expect(callWarAlly(G, ctx, "AU")).toBeUndefined();
    // Rule 14.0: the call opens a private consent decision for AU.
    expect(G.war.attackerAllies).toEqual([]);
    expect(G.pending?.kind).toBe("warAllyConsent");
    expect(resolvePending(G, makeCtx([], seat("AU")), "accept")).toBeUndefined();
    expect(G.war.attackerAllies).toEqual(["AU"]);
  });

  test("resolveEnd counts truces down", () => {
    const G = fresh();
    G.wars = [settledWar(G, "GE", "AU", 2)];
    resolveEnd(G, makeCtx([6]));
    expect(G.wars[0].truceTurns).toBe(1);
    expect(hasTruce(G, "GE", "AU")).toBe(true);
    resolveEnd(G, makeCtx([6]));
    expect(hasTruce(G, "GE", "AU")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 14.3 initiative roll-off
// ---------------------------------------------------------------------------

describe("14.3 initiative roll-off", () => {
  test("the comparator rerolls tied dice and is stable", () => {
    const rolls = [3, 3, 5, 2];
    let i = 0;
    const cmp = initiativeRollOff(() => rolls[i++]);
    // Dice are drawn b-then-a: UK rolls 3 then 5, FR rolls 3 then 2, so the
    // tied first roll is rerolled and UK wins.
    expect(cmp("FR", "UK")).toBeGreaterThan(0);
    // Memoised: the reverse comparison uses the same rolls, no new dice.
    expect(cmp("UK", "FR")).toBeLessThan(0);
    expect(i).toBe(4);
  });

  test("no die is rolled when card CP or industry already decide", () => {
    const G = fresh();
    G.war = createWarState(G, "FR", "UK", "conquest", ["alsace"], 3);
    G.powers.FR.industry = 4;
    G.powers.UK.industry = 3;
    let used = 0;
    const order = initiativeOrder(G, G.war, {
      cardCp: {FR: 2, UK: 2},
      tieBreak: initiativeRollOff(() => {
        used += 1;
        return 4;
      }),
    });
    expect(order).toEqual(["FR", "UK"]);
    expect(used).toBe(0);
  });

  test("startWarManeuver breaks a full tie with dice, not seat order", () => {
    const run = (dice: number[]): Power[] => {
      const G = fresh();
      G.war = createWarState(G, "FR", "UK", "conquest", ["alsace"], 2);
      G.war.status = "alliance";
      G.phase = "wartime";
      G.activePower = "FR";
      G.powers.FR.industry = 3;
      G.powers.UK.industry = 3;
      // Same 2-CP card and the same industry: only a roll-off separates them.
      G.war.budgets = {FR: 5, UK: 5};
      expect(startWarManeuver(G, makeCtx(dice, seat("FR")))).toBeUndefined();
      return G.war.initiative;
    };
    const first = run([6, 1]);
    const second = run([1, 6]);
    expect(new Set(first)).toEqual(new Set(["FR", "UK"]));
    expect(second).toEqual([...first].reverse());
  });
});

// ---------------------------------------------------------------------------
// 7.3 / A110 manual reserve recruiting
// ---------------------------------------------------------------------------

describe("recruit uses the shared reserve allowance", () => {
  test("A110 Extreme Militarism's bonus lets the recruit move exceed the base limit", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.cpRemaining = 4;
    const ctx = makeCtx([3], seat("GE"));
    const base = reserveAllowance(G, "GE");
    while (G.powers.GE.reserves.length < base) {
      const unit = placeUnit(G, "GE", "reserveArmy", null, 2);
      G.powers.GE.reserves.push(unit.id);
    }
    expect(recruit(G, ctx, "berlin", "reserveArmy")).toBe(INVALID_MOVE);

    G.powers.GE.flags.reserveLimitBonus = 1;
    expect(recruit(G, ctx, "berlin", "reserveArmy")).toBeUndefined();
    expect(G.powers.GE.reserves).toHaveLength(base + 1);
  });

  test("the limit is the lower of manpower and industry, not industry alone", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.cpRemaining = 4;
    G.powers.GE.industry = 6;
    G.powers.GE.manpower = 2;
    G.powers.GE.reserves = [];
    const ctx = makeCtx([3], seat("GE"));
    for (let i = 0; i < 2; i += 1) {
      const unit = placeUnit(G, "GE", "reserveArmy", null, 2);
      G.powers.GE.reserves.push(unit.id);
    }
    // The old check compared against industry (6) and would have allowed it.
    expect(recruit(G, ctx, "berlin", "reserveArmy")).toBe(INVALID_MOVE);
    expect(G.powers.GE.reserves).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// GE Imperial Germany
// ---------------------------------------------------------------------------

describe("Imperial Germany +1 manpower", () => {
  test("is granted at the next end phase and survives later recomputation", () => {
    const G = fresh();
    for (const def of Object.values(SPACES)) {
      if (def.flashpoints?.includes("germany")) G.spaces[def.id].control = "GE";
    }
    recomputeTracks(G);
    const base = G.powers.GE.manpower;

    expect(checkGermanUnification(G)).toBe(true);
    expect(G.powers.GE.manpower).toBe(base);
    expect(G.persistent.imperialGermany).toBe("pending");

    resolveEnd(G, makeCtx([6]));
    expect(G.persistent.imperialGermany).toBe("granted");
    expect(G.powers.GE.manpower).toBe(base + 1);

    recomputeTracks(G);
    expect(G.powers.GE.manpower).toBe(base + 1);
    resolveEnd(G, makeCtx([6]));
    expect(G.powers.GE.manpower).toBe(base + 1);
  });
});

// ---------------------------------------------------------------------------
// 30.0 GW key loss / recapture
// ---------------------------------------------------------------------------

const gwCapture = (G: ImperialElegyState, attacker: Power, from: string, to: string): void => {
  const ctx = makeCtx([3]);
  clearSpace(G, from);
  placeUnit(G, attacker, "army", from, 2);
  const battle = beginLandBattle(G, ctx, attacker, from, to);
  if (!battle) throw new Error("battle did not start");
  G.pending = null;
  battle.winner = "attacker";
  battle.attackerLosses = 0;
  battle.defenderLosses = 0;
  finishBattle(G, ctx);
};

describe("30.0 GW key loss and recapture", () => {
  test("RU Scorched Earth absorbs the first captured key, then keys cost stability", () => {
    const G = fresh();
    G.gw = gwState();
    G.war = null;
    G.powers.RU.stability = 4;
    G.powers.RU.scorchedEarth = true;
    clearSpace(G, "poland");
    clearSpace(G, "belorussia");
    placeUnit(G, "RU", "army", "poland", 2);
    gwCapture(G, "GE", "prussia", "poland");
    expect(G.spaces.poland.occupiedBy).toBe("GE");
    expect(G.powers.RU.stability).toBe(4);
    expect(G.powers.RU.scorchedEarth).toBe(false);
    expect(G.log.some((entry) => entry.key === "gwKeyLost")).toBe(true);

    placeUnit(G, "RU", "army", "belorussia", 2);
    gwCapture(G, "GE", "poland", "belorussia");
    expect(G.powers.RU.stability).toBe(3);
  });

  test("recapturing a key gives +1 and the driven-out occupier loses nothing", () => {
    const G = fresh();
    G.gw = gwState();
    G.powers.RU.stability = 2;
    G.powers.RU.scorchedEarth = false;
    G.powers.GE.stability = 4;
    G.spaces.poland.occupiedBy = "GE";
    clearSpace(G, "poland");
    placeUnit(G, "GE", "army", "poland", 2);
    gwCapture(G, "RU", "belorussia", "poland");
    expect(G.spaces.poland.occupiedBy).toBe("RU");
    expect(G.powers.RU.stability).toBe(3);
    expect(G.powers.GE.stability).toBe(4);
  });

  test("is inert outside the Great War and for non-key spaces", () => {
    const G = fresh();
    G.gw = null;
    G.powers.RU.stability = 4;
    expect(applyGwKeyCapture(G, "poland", "RU", "GE")).toEqual({loser: 0, captor: 0});
    G.gw = gwState();
    const territory = Object.values(SPACES).find((def) => def.home === "RU" && def.type === "territory")!;
    expect(applyGwKeyCapture(G, territory.id, "RU", "GE")).toEqual({loser: 0, captor: 0});
    expect(G.powers.RU.stability).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// GW #2 Major Power Entry / US in the GW
// ---------------------------------------------------------------------------

describe("GW #2 Major Power Entry and the US impulse", () => {
  const gwSetup = (): ImperialElegyState => {
    const G = fresh();
    G.gw = gwState({
      order: ["GE", "FR"],
      belligerents: ["GE", "FR"],
      neutrals: ["UK", "AU", "RU", "OT"],
      te: ["FR"],
      ta: ["GE"],
    });
    G.phase = "gwManeuver";
    G.activePower = "FR";
    G.turnIndex = 1;
    for (const power of POWERS) G.powers[power].gwBudget = 3;
    return G;
  };

  test("cannot be played on GW turn 0", () => {
    const G = gwSetup();
    G.gw!.turn = 0;
    G.powers.FR.gwCard = "IE-GW-02";
    expect(playGwCardMove(G, makeCtx([3], seat("FR")), "event")).toBe(INVALID_MOVE);
    expect(G.powers.FR.gwCard).toBe("IE-GW-02");
  });

  test("the US shifts one box per play and joins at the committed box", () => {
    const G = gwSetup();
    const ctx = makeCtx([3], seat("FR"));
    expect(majorEntryOptions(G, "FR")).toEqual(["US"]);

    G.powers.FR.gwCard = "IE-GW-02";
    expect(playGwCardMove(G, ctx, "event")).toBeUndefined();
    expect(G.pending?.options.map((o) => o.id)).toEqual(["US"]);
    expect(resolvePending(G, ctx, "US")).toBeUndefined();
    expect(usAllianceBox(G)).toBe("teAligned");
    expect(G.gw!.usIn).toBe(false);

    // Second play (card back in hand for the test).
    G.gw!.discard = [];
    G.powers.FR.gwCard = "IE-GW-02";
    expect(playGwCardMove(G, ctx, "event")).toBeUndefined();
    expect(resolvePending(G, ctx, "US")).toBeUndefined();
    expect(usAllianceBox(G)).toBe("teCommitted");
    expect(G.gw!.usIn).toBe(true);
    expect(G.flags.usSide).toBe("te");
    expect(G.gw!.order).toContain("US");
    expect(G.gw!.usBudget).toBe(1);
    expect(landUnitsIn(G, "the-south").filter((u) => u.owner === "US")).toHaveLength(3);
    expect(navalUnitsIn(G, "the-south").filter((u) => u.owner === "US")).toHaveLength(2);
  });

  test("Italy joins on 4–6 when unified", () => {
    const G = gwSetup();
    G.persistent.italyUnified = true;
    const ctx = makeCtx([5], seat("FR"));
    G.powers.FR.gwCard = "IE-GW-02";
    expect(playGwCardMove(G, ctx, "event")).toBeUndefined();
    expect(G.pending?.options.map((o) => o.id)).toEqual(["IT", "US"]);
    expect(resolvePending(G, ctx, "IT")).toBeUndefined();
    expect(G.gw!.italyIn).toBe(true);
    expect(G.flags.italySide).toBe("te");
  });

  test("is removed and replaced when neither major can join", () => {
    const G = gwSetup();
    G.gw!.usIn = true;
    G.flags.usSide = "te";
    const ctx = makeCtx([1], seat("FR"));
    G.powers.FR.gwCard = "IE-GW-02";
    expect(playGwCardMove(G, ctx, "event")).toBeUndefined();
    expect(G.removed).toContain("IE-GW-02");
    expect(G.gw!.discard ?? []).not.toContain("IE-GW-02");
    expect(G.powers.FR.gwCard).not.toBeNull();
    expect(G.powers.FR.gwCard).not.toBe("IE-GW-02");
  });

  test("an entered US takes its impulse after the players, on its own budget", () => {
    const G = gwSetup();
    const ctx = makeCtx([3], seat("FR"));
    expect(enterGwAlly(G, ctx, "US", "te").ok).toBe(true);
    G.gw!.usBudget = 2;
    G.powers.GE.flags.passedGw = true;
    const frBudget = G.powers.FR.gwBudget;

    expect(gwPass(G, ctx)).toBeUndefined();
    expect(G.phase).toBe("gwManeuver");
    expect(G.activePower).toBe("FR");
    expect(G.flags.gwAllyImpulse).toBe("US");

    const ship = navalUnitsIn(G, "the-south").find((u) => u.owner === "US")!;
    expect(navalMove(G, ctx, [ship.id], "north-atlantic")).toBeUndefined();
    expect(G.units[ship.id].space).toBe("north-atlantic");
    expect(G.gw!.usBudget).toBe(1);
    expect(G.powers.FR.gwBudget).toBe(frBudget);

    // FR's own units are not part of the US impulse's draft/refit actions.
    expect(gwPass(G, ctx)).toBeUndefined();
    expect(G.phase).toBe("gwWinter");
    expect(G.flags.gwAllyImpulse).toBe("");
  });

  test("US units are friendly to their side and hostile to the other", () => {
    const G = gwSetup();
    const ctx = makeCtx([3], seat("GE"));
    expect(enterGwAlly(G, ctx, "US", "te").ok).toBe(true);
    // Any land space with land neighbours will do: put a US army there.
    const target = Object.values(SPACES).find(
      (def) => def.submap === "main" && def.type !== "navalBox" && neighboursOf(def.id).filter((id) => SPACES[id]?.type !== "navalBox").length >= 2,
    )!.id;
    const [geFrom, frFrom] = neighboursOf(target).filter((id) => SPACES[id]?.type !== "navalBox");
    for (const id of [target, geFrom, frFrom]) clearSpace(G, id);
    G.spaces[target].fort = null;
    const us = placeUnit(G, "US", "usArmy", target, 2);
    placeUnit(G, "GE", "army", geFrom, 2);
    placeUnit(G, "FR", "army", frFrom, 2);
    // FR (TE) finds no enemy with the US army (TE); GE (TA) may attack it.
    expect(beginLandBattle(G, makeCtx([3], seat("FR")), "FR", frFrom, target)).toBeNull();
    const battle = beginLandBattle(G, ctx, "GE", geFrom, target);
    expect(battle?.mainDefense).toEqual([us.id]);
  });
});
