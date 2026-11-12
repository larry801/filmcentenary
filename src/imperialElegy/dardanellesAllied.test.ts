/**
 * Rule 3.4.1(2) — "Units moving between Black Sea and the Eastern
 * Mediterranean Sea Box must pass through the Dardanelles (they must also,
 * therefore, receive permission from the controlling player to do so)."
 *
 * The rule has no allied exception.  The engine used to auto-grant passage when
 * the controller was an ally, which silently skipped the controlling player's
 * decision.  These tests pin the live prompt for an allied controller, the
 * grant/refusal outcomes and the turn scoping of a grant.
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {GreatWarState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {navalUnitsIn} from "./engine/rules";
import {
  dardanellesGate,
  hasDardanellesPermission,
  planNavalMove,
} from "./engine/navalMovement";
import {performGwManeuver} from "./engine/greatWarFlow";
import {declinePending, navalMove, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "4"): Ctx => {
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

const clearNaval = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...navalUnitsIn(G, space)]) removeUnit(G, unit.id);
};

const gwState = (overrides: Partial<GreatWarState> = {}): GreatWarState => ({
  active: true,
  turn: 1,
  order: ["RU", "FR", "OT"],
  belligerents: ["RU", "FR"],
  neutrals: ["GE", "UK", "AU", "OT"],
  te: ["RU", "FR"],
  ta: [],
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

/**
 * RU is active and allied to FR, which controls the Dardanelles.  One RU
 * squadron waits in the Black Sea.
 */
const alliedFixture = (): {G: ImperialElegyState; ship: string} => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = "RU";
  G.passed = [];
  G.pending = null;
  G.pendingStack = [];
  G.battle = null;
  G.cpRemaining = 6;
  G.war = null;
  G.powers.RU.alliance = "teCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.spaces.dardanelles.control = "FR";
  clearNaval(G, "black-sea");
  clearNaval(G, "eastern-mediterranean");
  const ship = placeUnit(G, "RU", "squadron", "black-sea", 2).id;
  return {G, ship};
};

describe("3.4.1 allied Dardanelles controller", () => {
  test("an allied controller is asked instead of being auto-granted", () => {
    const {G, ship} = alliedFixture();
    // The precondition that used to short-circuit the gate.
    expect(G.powers.RU.alliance).toBe(G.powers.FR.alliance);
    expect(hasDardanellesPermission(G, "RU")).toBe(false);
    expect(dardanellesGate(G, "RU", "black-sea", "eastern-mediterranean")).toBe("dardanellesPermission");
    expect(planNavalMove(G, "RU", "black-sea", "eastern-mediterranean")).toMatchObject({
      ok: false,
      reason: "dardanellesPermission",
    });

    expect(navalMove(G, makeCtx([], seat("RU")), [ship], "eastern-mediterranean")).toBeUndefined();
    expect(G.pending?.kind).toBe("dardanellesPassage");
    expect(G.pending?.power).toBe("FR");
    expect(G.pending?.context?.requesting).toBe("RU");
    expect(G.pending?.context?.granting).toBe("FR");
    // Nothing is spent or moved while the ally decides.
    expect(G.cpRemaining).toBe(6);
    expect(G.units[ship].space).toBe("black-sea");
    expect(G.dardanellesPassage).toBeFalsy();
  });

  test("the allied controller can grant passage; the move then proceeds", () => {
    const {G, ship} = alliedFixture();
    expect(navalMove(G, makeCtx([], seat("RU")), [ship], "eastern-mediterranean")).toBeUndefined();
    // Only the allied controller's seat answers; the mover cannot grant itself.
    expect(resolvePending(G, makeCtx([], seat("RU")), "grant")).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("dardanellesPassage");
    expect(resolvePending(G, makeCtx([], seat("FR")), "grant")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.dardanellesPassage).toMatchObject({requesting: "RU", granting: "FR", turn: G.turn});
    expect(hasDardanellesPermission(G, "RU")).toBe(true);

    expect(navalMove(G, makeCtx([], seat("RU")), [ship], "eastern-mediterranean")).toBeUndefined();
    expect(G.units[ship].space).toBe("eastern-mediterranean");
    expect(G.cpRemaining).toBe(5);
  });

  test("the allied controller can refuse, leaving the strait closed", () => {
    const {G, ship} = alliedFixture();
    expect(navalMove(G, makeCtx([], seat("RU")), [ship], "eastern-mediterranean")).toBeUndefined();
    expect(resolvePending(G, makeCtx([], seat("FR")), "refuse")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.dardanellesPassage).toBeFalsy();
    expect(G.units[ship].space).toBe("black-sea");
    expect(planNavalMove(G, "RU", "black-sea", "eastern-mediterranean")).toMatchObject({
      ok: false,
      reason: "dardanellesPermission",
    });
    // A fresh request asks again; `declinePending` answers it as a refusal for
    // an unattended controller rather than silently granting passage.
    expect(navalMove(G, makeCtx([], seat("RU")), [ship], "eastern-mediterranean")).toBeUndefined();
    expect(G.pending?.kind).toBe("dardanellesPassage");
    expect(declinePending(G, makeCtx([], seat("FR")))).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.dardanellesPassage).toBeFalsy();
    expect(G.units[ship].space).toBe("black-sea");
  });

  test("an allied grant is scoped to the turn", () => {
    const {G, ship} = alliedFixture();
    expect(navalMove(G, makeCtx([], seat("RU")), [ship], "eastern-mediterranean")).toBeUndefined();
    expect(resolvePending(G, makeCtx([], seat("FR")), "grant")).toBeUndefined();
    expect(hasDardanellesPermission(G, "RU")).toBe(true);
    G.turn += 1;
    expect(hasDardanellesPermission(G, "RU")).toBe(false);
    expect(planNavalMove(G, "RU", "black-sea", "eastern-mediterranean")).toMatchObject({
      ok: false,
      reason: "dardanellesPermission",
    });
  });

  test("the direct GW maneuver path also asks an allied controller", () => {
    const {G, ship} = alliedFixture();
    G.gw = gwState();
    G.phase = "gwManeuver";
    G.activePower = "RU";
    G.turnIndex = 0;
    G.powers.RU.gwBudget = 4;
    G.powers.RU.flags.gwActionsThisImpulse = 0;
    G.powers.RU.flags.passedGw = false;

    const res = performGwManeuver(G, makeCtx(), {
      kind: "naval",
      power: "RU",
      unitIds: [ship],
      to: "eastern-mediterranean",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.pending).toBe(true);
    expect(G.pending?.kind).toBe("dardanellesPassage");
    expect(G.pending?.power).toBe("FR");
    expect(G.powers.RU.gwBudget).toBe(4);
    expect(G.units[ship].space).toBe("black-sea");

    expect(resolvePending(G, makeCtx([], seat("FR")), "grant")).toBeUndefined();
    const allowed = performGwManeuver(G, makeCtx(), {
      kind: "naval",
      power: "RU",
      unitIds: [ship],
      to: "eastern-mediterranean",
    });
    expect(allowed.ok).toBe(true);
    expect(G.units[ship].space).toBe("eastern-mediterranean");
    expect(G.powers.RU.gwBudget).toBe(3);
  });
});
