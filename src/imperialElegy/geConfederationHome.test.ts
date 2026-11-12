/**
 * 33.1 German Confederation / 33.1.1 German Unification:
 * "Whenever GE takes control of a German unification space it becomes a
 * permanent home space."
 *
 * Every control-changing settlement (annexation, treaty, conquest, GW capture)
 * funnels through `recomputeTracks`; the shared sweep
 * `applyGermanConfederationHomeOverrides` stamps the permanent `homeOverride`
 * there, not just on the German Confederation annexation.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {isHomeSpace, recomputeTracks} from "./engine/rules";
import {SPACES} from "./constant/spaces";
import {
  applyGermanConfederationHomeOverrides,
  germanConfederationCandidates,
} from "./engine/characteristics";
import {checkGermanUnification} from "./engine/victory";
import {placeUnit} from "./engine/effects";
import {resolvePending} from "./moves";

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

const GERMAN = Object.values(SPACES).filter((space) => space.flashpoints?.includes("germany"));

describe("33.1 German Confederation permanent home spaces", () => {
  test("a German unification space is not a GE home space before GE controls it", () => {
    const G = fresh();
    expect(GERMAN.length).toBeGreaterThan(0);
    expect(isHomeSpace(G, "bavaria", "GE")).toBe(false);
    expect(applyGermanConfederationHomeOverrides(G)).toEqual([]);
  });

  test("a treaty/conquest gain of a German unification space is stamped by the live sweep", () => {
    const G = fresh();
    // A won war's treaty hands GE control of Bavaria (the treaty application
    // writes `control`; `recomputeTracks` is the live settlement sweep).
    G.spaces.bavaria.control = "GE";
    G.spaces.bavaria.ally = null;
    recomputeTracks(G);

    expect(G.spaces.bavaria.homeOverride).toBe("GE");
    expect(isHomeSpace(G, "bavaria", "GE")).toBe(true);
    // Idempotent: a second sweep stamps nothing new.
    expect(applyGermanConfederationHomeOverrides(G)).toEqual([]);
  });

  test("the stamp is permanent: losing the space does not remove the home override", () => {
    const G = fresh();
    G.spaces.hanover.control = "GE";
    recomputeTracks(G);
    expect(G.spaces.hanover.homeOverride).toBe("GE");

    G.spaces.hanover.control = "AU";
    recomputeTracks(G);
    expect(G.spaces.hanover.homeOverride).toBe("GE");
  });

  test("every German space GE controls is stamped, including one already printed home", () => {
    const G = fresh();
    for (const space of GERMAN) G.spaces[space.id].control = "GE";
    recomputeTracks(G);
    for (const space of GERMAN) {
      if (space.home === "GE") continue; // already a printed GE home
      expect(G.spaces[space.id].homeOverride).toBe("GE");
    }
    // The unification check keeps them (a unified Germany owns them all).
    if (!G.powers.GE.unified) expect(checkGermanUnification(G, makeCtx([3]))).toBe(true);
    for (const space of GERMAN) {
      if (space.home !== "GE") expect(G.spaces[space.id].homeOverride).toBe("GE");
    }
  });

  test("the annexation path stamps the same override as the sweep", () => {
    const G = fresh();
    G.spaces.bavaria.control = "Bavaria";
    G.spaces.bavaria.ally = "GE";
    placeUnit(G, "Bavaria", "army", "bavaria", 2);
    expect(germanConfederationCandidates(G).map((entry) => entry.minor)).toContain("Bavaria");
    // Simulate the live annexation (the pending itself is covered by
    // geCharacteristicsLive.test.ts).
    G.spaces.bavaria.control = "GE";
    G.spaces.bavaria.ally = null;
    recomputeTracks(G);
    expect(G.spaces.bavaria.homeOverride).toBe("GE");
    expect(G.units[Object.keys(G.units).find((id) => G.units[id].owner === "Bavaria") ?? ""]?.owner).toBe("Bavaria");
  });

  test("negative: a non-German space GE controls is untouched", () => {
    const G = fresh();
    G.spaces.bohemia.control = "GE";
    recomputeTracks(G);
    expect(G.spaces.bohemia.homeOverride).not.toBe("GE");
  });

  test("negative: an enemy-controlled German space is never stamped for GE", () => {
    const G = fresh();
    G.spaces.bavaria.control = "AU";
    expect(applyGermanConfederationHomeOverrides(G)).toEqual([]);
    expect(G.spaces.bavaria.homeOverride).not.toBe("GE");
  });
});
