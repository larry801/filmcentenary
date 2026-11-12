/**
 * Rule 19.8 — "After the loser retreats, if the active player won the naval
 * battle, the active player may move any of their units that participated in
 * the naval battle (including an accompanying land unit) into an adjacent
 * friendly port space(s)."
 *
 * "any of their units" and "space(s)" allow a partial move and a split across
 * several ports, subject to 5.5.4 port capacity.  The engine used to offer one
 * whole-force destination only.  These tests pin the live per-unit/subset
 * decision, its capacity handling, and the deterministic option cover.
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, SpaceId, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {SPACES} from "./constant/spaces";
import {placeUnit, removeUnit} from "./engine/effects";
import {beginNavalBattle, finishBattle} from "./engine/combat";
import {navalUnitsIn} from "./engine/rules";
import {resolvePending} from "./moves";

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

const clearNaval = (G: ImperialElegyState): void => {
  for (const unit of Object.values(G.units)) if (unit.naval) removeUnit(G, unit.id);
};

interface BoxBattleOptions {
  ships?: number;
  army?: boolean;
  /** UK ships already in London before the battle (capacity prefill). */
  londonShips?: number;
  /** Restrict the adjacent friendly ports to this set (for option-count tests). */
  friendlyPorts?: SpaceId[];
}

/**
 * UK wins a naval battle in the North Atlantic against one FR squadron, then
 * `finishBattle` opens the 19.8 port continuation.
 */
const boxBattle = (options: BoxBattleOptions = {}): {
  G: ImperialElegyState;
  ctx: Ctx;
  ships: string[];
  army?: string;
} => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = "UK";
  G.turnIndex = 0;
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
  clearNaval(G);
  placeUnit(G, "FR", "squadron", "north-atlantic", 2);
  const ships: string[] = [];
  for (let i = 0; i < (options.ships ?? 2); i += 1) {
    ships.push(placeUnit(G, "UK", "squadron", "north-atlantic", 2).id);
  }
  const army = options.army ? placeUnit(G, "UK", "army", "north-atlantic", 2).id : undefined;
  if (options.friendlyPorts !== undefined) {
    const allowed = new Set(options.friendlyPorts);
    for (const def of Object.values(SPACES)) {
      if (def.ports?.includes("north-atlantic") !== true) continue;
      G.spaces[def.id].control = allowed.has(def.id) ? "UK" : "FR";
      G.spaces[def.id].influence = null;
      G.spaces[def.id].ally = null;
      G.spaces[def.id].occupiedBy = null;
    }
  }
  for (let i = 0; i < (options.londonShips ?? 0); i += 1) {
    placeUnit(G, "UK", "squadron", "london", 2);
  }
  // Hold the battle at the pre-dice card window, then declare the attacker the
  // winner and finish the battle by hand.
  G.powers.UK.hand = ["IE-A061"];
  const ctx = makeCtx([], seat("UK"));
  const battle = beginNavalBattle(G, ctx, "UK", "north-atlantic", "north-atlantic");
  if (!battle) throw new Error("naval battle did not start");
  G.pending = null;
  battle.winner = "attacker";
  battle.attackerLosses = 0;
  battle.defenderLosses = 0;
  finishBattle(G, ctx);
  return {G, ctx, ships, army};
};

interface Assignment {
  unitId: string;
  space: SpaceId | null;
}

const assignmentsOf = (optionData: unknown): Assignment[] | null => {
  if (optionData === null || typeof optionData !== "object") return null;
  const raw = (optionData as {assignments?: unknown}).assignments;
  if (!Array.isArray(raw)) return null;
  return raw as Assignment[];
};

const splitOptions = (G: ImperialElegyState): {id: string; assignments: Assignment[]}[] =>
  G.pending!.options
    .map((entry) => ({id: entry.id, assignments: assignmentsOf(entry.data)}))
    .filter((entry): entry is {id: string; assignments: Assignment[]} => entry.assignments !== null);

describe("19.8 split port continuation", () => {
  test("the decision offers whole-force ports and per-unit splits", () => {
    const {G, army} = boxBattle({ships: 2, army: true});
    expect(G.pending?.kind).toBe("navalPortContinuation");
    const ids = G.pending!.options.map((entry) => entry.id);
    expect(ids).toContain("london");
    expect(ids).toContain("stay");
    const splits = splitOptions(G);
    expect(splits.length).toBeGreaterThan(0);
    // At least one split uses two different ports ("space(s)" in 19.8).
    expect(splits.some((entry) => {
      const spaces = new Set(entry.assignments.filter((a) => a.space !== null).map((a) => a.space));
      return spaces.size > 1;
    })).toBe(true);
    // The accompanying land unit is one of the participants.
    if (army) expect(G.pending?.context?.unitIds).toContain(army);
  });

  test("a split assignment moves each named unit to its own port", () => {
    const {G, ships, army} = boxBattle({ships: 2, army: true});
    const all = [...ships, ...(army ? [army] : [])];
    const option = splitOptions(G).find((entry) => {
      const spaces = new Set(entry.assignments.filter((a) => a.space !== null).map((a) => a.space));
      return spaces.size >= 2;
    });
    expect(option).toBeDefined();
    expect(resolvePending(G, makeCtx([], seat("UK")), option!.id)).toBeUndefined();
    expect(G.pending).toBeNull();
    for (const entry of option!.assignments) {
      if (entry.space !== null) expect(G.units[entry.unitId].space).toBe(entry.space);
    }
    const unassigned = all.filter(
      (id) => !option!.assignments.some((entry) => entry.unitId === id && entry.space !== null),
    );
    for (const id of unassigned) expect(G.units[id].space).toBe("north-atlantic");
    const log = G.log.filter((entry) => entry.key === "navalPortContinuation").pop();
    expect(String(log?.args?.destinations)).toContain(",");
    expect(log?.args?.split).toBe(true);
  });

  test("the force may move a single participating unit and leave the rest at sea", () => {
    const {G, ships, army} = boxBattle({ships: 2, army: true});
    const all = [...ships, ...(army ? [army] : [])];
    const option = splitOptions(G).find((entry) => {
      const moving = entry.assignments.filter((a) => a.space !== null);
      return moving.length === 1;
    });
    expect(option).toBeDefined();
    expect(resolvePending(G, makeCtx([], seat("UK")), option!.id)).toBeUndefined();
    const moving = option!.assignments.filter((a) => a.space !== null);
    expect(G.units[moving[0].unitId].space).toBe(moving[0].space);
    for (const id of all.filter((id) => id !== moving[0].unitId)) {
      expect(G.units[id].space).toBe("north-atlantic");
    }
    const log = G.log.filter((entry) => entry.key === "navalPortContinuation").pop();
    expect(log?.args?.units).toBe(1);
  });

  test("above 32 but below the list limit every legal split is enumerated", () => {
    const {G} = boxBattle({ships: 4, friendlyPorts: ["london", "wales"]});
    expect(G.pending?.kind).toBe("navalPortContinuation");
    // 4 units x (2 ports + stay) = 81 assignments; the two all-in-one-port
    // assignments are the plain group options and all-stay is the "stay"
    // option, leaving 78 real splits.
    const splits = splitOptions(G);
    expect(splits).toHaveLength(81 - 2 - 1);
    expect(G.pending!.options.some((entry) => entry.id === "custom")).toBe(false);
    // A mixed 2/2 assignment is present, proving the old deterministic cover
    // (single-unit divergences only) is gone.
    expect(
      splits.some((entry) => {
        const counts = new Map<SpaceId, number>();
        for (const part of entry.assignments) {
          if (part.space === null) continue;
          counts.set(part.space, (counts.get(part.space) ?? 0) + 1);
        }
        return counts.get("london") === 2 && counts.get("wales") === 2;
      }),
    ).toBe(true);
  });

  test("a force larger than a port's capacity is split across ports", () => {
    const {G, ctx} = boxBattle({ships: 5});
    expect(G.pending?.kind).toBe("navalPortContinuation");
    // No single port can hold five ships (5.5.4), so no plain destination is
    // offered.  Above the single-list limit the complete per-unit chooser is
    // used instead of a lossy deterministic cover; below it every split is
    // listed directly.
    const ids = G.pending!.options.map((entry) => entry.id);
    expect(ids.filter((id) => !id.startsWith("split:") && id !== "stay" && id !== "custom")).toEqual([]);
    const movingAssignments: Assignment[] = [];
    if (ids.includes("custom")) {
      expect(resolvePending(G, ctx, "custom")).toBeUndefined();
      let guard = 0;
      while (G.pending?.kind === "navalPortContinuation" && G.pending.context?.stage === "unit") {
        guard += 1;
        if (guard > 20) throw new Error("the per-unit 19.8 chooser did not finish");
        const unitId = String(G.pending.context?.unitIds?.[Number(G.pending.context?.index)] ?? "");
        const port = G.pending.options.find((entry) => entry.id.startsWith("to:"));
        expect(port).toBeDefined();
        const space = port!.id.slice("to:".length) as SpaceId;
        movingAssignments.push({unitId, space});
        expect(resolvePending(G, ctx, port!.id)).toBeUndefined();
      }
    } else {
      const option = splitOptions(G).find(
        (entry) => entry.assignments.filter((a) => a.space !== null).length === 5,
      );
      expect(option).toBeDefined();
      movingAssignments.push(...option!.assignments.filter((a) => a.space !== null));
      expect(resolvePending(G, ctx, option!.id)).toBeUndefined();
    }
    expect(G.pending).toBeNull();
    const counts = new Map<SpaceId, number>();
    for (const entry of movingAssignments) {
      if (entry.space === null) continue;
      counts.set(entry.space, (counts.get(entry.space) ?? 0) + 1);
    }
    expect(counts.size).toBeGreaterThan(1);
    for (const [space, count] of counts) {
      expect(count).toBeLessThanOrEqual(4);
      expect(navalUnitsIn(G, space).filter((unit) => unit.owner === "UK").length).toBeGreaterThanOrEqual(count);
    }
    // Every participating ship left the box.
    expect(navalUnitsIn(G, "north-atlantic").filter((unit) => unit.owner === "UK")).toHaveLength(0);
  });

  test("a port at capacity (5.5.4) is not offered for a whole-force move", () => {
    const {G} = boxBattle({ships: 2, londonShips: 3});
    expect(G.pending?.kind).toBe("navalPortContinuation");
    const ids = G.pending!.options.map((entry) => entry.id);
    expect(ids).not.toContain("london");
    // No split may put both battle ships into London: 3 + 2 > 4.
    for (const option of splitOptions(G)) {
      const toLondon = option.assignments.filter((entry) => entry.space === "london").length;
      expect(toLondon).toBeLessThanOrEqual(1);
    }
    const one = splitOptions(G).find(
      (entry) => entry.assignments.filter((a) => a.space === "london").length === 1,
    );
    expect(one).toBeDefined();
    expect(resolvePending(G, makeCtx([], seat("UK")), one!.id)).toBeUndefined();
    expect(navalUnitsIn(G, "london")).toHaveLength(4);
  });

  test("a stale or capacity-violating split id is rejected and the choice stays open", () => {
    const {G, ships} = boxBattle({ships: 2, londonShips: 3});
    expect(G.pending?.kind).toBe("navalPortContinuation");
    // London is at capacity for a whole-force move, so the plain id is not an
    // option even though London is an adjacent friendly port.
    expect(resolvePending(G, makeCtx([], seat("UK")), "london")).toBe(INVALID_MOVE);
    // A hand-crafted split that overstacks London must be rejected too.  Inject
    // the id into the offered list so resolution itself, not the membership
    // check, has to catch the 5.5.4 violation.
    const overstacked = `split:${ships[0]}@london|${ships[1]}@london`;
    G.pending!.options.push({
      id: overstacked,
      label: "overstacked London",
      data: {assignments: [{unitId: ships[0], space: "london"}, {unitId: ships[1], space: "london"}]},
    });
    expect(resolvePending(G, makeCtx([], seat("UK")), overstacked)).toBe(INVALID_MOVE);
    expect(resolvePending(G, makeCtx([], seat("UK")), "split:not-a-unit@london")).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("navalPortContinuation");
    expect(G.units[ships[0]].space).toBe("north-atlantic");
  });

  test("only the winning active player answers the split decision", () => {
    const {G} = boxBattle({ships: 2});
    const split = splitOptions(G)[0];
    expect(split).toBeDefined();
    expect(resolvePending(G, makeCtx([], seat("FR")), split.id)).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("navalPortContinuation");
  });
});
