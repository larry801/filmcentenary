/**
 * 33.3 Cultural Symbol: "Reduce the FR player's City of Light points by 1 when
 * Paris is occupied by an enemy power in wartime.  This can happen multiple
 * times per game."
 *
 * The live seams are `rules.ts#recordOccupation` (marches / redeployments) and
 * `moves.ts#resolvePending` (a battle that occupies Paris).  One point is lost
 * per occupation episode; a liberation re-arms the loss.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {recomputeTracks, recordOccupation} from "./engine/rules";
import {createWarState} from "./engine/limitedWar";
import {culturalSymbolLoss, settleCulturalSymbolLoss} from "./engine/characteristics";
import {landBattle, redeploy, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
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
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

/** A live wartime state with Paris empty and FR at four City of Light points. */
const warAtParis = (G: ImperialElegyState): void => {
  G.phase = "wartime";
  G.war = createWarState(G, "GE", "FR", "conquest", ["paris"], 2);
  G.war.status = "maneuver";
  G.war.budgets.GE = 6;
  G.war.budgets.FR = 6;
  G.activePower = "GE";
  G.pending = null;
  G.battle = null;
  for (const id of [...G.spaces.paris.units]) delete G.units[id];
  G.spaces.paris.units = [];
  G.spaces.paris.occupiedBy = null;
  G.powers.FR.cityOfLight = 4;
};

describe("33.3 Cultural Symbol", () => {
  test("the pure decision reports the loss while Paris is enemy-occupied in wartime", () => {
    const G = fresh();
    warAtParis(G);
    expect(culturalSymbolLoss(G).applies).toBe(false);
    G.spaces.paris.occupiedBy = "GE";
    const decision = culturalSymbolLoss(G);
    expect(decision.applies).toBe(true);
    expect(decision.points).toBe(4);
    expect(decision.next).toBe(3);
  });

  test("an enemy capture of Paris costs one point and the episode is not double charged", () => {
    const G = fresh();
    warAtParis(G);
    G.powers.GE.industry = 5;
    G.spaces.champagne.control = "GE";
    const ctx = makeCtx([6], seat("GE"));
    const garrison = placeUnit(G, "FR", "army", "paris", 2);
    placeUnit(G, "GE", "army", "champagne", 2);
    placeUnit(G, "GE", "army", "champagne", 2);
    expect(G.units[garrison.id].steps).toBe(2);

    expect(landBattle(G, ctx, "champagne", "paris")).toBeUndefined();
    // The garrison is beaten: resolve every live battle decision through the
    // real move, which is the seam that settles the characteristic.
    if (G.battle) G.battle.winner = "attacker";
    let guard = 0;
    while (G.pending !== null && guard < 60) {
      guard += 1;
      const pending = G.pending;
      const option =
        pending.options.find((entry) => entry.id === "skip") ??
        pending.options.find((entry) => entry.id === "done") ??
        pending.options[0];
      expect(resolvePending(G, {...ctx, playerID: seat(pending.power)}, option.id)).toBeUndefined();
    }
    expect(G.spaces.paris.occupiedBy).toBe("GE");
    expect(G.powers.FR.cityOfLight).toBe(3);

    // A second enemy army entering the already-occupied Paris costs nothing.
    const extra = placeUnit(G, "GE", "army", "champagne", 2);
    expect(redeploy(G, ctx, extra.id, "paris")).toBeUndefined();
    expect(G.powers.FR.cityOfLight).toBe(3);
    expect(settleCulturalSymbolLoss(G)).toBe(0);
  });

  test("liberating Paris re-arms the loss for a later occupation", () => {
    const G = fresh();
    warAtParis(G);
    G.powers.FR.cityOfLight = 4;
    // The enemy holds Paris; the marker is stamped by the capture.
    G.spaces.paris.occupiedBy = "GE";
    expect(settleCulturalSymbolLoss(G)).toBe(1);
    expect(G.powers.FR.cityOfLight).toBe(3);

    // 15.3 persistence: the marker stays when the enemy leaves; the episode
    // closes only when a new occupant/control retakes Paris.  France marches
    // back in (sole land occupant with FR control) so the marker clears.
    G.spaces.paris.control = "FR";
    placeUnit(G, "FR", "army", "paris", 2);
    expect(recordOccupation(G, "paris").cleared).toBe(true);
    expect(G.spaces.paris.occupiedBy).toBeNull();
    expect(settleCulturalSymbolLoss(G)).toBe(0);

    // A later enemy occupation costs another point ("this can happen multiple times").
    G.spaces.paris.occupiedBy = "GE";
    expect(settleCulturalSymbolLoss(G)).toBe(1);
    expect(G.powers.FR.cityOfLight).toBe(2);
  });

  test("negative: a peacetime occupation marker costs nothing", () => {
    const G = fresh();
    G.phase = "action";
    G.war = null;
    G.gw = undefined;
    G.powers.FR.cityOfLight = 4;
    G.spaces.paris.occupiedBy = "GE";
    expect(culturalSymbolLoss(G).applies).toBe(false);
    expect(settleCulturalSymbolLoss(G)).toBe(0);
    expect(G.powers.FR.cityOfLight).toBe(4);
  });

  test("City of Light never drops below zero and the printed card is capped at six", () => {
    const G = fresh();
    warAtParis(G);
    G.powers.FR.cityOfLight = 0;
    G.spaces.paris.occupiedBy = "GE";
    expect(settleCulturalSymbolLoss(G)).toBe(0);
    expect(G.powers.FR.cityOfLight).toBe(0);
    // The private episode marker is still consumed for this occupation.
    expect(culturalSymbolLoss(G).alreadyLost).toBe(true);
    expect(G.powers.FR.cityOfLight).toBeLessThanOrEqual(6);
  });

  test("the loss is visible to the FR card draw: four points, then three, loses the card", () => {
    const G = fresh();
    warAtParis(G);
    recomputeTracks(G);
    G.spaces.paris.occupiedBy = "GE";
    expect(settleCulturalSymbolLoss(G)).toBe(1);
    expect(G.powers.FR.cityOfLight).toBe(3);
  });
});
