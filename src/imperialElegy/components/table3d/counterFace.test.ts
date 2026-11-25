/**
 * Counter faces: every power and kind a stack can produce must have a face, and
 * the shape it draws has to be the one the printed counter family uses.
 */
import {POWER_KEYS} from "../boardHelpers";
import {tokenKindOf} from "../stackSummary";
import type {UnitKind} from "../../types";
import {type CounterPalette, counterFace} from "./counterFace";

const palette: CounterPalette = {
  powers: Object.fromEntries(POWER_KEYS.map((power) => [power, {
    fill: "#123456",
    dark: "#111111",
    ink: "#ffffff",
  }])),
  paper: "#F2E9D8",
  ink: "#241C14",
  neutral: {fill: "#7B5AA6", dark: "#241C14", ink: "#F2E9D8"},
};

const KINDS: UnitKind[] = [
  "army", "reserveArmy", "eliteCorps", "expeditionary", "squadron", "dreadnought",
];

test("every power and kind resolves to a face with the printed shape", () => {
  for (const power of POWER_KEYS) {
    for (const kind of KINDS) {
      const face = counterFace(power, kind, false, palette);
      expect(face.shape).toBe(tokenKindOf(kind));
      expect(face.fill).toMatch(/^#[0-9a-f]{6}$/i);
      expect(face.dark).toMatch(/^#[0-9a-f]{6}$/i);
      expect(face.ink).toMatch(/^#[0-9a-f]{6}$/i);
    }
  }
});

test("only a reserve army prints the R", () => {
  expect(counterFace("GE", "reserveArmy", false, palette).mark).toBe("R");
  for (const kind of KINDS.filter((entry) => entry !== "reserveArmy")) {
    expect(counterFace("GE", kind, false, palette).mark).toBeNull();
  }
});

test("a reduced counter keeps its band", () => {
  expect(counterFace("FR", "army", true, palette).reduced).toBe(true);
  expect(counterFace("FR", "army", false, palette).reduced).toBe(false);
});

test("a power the palette does not name falls back to the neutral counter", () => {
  const face = counterFace("XX", "army", false, palette);
  expect(face.fill).toBe(palette.neutral.fill);
});
