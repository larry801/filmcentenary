/**
 * 30.1 formerly controlled space — march and rail after an elimination.
 *
 * "After a player is eliminated, other players may freely march through their
 * territory, but all spaces formally controlled by the eliminated power must be
 * occupied (including by that power's former allies) before players may rail
 * through them."
 *
 * Occupation follows 15.3: the last player solely in a space occupies it, so a
 * free march records the occupation marker and opens the rail line for that
 * side; an unoccupied (or enemy-occupied) former territory stays closed to
 * rail and cannot be marched into while an enemy holds it.
 */
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {friendlySpace, isFormerlyControlledSpace} from "./engine/rules";
import {performGwManeuver} from "./engine/greatWarFlow";

const makeCtx = (dieValue = 3): Ctx =>
  ({
    playerID: "0",
    random: {Die: (_sides: number) => dieValue},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

/**
 * FR is the active maneuver power.  GE has been eliminated, so its formally
 * controlled spaces (berlin, westphalia, silesia, pomerania, prussia) remain on
 * the map as its former territory.  Hanover is FR-controlled so there is a
 * friendly rail destination beyond Westphalia.
 */
const formerTerritoryState = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = {
    active: true,
    turn: 1,
    order: ["FR"],
    belligerents: ["FR", "UK"],
    neutrals: [],
    te: ["FR", "UK"],
    ta: ["RU"],
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
  G.powers.UK.alliance = "teCommitted";
  G.powers.RU.alliance = "taCommitted";
  // 30.1: the eliminated power is out of the war; its control markers stay.
  G.powers.GE.eliminated = true;
  G.powers.GE.alliance = "neutral";
  G.spaces.hanover.control = "FR";
  G.phase = "gwManeuver";
  G.activePower = "FR";
  G.turnIndex = 0;
  G.powers.FR.gwBudget = 8;
  return G;
};

const frArmy = (G: ImperialElegyState, space: string): string =>
  placeUnit(G, "FR", "army", space as never, 2).id;

describe("30.1 formerly controlled space detection", () => {
  test("only an eliminated power's formal control counts", () => {
    const G = formerTerritoryState();
    expect(isFormerlyControlledSpace(G, "westphalia")).toBe(true);
    expect(isFormerlyControlledSpace(G, "alsace-lorraine")).toBe(false);
    expect(isFormerlyControlledSpace(G, "hanover")).toBe(false);
    // Neutral control (an unoccupied minor) is not former territory.
    expect(isFormerlyControlledSpace(G, "saxony")).toBe(false);
  });
});

describe("30.1 free march through former territory", () => {
  test("a march into an unoccupied formerly controlled space is legal and occupies it", () => {
    const G = formerTerritoryState();
    const unit = frArmy(G, "alsace-lorraine");
    expect(friendlySpace(G, "westphalia", "FR")).toBe(false);

    const march = performGwManeuver(G, makeCtx(), {kind: "march", power: "FR", unitId: unit, to: "westphalia"});

    expect(march.ok).toBe(true);
    if (!march.ok) throw new Error(march.message);
    expect(G.units[unit].space).toBe("westphalia");
    // 15.3: the mover now solely occupies the space, so it is friendly and may
    // be railed through (30.1).
    expect(G.spaces.westphalia.occupiedBy).toBe("FR");
    expect(friendlySpace(G, "westphalia", "FR")).toBe(true);
    const entry = G.log.find((item) => item.key === "gwFreeMarch");
    expect(entry?.args).toMatchObject({from: "alsace-lorraine", to: "westphalia", control: "GE"});
  });

  test("a unit may march onward out of former territory", () => {
    const G = formerTerritoryState();
    const unit = frArmy(G, "westphalia");

    const march = performGwManeuver(G, makeCtx(), {kind: "march", power: "FR", unitId: unit, to: "hanover"});

    expect(march.ok).toBe(true);
    if (!march.ok) throw new Error(march.message);
    expect(G.units[unit].space).toBe("hanover");
  });

  test("an enemy land unit still has to be fought, not marched through", () => {
    const G = formerTerritoryState();
    const unit = frArmy(G, "alsace-lorraine");
    placeUnit(G, "RU", "army", "westphalia", 2);

    const march = performGwManeuver(G, makeCtx(), {kind: "march", power: "FR", unitId: unit, to: "westphalia"});

    expect(march.ok).toBe(false);
    if (march.ok) throw new Error("expected a failure");
    expect(march.error).toBe("invalidTarget");
    expect(G.units[unit].space).toBe("alsace-lorraine");
    expect(G.powers.FR.gwBudget).toBe(8);
  });

  test("an enemy occupation marker closes the territory to free march", () => {
    const G = formerTerritoryState();
    const unit = frArmy(G, "alsace-lorraine");
    G.spaces.westphalia.occupiedBy = "RU";

    const march = performGwManeuver(G, makeCtx(), {kind: "march", power: "FR", unitId: unit, to: "westphalia"});

    expect(march.ok).toBe(false);
    expect(G.units[unit].space).toBe("alsace-lorraine");
  });
});

describe("30.1 rail through former territory needs occupation", () => {
  test("an unoccupied formerly controlled space blocks rail and says why", () => {
    const G = formerTerritoryState();
    const unit = frArmy(G, "alsace-lorraine");

    const rail = performGwManeuver(G, makeCtx(), {kind: "rail", power: "FR", unitId: unit, to: "hanover"});

    expect(rail.ok).toBe(false);
    if (rail.ok) throw new Error("expected a failure");
    expect(rail.error).toBe("invalidTarget");
    expect(rail.message).toMatch(/formerly controlled/);
    expect(rail.message).toMatch(/occupied/);
    expect(G.units[unit].space).toBe("alsace-lorraine");
    expect(G.powers.FR.gwBudget).toBe(8);
  });

  test("rail works once the space is occupied by the mover", () => {
    const G = formerTerritoryState();
    const unit = frArmy(G, "alsace-lorraine");
    G.spaces.westphalia.occupiedBy = "FR";

    const rail = performGwManeuver(G, makeCtx(), {kind: "rail", power: "FR", unitId: unit, to: "hanover"});

    expect(rail.ok).toBe(true);
    if (!rail.ok) throw new Error(rail.message);
    expect(G.units[unit].space).toBe("hanover");
    expect(G.powers.FR.gwBudget).toBe(7);
  });

  test("occupation by a former ally of the eliminated power also opens the rail line", () => {
    const G = formerTerritoryState();
    const unit = frArmy(G, "alsace-lorraine");
    // UK (FR's ally) occupies the former GE space; friendlySpace() alone does
    // not treat an ally's occupation marker as friendly, 30.1 does.
    G.spaces.westphalia.occupiedBy = "UK";
    expect(friendlySpace(G, "westphalia", "FR")).toBe(false);

    const rail = performGwManeuver(G, makeCtx(), {kind: "rail", power: "FR", unitId: unit, to: "hanover"});

    expect(rail.ok).toBe(true);
    if (!rail.ok) throw new Error(rail.message);
    expect(G.units[unit].space).toBe("hanover");
  });

  test("an enemy-occupied former space is not a rail route", () => {
    const G = formerTerritoryState();
    const unit = frArmy(G, "alsace-lorraine");
    G.spaces.westphalia.occupiedBy = "RU";

    const rail = performGwManeuver(G, makeCtx(), {kind: "rail", power: "FR", unitId: unit, to: "hanover"});

    expect(rail.ok).toBe(false);
    if (rail.ok) throw new Error("expected a failure");
    expect(rail.message).toMatch(/No friendly rail path/);
  });

  test("ordinary rail is unchanged on the friendly network", () => {
    const G = formerTerritoryState();
    const unit = frArmy(G, "paris");

    const rail = performGwManeuver(G, makeCtx(), {kind: "rail", power: "FR", unitId: unit, to: "champagne"});

    expect(rail.ok).toBe(true);
    if (!rail.ok) throw new Error(rail.message);
    expect(G.units[unit].space).toBe("champagne");
  });

  test("a unit standing in former territory may rail out (15.3 occupation)", () => {
    const G = formerTerritoryState();
    const unit = frArmy(G, "westphalia");

    const rail = performGwManeuver(G, makeCtx(), {kind: "rail", power: "FR", unitId: unit, to: "hanover"});

    // The space itself is not occupied by an occupation marker, but the army
    // standing in it occupies it (15.3), so the rail move is legal.
    expect(rail.ok).toBe(true);
    if (!rail.ok) throw new Error(rail.message);
    expect(G.units[unit].space).toBe("hanover");
  });
});
