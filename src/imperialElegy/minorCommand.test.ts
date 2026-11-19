/**
 * 12.8 / 15.4: an allied minor power's ordinary counters are commanded by
 * their controller during a war.  The board and the engine must agree on that
 * — the reported bug was a wartime unit chip that selected but produced no
 * battle, because the board model read a `gwManeuver`-only predicate
 * and `beginLandBattle` looked at the *space's* ally marker instead of the
 * minor's controller.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, WarState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {beginLandBattle, beginNavalBattle} from "./engine/combat";
import {unitIsCommanded} from "./components/boardHelpers";

const makeCtx = (): Ctx => ({
  playerID: "0",
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {
    setPhase: () => undefined,
    setActivePlayers: () => undefined,
    endGame: () => undefined,
    endTurn: () => undefined,
  },
  turn: 1,
  phase: "wartime",
} as unknown as Ctx);

const makeWar = (attacker: "GE", defender: "FR"): WarState => ({
  attacker,
  defender,
  attackerAllies: [],
  defenderAllies: [],
  attackerMinors: [],
  defenderMinors: [],
  warAim: "conquest",
  objectives: [],
  status: "maneuver",
  budgets: {GE: 6, FR: 6},
  initiative: ["GE", "FR"],
  treaties: [],
  victor: null,
  truceTurns: 2,
  passed: [],
  startedTurn: 1,
} as unknown as WarState);

const clearSpace = (G: ImperialElegyState, space: string): void => {
  for (const id of [...(G.spaces[space]?.units ?? [])]) removeUnit(G, id);
};

/**
 * GE at war with FR and allied to Bavaria.  The Bavarian army stands in
 * Saxony, which carries no ally marker of its own: only the minor's home
 * (Bavaria) records the alliance, exactly as after the minor marched out.
 */
const setup = (): {G: ImperialElegyState; minorId: string} => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "wartime";
  G.activePower = "GE";
  G.war = makeWar("GE", "FR");
  G.spaces.bavaria.control = "Bavaria";
  G.spaces.bavaria.ally = "GE";
  G.spaces.saxony.control = null;
  G.spaces.saxony.ally = null;
  clearSpace(G, "bavaria");
  clearSpace(G, "saxony");
  clearSpace(G, "bohemia");
  const minor = placeUnit(G, "Bavaria", "minorArmy", "saxony", 2);
  placeUnit(G, "FR", "army", "bohemia", 2);
  return {G, minorId: minor.id};
};

describe("12.8 controlled allied minor command", () => {
  test("the controller commands the minor in wartime only", () => {
    const {G, minorId} = setup();
    const unit = G.units[minorId];
    expect(unitIsCommanded(G, "GE", unit, "wartime")).toBe(true);
    expect(unitIsCommanded(G, "GE", unit, "action")).toBe(false);
    expect(unitIsCommanded(G, "FR", unit, "wartime")).toBe(false);
  });

  test("a minor army away from its allied home still attacks for its controller", () => {
    const {G, minorId} = setup();
    // The old code required G.spaces.from.ally === actor; Saxony has no marker.
    const battle = beginLandBattle(G, makeCtx(), "GE", "saxony", "bohemia");
    expect(battle).not.toBeNull();
    expect(battle?.attacker).toBe("GE");
    expect(battle?.mainAttack).toContain(minorId);
  });

  test("without the alliance marker the minor's attack is refused", () => {
    const {G} = setup();
    G.spaces.bavaria.ally = null;
    expect(beginLandBattle(G, makeCtx(), "GE", "saxony", "bohemia")).toBeNull();
  });
});

/** GE at war with FR and allied to Greece, whose squadron sits in the Atlantic. */
const navalSetup = (): {G: ImperialElegyState; minorId: string} => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "wartime";
  G.activePower = "GE";
  G.war = makeWar("GE", "FR");
  G.spaces.greece.control = "Greece";
  G.spaces.greece.ally = "GE";
  G.spaces["north-atlantic"].ally = null;
  clearSpace(G, "north-atlantic");
  clearSpace(G, "baltic-sea");
  const minor = placeUnit(G, "Greece", "squadron", "north-atlantic", 1);
  placeUnit(G, "FR", "squadron", "baltic-sea", 1);
  return {G, minorId: minor.id};
};

describe("15.4 controlled allied minor naval command", () => {
  test("a minor squadron away from its home port still fights for its controller", () => {
    const {G, minorId} = navalSetup();
    const battle = beginNavalBattle(G, makeCtx(), "GE", "north-atlantic", "baltic-sea");
    expect(battle).not.toBeNull();
    expect(battle?.attacker).toBe("GE");
    expect(battle?.mainAttack).toContain(minorId);
  });
});
