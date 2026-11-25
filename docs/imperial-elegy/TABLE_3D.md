# Imperial Elegy — the 3D table

**Status:** implemented; opt-in. The printed sheet remains the default map.
**Revision:** 1.0 — 2026-11-25
**Related:** [`MINIMAL_UI.md`](MINIMAL_UI.md) (the sheet it coexists with),
[`README.md`](README.md) (layout and behaviour), [`ASSETS.md`](ASSETS.md)
(where the map scan comes from).

---

## 1. Intent

The same board, read as the physical game: the printed map sheet lying on a
table, the live control plates on top of it, and the unit counters standing as
cardboard standees. It is a *presentation*, not a second implementation — the
same `G`, the same selection, the same legal targets, the same `onSelect`.

Two materials:

| Material | What it is | When |
| --- | --- | --- |
| `felt` (default) | dark green cloth, a wooden rim, a warm key light, soft shadows | the tabletop reading |
| `paper` | the One Sheet palette: plain paper ground, neutral light, no rim | when the reader wants the table without leaving the document's colours |

The reader switches with the map's own chip (`平面图 / 3D`) or from Display →
Map. The choice is stored (`ie_map_view`, `ie_table_art`) and read back on the
next visit.

## 2. Controls

| Gesture | Effect |
| --- | --- |
| drag | orbit (yaw + elevation, floored at 29° — see below) |
| wheel / pinch | dolly toward the look-at point |
| right-drag / shift-drag | pan the look-at point across the table |
| `W A S D` | walk the look-at point up / left / down / right, screen-relative |
| the corner stick (touch) | the same walk, with the knob's deflection as the speed |
| click a marker | select the space (`onSelect`, same as the sheet) |
| arrows / Home / End | walk the legal targets |
| Enter / Space | select the focused target |
| `+ / − / ⟲ / ◎ / ⌃` | zoom, reset, fit targets, overhead 65° |

Walking is a *held* movement, not one nudge per press: a key or a deflected
stick moves the camera every frame at `WALK_PIXELS_PER_SECOND` (620 px/s of the
stage, so it feels the same at any zoom), and the look-at point is clamped to
the sheet, so a held key can never walk the table out of sight. A drag is
unbounded on purpose — it ends when the pointer lifts. The walk itself is pure
arithmetic in `table3d/walk.ts` (keys → axis, stick → axis, the two summed),
and `walkCamera` in `camera.ts` turns an axis pair into the same pan a drag
performs, so a walk reads the way the screen reads whatever the orbit is.

The elevation has a floor (`MIN_PITCH`, 0.5 rad ≈ 29°). Below it the sheet
foreshortens into a sliver, the printed names disappear behind the front
counters, and every flat layer squeezes into the same depth buckets. The floor
is what players asked for; it is not a preference, so it lives in the camera
rather than in a setting.

Every camera control has a keyboard equivalent, so the stage is one focus stop
whether or not a move is in progress: the camera is always walkable, and the
arrow keys pick up the legal targets as soon as there are any. The legal targets
are also exposed as off-screen buttons (`ie-space-*`) so a screen reader hears
the same list the rings describe without 145 tab stops.

## 3. Geometry and picking

Board units are the SVG map's (`x` right, `y` down, 7706 × 5462). World units
are board units / 1000 with `y` up, so the table is the `y = 0` plane.

`components/table3d/camera.ts` owns the camera and the projection as plain
arithmetic, and `scene.ts` builds the `THREE.PerspectiveCamera` from exactly
those numbers. That is deliberate: `getBoundingClientRect` cannot describe a
perspective transform, so a CSS-tilted sheet would mis-map every click. Instead
a pointer is unprojected through the same basis, its ray is intersected with the
table plane, and the result goes through the map's own `nearestCandidate`
(`MOUSE_HIT_PX` / `TOUCH_HIT_PX`, clamped to `MIN_HIT_UNITS`..`MAX_HIT_UNITS`).
A legal target carries the same quarter-radius weight the SVG rings carry, so it
wins a tie and never steals a click from a clearly nearer marker.

`camera.test.ts` pins the contract: `unproject(project(p))` round-trips to the
pixel for overhead, tilted and grazing cameras, and a pointer above the horizon
has no table point.

## 4. What is drawn

| Layer | Source |
| --- | --- |
| table | felt plane + wooden rim, or the paper ground |
| sheet | the published map scan (`maps/world-table.jpg`), 1:1 with the space coordinates |
| sheet edge | the sheet's cardboard thickness, stacked strictly *below* the sheet (see below) |
| control plates | `G.spaces[id].control`, printed shape per space type, edge in ink |
| target rings | `MapTarget.style`, the printed key's vocabulary (pip / crosshair / rail / double) |
| selection ring | the lamp-toned ring, plus a hairline outer ring |
| counters | `stackSummary` → one standee per (power, kind, reduced), top three + `+N`, wearing the module's printed counter face |
| names | the hover tooltip; the printed map already names every space |

The sheet and its edge are drawn as two parallel planes. They are separated in
both height (`SHEET_EDGE_TOP`) and depth (`SHEET_DEPTH_OFFSET`, a constant
`polygonOffsetUnits` pull toward the camera) because a coplanar pair makes the
depth test a coin toss: with the edge's top face exactly on the sheet's plane
and the same footprint, some frames let the plain edge win and the whole
printed map vanished for that frame — the board flashed blank under a drag. The
constant offset, rather than a slope offset, is what keeps the sheet in front
at every camera distance.

A standee wears the module's own counter. `unitArt.ts` maps (power, kind,
reduced) to a published face under `units/` — the printed front, or the back the
module's "Reduced" layer flips to after a step loss — and the face is painted
into a canvas texture (`counterFace.ts`), with the module's reserve badge over a
reserve army. A squadron keeps its printed 200 × 120 proportions, so its standee
is wider and shorter than an army's.

The standee is on the table before the image decodes, so the same canvas is
first painted with a drawn stand-in — the printed family's shape in the power's
colour, read from the tokens at runtime, "R" for a reserve, the reduction band.
A face that fails to decode keeps that stand-in rather than showing an empty
counter; `data-faces` reports how many textures came from the module.

Colours never appear as literals in the scene: `palette.ts` reads the
`--ie-*` custom properties, including the felt-specific ring set
(`felt-move` … `felt-selection`) that `scripts/check-ie-contrast.mjs` holds to
3:1 on the cloth. That palette now dresses the fallback and the rings; a counter
face carries the module's own colours.

## 5. Assets and performance

`scripts/generate-ie-table-textures.py` derives two textures from the published
scan and records their checksums in `data/generated/table-textures.json`;
`yarn ie:table:check` fails when they drift (CI runs it). The derivatives are
*not* in the VASSAL manifest: `maps/world.jpg` already covers the source.

| Texture | Size | Bytes | Used when |
| --- | --- | --- | --- |
| `maps/world-table.jpg` | 4096 × 2903 | 2.9 MB | `maxTextureSize >= 4096` |
| `maps/world-table-small.jpg` | 1024 × 726 | 0.2 MB | small GPUs, phones |
| `units/*` | 141 × 141 (army, elite, EF) or 200 × 120 (squadron, dreadnought) | ~10–30 KB each | one face per standee, decoded once and shared |

Budget, measured on the 1440 × 900 desktop target: first frame under 1.5 s on a
warm cache, and the opening table draws 145 markers and ~34 standees over 16
distinct faces. The renderer is created with
`powerPreference: "high-performance"`, `pixelRatio` capped at 2, and soft
shadows only in the felt material — paper switches them off.

Order of degradation when a device cannot keep up: shadows off → pixel ratio
down to 1 → the small texture. None of these changes what the board says.

## 6. Failure and lifecycle

- **No WebGL, or a lost context:** the host renders the sheet and says so
  (`ie-table-3d-fallback`). A renderer problem never blocks a turn.
- **Lazy chunk:** three.js is imported only by `TableMap`, which `MapPanel`
  loads with `React.lazy`. The sheet path, SSR and the unit suites never load
  it; a source-level test keeps it that way.
- **Hotseat:** only the seat in front mounts a board, so there is one context at
  a time; `dispose()` releases the context explicitly, because a browser caps
  how many a page may hold and seat switching would otherwise exhaust them.

## 7. Verification

- `components/table3d/*.test.ts` — camera round-trip and clamps (including the
  elevation floor), the walk (direction, screen-relativity, distance scaling and
  the sheet clamp), fit framing, pick radius and tie-breaks, counter-face
  coverage for every power × kind, and `unitArt.test.ts` — every power × kind
  resolves to a face that exists on disk, a two-step counter flips to its
  printed back, only a reserve army carries the badge, and a naval face keeps
  200 × 120. `walk.test.ts` pins the keys→axis and stick→axis mapping.
- `components/MapPanel.test.tsx` — the chips, the lazy boundary, the fallback.
- `e2e/table3d.spec.ts` — against real SwiftShader WebGL in CI: the scan loads,
  145 markers and counters are drawn (`data-faces` proves they wear the
  module's faces), a click selects a space, a drag repaints, the printed sheet
  keeps drawing in every frame of an orbit (the coplanar edge used to blank it,
  and a blank map compresses well under two thirds of a printed one), WASD walks
  and settles on release, and a phone gets the stick — which walks without the
  stage ever claiming the pointer,
  the sheet round-trip keeps the selection, and both materials differ.
  It has its own config (`playwright.table3d.config.ts`, `yarn
  test:e2e:table3d`) and its own CI runner: software-rasterising a table scene
  beside the VQ boards starved their ten-second waits, so the two never share a
  machine, and `yarn test:e2e` stays the sheet-and-rules suite.
- `yarn ie:table:check`, `yarn ie:tokens:check`, `yarn ie:contrast`.
