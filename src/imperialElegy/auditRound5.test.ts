/**
 * Fixes from the printed-rule audit round 5 (2026-11-27):
 *
 * - 13.3.1: a war of conquest cannot name a declared subcapital (AU's
 *   Hungary) as an objective even where the map types the space as a key.
 * - 3.2.8: armies can never enter naval bases; the march path refuses.
 * - 19.10: both armies must begin the impulse in the same naval box.
 * - 3.4.1(4): an Eastern Mediterranean landing must take the Dardanelles
 *   before Istanbul.
 * - 3.2.9 note: the Egyptian port hop to the Indian Ocean is a Suez crossing.
 * - 3.4.4: the Egyptian trio and Tripoli-Benghazi cascade on every control
 *   write, and the Suez domination follows the Egypt minor's ally.
 * - NG scoring: ranked European Keys is geographic, RU 41 counts only Balkan
 *   minor allies, OT 49 counts Egypt as a lost key from the start.
 * - NG-38: RU spends 3 CP to reveal Eastern Ambitions and take control of
 *   Manchuria or Korea.
 * - 19.6.1(2): ships arriving in a box whose only enemy presence is
 *   unescorted land units eliminate them.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power, SpaceId} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {amphibiousAssaultCheck, easternAmbitionsDecision, revealEasternAmbitions} from "./moves";
import {planMarch, planRail} from "./engine/wartimeMovement";
import {planNavalMove} from "./engine/navalMovement";
import {beginLandBattle, eliminateCaughtLandUnits} from "./engine/combat";
import {flashpointController, setSpaceControl} from "./engine/rules";
import {goalMetric} from "./engine/victory";
import {GOALS_BY_ID} from "./constant/goals";
import {
  createWarState,
  holdsWarImpulse,
  minorTruceRivals,
  minorWarInfo,
  recordWarKnockoutCapture,
} from "./engine/limitedWar";
import {validateWarAim} from "./engine/limitedWar";
import {displaceItalyForLoneDefense, deployItalianReserveForGoal} from "./engine/italyMilitary";
import {usSouthEntryRefusal} from "./engine/gwMajors";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {
      Die: (sides: number) => Math.min(sides, dice[Math.min(index++, dice.length - 1)] ?? 3),
      Shuffle: (items: unknown[]) => items,
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
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

describe("13.3.1 conquest objectives", () => {
  test("AU's declared subcapital Hungary cannot be a conquest objective", () => {
    const G = fresh();
    const check = validateWarAim(G, "GE", "AU", "conquest", ["hungary"], {});
    expect(check.ok).toBe(false);
    expect(check.issues.some((issue) => issue.code === "conquest-subcapital")).toBe(true);
  });

  test("a plain key still works as a conquest objective", () => {
    const G = fresh();
    const check = validateWarAim(G, "GE", "FR", "conquest", ["belgium"], {});
    expect(check.issues.some((issue) => issue.code === "conquest-subcapital")).toBe(false);
  });
});

describe("3.2.8 naval bases bar land units", () => {
  test("an army's march cannot enter Gibraltar", () => {
    const G = fresh();
    G.phase = "wartime";
    const army = placeUnit(G, "FR", "army", "tunisia", 2);
    const plan = planMarch(G, "FR", army.id, "algeria");
    expect(plan.ok).toBe(false);
    expect(plan.reason).toBe("naval-base");
  });
});

describe("19.10 the same-box origin rule", () => {
  test("armies standing in a friendly port are not loaded at assault time", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "UK";
    G.cpRemaining = 5;
    const army = placeUnit(G, "UK", "army", "london", 2);
    const check = amphibiousAssaultCheck(G, "UK", "london", "brittany", [army.id]);
    expect(check.reason).toBe("army-location");
  });

  test("an Eastern Mediterranean landing must take the Dardanelles before Istanbul", () => {
    const G = fresh();
    const a = placeUnit(G, "UK", "army", "pacific-ocean", 2);
    const b = placeUnit(G, "UK", "army", "pacific-ocean", 2);
    for (const unit of [a, b]) {
      G.spaces["pacific-ocean"].units = G.spaces["pacific-ocean"].units.filter((id) => id !== unit.id);
      G.spaces["eastern-mediterranean"].units.push(unit.id);
      unit.space = "eastern-mediterranean";
    }
    G.phase = "action";
    G.activePower = "UK";
    G.cpRemaining = 5;
    const check = amphibiousAssaultCheck(G, "UK", "eastern-mediterranean", "istanbul", [a.id, b.id]);
    expect(check.reason).toBe("dardanelles-first");
  });
});

describe("3.2.9 note the Egyptian Suez port hop", () => {
  test("a fleet cannot leave Egypt for the Indian Ocean while the canal is unbuilt", () => {
    const G = fresh();
    G.persistent.suezCanal = false;
    G.spaces.egypt.control = "UK";
    const plan = planNavalMove(G, "UK", "egypt", "indian-ocean");
    expect(plan.ok).toBe(false);
  });

  test("with the canal built the Egyptian port hop is open", () => {
    const G = fresh();
    G.persistent.suezCanal = true;
    G.spaces.egypt.control = "UK";
    const plan = planNavalMove(G, "UK", "egypt", "indian-ocean");
    expect(plan.ok).toBe(true);
  });
});

describe("3.4.4 control cascades", () => {
  test("ceding Egypt carries Sinai and the Great Sand Sea with it", () => {
    const G = fresh();
    setSpaceControl(G, "egypt", "UK");
    expect(G.spaces.sinai.control).toBe("UK");
    expect(G.spaces["great-sand-sea"].control).toBe("UK");
  });

  test("the Tripoli holder always controls Benghazi", () => {
    const G = fresh();
    setSpaceControl(G, "tripoli", "IT");
    expect(G.spaces.benghazi.control).toBe("IT");
  });

  test("Egypt-held-Egypt gives the Suez domination to the ally", () => {
    const G = fresh();
    G.persistent.suezCanal = true;
    G.spaces.egypt.ally = "UK";
    expect(flashpointController(G, "suez")).toEqual(["UK"]);
  });
});

describe("NG scoring", () => {
  test("the ranked European Keys metric counts keys in Europe only", () => {
    const G = fresh();
    const goal = GOALS_BY_ID["NG-01"];
    if (!goal) throw new Error("GE 1 not found");
    const before = goalMetric(G, "GE", goal);
    G.spaces.egypt.control = "GE";
    G.spaces.sinai.control = "GE";
    expect(goalMetric(G, "GE", goal)).toBe(before);
  });

  test("RU NG 41 counts only Balkan minor allies as control", () => {
    const G = fresh();
    G.spaces.romania.ally = "RU";
    G.spaces.belgium.ally = "RU";
    const goal = Object.values(GOALS_BY_ID).find((goal) => goal.number === 41 && goal.power === "RU");
    if (!goal) throw new Error("RU 41 not found");
    expect(goalMetric(G, "RU", goal)).toBe(0);
  });

  test("Death Grip counts Egypt as lost from the start", () => {
    const G = fresh();
    const goal = Object.values(GOALS_BY_ID).find((goal) => goal.number === 49 && goal.power === "OT");
    if (!goal) throw new Error("OT 49 not found");
    expect(goalMetric(G, "OT", goal)).toBe(0);
  });
});

describe("NG-38 Eastern Ambitions", () => {
  test("the special takes Manchuria or Korea for 3 CP, once", () => {
    const G = fresh();
    const ctx = makeCtx([], seat("RU"));
    G.phase = "action";
    G.activePower = "RU";
    G.cpRemaining = 5;
    G.powers.RU.goals = ["NG-38"];
    expect(easternAmbitionsDecision(G, "RU", "pacific-ocean").allowed).toBe(false);
    expect(revealEasternAmbitions(G, ctx, "manchuria")).toBeUndefined();
    expect(G.spaces.manchuria.control).toBe("RU");
    expect((G.revealedGoals ?? []).includes("NG-38")).toBe(true);
    expect(revealEasternAmbitions(G, ctx, "korea")).not.toBeUndefined();
  });
});

describe("19.6.1(2) caught land units", () => {
  test("ships arriving in a box eliminate unescorted enemy land units", () => {
    const G = fresh();
    const land = placeUnit(G, "UK", "army", "north-atlantic", 2);
    land.space = "north-atlantic";
    G.spaces["north-atlantic"].units.push(land.id);
    G.phase = "wartime";
    G.war = {
      attacker: "GE",
      defender: "UK",
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
      passed: [],
    };
    eliminateCaughtLandUnits(G, "north-atlantic", "GE");
    expect(G.units[land.id]).toBeUndefined();
  });
});

describe("15.6 the immediate limited-war knockout", () => {
  const emptyBoard = (G: ImperialElegyState): void => {
    G.units = {};
    for (const state of Object.values(G.spaces)) state.units = [];
  };

  test("a captured capital drops the ally, displaces its armies and bars its impulse", () => {
    const G = fresh();
    emptyBoard(G);
    const war = createWarState(G, "GE", "AU", "conquest", ["bohemia"], 2);
    G.war = war;
    war.defenderAllies = ["RU"];
    war.status = "maneuver";
    G.activePower = "RU";
    expect(holdsWarImpulse(G, "RU")).toBe(true);
    placeUnit(G, "RU", "army", "moscow", 2);
    placeUnit(G, "RU", "army", "kiev", 2);
    placeUnit(G, "RU", "army", "kharkov", 2);
    placeUnit(G, "GE", "army", "st-petersburg", 2);

    const record = recordWarKnockoutCapture(G, "st-petersburg", "GE");

    expect(record?.power).toBe("RU");
    expect(war.knockedOut?.some((entry) => entry.power === "RU")).toBe(true);
    expect(war.defenderAllies).not.toContain("RU");
    expect(holdsWarImpulse(G, "RU")).toBe(false);
    // All of RU's armies overstack in one unoccupied home (15.6).
    const spaces = new Set(
      Object.values(G.units).filter((unit) => unit.owner === "RU").map((unit) => unit.space),
    );
    expect([...spaces]).toHaveLength(1);
    // The first unoccupied home in space order (St. Petersburg holds the captor).
    const target = [...spaces][0] as SpaceId;
    expect(target).toBe("astrakhan");
    expect(G.spaces[target].units.length).toBe(3);
  });
});

describe("16.3 the unified-Italy truce", () => {
  test("a settled lone-Italy war truces the non-player itself", () => {
    const G = fresh();
    const settled = createWarState(G, "GE", "IT" as Power, "conquest", ["rome"], 2);
    settled.minorTarget = {minor: "Italy", ally: null};
    settled.truceTurns = 2;
    G.wars = [settled];
    G.spaces.rome.control = "IT";
    expect(minorTruceRivals(G, "GE")).toContain("Italy");
    const info = minorWarInfo(G, "GE", "Italy");
    expect(info.ok).toBe(false);
    expect(info.reason).toBe("truce");
  });

  test("a settled player-vs-player war grants no non-player truce", () => {
    const G = fresh();
    const settled = createWarState(G, "GE", "AU", "conquest", ["bohemia"], 2);
    settled.truceTurns = 2;
    G.wars = [settled];
    expect(minorTruceRivals(G, "GE")).toEqual([]);
  });
});

describe("22.4 the die between two spaces", () => {
  const emptyBoard = (G: ImperialElegyState): void => {
    G.units = {};
    for (const state of Object.values(G.spaces)) state.units = [];
  };

  const italyWar = (G: ImperialElegyState) => {
    const war = createWarState(G, "GE", "IT" as Power, "conquest", ["naples", "lombardy"], 2);
    war.minorTarget = {minor: "Italy", ally: null};
    G.persistent.italyUnified = true;
    // Unified Italy holds its goal spaces (22.4's displacement needs room there).
    G.spaces.naples.control = "IT";
    G.spaces.lombardy.control = "IT";
    return war;
  };

  test("the lone-defender displacement rolls between two open goals", () => {
    const G = fresh();
    emptyBoard(G);
    const war = italyWar(G);
    const a = placeUnit(G, "IT", "italianArmy", "tuscany", 2);
    const b = placeUnit(G, "IT", "italianArmy", "tuscany", 2);
    displaceItalyForLoneDefense(G, war, makeCtx([2]));
    expect(G.units[a.id].space).toBe("lombardy");
    expect(G.units[b.id].space).toBe("naples");
  });

  test("the reserve deploy rolls between two threatened goals", () => {
    const G = fresh();
    emptyBoard(G);
    const war = italyWar(G);
    G.spaces.naples.occupiedBy = "GE";
    G.spaces.lombardy.occupiedBy = "GE";
    const reserve = placeUnit(G, "IT", "italianArmy", null, 2);
    const result = deployItalianReserveForGoal(G, war, makeCtx([1]));
    expect(result?.to).toBe("naples");
    expect(G.units[reserve.id].space).toBe("naples");
  });
});

describe("15.2.5 rail skips severe connections", () => {
  test("rail cannot cross the Sudan-Egypt severe link that a march may use", () => {
    const G = fresh();
    G.spaces.egypt.control = "UK";
    G.spaces.sudan.control = "UK";
    const army = placeUnit(G, "UK", "army", "egypt", 2);
    expect(planRail(G, "UK", army.id, "sudan").reason).toBe("no-rail-path");
    expect(planMarch(G, "UK", army.id, "sudan").ok).toBe(true);
  });
});

describe("32.1 only the US enters the South", () => {
  const activeGw = (G: ImperialElegyState): void => {
    G.gw = {active: true, turn: 1, belligerents: ["GE", "UK"], order: ["GE", "UK"]} as ImperialElegyState["gw"];
  };

  test("the printed guard names the South for a non-US owner in the Great War", () => {
    const G = fresh();
    expect(usSouthEntryRefusal(G, "UK", "the-south")).toBeNull();
    activeGw(G);
    expect(usSouthEntryRefusal(G, "UK", "the-south")).not.toBeNull();
    expect(usSouthEntryRefusal(G, "US", "the-south")).toBeNull();
  });

  test("naval entries and amphibious assaults into the South are refused", () => {
    const G = fresh();
    activeGw(G);
    G.phase = "wartime";
    expect(planNavalMove(G, "UK", "north-atlantic", "the-south").reason).toBe("usSouth");
    const army = placeUnit(G, "UK", "army", "north-atlantic", 2);
    army.space = "north-atlantic";
    G.spaces["north-atlantic"].units.push(army.id);
    const check = amphibiousAssaultCheck(G, "UK", "north-atlantic", "the-south", [army.id]);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe("us-south");
  });

  test("pre-Great-War traffic into the South stays legal (the ACW squadrons)", () => {
    const G = fresh();
    expect(planNavalMove(G, "UK", "north-atlantic", "the-south").ok).toBe(true);
  });

  test("a land battle into the South finds no legal forces for a non-US attacker", () => {
    const G = fresh();
    activeGw(G);
    G.phase = "wartime";
    placeUnit(G, "UK", "army", "canada", 2);
    placeUnit(G, "US" as Power, "army", "the-south", 2);
    expect(beginLandBattle(G, makeCtx([]), "UK", "canada", "the-south")).toBeNull();
  });
});
