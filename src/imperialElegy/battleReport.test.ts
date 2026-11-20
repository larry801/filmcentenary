/**
 * The after-battle report is public state, not only a log line.
 *
 * It records the dice, the winner and — the part the table asked for — the
 * losses each side actually took.  The CRT budget is not enough: a
 * `combatLosses` answer decrements it, so the report counts the loss
 * applications themselves.  Keeping the report in `G` is also what lets every
 * client raise the same dialog instead of only the seat that answered.
 */

import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {beginLandBattle, resolveBattleRoll} from "./engine/combat";
import {redactForView} from "./engine/privacy";
import {landUnitsIn} from "./engine/rules";

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
    phase: "wartime",
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

const clearLand = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...landUnitsIn(G, space)]) removeUnit(G, unit.id);
};

/**
 * One GE army attacks one FR army.  With a single loss candidate per side the
 * engine takes the losses deterministically (no `combatLosses` dialogue), so
 * the fixture exercises the same `applyOneLoss` path a real battle uses.
 */
const fixture = (dice: number[]): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  const ctx = makeCtx(dice);
  G.phase = "wartime";
  G.activePower = "GE";
  G.war = warState("GE", "FR");
  G.pending = null;
  G.pendingStack = [];
  G.battle = null;
  G.battleReport = null;
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  for (const power of POWERS) {
    G.powers[power].hand = [];
    G.powers[power].gwCard = null;
  }
  for (const space of ["berlin", "saxony"]) {
    clearLand(G, space);
    G.spaces[space].control = space === "berlin" ? "GE" : "FR";
    G.spaces[space].ally = null;
  }
  placeUnit(G, "GE", "army", "berlin", 2);
  placeUnit(G, "FR", "army", "saxony", 2);
  const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
  if (!battle) throw new Error("land battle did not start");
  // No support/card windows in this fixture: the dice are the whole battle.
  G.pending = null;
  G.pendingStack = [];
  battle.attackerDrm = 0;
  battle.defenderDrm = 0;
  resolveBattleRoll(G, ctx);
  return G;
};

describe("the public battle report", () => {
  test("records both sides' actual step losses after the dice", () => {
    const G = fixture([4, 4]); // differential 0: the CRT costs each side one step
    expect(G.battle).toBeNull();
    const report = G.battleReport;
    expect(report).not.toBeNull();
    expect(report!.kind).toBe("land");
    expect(report!.attacker).toBe("GE");
    expect(report!.defender).toBe("FR");
    expect(report!.winner).toBe("attacker");
    expect(report!.attackerLosses).toBe(1);
    expect(report!.defenderLosses).toBe(1);
    expect(report!.attackerUnits).toHaveLength(1);
    expect(report!.attackerUnits[0]).toMatchObject({owner: "GE", kind: "army", steps: 1, eliminated: false});
    expect(report!.defenderUnits).toHaveLength(1);
    expect(report!.defenderUnits[0]).toMatchObject({owner: "FR", kind: "army", steps: 1, eliminated: false});
    expect(report!.attackerRoll).toBe(4);
    expect(report!.defenderRoll).toBe(4);
    expect(report!.differential).toBe(0);
    expect(report!.id).toContain("land");
  });

  test("counts every loss application when one side loses its last step", () => {
    const G = fixture([1, 6]); // differential -5: the attacker loses two steps and is eliminated
    expect(G.battleReport!.winner).toBe("defender");
    expect(G.battleReport!.attackerLosses).toBe(2);
    expect(G.battleReport!.defenderLosses).toBe(0);
    expect(G.battleReport!.attackerUnits).toHaveLength(1);
    expect(G.battleReport!.attackerUnits[0]).toMatchObject({
      owner: "GE",
      kind: "army",
      steps: 2,
      eliminated: true,
    });
  });

  test("is public: every opponent's player view keeps the same report", () => {
    const G = fixture([4, 4]);
    const report = G.battleReport;
    const frView = redactForView(G, seat("FR"));
    const geView = redactForView(G, seat("GE"));
    expect(frView.battleReport).toEqual(report);
    expect(geView.battleReport).toEqual(report);
  });
});
