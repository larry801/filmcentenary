/**
 * The CP wallet is chosen once in engine/rules.ts; the UI, moves, legality
 * checks and the bot all read and charge the same one.  These tests pin that
 * choice down, especially the 26.3 US/Italian ally impulses where the major's
 * own budget must be spent instead of the controlling player's.
 */
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, WarState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {cpBudgetFor, spendCpFor} from "./engine/rules";

const makeCtx = (): Ctx =>
  ({
    playerID: "0",
    random: {Die: () => 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const makeGw = (overrides: Partial<GreatWarState> = {}): GreatWarState => ({
  active: true,
  turn: 1,
  order: ["GE", "FR"],
  belligerents: ["GE", "FR"],
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
  ...overrides,
});

const makeWar = (overrides: Partial<WarState> = {}): WarState => ({
  attacker: "GE",
  defender: "FR",
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
  victor: "defender",
  truceTurns: 0,
  passed: [],
  startedTurn: 1,
  ...overrides,
});

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

describe("cpBudgetFor / spendCpFor — one wallet per phase", () => {
  test("action: the shared impulse CP", () => {
    const G = fresh();
    G.phase = "action";
    G.cpRemaining = 5;
    G.powers.GE.gwBudget = 9;
    expect(cpBudgetFor(G, "GE")).toBe(5);
    expect(spendCpFor(G, "GE", 2)).toBe(true);
    expect(G.cpRemaining).toBe(3);
    expect(G.powers.GE.gwBudget).toBe(9);
  });

  test("wartime: the belligerent's war budget, per power", () => {
    const G = fresh();
    G.phase = "wartime";
    G.war = makeWar({budgets: {GE: 4, FR: 2}});
    G.cpRemaining = 7;
    expect(cpBudgetFor(G, "GE")).toBe(4);
    expect(cpBudgetFor(G, "FR")).toBe(2);
    expect(spendCpFor(G, "GE", 3)).toBe(true);
    expect(G.war!.budgets.GE).toBe(1);
    expect(G.cpRemaining).toBe(7);
  });

  test("gwManeuver: the power's own gwBudget", () => {
    const G = fresh();
    G.phase = "gwManeuver";
    G.gw = makeGw();
    G.activePower = "GE";
    G.powers.GE.gwBudget = 6;
    expect(cpBudgetFor(G, "GE")).toBe(6);
    expect(spendCpFor(G, "GE", 2)).toBe(true);
    expect(G.powers.GE.gwBudget).toBe(4);
    expect(G.gw!.usBudget).toBe(4);
  });

  test("26.3: a US ally impulse spends gw.usBudget, not the player's gwBudget", () => {
    const G = fresh();
    G.phase = "gwManeuver";
    G.gw = makeGw({usBudget: 4});
    G.activePower = "GE";
    G.flags.gwAllyImpulse = "US";
    G.powers.GE.gwBudget = 1; // deliberately different from the US budget
    expect(cpBudgetFor(G, "GE")).toBe(4);
    expect(spendCpFor(G, "GE", 1)).toBe(true);
    expect(G.gw!.usBudget).toBe(3);
    expect(G.powers.GE.gwBudget).toBe(1); // untouched
  });

  test("26.3: an Italian ally impulse spends gw.italyBudget", () => {
    const G = fresh();
    G.phase = "gwManeuver";
    G.gw = makeGw({italyBudget: 2});
    G.activePower = "GE";
    G.flags.gwAllyImpulse = "IT";
    G.powers.GE.gwBudget = 8;
    expect(cpBudgetFor(G, "GE")).toBe(2);
    expect(spendCpFor(G, "GE", 1)).toBe(true);
    expect(G.gw!.italyBudget).toBe(1);
    expect(G.powers.GE.gwBudget).toBe(8); // untouched
  });

  test("26.3: the ally wallet only applies to the power taking the impulse", () => {
    const G = fresh();
    G.phase = "gwManeuver";
    G.gw = makeGw({usBudget: 4});
    G.activePower = "GE";
    G.flags.gwAllyImpulse = "US";
    G.powers.FR.gwBudget = 5;
    expect(cpBudgetFor(G, "FR")).toBe(5);
  });

  test("a short wallet refuses to spend and leaves it unchanged", () => {
    const G = fresh();
    G.phase = "action";
    G.cpRemaining = 1;
    expect(spendCpFor(G, "GE", 2)).toBe(false);
    expect(G.cpRemaining).toBe(1);
  });

  test("phases without a CP wallet have no budget", () => {
    const G = fresh();
    G.phase = "gwPlanning";
    G.gw = makeGw();
    G.powers.GE.gwBudget = 3;
    expect(cpBudgetFor(G, "GE")).toBe(0);
    expect(spendCpFor(G, "GE", 1)).toBe(false);
    expect(G.powers.GE.gwBudget).toBe(3);
  });
});
