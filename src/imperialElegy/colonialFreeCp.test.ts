/**
 * The two printed "free CP" home/event grants, which used to be flags nothing
 * read:
 *
 *   A088 Our Place in the Sun — "Spend a total of 5 CP on naval movement,
 *   construct fleet, expeditionary force and/or pacification actions."
 *
 *   UK-3 Sun Never Sets — "… then spend 2 CP on expeditionary force, pacification
 *   and/or naval movement actions."
 *
 * Both cards only pay for *colonial* actions, so the grant must drain before the
 * ordinary wallet and must not be spendable on anything else.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {freeColonialCp, landUnitsIn, navalUnitsIn} from "./engine/rules";
import {buildEf, constructFleet, navalMove, pacify, placeInfluence, recruit} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "1"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));

const clearUnits = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...landUnitsIn(G, space), ...navalUnitsIn(G, space)]) removeUnit(G, unit.id);
};

/** UK's action impulse with a clean London and no ordinary CP left. */
const uk = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = "UK";
  G.pending = null;
  G.battle = null;
  G.cpRemaining = 0;
  G.powers.UK.flags.actionCpSpentThisImpulse = false;
  clearUnits(G, "london");
  clearUnits(G, "north-atlantic");
  return G;
};

describe("A088 / UK-3 spendable colonial CP", () => {
  test("the grant pays for a fleet before the ordinary wallet", () => {
    const G = uk();
    G.powers.UK.flags.freeColonialCp = 5;
    G.spaces.london.control = "UK";
    expect(constructFleet(G, makeCtx([], seat("UK")), "london", "squadron")).toBeUndefined();
    expect(navalUnitsIn(G, "london")).toHaveLength(1);
    // 2 CP came from the grant, nothing from the (empty) wallet.
    expect(freeColonialCp(G, "UK")).toBe(3);
    expect(G.cpRemaining).toBe(0);
  });

  test("the wallet covers the rest once the grant runs out", () => {
    const G = uk();
    G.powers.UK.flags.freeColonialCp = 1;
    G.cpRemaining = 4;
    expect(constructFleet(G, makeCtx([], seat("UK")), "london", "squadron")).toBeUndefined();
    expect(freeColonialCp(G, "UK")).toBe(0);
    expect(G.cpRemaining).toBe(3);
  });

  test("the grant pays for an expeditionary force and pacification", () => {
    const G = uk();
    G.powers.UK.flags.freeColonialCp = 4;
    expect(buildEf(G, makeCtx([], seat("UK")), "london")).toBeUndefined();
    expect(freeColonialCp(G, "UK")).toBe(2);
    // Pacification needs the UK's own influence marker in the space.
    G.spaces.egypt.influence = "UK";
    // 12.5's influence marker is not printed on these cards, so give the power
    // one colony it already influences and let the free CP pay its 1 CP cost.
    // 12.11 also requires a land unit in the space to pacify it.
    placeUnit(G, "UK", "army", "egypt", 2);
    expect(pacify(G, makeCtx([], seat("UK")), "egypt")).toBeUndefined();
    expect(freeColonialCp(G, "UK")).toBe(1);
  });

  test("the grant pays for naval movement", () => {
    const G = uk();
    G.powers.UK.flags.freeColonialCp = 3;
    const ship = placeUnit(G, "UK", "squadron", "london", 2);
    expect(navalMove(G, makeCtx([], seat("UK")), [ship.id], "north-atlantic")).toBeUndefined();
    expect(freeColonialCp(G, "UK")).toBe(2);
    expect(G.cpRemaining).toBe(0);
  });

  test("the grant never pays for a non-colonial action", () => {
    const G = uk();
    G.powers.UK.flags.freeColonialCp = 5;
    // 12.5 influence is not on the printed list.
    expect(placeInfluence(G, makeCtx([], seat("UK")), "egypt")).toBe(INVALID_MOVE);
    // 12.2 recruitment is not either, and the wallet is empty.
    expect(recruit(G, makeCtx([], seat("UK")), "london", "army", 1)).toBe(INVALID_MOVE);
    expect(freeColonialCp(G, "UK")).toBe(5);
  });

  test("a refused colonial action spends nothing", () => {
    const G = uk();
    G.powers.UK.flags.freeColonialCp = 5;
    // London already has four ships: the port is full, so the build is refused
    // and the grant is untouched.
    for (let i = 0; i < 4; i += 1) placeUnit(G, "UK", "squadron", "london", 2);
    expect(constructFleet(G, makeCtx([], seat("UK")), "london", "squadron")).toBe(INVALID_MOVE);
    expect(freeColonialCp(G, "UK")).toBe(5);
  });
});
