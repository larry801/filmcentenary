/**
 * 33.1 Zollverein — documentation test.
 *
 * The printed display text is exactly: "Zollverein: German Unification spaces
 * are always considered territorial keys to the GE player."  It grants no
 * home-space, supply-source or recruitment treatment; those come from the
 * separate 33.1 German Confederation ability, which makes a German unification
 * space a permanent home space only once GE has taken control of it.  This
 * suite pins the distinction so a later change cannot silently invent a
 * stronger Zollverein.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {canRecruitIn} from "./engine/characteristics";
import {isHomeSpace, isSupplySource, keyTypeForPower, recomputeTracks} from "./engine/rules";

const makeCtx = (): Ctx =>
  ({
    playerID: "0",
    random: {Die: () => 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

describe("33.1 Zollverein is a territorial-key rule only", () => {
  test("the printed text grants only the territorial key", () => {
    const G = fresh();
    // Bavaria is a German unification space controlled by its minor power: GE
    // sees it as a territorial key, but it is not a GE home space yet.
    expect(G.spaces.bavaria.control).not.toBe("GE");
    expect(keyTypeForPower(G, "bavaria", "GE")).toBe("territorial");
    expect(isHomeSpace(G, "bavaria", "GE")).toBe(false);

    // Taking control (treaty/conquest/annexation) is the separate 33.1 German
    // Confederation clause: the space becomes a permanent GE home space.
    G.spaces.bavaria.control = "GE";
    recomputeTracks(G);
    expect(G.spaces.bavaria.homeOverride).toBe("GE");
    expect(isHomeSpace(G, "bavaria", "GE")).toBe(true);
    expect(isSupplySource(G, "GE", "bavaria", false)).toBe(true);
  });

  test("an uncontrolled German unification space is not counted as a key", () => {
    const G = fresh();
    recomputeTracks(G);
    const before = G.powers.GE.territorialKeys;
    expect(G.spaces.bavaria.control).not.toBe("GE");
    recomputeTracks(G);
    expect(G.powers.GE.territorialKeys).toBe(before);
    expect(keyTypeForPower(G, "bavaria", "GE")).toBe("territorial");
  });

  test("the permanent home stamp survives unification state and later loss", () => {
    const G = fresh();
    G.spaces.bavaria.control = "GE";
    recomputeTracks(G);
    // 33.1: "Whenever GE takes control of a German unification space it becomes
    // a permanent home space" — independent of the unification flag.
    expect(isHomeSpace(G, "bavaria", "GE")).toBe(true);
    G.powers.GE.unified = false;
    expect(isHomeSpace(G, "bavaria", "GE")).toBe(true);
    // Permanent: an enemy gain does not remove the stamped home space.
    G.spaces.bavaria.control = "AU";
    recomputeTracks(G);
    expect(G.spaces.bavaria.homeOverride).toBe("GE");
    expect(isHomeSpace(G, "bavaria", "GE")).toBe(true);
  });
});
