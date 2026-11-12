# Module corrections and reconstructions

The supplied archive is `Imperial Elegy 1.1.0-beta.4.vmod` (VASSAL 3.7.26).
Its card slots, like any beta module, contain production errors. The living
playbook and the printed faces take precedence. Every correction below is also
recorded in code so it cannot silently regress.

## 1. Wilhelm II is card 82, not card 81

The module has **no face image for Wilhelm II**. Its `CardSlot` for
`Wilhelm II` points at `Action Card 81_result.jpg`, the same image used by
`Conquest of Central Asia`. The module's saved deck placement puts
`Conquest of Central Asia` in the 1870s deck and `Wilhelm II` in the 1880s deck,
which matches the playbook's card list (`#81 Conquest of Central Asia`,
`#82 Wilhelm II`).

Reconstruction (as agreed):

- card number **82**
- **2 CP**
- **mandatory** event
- **1880s** deck entry
- effect: remove **Otto von Bismarck** (GE home card `#1`) from the game, then
  remove Wilhelm II itself after play
- rendered as a **text card** (`src/imperialElegy/constant/cards.data.ts`,
  `correction` field); no face image is published

The playbook description of #82 confirms the mechanical intent: “their most
valuable asset for doing so, their Otto von Bismarck home card [#1], will be
removed from the game after this card is played.”

## 2. French National Goal 22 is missing from the module

The archive contains French goals 17–21 and 23–24, but not 22. The playbook
lists French goal 22 as **Peace in Our Time** (3 VP: the Great War does not
occur). It is restored in `constant/goals.ts` with the other “Peace in Our
Time” goals and is part of the 49-card National Goal inventory. It has no face
image and is rendered as a text goal.

## 3. Card 21 has no face image

`Action Card 21_result.jpg` is a duplicate of card **27** (*Foreign
Investment*): the printed number in its bottom-right corner is 27, and the
module also contains a second slot for card 27. The real card 21, *National
Railroad*, is absent from the archive.

The playbook describes #21 as improved transportation increasing industrial
output. The implementation reconstructs it as a 2 CP event, “Increase your
industry by 1; this does not count as the one card spent to industrialize,”
and records the reconstruction in the card's `correction` field. It is
rendered as a text card. This is documented separately from the two corrections
the release was asked to make because it is the same class of missing art.

## 4. UK player display

The archive contains both `Playerboard UK.jpg` and `Playerboard UK.png`. The
module's board configuration selects **`Playerboard UK.png`**; the extraction
script publishes that file and deliberately ignores the older JPG.

## 5. Decade entry cross-check

The module's saved game places cards in decade decks by image slot, not by
printed card number. Because slot 21 is mislabelled, the extraction script
writes the module placement to `data/generated/deck-entry.json` but the game
data uses the printed decades:

| Cards | Deck entry |
| --- | --- |
| 13–70 | 1850s |
| 71–81 | 1870s |
| 82–91 | 1880s |
| 92–99 | 1890s |
| 100–112 | 1900s |

This yields the expected campaign deck growth: 58 cards initially, then 11,
10, 8 and 13 cards added at the start of the 1870s, 1880s, 1890s and 1900s
turns (rules 10.1).

## 6. Card face text

Card faces are 247×385 in the module. OCR at 5× was used to locate and
cross-check text, but every card's English rules text was read against the
artwork; OCR typos (for example “Kmpires”, “lronelads”, “Pacilication”) are not
retained in the data. Card 95 and card 112 genuinely share the printed
citizenship/rights template; that is not a transcription error.

## 7. National Goal pool

Austria-Hungary has nine National Goals. #31 *Precarious Position* is only
available in the 1870 and 1880 scenarios (rules 2.4 and the playbook). It is
kept in the component inventory and in `GOALS` (49 cards) but excluded from
`CAMPAIGN_GOALS` (48 cards) and from the campaign draw pools.
