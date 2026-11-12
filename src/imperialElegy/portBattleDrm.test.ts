/**
 * Rule 19.5 footnote — a port battle adjacent to two naval boxes: the attacker
 * chooses the box that counts for the "no friendly ports adjacent" / "two more
 * ports" DRMs.  The choice is a live decision opened before the defender's
 * 19.2 avoid roll and is used by `navalAvoidanceModifiers`.
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {navalUnitsIn} from "./engine/rules";
import {portBoxes} from "./constant/spaces";
import {navalAvoidanceModifiers} from "./engine/combat";
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

const navalWar = (): ImperialElegyState => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "UK";
  G.passed = [];
  G.pending = null;
  G.battle = null;
  G.cpRemaining = 6;
  G.war = warState("UK", "FR");
  for (const space of ["north-atlantic", "western-mediterranean", "gibraltar", "london", "malta", "brittany"]) {
    clearNaval(G, space);
  }
  return G;
};

describe("19.5 port-box choice", () => {
  test("Gibraltar touches two naval boxes", () => {
    expect(portBoxes("gibraltar").length).toBeGreaterThan(1);
  });

  test("the chosen box changes the port-count DRMs", () => {
    const G = navalWar();
    G.spaces.gibraltar.control = "FR";
    // UK friendly ports on the North Atlantic (London/Scotland/...) but not in
    // the Western Mediterranean; Malta stays UK, Gibraltar is FR.
    const west = navalAvoidanceModifiers(G, "UK", "FR", "gibraltar", "western-mediterranean");
    const north = navalAvoidanceModifiers(G, "UK", "FR", "gibraltar", "north-atlantic");
    expect(west.notes).not.toContain("attackerPortAdvantage");
    expect(north.notes).toContain("attackerPortAdvantage");
    expect(north.drm).not.toBe(west.drm);
  });

  test("a port contact opens the attacker's box choice before the defender's avoid decision", () => {
    const G = navalWar();
    placeUnit(G, "FR", "squadron", "gibraltar", 2);
    const mover = placeUnit(G, "UK", "squadron", "london", 2).id;
    expect(navalMove(G, makeCtx([], seat("UK")), [mover], "gibraltar")).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(G.pending?.kind).toBe("navalPortBox");
    expect(G.pending?.power).toBe("UK");
    const ids = G.pending!.options.map((option) => option.id);
    expect(ids).toEqual(expect.arrayContaining(["box:north-atlantic", "box:western-mediterranean"]));

    // Only the attacking seat may pick the box.
    expect(resolvePending(G, makeCtx([], seat("FR")), "box:western-mediterranean")).toBe(INVALID_MOVE);
    expect(resolvePending(G, makeCtx([], seat("UK")), "box:nowhere")).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("navalPortBox");

    expect(resolvePending(G, makeCtx([], seat("UK")), "box:western-mediterranean")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalAvoid");
    expect(G.pending?.power).toBe("FR");
    expect(G.pending?.context?.box).toBe("western-mediterranean");

    // Roll 5 + 0 = 5: the avoid succeeds with the Western Mediterranean box.
    const avoid = G.pending!.options.find((option) => option.id.startsWith("avoid:"));
    expect(avoid).toBeDefined();
    expect(resolvePending(G, makeCtx([5], seat("FR")), avoid!.id)).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(G.pending).toBeNull();
  });

  test("the same roll fails when the North Atlantic box supplies a -1 DRM", () => {
    const G = navalWar();
    placeUnit(G, "FR", "squadron", "gibraltar", 2);
    const mover = placeUnit(G, "UK", "squadron", "london", 2).id;
    expect(navalMove(G, makeCtx([], seat("UK")), [mover], "gibraltar")).toBeUndefined();
    expect(resolvePending(G, makeCtx([], seat("UK")), "box:north-atlantic")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalAvoid");
    const avoid = G.pending!.options.find((option) => option.id.startsWith("avoid:"));
    expect(avoid).toBeDefined();
    expect(resolvePending(G, makeCtx([5], seat("FR")), avoid!.id)).toBeUndefined();
    expect(G.pending?.kind).not.toBe("navalAvoid");
    const logged = G.log.find((entry) => entry.key === "navalAvoidance")!;
    expect(logged.args?.drm).toBe(-1);
    expect(logged.args?.success).toBe(false);
  });

  test("declining the box choice falls back to the first adjacent box (no deadlock)", () => {
    const G = navalWar();
    placeUnit(G, "FR", "squadron", "gibraltar", 2);
    const mover = placeUnit(G, "UK", "squadron", "london", 2).id;
    expect(navalMove(G, makeCtx([], seat("UK")), [mover], "gibraltar")).toBeUndefined();
    expect(declinePending(G, makeCtx([], seat("UK")))).toBeUndefined();
    expect(G.pending?.kind).toBe("navalAvoid");
    expect(G.pending?.context?.box).toBe(portBoxes("gibraltar")[0]);
  });
});
