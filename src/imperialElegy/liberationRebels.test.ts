/**
 * 13.1.1 / 21.2 / 21.4 — rebels and wars of liberation.
 *
 * Three printed clauses the engine used to miss:
 *   21.4  "When attacking such spaces, players must first attack the units
 *          belonging to enemy powers." — rebels standing next to enemy units
 *          used to defend (and take losses) in that first battle.
 *   13.1.1 "Rebels in a war of liberation are friendly to ... the attacking
 *          player if that player's war aim is to liberate them." — the
 *          attacker could (and effectively had to) fight the very rebels the
 *          war liberates.
 *   21.2  "rebel units are considered to occupy spaces for the attacker if
 *          that space solely contains rebel units" — so a rebel-held objective
 *          wins a liberation war and supplies the attacker without garrison.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power, WarState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {beginLandBattle, canBeginLandBattle} from "./engine/combat";
import {classifyVictory} from "./engine/limitedWar";
import {placeUnit} from "./engine/effects";
import {hasLoc, locFriendlySpace, recordOccupation} from "./engine/rules";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    turn: 1,
    phase: "wartime",
  } as unknown as Ctx;
};

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const warState = (
  attacker: Power,
  defender: Power,
  aim: WarState["warAim"],
  objectives: string[],
): WarState => ({
  attacker,
  defender,
  attackerAllies: [],
  defenderAllies: [],
  attackerMinors: [],
  defenderMinors: [],
  warAim: aim,
  objectives,
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
  for (const unit of [...G.spaces[space].units]) {
    const unit_ = G.units[unit];
    if (unit_ !== undefined && unit_.naval !== true) G.spaces[space].units = G.spaces[space].units.filter((id) => id !== unit);
  }
};

const placeRebellion = (
  G: ImperialElegyState,
  space: string,
  minor: string,
  armies = 1,
): string[] => {
  clearLand(G, space);
  G.spaces[space].rebellion = {minor, step: 0, rebels: []};
  const ids: string[] = [];
  for (let i = 0; i < armies; i += 1) {
    const rebel = placeUnit(G, `REBEL:${minor}`, "rebelArmy", space, 2);
    ids.push(rebel.id);
    G.spaces[space].rebellion!.rebels.push(rebel.id);
  }
  return ids;
};

describe("21.4 attacking a space with rebels and enemy units", () => {
  test("rebels stand out of the battle while enemy-power units defend it", () => {
    const G = fresh();
    G.war = warState("RU", "OT", "conquest", ["bulgaria"]);
    G.spaces.bulgaria.rebellion = {minor: "Bulgars", step: 0, rebels: []};
    const otArmy = placeUnit(G, "OT", "army", "bulgaria", 2);
    const rebel = placeUnit(G, "REBEL:Bulgars", "rebelArmy", "bulgaria", 2);
    G.spaces.bulgaria.rebellion!.rebels.push(rebel.id);
    const ruArmy = placeUnit(G, "RU", "army", "serbia", 2);

    const battle = beginLandBattle(G, makeCtx(), "RU", "serbia", "bulgaria");
    expect(battle).not.toBeNull();
    expect(battle!.mainDefense).toEqual([otArmy.id]);
    expect(battle!.mainDefense).not.toContain(rebel.id);
    void ruArmy;
  });

  test("the rebels are still a legal battle on their own afterwards", () => {
    const G = fresh();
    G.war = warState("RU", "OT", "conquest", ["bulgaria"]);
    placeRebellion(G, "bulgaria", "Bulgars");
    const ruArmy = placeUnit(G, "RU", "army", "serbia", 2);
    expect(canBeginLandBattle(G, "RU", "serbia", "bulgaria")).toBe(true);
    void ruArmy;
  });
});

describe("13.1.1 friendly rebels in a liberation war", () => {
  test("the attacker cannot battle the rebels it is liberating", () => {
    const G = fresh();
    G.war = warState("RU", "OT", "liberation", ["bulgaria"]);
    placeRebellion(G, "bulgaria", "Bulgars");
    placeUnit(G, "RU", "army", "serbia", 2);
    expect(canBeginLandBattle(G, "RU", "serbia", "bulgaria")).toBe(false);
    expect(beginLandBattle(G, makeCtx(), "RU", "serbia", "bulgaria")).toBeNull();
  });

  test("rebels outside the objectives stay hostile to the attacker", () => {
    const G = fresh();
    G.war = warState("RU", "OT", "liberation", ["bulgaria"]);
    placeRebellion(G, "macedonia", "Macedonians");
    placeUnit(G, "RU", "army", "serbia", 2);
    expect(canBeginLandBattle(G, "RU", "serbia", "macedonia")).toBe(true);
  });

  test("the defender still fights the rebels in the liberated space", () => {
    const G = fresh();
    G.war = warState("RU", "OT", "liberation", ["bulgaria"]);
    placeRebellion(G, "bulgaria", "Bulgars");
    placeUnit(G, "OT", "army", "serbia", 2);
    expect(canBeginLandBattle(G, "OT", "serbia", "bulgaria")).toBe(true);
  });
});

describe("21.2 rebels occupy liberation objectives for the attacker", () => {
  test("a rebel-held objective wins the war as a normal victory", () => {
    const G = fresh();
    G.war = warState("RU", "OT", "liberation", ["bulgaria"]);
    placeRebellion(G, "bulgaria", "Bulgars", 2);
    const victory = classifyVictory(G, G.war);
    expect(victory.primary).toBe("normal");
    expect(victory.victor).toBe("attacker");
  });

  test("the rebel-held objective supplies the attacker's stack", () => {
    const G = fresh();
    G.war = warState("AU", "OT", "liberation", ["bulgaria"]);
    placeRebellion(G, "bulgaria", "Bulgars");
    G.spaces.serbia.control = "AU";
    placeUnit(G, "AU", "army", "bulgaria", 2);
    // 21.4's friendly-rebel exception: the stack occupying the space beside
    // the rebels it is liberating takes the occupation marker.
    recordOccupation(G, "bulgaria");
    expect(G.spaces.bulgaria.occupiedBy).toBe("AU");
    expect(locFriendlySpace(G, "bulgaria", "AU")).toBe(true);
    expect(hasLoc(G, "AU", "bulgaria")).toBe(true);
  });

  test("hostile rebels in the same space block the occupation and the LoC", () => {
    const G = fresh();
    G.war = warState("RU", "OT", "conquest", ["bulgaria"]);
    placeRebellion(G, "bulgaria", "Bulgars");
    placeUnit(G, "RU", "army", "bulgaria", 2);
    expect(locFriendlySpace(G, "bulgaria", "RU")).toBe(false);
    const occupation = recordOccupation(G, "bulgaria");
    expect(occupation.after).toBeNull();
  });

  test("friendly rebels do not block the attacker's occupation marker", () => {
    const G = fresh();
    G.war = warState("RU", "OT", "liberation", ["bulgaria"]);
    placeRebellion(G, "bulgaria", "Bulgars");
    placeUnit(G, "RU", "army", "bulgaria", 2);
    const occupation = recordOccupation(G, "bulgaria");
    expect(occupation.after).toBe("RU");
  });
});
