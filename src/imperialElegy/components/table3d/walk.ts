/**
 * The camera's walk: the pure part of WASD and the touch stick.
 *
 * Both controls answer the same question — "how fast is the look-at point
 * moving this frame, and which way" — so the arithmetic lives here rather than
 * inside the component's animation loop, where it could not be tested without
 * a browser.  A unit is a fraction of full speed: `1` is a key held down or a
 * stick pushed to the rim, `0.5` half of either.
 */
export interface WalkInput {
  /** Positive walks up the screen, away from the camera. */
  forward: number;
  /** Positive walks toward the right of the screen. */
  right: number;
}

export const STILL: WalkInput = {forward: 0, right: 0};

/**
 * How fast a held key or a fully deflected stick walks, in CSS pixels per
 * second of the stage.  Expressed the way a drag is, so the same camera
 * distance means the same feel on a phone and on a desk.
 */
export const WALK_PIXELS_PER_SECOND = 620;

const clampAxis = (value: number): number => Math.max(-1, Math.min(1, value));

/** One axis of a stick drag, clamped to the knob's travel. */
export const stickAxis = (offset: number, radius: number): number => {
  if (radius <= 0) return 0;
  return clampAxis(offset / radius);
};

/**
 * The walk a set of held keys asks for.
 *
 * W and S are opposite on the forward axis, A and D on the right axis, and a
 * key and its opposite cancel — holding both walks nowhere rather than
 * jittering.  Any other key is ignored, so the map's own shortcuts still work.
 */
export const keysWalk = (keys: Iterable<string>): WalkInput => {
  let forward = 0;
  let right = 0;
  for (const key of keys) {
    if (key === "w") forward += 1;
    if (key === "s") forward -= 1;
    if (key === "d") right += 1;
    if (key === "a") right -= 1;
  }
  return {forward: clampAxis(forward), right: clampAxis(right)};
};

/** The two controls summed: a key and a stick may both be pushing. */
export const sumWalk = (key: WalkInput, stick: WalkInput): WalkInput => ({
  forward: clampAxis(key.forward + stick.forward),
  right: clampAxis(key.right + stick.right),
});

/** The stick's knob offset for a pointer, clamped to the rim. */
export const stickOffset = (
  pointer: {x: number; y: number},
  centre: {x: number; y: number},
  radius: number,
): {x: number; y: number} => {
  const dx = pointer.x - centre.x;
  const dy = pointer.y - centre.y;
  const travel = Math.hypot(dx, dy);
  const scale = travel > radius && radius > 0 ? radius / travel : 1;
  return {x: dx * scale, y: dy * scale};
};
