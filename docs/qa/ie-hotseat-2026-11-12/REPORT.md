# Imperial Elegy QA — 2026-11-12

Environment: local hotseat at `/localIE`, Chromium 1440×900 and 1600×1000,
Chinese (default) and English UI.

## Screenshots

1. `01-initial.png` — six seat tabs, 1850 campaign setup, 15-unit count badges
   on the world map, hand with bilingual card text.
2. `02-action-selected.png` — action phase, Berlin selected, adjacent spaces
   highlighted, action palette, war/fort/influence buttons, MPIT values.
3. `03-charts.png` — reference chart drawer (flashpoints, CRT, colonial war,
   war aims, crisis table, influence track, Italy/legend, sequence of play,
   counter count).
4. `04-english.png` — the same match with the English locale; all controls,
   phase names, track labels, log lines and card descriptions switch without
   remounting the match.

## Checks performed

- All six seats can complete Prep and choose a home card independently; the
  phase advances to Diplomacy and then Action without a reload.
- Switching tabs does not recreate the match (the log persists and seat hands
  stay in place).
- Playing a card for CP deducts the card and exposes the CP counter; ending the
  impulse advances to the next active power.
- Clicking a map marker selects the space and shows control, influence,
  diplomacy, alliance, fort, pacification, rebellion, ports, connections and
  the stack; action buttons are shown only to the active seat.
- The public log hides other players' home-card choices (`"card":"hidden"`).
- The spectacle route shows the “观战者” badge, hides hands, and rejects moves
  (verified against a local boardgame.io server on port 3999).
- Online join route: `/join/imperialElegy/:matchID/:player` creates/reuses
  credentials and mounts the same board.
- Asset manifest `--check` verifies 501 published files with SHA-256.
- `jest src/imperialElegy` — 50 tests, including a full seven-turn auto-play campaign ending; no placeholder card events (the fuzz
  test plays every action/home/GW card through its event path).
- `tsc --noEmit` and `tsc -p tsconfig.server.json` — clean.
- `vite build` — clean; `playwright test e2e/imperial-elegy.spec.ts` — 5/5 pass.

## Card/Tables visual review

Card face OCR was compared with the artwork for all 100 action cards, 12 home
cards, 10 Great War cards and 48 goal faces (the 49th, French goal 22, has no
face). OCR-only artifacts such as “Kmpires”, “lronelads”, “Pacilication”,
“Morocean” and “Ejiffel” were not retained. Tables (stability, industry cards,
key→manpower, CRT, flashpoints, alliance track, MPIT) were transcribed from the
player displays and reference charts.

Known beta-module issues found during visual review are recorded in
`docs/imperial-elegy/CORRECTIONS.md`: Wilhelm II (82), French goal 22, the
duplicate card-21 artwork, and the UK display choice.
