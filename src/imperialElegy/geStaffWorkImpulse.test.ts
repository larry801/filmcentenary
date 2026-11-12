/**
 * 33.1 Superior Staff Work: "During GE's first impulse of a war or the GW, they
 * may conduct one free deploy reserves action."
 *
 * A Great War turn is not a single impulse: the engine's `gwActionsThisImpulse`
 * resets for every impulse, so the grant must be tied to GE's *first* maneuver
 * impulse of GW turn 0 (latched by `markSuperiorStaffWorkGwImpulse`), not to any
 * later impulse of the same turn.
 */
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  gwImpulseKey,
  markSuperiorStaffWorkGwImpulse,
  superiorStaffWorkGwFreeDeploy,
} from "./engine/characteristics";
import {gwDeploy, gwPass} from "./moves";

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

const gwState = (overrides: Partial<GreatWarState> = {}): GreatWarState => ({
  active: true,
  turn: 0,
  order: ["GE", "FR", "AU"],
  belligerents: ["GE", "FR", "AU"],
  neutrals: ["UK", "RU", "OT"],
  te: ["FR"],
  ta: ["GE", "AU"],
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

const activateGw = (G: ImperialElegyState): void => {
  G.gw = gwState();
  G.phase = "gwManeuver";
  G.activePower = "GE";
  G.turnIndex = 0;
  G.pending = null;
  G.battle = null;
  G.powers.GE.gwBudget = 3;
  G.powers.GE.flags.gwActionsThisImpulse = 0;
};

describe("33.1 Superior Staff Work — first GW impulse", () => {
  test("the grant is only available once GE's first impulse is latched", () => {
    const G = fresh();
    activateGw(G);
    // No latch yet: the pure helper cannot infer the impulse on its own.
    expect(superiorStaffWorkGwFreeDeploy(G)).toBe(false);
    markSuperiorStaffWorkGwImpulse(G);
    expect(G.powers.GE.flags.superiorStaffWorkGwFirst).toBe(gwImpulseKey(G));
    expect(superiorStaffWorkGwFreeDeploy(G)).toBe(true);
  });

  test("a later impulse of GW turn 0 no longer has the grant", () => {
    const G = fresh();
    activateGw(G);
    markSuperiorStaffWorkGwImpulse(G);
    expect(superiorStaffWorkGwFreeDeploy(G)).toBe(true);

    // Next impulse in the same GW turn: the budget counter resets, but the
    // latched first impulse does not move.
    G.turnIndex = 1;
    G.powers.GE.flags.gwActionsThisImpulse = 0;
    expect(gwImpulseKey(G)).not.toBe(G.powers.GE.flags.superiorStaffWorkGwFirst);
    expect(superiorStaffWorkGwFreeDeploy(G)).toBe(false);
  });

  test("after GE acted in its first impulse the free deploy is still the extra action", () => {
    const G = fresh();
    activateGw(G);
    // 15.2: a characteristic may grant a second action in the same impulse.
    G.powers.GE.flags.gwActionsThisImpulse = 1;
    markSuperiorStaffWorkGwImpulse(G);
    expect(superiorStaffWorkGwFreeDeploy(G)).toBe(true);
  });

  test("GW turn 1+ never grants it", () => {
    const G = fresh();
    activateGw(G);
    markSuperiorStaffWorkGwImpulse(G);
    G.gw!.turn = 1;
    G.turnIndex = 0;
    expect(superiorStaffWorkGwFreeDeploy(G)).toBe(false);
  });

  test("a live free deploy is latched, refunded and consumed once", () => {
    const G = fresh();
    activateGw(G);
    const ctx = makeCtx([3], seat("GE"));
    const reserveId = G.powers.GE.reserves[0];
    expect(reserveId).toBeDefined();

    expect(gwDeploy(G, ctx, "berlin")).toBeUndefined();
    expect(G.powers.GE.gwBudget).toBe(3);
    expect(G.units[reserveId].space).toBe("berlin");
    expect(G.powers.GE.flags.superiorStaffWorkGwUsed).toBe(true);
    expect(G.powers.GE.flags.superiorStaffWorkGwFirst).toBe(gwImpulseKey(G));
    expect(superiorStaffWorkGwFreeDeploy(G)).toBe(false);
    expect(G.log.some((entry) => entry.key === "superiorStaffWork" && entry.args?.scope === "gw")).toBe(true);
  });

  test("a first GW impulse that passes forfeits and latches the grant", () => {
    const G = fresh();
    activateGw(G);
    const ctx = makeCtx([3], seat("GE"));
    expect(gwPass(G, ctx)).toBeUndefined();
    expect(G.powers.GE.flags.superiorStaffWorkGwUsed).toBe(true);
    expect(G.powers.GE.flags.superiorStaffWorkGwFirst).toBeDefined();
    expect(G.log.some((entry) => entry.key === "superiorStaffWorkDeclined" && entry.args?.scope === "gw")).toBe(true);
  });

  test("a GE that is not the active power latches nothing", () => {
    const G = fresh();
    activateGw(G);
    G.activePower = "FR";
    markSuperiorStaffWorkGwImpulse(G);
    expect(G.powers.GE.flags.superiorStaffWorkGwFirst).toBeUndefined();
    expect(superiorStaffWorkGwFreeDeploy(G)).toBe(false);
  });
});
