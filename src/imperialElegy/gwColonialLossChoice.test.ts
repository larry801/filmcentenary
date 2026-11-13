/**
 * 29.2 The Colonial War — the losing alliance chooses which of its units
 * eliminates (or which army takes the step loss).  The winner then takes the
 * unoccupied spaces.
 */
import {Ctx} from "boardgame.io";
import {GreatWarState, ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {resolveColonialWar, resolveGwWinter} from "./engine/greatWarFlow";
import {resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const baseGw = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = {
    active: true,
    turn: 2,
    order: ["FR", "GE"],
    belligerents: ["FR", "GE"],
    neutrals: [],
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
  } as GreatWarState;
  G.powers.FR.alliance = "teCommitted";
  G.powers.GE.alliance = "taCommitted";
  G.phase = "gwWinter";
  return G;
};

describe("29.2 losing-side loss choice", () => {
  test("deferLosses leaves the unit choice open", () => {
    const G = baseGw();
    G.gw!.neutrals = [];
    placeUnit(G, "FR", "army", "sudan", 2);
    placeUnit(G, "FR", "army", "nigeria", 2);
    const target = placeUnit(G, "GE", "army", "east-africa", 2);
    const roll = resolveColonialWar(G, makeCtx([6, 1]), "africa", {deferLosses: true, deferTransfers: true});
    expect(roll.winner).toBe("te");
    expect(roll.losses).toEqual([]);
    expect(G.units[target.id].steps).toBe(2);

    // The helper's deterministic fallback is still available for bots and
    // non-interactive callers.
    const G2 = baseGw();
    placeUnit(G2, "FR", "army", "sudan", 2);
    placeUnit(G2, "FR", "army", "nigeria", 2);
    const target2 = placeUnit(G2, "GE", "army", "east-africa", 2);
    const fallback = resolveColonialWar(G2, makeCtx([4, 3]), "africa");
    expect(fallback.winner).toBe("te");
    expect(fallback.losses).toHaveLength(1);
    expect(G2.units[target2.id].steps).toBe(1);
  });

  test("the live winter asks the losing player and applies the chosen loss", () => {
    const G = baseGw();
    placeUnit(G, "FR", "army", "sudan", 2);
    placeUnit(G, "FR", "army", "nigeria", 2);
    const full = placeUnit(G, "GE", "army", "east-africa", 2);
    const reduced = placeUnit(G, "GE", "army", "somalia", 1);
    // Africa: TE 6+2, TA 1; Asia: both 1 (no modifiers) -> tie.
    const ctx = makeCtx([6, 1, 1, 1]);
    const res = resolveGwWinter(G, ctx, {promptChoices: true});
    expect(res.ok).toBe(true);
    expect(G.pending?.kind).toBe("gwColonialLoss");
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.options.map((o) => o.id).sort()).toEqual([full.id, reduced.id].sort());

    // The losing player chooses the full army, so it loses one step instead of
    // the reduced army being eliminated.
    expect(resolvePending(G, makeCtx([], "0"), full.id)).toBeUndefined();
    expect(G.units[full.id].steps).toBe(1);
    expect(G.units[reduced.id].steps).toBe(1);
  });
});
