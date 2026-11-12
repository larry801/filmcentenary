# Imperial Elegy — implementation notes

This directory documents the web implementation of **Imperial Elegy: The
Imperial World at War, 1850–1920** (VUCA Simulations, design Michael Lorino).

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
diff-stable. Promotional cards P1–P3 and the bot reference charts are not
published because bots, alternate scenarios and promotional content are out of
scope for this release.

## Running

```sh
yarn start          # Vite dev server
yarn serve          # build + boardgame.io server (multiplayer)
```

- Local hotseat: <http://localhost:5173/localIE>
- Online match creation: `/imperialElegy`
- Join/spectate: `/join/imperialElegy/:matchID/:player` (or `/spectate`)

Seat order is fixed by rule 4.3: **GE, UK, FR, AU, RU, OT** (seats 0–5).
Local hotseat keeps all six clients mounted; switching tabs never restarts the
match. Keys `1`–`6` (or `[` / `]`) switch seats.

## Implementation status

The campaign game is playable end-to-end, but this is an **in-progress
implementation**, not a finished conversion. The rule-by-rule matrix, exact card
inventory, known fallbacks and current test/build evidence are in
[`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md). The detailed rule map is
[`RULES_COVERAGE.md`](RULES_COVERAGE.md).

At a glance, the live game covers:

- **Prep** — decade deck build, reshuffle, draw, optional stability discard.
- **Diplomacy** — home-card selection, card gifts and Metternich's Legacy.
- **Action** — cards for CP or events, recruitment, fleets, influence,
  diplomacy, minor alliances, EFs, pacification, forts, industry, redeployment
  and declarations of war.
- **CP chain (live)** — up to two cards per action phase; mandatory events
  resolve on insertion; `useCpChain` funds one action per action phase (capped
  at 4 CP); chained cards stay face-up and are discarded at the end of the
  action phase.
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
  `performGwManeuver`. Naval battles have no adjacent support (19.5: only naval
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
  industry per GW year; the colonial war uses the printed modifiers, losses,
  player-chosen transfers and bonus-CP allocation). 15.6/30.1/30.2 also displace
  allied units and enforce formerly-controlled march/rail and symmetric US/Italy
  chit cleanup.
  28.1 trench terrain is created on every printed key at GW turn 1, and the
  trench-battle marker lifecycle is maintained by the battle path.
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
promotional cards P1–P3 are deliberately deferred.

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
  components/                 map, dashboards, hand, local hotseat
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

### IE Playwright configs

The three IE browser configs are deliberately separate. The **controls** and
**regression** configs have no `webServer` block: start the matching production
preview by hand in another terminal, then run the spec. The **spectator** spec
self-starts a boardgame.io server on `:4004` and a `vite preview` on `:5202`.

```sh
# Regression: original hotseat spec, 5 tests, preview :5203
yarn build
./node_modules/.bin/vite preview --host 127.0.0.1 --port 5203 --strictPort
./node_modules/.bin/playwright test --config=playwright.ie-regression.config.ts e2e/imperial-elegy.spec.ts

# Controls: 3 tests, preview :5201 (start it manually first)
./node_modules/.bin/vite preview --host 127.0.0.1 --port 5201 --strictPort
./node_modules/.bin/playwright test --config=playwright.ie-controls.config.ts e2e/imperial-elegy-controls.spec.ts

# Online/spectator: 3 tests, self-starts game server :4004 + preview :5202
yarn build:server          # produces build/server.js, which the spec requires
./node_modules/.bin/playwright test --config=playwright.ie-spectator.config.ts e2e/imperial-elegy-spectator.spec.ts
```

`yarn build` is needed before the regression/controls previews; the spectator
spec builds its own frontend into `/tmp/ie/spectator-dist` and writes its
playwright output under `/tmp/ie/spectator-test-results`.

**Full evidence for this refresh:** the IE Jest suite passes **2607/2607 tests
in 199/199 suites**; `tsc`, server `tsc`, `yarn build` and `yarn build:server` are
clean; `python3 scripts/extract-imperial-elegy.py --check` verifies **501
assets**. The declared `@i18n-chain/react@2.0.1` is now installed in this
checkout’s `node_modules`, so no shim is needed (see
[`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md#test-and-build-evidence)).
The browser specs were rerun on this build: **5/5 regression, 3/3 controls and
3/3 spectator** passed. The combat-card suites are included in the run, as are
the new crisis, settlement, characteristics, logistics, card-choice, end-phase,
alliance, naval, privacy, Great War home-front, India/UK, Rome/GW-major and
playability/UI suites.

Targeted evidence visible in the tree:

- `data.test.ts` — action inventory 13–112, the 58/11/10/8/13 decade split,
  home/GW/goal counts, UK colonial keys 7, setup quantities and the manifest.
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
- `e2e/imperial-elegy.spec.ts` (5 tests) covers seat switching, map/card play, a
  support decision, bilingual rendering and online creation. The controls spec
  (3 tests) covers the newer war/economy/MPIT panels; the spectator spec
  (3 tests) covers online seats and spectators. Their configs/commands are listed
  above.

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
