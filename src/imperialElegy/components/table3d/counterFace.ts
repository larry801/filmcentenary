/**
 * The face of a counter standing on the 3D table.
 *
 * The map draws its counters as SVG so they stay sharp at any zoom; a texture
 * cannot.  What a standee needs instead is a raster face that is *drawn*, not
 * styled: an `<img>` of the SVG would lose every colour, because the document's
 * stylesheet does not reach into an SVG loaded as an image.  So the face is
 * reduced to plain data here and painted onto a canvas by `drawCounterFace`.
 *
 * The design is the printed counter's: a filled square for an army (an "R" for
 * a reserve), a circle for an Elite Corps, a small square for an Expeditionary
 * Force, a hull for a squadron.  A reduced counter carries the printed diagonal
 * band.  Colours come from the Imperial Elegy tokens, never from this file.
 */
import type {Power, UnitKind} from "../../types";
import {type TokenShape, tokenKindOf} from "../stackSummary";

export interface CounterColours {
  fill: string;
  /** The printed edge; darker than the fill, or the paper edge for a pale power. */
  dark: string;
  /** Legible ink on the fill, for the "R" and the hull's deck. */
  ink: string;
}

export interface CounterPalette {
  powers: Record<string, CounterColours>;
  /** The paper edge every standee shares. */
  paper: string;
  /** The printed ink: counter outlines and the standee's base. */
  ink: string;
  /** Fallback edge for a power the palette does not name. */
  neutral: CounterColours;
}

export interface CounterFace {
  shape: TokenShape;
  fill: string;
  dark: string;
  ink: string;
  /** Printed inside the shape, or null. */
  mark: string | null;
  reduced: boolean;
}

export const counterFace = (
  power: Power | string,
  kind: UnitKind,
  reduced: boolean,
  palette: CounterPalette,
): CounterFace => {
  const colours = palette.powers[power] ?? palette.neutral;
  return {
    shape: tokenKindOf(kind),
    fill: colours.fill,
    dark: colours.dark,
    ink: colours.ink,
    mark: kind === "reserveArmy" ? "R" : null,
    reduced,
  };
};

/** A standee's texture side, in pixels.  Square, transparent outside the shape. */
export const COUNTER_TEXTURE_PX = 256;

const SQUARE_INSET = 0.12;
const EF_INSET = 0.3;

/** Paint one counter face.  `size` is the square canvas's side, in pixels. */
export const drawCounterFace = (
  context: CanvasRenderingContext2D,
  size: number,
  face: CounterFace,
): void => {
  const centre = size / 2;
  const radius = size * 0.44;
  context.clearRect(0, 0, size, size);
  context.lineJoin = "round";
  context.lineWidth = Math.max(3, size * 0.035);
  context.strokeStyle = face.dark;
  context.fillStyle = face.fill;

  context.beginPath();
  if (face.shape === "elite") {
    context.arc(centre, centre, radius, 0, Math.PI * 2);
  } else if (face.shape === "ef") {
    const half = radius * (1 - EF_INSET * 2);
    context.rect(centre - half, centre - half, half * 2, half * 2);
  } else if (face.shape === "ship") {
    // The printed hull: a flat deck with a chamfered bow, a deck box and a line.
    const left = centre - radius;
    const right = centre + radius;
    const top = centre - radius * 0.45;
    const bottom = centre + radius * 0.55;
    context.moveTo(left, top);
    context.lineTo(right, top);
    context.lineTo(right - radius * 0.45, bottom);
    context.lineTo(left + radius * 0.45, bottom);
    context.closePath();
  } else {
    const half = radius * (1 - SQUARE_INSET);
    context.rect(centre - half, centre - half, half * 2, half * 2);
  }
  context.fill();
  context.stroke();

  if (face.shape === "ship") {
    context.fillStyle = face.ink;
    context.fillRect(centre - radius * 0.2, centre - radius * 0.42, radius * 0.4, radius * 0.42);
    context.strokeStyle = face.ink;
    context.lineWidth = Math.max(2, size * 0.02);
    context.beginPath();
    context.moveTo(centre - radius * 0.72, centre - radius * 0.45);
    context.lineTo(centre + radius * 0.72, centre - radius * 0.45);
    context.stroke();
  }

  if (face.reduced) {
    // The printed removal band: one diagonal across the face, in the edge ink.
    context.strokeStyle = face.dark;
    context.lineWidth = Math.max(3, size * 0.045);
    context.beginPath();
    context.moveTo(centre - radius * 0.8, centre + radius * 0.8);
    context.lineTo(centre + radius * 0.8, centre - radius * 0.8);
    context.stroke();
  }

  if (face.mark !== null) {
    context.fillStyle = face.ink;
    context.font = `700 ${Math.round(size * 0.44)}px system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(face.mark, centre, centre + size * 0.02);
  }
};

/**
 * Paint a published counter face into a standee's square texture.
 *
 * The module prints a squadron at 200 x 120, so the face is stretched across
 * the square canvas here and the standee's own geometry carries the printed
 * proportions back.  `badge` is the module's reserve marker, drawn in the
 * face's corner so the army underneath stays readable.
 */
export const drawUnitFace = (
  context: CanvasRenderingContext2D,
  size: number,
  face: CanvasImageSource,
  badge: CanvasImageSource | null,
): void => {
  context.clearRect(0, 0, size, size);
  context.drawImage(face, 0, 0, size, size);
  if (badge === null) return;
  const badgeSize = size * 0.26;
  const inset = size * 0.055;
  context.drawImage(badge, size - badgeSize - inset, inset, badgeSize, badgeSize);
};
