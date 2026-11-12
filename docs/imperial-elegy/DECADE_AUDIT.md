# Imperial Elegy — Decade / Card-Band Audit

**Date:** 2026-11-12 (original audit); **final resolution:** 2026-11-12.
**Scope:** audit of the turn → decade mapping, the printed card-entry bands,
and the card counts that follow from them.
**Status:** historical audit, retained with its final resolution. The original
audit findings led to the implemented fix described in §1: a seven-value
`Decade` union, playbook turn labels, empty 1860s/1910s label-only bands, one
canonical mapping, an advancing `G.decade`, and localized labels. **No action
card changed band.**

Run the current evidence with:

```sh
./node_modules/.bin/jest \
  src/imperialElegy/decadeLabels.test.ts \
  src/imperialElegy/decadeAudit.test.ts \
  src/imperialElegy/cardDecadeBand.test.ts --runInBand
```

Result on this checkout: **19 passed, 3 suites** (`decadeLabels` 7,
`decadeAudit` 8, `cardDecadeBand` 4).

> **Correction log.** The original audit found card 100 filed one band early
> (1890s instead of its printed 1900s) and a mismatch between the playbook's
> seven decade labels and the then-current label set. Both are fixed: card 100
> is in 1900s (`cards.data.ts` uses `n <= 99`), and `Decade` now has the seven
> playbook values. The label change moved no card; the counts remain
> `58 / 11 / 10 / 8 / 13` with empty 1860s/1910s bands.

---

## 1. Final resolution (TL;DR)

1. `constant/cards.ts`'s `Decade` union has **seven** values:
   `1850s, 1860s, 1870s, 1880s, 1890s, 1900s, 1910s`.
2. Campaign turns 1-7 map **one-for-one** to those labels:
   turn 1 = 1850s, turn 2 = 1860s, turn 3 = 1870s, turn 4 = 1880s,
   turn 5 = 1890s, turn 6 = 1900s, turn 7 = 1910s. This matches the playbook's
   scenario headers.
3. Printed card bands are unchanged: **1850s 58, 1870s 11, 1880s 10,
   1890s 8, 1900s 13** (100 cards). The **1860s and 1910s contain no printed
   cards**; they are empty **label-only bands**. No card was moved into them.
4. Per-turn additions remain **58 / 0 / 11 / 10 / 8 / 13 / 0** (turns 1-7;
   turn 1's 58 are the setup deal). Turn 2 (1860s) adds zero, turn 6 (1900s)
   adds all 13 later 1900s cards, and turn 7 (1910s) adds zero.
5. `G.decade` is set at setup and advances in live prep and in `resolveEnd`.
   `engine/deck.ts` re-exports economy's canonical `decadeForTurn` (no second
   implementation), and `components/logText.ts` localizes all seven labels,
   including 1860s and 1910s.

In particular, `beginTurnDecade(G, 7)` is
`{decade: "1910s", entering: []}` even on a fresh setup, because the 1910s
band has no printed cards. The 13 later cards enter at turn 6 (1900s), not
turn 7.

---

## 2. Source evidence

### 2.1 Rulebook — one decade per turn, seven turns

`IE_rule.pdf` p. 5, §2.0 *Introduction and Overview*:

> "IE is a Card Driven Game that takes place over 7 turns, with each turn
> representing a decade."

The same page says the game covers **1850-1920**. Seven turns × one decade,
starting at the 1850s, therefore implies
`turn 1 = 1850s … turn 7 = 1910s`.

`IE_rule.pdf` p. 22, §10.1 *Prepare the deck*:

> "Many cards do not start in the deck. Instead, these cards are marked with
> the turn/decade they come into play."

The legend on the same page shows the card's **"Turn entry indicator"** as the
band printed below the artwork (`1870s` in the example). It is a decade label,
not a turn number. §10.1 does not promise a new card band for every decade.

### 2.2 Playbook — scenario headers

| Source | Header | Implication |
| --- | --- | --- |
| `IE_playbook.pdf` p. 3, Scenario 1 — Campaign | `Turn 1 (1850s) - Turn 7 (1910s)` | seven decade labels, one per turn |
| `IE_playbook.pdf` p. 3, 1850 Tutorial | `Turn 1 (1850s) - Turn 2 (1860s)` | turn 2 = 1860s |
| `IE_playbook.pdf` p. 4, Scenario 2 — 1870 | `Turn 3 (1870s) - Turn 6 (1900s)` | turn 3 = 1870s, turn 6 = 1900s |
| `IE_playbook.pdf` p. 5, Scenario 3 — 1880 | `Turn 4 (1880s) - Turn 7 (1910s)` | turn 7 = 1910s |

The four-turn scenarios are internally consistent with one decade per turn:
turns 3-6 = 1870s, 1880s, 1890s, 1900s, and turns 4-7 = 1880s, 1890s, 1900s,
1910s. The campaign header and both four-turn headers agree with the live
seven-value mapping.

### 2.3 Card faces — only five bands are printed

The entry band sits at the lower-right of the artwork area. Sampled faces in
`public/imperial-elegy/cards/`:

| Card | Face prints |
| --- | --- |
| `action-013.jpg`, `action-030.jpg`, `action-045.jpg`, `action-060.jpg`, `action-070.jpg` | *(no band — start deck)* |
| `action-071.jpg`, `action-081.jpg` | `1870s` |
| `action-091.jpg` | `1880s` |
| `action-099.jpg` | `1890s` |
| **`action-100.jpg`** | **`1900s`** |
| `action-101.jpg` | `1900s` |
| `action-112.jpg` | `1900s` |

`action-082.jpg` does not exist (known missing face); the module places
*Wilhelm II* in 1880s and the data reconstructs it as 1880s.

No sampled face prints `1860s` or `1910s`. The unmarked 1850s cards match §10.1:
cards that are not marked start in the deck. This is why the two new campaign
labels are label-only bands rather than new card bands.

### 2.4 Module saved deck

`src/imperialElegy/data/generated/deck-entry.json` (module placement, used by
the project as a cross-check) has only these later-band keys:

| Module decade deck | Cards |
| --- | --- |
| `1870s` | 11 |
| `1880s` | 10 |
| `1890s` | 8 |
| `1900s` | 13 |
| `greatwar` | 10 (GW cards, not action-deck entries) |

It has **no `1860s` and no `1910s` key**, and its `1900s` list contains
`"The Balkan Wars/"` while its `1890s` list does not. 42 later action cards +
the 58-card start deck = the 100-card action inventory. The saved deck
corroborates the empty label-only bands.

### 2.5 Final production code

| File:line | What it does |
| --- | --- |
| `constant/cards.ts:11` | `Decade = "1850s" \| "1860s" \| "1870s" \| "1880s" \| "1890s" \| "1900s" \| "1910s"` |
| `constant/cards.data.ts:5-10` | `entryFor`: `≤70 → 1850s`, `≤81 → 1870s`, `≤91 → 1880s`, `≤99 → 1890s`, else `1900s` |
| `constant/cards.data.ts:28` | `entry: extra.entry ?? entryFor(number)` |
| `constant/cards.data.ts:416` | card 82 forced to `1880s` (matches `entryFor`) |
| `engine/deck.ts:14` | re-exports economy's `decadeForTurn`; no local mapping copy |
| `engine/deck.ts:28-29` | `cardsForDecade` filters `CARDS.actions` only |
| `engine/deck.ts:31-41` | `decadeLabel`: EN/ZH cases for all seven labels |
| `engine/economy.ts:44-52` | seven-entry `CAMPAIGN_TURN_DECADES` array |
| `engine/economy.ts:62-66` | canonical `decadeForTurn` (index + clamp) |
| `engine/economy.ts:107-113` | `beginTurnDecade` — reports the label and not-yet-in-play cards |
| `game.ts:159-162` | `prepBegin` sets `G.decade` and passes `entering` to `prepareDeck` |
| `moves.ts:1331` | `resolveEnd` sets `G.decade` after the turn increment |
| `engine/setup.ts:44` | `decade: "1850s"` in the initial state |
| `engine/setup.ts:123` | initial deck = `cardsForDecade("1850s")` |
| `components/board.tsx:434` | header displays the live `G.decade` |
| `components/logText.ts:113-121` | EN/ZH label map for all seven labels, including 1860s/1910s |

There is a single canonical mapping. `deck.ts` re-exports `economy.ts`'s
function, so off-path inputs (`NaN`, fractional turns) agree by construction.
`G.decade` advances on every turn; production no longer holds it at 1850s.
`cardsForDecade("1860s")` and `cardsForDecade("1910s")` naturally return `[]`.

### 2.6 Docs and tests that state the counts

All current sources agree on the corrected split:

| File | Claim | Matches data? |
| --- | --- | --- |
| `constant/cards.data.ts:5-10` | `≤99 → 1890s`, else `1900s` | **yes** |
| `data.test.ts` | `{1890s: 8, 1900s: 13}`; card 99 = 1890s, card 100 = 1900s | **yes** |
| `economy.test.ts` | turn 5 = 8, turn 6 = 13 | **yes** |
| `decadeLabels.test.ts` / `decadeAudit.test.ts` / `cardDecadeBand.test.ts` | seven labels; empty 1860s/1910s; count split; card 100 in 1900s | **yes** |
| `docs/imperial-elegy/CORRECTIONS.md` | `92–99 = 1890s`, `100–112 = 1900s`; growth `11, 10, 8, 13` | **yes** |
| `docs/imperial-elegy/IMPLEMENTATION_STATUS.md` | `11 / 10 / 8 / 13`; seven turn labels; empty 1860s/1910s | **yes** |
| `docs/imperial-elegy/RULES_COVERAGE.md` | `58 / 11 / 10 / 8 / 13`; seven turn labels; empty 1860s/1910s | **yes** |

---

## 3. Counts by decade

### 3.1 Live data

| Band | Cards | Numbers | Printed face? | Entry turn |
| --- | --- | --- | --- | --- |
| 1850s | **58** | 13-70 | unmarked (start deck) | turn 1 (setup) |
| 1860s | **0** | — | **no printed band** | turn 2 (label only) |
| 1870s | **11** | 71-81 | `1870s` | turn 3 |
| 1880s | **10** | 82-91 | `1880s` (82 reconstructed) | turn 4 |
| 1890s | **8** | 92-99 | `1890s` | turn 5 |
| 1900s | **13** | 100-112 | `1900s` | turn 6 |
| 1910s | **0** | — | **no printed band** | turn 7 (label only) |
| **Total** | **100** | 13-112 | | |

This matches the module's saved deck exactly (11 / 10 / 8 / 13) and the printed
faces. Card 100 was previously filed in 1890s because `entryFor` used
`n <= 100`; the correction moved one card to 1900s without changing the
100-card total.

### 3.2 Boundary checks

- 70/71: card 71 prints `1870s`; 13-70 are unmarked start-deck cards.
- 81/82: card 81 prints `1870s`; card 82 has no face, module says 1880s.
- 91/92: card 91 prints `1880s`, card 92 prints `1890s`.
- **99/100**: card 99 prints `1890s`, card 100 prints `1900s`.
- 101/112: both print `1900s`.
- 1860s/1910s: no card numbers, no printed faces, no module deck key.

---

## 4. Counts by turn

"Adds" counts the cards the deck actually gains; turn 1's 58 are dealt by
`setup.ts`, not by the prep phase (`game.ts` skips prep on turn 1).

| Turn | Campaign label | Adds | Printed band for the label |
| --- | --- | --- | --- |
| 1 | 1850s | 58 (setup) | 1850s (start deck) |
| 2 | 1860s | 0 | *(none — label-only band)* |
| 3 | 1870s | 11 | 1870s |
| 4 | 1880s | 10 | 1880s |
| 5 | 1890s | 8 | 1890s |
| 6 | 1900s | 13 | 1900s |
| 7 | 1910s | 0 | *(none — label-only band)* |
| **Total** | | **100** | |

Notes:

- `beginTurnDecade` is stateless: on a fresh setup, turn 6 reports the whole
  1900s band (`13`) because those cards are not in play yet. Turn 7 reports
  `{decade: "1910s", entering: []}` because the 1910s band is empty. In a
  played campaign, turn 6 has already added the 13 cards and turn 7 adds 0.
- The 1860s and 1910s rows are empty by design, not by reusing an adjacent
  band. Their `cardsForDecade` result is `[]`.
- The pre-fix mapping collapsed the two unprinted labels onto adjacent printed
  bands. It produced the same **additions** (58, 0, 11, 10, 8, 13, 0) but the
  wrong turn labels; the final mapping fixes the labels without touching card
  data.
- The card-100 correction redistributed turns 5/6 from `9/12` to `8/13`; both
  turns stay non-empty.

---

## 5. Widening the union moved no cards

**Confirmed: no card moved into either band and no turn was emptied.**

- The only turns affected by the label change are turns 2 and 7, which already
  added zero cards. Their new bands (1860s, 1910s) are empty in
  `cards.data.ts` and absent from the module's saved deck.
- `cardsForDecade("1860s")` and `cardsForDecade("1910s")` return `[]`
  naturally. No card needed to be reassigned to keep the counts non-empty.
- The additions remain `58, 0, 11, 10, 8, 13, 0` — identical to the pre-fix
  additions — and both label sequences reach exactly the same 100 action
  cards, each once.
- The card-100 correction already redistributed turn 5/6 from `9/12` to
  `8/13`; that is a separate, evidence-backed data fix.

The earlier caveats are resolved:

- `Decade` is also the type of `CardDef.entry`. The widened union permits
  1860s/1910s card entries by type, but no card data uses them; the seven
  values are now the intended campaign labels.
- `components/logText.ts` has EN/ZH cases for all seven labels, so the new
  labels no longer fall back to raw strings in the Chinese locale.
- `engine/deck.ts`'s `decadeLabel` covers all seven labels. It is available to
  callers and no longer returns `undefined` for a campaign label.

---

## 6. History — options considered and final resolution

The original audit recorded the options below. They are kept for history; the
**Final resolution** column is the implemented state.

| Option | Original proposal | Outcome |
| --- | --- | --- |
| A — keep the printed card bands and document the label mismatch | No production change; keep labels aligned to card bands | **Rejected.** The playbook scenario headers are explicit, and this would leave the turn labels and UI wrong even though the deck is unaffected. |
| B — widen `Decade` to the seven campaign labels | Add `1860s`/`1910s`; no card reassignment because both bands are empty | **Adopted.** The union, `CAMPAIGN_TURN_DECADES`, `decadeLabel` and `logText` all cover seven labels. |
| C — correct card 100's band | Move card 100 from 1890s to its printed 1900s | **Applied.** `entryFor` uses `n <= 99`; the 1890s/1900s split is `8/13`. |
| D — advance `G.decade` and use one mapping | Set `G.decade` in live prep and `resolveEnd`; re-export the canonical `decadeForTurn` | **Adopted.** `game.ts` and `moves.ts` advance `G.decade`; `deck.ts` has no local mapping copy. |

Final implementation:

- `Decade` has seven values (1850s…1910s), and turns 1-7 map one-for-one.
- The 1860s and 1910s are **empty label-only bands**; no printed card exists
  for either and no card was moved into either band.
- `G.decade` advances in prep and `resolveEnd`; the board subtitle shows it.
- `deck.ts` re-exports economy's single canonical mapping.
- `logText` localizes all seven labels in EN and ZH.

No card reassignment was part of the fix. Card 100's correction is independent
and was already supported by its printed face and the module placement.

---

## 7. Rulebook ambiguity resolved

- §2.0 says each turn is a decade, and the playbook covers 1850s-1910s in seven
  turns. §10.1 only says *marked* cards enter later; it never promises that
  every decade has new cards. The two card-less decades (1860s, 1910s) are
  consistent with the rules and are the implemented reading.
- Card 100 is **not** an ambiguity: the face prints `1900s`, the module saved
  deck says `1900s`, and §10.1 makes the printed card authoritative.
- Card 82 has no face, so its `1880s` entry rests on the module placement and
  the reconstruction note, not on a printed band. That one remains an
  inference.
- The rulebook's entry-indicator example (`1870s`) shows no turn number, so the
  phrase "turn/decade" in §10.1 does not imply extra card bands beyond the
  five printed ones.

---

## 8. What the decade tests pin

Verified on this checkout: **19 tests in 3 suites, all passing.**

### `decadeLabels.test.ts` — 7 tests

1. `Decade` has exactly the seven campaign labels, including 1860s/1910s.
2. Campaign turns 1-7 map one-for-one to 1850s…1910s, including clamping and
   fractional inputs.
3. 1860s and 1910s are label-only bands with no printed cards.
4. Prep reports the new labels while turns 2 and 7 enter zero cards.
5. Per-turn entering counts are unchanged: `58/0/11/10/8/13/0`.
6. No card changed band; the widened and pre-fix label sequences reach the same
   100 cards, and the module deck has no 1860s/1910s key.
7. `logText` renders all seven labels in EN and ZH, including 1860s/1910s.

### `decadeAudit.test.ts` — 8 tests

1. The seven-turn mapping matches the playbook headers and the single canonical
   implementation.
2. `deck.ts` re-exports economy's `decadeForTurn` (same function object;
   `NaN`/fractional inputs agree).
3. Band counts cover all seven labels (`1850s 58`, `1860s 0`, `1870s 11`,
   `1880s 10`, `1890s 8`, `1900s 13`, `1910s 0`); the printed bands sum to 100.
4. Per-turn additions are `58, 0, 11, 10, 8, 13, 0`.
5. `beginTurnDecade` reports the label and the empty label-only bands, and is
   pure (`G.decade` remains the caller's responsibility; live prep/resolveEnd
   advancement is covered by `economyIntegration.test.ts`).
6. Relabelling turns 2/7 as 1860s/1910s leaves deck composition unchanged.
7. Card 100 is filed in 1900s (92-99 / 100-112 boundary).
8. The module saved-deck cross-check (`1890s = 8`, `1900s = 13`, no 1860s/1910s
   keys, *The Balkan Wars* in 1900s).

### `cardDecadeBand.test.ts` — 4 tests

1. Card 100 is filed in the printed 1900s band.
2. Every card in the affected 1890s/1900s range matches the module placement.
3. Module deck sizes agree with the corrected 1890s/1900s counts.
4. Widening `Decade` adds label-only bands without moving any card.

No `test.failing` is used: the card-100 defect is corrected, and the 1860s/1910s
labels are implemented empty label-only bands rather than an open gap.
