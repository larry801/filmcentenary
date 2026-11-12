/**
 * Rule 19.1 — "During naval movement, when the active player's units move into
 * a naval box that is connected to a port containing enemy naval units, those
 * enemy naval units may attempt to intercept them.  Interception rolls
 * interrupt naval movement actions ...  The active player will be able to
 * finish their naval movement after the interception attempt and subsequent
 * battle."
 *
 * A multi-box 12.3 move therefore pauses at the first intermediate box whose
 * adjacent enemy port can intercept, not only at the final contact.  When the
 * window ends without a battle the move resumes; a won interception battle
 * hands the mover the normal 19.1 continuation.
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {GreatWarState, ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {navalUnitsIn} from "./engine/rules";
import {navalMove, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "1"): Ctx => {
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

const clearAllNaval = (G: ImperialElegyState): void => {
  for (const unit of Object.values(G.units)) if (unit.naval) removeUnit(G, unit.id);
};

/** UK (seat 1) vs FR (seat 2), UK active, no surviving fleets. */
const navalWar = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = "UK";
  G.passed = [];
  G.pending = null;
  G.pendingStack = [];
  G.battle = null;
  G.cpRemaining = 6;
  G.war = warState("UK", "FR");
  for (const power of POWERS) {
    G.powers[power].hand = [];
    G.powers[power].gwCard = null;
  }
  clearAllNaval(G);
  return G;
};

/** London -> Western Mediterranean passes through the North Atlantic. */
const transitMove = (G: ImperialElegyState, to = "western-mediterranean"): string => {
  const ship = placeUnit(G, "UK", "squadron", "london", 2).id;
  expect(navalMove(G, makeCtx([], seat("UK")), [ship], to)).toBeUndefined();
  return ship;
};

describe("19.1 interception on a transit box", () => {
  test("a multi-box move is interrupted at the intermediate box adjacent to an enemy port", () => {
    const G = navalWar();
    G.spaces.brittany.control = "FR";
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const ship = transitMove(G);
    expect(G.pending?.kind).toBe("navalInterception");
    expect(G.pending?.power).toBe("FR");
    expect(G.pending?.context?.to).toBe("north-atlantic");
    expect(G.pending?.options.map((option) => option.id)).toEqual(
      expect.arrayContaining(["intercept:brittany", "skip"]),
    );
    // The move is parked in the transit box, not at its destination yet.
    expect(G.units[ship].space).toBe("north-atlantic");
    expect(G.navalTransit?.index).toBe(1);
    // The action's one CP was already paid by `navalMove`.
    expect(G.cpRemaining).toBe(5);
  });

  test("declining the transit interception resumes the movement to its destination", () => {
    const G = navalWar();
    G.spaces.brittany.control = "FR";
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const ship = transitMove(G);
    expect(resolvePending(G, makeCtx([], seat("FR")), "skip")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.units[ship].space).toBe("western-mediterranean");
    expect(G.navalTransit).toBeNull();
    // No second charge for finishing the same naval movement action.
    expect(G.cpRemaining).toBe(5);
  });

  test("a failed interception roll also resumes the movement", () => {
    const G = navalWar();
    G.spaces.brittany.control = "FR";
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const ship = transitMove(G);
    expect(resolvePending(G, makeCtx([1], seat("FR")), "intercept:brittany")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.units[ship].space).toBe("western-mediterranean");
  });

  test("each succeeding transit box gets its own window, in path order", () => {
    const G = navalWar();
    G.spaces.brittany.control = "FR";
    G.spaces.provence.control = "FR";
    placeUnit(G, "FR", "squadron", "brittany", 2);
    placeUnit(G, "FR", "squadron", "provence", 2);
    const ship = transitMove(G, "south-atlantic");
    // London -> North Atlantic -> Western Mediterranean -> South Atlantic.
    expect(G.pending?.context?.to).toBe("north-atlantic");
    expect(G.pending?.options.map((option) => option.id)).toContain("intercept:brittany");
    expect(resolvePending(G, makeCtx([], seat("FR")), "skip")).toBeUndefined();
    expect(G.pending?.context?.to).toBe("western-mediterranean");
    expect(G.pending?.options.map((option) => option.id)).toContain("intercept:provence");
    expect(resolvePending(G, makeCtx([], seat("FR")), "skip")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.units[ship].space).toBe("south-atlantic");
    expect(G.cpRemaining).toBe(5);
  });

  test("all of a player's eligible ports share one deterministic window", () => {
    const G = navalWar();
    G.spaces.brittany.control = "FR";
    G.spaces.picardy.control = "FR";
    placeUnit(G, "FR", "squadron", "brittany", 2);
    placeUnit(G, "FR", "squadron", "picardy", 2);
    transitMove(G);
    expect(G.pending?.kind).toBe("navalInterception");
    expect(G.pending?.power).toBe("FR");
    const ids = G.pending?.options.map((option) => option.id) ?? [];
    expect(ids).toContain("intercept:brittany");
    expect(ids).toContain("intercept:picardy");
    const candidates = G.pending?.context?.candidates as string[];
    // Stable port order: Brittany before Picardy.
    expect(candidates.indexOf("FR|brittany")).toBeLessThan(candidates.indexOf("FR|picardy"));
  });

  test("the window belongs to the intercepting seat", () => {
    const G = navalWar();
    G.spaces.brittany.control = "FR";
    placeUnit(G, "FR", "squadron", "brittany", 2);
    transitMove(G);
    expect(resolvePending(G, makeCtx([5], seat("UK")), "intercept:brittany")).toBe(INVALID_MOVE);
    expect(resolvePending(G, makeCtx([5], seat("GE")), "skip")).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("navalInterception");
  });
});

describe("19.1 finishing a transit-intercepted move", () => {
  test("winning the transit battle offers the 19.1 continuation at no extra cost", () => {
    const G = navalWar();
    G.spaces.brittany.control = "FR";
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const ship = transitMove(G);
    // Interception roll 5 (success), then a decisive attacker win (6 vs 1).
    expect(resolvePending(G, makeCtx([5, 6, 1], seat("FR")), "intercept:brittany")).toBeUndefined();
    expect(G.battle).toBeNull();
    // 19.8's port-only choice is offered first; staying at sea hands over to the
    // separate 19.1 "finish the movement" continuation.
    expect(G.pending?.kind).toBe("navalPortContinuation");
    expect(resolvePending(G, makeCtx([], seat("UK")), "stay")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalContinuation");
    expect(G.pending?.power).toBe("UK");
    expect(G.pending?.options.map((option) => option.id)).toContain("western-mediterranean");
    expect(G.cpRemaining).toBe(5);
    expect(resolvePending(G, makeCtx([], seat("UK")), "western-mediterranean")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.units[ship].space).toBe("western-mediterranean");
    expect(G.cpRemaining).toBe(5);
  });
});

describe("19.1 destination-box interception", () => {
  test("a destination box with no enemy ships can still be intercepted from an adjacent port", () => {
    const G = navalWar();
    G.spaces.brittany.control = "FR";
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const ship = transitMove(G, "north-atlantic");
    expect(G.units[ship].space).toBe("north-atlantic");
    expect(G.pending?.kind).toBe("navalInterception");
    expect(G.pending?.power).toBe("FR");
    expect(resolvePending(G, makeCtx([], seat("FR")), "skip")).toBeUndefined();
    // Nothing to fight in the box: the move simply ends there.
    expect(G.pending).toBeNull();
    expect(G.battle).toBeNull();
    expect(G.units[ship].space).toBe("north-atlantic");
    expect(G.log.some((entry) => entry.key === "battleEnded")).toBe(false);
  });

  test("a fleet sitting in the destination port is the 19.2 contact, not a transit interceptor", () => {
    const G = navalWar();
    G.spaces.brittany.control = "FR";
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const ship = placeUnit(G, "UK", "squadron", "london", 2).id;
    expect(navalMove(G, makeCtx([], seat("UK")), [ship], "brittany")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalAvoid");
    expect(G.pending?.power).toBe("FR");
    expect(G.units[ship].space).toBe("brittany");
  });
});

// ---------------------------------------------------------------------------
// 19.1 transit interception in the Great War maneuver step
// ---------------------------------------------------------------------------

const gwState = (): GreatWarState => ({
  active: true,
  turn: 1,
  order: ["GE", "FR", "RU"],
  belligerents: ["GE", "FR", "RU"],
  neutrals: ["UK", "AU", "OT"],
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
});

const gwManeuver = (): ImperialElegyState => {
  const G = navalWar();
  G.gw = gwState();
  G.phase = "gwManeuver";
  G.activePower = "GE";
  G.turnIndex = 0;
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.powers.GE.gwBudget = 6;
  G.powers.GE.flags.gwActionsThisImpulse = 0;
  G.powers.GE.flags.passedGw = false;
  return G;
};

describe("19.1 transit interception in a GW naval maneuver", () => {
  test("the maneuver spends one budget point and resumes from the transit box", () => {
    const G = gwManeuver();
    G.spaces.brittany.control = "FR";
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const mover = placeUnit(G, "GE", "squadron", "pomerania", 2).id;
    expect(navalMove(G, makeCtx([], seat("GE")), [mover], "western-mediterranean")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalInterception");
    expect(G.pending?.power).toBe("FR");
    expect(G.pending?.context?.to).toBe("north-atlantic");
    expect(G.units[mover].space).toBe("north-atlantic");
    // One GW budget point for the whole maneuver, even though it is split.
    expect(G.powers.GE.gwBudget).toBe(5);
    expect(resolvePending(G, makeCtx([], seat("FR")), "skip")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.units[mover].space).toBe("western-mediterranean");
    expect(G.powers.GE.gwBudget).toBe(5);
  });

  test("a GW destination box with no enemy ships can still be intercepted", () => {
    const G = gwManeuver();
    G.spaces.brittany.control = "FR";
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const mover = placeUnit(G, "GE", "squadron", "pomerania", 2).id;
    expect(navalMove(G, makeCtx([], seat("GE")), [mover], "north-atlantic")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalInterception");
    expect(G.pending?.context?.to).toBe("north-atlantic");
    expect(G.units[mover].space).toBe("north-atlantic");
    expect(G.powers.GE.gwBudget).toBe(5);
    expect(resolvePending(G, makeCtx([], seat("FR")), "skip")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.battle).toBeNull();
    expect(G.units[mover].space).toBe("north-atlantic");
  });
});
