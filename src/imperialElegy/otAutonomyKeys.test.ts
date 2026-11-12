/**
 * 33.6 Local Autonomy: "Keys with Arab or Egyptian nationality only count
 * towards OT's total Arab keys.  Tunisia and Tripoli neither count as keys nor
 * for power projection unless OT can trace a Loc to the keys by land."
 *
 * Tripoli and Tunisia print no `keyType`, so the clause used to be a no-op.
 * They now carry the typed `otLandLocKeyType` ("territorial") that only the
 * Ottomans see, and `recomputeTracks` applies the land-LoC test.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {effectiveKeyType, hasOtAutonomyLandLoc, keyTypeForPower, recomputeTracks} from "./engine/rules";
import {SPACES} from "./constant/spaces";

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

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

describe("33.6 Local Autonomy — conditional keys", () => {
  test("Tripoli and Tunisia expose a conditional territorial key to the Ottomans only", () => {
    const G = fresh();
    for (const space of ["tripoli", "tunisia"]) {
      // No printed key type: nothing sees a key through `effectiveKeyType`.
      expect(effectiveKeyType(G, space)).toBeUndefined();
      expect(SPACES[space].otLandLocKeyType).toBe("territorial");
      expect(keyTypeForPower(G, space, "OT")).toBe("territorial");
      // No other power counts them as keys.
      expect(keyTypeForPower(G, space, "GE")).toBeUndefined();
      expect(keyTypeForPower(G, space, "FR")).toBeUndefined();
    }
  });

  test("without a land LoC they do not count (printed setup totals)", () => {
    const G = fresh();
    recomputeTracks(G);
    expect(hasOtAutonomyLandLoc(G, "tripoli")).toBe(false);
    expect(hasOtAutonomyLandLoc(G, "tunisia")).toBe(false);
    expect(G.powers.OT.territorialKeys).toBe(8);
    expect(G.powers.OT.arabKeys).toBe(5);
  });

  test("a land LoC to another OT key makes them count", () => {
    const G = fresh();
    // Egypt under OT control creates the land route Egypt - Great Sand Sea -
    // Benghazi - Tripoli - Tunisia.
    G.spaces.egypt.control = "OT";
    recomputeTracks(G);
    expect(hasOtAutonomyLandLoc(G, "tripoli")).toBe(true);
    expect(hasOtAutonomyLandLoc(G, "tunisia")).toBe(true);
    expect(G.powers.OT.territorialKeys).toBe(10);
    // The pair still counts once each and never as Arab keys.
    expect(G.powers.OT.arabKeys).toBe(6);
  });

  test("the two spaces cannot certify each other's LoC", () => {
    const G = fresh();
    // Cut every land neighbour except the pair: Tripoli <-> Tunisia only.
    G.spaces.benghazi.control = "Egypt";
    G.spaces.egypt.control = "Egypt";
    recomputeTracks(G);
    expect(hasOtAutonomyLandLoc(G, "tripoli")).toBe(false);
    expect(hasOtAutonomyLandLoc(G, "tunisia")).toBe(false);
    expect(G.powers.OT.territorialKeys).toBe(8);
  });

});
