/**
 * 33.2.2 India.
 *
 * Covers the printed independence sequence: the marker flip, the
 * already-unstable trigger from Indian Nationalism, the GW displacement
 * exemption, the Indian Fort and one-army limit, and the permanent
 * "India cannot be controlled by any player" guard on every live path that
 * could place a control/influence/ally marker or count India as a key.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {GreatWarState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {applyIndiaIndependence, placeIndianFort, placeUnit, resolveEffects} from "./engine/effects";
import {applyWarEndCharacteristics, minorAlliance, pacify, placeInfluence, recruit} from "./moves";
import {
  canRecruitIn,
  cardDrawModifier,
  planIndiaIndependence,
  recruitmentLimits,
} from "./engine/characteristics";
import {recomputeTracks} from "./engine/rules";
import {colonialKeys} from "./engine/victory";

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

const special = (
  G: ImperialElegyState,
  ctx: Ctx,
  actor: Parameters<typeof resolveEffects>[2],
  handler: string,
): boolean => resolveEffects(G, ctx, actor, [{type: "special", handler}], {});

const activateGw = (G: ImperialElegyState): void => {
  const gw: GreatWarState = {
    active: true,
    turn: 1,
    order: ["GE", "UK"],
    belligerents: ["GE", "UK"],
    neutrals: [],
    te: ["UK"],
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
  };
  G.gw = gw;
};

const indianArmiesOf = (G: ImperialElegyState) =>
  Object.values(G.units).filter((unit) => unit.owner === "UK" && Boolean(unit.flags?.indian));

const makeIndianArmy = (G: ImperialElegyState, space: string) =>
  placeUnit(G, "UK", "army", space, 2, {flags: {indian: true}});

// ---------------------------------------------------------------------------
// Pure plan
// ---------------------------------------------------------------------------

describe("planIndiaIndependence (33.2.2)", () => {
  test("plans displacement, the one-army limit and the fort removal", () => {
    const G = fresh();
    G.spaces.india.fort = {power: "UK", level: 2, indian: true};
    const british = placeUnit(G, "UK", "army", "india", 2);
    const squadron = placeUnit(G, "UK", "squadron", "india", 2);
    const extraIndian = makeIndianArmy(G, "india");
    const rebel = placeUnit(G, "REBEL:Sepoy", "rebelArmy", "india", 2);

    const plan = planIndiaIndependence(G);

    expect(plan.displace).toBe(true);
    expect(plan.removeFort).toBe(true);
    // Land and naval units in India leave; a rebel with no friendly space goes.
    expect(plan.landDisplacements.map((entry) => entry.unitId)).toEqual(
      expect.arrayContaining([british.id, extraIndian.id]),
    );
    expect(plan.navalDisplacements).toEqual([{unitId: squadron.id, to: "indian-ocean"}]);
    expect(plan.eliminatedUnitIds).toEqual([rebel.id]);
    // The setup Indian army is kept; every additional Indian army is removed.
    expect(plan.keepIndianArmyId).toEqual(expect.any(String));
    expect(plan.eliminateIndianArmyIds).toEqual([extraIndian.id]);
  });

  test("skips displacement during the GW but still plans the army limit and fort", () => {
    const G = fresh();
    activateGw(G);
    const army = placeUnit(G, "UK", "army", "india", 2);
    const extraIndian = makeIndianArmy(G, "india");
    G.spaces.india.fort = {power: "UK", level: 1, indian: true};

    const plan = planIndiaIndependence(G);

    expect(plan.displace).toBe(false);
    expect(plan.landDisplacements).toEqual([]);
    expect(plan.eliminatedUnitIds).toEqual([]);
    expect(G.units[army.id].space).toBe("india");
    expect(plan.eliminateIndianArmyIds).toEqual([extraIndian.id]);
    expect(plan.removeFort).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The Indian Nationalism trigger
// ---------------------------------------------------------------------------

describe("Indian Nationalism (A077) trigger", () => {
  test("a stable marker simply flips to unstable", () => {
    const G = fresh();
    const before = indianArmiesOf(G).length;
    expect(G.powers.UK.indiaStable).toBe(true);

    expect(special(G, makeCtx(), "UK", "indianNationalism")).toBe(true);

    expect(G.powers.UK.indiaStable).toBe(false);
    expect(G.powers.UK.indiaIndependent).toBe(false);
    expect(G.spaces.india.control).toBe("UK");
    expect(indianArmiesOf(G)).toHaveLength(before);
  });

  test("an already-unstable marker triggers the full independence sequence", () => {
    const G = fresh();
    const ctx = makeCtx();
    G.powers.UK.indiaStable = false;
    placeIndianFort(G, "india");
    const extraIndian = makeIndianArmy(G, "london");
    const british = placeUnit(G, "UK", "army", "india", 2);
    const squadron = placeUnit(G, "UK", "squadron", "india", 2);
    const bengalBefore = G.spaces.bengal.units.length;
    const colonialBefore = G.powers.UK.colonialKeys;

    expect(special(G, ctx, "UK", "indianNationalism")).toBe(true);

    // Marker, fort, armies and control.
    expect(G.powers.UK.indiaIndependent).toBe(true);
    expect(G.powers.UK.indiaStable).toBe(false);
    expect(G.spaces.india.fort).toBeNull();
    expect(G.spaces.india.control).toBeNull();
    expect(G.spaces.india.influence).toBeNull();
    expect(G.spaces.india.diplomacy).toBeNull();
    expect(G.spaces.india.ally).toBeNull();
    expect(indianArmiesOf(G)).toHaveLength(1);
    expect(G.units[extraIndian.id]).toBeUndefined();

    // Units in India displaced (Bengal for the UK) or eliminated; nothing
    // remains in India at all.
    expect(G.spaces.india.units).toEqual([]);
    expect(G.units[british.id]?.space).toBe("bengal");
    expect(G.units[squadron.id]?.space).toBe("indian-ocean");
    expect(G.spaces.bengal.units.length).toBeGreaterThan(bengalBefore);

    // Crown Jewel stops counting and the stable card bonus is gone.
    expect(G.powers.UK.colonialKeys).toBe(colonialBefore - 2);
    expect(cardDrawModifier(G, "UK").india).toMatchObject({controlled: false, stable: false, delta: 0});
    expect(G.log.some((entry) => entry.key === "indiaIndependence")).toBe(true);
  });

  test("independence is idempotent and cannot be undone by the stable marker", () => {
    const G = fresh();
    const ctx = makeCtx();
    G.powers.UK.indiaStable = false;
    expect(applyIndiaIndependence(G)).toBe(true);
    expect(applyIndiaIndependence(G)).toBe(false);
    expect(G.powers.UK.indiaIndependent).toBe(true);

    G.powers.UK.indiaStable = true;
    expect(special(G, ctx, "UK", "sunNeverSets")).toBe(true);
    expect(G.powers.UK.indiaStable).toBe(false);
    expect(G.spaces.india.control).toBeNull();
    expect(G.spaces.india.fort).toBeNull();
    expect(placeIndianFort(G, "india")).toBe(false);
  });

  test("during the GW the units in India stay put but the other effects apply", () => {
    const G = fresh();
    activateGw(G);
    G.powers.UK.indiaStable = false;
    const army = placeUnit(G, "UK", "army", "india", 2);
    const extraIndian = makeIndianArmy(G, "india");
    G.spaces.india.fort = {power: "UK", level: 1, indian: true};

    expect(special(G, makeCtx(), "UK", "indianNationalism")).toBe(true);

    expect(G.powers.UK.indiaIndependent).toBe(true);
    expect(G.spaces.india.fort).toBeNull();
    expect(G.units[army.id]?.space).toBe("india");
    expect(G.units[extraIndian.id]).toBeUndefined();
    expect(indianArmiesOf(G)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Live guards after independence
// ---------------------------------------------------------------------------

describe("independent India is uncontrolled (33.2.2)", () => {
  const independent = (): ImperialElegyState => {
    const G = fresh();
    applyIndiaIndependence(G);
    return G;
  };

  test("no influence, diplomacy, alliance or pacification marker", () => {
    const G = independent();
    G.phase = "action";
    G.activePower = "UK";
    G.cpRemaining = 6;

    expect(placeInfluence(G, makeCtx([], seat("UK")), "india")).toBe(INVALID_MOVE);
    expect(pacify(G, makeCtx([], seat("UK")), "india")).toBe(INVALID_MOVE);
    expect(minorAlliance(G, makeCtx([], seat("UK")), "india")).toBe(INVALID_MOVE);
    expect(G.spaces.india.control).toBeNull();
    expect(G.spaces.india.influence).toBeNull();
    expect(G.spaces.india.ally).toBeNull();
  });

  test("no recruitment, no new Indian army and the cap is one", () => {
    const G = independent();
    G.phase = "action";
    G.activePower = "UK";
    G.cpRemaining = 6;
    G.powers.UK.secondaryManpower = 4;

    expect(recruitmentLimits(G, "UK").british?.indianArmyLimit).toBe(1);
    expect(canRecruitIn(G, "UK", "bengal", "army", {indian: true}).allowed).toBe(false);
    expect(recruit(G, makeCtx([], seat("UK")), "bengal", "army", 1, {indian: true})).toBe(INVALID_MOVE);
    expect(indianArmiesOf(G)).toHaveLength(1);
    expect(G.log.some((entry) => entry.key === "recruitRejected")).toBe(true);
  });

  test("India is not a key even if a legacy path writes a control marker", () => {
    const G = independent();
    const before = colonialKeys(G, "UK");
    G.spaces.india.control = "UK";
    recomputeTracks(G);
    expect(G.powers.UK.colonialKeys).toBe(before);
    expect(colonialKeys(G, "UK")).toBe(before);
    expect(G.powers.UK.indiaIndependent).toBe(true);
  });

  test("Bengal is a separate space and is unaffected", () => {
    const G = independent();
    G.spaces.bengal.fort = {power: "FR", level: 1};
    const army = placeUnit(G, "UK", "army", "bengal", 2);
    G.phase = "action";
    G.activePower = "UK";
    G.cpRemaining = 6;

    // Bengal remains UK-controlled, keeps its fort and its units.
    expect(G.spaces.bengal.control).toBe("UK");
    expect(G.spaces.bengal.fort).not.toBeNull();
    expect(G.units[army.id].space).toBe("bengal");
    // The Indian-specific ban does not leak to Bengal's own British path:
    // the only reason a British build is refused is Professional Army.
    expect(canRecruitIn(G, "UK", "bengal", "army").reasons.join(" ")).toMatch(/Professional Army/);
  });
});

// ---------------------------------------------------------------------------
// War conclusion shares the same flags but not the displacement test above
// ---------------------------------------------------------------------------

describe("applyWarEndCharacteristics keeps India untouched", () => {
  test("a non-UK war does not move Indian armies", () => {
    const G = fresh();
    const indian = makeIndianArmy(G, "london");
    G.war = {
      attacker: "GE",
      defender: "FR",
      attackerAllies: [],
      defenderAllies: [],
      attackerMinors: [],
      defenderMinors: [],
      warAim: "conquest",
      objectives: ["paris"],
      status: "done",
      budgets: {},
      initiative: [],
      treaties: [],
      victor: null,
      truceTurns: 0,
      passed: [],
      startedTurn: 1,
    };
    applyWarEndCharacteristics(G, makeCtx());
    expect(G.units[indian.id].space).toBe("london");
  });
});
