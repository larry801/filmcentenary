# Virgin Queen official scenario data

This folder holds the official scenario/setup data for the six-player game.
`../scenario.ts`, `../game.ts`, and `../util.ts` adapt these records into the
playable runtime. Match creation accepts `setupData.scenario` (`campaign` or
`tournament`); local play offers the same selection.

## Sources

| Data | Source |
| --- | --- |
| Campaign / Tournament setup, VP, wars, alliances, royals, patronage, science bonuses, sea captains, leader entries | `VQ_ScenarioBook_Final_Lo-Res.pdf` |
| Patron ratings/categories and individual VP award markers | `Virgin_Queen_4.6.0.vmod` (`images/*.svg`, `buildFile.xml`) |
| 112 card titles and Chinese effect text | `中文卡表.pdf` |
| Card command points, first-turn availability and printed card category | `中文規則.pdf`, pages 42–56 |
| Base 92-space map and 13 sea zones | existing runtime reconstruction (`../constant/spaces.ts`) |

Only the PDF text layer and font/size metadata were used. No images were
rendered and no OCR was run.

## Cards (`cards.ts`)

* Card numbers come from the PDF reading order (3 columns × 6 rows per page).
* Known anchors were checked against the Scenario Book: `#4` German
  Intervention, `#5` Papal Bull, `#11` Dragut Falls, `#13` Reiters, `#28`
  Morisco Revolt, `#37` The Sublime Porte, `#58` Jeanne of Navarre, `#59`
  John Hawkins.
* The card table on pages 42–56 of `中文規則.pdf` supplies `cp`,
  `availableFromTurn` (the “輪” column) and the printed category. Every card has
  a CP value; `#111` and `#112` are marked `"variable"` because the table prints
  變動.
* Chinese names and effect text are preserved. Layout line breaks were removed;
  internal single spaces are kept.
* Family/home cards are `#1` Grand Vizier and `#2` Ottoman Tribute (Ottoman),
  `#3` Spanish Road and `#99` Spanish Armada (Spain), `#32` Calvinist Zeal and
  `#111` Paris is Worth a Mass (Protestant), `#33` Gouvernante de France and
  `#80` The Black Queen (France), `#34` Holy Roman Intercession and `#35`
  Patron of Arts & Sciences (HRE), and `#36` Virgin Queen and `#81` Walsingham
  (England).
* `#54` Huguenot Lent is an event card, not a family card.
* Other categories come from the same table: 強制事件牌 → `mandatory`, 戰鬥牌 →
  `combat`, 應對牌 → `response`, 事件牌 → `event`.
* Complex effects are `{kind: "manual", handler: ...}`. They are intentionally
  not faked as simplified structured effects. Only fully captured effects
  (conversion dice, extra combat dice, simple unit placement) use the structured
  variants in `types.ts`.
* `power` records the power a card is associated with; it is not a general
  playability restriction for every card.

## Map (`spaces.ts`)

* Starts from the runtime 92-space reconstruction, removes `nicosia`, and adds
  the official `cyprus` space.
* Adds 29 cities/fortresses that the Scenario Book places units in but the
  reconstruction did not have (Salonika, Scutari, Oran, Cartagena, Genoa,
  Malta, Zara, Corfu, Cyprus, Ravenna, Alkmaar, Haarlem, Arnhem,
  's-Hertogenbosch, Maastricht, Calais, Amboise, Rennes, Poitiers, Limoges,
  Montpellier, Avignon, Cognac, Bayonne, Berwick, Carlisle, Kinsale, Perth,
  Szigetvar).
* New land connections are marked `approximate: true` and
  `source: "scenario-book"`. They are geographic reconstructions, not scans of
  the printed map.
* `seville` represents the official combined `Seville/Cadiz` space;
  `tripoli` represents `Djerba/Tripoli`.
* `OFFICIAL_LAND_LINKS` is deduplicated because the runtime reconstruction
  contains a duplicate `geneva`/`turin` pair.

## Scenarios (`scenarios.ts`)

* Campaign (turns 1–7, 1559–1598) and Tournament (turns 3–6,
  1570–1593) support six or two players. The adapter in `../scenario.ts`
  applies the two-player component removals; `../ownership.ts` handles
  activated-major ownership. The separate Lepanto tutorial uses turns 1–3,
  cards 1–31 and the tutorial power-card tracks in `../tutorial.ts`.
* Setup references: 2024 Living Scenario Book pp. 4–5 and 10–13. Downloaded
  PDFs and the distribution archive remain local, uncommitted references.
  See `../../../VIRGIN_QUEEN.md` for runtime coverage and outstanding rules.
* Card pools are built in `deck.ts`; `cardsInPlay` and `cardsRemoved` partition
  the 112-card deck for each scenario.
* The Tournament setup puts Morisco Revolt (`#28`) on the board.
* Scenario `phaseOrder` is `cardDraw → diplomacy → spring → action`; the runtime
  now deals the scenario deck at the start of Card Draw and returns to it after
  Winter.
* A Home card enters the hand only when its `availableFromTurn` is reached.
  During Spring Deployment each power secretly keeps one Home card and places
  the rest face down on its power card; the Ottoman may keep both while
  Suleiman is ruler.  `"variable"` Home cards (`#111`) wait for their event.
* HRE religious preference follows rules 23.5 and 25.2–25.3. The three special
  VP columns were transcribed from the supplied VASSAL 4.6 module's
  `images/protspaces.jpg`: Protestant `[0,0,0,0,1,3,5,7]`, Balanced
  `[0,0,2,4,4,2,0,0]`, Catholic `[7,5,3,1,0,0,0,0]`, for track rows
  10–14 through 45–49. The first Spring choice is private until the winter
  victory check needs it to win or prevent domination. Unrevealed VP are
  excluded from public scores and historical tie-breakers; two-player games
  and the tutorial skip this rule.

## Other tables

* `royals.ts`: marriage table, printed ratings and scenario availability.
* `patrons.ts`: patron ratings and artist categories transcribed from the
  supplied module's counter SVGs. It includes both scenario starting patrons
  and later entrants.
* `patronage.ts`: all 19 individual VP award markers with value and category.
  Campaign has 13 artist markers (six 1 VP, four 2 VP, three 3 VP) and six
  science markers (four 1 VP, two 2 VP). Tournament removes the +2 VP Painter
  *Fight between Carnival and Lent* and +1 VP Artist *Elegy for Suleiman*,
  leaving 11 artist and six science markers.
* `seaCaptains.ts`: Sea Captain Table and per-scenario availability.
* `scienceBonuses.ts`: all nine science bonuses.
* `leaders.ts`: leaders referenced by the setups and the Leader Entry Table.
* `world.ts`: coarse World Map skeleton (sea zones and settlements named in the
  supplied sources). The physical world map was not supplied. The runtime now
  supports basic expedition launch/movement and colony placement on the
  settlements represented here; the map links remain approximate. Foreign War
  events are tracked in runtime game state rather than this geography table.

## Runtime coverage and limits

The runtime uses the scenario spaces, initial VP tracks, Protestant Spaces
track offsets, official card pools and turn availability, scenario royals,
patron and science catalogs, and scenario captain assignments. Shared
France/Protestant captains can be claimed during Card Draw. Scenario patron
The current data includes patron ratings and the full VP award-marker pool.
Complex card text outside the tutorial also remains manual. Tutorial handlers
live in `../tutorialEvents.ts`; the existence of a handler does not establish
full coverage of every printed timing or choice (see the main coverage notes).

## Offline geographic background

`land-background.json` is a clipped, preprojected SVG path generated from
[Natural Earth 1:50m land](https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-land/).
The source data is [public domain](https://www.naturalearthdata.com/about/terms-of-use/).
It supplies coastlines only; game spaces, ownership and connections continue to
come from the existing scenario catalogue. No map tiles or external requests are
needed at runtime.

To regenerate, download `ne_50m_land.geojson` from the Natural Earth vector
repository and run `python3 scripts/generate-vq-land.py /path/to/ne_50m_land.geojson`.
The generated file records the source SHA-256 and geographic extent. The extent
and projection in `components/map-geometry.ts` must match the generator.

## Test commands

```sh
./node_modules/.bin/jest src/virginQueen/data
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/jest src/virginQueen
```

`data.test.ts` checks the 112 unique numbers, twelve family cards, CP/turn
coverage, official categories, deck partitioning, map/leader/captain/patron
references, SCM counts, VP totals, Protestant Spaces totals, war/alliance
symmetry, scenario length and setup order.
