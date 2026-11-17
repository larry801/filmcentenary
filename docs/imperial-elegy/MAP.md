# The vector board

The board used to be rendered as one bitmap: `maps/world.jpg`, a 7706x5462 scan
of the printed map at roughly 15 MB. Opening the board downloaded and decoded
all of it before a single space appeared, and everything — place names,
counters, the connection lines — was baked into those pixels, so at fit zoom a
space was a handful of pixels wide and hard to hit.

The map is now drawn as vectors:

- **Terrain** — coastlines, region washes and the seas — is traced once from the
  scan into `src/imperialElegy/data/map-background.json` (about 120 KB of SVG
  paths, in the same 7706x5462 coordinate space as `constant/spaces.ts`).
- **Everything else** — space markers, connection lines, place names, unit
  counts, control colours — is drawn live from game state, so it stays sharp at
  any zoom and always matches the rules.
- **The Great War board** (`maps/greatWar.jpg`) is still an image: it is a small
  (1.6 MB) reference map with no interactive spaces, fetched only when its tab is
  opened.

## Regenerating the terrain

The traced paths are generated, not hand-drawn. Regenerate them after replacing
the scan:

```sh
python3 -m pip install --user numpy pillow
python3 scripts/generate-ie-map.py --preview /tmp/board.png
```

The script:

1. blanks every printed overlay the runtime redraws (space counters, adjacency
   lines, the naval-box plates and the chart panels);
2. classifies the remaining paper as land (warm parchment) or water (cool tint);
3. inpaints the blanked counters from their surroundings with a bounded
   breadth-first fill, so a counter sitting on a coast cannot gouge the
   shoreline and a chart printed over a gulf cannot seal it;
4. traces the resulting land, simplifies and smooths it, and writes one even-odd
   path per board region — the main map plus the Africa and North America inset
   panels.

`src/imperialElegy/map-background.test.ts` verifies the committed JSON against
the committed scan (SHA-256), checks that every subpath is closed, that the
inset panels sit inside the main map, and that every space falls inside the
printed paper.

## Printed connection lines

The board draws a line between every pair of adjacent spaces, and which line it
is matters:

| Line | Meaning |
| --- | --- |
| Solid dark | ordinary land frontier |
| Dashed dark | difficult frontier (the Alps, the Carpathians, the Caucasus) |
| Heavy dash | severe frontier |
| Dash-dot | the Trans-Siberian Railroad |
| Solid red, over water only | a sea route |

All of them are drawn, from `CONNECTIONS` in `constant/spaces.ts`, with the
styles in `components/connectionStyle.ts`.  Each line is trimmed at both ends so
it stops at the marker edge (a line running under a counter reads as a smudge on
the counter), and the sea routes are masked to the traced water so a long route
never cuts across a continent.  The selected space's own links are redrawn on
top, brighter.

Ports also print an anchor mark, which is the board's cue that a fleet can reach
the space; drawing a red line for each of the 120 sea routes at once turned the
sea into a web, so the anchors carry that information at rest and the routes
appear when a space is selected.

## Interaction

The interaction rules live in `components/map-geometry.ts` and are tested
without a DOM in `components/map-geometry.test.ts`:

- the clickable radius of a space is derived from **screen pixels** (14 px for a
  mouse, 22 px for touch) and clamped, so a space stays clickable at fit zoom
  without becoming a target for near misses when zoomed in;
- the nearest marker to the pointer wins, and legal targets get a small
  preference, so clicking two adjacent spaces in Germany selects the one aimed
  at rather than whichever is painted on top;
- the wheel and pinch zoom about the pointer, and panning is clamped so the
  board always covers the viewport;
- place names are placed greedily by importance (selection, legal targets,
  occupied spaces, capitals, the rest), never overlapping each other or a
  neighbouring marker's counter, and more names are revealed as the player zooms
  in.

Every board panel folds from its title bar (`IEPanel` in `components/theme.tsx`),
which matters on a phone and whenever a player is reading their hand, the log or
a decision instead of the map.  Clicking anywhere in the bar toggles the body;
the controls that live there — tabs, badges, close buttons — keep their own
behaviour, and a caret button carries `aria-expanded` for keyboard and
assistive-tech users.

A folded panel can still say what it holds, so folding never hides something
required: the map panel shows how many spaces are legal right now, and the
decision panel says that a decision is waiting.

The space chooser (`components/SpacePicker.tsx`) replaces the previous
145-entry `<select>`: it searches both printed languages ("柏林" and "berlin"
both find Berlin), filters by region, can show only the spaces the current
decision can use, and can centre the map on a space without selecting it. Its
filtering logic is `components/spaceFilter.ts`, tested in
`components/spaceFilter.test.tsx`.

## The printed sheet

`/board/imperialElegy` is the board as a single static vector sheet, not the
interactive map. It keeps the scan's 6693 × 4382 paper box and draws every
space, frontier, naval-box plate, counter flag, nameplate, chart and track from
`constant/spaces.ts` and the printed values beside it. Nothing is fetched at
runtime: the sheet has no `<image>`, no external font and no stylesheet
dependency when it is exported.

- **Route** — `src/imperialElegy/components/PrintedBoardPage.tsx`, linked from
  the map's framing bar as **印刷版图 / Printed board**.
- **Sheet** — `src/imperialElegy/components/PrintedBoard.tsx`; it uses the same
  traced terrain as the game map, so the two cannot drift apart.
- **Export** — the page's **Download SVG** button serialises the inline SVG at
  its native size. The checked-in snapshot is
  `public/imperial-elegy/maps/imperial-elegy-board.svg`, served directly at
  `/imperial-elegy/maps/imperial-elegy-board.svg`. The page also offers 100–400 %
  viewing zoom; printing hides the toolbar and app bar.
- **Tests** — `printedBoard.test.tsx` checks every land space, every naval
  plate, all nine printed charts, the four frontier line styles and the absence
  of raster or network references.
