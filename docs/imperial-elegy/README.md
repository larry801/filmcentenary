# Imperial Elegy — implementation notes

This directory documents the web implementation of **Imperial Elegy: The
Imperial World at War, 1850–1920** (VUCA Simulations, design Michael Lorino).

## Visual system

The board's visual language — palette, typography, surfaces, components,
motion and verification — is specified in
[`VISUAL_SYSTEM.md`](VISUAL_SYSTEM.md). Layout and behaviour remain specified
here; the visual spec must not change them.

## Sources of truth

1. `IE_playbook.pdf` — the publisher's living playbook. Campaign setup, national
   goals, card descriptions and the Great War tutorial take precedence.
2. `IE_rule.pdf` — the living rulebook.
3. `Imperial Elegy 1.1.0-beta.4.vmod` — the supplied VASSAL module, used for
   artwork, printed space positions and the saved campaign setup cross-check.

The module is a **beta**: it contains known production errors. Corrected items
are recorded in `CORRECTIONS.md` and in the data (`source` / `correction`
fields on cards and goals). Card text was transcribed from the printed faces;
OCR was used only as an aid and every card was reviewed against the artwork.

## Reproducing the assets

```sh
python3 scripts/extract-imperial-elegy.py          # publish assets + module metadata
python3 scripts/extract-imperial-elegy.py --check  # verify checksums
```

The script reads the `.vmod` archive, copies only the required artwork to
`public/imperial-elegy/`, and writes:

- `public/imperial-elegy/manifest.json` — module name/version, original
  filename, published path, SHA-256, byte size and dimensions for every asset;
- `src/imperialElegy/data/generated/module.json` — boards, zones, card slots and
  used images from `buildFile.xml`;
- `src/imperialElegy/data/generated/campaign-setup.json` — the decoded
  `campaign-setup.vsav` (VASSAL's `!VCSK` envelope XORed with `0xCC`) with each
  piece's board, coordinates and zone;
- `src/imperialElegy/data/generated/deck-entry.json` — the module's saved deck
  placement, used only as a cross-check for the printed decade bands.

The manifest intentionally omits timestamps so repeated extractions are
diff-stable. Promotional cards P1–P3 and the two bot reference charts are not
published: the bot player aid is transcribed into `engine/bot.ts` (B1/B2 tables)
instead of being shipped as art, and alternate scenarios and promotional
content remain out of scope for this release.

## Running

```sh
yarn start          # Vite dev server
yarn serve          # build + boardgame.io server (multiplayer)
```

- Local hotseat: <http://localhost:5173/localIE>
- Printed board (static, 1:1 vector sheet): <http://localhost:5173/board/imperialElegy>
- Online match creation: `/imperialElegy`
- Join/spectate: `/join/imperialElegy/:matchID/:player` (or `/spectate`)

Seat order is fixed by rule 4.3: **GE, UK, FR, AU, RU, OT** (seats 0–5).
Local hotseat keeps all six clients mounted; switching tabs never restarts the
match. Keys `1`–`6` (or `[` / `]`) switch seats.

### Online tables of 2–6 humans

An online match always creates all six seats: every power owns a hand, a deck
and a national characteristic, and the phase flow walks `POWERS` by name, so a
table with fewer boardgame.io players would leave powers nobody can ever move.
The lobby therefore chooses the number of **humans** (2–6) and the remaining
seats are played by the Rule 34 bot:

- The create panel (`src/components/create-match.tsx`) offers 2–6 humans and
  previews which powers become bots (the tail of the seat order: 2 humans give
  `FR, AU, RU, OT`). It posts `{numPlayers: 6, setupData: {bots: [...]}}`.
- `configuration.ts` owns the split (`IE_MIN_HUMANS`, `parseBotPowers`,
  `humanPowers`, `firstHumanSeat`, `validateIESetupData`); `validateSetupData`
  refuses fewer than two humans, because 1 human + 5 bots is the local solo
  entrance (`/localIE?solo=1`), not an online match.
- `engine/setup.ts` copies the list into the public `G.bots`, which every view
  keeps: the board marks those seats read-only and shows the bot banner, the
  lobby's match table labels them 🤖, and the join page offers invite links for
  the human seats only.
- The server plays them. `src/game/ieBotDriver.ts` seats each bot with its own
  name and credentials at match creation (which is also what stops a human
  joining a bot seat), then after every stored state change asks
  `botDecision` what the bot seat does and dispatches it through a Master
  authenticated as that seat — the Socket.IO transport has no `bots` hook, and
  boardgame.io's Master only accepts moves from active players. A decision the
  engine refuses three times falls back to the phase's own exit move, the same
  escape the hotseat driver uses. `server.ts` wires the driver to the storage
  wrapper and the per-match pub-sub channel.

### SVG card faces

The hand uses `components/CardFace.tsx` to render all 100 action cards, 12 home
cards, 10 Great War cards and 49 National Goals directly from the transcribed
data. Inline SVG draws the frame, CP/VP, type, title, rules and vector emblems;
card faces make no raster-image or external-font requests. The original card
assets total approximately 13.4 MiB and remain available as source references.

Faces follow the selected UI language. Expand **English text / 中文译文** below
a face to read the other language (English includes the full rule transcription).
The card inspector also offers **Original card image / 原图** as a folded
reference: the scan is fetched only when that disclosure is opened, so the
default reading view stays fast and in the chosen language. Long rules extend
the SVG height instead of being clipped or reduced to tiny type. Missing module
faces, including action cards 21/82 and goal 22, use the same renderer. The
photographs are represented by lightweight vector emblems.

### Card choices

Whenever the rules ask the player to *pick a card*, the choice renders the
printed face instead of a title button: the diplomacy home card, the end-phase
Whenever the rules ask the player to *pick a card*, the choice renders the
printed face instead of a title button: the diplomacy home card, the end-phase
National Goal draw-and-keep, the combat windows (A043/A058–A062, GW-03–GW-06)
and the face-down auctions. A card that is offered in several printed modes
(A061, A066, the UK's two auction sides) keeps one face with one button per
mode. `components/CardChoice.tsx` is the shared wrapper; `HandChoices` (top of
the Orders tab) and `PendingPanel` both use it. Space, power and unit options
stay plain buttons.

Two moves are **draws, not picks**, and deliberately show no card face: the
prep-phase discard for +1 stability and the diplomacy card gift both take one
card at random from the giver's hand (print: "discard a random card", and the
11.1 gift is a random draw). Letting the client name the card would turn the
random draw into a free choice — dump the worst card, keep the good one, or push
a chosen card onto an ally. The engine resolves the card from `ctx.random`, so
the moves take no card argument at all; the dock/hand panel only offer the
action, and mandatory events and home cards are excluded from the draw.

### Required versus optional

Not every choice blocks the game. The home card and the National Goal
draw-and-keep are mandatory; the prep-phase stability discard and the diplomacy
card transfer are things a player *may* do. The board distinguishes them, so
an optional action never reads as "you cannot continue until you pick":

- a mandatory section is a solid gold-bordered box and the turn panel's
  summary says `需要选择卡牌` / "Required card choice";
- an optional section uses a dashed frame and an `可选` / "Optional" tag, the
  summary says `可选：随机弃牌换稳定` / "Optional: discard a random card for
  stability", and a hint names the way out ("press Ready to continue without
  discarding" / "转交卡牌并非必须").

`handChoiceAvailability` returns `{required, optional}` so the turn panel's
summary and the pointer in the hand tray follow the same rule. The discard is
only offered when a legal card is actually in hand, so an empty optional section
is never rendered.

### The turn panel

Everything the rules require *right now* lives in the 348 px turn panel in the
right-hand column (`components/TurnPanel.tsx`): the old
`components/CommandBar.tsx` and `components/RailTabs.tsx` are deleted, and on
desktop the panel is a permanent column of the table, not a floating dock behind
a toggle. On a phone its bodies are presented one at a time by the four-tab
bottom dock described under [Phones](#phones), and the panel's own tab strip is
hidden there. The panel head carries the desktop CP readout (`ie-command-cp`); a
second node carries the same test id on the track strip's phone-only chip
(`ie-track-cp`,
`display: none` from 768 px up), so exactly one is visible at 1440×900. The head
also carries the buttons that end or continue the step (准备完毕, 停牌, 继续).
Below the head are the panel's three tabs:

- **Orders** — four pages behind one segmented control
  (`components/OrdersPanel.tsx`), because one column could not hold the space's
  facts, its action list, the influence matrix, the national characteristics and
  three naval flows without burying the legal actions:
  - **Actions** (`ie-orders-tab-actions`) — the space's name and control, the
    rows the rules allow right now (cheapest first, each printed **once**), and
    the refused rows folded into one `ie-unavailable` section that still carries
    every printed reason.  The fold remembers the reader's choice
    (`ie_show_unavailable`, also switchable from the Display menu).
  - **Space** (`ie-orders-tab-space`) — what the space *is*: control, markers,
    fort, pacification, key type, connections, supply, and its units as
    read-only chips.  The unit **buttons** (`ie-unit-<id>`, `ie-select-stack`)
    stay on the Actions page, because choosing a unit is the first click of most
    actions and arms the map's rings.
  - **Influence** (`ie-orders-tab-influence`) — the 8.0 MPIT matrix and the 33.x
    national actions.
  - **Naval** (`ie-orders-tab-naval`) — amphibious assault, naval transport and
    interception.  The page exists only while one of them is offered; an
    interception window opening pulls it to the front and marks its tab.

  Every page stays mounted and inactive pages are `hidden`, so an armed
  confirmation, a half-filled naval form and the bots' effects survive a switch.
  All four pages share one computation of `spaceActions` (`useSpaceActions`), so
  switching pages never re-runs the engine's gates.

  While a pending decision, an open battle or the result is showing, the Orders
  body is that decision (`PendingPanel`) instead, so the panel never covers map
  targets.
- **War** — only while a limited war or the Great War is running: the trench
  board, the war panel and the Great War panel.
- **Log** — the public history, newest first.

The required card choices — the diplomacy home card and the end-step National
Goal — are a dialog (`components/CardChoiceModal.tsx`), not a panel: both are
blockers, and painted inline they pushed the action list below the fold.  The
home card cannot be dismissed (the step cannot continue without it); the Goal
pick can be, and continuing keeps the first Goal.  While a decision already owns
the Orders body the choice falls back to the inline form there, so two modals
never compete.  The optional prep-phase stability discard stays inline at the top
of the Actions page: it may be skipped, so it is not a blocker.

The tab bar is a roving `tablist`. On a phone the dock bar owns tab selection and
`ie-turn-tabs` is hidden there. The panel keeps the historic `ie-dock` /
`ie-dock-summary` / `ie-pending` / `ie-command-cp` test ids, so the Control suite
and the static-markup suites keep their anchors.

The action phase has a single exit button (12.0). It reads `停牌` while the
impulse is unused and turns into `结束行动轮` once the seat has played a card or
banked CP; both call the same `pass` move, and only the unused form is subject
to 12.0's zero-or-one-card restriction. `pass` is the only exit: it forfeits
remaining CP on a used impulse and enforces `canPassNow` on an unused one, and
there is no separate `endImpulse` move.

**One card per impulse.** 12.0 lets an impulse play exactly one card — for CP or
as its event — and then spend that card's CP. `playCard` therefore refuses a
second card whenever the impulse is already used, and “used” survives the last
CP being spent (`impulseAlreadyUsed` reads `G.cpRemaining > 0` **or** the
action-phase `actionCpSpentThisImpulse` flag). A mandatory event's printed 2 CP
are that impulse's budget: they can be spent, but the seat may not open another
card with them. The hand's `cardAvailability` uses the same predicate, so the
disabled buttons and the refused move always agree. `oneCardPerImpulse.test.ts`
pins the CP card, the mandatory event and the next impulse.

A mandatory event is one control, not a CP/event pair: 12.0's CP play *is* its
event, so the tray hides the CP button and leaves only the event button, which
keeps the printed type — `打出强制事件` / `Play mandatory event`. A105 is the
exception: its "played for CP the event does not trigger" clause is a real
separate mode, so it keeps both controls and reads `打出强制响应`. Ordinary
cards keep `打出事件` / `Play event`. A playable hand row shows no type badge,
so the button is where the printed type is named.

The panel also stops treating a finished step as open: once a seat has chosen its
home card the pending-choice faces remain (marking the selection) but the summary
and the "required card choice" state clear, so the next seat is not told a
decision is still waiting.

### Layout at 1440×900

`components/BoardLayout.tsx` and `imperial-elegy.css` split the board into five
regions:

```
+--------------------------------------------------------------+
| seat strip                                                   |
+--------------------------------------------------------------+
| track strip (52 px)                                          |
+--------+-------------------------------+---------------------+
| mat    | map                           | turn panel (348 px) |
| 148 px |                               |  head + tabs        |
|        +-------------------------------+                     |
| hand tray (212 px max, spans mat+map)  |                     |
+--------+-------------------------------+---------------------+
```

- **Track strip** — `components/TrackStrip.tsx`, 52 px under the seat strip. It
  carries the turn and decade, the sequence-of-play stepper (each step opens the
  reference at that step), World Tension pips with the "3: no war" warning, the
  five alliance boxes (cTA / aTA / N / aTE / cTE), the Great War turn or the
  current war, status badges, and the round controls: `?` (reference) and the
  menu. The stepper is a group of buttons under one roving tab stop, not a
  tablist.
- **Map and mat** — `components/MapPanel.tsx` (`map.tsx` draws the spaces and
  units) takes the middle column; the player mat (`components/PlayerMat.tsx`)
  is the narrow strip beside it (148 px; 132 px below 1100 px) and reproduces
  the printed player display for the viewer: the stability track with the VP /
  BM / card each box prints, the manpower count and the key box that supplies
  it, the industry track with the cards each level draws, the territorial key
  track with the MP under each box and its AUTO VICTORY box, the colonial (UK)
  or Arab (OT) key track with its own MP/AMP ladder, the Reserve Armies
  holding box and its printed Box Limit formula, the per-turn draw, VP, the
  Industry Card and CP Chain slots, the National Goals, and the national
  characteristics folded under the tracks. Every number comes from
  `POWER_DEFS` and the engine's own helpers (`cardsToDraw`,
  `reserveAllowance`, `industryTarget`), so the mat prints the rules rather
  than a second copy of them. It begins open on desktop and folds to a
  one-line chip row with a popover below 1100 px; on a phone it is the dock's
  Mat tab (§8 of [`UI_CHECKLIST.md`](UI_CHECKLIST.md)).
- **Turn panel** — 348 px, described above. The War tab mounts the
  `components/TrenchBoard.tsx` rows while the Great War is active. On desktop it
  has no collapse toggle: the panel is a permanent table cell, and the decision
  it shows replaces its Orders body rather than expanding over the map. On a
  phone it is the dock's body for the Orders, Log and War tabs, and the dock
  owns its height.
- **Hand** — `components/HandTray.tsx`, a row under the mat and the map that
  spans both of those columns on desktop (at most 212 px open, folded to a 44 px
  bar; the turn panel keeps the right column); on a phone it is the dock's Hand
  tab. Its head has the card count, the CP-chain/saved/response chips and the
  tray toggle; each card is one row — CP value and name, plus the first reason
  it cannot be played when it is stuck. There is no filter (a hand is only a few
  cards, so all of them are always listed), no sort select (the hand is always
  printed order) and no type icon (it used to sit over the CP number). Every
  card may be played for CP (rule 12.0), so a playable row carries no badge. On
  a desktop the row also draws its operations inline — play for CP, the event,
  a response, industrialize, the CP chain and Save, with every blocked button
  carrying its reason as a title — so the common play needs no dialog; the name
  still opens the `CardInspector` with the face and the aggregated reasons. On
  a phone the row stays one line and the operations stay in the inspector.
- **Reference drawer** — `components/ReferenceDrawer.tsx` opens from the right
  at an anchor (the strip's `?`, a stepper step, the mat's "Printed display", a
  `?` rule link) and closes on Esc. It shows the tables the engine renders — the
  CRT from `crt()`, the action costs from `ACTION_COSTS`, the sequence of play
  from `phaseSteps` (`components/referenceTables.tsx`) — then the other powers'
  dashboards, and finally the nine printed PNG charts. Opening a chart opens
  `components/ChartLightbox.tsx` full screen
  instead of squeezing the image into drawer width. There is no rail or
  board-wide Reference tab, and no always-open chart grid.

  Anchors are `chart:<id>` (one of the nine charts), `rules:<key>` (an inline
  section), or `display:<POWER>` — the power's own board under
  `public/imperial-elegy/displays/`, which is what the mat's "Printed display"
  button opens (`displayAnchor` / `playerDisplayChart` in
  `components/ChartLightbox.tsx`). The displays are not charts: they keep their
  own file extension (the module publishes the UK board as a PNG and the other
  five as JPGs), so each entry carries an explicit `src`. The MPIT matrix is
  **not** in the drawer: `components/MpitPanel.tsx` is an action on the Orders
  panel's Influence page (`ie-mpit`, `ie-mpit-controls`).

Actions in the space panel (`components/SpacePanel.tsx`) are one list computed
by `spaceActions` (`components/actionAvailability.ts`) and grouped by kind
(recruit, build, diplomacy, move, Great War).  The panel is split in two:
`SpaceDetailPanel` (facts, units read-only) and `SpaceActionsPanel` (what may
be done here, with `SpaceUnitPicker` for the unit buttons), and the board mounts
them as the Space and Actions pages of the
Orders panel.  A legal row is a button with a cost chip; a refused row is folded
into `ie-unavailable` and keeps its visible reason line under it — the printed
restriction is a block, not only a tooltip.  A row renders once: the legal ones
are the "available now" strip rather than a copy of a grouped list below it.
Irreversible controls need two clicks, arm then confirm: play for CP, play the
event, pass / end impulse, end diplomacy, continue and declare war go through
`components/ConfirmButton.tsx`. Declaring a war now behaves like the rest:
`ie-declare-war` arms with `确认：宣战（n CP）` /
`Confirm: declare war (n CP)` so the confirmation names the CP the click will
spend, and only the second click declares. Surrender keeps its own inline
arm/confirm flag. All of these except surrender read the `confirmActions`
preference in `components/preferences.ts` (on by default; the button disarms on
blur, Esc or after 5 s), so with it off they fire on one click.

A refused move is explained rather than silent. Every labelled control — card
play, response / industry / chain / save, the phase buttons, declare war, pending
options, map targeting and the Great War, war, national-action, MPIT and naval
panels — runs through the board's `doAction` wrapper in
`components/useBoardModel.ts`. boardgame.io answers a refusal with a bare
`INVALID_MOVE` and does not advance `_stateID`, so the wrapper waits 400 ms
(local hotseat) or 4 s (remote) for the counter to move and raises the
`ie-toast` notice with the action's label and the reason the control computed.
The remaining limits are documented in
[`UI_CHECKLIST.md`](UI_CHECKLIST.md) §12.

Map interaction is a small state machine (`components/useInteraction.ts`):
clicking a unit enters soft targeting (a miss falls back to selecting the clicked
space); a target with one legal intent submits it on the click, two or more open
the inline `components/IntentChooser.tsx`, Esc returns to the source space and
Enter commits a single target. Only `submitTargeting` in
`components/useBoardModel.ts` spends CP.

### Phones

Below 768 px the board becomes one column: a 44 px track strip (the stepper and
alliance boxes are dropped; the CP readout shows here because the turn panel's
head hides `ie-command-cp` below 768 px), the map, and **one** bottom dock
`data-testid="ie-mobile-dock"`. The dock replaces the old hand sheet plus a
separate turn panel. It exposes its state in attributes: `data-open` (`false`
closed, `true` open), `data-expanded` (`false` half, `true` full; only
meaningful while open), `data-tab` (`orders` / `hand` / `mat` / `log`, and
`war` only while a limited war or the Great War is running) and `data-decision`
(`true` while a decision, battle or result is owed).

The dock bar carries `ie-mobile-toggle` (open / close), `ie-mobile-expand`
(half ↔ full) and the tab buttons `ie-mobile-tab-orders|hand|mat|log`
(`ie-mobile-tab-war` while a war runs); the active tab is shown inside
`ie-mobile-body`. Closed is 44 px (56 px with a decision owed), half is 40 dvh,
full is `calc(100dvh - 140px)`, and the map keeps the space above the dock.
Pressing a tab while the sheet is closed opens it to half; reopening with the
toggle also starts at half, never full. `TurnPanel`'s own tab strip and
`HandTray`'s own toggle / expand are hidden on phones — the dock bar owns
them — while their bodies stay mounted so a tab switch does not reset panel
state or the bots' effects. On desktop the wrapper and body are
`display: contents` and the dock bar is hidden, so the three panels keep their
grid areas unchanged. Short phones (≤ 699 px tall) use 44 dvh for half,
`calc(100dvh - 120px)` for full and a 46 dvh decision cap.

- **Orders** — four pages behind a sticky segmented control
  (`ie-orders-nav`, tabs `ie-orders-tab-actions|space|influence|naval`): the
  Actions page (legal rows, then the folded `ie-unavailable` section), the Space
  page (facts and unit selection), the Influence page (the MPIT matrix and the
  national actions) and, only while a naval flow is offered, the Naval page.
  Each page is a scroll surface of its own; the pages are pinned to their
  natural height (`flex: 0 0 auto`) so a page taller than the sheet is reachable
  with a drag rather than being squashed and clipped by its own
  `overflow: hidden`. Every track value of the matrix is a 44 px target (three
  equal columns per power) and arming one does not reflow the grid. While a
  decision is owed the Orders body is the decision instead.
- **Hand** — the card row with its per-card operations (drawn on the row on
  desktop, in the inspector on a phone).
- **Mat** — the player mat, reachable on a phone now; the old layout hid it at
  this width. The same figures also appear in the reference drawer's power
  dashboards.
- **Log** — the public history, newest first.
- **War** — only while a limited war or the Great War runs: the trench board,
  war panel and Great War panel.

Hand and Mat are seat-only. A spectator's dock offers Orders and Log (plus War
while a war runs) and renders no hand, mat or private figures.

While a decision, battle or result is owed the dock reports
`data-decision="true"`. A decision arriving on a mounted board opens the dock to
**half** on the **Orders** tab so the decision is in front; collapsing it then
gives the 56 px peek: the one-line `ie-mobile-decision-peek` (`有决策待处理` /
"A decision is waiting") takes the place of the 44 px bar, and it exists only
while the decision is owed **and** the dock is closed. The open dock is capped
at **50 dvh** while the decision is owed and `ie-mobile-expand` is inert then,
so the sheet stays at its 40 dvh half rather than covering the map target the
decision asks about. Answering leaves the dock where the reader put it rather
than snapping it back to an earlier state; normally it stays at half on Orders.

Only Display is reachable in the strip's ☰ menu at this width: the `Charts` /
`Rules` buttons stay in the DOM but CSS hides them
(`.ie-command-menu .ie-btn { display: none }`), and the `?` button still opens
the reference drawer.

The desktop mat remains narrower than the brief's 320 px column: it is 148 px
beside the map (132 px below 1100 px) and scrolls its own figures, recorded as
[`UI_CHECKLIST.md`](UI_CHECKLIST.md) §12 item 9.

## Implementation status

The campaign game is playable end-to-end, but this is an **in-progress
implementation**, not a finished conversion. The rule-by-rule matrix, exact card
inventory, known fallbacks and current test/build evidence are in
[`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md). The detailed rule map is
[`RULES_COVERAGE.md`](RULES_COVERAGE.md). The per-card event record — what each of
the 122 printed card events actually runs, whether its printed “OR” became a real
player choice, and which cards have no test — is
[`CARD_EVENTS.md`](CARD_EVENTS.md).

At a glance, the live game covers:

- **Prep** — decade deck build, reshuffle, draw, optional random discard for +1
  stability (mandatory events and home cards stay).
- **Diplomacy** — home-card selection, random card gifts and Metternich's Legacy.
- **Action** — cards for CP or events, recruitment, fleets, influence,
  diplomacy, minor alliances, EFs, pacification, forts, industry, redeployment
  and declarations of war. Every card is a CP card (12.0), response and combat
  cards included; a mandatory event played for CP resolves its event and then
  grants its CP, and A105's printed hand-size clause is the only CP gate.
- **CP chain (live)** — up to two cards per action phase; mandatory events
  resolve on insertion; `useCpChain` funds one action per action phase (capped
  at 4 CP); chained cards stay face-up and are discarded at the end of the
  action phase.
- **Alliance events A015/A111** — legal adjacent shifts, the impulse-start
  neutral restriction, and the conditional WTT increase after resolution.
  Each positive MPIT marker rolls one d6; tied player rolls prompt, Italian
  ties reroll, and crisis continuation retains the original card and player.
- **Harsh terms (8.3 / 16.2)** — imposing two actual treaty options on the
  losing primary shifts both primaries away from each other, with independent
  dice when both are neutral and the ordinary three-player cap. Applies to
  interactive and explicit settlements; ally-knockout terms are counted separately.
- **Territorial treaty eligibility (16.2.4–16.2.5)** — righteous defense permits
  unoccupied enemy keys/territories after a major defensive victory and returns
  an ally's own homes; colonial cession checks the losing power's controlled
  land connection to its capital, including AU/RU/OT overseas keys. Follow-up
  space choices retain the chosen beneficiary and knockout target.
- **Living Rules v1.1 righteous defense** — the acquisition tests a peacetime
  LoC after cession; returning a home is a separate option; occupied minorities
  may be explicitly liberated and immediately allied to the defender. The
  space/nationality choices, dual-home persistence, supply and later diplomacy
  are shared by interactive and direct settlement paths.
- **Limited war** — validated war declarations and aims, objectives, alliance
  and minor calls, initiative order (including A063 Rapid Mobilization's
  first-impulse priority), war budgets, maneuver, deploy reserves (with A063's
  free deploy and extra reserve army), land/naval battles, victory
  classification, an interactive treaty chooser with the realignment minor
  chooser, demobilisation and truce recording.
- **Response and combat windows** — response cards at the start of an action
  impulse, a wartime maneuver impulse, the wartime alliance step (A063/A064) and
  a Great War maneuver impulse; `warOnly`/`gwOnly` are enforced and mid-impulse
  play is blocked. The printed A065/A067 option choices resolve through the same
  path; data-driven action and Great War combat cards with A061/A066 mode
  selection, A043's discard-pile special and A061's post-Dreadnoughts
  replacement remain in the battle window, including the post-dice GW-05/GW-06
  window.
- **End** — the printed 12-step order (reserves/militarism, fort decay,
  non-player builds, naval return to port, manpower, industrialization, truces,
  Wars of Independence, alliance resolution, World Tension, National Goal draws,
  turn/decade advance).
- **Crisis** — the printed Crisis Table with every row/column, conference
  once/reroll, special Balkan/bordering/neutral results and the real blamed
  incident driving Italy's entry.
- **The Great War** — outbreak, alliance formation, NG scoring, national will,
  alternating turn order (including the bonus-impulse slot), planning, CP
  transfer, the face-down/face-up combat-card lifecycle, maneuver, winter,
  blockade, colonial war, neutral entry, elimination and victory.
- **Combat** — CRT, support, elite units, EFs/EC losses, 18.6 support-army loss
  allocation, machine guns, forts, trench modifiers, retreats and advances;
  A043/A058/A059/A062 effects with end-of-battle draws, the GW-05 reroll,
  minor-defender windows, 18.8 decisive-battle follow-ups, 28.1 trench
  terrain/markers, overstacking/broken-LoC penalties and naval 19.7–19.9
  retreat/occupation/port-fort resolution.
- **Information security** — server-authoritative randomness; hands, goal decks,
  deck order and pending private options are stripped by
  `engine/privacy.ts#redactForView`; secret moves are `redact: true`; undo is
  disabled.

Important boundaries (the status document has the full list):

- **The treaty chooser is live, with consented allies and multi-ally
  allocation.** The winning primary chooses territorial cession, realignment,
  reparations, righteous defense or colonial cession through a pending decision,
  and declining settles the war. Realignment opens a `treatySpace` minor chooser
  when more than one minor is legal; a single legal minor applies the validated
  default. Allied beneficiaries are selectable for territorial cession and war
  reparations, an ally-knockout target can be chosen, and demobilisation prompts
  the optional free redeploy/naval moves and archives them on the war. Ally
  calls require the called ally's private accept/refuse; refusal applies the
  14.0 penalties (with the truce exemption and a no-second-call rule). Truces
  (13.5) block declarations and allied calls against a truce partner. Remaining:
  13.4.2 Seeking Aid and 13.4.1 abandonment are live; 16.1.6’s loser treaty
  choice is two-stage. Remaining: a lone non-player defender has no WarState,
  independent-minor treaty beneficiaries and both-sides-knockout peace.
- **The printed Crisis Table is live.** `engine/crisisTable.ts` carries all ten
  rows and six result columns plus the Balkan States table and the `*`/`**`/`†`
  footnotes. One International Conference is possible (WTT resets to 4; a second
  conference result rerolls); every other result causes the Great War, with the
  printed special results (bordering nation, Balkan states, neutral joins) and
  the real blamed incident driving Italy’s 25.3 entry. Remaining: minor powers
  drawn into the GW are recorded as ally markers, and Powder Keg/Balkan Wars
  apply their whole handler before the crisis opens.
- **The A058/A059/A062 and GW-05 combat-card effects are live.** A058
  reduces an enemy fort by two levels before the dice and ends the battle if the
  fort was the only defender; A059 takes one army step loss and can end the
  battle decisively when it removes the last step (the printed “major victory”
  is corrected to a battle-level “decisive victory” in the official playbook);
  A062 opens an explicit
  support-denial choice, strips that space's committed support and recomputes
  the BDRM; all three draw the printed extra card at battle end. GW-05 rerolls
  one chosen side's die after the dice and recomputes the CRT, once per battle;
  at the start of a GW impulse its normal-event mode flips one facedown
  in-front combat card face up. GW-03/GW-04 are placed face down in front of the
  opponent after combat, are flipped at planning and are usable once face up;
  GW-05/GW-06 use `G.gw.discard`. **A043 is text-complete:** it requires a
  German elite corps in the main attack force, queues the printed extra draw
  from hand, and may be played from the discard pile by discarding a hand card
  (without the draw). **A061 is text-complete:** it cannot be used after
  Dreadnoughts, and drawing it after Dreadnoughts removes it from the game and
  draws a replacement. **GW-06 may be marked face up** through the reveal move.
- **Naval combat follows 19.1–19.9.** Action-phase naval movement traces the
  printed 12.3 NMP path through connected boxes and ports (Suez/Dardanelles
  gates, enemy boxes/ports refused); amphibious assault (19.10), naval
  interception (19.1) and 19.2 avoidance (defender destination choice, printed
  DRMs, split-port fallback, failure −1) are live moves. A contact now resolves
  the adjacent-port interception attempts in order before avoidance; a won
  interception can continue the move (19.1); 28.1.1 intra-space retreat offers
  per-unit destinations; a two-box port battle asks the attacker for the box and
  applies the complete 19.5 naval DRMs and 19.4/19.6 dreadnought losses; the
  Dardanelles prompt covers the direct, free-demob and rapid-deploy paths; GW
  naval movement traces the multi-box NMP and can be intercepted in transit;
  ordinary land/naval retreats offer per-unit destinations when they diverge.
  Great War joint naval movement exists through `gwJointNaval`/
  `performGwManeuver`, with a board button for each allied contingent starting
  in the selected ship's box. Naval battles have no adjacent support (19.5: only naval
  units and a defending fort add FP); the loser retreats to a friendly port or
  empty naval box, the attacker occupies a naval box or displaces back to its
  origin after a port battle, and a port fort is eliminated when its defender
  loses (19.7–19.9). GW-06's no-retreat clause applies to naval battles too.
- **Card targets are prompted.** Second Opium War, Rebellions in China, Berlin
  Conference, Urabi Revolt and Moroccan Crisis (auctions), Naval Arms Race, High
  Seas Fleet, Empire of the Sun, The Balkan Wars, Submarines, Political
  Pressure, Exhaustion, Nicholas II and The Young Turks all open their printed
  choices and are validated. The printed **playability conditions** (including
  the “playable by” power lists, A70’s CP removal and A54’s Young Turks gate)
  are gated engine-wide (`engine/playability.ts`), Urabi’s Egypt colonial-home
  key type switches for the UK/FR winner, and auction cards are publicly
  revealed after every bid is in; Loose Grip applies all named Ottoman spaces;
  and a live 12.3 land-plus-naval transport supports the 32.1 US exit route.
- **A063 Rapid Mobilization is live.** The belligerent that played it is placed
  first in the `startWarManeuver` order, and the printed clauses are wired to the
  deploy-reserves action: one free deploy reserves action in its first maneuver
  impulse, and one extra reserve army on each deploy (still capped at three).
- **Minor defenders now get a player window when controlled.** A controlling
  player gets the defender support and combat-card windows; only an independent
  minor (no player controller) skips the defender window and auto-commits its
  legal support. Support is capped at two spaces per side with no duplicates,
  and the defending minor's own units are full FP while the controller's and
  other minors' units are halved. The attacker's own units are never offered as
  defender support.
- **National characteristics are mostly enforced.** `engine/characteristics.ts`
  now drives card draws, stability loss, land-battle DRMs, support halving, save
  limits, recruitment ceilings and the AU/FR/RU/OT special actions (AU turn-2
  Dual Monarchy and citizenship actions, FR Third Republic and Zouaves, RU TSRR
  rail and Second Rome, OT Turkish/Arab manpower, Jihad and Europeanization).
  The UK now also has **India independence**, Indian army build/loss and
  auto-displacement, **Rapid Deployment**, **Join Your Country’s Army!**,
  **Maintaining the Status Quo** and the **CW army**. GE has **Superior Staff
  Work**, **German Confederation**, **Zollverein** and **Blood and Iron!**; AU
  has citizen-nationality **unification wars** and **Arbiter of Italy**; FR has
  **Napoleon’s Legacy**; **22.5 Poland** is implemented, including
  player-initiated Polish recruitment, the reserve box and the TSRR movement
  allowance (no distinct railroad-army unit is printed). Non-player counter
  pools are transcribed from the printed chart (24 rows). Remaining: a few
  display-only/timing edge cases.
- **Great War entry follows 25.3 and GW #2.** 25.3 runs in the Outbreak Step:
  a unified Italy's own Alliance Track chit stays out when neutral, joins on a
  4+ from an aligned box (3 or less withdraws to neutral), joins automatically
  from a committed box, and is forced in when it is blamed for the inciting
  incident. An Italy that enters on its own fights under its own flag, with
  armies on its Italian home keys. GW #2 brings in the US (alliance chit, entry
  at the committed box, units in the South) or moves Italy one box and rolls
  4–6, and an entered major takes its own impulse after the players on its own
  budget. US/Italian stability and surrender (30.2/32.1/32.2) are live, the
  printed Rome/Papal States space exists, and Italy now surrenders when Rome is
  enemy-held. **30.1 capital-occupation surrender** is live in the GW (AU/RU/OT
  need capital and subcapital, with full marker bookkeeping) and **22.4** places
  one Italian army in Rome plus two on the frontier; **15.6** records an ally
  knockout when a capital falls so a retaken capital does not erase it. **32.1 US Mexico/Canada** and the **Ottoman Ankara
  capital** switch are enforced. 29.1 blockade, 29.2 colonial war and 29.3
  neutral entry are live (a neutral chooses to join; blockade reduces maximum
  industry per GW year; the colonial war uses the printed modifiers, a
  losing-side unit-loss choice, player-chosen transfers and bonus-CP
  allocation). 15.6/30.1/30.2 also displace
  allied units and enforce formerly-controlled march/rail and symmetric US/Italy
  chit cleanup.
  28.1 trench terrain is created on every printed key at GW turn 1, and the
  trench-battle marker lifecycle is maintained by the battle path.
- **AU's Unstable Situation and unified Italy's LoC are live choices.** A failed
  AU stability roll opens a private discard-or-marker decision instead of
  auto-discarding; 5.6.1's Italian Exception gives unified `IT` units a
  player-style LoC to an Italian controlled home key that connects to another
  Italian controlled home key.
- **All printed national characteristics now have a live path.** The
  `characteristicsCoverage` registry maps all 38 bullets to helpers/moves with
  zero display-only entries; the round-7 pass closed FR Second Empire/Cultural
  Symbol, AU Metternich/New Way Forward, GE Staff Work/Confederation, UK
  Join-Your-Country limits, OT Local Autonomy and the conditional key rules.
- **Old saves migrate.** `ensureStateDefaults` fills every round-1–7 field
  (build box, Italy MPIT/reinforcements, minor declarations/markers, naval
  transit/continuation, winter/neutral/exhaustion state, archived wars) at
  setup/prep and before end-phase resolution.
- **Decade labels follow the playbook.** `Decade` has seven values, and turns
  1–7 map one-for-one to 1850s, **1860s**, 1870s, 1880s, 1890s, 1900s and
  **1910s**. The printed card bands remain 1850s/1870s/1880s/1890s/1900s
  (58/11/10/8/13 cards). No action card is printed for 1860s or 1910s, so those
  are empty label-only bands: turns 2 and 7 add no cards and no card was moved
  into either band.
  `G.decade` advances with the turn in prep and in `resolveEnd`, `deck.ts`
  re-exports economy's canonical mapping, and `logText` localizes both new
  labels. See [`DECADE_AUDIT.md`](DECADE_AUDIT.md).

Bots, alternate scenarios (1870/1880/No GW/alternate GW), the 1850 tutorial and
promotional cards P1–P3 remain deliberately deferred; the round-9 pass did not
change that release boundary.

## Data layout

```
src/imperialElegy/
  types.ts                    JSON-serializable game state
  game.ts                     ImperialElegyGameDef (phases, playerView, moves)
  moves.ts                    validated moves
  configuration.ts            fixed seats and scenario list
  constant/spaces.ts          map spaces, connections, ports, home spaces
  constant/powers.ts          player displays, tracks, national characteristics
  constant/cards.ts           card/effect type definitions
  constant/cards.data.ts      all 100 action, 12 home and 10 GW cards
  constant/goals.ts           all 49 National Goals
  constant/setup.ts           campaign setup from the playbook
  engine/                     rules, deck, effects, pending, combat, GW, victory
  engine/limitedWar.ts        war-aim validation, initiative, victory, treaties (wired)
  engine/treatyChoice.ts      treaty option/space decision layer (wired)
  engine/greatWarFlow.ts      GW planning/maneuver/bonus/ally/winter (wired)
  engine/characteristics.ts   national-characteristic decisions (wired in part)
  engine/nationality.ts       core/minority nationality helpers (wired)
  engine/combatCards.ts       data-driven combat cards and modes (wired)
  engine/privacy.ts           playerView redaction (wired)
  engine/economy.ts           decade/CP-chain/industry/reserve helpers (wired)
  components/                 track strip, turn panel, mat, drawer, hand, map
```

`engine/greatWar.ts` remains the home of the one-off Great War rules (crisis,
outbreak, Italy, victory) and contains older flow helpers (`beginGwPlanning`,
`winter`, `nextGwImpulse`) that the live game no longer calls. The live turn loop
is `engine/greatWarFlow.ts`.

## QA screenshots

See `docs/qa/ie-hotseat-2026-11-12/REPORT.md` for the bilingual hotseat,
map, chart and online/spectator checks with screenshots.

## Validation

```sh
./node_modules/.bin/jest src/imperialElegy
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/tsc -p tsconfig.server.json
yarn build            # tsc && vite build
yarn test             # existing regressions
yarn test:e2e         # Playwright browser tests
python3 scripts/extract-imperial-elegy.py --check
```

### Waiting in tests

Suites that drive six boardgame.io clients share one embedded `Local` master,
so a move only becomes visible once that master settles. Do not wait for it with
`setTimeout`; read `_stateID` and wait for it to change
(`src/imperialElegy/campaign.test.ts` has the `settle` helper). Fixed sleeps both
race the master on a loaded runner — that is how `privateInfo.test.ts` failed on
CI — and dominate the runtime: the campaign suite went from 34-50 s to ~15 s
locally and 10 s on CI just by replacing its per-step `wait(30)`.

The same rule applies in Playwright: wait for the state the sleep was guessing
at (`data-active` on a seat panel, a button disappearing, a pending decision's
`id` changing) rather than `waitForTimeout`.

### IE Playwright configs

The three IE browser configs are deliberately separate, and all three are
started by their own config so CI needs no hand-started servers:

- **regression** (`playwright.ie-regression.config.ts`) builds nothing itself;
  its `webServer` runs `vite preview` over `build/` on `:5203`, so `yarn build`
  must run first.
- **controls** (`playwright.ie-controls.config.ts`) does the same on `:5201`.
- **spectator** (`playwright.ie-spectator.config.ts`) has no `webServer`
  block: the spec itself starts a boardgame.io server on `:4004` and a
  `vite preview` on `:5202`, and requires `build/server.js` to exist.

`yarn test:e2e` deliberately ignores these three specs (they run against the
dev server on `:5173`, not their own origin); `yarn test:e2e:ie` runs all three
in order, and each one also has its own script
(`test:e2e:ie:regression`, `:controls`, `:spectator`) for a CI job that runs
them on separate runners.

All three IE specs now wait on observable state instead of fixed sleeps, so the
suite no longer pays a 180-250 ms pause per seat switch. `focusSeat` waits for
the seat panel's `data-active`, the prep/home-card helpers wait for their button
to disappear, and `answerStartPending` waits for the pending decision's `id` to
change. The controls spec dropped from 1.4 min to ~58 s and the regression spec
from 1.3 min to ~53 s on the same runner; CI runs the three IE configs and the
default suite as four parallel jobs, so the whole browser stage is bounded by
the slowest one instead of by their sum.

```sh
# Regression: original hotseat spec, 6 tests, preview :5203
yarn build
./node_modules/.bin/playwright test --config=playwright.ie-regression.config.ts

# Controls: 15 tests, preview :5201
./node_modules/.bin/playwright test --config=playwright.ie-controls.config.ts

# Online/spectator: 3 tests, self-starts game server :4004 + preview :5202
yarn build:server          # produces build/server.js, which the spec requires
./node_modules/.bin/playwright test --config=playwright.ie-spectator.config.ts

# All three in order
yarn test:e2e:ie
```

The spectator spec builds its own frontend into `/tmp/ie/spectator-dist` and
writes its playwright output under `test-results/ie-spectator`.

**Full evidence for this refresh:** the IE Jest suite passes **2641/2641 tests
in 205/205 suites**; `tsc`, server `tsc`, `yarn build` and `yarn build:server` are
clean; `python3 scripts/extract-imperial-elegy.py --check` verifies **501
assets**. The declared `@i18n-chain/react@2.0.1` is now installed in this
checkout’s `node_modules`, so no shim is needed (see
[`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md#test-and-build-evidence)).
The browser specs **now contain 6 regression, 15 controls and 3 spectator
tests** (older notes here quoted 5 / 3 / 3), so take the pass counts from the
`ci.yml` e2e job (`yarn test:e2e:ie`) rather than from an older local run. The
combat-card suites are included in the run, as are
the new crisis, settlement, characteristics, logistics, card-choice, end-phase,
alliance, naval, privacy, Great War home-front, India/UK, Rome/GW-major and
playability/UI suites.

Targeted evidence visible in the tree:

- `data.test.ts` — action inventory 13–112, the 58/11/10/8/13 decade split,
  home/GW/goal counts, UK colonial keys 7, setup quantities and the manifest.
- `components/phaseSteps.test.ts`, `components/moveFeedback.test.ts`,
  `components/cardAvailability.test.ts`, `components/legalTargets.test.ts`,
  `components/stackSummary.test.ts`, `components/PlayerMat.test.tsx`,
  `components/ConfirmButton.test.tsx` and
  `components/referenceTables.test.tsx` — the board's pure decision layers: the
  step list and its reference anchors, the `_stateID` refusal probe (local and
  remote budgets, the toast copy), card playability and its reasons, the legal
  unit targets, the counter-stack summary, the mat's figures and its collapsed
  state, the arm-then-confirm contract (one inline button, unarmed on first
  paint, the armed label absent while disarmed) and the drawer tables (CRT,
  action costs, sequence of play).
- `mapValidation.test.ts` — UK colonial manpower track, every port entry has a
  real naval box and sea connection, Egypt starts as an independent minor with
  `MINOR_POWER_HOMES.Egypt`, and map/connection symmetry.
- `decadeLabels.test.ts` (7 tests), `decadeAudit.test.ts` (8 tests),
  `cardDecadeBand.test.ts` (4 tests) and [`DECADE_AUDIT.md`](DECADE_AUDIT.md) —
  the seven-value union and 1850s…1910s turn mapping, the empty 1860s/1910s
  label-only bands (no card moved into either band), the 58/0/11/10/8/13/0
  per-turn additions,
  card 100 in 1900s and the 58/11/10/8/13 printed bands. The three suites
  contain 19 tests in total.
- `economy.test.ts` and `economyIntegration.test.ts` — decade advancement,
  one-time decade deals, CP-chain funding/discard, reserve allowance and
  industrialisation integration.
- `treatyResponse.test.ts` (10 tests), `responseAlliance.test.ts` (7 tests),
  `responseWindows.test.ts` (8 tests) and `components/board.test.tsx` (7 tests) —
  the realignment minor chooser (multi-minor prompt, single-minor default, GE
  unification special), response windows at action/wartime-maneuver/alliance/GW
  maneuver, `warOnly`/`gwOnly` enforcement, mid-impulse blocking, rejection of
  combat/GW-06 cards from the impulse path, and the matching board gating.
- `combatResiduals.test.ts` (17 tests), `combatFallbacks.test.ts` (27 tests),
  `combatCards.test.ts` (43 tests), `rules.test.ts` (11 tests) and
  `combatCardsIntegration.test.ts` (9 tests) — A043’s elite-corps/discard play,
  A061’s draw replacement, 18.6 support losses, naval 19.7–19.9 retreat and
  port-fort handling, GW-06 face-up/naval no-retreat, 18.8 decisive follow-ups,
  A063 deploy clauses, A058/A059/A062 effects and end-of-battle draws, GW-05’s
  reroll, the GW-03/04 face-down lifecycle, GW discard, the two-space support
  cap and minor-defender support/halving; `rules.test.ts` also carries the
  official minor-ally half-support example. `gw05Flip.test.ts` (5 tests) covers
  the GW-05 normal-event flip.
- `limitedWarIntegration.test.ts`, `treatyChoice.test.ts`,
  `greatWarIntegration.test.ts`, `greatWarFlowStability.test.ts`,
  `characteristicsIntegration.test.ts`, `nationalityIntegration.test.ts`,
  `combatCardModesIntegration.test.ts`, `responseCardOptions.test.ts`,
  `privacy.test.ts` and `privateInfo.test.ts` cover the other live integrations.
- `multiplayerBots.test.ts` (17 tests) covers the 2–6 human lobby contract:
  parsing `setupData.bots`, the human count → bot seat split, the two-human
  minimum, the six-seat `minPlayers`/`maxPlayers`, and `setup` storing the list
  as the public `G.bots`. `ieBotDriver.test.ts` (18 tests) covers the server
  side: which seat owes an action in every phase, the refusal escape move, the
  deterministic stand-in for the random plugin, seating the bots with names and
  credentials, and two end-to-end drains (a human seat is never played; a table
  of two humans plus four bots really advances through the real reducer).
- `e2e/imperial-elegy.spec.ts` (6 tests) covers seat switching, map/card play, a
  support decision, the printed card faces, bilingual rendering and online
  creation. The controls spec (15 tests) covers the newer war/economy/MPIT panels
  and the solo/bot seats, plus a one-screen audit at 1440×900 (no document
  scroll, exactly one visible `ie-command-cp`, the 12 px text floor and the
  no-inline-style budget), the keyboard ring walk (arrows over the legal targets
  and `Enter` to commit, a miss spending no CP and `Esc` leaving the mode), the
  card inspector's SVG ↹ print face switch, and the phone dock at 390×844 (its
  closed / half / full positions, its tabs and the decision attribute wiring).
  The spectator spec (4 tests) covers online seats and spectators plus the
  two-human table (bot seats named by the server, invite links limited to the
  human seats, a bot seat refusing a human). The lobby spec covers the human
  count select and the `setupData.bots` it posts. Their configs/commands are
  listed above.

## Asset counts

The manifest's counts on this checkout are:

- 2 maps, 6 player displays, 9 reference charts;
- 98 published action-card faces (cards 21 and 82 are text reconstructions) plus
  the 10 Great War cards and 12 home cards;
- 48 published National Goal faces (goal 22 is a text reconstruction);
- 4 card backs and 312 counter images.

That is **501 published assets**. `data.test.ts` asserts the published file list
and key counts; the manifest is authoritative for checksums.

## Exact inventory

- 100 action cards, numbers 13–112; 12 home cards; 10 Great War cards.
- Action types: 57 event, 23 mandatory, 12 response, 7 combat, 1
  mandatory-response.
- Action CP values: 24×1, 54×2, 17×3, 5×4.
- National Goals: 49 in the component inventory, 48 in the campaign pool
  (AU NG-31 is scenario-only).
- Printed decade bands: 13–70 1850s (58), 71–81 1870s (11), 82–91 1880s (10),
  92–99 1890s (8), 100–112 1900s (13).

The per-turn deck additions for turns 1–7 are **58 / 0 / 11 / 10 / 8 / 13 / 0**
(turn 1’s 58 are the setup deal). Card 100 is printed and placed in the 1900s
band. The campaign turn labels are turn 1 = 1850s through turn 7 = 1910s; the
1860s and 1910s bands contain no printed cards, so turns 2 and 7 add nothing.

## Known implementation boundaries

- Bots, alternate scenarios and promotional cards are not implemented, as
  requested.
- The live naval path is a one-box move plus a naval battle with 19.7–19.9
  retreat, occupation and port-fort handling. Interception, avoidance and
  amphibious assault are **not** exposed.
- Treaties are interactive for the primary winner and the realignment minor
  chooser is live, but multi-ally allocation and demobilisation free actions
  remain fallbacks.
- A063’s first-impulse priority, free deploy and extra reserve army are live.
  Combat now allocates later losses to supporting armies (18.6), implements
  naval retreat/occupation and port-fort elimination (19.7–19.9), lets GW-06
  stop a naval retreat and be marked face up, and grants the 18.8 decisive-battle
  follow-up (another land battle or one free space of movement, once per
  impulse).
- Crisis results are collapsed to conference-or-outbreak; card target choices
  are explicit for several events but auto-picked for others. See
  `IMPLEMENTATION_STATUS.md` for the exact lists.
- A rare pending decision that belongs to a non-active seat is surfaced on that
  seat's board; the local hotseat tells the device user which seat to open, and
  online clients only expose `resolvePending` to the deciding player.
