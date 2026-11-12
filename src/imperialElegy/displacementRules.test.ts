import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  displaceUnitToFriendlyLoc,
  displaceUnitsNotFriendlyTo,
  landDisplacementTarget,
  navalDisplacementTarget,
  placeUnit,
  removeUnit,
} from "./engine/effects";
import {createWarState} from "./engine/limitedWar";
import {resolveEnd, resolveWar} from "./moves";

/**
 * Rule 5.7 — general displacement.
 *
 * "Displaced land units are moved to the closest friendly controlled space
 * with a LoC.  There are no restrictions around this.  They are just picked up
 * and moved (teleported).  Naval units displace to an adjacent naval box."
 */

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
    phase: "end",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

// ---------------------------------------------------------------------------
// Pure destination rules
// ---------------------------------------------------------------------------

describe("5.7 displacement destinations", () => {
  test("a land unit teleports to the closest friendly controlled space with a LoC", () => {
    const G = fresh();
    // Give GE a friendly LoC corridor out of Paris: Champagne and
    // Alsace-Lorraine connect through Westphalia/Hanover to Berlin.
    G.spaces.champagne.control = "GE";
    G.spaces["alsace-lorraine"].control = "GE";
    G.spaces.hanover.control = "GE";
    expect(landDisplacementTarget(G, "GE", "paris")).toBe("champagne");
  });

  test("a naval unit displaces to an adjacent naval box", () => {
    const G = fresh();
    const ship = placeUnit(G, "GE", "squadron", "prussia", 2);
    expect(navalDisplacementTarget(G, "GE", "prussia")).toBe("baltic-sea");
    const result = displaceUnitToFriendlyLoc(G, ship.id);
    expect(result).toMatchObject({to: "baltic-sea", kind: "naval", eliminated: false});
    expect(G.units[ship.id].space).toBe("baltic-sea");
    expect(G.spaces.prussia.units).not.toContain(ship.id);
  });

  test("a unit with no friendly destination is eliminated", () => {
    const G = fresh();
    // Strip every GE-controlled space: the BFS is unrestricted, so the only
    // way to have no destination is for GE to control none.
    for (const state of Object.values(G.spaces)) {
      if (state.control === "GE") state.control = null;
    }
    const stranded = placeUnit(G, "GE", "army", "paris", 2);
    expect(landDisplacementTarget(G, "GE", "paris")).toBeNull();
    const result = displaceUnitToFriendlyLoc(G, stranded.id);
    expect(result).toMatchObject({from: "paris", to: null, eliminated: true});
    expect(G.units[stranded.id]).toBeUndefined();
    expect(G.spaces.paris.units).not.toContain(stranded.id);
  });

  test("a unit already off map is not displaced", () => {
    const G = fresh();
    const reserve = placeUnit(G, "GE", "reserveArmy", null, 2);
    expect(displaceUnitToFriendlyLoc(G, reserve.id)).toBeNull();
    expect(G.units[reserve.id].space).toBeNull();
  });

  test("an independent minor and a controlled minor both find a friendly space", () => {
    const G = fresh();
    // Independent Serbia (controls Serbia) displaces into its own space.
    G.spaces.serbia.control = "Serbia";
    G.spaces.greece.control = "Greece";
    G.spaces.macedonia.control = "Greece";
    const serbian = placeUnit(G, "Serbia", "minorArmy", "greece", 1);
    const result = displaceUnitToFriendlyLoc(G, serbian.id);
    expect(result?.to).not.toBeNull();
    expect(G.units[serbian.id].space).toBe(result?.to);
  });

  test("treaty cession displaces only the units hostile to the new controller", () => {
    const G = fresh();
    G.spaces["alsace-lorraine"].control = "GE";
    // The campaign setup already places a French army in Alsace-Lorraine.
    const french = Object.values(G.units).find(
      (unit) => unit.owner === "FR" && unit.space === "alsace-lorraine",
    )!;
    const german = placeUnit(G, "GE", "army", "alsace-lorraine", 2);
    const displaced = displaceUnitsNotFriendlyTo(G, "alsace-lorraine", "GE");
    expect(displaced.map((entry) => entry.unitId)).toEqual([french.id]);
    expect(G.units[french.id].space).toBe("champagne");
    expect(G.units[german.id].space).toBe("alsace-lorraine");
  });
});

// ---------------------------------------------------------------------------
// Live paths
// ---------------------------------------------------------------------------

describe("5.7 live wiring", () => {
  test("20.8 WoI independence displaces foreign units through the shared helper", () => {
    const G = fresh();
    G.spaces.poland.rebellion = {minor: "Poland", step: 1, rebels: []};
    const german = placeUnit(G, "GE", "army", "poland", 2);
    resolveEnd(G, makeCtx());
    // Unrestricted BFS: the army lands in the closest GE-controlled LoC space.
    const movedTo = G.units[german.id].space!;
    expect(movedTo).not.toBe("poland");
    expect(G.spaces[movedTo].control).toBe("GE");
    expect(G.spaces.poland.control).toBe("Poland");
    expect(G.nonPlayerBuildBox?.minors).toContain("Poland");
    // 22.5(1): independence creates the empty holding box; the 4th/5th reserve
    // counters count against the spaces+1 allowance and are built, not seeded.
    expect(G.nonPlayerBuildBox?.poland?.reserveArmies).toHaveLength(0);
    expect(G.log.some((entry) => entry.key === "unitDisplaced" && entry.args?.from === "poland")).toBe(true);
  });

  test("a treaty cession settlement displaces the previous owner's garrison", () => {
    const G = fresh();
    G.phase = "wartime";
    G.activePower = "GE";
    G.war = createWarState(G, "GE", "FR", "conquest", ["alsace-lorraine"], 2);
    G.war.status = "maneuver";
    G.spaces["alsace-lorraine"].occupiedBy = "GE";
    const french = placeUnit(G, "FR", "army", "alsace-lorraine", 2);

    expect(
      resolveWar(G, makeCtx([], seat("GE")), [{option: "territorialCession", spaces: ["alsace-lorraine"]}]),
    ).toBeUndefined();

    expect(G.spaces["alsace-lorraine"].control).toBe("GE");
    expect(G.units[french.id]).toBeDefined();
    expect(G.units[french.id].space).toBe("champagne");
    expect(G.spaces["alsace-lorraine"].units).not.toContain(french.id);
  });

  test("removing a unit before displacement leaves the helper a no-op", () => {
    const G = fresh();
    const unit = placeUnit(G, "GE", "army", "paris", 2);
    removeUnit(G, unit.id);
    expect(displaceUnitToFriendlyLoc(G, unit.id)).toBeNull();
  });
});
