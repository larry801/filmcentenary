# Asset provenance

All published images come from `Imperial Elegy 1.1.0-beta.4.vmod` (VASSAL
3.7.26, module description “By Mike Lorino @Vuca Games (beta)”). The extraction
script copies the files byte-for-byte; it does not recolour, crop or re-encode
artwork.

| Kind | Count | Published under | Source |
| --- | --- | --- | --- |
| Maps | 2 | `maps/world.jpg`, `maps/greatWar.jpg` | `Map-World f.jpg`, `GW Main Map T3.jpg` |
| Player displays | 6 | `displays/GE.jpg`, `displays/UK.png`, `displays/FR.jpg`, `displays/AU.jpg`, `displays/RU.jpg`, `displays/OT.jpg` | the six `Playerboard *` images; UK uses the module-selected PNG |
| Reference charts | 9 | `charts/*` | the non-bot chart boards |
| Action cards | 98 | `cards/action-013.jpg` … `cards/action-112.jpg` (gaps at 021 and 082) | `Action Card N_result.jpg` |
| Home cards | 12 | `cards/home-GE-01.png` … `cards/home-OT-12.png` | `Home Card N P.png` |
| Great War cards | 10 | `cards/great-war-01.png` … `-10.png` | `Great War Card N.png` |
| National goals | 48 | `cards/goal-P-01.png` … | `Card P Objective N.png` |
| Card backs | 4 | `cards/back-*.png` | action, GW, goal and home backs |
| Counters | 312 | `counters/*` | every unique `PieceSlot` image |

The manifest at `public/imperial-elegy/manifest.json` is the authoritative
list. It is plain JSON and does not declare a `$schema` (there is no companion
schema file). For each asset it records:

- `kind` and game id;
- `original` — the archive path (for example `images/Map-World f.jpg`);
- `published` — the path under `public/imperial-elegy/`;
- `checksum` — SHA-256 of the published file;
- `bytes`, `width`, `height`;
- `source` — the module element that referenced it;
- `note` — e.g. the UK display selection.

Run `python3 scripts/extract-imperial-elegy.py --check` to verify every
checksum. The generator omits timestamps, so an unchanged module produces an
unchanged manifest.

## Text cards

Two cards have no face image in the archive: Wilhelm II (#82) and French
National Goal #22. Card 21 also lost its image to a duplicate slot. These are
rendered by the UI as styled text cards. They are recorded in the manifest as
game data (not image assets) and documented in `CORRECTIONS.md`.

## Not published

- Promotional cards P1–P3 (`Action Card P1.jpg` …): deferred promotional
  content.
- Bot reference charts (`Chart Bot 1.png`, `Chart Bot 2.png`): bots are out of
  scope.
- `Playerboard UK.jpg`: superseded by the module-selected PNG.
- `Card Deck Map.jpg`, `Map Card Deck.jpg`: deck-layout boards, not game art.

## Copyright

The artwork and card text are the property of VUCA Simulations and the
respective artists. They are included here to support a faithful
implementation of the published game for the project's existing private
boardgame.io deployment.
