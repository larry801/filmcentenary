/**
 * The table's colours, read from the Imperial Elegy tokens at runtime.
 *
 * `design/tokens.json` is the single source of colour and the generated
 * stylesheet is the only place a hex may live, so the 3D scene never names a
 * colour: it reads the custom properties the same way a component would.  The
 * two materials use different ring colours on purpose — the ink rings are
 * legible on the paper sheet, and the felt table needs their light variants
 * (checked at 3:1 in `scripts/check-ie-contrast.mjs`).
 */
import {POWER_KEYS} from "../boardHelpers";
import type {MapTargetStyle} from "../map";
import type {CounterColours, CounterPalette} from "./counterFace";
import type {TableArt} from "./camera";

export interface TablePalette {
  art: TableArt;
  /** Behind the table. */
  background: string;
  felt: string;
  feltRaised: string;
  wood: string;
  woodShade: string;
  lamp: string;
  /** The printed sheet and every counter's paper edge. */
  paper: string;
  ink: string;
  /** Target rings, by the vocabulary the printed key uses. */
  rings: Record<MapTargetStyle, string>;
  /** The selection ring and the keyboard focus ring. */
  selection: string;
  focus: string;
  counters: CounterPalette;
}

const value = (styles: CSSStyleDeclaration, name: string, fallback: string): string => {
  const raw = styles.getPropertyValue(name).trim();
  return raw === "" ? fallback : raw;
};

/** A palette for an art direction. Safe on the server: falls back to ink values. */
export const readTablePalette = (art: TableArt, root?: Element | null): TablePalette => {
  const styles = typeof window === "undefined" || typeof document === "undefined"
    ? null
    : window.getComputedStyle(root ?? document.documentElement);
  const read = (name: string, fallback: string): string =>
    styles === null ? fallback : value(styles, name, fallback);
  const paper = read("--ie-paper", "#F2E9D8");
  const ink = read("--ie-ink", "#241C14");
  const powers: Record<string, CounterColours> = {};
  for (const power of POWER_KEYS) {
    const key = power.toLowerCase();
    powers[power] = {
      fill: read(`--ie-power-${key}`, "#8B8B8B"),
      // The printed counters are framed in ink, never in a second power colour.
      dark: ink,
      ink: read(`--ie-power-${key}-on-fill`, paper),
    };
  }
  const felt = art === "felt";
  return {
    art,
    background: felt ? read("--ie-felt-2", "#35463B") : read("--ie-table", "#F4F2EC"),
    felt: read("--ie-felt", "#2B3A31"),
    feltRaised: read("--ie-felt-2", "#35463B"),
    wood: read("--ie-wood", "#4A3527"),
    woodShade: read("--ie-wood-2", "#33241A"),
    lamp: read("--ie-lamp", "#F6DFB4"),
    paper,
    ink,
    rings: felt
      ? {
        move: read("--ie-felt-move", "#7FB3D0"),
        attack: read("--ie-felt-attack", "#E08A72"),
        rail: read("--ie-felt-rail", "#D7B36A"),
        choice: read("--ie-felt-choice", "#E8E1CF"),
        pending: read("--ie-felt-pending", "#E8A08E"),
      }
      : {
        move: read("--ie-move-ink", "#2F5D7C"),
        attack: read("--ie-overprint", "#A3372A"),
        rail: read("--ie-brass-ink", "#1F5A78"),
        choice: read("--ie-ink", "#241C14"),
        pending: read("--ie-overprint", "#A3372A"),
      },
    selection: felt ? read("--ie-felt-selection", "#F6DFB4") : read("--ie-focus-paper", "#1F5A78"),
    focus: read("--ie-focus-paper", "#1F5A78"),
    counters: {
      powers,
      paper,
      ink,
      neutral: {
        fill: read("--ie-power-neutral", "#7B5AA6"),
        dark: ink,
        ink: read("--ie-power-neutral-on-fill", paper),
      },
    },
  };
};
