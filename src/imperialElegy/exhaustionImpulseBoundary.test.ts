/**
 * GW-10 Exhaustion — impulse boundary (round 5).
 *
 * Printed: "This event takes effect at the end of this impulse and remains
 * active for the remainder of the GW turn. ... Neither event triggers on GW
 * turn 0."  The chosen mode is therefore queued while the GW card resolves and
 * only activated when the playing impulse ends (a pass or a maneuver-turn
 * skip); it is cleared at the winter, as before.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {GreatWarState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {beginLandBattle, finishBattle} from "./engine/combat";
import {placeUnit, removeUnit} from "./engine/effects";
import {landUnitsIn} from "./engine/rules";
import {activateGwExhaustion, resolveGwWinter} from "./engine/greatWarFlow";
import {gwEndTurn, gwPass, playGwCardMove, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (sides: number) => Math.min(sides, dice[Math.min(index++, dice.length - 1)] ?? 3)},
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));
const ctxFor = (power: Power, dice: number[] = []): Ctx => makeCtx(dice, seat(power));

const baseGw = (turn = 2): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  const gw: GreatWarState = {
    active: true,
    turn,
    order: ["GE", "FR"],
    belligerents: ["GE", "FR"],
    neutrals: ["UK", "AU", "RU", "OT"],
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
  };
  G.gw = gw;
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.phase = "gwManeuver";
  G.activePower = "GE";
  G.turnIndex = 0;
  return G;
};

/** Play GE's Exhaustion as an event and resolve its printed mode choice. */
const playExhaustion = (G: ImperialElegyState, mode: "stability" | "vp"): void => {
  G.powers.GE.gwCard = "IE-GW-10";
  G.powers.GE.gwBudget = 2;
  const ctx = ctxFor("GE");
  expect(playGwCardMove(G, ctx, "event")).toBeUndefined();
  expect(G.pending?.kind).toBe("eventChoice");
  expect(resolvePending(G, ctx, mode)).toBeUndefined();
  expect(G.pending).toBeNull();
};

/**
 * Run a decisive land battle where the defender loses with two armies, driving
 * the printed 30.0 "defeat in a decisive battle" stability path.  Clears the
 * two spaces first so the helper can run twice in one test.
 */
const decisiveDefeat = (G: ImperialElegyState, attacker: Power, from: string, to: string, defender: Power): void => {
  const ctx = makeCtx([3]);
  for (const space of [from, to]) {
    for (const unit of [...landUnitsIn(G, space)]) removeUnit(G, unit.id);
  }
  placeUnit(G, attacker, "army", from, 2);
  placeUnit(G, defender, "army", to, 2);
  placeUnit(G, defender, "army", to, 2);
  const battle = beginLandBattle(G, ctx, attacker, from, to);
  if (!battle) throw new Error("battle did not start");
  G.pending = null;
  battle.winner = "attacker";
  battle.decisive = true;
  battle.attackerLosses = 0;
  battle.defenderLosses = 0;
  finishBattle(G, ctx);
  G.pending = null;
};

// ---------------------------------------------------------------------------
// Queued, not immediate
// ---------------------------------------------------------------------------

describe("GW-10 Exhaustion timing", () => {
  test("resolving the card queues the mode instead of activating it", () => {
    const G = baseGw();
    playExhaustion(G, "stability");
    expect(G.persistent.exhaustion).toBeUndefined();
    expect(G.gw?.exhaustionPending).toMatchObject({mode: "stability", power: "GE", turn: 2});
    // The card itself is already spent: the holder may end the impulse.
    expect(G.powers.GE.gwCard).toBeNull();
  });

  test("a defeat in the same impulse is not yet doubled", () => {
    const G = baseGw();
    playExhaustion(G, "stability");
    const before = G.powers.FR.stability;
    decisiveDefeat(G, "GE", "berlin", "saxony", "FR");
    expect(G.powers.FR.stability).toBe(before - 1);
    expect(G.persistent.exhaustion).toBeUndefined();
  });

  test("passing the impulse activates the queued mode", () => {
    const G = baseGw();
    playExhaustion(G, "stability");
    expect(gwPass(G, ctxFor("GE"))).toBeUndefined();
    expect(G.gw?.exhaustionPending ?? null).toBeNull();
    expect(G.persistent.exhaustion).toBe("stability");

    const before = G.powers.FR.stability;
    decisiveDefeat(G, "GE", "berlin", "saxony", "FR");
    expect(G.powers.FR.stability).toBe(before - 2);
  });

  test("VP mode takes the VP at the impulse boundary, not when chosen", () => {
    const G = baseGw();
    const geBefore = G.powers.GE.vp;
    const frBefore = G.powers.FR.vp;
    playExhaustion(G, "vp");
    expect(G.powers.GE.vp).toBe(geBefore);
    expect(G.powers.FR.vp).toBe(frBefore);

    expect(gwPass(G, ctxFor("GE"))).toBeUndefined();
    expect(G.persistent.exhaustion).toBe("vp");
    expect(G.powers.GE.vp).toBe(geBefore - 1);
    expect(G.powers.FR.vp).toBe(frBefore - 1);
    // A neutral player is not "fighting in the GW".
    expect(G.powers.UK.vp).toBe(0);
  });

  test("skipping the maneuver turn also closes the impulse", () => {
    const G = baseGw();
    playExhaustion(G, "stability");
    expect(gwEndTurn(G, ctxFor("GE"))).toBeUndefined();
    expect(G.phase).toBe("gwWinter");
    expect(G.persistent.exhaustion).toBe("stability");
  });
});

// ---------------------------------------------------------------------------
// Guards and the no-pass rule
// ---------------------------------------------------------------------------

describe("GW-10 Exhaustion guards", () => {
  test("GW turn 0 queues nothing and activates nothing", () => {
    const G = baseGw(0);
    G.powers.GE.gwCard = "IE-GW-10";
    G.powers.GE.gwBudget = 2;
    const ctx = ctxFor("GE");
    expect(playGwCardMove(G, ctx, "event")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.gw?.exhaustionPending ?? null).toBeNull();
    expect(activateGwExhaustion(G)).toBeNull();
    expect(G.persistent.exhaustion).toBeUndefined();
  });

  test("a stale queued mode from another GW turn never activates", () => {
    const G = baseGw(3);
    G.gw!.exhaustionPending = {mode: "stability", power: "GE", turn: 2};
    expect(activateGwExhaustion(G)).toBeNull();
    expect(G.persistent.exhaustion).toBeUndefined();
    expect(G.gw?.exhaustionPending ?? null).toBeNull();
  });

  test("cannot pass while holding Exhaustion; playing it re-opens the pass and activates", () => {
    const G = baseGw();
    G.powers.GE.gwCard = "IE-GW-10";
    expect(gwPass(G, ctxFor("GE"))).toBe(INVALID_MOVE);
    expect(G.powers.GE.flags.passedGw).not.toBe(true);

    // Playing it for its event is the printed way forward (27.3).
    expect(playGwCardMove(G, ctxFor("GE"), "event")).toBeUndefined();
    expect(resolvePending(G, ctxFor("GE"), "stability")).toBeUndefined();
    expect(G.powers.GE.gwCard).toBeNull();

    expect(gwPass(G, ctxFor("GE"))).toBeUndefined();
    expect(G.powers.GE.flags.passedGw).toBe(true);
    expect(G.persistent.exhaustion).toBe("stability");
  });

  test("the mode and any pending queue die at the GW winter", () => {
    const G = baseGw();
    G.persistent.exhaustion = "stability";
    G.gw!.exhaustionPending = {mode: "vp", power: "GE", turn: 2};
    G.phase = "gwWinter";
    const res = resolveGwWinter(G, makeCtx([3]));
    expect(res.ok).toBe(true);
    expect(G.persistent.exhaustion).toBeUndefined();
    expect(G.gw?.exhaustionPending ?? null).toBeNull();
  });
});
