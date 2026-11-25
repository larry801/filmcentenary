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
| drag | orbit (yaw + elevation) |
| wheel / pinch | dolly toward the look-at point |
| right-drag / shift-drag | pan the look-at point across the table |
| click a marker | select the space (`onSelect`, same as the sheet) |
| arrows / Home / End | walk the legal targets |
| Enter / Space | select the focused target |
| `+ / − / ⟲ / ◎ / ⌃` | zoom, reset, fit targets, overhead 65° |

Every one of these has a keyboard equivalent because the stage is one focus
stop (`tabIndex` only while a target exists), exactly like the SVG map. The
legal targets are also exposed as off-screen buttons (`ie-space-*`) so a screen
reader hears the same list the rings describe without 145 tab stops.

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
| control plates | `G.spaces[id].control`, printed shape per space type, edge in ink |
| target rings | `MapTarget.style`, the printed key's vocabulary (pip / crosshair / rail / double) |
| selection ring | the lamp-toned ring, plus a hairline outer ring |
| counters | `stackSummary` → one standee per (power, kind, reduced), top three + `+N` |
| names | the hover tooltip; the printed map already names every space |

Counter faces are painted on a canvas (`counterFace.ts`) rather than snapshotted
from the SVG: a stylesheet does not reach into an SVG loaded as an image, so a
serialised `UnitToken` would lose every colour. The face is the printed design —
filled square, Elite circle, EF square, ship hull, "R" for a reserve, the
reduction band — with colours read from the tokens at runtime.

Colours never appear as literals in the scene: `palette.ts` reads the
`--ie-*` custom properties, including the felt-specific ring set
(`felt-move` … `felt-selection`) that `scripts/check-ie-contrast.mjs` holds to
3:1 on the cloth.

## 5. Assets and performance

`scripts/generate-ie-table-textures.py` derives two textures from the published
scan and records their checksums in `data/generated/table-textures.json`;
`yarn ie:table:check` fails when they drift (CI runs it). The derivatives are
*not* in the VASSAL manifest: `maps/world.jpg` already covers the source.

| Texture | Size | Bytes | Used when |
| --- | --- | --- | --- |
| `maps/world-table.jpg` | 4096 × 2903 | 2.9 MB | `maxTextureSize >= 4096` |
| `maps/world-table-small.jpg` | 1024 × 726 | 0.2 MB | small GPUs, phones |

Budget, measured on the 1440 × 900 desktop target: first frame under 1.5 s on a
warm cache (the scan is the only network asset), and the opening table draws
145 markers and ~34 standees. The renderer is created with
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

- `components/table3d/*.test.ts` — camera round-trip and clamps, fit framing,
  pick radius and tie-breaks, counter-face coverage for every power × kind.
- `components/MapPanel.test.tsx` — the chips, the lazy boundary, the fallback.
- `e2e/table3d.spec.ts` — against real SwiftShader WebGL in CI: the scan loads,
  145 markers and counters are drawn, a click selects a space, a drag repaints,
  the sheet round-trip keeps the selection, and both materials differ.
- `yarn ie:table:check`, `yarn ie:tokens:check`, `yarn ie:contrast`.
