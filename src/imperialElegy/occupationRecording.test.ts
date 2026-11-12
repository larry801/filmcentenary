/**
 * 15.3 "Occupied vs Controlled" — general occupation recording.
 *
 * "In wartime, the last player to solely be in a space occupies it.  Use
 * control markers to identify which spaces are occupied."  The live move paths
 * funnel through `recordOccupation`, which writes only the occupation marker
 * (`SpaceState.occupiedBy`) and never overwrites the formal control marker.
 *
 * These tests pin the helper and the live integrations that previously only
 * recorded occupation on a free march / combat advance: GW march and rail,
 * wartime redeploy, naval transport, amphibious landing, and retreat.
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {GreatWarState, ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit, resolveEffects} from "./engine/effects";
import {neighboursOf} from "./constant/spaces";
import {landUnitsIn, recordOccupation} from "./engine/rules";
import {performGwManeuver} from "./engine/greatWarFlow";
import {beginLandBattle, finishBattle} from "./engine/combat";
import {amphibiousAssault, navalTransport, redeploy, resolvePending} from "./moves";

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

const warState = (attacker: Power, defender: Power): WarState => ({
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
} as unknown as WarState);

const clearLand = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...landUnitsIn(G, space)]) removeUnit(G, unit.id);
};

const clearNaval = (G: ImperialElegyState, space: string): void => {
  for (const id of [...G.spaces[space].units]) {
    if (G.units[id]?.naval === true) removeUnit(G, id);
  }
};

const resetSpace = (G: ImperialElegyState, space: string): void => {
  const state = G.spaces[space];
  clearLand(G, space);
  clearNaval(G, space);
  state.control = null;
  state.ally = null;
  state.influence = null;
  state.diplomacy = null;
  state.occupiedBy = null;
};

/** A live Great War maneuver with FR acting and GE as the enemy. */
const gwFixture = (): ImperialElegyState => {
  const G = fresh();
  G.gw = {
    active: true,
    turn: 1,
    order: ["FR", "GE"],
    belligerents: ["FR", "GE"],
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
  } as GreatWarState;
  G.powers.FR.alliance = "teCommitted";
  G.powers.GE.alliance = "taCommitted";
  G.phase = "gwManeuver";
  G.activePower = "FR";
  G.powers.FR.gwBudget = 8;
  G.turnIndex = 0;
  return G;
};

// ---------------------------------------------------------------------------
// The pure 15.3 helper
// ---------------------------------------------------------------------------

describe("15.3 recordOccupation", () => {
  test("records the sole player's marker but never touches a foreign control marker", () => {
    const G = fresh();
    G.war = warState("FR", "GE");
    resetSpace(G, "westphalia");
    G.spaces.westphalia.control = "GE";
    placeUnit(G, "FR", "army", "westphalia", 2);

    const change = recordOccupation(G, "westphalia");

    expect(change).toMatchObject({before: null, after: "FR", changed: true, cleared: false});
    expect(G.spaces.westphalia.occupiedBy).toBe("FR");
    // 15.3: the capture is occupation, not formal control (30.1 keeps control
    // with the defender until the end of the war).
    expect(G.spaces.westphalia.control).toBe("GE");
  });

  test("a controlled minor's land unit counts as its controller's presence (15.4)", () => {
    const G = fresh();
    G.war = warState("GE", "FR");
    resetSpace(G, "westphalia");
    G.spaces.westphalia.control = "FR";
    // Tuscany is a GE-controlled minor; its army stands alone in Westphalia.
    G.spaces.tuscany.ally = "GE";
    placeUnit(G, "Tuscany", "army", "westphalia", 2);

    recordOccupation(G, "westphalia");

    expect(G.spaces.westphalia.occupiedBy).toBe("GE");
  });

  test("naval units and naval boxes never occupy", () => {
    const G = fresh();
    G.war = warState("FR", "GE");
    resetSpace(G, "westphalia");
    G.spaces.westphalia.control = "GE";
    placeUnit(G, "FR", "squadron", "westphalia", 2);

    expect(recordOccupation(G, "westphalia").changed).toBe(false);
    expect(G.spaces.westphalia.occupiedBy).toBeNull();

    placeUnit(G, "FR", "army", "north-atlantic", 2);
    expect(recordOccupation(G, "north-atlantic").changed).toBe(false);
  });

  test("no marker while two players' land units share the space", () => {
    const G = fresh();
    G.war = warState("FR", "GE");
    resetSpace(G, "westphalia");
    placeUnit(G, "FR", "army", "westphalia", 2);
    placeUnit(G, "GE", "army", "westphalia", 2);

    expect(recordOccupation(G, "westphalia").changed).toBe(false);
    expect(G.spaces.westphalia.occupiedBy).toBeNull();
  });

  test("a space already controlled by the occupant keeps no redundant marker", () => {
    const G = fresh();
    G.war = warState("FR", "GE");
    resetSpace(G, "westphalia");
    G.spaces.westphalia.control = "FR";
    placeUnit(G, "FR", "army", "westphalia", 2);

    expect(recordOccupation(G, "westphalia").changed).toBe(false);
    expect(G.spaces.westphalia.occupiedBy).toBeNull();
  });

  test("peacetime moves do not record occupation (15.3 is a wartime rule)", () => {
    const G = fresh();
    resetSpace(G, "westphalia");
    G.spaces.westphalia.control = "GE";
    placeUnit(G, "FR", "army", "westphalia", 2);

    expect(recordOccupation(G, "westphalia").changed).toBe(false);
    expect(G.spaces.westphalia.occupiedBy).toBeNull();
  });

  test("an earlier marker is replaced by the new sole occupant", () => {
    const G = fresh();
    G.war = warState("FR", "GE");
    resetSpace(G, "westphalia");
    G.spaces.westphalia.control = "GE";
    G.spaces.westphalia.occupiedBy = "AU";
    placeUnit(G, "FR", "army", "westphalia", 2);

    expect(recordOccupation(G, "westphalia")).toMatchObject({before: "AU", after: "FR", changed: true});
  });

  test("15.3 persistence: an empty space keeps its occupation marker", () => {
    const G = fresh();
    G.war = warState("FR", "GE");
    resetSpace(G, "westphalia");
    G.spaces.westphalia.occupiedBy = "FR";

    // 15.3: "An occupied space does not need to contain a land unit to remain
    // occupied."  Repeated reconciliation keeps the marker.
    expect(recordOccupation(G, "westphalia").changed).toBe(false);
    expect(G.spaces.westphalia.occupiedBy).toBe("FR");
    expect(recordOccupation(G, "westphalia").changed).toBe(false);
    expect(G.spaces.westphalia.occupiedBy).toBe("FR");
  });

  test("15.3: a control-backed sole occupant clears the stale enemy marker", () => {
    const G = fresh();
    G.war = warState("FR", "GE");
    resetSpace(G, "westphalia");
    G.spaces.westphalia.control = "GE";
    G.spaces.westphalia.occupiedBy = "FR";
    placeUnit(G, "GE", "army", "westphalia", 2);

    // The controller marched back in: "until another player ... controls the
    // space" ends the FR occupation and no redundant marker is kept.
    const change = recordOccupation(G, "westphalia");
    expect(change).toMatchObject({before: "FR", after: null, changed: true, cleared: true});
    expect(G.spaces.westphalia.occupiedBy).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GW march / rail
// ---------------------------------------------------------------------------

describe("15.3 live GW march and rail", () => {
  test("a free march into a formerly controlled space occupies it, and the marker persists after leaving", () => {
    const G = gwFixture();
    resetSpace(G, "alsace-lorraine");
    resetSpace(G, "westphalia");
    resetSpace(G, "hanover");
    G.spaces["alsace-lorraine"].control = "FR";
    G.spaces.westphalia.control = "GE";
    G.spaces.hanover.control = "FR";
    // 30.1: GE is eliminated, so its formal control remains as former territory
    // that FR may march into (and occupy under 15.3).
    G.powers.GE.eliminated = true;
    G.gw!.belligerents = ["FR"];
    G.gw!.ta = [];
    const army = placeUnit(G, "FR", "army", "alsace-lorraine", 2).id;

    const march = performGwManeuver(G, makeCtx([], seat("FR")), {
      kind: "march",
      power: "FR",
      unitId: army,
      to: "westphalia",
    });
    expect(march.ok).toBe(true);
    expect(G.spaces.westphalia.occupiedBy).toBe("FR");
    expect(G.spaces.westphalia.control).toBe("GE");

    const onward = performGwManeuver(G, makeCtx([], seat("FR")), {
      kind: "march",
      power: "FR",
      unitId: army,
      to: "hanover",
    });
    expect(onward.ok).toBe(true);
    expect(G.units[army].space).toBe("hanover");
    // 15.3 persistence: the vacated origin remains occupied until another
    // player occupies or controls it.
    expect(G.spaces.westphalia.occupiedBy).toBe("FR");
    // The destination is FR-controlled, so no redundant occupation marker.
    expect(G.spaces.hanover.occupiedBy).toBeNull();
  });

  test("a rail move into an influence-only space records the occupation", () => {
    const G = gwFixture();
    resetSpace(G, "alsace-lorraine");
    resetSpace(G, "westphalia");
    G.spaces["alsace-lorraine"].control = "FR";
    G.spaces.westphalia.control = null;
    G.spaces.westphalia.influence = "FR";
    const army = placeUnit(G, "FR", "army", "alsace-lorraine", 2).id;

    const rail = performGwManeuver(G, makeCtx([], seat("FR")), {
      kind: "rail",
      power: "FR",
      unitId: army,
      to: "westphalia",
    });
    expect(rail.ok).toBe(true);
    if (!rail.ok) throw new Error(rail.message);
    expect(G.spaces.westphalia.occupiedBy).toBe("FR");
    expect(G.spaces.westphalia.control).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Wartime redeploy / naval transport / amphibious landing
// ---------------------------------------------------------------------------

describe("15.3 live wartime moves", () => {
  test("a wartime redeploy occupies an influence-only destination and keeps the origin marker", () => {
    const G = fresh();
    G.phase = "wartime";
    G.activePower = "GE";
    G.war = warState("GE", "FR");
    G.war.budgets = {GE: 6, FR: 6};
    resetSpace(G, "berlin");
    resetSpace(G, "westphalia");
    G.spaces.berlin.control = "GE";
    G.spaces.westphalia.control = null;
    G.spaces.westphalia.influence = "GE";
    const army = placeUnit(G, "GE", "army", "berlin", 2).id;

    expect(redeploy(G, makeCtx([], seat("GE")), army, "westphalia")).toBeUndefined();
    expect(G.spaces.westphalia.occupiedBy).toBe("GE");
    expect(G.spaces.westphalia.control).toBeNull();

    expect(redeploy(G, makeCtx([], seat("GE")), army, "berlin")).toBeUndefined();
    // 15.3 persistence: Westphalia stays occupied by GE after the army leaves.
    expect(G.spaces.westphalia.occupiedBy).toBe("GE");
  });

  test("a naval transport lands the army and occupies the destination port", () => {
    const G = fresh();
    G.phase = "wartime";
    G.activePower = "UK";
    G.war = warState("UK", "FR");
    G.war.budgets = {UK: 5, FR: 5};
    resetSpace(G, "london");
    resetSpace(G, "brittany");
    G.spaces.london.control = "UK";
    G.spaces.brittany.control = null;
    G.spaces.brittany.influence = "UK";
    const army = placeUnit(G, "UK", "army", "london", 2).id;

    expect(navalTransport(G, makeCtx([], seat("UK")), army, [], "brittany")).toBeUndefined();
    expect(G.units[army].space).toBe("brittany");
    expect(G.spaces.brittany.occupiedBy).toBe("UK");
    expect(G.spaces.brittany.control).toBeNull();
  });

  test("an undefended amphibious landing still records the occupation", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "UK";
    G.cpRemaining = 5;
    G.war = warState("UK", "FR");
    resetSpace(G, "north-atlantic");
    resetSpace(G, "brittany");
    G.spaces.brittany.control = "FR";
    const army = placeUnit(G, "UK", "army", "north-atlantic", 2).id;

    expect(amphibiousAssault(G, makeCtx([], seat("UK")), "north-atlantic", "brittany", [army])).toBeUndefined();
    expect(G.units[army].space).toBe("brittany");
    expect(G.spaces.brittany.occupiedBy).toBe("UK");
    expect(G.spaces.brittany.control).toBe("FR");
  });

  test("a retreating army occupies an influence-only retreat space", () => {
    const G = fresh();
    G.phase = "wartime";
    G.activePower = "GE";
    G.war = warState("GE", "FR");
    G.war.defenderAllies = ["UK"];
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    G.powers.UK.alliance = "teCommitted";
    const relevant = new Set<string>(["saxony", "berlin", ...neighboursOf("saxony")]);
    for (const space of relevant) resetSpace(G, space);
    G.spaces.berlin.control = "GE";
    G.spaces.saxony.control = "FR";
    // Exactly two divergent contingents: the FR army may retreat to Bavaria
    // (FR-allied minor) or Bohemia (influence only); the UK army only to
    // Hanover (UK-allied minor).  The split decision therefore opens.
    for (const space of neighboursOf("saxony")) {
      if (space === "bavaria" || space === "bohemia" || space === "hanover") continue;
      G.spaces[space].control = "GE";
      G.spaces[space].ally = null;
      G.spaces[space].influence = null;
    }
    resetSpace(G, "bavaria");
    G.spaces.bavaria.control = "Bavaria";
    G.spaces.bavaria.ally = "FR";
    resetSpace(G, "bohemia");
    G.spaces.bohemia.control = null;
    G.spaces.bohemia.influence = "FR";
    resetSpace(G, "hanover");
    G.spaces.hanover.control = "Hanover";
    G.spaces.hanover.ally = "UK";

    const fr = placeUnit(G, "FR", "army", "saxony", 2).id;
    const uk = placeUnit(G, "UK", "army", "saxony", 2).id;
    placeUnit(G, "GE", "army", "berlin", 2);
    const battle = beginLandBattle(G, makeCtx([], seat("GE")), "GE", "berlin", "saxony");
    if (!battle) throw new Error("the land battle did not start");
    G.pending = null;
    battle.winner = "attacker";
    battle.attackerLosses = 0;
    battle.defenderLosses = 0;

    finishBattle(G, makeCtx([], seat("FR")));
    expect(G.pending?.kind).toBe("combatRetreat");
    const option = `split:${fr}@bohemia|${uk}@hanover`;
    expect(G.pending?.options.map((entry) => entry.id)).toContain(option);
    expect(resolvePending(G, makeCtx([], seat("FR")), option)).toBeUndefined();

    // 15.3/18.7: the FR army is solely in influence-only Bohemia, so it
    // records the occupation marker there without changing control.
    expect(G.units[fr].space).toBe("bohemia");
    expect(G.spaces.bohemia.occupiedBy).toBe("FR");
    expect(G.spaces.bohemia.control).toBeNull();
    // The UK army lands in a UK-controlled (control-backed) minor space.
    expect(G.units[uk].space).toBe("hanover");
    expect(G.spaces.hanover.occupiedBy).toBeNull();
    // The combat advance into Saxony still records the attacker (unchanged).
    expect(G.spaces.saxony.occupiedBy).toBe("GE");
  });
});

// ---------------------------------------------------------------------------
// Rejections leave occupation untouched
// ---------------------------------------------------------------------------

test("a rejected move never records occupation", () => {
  const G = gwFixture();
  resetSpace(G, "alsace-lorraine");
  resetSpace(G, "westphalia");
  G.spaces["alsace-lorraine"].control = "FR";
  G.spaces.westphalia.control = "GE";
  const army = placeUnit(G, "FR", "army", "alsace-lorraine", 2).id;

  // Three spaces away is neither a march nor a rail path from here.
  const rejected = performGwManeuver(G, makeCtx([], seat("FR")), {
    kind: "march",
    power: "FR",
    unitId: army,
    to: "moscow",
  });
  expect(rejected.ok).toBe(false);
  expect(G.spaces.westphalia.occupiedBy).toBeNull();
  expect(redeploy(G, makeCtx([], "0"), army, "westphalia")).toBe(INVALID_MOVE);
});

// ---------------------------------------------------------------------------
// Direct event control writes supersede a stale 15.3 occupation marker
// ---------------------------------------------------------------------------

describe("event control writes clear a stale occupation marker", () => {
  test("a controlSpace event retires the previous occupier", () => {
    const G = fresh();
    G.spaces.bohemia.control = "AU";
    G.spaces.bohemia.occupiedBy = "GE";

    expect(
      resolveEffects(G, makeCtx(), "GE", [{type: "controlSpace"}], {targetSpace: "bohemia"}),
    ).toBe(true);
    expect(G.spaces.bohemia.control).toBe("GE");
    expect(G.spaces.bohemia.occupiedBy).toBeNull();
  });

  test("a minorIndependence event retires the previous occupier", () => {
    const G = fresh();
    G.spaces.bohemia.control = "AU";
    G.spaces.bohemia.occupiedBy = "GE";
    G.spaces.bohemia.rebellion = {minor: "Czechs", step: 0, rebels: []};

    expect(
      resolveEffects(G, makeCtx(), "GE", [{type: "minorIndependence"}], {targetSpace: "bohemia"}),
    ).toBe(true);
    expect(G.spaces.bohemia.control).toBe("Czechs");
    expect(G.spaces.bohemia.occupiedBy).toBeNull();
  });
});
