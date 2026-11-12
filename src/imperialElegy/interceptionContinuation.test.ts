/**
 * Rule 19.1 — "Interception rolls interrupt naval movement actions... The
 * active player will be able to finish their naval movement after the
 * interception attempt and subsequent battle (if one occurs)" and "Units using
 * naval movement in European Waters that were intercepted may continuing
 * moving if they won the battle."
 *
 * The move already paid its action when the interception window opened, so the
 * `navalContinuation` decision finishes the move without spending CP again.
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {navalUnitsIn} from "./engine/rules";
import {declinePending, navalMove, resolvePending} from "./moves";

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

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());
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

const clearNaval = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...navalUnitsIn(G, space)]) removeUnit(G, unit.id);
};

/**
 * UK (seat 1) vs FR (seat 2), UK active.  All hands and GW combat slots are
 * emptied so the interception battle auto-resolves with the supplied dice.
 */
const navalWar = (): ImperialElegyState => {
  const G = fresh();
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
  for (const space of ["north-atlantic", "brittany", "london", "western-mediterranean"]) {
    clearNaval(G, space);
  }
  return G;
};

/** UK moves one ship into the North Atlantic where FR ships wait, with a FR
 *  port (Brittany) able to attempt a 19.1 interception. */
const contact = (frInBox = 1): {G: ImperialElegyState; ship: string} => {
  const G = navalWar();
  for (let i = 0; i < frInBox; i += 1) placeUnit(G, "FR", "squadron", "north-atlantic", 2);
  placeUnit(G, "FR", "squadron", "brittany", 2);
  const ship = placeUnit(G, "UK", "squadron", "london", 2).id;
  expect(navalMove(G, makeCtx([], seat("UK")), [ship], "north-atlantic")).toBeUndefined();
  expect(G.pending?.kind).toBe("navalInterception");
  expect(G.pending?.power).toBe("FR");
  return {G, ship};
};

describe("19.1 finishing the interrupted naval movement", () => {
  test("winning the interception battle offers the mover a continuation that costs no CP", () => {
    const {G, ship} = contact();
    // Interception roll 5 (success), then the battle dice: 6 vs 1 (attacker wins).
    expect(resolvePending(G, makeCtx([5, 6, 1], seat("FR")), "intercept:brittany")).toBeUndefined();
    expect(G.battle).toBeNull();
    // 19.8's port-only move comes first; it never offers a naval box.
    expect(G.pending?.kind).toBe("navalPortContinuation");
    expect(G.pending?.power).toBe("UK");
    expect(G.pending?.options.map((option) => option.id)).not.toContain("western-mediterranean");
    // Staying at sea leaves the separate 19.1 continuation available.
    expect(resolvePending(G, makeCtx([], seat("UK")), "stay")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalContinuation");
    expect(G.pending?.power).toBe("UK");
    const ids = G.pending!.options.map((option) => option.id);
    expect(ids).toContain("stop");
    expect(ids).toContain("western-mediterranean");
    // The move already paid its one CP; the decision spends nothing more.
    expect(G.cpRemaining).toBe(5);

    expect(resolvePending(G, makeCtx([], seat("UK")), "western-mediterranean")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.navalContinuation).toBeNull();
    expect(G.units[ship].space).toBe("western-mediterranean");
    expect(G.cpRemaining).toBe(5);
    expect(G.log.some((entry) => entry.key === "navalContinuation" && entry.args?.to === "western-mediterranean")).toBe(true);
  });

  test("a failed interception followed by a won battle still lets the mover finish", () => {
    const {G, ship} = contact();
    // Interception roll 1 fails; the contacted FR fleet chooses to fight and
    // loses (attacker 6 vs defender 1).
    expect(resolvePending(G, makeCtx([1], seat("FR")), "intercept:brittany")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalAvoid");
    expect(resolvePending(G, makeCtx([6, 1], seat("FR")), "fight")).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(G.pending?.kind).toBe("navalPortContinuation");
    expect(resolvePending(G, makeCtx([], seat("UK")), "stay")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalContinuation");
    expect(G.pending?.power).toBe("UK");
    // Still exactly the move's one CP: the continuation did not spend again.
    expect(G.cpRemaining).toBe(5);

    // Declining means "stop here": the ships stay in the box.
    expect(declinePending(G, makeCtx([], seat("UK")))).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.units[ship].space).toBe("north-atlantic");
    expect(G.log.some((entry) => entry.key === "navalContinuation" && entry.args?.stopped === true)).toBe(true);
  });

  test("losing the interception battle offers no continuation", () => {
    const {G} = contact();
    // Interception roll 5 succeeds; the battle dice go the defender's way.
    expect(resolvePending(G, makeCtx([5, 1, 6], seat("FR")), "intercept:brittany")).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(G.pending?.kind).not.toBe("navalContinuation");
    expect(G.navalContinuation).toBeNull();
  });

  test("a successful avoidance still stops the attackers (no continuation)", () => {
    const {G} = contact();
    expect(resolvePending(G, makeCtx([], seat("FR")), "skip")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalAvoid");
    const avoid = G.pending!.options.find((option) => option.id.startsWith("avoid:"));
    expect(avoid).toBeDefined();
    expect(resolvePending(G, makeCtx([6], seat("FR")), avoid!.id)).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.navalContinuation).toBeNull();
  });

  test("only the mover may answer the continuation decision", () => {
    const {G} = contact();
    expect(resolvePending(G, makeCtx([5, 6, 1], seat("FR")), "intercept:brittany")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalPortContinuation");
    expect(resolvePending(G, makeCtx([], seat("FR")), "stay")).toBe(INVALID_MOVE);
    expect(resolvePending(G, makeCtx([], seat("UK")), "stay")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalContinuation");
    expect(resolvePending(G, makeCtx([], seat("FR")), "stop")).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("navalContinuation");
  });

  test("a non-European interception battle offers no continuation (19.1 European Waters)", () => {
    const G = navalWar();
    // A direct South Atlantic contact: FR ships in the box and a FR port
    // (Morocco) adjacent to it.  Starting in the Western Mediterranean keeps
    // the only entered box non-European, so 19.1's continuation does not apply.
    for (const space of ["south-atlantic", "morocco"]) clearNaval(G, space);
    G.spaces.morocco.control = "FR";
    placeUnit(G, "FR", "squadron", "south-atlantic", 2);
    placeUnit(G, "FR", "squadron", "morocco", 2);
    const ship = placeUnit(G, "UK", "squadron", "western-mediterranean", 2).id;
    expect(navalMove(G, makeCtx([], seat("UK")), [ship], "south-atlantic")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalInterception");
    expect(G.pending?.context?.to).toBe("south-atlantic");
    expect(resolvePending(G, makeCtx([5, 6, 1], seat("FR")), "intercept:morocco")).toBeUndefined();
    expect(G.battle).toBeNull();
    // Confirm the mover actually won (otherwise the absence of a continuation
    // would be explained by the loss, not by the European-Waters restriction).
    expect(G.log.some((entry) => entry.key === "battleEnded" && entry.args?.winner === "attacker")).toBe(true);
    expect(G.pending?.kind).not.toBe("navalContinuation");
    expect(G.navalContinuation).toBeNull();
  });
});
