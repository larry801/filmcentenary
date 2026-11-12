/**
 * 22.1.3 Internal Italian War.
 *
 * "Choose either Sardinia-Piedmont or the Kingdom of the Two Sicilies.  That
 * power gains 1 army, 1 naval squadron, and takes control of a neighboring
 * Italian key that is not controlled by a player (there will only ever be one).
 * Eliminate all minor power armies in the conquered space."
 *
 * The live Italy card (22.1) resolves the result through `italyTable`, so this
 * suite pins both the pure 22.1.3 helper and the real card path.  The 4.2
 * non-player counter row must be respected: a second play may replace the minor
 * army in Tuscany, but it can never create a third Sardinia-Piedmont / Two
 * Sicilies army or a second squadron.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {
  applyInternalItalianWar,
  chooseItalianInternalWarPower,
  italianInternalWarKey,
  italyTable,
} from "./engine/greatWar";
import {friendlySpace, landUnitsIn, navalUnitsIn} from "./engine/rules";

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

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const unitsOf = (G: ImperialElegyState, owner: string, kind?: string) =>
  Object.values(G.units).filter((unit) => unit.owner === owner && (kind === undefined || unit.kind === kind));

describe("22.1.3 the free neighboring Italian key", () => {
  test("both Italian minors border the single free key, Tuscany", () => {
    const G = fresh();
    expect(italianInternalWarKey(G, "Sardinia-Piedmont")).toBe("tuscany");
    expect(italianInternalWarKey(G, "Two Sicilies")).toBe("tuscany");
    // Rome is the Papal capital, not one of the "keys" this rule takes.
    expect(italianInternalWarKey(G, "Sardinia-Piedmont")).not.toBe("rome");
  });

  test("a player-controlled Italian key is never taken", () => {
    const G = fresh();
    G.spaces.tuscany.control = "FR";
    expect(italianInternalWarKey(G, "Sardinia-Piedmont")).toBeNull();
    expect(italianInternalWarKey(G, "Two Sicilies")).toBeNull();
  });

  test("the default choice is deterministic (Sardinia-Piedmont first)", () => {
    const G = fresh();
    expect(chooseItalianInternalWarPower(G)).toBe("Sardinia-Piedmont");
    expect(chooseItalianInternalWarPower(G, "Two Sicilies")).toBe("Two Sicilies");
  });
});

describe("22.1.3 the minor gains an army and a squadron through the 4.2 pool", () => {
  test("the live Italy card roll 4–5 takes Tuscany for Sardinia-Piedmont", () => {
    const G = fresh();
    G.turn = 1;
    G.spaces.tuscany.ally = "GE";
    G.spaces.tuscany.diplomacy = "FR";
    G.spaces.tuscany.influence = "RU";

    italyTable(G, makeCtx(4), "GE");

    // Printed control/ally effect: the chosen power takes the key, and the old
    // minor's player markers leave with it.
    expect(G.spaces.tuscany.control).toBe("Sardinia-Piedmont");
    expect(G.spaces.tuscany.ally).toBeNull();
    expect(G.spaces.tuscany.diplomacy).toBeNull();
    expect(G.spaces.tuscany.influence).toBeNull();

    // "Eliminate all minor power armies in the conquered space."
    expect(unitsOf(G, "Tuscany")).toHaveLength(0);
    expect(landUnitsIn(G, "tuscany").filter((unit) => unit.owner === "Sardinia-Piedmont")).toHaveLength(1);
    // The 22.1.3 army + squadron come from the printed non-player row.
    expect(unitsOf(G, "Sardinia-Piedmont", "minorArmy")).toHaveLength(2);
    expect(navalUnitsIn(G, "piedmont").filter((unit) => unit.owner === "Sardinia-Piedmont")).toHaveLength(1);
  });

  test("the chosen minor's controller keeps the conquered key friendly", () => {
    const G = fresh();
    // GE controls Sardinia-Piedmont; the takeover must carry GE's ally marker
    // onto Tuscany (otherwise the new key would not be friendly to its army).
    G.spaces.piedmont.ally = "GE";

    applyInternalItalianWar(G, "Sardinia-Piedmont");

    expect(G.spaces.tuscany.control).toBe("Sardinia-Piedmont");
    expect(G.spaces.tuscany.ally).toBe("GE");
    expect(friendlySpace(G, "tuscany", "GE")).toBe(true);
  });

  test("the chosen power may instead be the Two Sicilies", () => {
    const G = fresh();
    const result = applyInternalItalianWar(G, "Two Sicilies");

    expect(result.power).toBe("Two Sicilies");
    expect(result.key).toBe("tuscany");
    expect(G.spaces.tuscany.control).toBe("Two Sicilies");
    expect(unitsOf(G, "Tuscany")).toHaveLength(0);
    expect(unitsOf(G, "Two Sicilies", "minorArmy")).toHaveLength(2);
    expect(navalUnitsIn(G, "naples").filter((unit) => unit.owner === "Two Sicilies")).toHaveLength(1);
  });

  test("an exhausted 4.2 row refuses the counter instead of over-placing", () => {
    const G = fresh();
    // Sardinia-Piedmont already fields its printed second army and its one
    // squadron, so the 22.1.3 grant has no counter left.
    placeUnit(G, "Sardinia-Piedmont", "minorArmy", "piedmont", 2);
    placeUnit(G, "Sardinia-Piedmont", "squadron", "piedmont", 2);

    const result = applyInternalItalianWar(G, "Sardinia-Piedmont");

    expect(result.key).toBe("tuscany");
    // The control takeover still happens...
    expect(G.spaces.tuscany.control).toBe("Sardinia-Piedmont");
    // ...but no third army / second squadron is invented.
    expect(result.armyId).toBeNull();
    expect(result.squadronId).toBeNull();
    expect(unitsOf(G, "Sardinia-Piedmont", "minorArmy")).toHaveLength(2);
    expect(unitsOf(G, "Sardinia-Piedmont", "squadron")).toHaveLength(1);
    expect(G.log.filter((entry) => entry.key === "nonPlayerCounterExhausted")).toHaveLength(2);
  });

  test("a repeated play replaces the garrison but never exceeds the row", () => {
    const G = fresh();
    expect(applyInternalItalianWar(G, "Sardinia-Piedmont").armyId).not.toBeNull();
    const second = applyInternalItalianWar(G, "Sardinia-Piedmont");

    expect(second.key).toBe("tuscany");
    // The old army in Tuscany is eliminated, so the row stays at two armies.
    expect(unitsOf(G, "Sardinia-Piedmont", "minorArmy")).toHaveLength(2);
    expect(unitsOf(G, "Sardinia-Piedmont", "squadron")).toHaveLength(1);
    expect(G.log.filter((entry) => entry.key === "nonPlayerCounterExhausted")).toHaveLength(1);
  });
});
