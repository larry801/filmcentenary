/**
 * Rule 15.2.2 — Joint Naval Operations (1 CP).
 *
 * A player spends 1 CP and places a marker on naval units.  When an allied
 * player takes the same action in a later impulse, every marked ally removes
 * its marker and the contingents conduct one naval movement together; the
 * markers are consumed and the CP is not refunded.  Markers left at the end of
 * the war are removed and their CP lost.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, Unit} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {createWarState} from "./engine/limitedWar";
import {placeUnit} from "./engine/effects";
import {jointNaval, resolvePending} from "./moves";

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    random: {Die: () => 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "wartime",
  }) as unknown as Ctx;

const makeDiceCtx = (dice: number[], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    ...(makeCtx(playerID) as object),
    random: {Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const navalUnit = (G: ImperialElegyState, owner: Power): Unit => {
  const existing = Object.values(G.units).find((unit) => unit.owner === owner && unit.naval && unit.kind === "squadron");
  if (existing !== undefined) {
    G.spaces[existing.space ?? ""]?.units &&
      (G.spaces[existing.space!].units = G.spaces[existing.space!].units.filter((id) => id !== existing.id));
    existing.space = "north-atlantic";
    G.spaces["north-atlantic"].units.push(existing.id);
    return existing;
  }
  const id = `test-${owner}-squadron`;
  const unit: Unit = {
    id,
    owner,
    kind: "squadron",
    steps: 2,
    maxSteps: 2,
    naval: true,
    space: "north-atlantic",
    home: null,
  } as Unit;
  G.units[id] = unit;
  G.spaces["north-atlantic"].units.push(id);
  return unit;
};

const maneuver = (G: ImperialElegyState) => {
  G.phase = "wartime";
  G.pending = null;
  G.battle = null;
  const war = createWarState(G, "UK", "GE", "conquest", ["brittany"], 2);
  war.status = "maneuver";
  war.initiative = ["UK", "FR", "GE"];
  war.attackerAllies = ["FR"];
  war.budgets.FR = 2;
  G.war = war;
  G.activePower = "UK";
  return war;
};

describe("15.2.2 limited-war joint naval operations", () => {
  test("the first impulse places a marker and spends 1 CP", () => {
    const G = fresh();
    const war = maneuver(G);
    const uk = navalUnit(G, "UK");
    const before = war.budgets.UK ?? 0;
    expect(jointNaval(G, makeCtx(seat("UK")), [uk.id])).toBeUndefined();
    expect(war.budgets.UK).toBe(before - 1);
    expect(war.jointNavalMarkers).toHaveLength(1);
    expect(war.jointNavalMarkers?.[0]).toMatchObject({power: "UK", space: "north-atlantic"});
  });

  test("an allied marker conducts one combined naval move", () => {
    const G = fresh();
    const war = maneuver(G);
    const uk = navalUnit(G, "UK");
    const fr = navalUnit(G, "FR");
    expect(jointNaval(G, makeCtx(seat("UK")), [uk.id])).toBeUndefined();
    G.activePower = "FR";
    const before = war.budgets.FR ?? 0;
    expect(jointNaval(G, makeCtx(seat("FR")), [fr.id], "western-mediterranean")).toBeUndefined();
    expect(war.budgets.FR).toBe(before - 1);
    expect(G.units[uk.id].space).toBe("western-mediterranean");
    expect(G.units[fr.id].space).toBe("western-mediterranean");
    // The participating markers are consumed.
    expect(war.jointNavalMarkers).toHaveLength(0);
  });

  test("conducting without an allied marker is refused", () => {
    const G = fresh();
    maneuver(G);
    const uk = navalUnit(G, "UK");
    expect(jointNaval(G, makeCtx(seat("UK")), [uk.id], "western-mediterranean")).toBe(INVALID_MOVE);
  });

  test("markers left at the end of the war are cleared and the CP is lost", () => {
    const G = fresh();
    const war = maneuver(G);
    const uk = navalUnit(G, "UK");
    expect(jointNaval(G, makeCtx(seat("UK")), [uk.id])).toBeUndefined();
    war.status = "victory";
    G.activePower = "UK";
    // `resolveWar` is not needed for the assertion: demobilizeWar clears them.
    const {demobilizeWar} = require("./engine/limitedWar") as typeof import("./engine/limitedWar");
    demobilizeWar(G, war, makeCtx());
    expect(war.jointNavalMarkers).toHaveLength(0);
  });
});


// ---------------------------------------------------------------------------
// 19.1 transit interception on a joint 15.2.2 move
// ---------------------------------------------------------------------------

/** A joint force at North Atlantic heading for South Atlantic passes through
 *  the Western Mediterranean; a GE squadron in Croatia makes that box a 19.1
 *  transit interception point. */
const transitFixture = (extraAlly?: Power): {G: ImperialElegyState; war: ReturnType<typeof maneuver>; uk: Unit; fr: Unit; au?: Unit} => {
  const G = fresh();
  const war = maneuver(G);
  if (extraAlly !== undefined) {
    war.attackerAllies = ["FR", extraAlly];
    war.budgets[extraAlly] = 2;
  }
  const uk = navalUnit(G, "UK");
  const fr = navalUnit(G, "FR");
  const au = extraAlly === undefined ? undefined : navalUnit(G, extraAlly);
  // An enemy (GE) squadron in a Western Mediterranean port.
  placeUnit(G, "GE", "squadron", "croatia", 2);
  G.spaces.croatia.control = "GE";
  return {G, war, uk, fr, au};
};

describe("19.1 joint naval transit interception", () => {
  test("the joint move parks at the intermediate box and opens the window", () => {
    const {G, war, uk, fr} = transitFixture();
    expect(jointNaval(G, makeCtx(seat("UK")), [uk.id])).toBeUndefined();
    G.activePower = "FR";
    expect(jointNaval(G, makeCtx(seat("FR")), [fr.id], "south-atlantic")).toBeUndefined();

    expect(G.units[uk.id].space).toBe("western-mediterranean");
    expect(G.units[fr.id].space).toBe("western-mediterranean");
    expect(G.navalTransit).toMatchObject({power: "FR", index: 1});
    expect(G.navalTransit?.ally).toBe("UK");
    expect(G.pending?.kind).toBe("navalInterception");
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.options.map((option) => option.id)).toContain("intercept:croatia");
    // One CP for the whole joint action, not one per contingent.
    expect(war.budgets.FR).toBe(1);

    expect(resolvePending(G, makeCtx(seat("GE")), "skip")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.navalTransit).toBeNull();
    expect(G.units[uk.id].space).toBe("south-atlantic");
    expect(G.units[fr.id].space).toBe("south-atlantic");
    expect(war.budgets.FR).toBe(1);
  });

  test("every allied contingent is carried through the transit window", () => {
    const {G, uk, fr, au} = transitFixture("AU");
    if (au === undefined) throw new Error("missing AU unit");
    G.activePower = "FR";
    expect(jointNaval(G, makeCtx(seat("FR")), [fr.id])).toBeUndefined();
    G.activePower = "AU";
    expect(jointNaval(G, makeCtx(seat("AU")), [au.id])).toBeUndefined();
    G.activePower = "UK";
    expect(jointNaval(G, makeCtx(seat("UK")), [uk.id], "south-atlantic")).toBeUndefined();

    expect(G.navalTransit).toMatchObject({power: "UK", index: 1});
    expect([...(G.navalTransit?.allies ?? [])].sort()).toEqual(["AU", "FR"]);
    for (const unit of [uk, fr, au]) {
      expect(G.units[unit.id].space).toBe("western-mediterranean");
    }
    expect(resolvePending(G, makeCtx(seat("GE")), "skip")).toBeUndefined();
    for (const unit of [uk, fr, au]) {
      expect(G.units[unit.id].space).toBe("south-atlantic");
    }
  });

  test("winning the transit battle keeps every ally in the 19.1 continuation", () => {
    const {G, uk, fr} = transitFixture();
    expect(jointNaval(G, makeCtx(seat("UK")), [uk.id])).toBeUndefined();
    G.activePower = "FR";
    expect(jointNaval(G, makeCtx(seat("FR")), [fr.id], "south-atlantic")).toBeUndefined();

    // Interception roll 5 (success), then the mover wins the battle 6-1.
    expect(resolvePending(G, makeDiceCtx([5, 6, 1], seat("GE")), "intercept:croatia")).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(G.navalTransit).toBeNull();
    // 19.8's port-only move comes first; staying at sea hands over to 19.1.
    expect(G.pending?.kind).toBe("navalPortContinuation");
    expect(resolvePending(G, makeCtx(seat("FR")), "stay")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalContinuation");
    expect(G.pending?.context?.ally).toBe("UK");
    expect(resolvePending(G, makeCtx(seat("FR")), "south-atlantic")).toBeUndefined();
    expect(G.units[uk.id].space).toBe("south-atlantic");
    expect(G.units[fr.id].space).toBe("south-atlantic");
  });
});
