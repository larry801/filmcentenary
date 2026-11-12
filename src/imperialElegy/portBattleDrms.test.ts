/**
 * Rule 19.5 — the printed naval battle BDRM list contains the port-count
 * modifiers ("No friendly ports adjacent to embattled area: -2", ">= 2 more
 * ports than your opponent adjacent to embattled area: +1"), with the footnote
 * that a port battle is treated as taking place in an adjacent naval box (the
 * attacker chooses when the port touches two).  These are *battle* DRMs; the
 * 19.2 avoid roll keeps its own printed +1/-1 list.
 */

import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {navalUnitsIn} from "./engine/rules";
import {
  navalAvoidanceModifiers,
  navalPortBattleModifiers,
  resolveBattleRoll,
} from "./engine/combat";
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
  G.pendingStack = [];
  G.battle = null;
  G.cpRemaining = 6;
  G.war = warState("UK", "FR");
  for (const space of ["north-atlantic", "western-mediterranean", "gibraltar", "london", "malta", "brittany"]) {
    clearNaval(G, space);
  }
  return G;
};

describe("19.5 port-count battle DRMs", () => {
  test("a naval-box battle counts the box's adjacent ports for each side", () => {
    const G = navalWar();
    const mods = navalPortBattleModifiers(G, "UK", "FR", "north-atlantic");
    // The UK holds most North Atlantic ports; France holds Brittany (and the
    // other French Atlantic coast ports).
    expect(mods.notes).toContain("attackerPortAdvantageBattle");
    expect(mods.attackerDrm).toBe(1);
    expect(mods.notes).not.toContain("attackerNoPortsBattle");
  });

  test("a side with no friendly adjacent port suffers -2", () => {
    const G = navalWar();
    const mods = navalPortBattleModifiers(G, "GE", "UK", "north-atlantic");
    expect(mods.notes).toContain("attackerNoPortsBattle");
    expect(mods.attackerDrm).toBe(-2);
    // The UK's port lead also gives the defender its own +1.
    expect(mods.notes).toContain("defenderPortAdvantageBattle");
    expect(mods.defenderDrm).toBe(1);
  });

  test("the attacker's chosen box drives a two-box port battle", () => {
    const G = navalWar();
    G.spaces.gibraltar.control = "FR";
    const north = navalPortBattleModifiers(G, "UK", "FR", "gibraltar", "north-atlantic");
    const west = navalPortBattleModifiers(G, "UK", "FR", "gibraltar", "western-mediterranean");
    expect(north.notes).toContain("attackerPortAdvantageBattle");
    expect(west.notes).not.toContain("attackerPortAdvantageBattle");
    // Only the Western Mediterranean makes France the port leader.
    expect(west.notes).toContain("defenderPortAdvantageBattle");
    expect(north.attackerDrm).not.toBe(west.attackerDrm);
  });

  test("the battle DRM list is separate from the 19.2 avoid-roll list", () => {
    const G = navalWar();
    G.spaces.gibraltar.control = "FR";
    const avoidNorth = navalAvoidanceModifiers(G, "UK", "FR", "gibraltar", "north-atlantic");
    const battleNorth = navalPortBattleModifiers(G, "UK", "FR", "gibraltar", "north-atlantic");
    expect(avoidNorth.notes).toContain("attackerPortAdvantage");
    expect(battleNorth.notes).toContain("attackerPortAdvantageBattle");
    // Both lists agree on the direction, but only the battle list has the -2.
    const avoidWest = navalAvoidanceModifiers(G, "UK", "FR", "gibraltar", "western-mediterranean");
    expect(avoidWest.notes).not.toContain("attackerNoPorts");
    expect(battleNorth.attackerDrm).toBeGreaterThanOrEqual(0);
  });
});

describe("19.5 live port battle", () => {
  test("the chosen port box is recorded and its battle DRMs drive the roll", () => {
    const G = navalWar();
    G.spaces.gibraltar.control = "FR";
    placeUnit(G, "FR", "squadron", "gibraltar", 2);
    const mover = placeUnit(G, "UK", "squadron", "london", 2).id;
    expect(navalMove(G, makeCtx([], seat("UK")), [mover], "gibraltar")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalPortBox");
    expect(resolvePending(G, makeCtx([], seat("UK")), "box:north-atlantic")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalAvoid");
    expect(resolvePending(G, makeCtx([], seat("FR")), "fight")).toBeUndefined();
    expect(G.battle?.portBox).toBe("north-atlantic");
    expect(G.battle?.notes).toContain("attackerPortAdvantageBattle");
    const attackerDrm = G.battle!.attackerDrm;
    expect(attackerDrm).toBe(1);

    // The roll's computed BDRM includes the 19.5 port modifier.
    resolveBattleRoll(G, makeCtx([4, 2]));
    const roll = G.log.filter((entry) => entry.key === "battleRoll").pop();
    expect(roll?.args?.attackDrm).toBe(attackerDrm);
  });

  test("the other box gives the defender its port advantage instead", () => {
    const G = navalWar();
    G.spaces.gibraltar.control = "FR";
    placeUnit(G, "FR", "squadron", "gibraltar", 2);
    const mover = placeUnit(G, "UK", "squadron", "london", 2).id;
    expect(navalMove(G, makeCtx([], seat("UK")), [mover], "gibraltar")).toBeUndefined();
    expect(resolvePending(G, makeCtx([], seat("UK")), "box:western-mediterranean")).toBeUndefined();
    expect(resolvePending(G, makeCtx([], seat("FR")), "fight")).toBeUndefined();
    expect(G.battle?.portBox).toBe("western-mediterranean");
    expect(G.battle?.notes).toContain("defenderPortAdvantageBattle");
    expect(G.battle!.defenderDrm).toBe(1);
  });
});
