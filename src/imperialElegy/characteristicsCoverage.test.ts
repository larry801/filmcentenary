/**
 * Typed coverage for every national-characteristic bullet printed on the six
 * power displays (33.1–33.6), plus the audit fixes made in this round.
 *
 * The registry (`engine/characteristicsCoverage.ts`) is the single place that
 * says whether a bullet is live or display-only.  These tests pin it to the
 * printed text in `constant/powers.ts` in both directions, so a new or edited
 * display bullet cannot silently drop out of the audit.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {POWER_DEFS} from "./constant/powers";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {
  CHARACTERISTICS_COVERAGE,
  CHARACTERISTICS_POWER_ORDER,
  DISPLAY_ONLY_CHARACTERISTICS,
  characteristicsCoverageFor,
  type CharacteristicCoverageEntry,
} from "./engine/characteristicsCoverage";
import {pacificationModifier} from "./engine/characteristics";
import {pacify} from "./moves";

const makeCtx = (dice: number[] = [3], playerID: string | null = "0"): Ctx => {
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

/** `engine/file.ts#helper` or `moves.ts#helper`, joined with `; `. */
const IMPLEMENTATION_TOKEN =
  /^(?:(?:engine|constant)\/[A-Za-z0-9]+\.ts|moves\.ts)#[A-Za-z0-9_]+$/;

const bulletText = (entry: CharacteristicCoverageEntry): string =>
  POWER_DEFS[entry.power].characteristics[entry.index]?.en ?? "";

describe("characteristics coverage registry", () => {
  test("there is exactly one entry for every printed bullet on every display", () => {
    for (const power of CHARACTERISTICS_POWER_ORDER) {
      const printed = POWER_DEFS[power].characteristics;
      const entries = characteristicsCoverageFor(power);

      expect(entries.map((entry) => entry.index)).toEqual(printed.map((_, index) => index));
      expect(entries.map((entry) => entry.label)).toHaveLength(printed.length);
    }

    const printedTotal = POWERS.reduce(
      (total, power) => total + POWER_DEFS[power].characteristics.length,
      0,
    );
    expect(CHARACTERISTICS_COVERAGE).toHaveLength(printedTotal);
  });

  test("every entry points back at its printed bullet", () => {
    for (const entry of CHARACTERISTICS_COVERAGE) {
      const bullet = bulletText(entry);
      expect(bullet.length).toBeGreaterThan(0);
      // The trait name is the printed text before the colon.
      expect(bullet.startsWith(`${entry.label}:`)).toBe(true);
    }
  });

  test("live entries name a real helper/move module and are non-empty", () => {
    const live = CHARACTERISTICS_COVERAGE.filter((entry) => entry.status === "live");
    expect(live.length).toBeGreaterThan(0);
    for (const entry of live) {
      expect(entry.implementation.trim().length).toBeGreaterThan(0);
      for (const token of entry.implementation.split("; ")) {
        expect(token).toMatch(IMPLEMENTATION_TOKEN);
      }
      if (entry.gaps) {
        for (const gap of entry.gaps) expect(gap.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test("display-only entries carry a reason and no helper reference", () => {
    for (const entry of CHARACTERISTICS_COVERAGE) {
      if (entry.status !== "display-only") continue;
      expect(entry.reason.trim().length).toBeGreaterThan(0);
      expect("implementation" in entry).toBe(false);
      // The display-only bullet is still represented against printed text.
      expect(bulletText(entry).startsWith(`${entry.label}:`)).toBe(true);
    }
    // Every display-only entry is also exposed by the dedicated accessor.
    expect(DISPLAY_ONLY_CHARACTERISTICS).toEqual(
      CHARACTERISTICS_COVERAGE.filter((entry) => entry.status === "display-only"),
    );
  });

  test("the registry uses the printed power order and unique ids", () => {
    const seen = new Set<string>();
    for (const entry of CHARACTERISTICS_COVERAGE) {
      const id = `${entry.power}:${entry.index}`;
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
    expect(CHARACTERISTICS_POWER_ORDER).toEqual(POWERS);
  });
});

describe("audit fix: Zouaves / elite colonial EF pacification DRM (33.3, A78)", () => {
  test("an elite colonial unit in the space adds +1; both types add +2", () => {
    const G = fresh();
    expect(pacificationModifier(G, "FR", "west-africa")).toMatchObject({drm: 0, sources: []});

    const zouave = placeUnit(G, "FR", "zouave", "west-africa", 1);
    expect(pacificationModifier(G, "FR", "west-africa")).toMatchObject({
      drm: 1,
      sources: ["zouaves"],
    });

    placeUnit(G, "FR", "eliteColonialEf", "west-africa", 1);
    expect(pacificationModifier(G, "FR", "west-africa")).toMatchObject({
      drm: 2,
      sources: ["zouaves", "eliteColonialEf"],
    });

    // Only the pacifying power's own elite unit counts.
    expect(pacificationModifier(G, "UK", "west-africa").drm).toBe(0);
    expect(zouave.owner).toBe("FR");
  });

  test("live: the Zouaves +1 turns a 9 into a successful pacification of West Africa", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "FR";
    G.cpRemaining = 3;
    G.pending = null;
    G.spaces["west-africa"].influence = "FR";
    G.spaces["west-africa"].pacification = 0;
    placeUnit(G, "FR", "zouave", "west-africa", 1);

    // Two dice 4+5 = 9 plus the Zouaves' +1 reaches the printed 10.
    expect(pacify(G, makeCtx([4, 5], seat("FR")), "west-africa")).toBeUndefined();
    expect(G.spaces["west-africa"].control).toBe("FR");
  });

  test("live: without an elite colonial unit the same 9 fails", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "FR";
    G.cpRemaining = 3;
    G.pending = null;
    G.spaces["west-africa"].influence = "FR";
    G.spaces["west-africa"].pacification = 0;

    expect(pacify(G, makeCtx([4, 5], seat("FR")), "west-africa")).toBeUndefined();
    expect(G.spaces["west-africa"].control).toBeNull();
    expect(G.spaces["west-africa"].pacification).toBe(1);
  });

  test("live: an A78 elite colonial EF adds the same +1", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "UK";
    G.cpRemaining = 3;
    G.pending = null;
    G.spaces["west-africa"].influence = "UK";
    G.spaces["west-africa"].pacification = 0;
    placeUnit(G, "UK", "eliteColonialEf", "west-africa", 1);

    expect(pacify(G, makeCtx([4, 5], seat("UK")), "west-africa")).toBeUndefined();
    expect(G.spaces["west-africa"].control).toBe("UK");
  });
});
