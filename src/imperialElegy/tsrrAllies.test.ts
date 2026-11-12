/**
 * 15.4 / 15.2.5 / 27.5 — the Trans-Siberian Railroad and allied armies.
 *
 * Two printed points are pinned here:
 *   - 15.4: "Minor powers that are allied to a player move as part of their
 *     controlling player's march, rail, and naval movement actions", so the
 *     free 33.5 TSRR allowance can carry a controlled allied minor's army (and
 *     only during wartime — 12.8 limits the player's control of a minor's
 *     units to wartime).
 *   - 15.2.5 + 27.5: the GW rail action uses the wartime rail rule, so the
 *     TSRR connections are open only when the railroad is complete and only to
 *     RU and players allied to RU.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {GreatWarState, ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {performGwManeuver} from "./engine/greatWarFlow";
import {tsrrMinorRailDecision, tsrrRailMove} from "./moves";

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

const lastLog = (G: ImperialElegyState, key: string) =>
  [...G.log].reverse().find((entry) => entry.key === key);

const makeWar = (attacker: Power, defender: Power, overrides: Partial<WarState> = {}): WarState => ({
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
  victor: "defender",
  truceTurns: 0,
  passed: [],
  startedTurn: 1,
  ...overrides,
});

const moveUnit = (G: ImperialElegyState, unitId: string, to: string): void => {
  const unit = G.units[unitId];
  if (unit.space) G.spaces[unit.space].units = G.spaces[unit.space].units.filter((id) => id !== unitId);
  G.spaces[to].units.push(unitId);
  unit.space = to;
};

/** Wartime, FR active and allied to RU, with Serbia controlled by FR. */
const wartimeWithSerbianArmy = (): {G: ImperialElegyState; unitId: string} => {
  const G = fresh();
  G.powers.RU.tsrr = true;
  G.powers.RU.alliance = "teCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.phase = "wartime";
  G.activePower = "FR";
  G.war = makeWar("RU", "OT", {attackerAllies: ["FR"]});
  G.war.status = "maneuver";
  G.war.budgets.FR = 6;
  G.spaces.serbia.ally = "FR";
  const unit = placeUnit(G, "Serbia", "minorArmy", "moscow", 2);
  return {G, unitId: unit.id};
};

// ---------------------------------------------------------------------------
// The free 33.5 allowance (15.4)
// ---------------------------------------------------------------------------

describe("15.4 the free TSRR rail move can carry a controlled minor's army", () => {
  test("FR (an RU ally) rails its controlled Serbian army and the counter stays Serbian", () => {
    const {G, unitId} = wartimeWithSerbianArmy();
    const decision = tsrrMinorRailDecision(G, "FR", unitId, "urals");
    expect(decision?.allowed).toBe(true);
    expect(tsrrRailMove(G, makeCtx([], seat("FR")), unitId, "urals")).toBeUndefined();
    expect(G.units[unitId].space).toBe("urals");
    expect(G.units[unitId].owner).toBe("Serbia");
    expect(G.units[unitId].kind).toBe("minorArmy");
    // The controller's once-per-impulse bookkeeping is the one that is spent.
    expect(G.powers.FR.flags.tsrrRailImpulse).toBeDefined();
    expect(lastLog(G, "tsrrRail")?.args).toMatchObject({unitId, from: "moscow", to: "urals"});
  });

  test("a second rail in the same impulse is refused", () => {
    const {G, unitId} = wartimeWithSerbianArmy();
    expect(tsrrRailMove(G, makeCtx([], seat("FR")), unitId, "urals")).toBeUndefined();
    expect(tsrrRailMove(G, makeCtx([], seat("FR")), unitId, "tsaritsyn")).toBe(INVALID_MOVE);
    expect(lastLog(G, "tsrrRailRejected")?.args?.reasons).toMatch(/already used this impulse/);
    expect(G.units[unitId].space).toBe("urals");
  });

  test("the minor must be controlled by the railing power", () => {
    const {G, unitId} = wartimeWithSerbianArmy();
    G.spaces.serbia.ally = null;
    expect(tsrrMinorRailDecision(G, "FR", unitId, "urals")).toBeNull();
    expect(tsrrRailMove(G, makeCtx([], seat("FR")), unitId, "urals")).toBe(INVALID_MOVE);
    expect(lastLog(G, "tsrrRailRejected")?.args?.reasons).toMatch(/not owned by this power/);
  });

  test("a controller on the other side of the war cannot use the line", () => {
    const {G, unitId} = wartimeWithSerbianArmy();
    G.war = makeWar("RU", "OT", {defenderAllies: ["FR"]});
    const decision = tsrrMinorRailDecision(G, "FR", unitId, "urals");
    expect(decision?.allowed).toBe(false);
    expect(decision?.reasons.join(" | ")).toMatch(/Only Russia/);
    expect(tsrrRailMove(G, makeCtx([], seat("FR")), unitId, "urals")).toBe(INVALID_MOVE);
  });

  test("the minor's EC is not an army counter", () => {
    const {G} = wartimeWithSerbianArmy();
    const ec = placeUnit(G, "Serbia", "eliteCorps", "moscow", 1);
    const decision = tsrrMinorRailDecision(G, "FR", ec.id, "urals");
    expect(decision?.allowed).toBe(false);
    expect(decision?.reasons.join(" | ")).toMatch(/Only one army/);
    expect(tsrrRailMove(G, makeCtx([], seat("FR")), ec.id, "urals")).toBe(INVALID_MOVE);
  });

  test("a controlled minor's army cannot use the free move in the action phase", () => {
    const {G, unitId} = wartimeWithSerbianArmy();
    G.phase = "action";
    G.war = null;
    const decision = tsrrMinorRailDecision(G, "FR", unitId, "urals");
    expect(decision?.allowed).toBe(false);
    expect(decision?.reasons.join(" | ")).toMatch(/Only Russia|wartime/);
    expect(tsrrRailMove(G, makeCtx([], seat("FR")), unitId, "urals")).toBe(INVALID_MOVE);
  });

  test("the railroad must be complete", () => {
    const {G, unitId} = wartimeWithSerbianArmy();
    G.powers.RU.tsrr = false;
    const decision = tsrrMinorRailDecision(G, "FR", unitId, "urals");
    expect(decision?.allowed).toBe(false);
    expect(decision?.reasons.join(" | ")).toMatch(/not complete/);
  });
});

// ---------------------------------------------------------------------------
// The GW rail action (27.5 + 15.2.5)
// ---------------------------------------------------------------------------

const baseGw = (overrides: Partial<GreatWarState> = {}): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = {
    active: true,
    turn: 1,
    order: ["GE", "FR", "RU"],
    belligerents: ["GE", "FR", "RU"],
    neutrals: ["UK", "AU", "OT"],
    te: ["FR", "RU"],
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
  };
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.powers.RU.alliance = "teCommitted";
  G.phase = "gwManeuver";
  G.powers.RU.tsrr = true;
  return G;
};

const gwActorWithArmy = (
  G: ImperialElegyState,
  power: Power,
  space = "moscow",
): {ctx: Ctx; unitId: string} => {
  G.activePower = power;
  G.powers[power].gwBudget = 3;
  const army = Object.values(G.units).find((unit) => unit.owner === power && unit.kind === "army")!;
  moveUnit(G, army.id, space);
  return {ctx: makeCtx([], seat(power)), unitId: army.id};
};

describe("27.5/15.2.5 GW rail moves and the TSRR", () => {
  test("RU may rail an army along the completed railroad", () => {
    const G = baseGw();
    const {ctx, unitId} = gwActorWithArmy(G, "RU");
    const res = performGwManeuver(G, ctx, {kind: "rail", power: "RU", unitId, to: "urals"});
    expect(res.ok).toBe(true);
    expect(G.units[unitId].space).toBe("urals");
  });

  test("an RU ally may rail along the completed railroad", () => {
    const G = baseGw();
    const {ctx, unitId} = gwActorWithArmy(G, "FR");
    const res = performGwManeuver(G, ctx, {kind: "rail", power: "FR", unitId, to: "urals"});
    expect(res.ok).toBe(true);
    expect(G.units[unitId].space).toBe("urals");
  });

  test("nobody may use the TSRR connections while the railroad is incomplete", () => {
    const G = baseGw();
    G.powers.RU.tsrr = false;
    const {ctx, unitId} = gwActorWithArmy(G, "FR");
    const res = performGwManeuver(G, ctx, {kind: "rail", power: "FR", unitId, to: "urals"});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/No friendly rail path|formerly controlled/);
    expect(G.units[unitId].space).toBe("moscow");
  });

  test("a power not allied to RU may not use the TSRR connections", () => {
    const G = baseGw();
    // Give GE a friendly corridor along the same route so only the TSRR rule
    // can stop the move.
    for (const space of ["moscow", "orel", "tsaritsyn", "urals"]) G.spaces[space].control = "GE";
    const {ctx, unitId} = gwActorWithArmy(G, "GE");
    const res = performGwManeuver(G, ctx, {kind: "rail", power: "GE", unitId, to: "urals"});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/No friendly rail path|formerly controlled/);
    // The ordinary land network is still usable.
    const ordinary = performGwManeuver(G, ctx, {kind: "rail", power: "GE", unitId, to: "orel"});
    expect(ordinary.ok).toBe(true);
    expect(G.units[unitId].space).toBe("orel");
  });
});
