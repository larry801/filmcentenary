/**
 * Unit faces: every counter a stack can produce must resolve to a file the
 * extraction script actually published, a two-step counter must flip to its
 * printed back, and the reserve army must carry the module's badge.
 */
import {existsSync} from "fs";
import {join} from "path";
import {POWER_KEYS} from "../boardHelpers";
import type {UnitKind} from "../../types";
import {unitFaceArt} from "./unitArt";

const KINDS: UnitKind[] = [
  "army", "reserveArmy", "eliteCorps", "expeditionary", "squadron", "dreadnought",
];

/** A published face's path on disk, from the URL the scene is given. */
const published = (url: string): string =>
  join(__dirname, "../../../../public", url.replace(/^\//, ""));

test("every power and kind stands on a published counter face", () => {
  for (const power of POWER_KEYS) {
    for (const kind of KINDS) {
      const art = unitFaceArt(power, kind, false);
      expect(art).not.toBeNull();
      expect(art!.url).toMatch(/^\/imperial-elegy\/units\/[A-Z]{2}-[A-Za-z]+-full\.png$/);
      expect(existsSync(published(art!.url))).toBe(true);
    }
  }
});

test("a reduced counter shows the module's back, and a one-step counter does not", () => {
  for (const power of POWER_KEYS) {
    for (const kind of KINDS) {
      const front = unitFaceArt(power, kind, false)!;
      const back = unitFaceArt(power, kind, true)!;
      const steps = kind === "eliteCorps" || kind === "expeditionary" ? 1 : 2;
      if (steps === 1) expect(back.url).toBe(front.url);
      else {
        expect(back.url).not.toBe(front.url);
        expect(back.url).toMatch(/-reduced\.png$/);
        expect(existsSync(published(back.url))).toBe(true);
      }
    }
  }
});

test("only a reserve army wears the reserve badge", () => {
  expect(unitFaceArt("GE", "reserveArmy", false)!.badge).toBe("/imperial-elegy/units/reserve-badge.jpg");
  for (const kind of KINDS.filter((entry) => entry !== "reserveArmy")) {
    expect(unitFaceArt("GE", kind, false)!.badge).toBeUndefined();
  }
});

test("a naval counter keeps the printed 200 x 120 proportions", () => {
  expect(unitFaceArt("UK", "squadron", false)!.aspect).toBeCloseTo(200 / 120);
  expect(unitFaceArt("UK", "dreadnought", false)!.aspect).toBeCloseTo(200 / 120);
  expect(unitFaceArt("UK", "army", false)!.aspect).toBe(1);
  expect(unitFaceArt("UK", "eliteCorps", false)!.aspect).toBe(1);
});

test("an owner the module prints no counter for has no face", () => {
  expect(unitFaceArt("IT", "army", false)).toBeNull();
  expect(unitFaceArt("Bavaria", "army", false)).toBeNull();
});

test("the colonial EF falls back to the power's expeditionary counter", () => {
  const colonial = unitFaceArt("FR", "eliteColonialEf", false)!;
  expect(colonial.url).toBe("/imperial-elegy/units/FR-colonialEf-full.png");
  const generic = unitFaceArt("AU", "eliteColonialEf", false)!;
  expect(generic.url).toBe("/imperial-elegy/units/AU-ef-full.png");
});
