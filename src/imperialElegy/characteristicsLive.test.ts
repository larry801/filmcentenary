/**
 * 33.3 / 33.4 / 33.5 / 33.6 live characteristics.
 *
 * Covers the moves and engine hooks that were previously display-only:
 * AU A Compromise Needed, Reforms / Expand Citizenship / Incorporate,
 * Unstable Situation's discard-or-marker penalty, Continental Power's
 * pacification cost; FR's lost-war republic and Third Republic CP; RU's
 * Trans-Siberian rail move; OT's Jihad grant/use/discard and Europeanization.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {BattleState, GreatWarState, ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit, resolveEffects} from "./engine/effects";
import {landUnitsIn, recomputeTracks} from "./engine/rules";
import {changeStability} from "./engine/rules";
import {outbreakGreatWar} from "./engine/greatWar";
import {
  auAction,
  applyPrepCharacteristics,
  applyWarEndCharacteristics,
  industrialize,
  pacify,
  placeMpit,
  rebuildZouave,
  resolvePending,
  startWarManeuver,
  tsrrRailMove,
  useJihad,
} from "./moves";
import {pacificationCost, thirdRepublicCp} from "./engine/characteristics";
import {DUAL_MONARCHY_CARD} from "./engine/characteristics";

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

const startAction = (G: ImperialElegyState, power: Power, cp = 6): void => {
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = cp;
  G.pending = null;
};

const moveUnit = (G: ImperialElegyState, unitId: string, to: string): void => {
  const unit = G.units[unitId];
  if (unit.space) G.spaces[unit.space].units = G.spaces[unit.space].units.filter((id) => id !== unitId);
  G.spaces[to].units.push(unitId);
  unit.space = to;
};

const activateGw = (G: ImperialElegyState): void => {
  const gw: GreatWarState = {
    active: true,
    turn: 1,
    order: [],
    belligerents: [],
    neutrals: [],
    te: [],
    ta: [],
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
  };
  G.gw = gw;
};

const makeWar = (
  attacker: Power,
  defender: Power,
  overrides: Partial<WarState> = {},
): WarState => ({
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
  victor: "defender",
  truceTurns: 0,
  passed: [],
  startedTurn: 1,
  ...overrides,
});

const lastLog = (G: ImperialElegyState, key: string) =>
  [...G.log].reverse().find((entry) => entry.key === key);

const makeBattle = (overrides: Partial<BattleState> = {}): BattleState => ({
  kind: "land",
  attacker: "OT",
  defender: "RU",
  from: "istanbul",
  to: "ankara",
  mainAttack: [],
  mainDefense: [],
  supportAttack: [],
  supportDefense: [],
  stage: "roll",
  supportSide: "attacker",
  attackerDrm: 0,
  defenderDrm: 0,
  attackerLosses: 0,
  defenderLosses: 0,
  decisive: false,
  notes: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// 33.4 A Compromise Needed
// ---------------------------------------------------------------------------

describe("A Compromise Needed (33.4)", () => {
  test("turn-2 prep adds The Dual Monarchy when it was not played on turn 1", () => {
    const G = fresh();
    G.turn = 2;
    G.phase = "end";
    G.powers.AU.hand = [];
    for (const power of POWERS) G.powers[power].flags.endDone = true;
    G.flags.turnEnded = 1;

    expect(applyPrepCharacteristics(G)).toBeUndefined();
    expect(G.powers.AU.hand).toEqual([DUAL_MONARCHY_CARD]);
    expect(lastLog(G, "dualMonarchyAdded")?.args).toMatchObject({card: DUAL_MONARCHY_CARD});

    // Running the same window again never duplicates the card.
    applyPrepCharacteristics(G);
    expect(G.powers.AU.hand.filter((id) => id === DUAL_MONARCHY_CARD)).toHaveLength(1);
  });

  test("negative: no card when it was played for its event or is already in hand", () => {
    const G = fresh();
    G.turn = 2;
    G.phase = "end";
    G.powers.AU.hand = [];
    G.persistent.dualMonarchyPlayed = true;
    applyPrepCharacteristics(G);
    expect(G.powers.AU.hand).not.toContain(DUAL_MONARCHY_CARD);

    delete G.persistent.dualMonarchyPlayed;
    G.powers.AU.hand = [DUAL_MONARCHY_CARD];
    applyPrepCharacteristics(G);
    expect(G.powers.AU.hand).toHaveLength(1);
  });

  test("negative: the window is the turn-2 prep phase only", () => {
    const G = fresh();
    G.turn = 3;
    G.phase = "end";
    G.powers.AU.hand = [];
    applyPrepCharacteristics(G);
    expect(G.powers.AU.hand).not.toContain(DUAL_MONARCHY_CARD);
  });

  test("the card's event grants Hungarians citizenship and its rights benefits", () => {
    const G = fresh();
    const ctx = makeCtx();
    expect(G.powers.AU.citizenship).toEqual([]);
    expect(G.powers.AU.rights).toEqual([]);

    expect(resolveEffects(G, ctx, "AU", [{type: "special", handler: "dualMonarchy"}], {})).toBe(true);
    expect(G.powers.AU.citizenship).toContain("Hungarians");
    // 33.4.1: "a nationality retains the benefits of having rights when it has
    // full citizenship", so the rights track records it as well.
    expect(G.powers.AU.rights).toContain("Hungarians");

    // Re-applying the card effect cannot duplicate either entry.
    resolveEffects(G, ctx, "AU", [{type: "special", handler: "dualMonarchy"}], {});
    expect(G.powers.AU.citizenship.filter((n) => n === "Hungarians")).toHaveLength(1);
    expect(G.powers.AU.rights.filter((n) => n === "Hungarians")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 33.4.1 Reforms / Expand Citizenship / Incorporate
// ---------------------------------------------------------------------------

describe("AU special actions (33.4)", () => {
  test("Reforms grants rights for 3 CP and records the nationality", () => {
    const G = fresh();
    startAction(G, "AU", 4);
    expect(auAction(G, makeCtx([], seat("AU")), "reforms", "Czechs")).toBeUndefined();
    expect(G.powers.AU.rights).toContain("Czechs");
    expect(G.cpRemaining).toBe(1);
    expect(lastLog(G, "auRightsGranted")?.args).toMatchObject({nationality: "Czechs"});
  });

  test("Reforms rejects an unknown nationality, an existing right, and a short impulse", () => {
    const G = fresh();
    startAction(G, "AU", 4);
    const ctx = makeCtx([], seat("AU"));
    expect(auAction(G, ctx, "reforms", "Germans")).toBe(INVALID_MOVE);
    expect(lastLog(G, "auActionRejected")?.args?.reasons).toMatch(/eight AU nationalities/);

    G.powers.AU.rights = ["Czechs"];
    expect(auAction(G, ctx, "reforms", "Czechs")).toBe(INVALID_MOVE);

    G.powers.AU.rights = [];
    startAction(G, "AU", 2);
    expect(auAction(G, ctx, "reforms", "Poles")).toBe(INVALID_MOVE);
    expect(G.powers.AU.rights).not.toContain("Poles");
  });

  test("Expand Citizenship succeeds on the printed 3+ and grants full citizenship", () => {
    const G = fresh();
    startAction(G, "AU", 4);
    G.powers.AU.rights = ["Hungarians"];
    G.powers.AU.citizenship = [];
    expect(auAction(G, makeCtx([3], seat("AU")), "expandCitizenship", "Hungarians")).toBeUndefined();
    expect(G.powers.AU.citizenship).toContain("Hungarians");
    expect(G.cpRemaining).toBe(1);
    expect(lastLog(G, "auCitizenshipRoll")?.args).toMatchObject({roll: 3, needed: 3, success: true});
  });

  test("Expand Citizenship fails below the difficulty and spends the CP anyway", () => {
    const G = fresh();
    startAction(G, "AU", 4);
    G.powers.AU.rights = ["Hungarians"];
    G.powers.AU.citizenship = ["Italians", "Czechs"];
    expect(auAction(G, makeCtx([4], seat("AU")), "expandCitizenship", "Hungarians")).toBeUndefined();
    expect(G.powers.AU.citizenship).not.toContain("Hungarians");
    expect(G.cpRemaining).toBe(1);
    expect(lastLog(G, "auCitizenshipRoll")?.args).toMatchObject({roll: 4, needed: 5, success: false});
  });

  test("the optional stability sacrifice lowers the difficulty by 2", () => {
    const G = fresh();
    startAction(G, "AU", 4);
    G.powers.AU.rights = ["Hungarians"];
    G.powers.AU.citizenship = ["Italians", "Czechs"];
    G.powers.AU.hand = [];
    // Die 1: Unstable Situation (rights 1 -> 2, fails).  Die 3: citizenship.
    const ctx = makeCtx([1, 3], seat("AU"));
    expect(auAction(G, ctx, "expandCitizenship", "Hungarians", true)).toBeUndefined();
    expect(G.powers.AU.citizenship).toContain("Hungarians");
    expect(G.powers.AU.stability).toBe(2);
    expect(lastLog(G, "auCitizenshipRoll")?.args).toMatchObject({needed: 3, stabilitySpent: true});
  });

  test("negative: Expand Citizenship needs rights and cannot grant a second time", () => {
    const G = fresh();
    startAction(G, "AU", 4);
    const ctx = makeCtx([3], seat("AU"));
    expect(auAction(G, ctx, "expandCitizenship", "Hungarians")).toBe(INVALID_MOVE);

    G.powers.AU.rights = ["Hungarians"];
    G.powers.AU.citizenship = ["Hungarians"];
    expect(auAction(G, ctx, "expandCitizenship", "Hungarians")).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(4);
  });

  test("Incorporate takes control of an allied minor with a citizen nationality", () => {
    const G = fresh();
    startAction(G, "AU", 4);
    G.spaces.tuscany.ally = "AU";
    G.powers.AU.citizenship = ["Italians"];
    placeUnit(G, "Tuscany", "minorArmy", "tuscany", 2);
    expect(auAction(G, makeCtx([], seat("AU")), "incorporate", "tuscany")).toBeUndefined();
    expect(G.spaces.tuscany.control).toBe("AU");
    expect(G.spaces.tuscany.homeOverride).toBe("AU");
    expect(G.spaces.tuscany.ally).toBeNull();
    expect(Object.values(G.units).some((u) => u.owner === "Tuscany")).toBe(false);
    expect(G.cpRemaining).toBe(1);
    expect(lastLog(G, "auIncorporated")?.args).toMatchObject({space: "tuscany", nationality: "Italians"});
  });

  test("negative: Incorporate needs the alliance and a citizen nationality", () => {
    const G = fresh();
    startAction(G, "AU", 4);
    const ctx = makeCtx([], seat("AU"));
    G.powers.AU.citizenship = ["Italians"];
    expect(auAction(G, ctx, "incorporate", "tuscany")).toBe(INVALID_MOVE);
    G.spaces.tuscany.ally = "AU";
    G.powers.AU.citizenship = [];
    expect(auAction(G, ctx, "incorporate", "tuscany")).toBe(INVALID_MOVE);
    expect(G.spaces.tuscany.control).toBe("Tuscany");
  });
});

// ---------------------------------------------------------------------------
// 33.4 Unstable Situation
// ---------------------------------------------------------------------------

describe("Unstable Situation (33.4)", () => {
  test("a failed roll discards a random card", () => {
    const G = fresh();
    G.powers.AU.stability = 3;
    G.powers.AU.rights = [];
    G.powers.AU.hand = ["IE-A018", "IE-A019"];
    // Die 1: stability roll.  The discard is a separate private choice.
    changeStability(G, "AU", -1, makeCtx([1]));
    expect(G.pending?.kind).toBe("auUnstable");
    // Die 1: random hand index.
    expect(resolvePending(G, makeCtx([1], "3"), "discard")).toBeUndefined();
    expect(G.powers.AU.stability).toBe(2);
    expect(G.powers.AU.hand).toEqual(["IE-A019"]);
    expect(G.discard).toContain("IE-A018");
    expect(lastLog(G, "auUnstable")?.args).toMatchObject({discarded: "IE-A018", marker: false});
  });

  test("a failed roll with cards still lets AU choose the -1 marker", () => {
    const G = fresh();
    G.powers.AU.stability = 3;
    G.powers.AU.hand = ["IE-A018"];
    const markers = G.powers.AU.cardMarkers;
    changeStability(G, "AU", -1, makeCtx([1]));
    expect(G.pending?.kind).toBe("auUnstable");
    expect(G.pending?.options.map((o) => o.id)).toEqual(["discard", "marker"]);
    expect(resolvePending(G, makeCtx([1], "3"), "marker")).toBeUndefined();
    expect(G.powers.AU.hand).toEqual(["IE-A018"]);
    expect(G.powers.AU.cardMarkers).toBe(markers - 1);
    expect(lastLog(G, "auUnstable")?.args).toMatchObject({discarded: null, marker: true});
  });

  test("with no card to discard AU takes the -1 card marker", () => {
    const G = fresh();
    G.powers.AU.stability = 3;
    G.powers.AU.hand = [];
    const markers = G.powers.AU.cardMarkers;
    changeStability(G, "AU", -1, makeCtx([1]));
    expect(G.powers.AU.cardMarkers).toBe(markers - 1);
    expect(lastLog(G, "auUnstable")?.args).toMatchObject({discarded: null, marker: true});
  });

  test("rights add their DRM: a 5 passes with two rights but fails alone", () => {
    const alone = fresh();
    alone.powers.AU.stability = 3;
    alone.powers.AU.rights = [];
    alone.powers.AU.hand = ["IE-A018"];
    changeStability(alone, "AU", -1, makeCtx([5]));
    expect(alone.pending?.kind).toBe("auUnstable");
    expect(resolvePending(alone, makeCtx([1], "3"), "discard")).toBeUndefined();
    expect(alone.powers.AU.hand).toHaveLength(0);

    const withRights = fresh();
    withRights.powers.AU.stability = 3;
    withRights.powers.AU.rights = ["Hungarians", "Czechs"];
    withRights.powers.AU.hand = ["IE-A018"];
    changeStability(withRights, "AU", -1, makeCtx([4]));
    expect(withRights.powers.AU.hand).toEqual(["IE-A018"]);
  });

  test("negative: inert during the Great War", () => {
    const G = fresh();
    activateGw(G);
    G.powers.AU.stability = 3;
    G.powers.AU.hand = ["IE-A018"];
    changeStability(G, "AU", -1, makeCtx([1, 1]));
    expect(G.powers.AU.hand).toEqual(["IE-A018"]);
    expect(G.log.some((entry) => entry.key === "auUnstable")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 33.1 / 33.4 pacification cost
// ---------------------------------------------------------------------------

describe("pacification cost (33.1 / 33.4)", () => {
  test("Continental Power charges AU 2 CP", () => {
    const G = fresh();
    startAction(G, "AU", 4);
    G.spaces["bosnia-herzegovina"].influence = "AU";
    G.powers.AU.flags["pacified_bosnia-herzegovina"] = false;
    expect(pacify(G, makeCtx([4, 4], seat("AU")), "bosnia-herzegovina")).toBeUndefined();
    expect(G.cpRemaining).toBe(2);
    expect(lastLog(G, "pacificationFailed")?.args).toMatchObject({cost: 2});
  });

  test("Continental Focus charges GE 2 CP until unification and 1 afterwards", () => {
    const G = fresh();
    expect(pacificationCost(G, "GE")).toMatchObject({cost: 2, sources: ["continentalFocus"]});
    G.powers.GE.unified = true;
    expect(pacificationCost(G, "GE").cost).toBe(1);
    expect(pacificationCost(G, "FR").cost).toBe(1);
    expect(pacificationCost(G, "AU").cost).toBe(2);

    const live = fresh();
    startAction(live, "GE", 4);
    live.spaces["bosnia-herzegovina"].influence = "GE";
    expect(pacify(live, makeCtx([4, 4], seat("GE")), "bosnia-herzegovina")).toBeUndefined();
    expect(live.cpRemaining).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 33.3 FR lost war / Third Republic
// ---------------------------------------------------------------------------

describe("FR government (33.3)", () => {
  test("losing a war switches the Second Empire to the Third Republic", () => {
    const G = fresh();
    G.powers.FR.stability = 5;
    G.war = makeWar("FR", "GE", {victor: "defender"});
    applyWarEndCharacteristics(G, makeCtx());
    expect(G.powers.FR.government).toBe("thirdRepublic");
    expect(G.powers.FR.stability).toBe(5);
    expect(lastLog(G, "frThirdRepublic")?.power).toBe("FR");
  });

  test("winning, white peace and the GW do not switch the government", () => {
    const won = fresh();
    won.war = makeWar("FR", "GE", {victor: "attacker"});
    applyWarEndCharacteristics(won, makeCtx());
    expect(won.powers.FR.government).toBe("secondEmpire");

    const white = fresh();
    white.war = makeWar("FR", "GE", {victor: null});
    applyWarEndCharacteristics(white, makeCtx());
    expect(white.powers.FR.government).toBe("secondEmpire");

    const gw = fresh();
    activateGw(gw);
    gw.war = makeWar("FR", "GE", {victor: "defender"});
    applyWarEndCharacteristics(gw, makeCtx());
    expect(gw.powers.FR.government).toBe("secondEmpire");
  });

  test("the Third Republic gains 2 free alliance CP at the war maneuver step", () => {
    const G = fresh();
    G.powers.FR.government = "thirdRepublic";
    G.phase = "wartime";
    G.activePower = "FR";
    G.war = makeWar("FR", "GE", {status: "alliance", budgets: {FR: 0, GE: 0}});
    expect(startWarManeuver(G, makeCtx([3], seat("FR")))).toBeUndefined();
    expect(G.flags.frAllianceCp).toBe(2);
    expect(G.flags.frAllianceCpTurn).toBe(G.turn);
    expect(lastLog(G, "thirdRepublicCp")?.args).toMatchObject({cp: 2});

    // The free CP is spendable on the influence track without touching the budget.
    const before = G.powers.GE.mpit.te;
    expect(placeMpit(G, makeCtx([], seat("FR")), "GE", "te")).toBeUndefined();
    expect(G.powers.GE.mpit.te).toBe(before + 1);
    expect(G.flags.frAllianceCp).toBe(1);
    expect(lastLog(G, "mpitPlaced")?.args).toMatchObject({free: true});
    expect(G.war?.budgets.FR).toBe(0);
  });

  test("negative: the grant is once per turn and needs the Third Republic", () => {
    const G = fresh();
    G.powers.FR.government = "secondEmpire";
    expect(thirdRepublicCp(G).applies).toBe(false);
    G.powers.FR.government = "thirdRepublic";
    G.flags.frAllianceCpTurn = G.turn;
    expect(thirdRepublicCp(G).applies).toBe(false);
    G.flags.frAllianceCpTurn = G.turn - 1;
    expect(thirdRepublicCp(G).applies).toBe(true);
  });

  test("the Zouaves rebuild in Algeria for 1 CP, once", () => {
    const G = fresh();
    startAction(G, "FR", 4);
    const zouave = Object.values(G.units).find((u) => u.kind === "zouave")!;
    removeUnit(G, zouave.id);
    expect(rebuildZouave(G, makeCtx([], seat("FR")))).toBeUndefined();
    expect(landUnitsIn(G, "algeria").some((u) => u.kind === "zouave")).toBe(true);
    expect(G.cpRemaining).toBe(3);
    expect(lastLog(G, "zouaveRebuilt")?.args).toMatchObject({space: "algeria", free: false});

    expect(rebuildZouave(G, makeCtx([], seat("FR")))).toBe(INVALID_MOVE);
    expect(lastLog(G, "zouaveRebuildRejected")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 33.5 Trans-Siberian Railroad
// ---------------------------------------------------------------------------

describe("Trans-Siberian Railroad rail move (33.5)", () => {
  const russianArmy = (G: ImperialElegyState): string => {
    const army = Object.values(G.units).find((u) => u.owner === "RU" && u.kind === "army")!;
    moveUnit(G, army.id, "moscow");
    return army.id;
  };

  test("RU rails one army along the line for free, once per impulse", () => {
    const G = fresh();
    G.powers.RU.tsrr = true;
    const unitId = russianArmy(G);
    startAction(G, "RU", 0);
    expect(tsrrRailMove(G, makeCtx([], seat("RU")), unitId, "urals")).toBeUndefined();
    expect(G.units[unitId].space).toBe("urals");
    expect(G.cpRemaining).toBe(0);
    expect(lastLog(G, "tsrrRail")?.args).toMatchObject({from: "moscow", to: "urals"});

    expect(tsrrRailMove(G, makeCtx([], seat("RU")), unitId, "moscow")).toBe(INVALID_MOVE);
    expect(lastLog(G, "tsrrRailRejected")?.args?.reasons).toMatch(/already used this impulse/);
  });

  test("negative: needs a completed TSRR and a route destination", () => {
    const noLine = fresh();
    const unitId = russianArmy(noLine);
    startAction(noLine, "RU", 0);
    expect(tsrrRailMove(noLine, makeCtx([], seat("RU")), unitId, "urals")).toBe(INVALID_MOVE);
    expect(lastLog(noLine, "tsrrRailRejected")?.args?.reasons).toMatch(/not complete/);

    const offRoute = fresh();
    offRoute.powers.RU.tsrr = true;
    const offId = russianArmy(offRoute);
    startAction(offRoute, "RU", 0);
    expect(tsrrRailMove(offRoute, makeCtx([], seat("RU")), offId, "riga")).toBe(INVALID_MOVE);
    expect(lastLog(offRoute, "tsrrRailRejected")?.args?.reasons).toMatch(/on the Trans-Siberian/);
  });

  test("negative: a non-RU power cannot use the line in peacetime", () => {
    const G = fresh();
    G.powers.RU.tsrr = true;
    const french = Object.values(G.units).find((u) => u.owner === "FR" && u.kind === "army")!;
    moveUnit(G, french.id, "moscow");
    startAction(G, "FR", 0);
    expect(tsrrRailMove(G, makeCtx([], seat("FR")), french.id, "urals")).toBe(INVALID_MOVE);
    expect(lastLog(G, "tsrrRailRejected")?.args?.reasons).toMatch(/allies during wartime/);
  });

  test("a RU ally may rail during wartime", () => {
    const G = fresh();
    G.powers.RU.tsrr = true;
    const french = Object.values(G.units).find((u) => u.owner === "FR" && u.kind === "army")!;
    moveUnit(G, french.id, "moscow");
    G.phase = "wartime";
    G.activePower = "FR";
    G.war = makeWar("RU", "OT", {attackerAllies: ["FR"], status: "maneuver"});
    expect(tsrrRailMove(G, makeCtx([], seat("FR")), french.id, "urals")).toBeUndefined();
    expect(G.units[french.id].space).toBe("urals");
  });
});

// ---------------------------------------------------------------------------
// 33.6 Jihad
// ---------------------------------------------------------------------------

describe("Jihad (33.6)", () => {
  test("the Ottomans gain 3 markers at the GW outbreak", () => {
    const G = fresh();
    G.powers.OT.jihad = 0;
    outbreakGreatWar(G, makeCtx([3]), "GE", "incident");
    expect(G.gw?.active).toBe(true);
    expect(G.powers.OT.jihad).toBe(3);
    expect(lastLog(G, "jihadMarkersGained")?.args).toMatchObject({markers: 3, total: 3});
  });

  test("a marker gives the opponent -1 before the dice, once per battle", () => {
    const G = fresh();
    G.powers.OT.jihad = 2;
    const battle = makeBattle();
    G.battle = battle;
    expect(useJihad(G, makeCtx([], seat("OT")))).toBeUndefined();
    expect(G.powers.OT.jihad).toBe(1);
    expect(battle.defenderDrm).toBe(-1);
    expect(battle.jihadUsed).toBe(true);
    expect(lastLog(G, "jihadUsed")?.args).toMatchObject({opponent: "RU", markers: 1});

    expect(useJihad(G, makeCtx([], seat("OT")))).toBe(INVALID_MOVE);
    expect(battle.defenderDrm).toBe(-1);
  });

  test("negative: no marker, a non-qualifying battle, or dice already rolled", () => {
    const noMarker = fresh();
    noMarker.powers.OT.jihad = 0;
    noMarker.battle = makeBattle();
    expect(useJihad(noMarker, makeCtx([], seat("OT")))).toBe(INVALID_MOVE);

    const offMap = fresh();
    offMap.powers.OT.jihad = 2;
    offMap.battle = makeBattle({from: "berlin", to: "saxony", defender: "GE"});
    expect(useJihad(offMap, makeCtx([], seat("OT")))).toBe(INVALID_MOVE);

    const rolled = fresh();
    rolled.powers.OT.jihad = 2;
    rolled.battle = makeBattle({attackerRoll: 4, defenderRoll: 2});
    expect(useJihad(rolled, makeCtx([], seat("OT")))).toBe(INVALID_MOVE);
    expect(rolled.powers.OT.jihad).toBe(2);
  });

  test("all Jihad markers are discarded at the end of a war", () => {
    const G = fresh();
    G.powers.OT.jihad = 2;
    G.war = makeWar("OT", "GE", {victor: "attacker"});
    applyWarEndCharacteristics(G, makeCtx());
    expect(G.powers.OT.jihad).toBe(0);
    expect(lastLog(G, "jihadDiscarded")?.args).toMatchObject({markers: 2});
  });
});

// ---------------------------------------------------------------------------
// 33.6 Europeanization
// ---------------------------------------------------------------------------

describe("Europeanization (33.6)", () => {
  test("the Ottomans may not play one of their own cards to industrialize", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "OT";
    G.cpRemaining = 0;
    // A printed event card is a legal industrialization card for anyone but OT.
    const card = "IE-A020";
    G.powers.OT.hand = [card, ...G.powers.OT.hand];
    expect(industrialize(G, makeCtx([], seat("OT")), card)).toBe(INVALID_MOVE);
    expect(G.powers.OT.hand).toContain(card);
    expect(G.powers.OT.industryCard).toBeNull();
    expect(lastLog(G, "industrializeRejected")?.args?.reasons).toMatch(/own card/);
  });
});

// ---------------------------------------------------------------------------
// 33.5 The Second Rome
// ---------------------------------------------------------------------------

describe("The Second Rome (33.5)", () => {
  test("a won war with Istanbul occupied hands the space to Russia", () => {
    const G = fresh();
    G.spaces.istanbul.occupiedBy = "RU";
    G.war = makeWar("RU", "OT", {victor: "attacker"});
    applyWarEndCharacteristics(G, makeCtx());
    expect(G.spaces.istanbul.control).toBe("RU");
    expect(G.spaces.istanbul.occupiedBy).toBeNull();
    expect(G.persistent.otCapital).toBe("ankara");
    expect(lastLog(G, "secondRome")?.args).toMatchObject({space: "istanbul"});
  });

  test("negative: an unoccupied Istanbul or a losing war leaves the space alone", () => {
    const unoccupied = fresh();
    unoccupied.war = makeWar("RU", "OT", {victor: "attacker"});
    applyWarEndCharacteristics(unoccupied, makeCtx());
    expect(unoccupied.spaces.istanbul.control).toBe("OT");

    const lost = fresh();
    lost.spaces.istanbul.occupiedBy = "RU";
    lost.war = makeWar("RU", "OT", {victor: "defender"});
    applyWarEndCharacteristics(lost, makeCtx());
    expect(lost.spaces.istanbul.control).toBe("OT");
  });

  test("controlling Istanbul at the start of the GW scores 2 VPs", () => {
    const withIstanbul = fresh();
    for (const power of POWERS) {
      withIstanbul.powers[power].goals = [];
      withIstanbul.powers[power].vp = 0;
    }
    withIstanbul.spaces.istanbul.control = "RU";
    outbreakGreatWar(withIstanbul, makeCtx([3]), "GE", "incident");
    expect(withIstanbul.powers.RU.vp).toBe(2);
    expect(lastLog(withIstanbul, "secondRomeVp")?.args).toMatchObject({vp: 2});

    // Negative: an Istanbul still under Ottoman control pays nothing.
    const without = fresh();
    for (const power of POWERS) {
      without.powers[power].goals = [];
      without.powers[power].vp = 0;
    }
    outbreakGreatWar(without, makeCtx([3]), "GE", "incident");
    expect(without.powers.RU.vp).toBe(0);
    expect(without.log.some((entry) => entry.key === "secondRomeVp")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 33.6 Local Autonomy
// ---------------------------------------------------------------------------

describe("Local Autonomy (33.6)", () => {
  test("Egyptian keys count as Arab keys and raise the Arab manpower track", () => {
    const G = fresh();
    // Egypt is an independent minor at setup; OT control makes it an Arab key.
    G.spaces.egypt.control = "OT";
    recomputeTracks(G);
    expect(G.powers.OT.arabKeys).toBe(6);
    expect(G.powers.OT.secondaryManpower).toBe(2);
    // 33.6: with Egypt under OT control the land route Egypt - Great Sand Sea -
    // Benghazi - Tripoli exists, so Tripoli and Tunisia now count as keys too.
    expect(G.powers.OT.territorialKeys).toBe(10);
  });

  test("Tunisia and Tripoli do not count without a land line of communication", () => {
    const G = fresh();
    G.spaces.tunisia.control = "OT";
    G.spaces.tripoli.control = "OT";
    recomputeTracks(G);
    // No land LoC from an OT home key reaches either space in this setup.
    expect(G.powers.OT.territorialKeys).toBe(8);
  });
});
