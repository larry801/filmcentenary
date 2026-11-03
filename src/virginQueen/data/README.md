# Virgin Queen Round 1 data layer

This folder holds the official scenario/setup data for the six-player game. It is
deliberately separate from the playable runtime in `../constant/` and `../util/`;
nothing here is wired into `setupGame` yet. Round 2 will select a scenario and
consume these records.

## Sources

| Data | Source |
| --- | --- |
| Campaign / Tournament setup, VP, wars, alliances, royals, patronage, science bonuses, sea captains, leader entries | `VQ_ScenarioBook_Final_Lo-Res.pdf` |
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

* Six-player Campaign (turns 1–7, 1559–1598) and Tournament (turns 3–6,
  1570–1593) setups only. The 2–5 player Activated Major Power rules are out of
  scope for this round.
* Card pools are built in `deck.ts`; `cardsInPlay` and `cardsRemoved` partition
  the 112-card deck for each scenario.
* The Tournament setup puts Morisco Revolt (`#28`) on the board.
* Scenario `phaseOrder` is `cardDraw → diplomacy → spring → action`.

## Other tables

* `royals.ts`: marriage table, printed ratings and scenario availability.
* `patrons.ts`: artists/scientists named by the two patronage charts. Printed VP
  values are not in the Scenario Book, so `vp` is `null`.
* `seaCaptains.ts`: Sea Captain Table and per-scenario availability.
* `scienceBonuses.ts`: all nine science bonuses.
* `leaders.ts`: leaders referenced by the setups and the Leader Entry Table.
* `world.ts`: coarse World Map skeleton (sea zones and settlements named in the
  supplied sources). The physical world map was not supplied.

## Validation

```sh
./node_modules/.bin/jest src/virginQueen/data
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/jest src/virginQueen
```

`data.test.ts` checks the 112 unique numbers, twelve family cards, CP/turn
coverage, official categories, deck partitioning, map/leader/captain/patron
references, SCM counts, VP totals, Protestant Spaces totals, war/alliance
symmetry, scenario length and setup order.
