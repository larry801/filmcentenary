/**
 * 5.1.3 / 5.1.5 / 5.1.6 — a counter left alone is eliminated.
 *
 * 5.1.3 prints: "They can move on their own but must always begin and end their
 * movement stacked with (attached to) an army. ... If an EC is ever alone in a
 * space at the end of a combat or at the end of a movement, it is eliminated."
 * 5.1.5's elite colonial EFs and 5.1.6's Zouaves add the same clause, and
 * `isEliteKind` already treats all three as ECs for elimination purposes.
 *
 * The clause was not implemented: an EC could sit in a space on its own — left
 * behind by a battle in which its army was eliminated, or by a redeployment of
 * that army — and stay on the board indefinitely.  It now runs wherever the
 * printed moment is observable:
 *
 *  - at the end of a battle (`combat.ts#finishBattle`, after retreat/advance);
 *  - right after any resolved pending decision (`moves.ts#resolvePending`);
 *  - at the impulse boundary (`rules.ts#beginImpulseUpkeep`), the end of the
 *    movement that produced the split;
 *
 * and 5.1.4's ordinary EFs / 5.1.2's reserve armies are deliberately left
 * alone: they print the weaker "must end a move with a standing army" form.
 *
 * The campaign setup's own lone counters (the FR Zouave in Algeria, the UK
 * elite colonial EF at Suez) carry `SETUP_PLACEMENT_FLAG`, so a printed 1850
 * position is never swept before the game has moved on.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {beginLandBattle, resolveBattleRoll} from "./engine/combat";
import {beginImpulseUpkeep, eliminateAloneEliteUnits, landUnitsIn} from "./engine/rules";
import {redeploy} from "./moves";

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

/** A quiet board: no units anywhere, every space uncontrolled. */
const blank = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.pending = null;
  G.pendingStack = [];
  G.battle = null;
  G.war = null;
  G.units = {};
  for (const state of Object.values(G.spaces)) {
    state.units = [];
    state.control = null;
    state.occupiedBy = null;
    state.ally = null;
    state.influence = null;
  }
  for (const power of POWERS) G.powers[power].alliance = "neutral";
  return G;
};

const unitsInSpace = (G: ImperialElegyState, space: string): string[] =>
  landUnitsIn(G, space).map((unit) => unit.kind).sort();

describe("5.1.3 — a counter alone in a space is eliminated", () => {
  test("each printed counter kind is swept when no army of its owner stacks with it", () => {
    const G = blank();
    for (const space of ["berlin", "vienna", "paris"]) G.spaces[space].control = null;
    const ec = placeUnit(G, "GE", "eliteCorps", "berlin", 1);
    const colonial = placeUnit(G, "GE", "eliteColonialEf", "vienna", 1);
    const zouave = placeUnit(G, "FR", "zouave", "paris", 1);

    const eliminated = eliminateAloneEliteUnits(G);

    expect(eliminated.map((entry) => entry.unitId).sort()).toEqual([ec.id, colonial.id, zouave.id].sort());
    expect(G.units[ec.id]).toBeUndefined();
    expect(G.units[colonial.id]).toBeUndefined();
    expect(G.units[zouave.id]).toBeUndefined();
    expect(G.log.some((entry) => entry.key === "aloneEliteEliminated")).toBe(true);
  });

  test("a counter stacked with one of its own armies stays", () => {
    const G = blank();
    placeUnit(G, "GE", "army", "berlin", 2);
    const ec = placeUnit(G, "GE", "eliteCorps", "berlin", 1);
    const colonial = placeUnit(G, "GE", "eliteColonialEf", "berlin", 1);

    expect(eliminateAloneEliteUnits(G)).toHaveLength(0);
    expect(G.units[ec.id]).toBeDefined();
    expect(G.units[colonial.id]).toBeDefined();
  });

  test("another power's army does not shelter a counter, and a sweeper is idempotent", () => {
    const G = blank();
    G.phase = "wartime";
    G.war = warState("GE", "FR");
    placeUnit(G, "FR", "army", "berlin", 2);
    const ec = placeUnit(G, "GE", "eliteCorps", "berlin", 1);

    expect(eliminateAloneEliteUnits(G)).toHaveLength(1);
    expect(G.units[ec.id]).toBeUndefined();
    // A second pass over the settled board changes nothing.
    expect(eliminateAloneEliteUnits(G)).toHaveLength(0);
  });

  test("5.1.4 EFs and 5.1.2 reserve armies are not swept by the EC clause", () => {
    const G = blank();
    const ef = placeUnit(G, "GE", "expeditionary", "berlin", 1);
    const reserve = placeUnit(G, "GE", "reserveArmy", "vienna", 1);

    expect(eliminateAloneEliteUnits(G)).toHaveLength(0);
    expect(G.units[ef.id]).toBeDefined();
    expect(G.units[reserve.id]).toBeDefined();
  });

  test("the campaign setup's own lone counters are exempt until the game moves on", () => {
    // The real fixture: a FR Zouave starts alone in Algeria.
    const placed = setupImperialElegy(makeCtx());
    const zouave = Object.values(placed.units).find((unit) => unit.kind === "zouave" && unit.owner === "FR");
    expect(zouave?.space).toBe("algeria");
    // While its own start turn is the live turn the printed placement stands.
    expect(eliminateAloneEliteUnits(placed, {space: "algeria"})).toHaveLength(0);
    expect(placed.units[zouave!.id]).toBeDefined();
    // Once the game has moved past that turn, the bare counter is eliminated.
    placed.turn += 1;
    expect(eliminateAloneEliteUnits(placed, {space: "algeria"})).toHaveLength(1);
    expect(placed.units[zouave!.id]).toBeUndefined();
  });

  test("the impulse boundary sweeps a counter an army left behind", () => {
    const G = blank();
    G.phase = "action";
    G.activePower = "GE";
    G.powers.GE.flags.homeChosen = true;
    G.turnIndex = 4;
    const army = placeUnit(G, "GE", "army", "berlin", 2);
    const ec = placeUnit(G, "GE", "eliteCorps", "berlin", 1);

    // The army leaves without its EC (a redeployment path that is legal in the
    // engine), then the impulse ends.
    G.spaces.berlin.units = G.spaces.berlin.units.filter((id) => id !== army.id);
    G.spaces.bavaria.units.push(army.id);
    army.space = "bavaria";

    beginImpulseUpkeep(G, makeCtx(), "GE");
    expect(G.units[ec.id]).toBeUndefined();
    expect(unitsInSpace(G, "berlin")).toEqual([]);
  });

  test("a live redeployment of the army that carried it is settled at the next upkeep", () => {
    const G = blank();
    G.phase = "action";
    G.activePower = "GE";
    G.turnIndex = 4;
    for (const space of ["berlin", "saxony"]) G.spaces[space].control = "GE";
    const army = placeUnit(G, "GE", "army", "berlin", 2);
    const ec = placeUnit(G, "GE", "eliteCorps", "berlin", 1);
    G.powers.GE.hand = [];
    G.cpRemaining = 3;
    G.powers.GE.flags.homeChosen = true;

    expect(redeploy(G, makeCtx([], seat("GE")), army.id, "saxony")).toBeUndefined();
    // The EC stayed behind: the move alone does not sweep it.
    expect(G.units[ec.id]).toBeDefined();
    expect(unitsInSpace(G, "berlin")).toEqual(["eliteCorps"]);

    beginImpulseUpkeep(G, makeCtx(), "GE");
    expect(G.units[ec.id]).toBeUndefined();
  });

  test("a battle in which the covering army is destroyed eliminates its EC", () => {
    const G = blank();
    const ctx = makeCtx([6, 1]);
    G.phase = "wartime";
    G.activePower = "GE";
    G.war = warState("GE", "FR");
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    for (const power of POWERS) {
      G.powers[power].hand = [];
      G.powers[power].gwCard = null;
    }
    G.spaces.berlin.control = "GE";
    G.spaces.saxony.control = "FR";
    placeUnit(G, "GE", "army", "berlin", 2);
    const defender = placeUnit(G, "FR", "army", "saxony", 2);
    const ec = placeUnit(G, "FR", "eliteCorps", "saxony", 1);

    const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    expect(battle).not.toBeNull();
    // The dice are the whole battle in this fixture.
    G.pending = null;
    G.pendingStack = [];
    battle!.attackerDrm = 0;
    battle!.defenderDrm = 0;
    resolveBattleRoll(G, ctx);

    // The defending army was eliminated by the decisive result; its EC cannot
    // be left standing in the battle space.
    expect(G.units[defender.id]).toBeUndefined();
    expect(G.units[ec.id]).toBeUndefined();
  });
});
