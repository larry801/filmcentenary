# Rules coverage map

**Snapshot:** 2026-11-23 refresh, verified against the printed *Imperial Elegy*
rulebook (`IE_rule.pdf`, MD5 `39b2a3e22371366867511f31e3af4e3c`). **Campaign
scenario only.**

This is the rule-by-rule map for the *live* campaign implementation — the code
reachable from `game.ts` / `moves.ts` in this workspace. A rule is counted when
that live path has typed state, validation and deterministic resolution.
Modules that exist and are tested but are not imported by the live moves are
called out separately (they are noted, not counted as coverage).

Status labels:

- **Implemented** — live path plus test coverage.
- **Partial** — live path covers part of the printed rule, or is simplified.
- **Automatic fallback** — a printed choice is resolved by a deterministic engine
  default instead of a prompt.
- **Not implemented** — no live path.

> **Wiring at this refresh.** `engine/limitedWar.ts`, `engine/treatyChoice.ts`,
> `engine/greatWarFlow.ts`, `engine/crisisTable.ts`, `engine/counters.ts`,
> `engine/alliance.ts`, `engine/endPhase.ts`, `engine/navalMovement.ts`,
> `engine/nationality.ts`, `engine/combatCards.ts`, `engine/privacy.ts` and
> `engine/economy.ts` are imported by the live game. `engine/characteristics.ts`
> is imported by `rules.ts`, `combat.ts`, `deck.ts`, `effects.ts` and `moves.ts`:
> `recruit` now delegates its ceilings to `recruitmentLimits`/`canRecruitIn`, and
> the AU/FR/RU/OT special actions are live moves. Exact gaps are in
> [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md).

## Residual rules pass (2026-11-18)

Five printed/errata clauses that earlier refreshes listed as open are live:

- **15.1 start-of-maneuver naval battles** — at each maneuver step,
  `combat.ts#beginNavalStartBattles` queues every naval box holding opposing
  fleets; `resolveNextNavalStartContact` fights them one at a time with the
  usual 19.2 avoidance window and drains the queue across pending decisions.
  Wired into both `startWarManeuver` and `startGwManeuver`.
- **34.4.5 free bot redeployment** — `engine/botRedeployment.ts` grants Easy 1
  army / Normal half / Hard all of the bot's armies at the start of a war or GW
  maneuver step, moving only through spaces the bot controls. The difficulty is
  34.1's table-wide `G.botDifficulty`.
- **12.2 / 12.4 minor-ally builds** — recruitment and construct-fleet actions
  may now build for a minor ally in that minor's home space (a port for naval
  units), via `moves.ts#buildForMinor` and
  `characteristics.ts#minorBuildDecision`.
- **26.1 GW combat-card gifts** — after the planning-step flip, a player may
  give a faceup GW combat card to an ally (`greatWarFlow.ts#giftGwCombatCard`).
- **27.5.2 Zouave substitution** — FR may rebuild the Zouaves through the GW
  draft when it has none in play; the decision offers them in place of the
  second drafted army.

## Printed-rulebook audit (2026-11-23)

This refresh re-read the whole printed rulebook rather than the earlier docs.
Two results:

- **19.11 displaced naval units during wartime was the last unimplemented
  printed rule**, and it is now live:
  `combat.ts#queuePortNavalDisplacements` moves the enemy ships out of the port
  *during* the land move (so 15.3 occupation and the rest of the action are
  unblocked), records the contact on `G.flags.portDisplacementQueue`, and
  `combat.ts#resolveDeferredNavalWork` opens the 19.1 interception window and
  then the battle once the active player's action closes — with the displaced
  fleet as the attacker and **no** 19.2 avoidance step, exactly as printed
  (“displacing naval units cannot attempt to avoid battle”). Hooks:
  `moves.ts#moveOneWartimeLandUnit` / `redeploy` / `resolvePending` /
  `declinePending` and `greatWarFlow.ts#performGwManeuver`’s two land-action
  exits. Tests: `displacedNavalUnits.test.ts` (17).
- **Stale “partial” labels closed as relabels, not new code.** Several items in
  this map were marked partial because the audit had never gone back to the
  printed text after the code landed: 4.2 counter pools, 5.7 event
  displacement, 12.13.1 Ottoman Modernization, the 22.5 Poland model and the
  §33 display-only claim. Each now carries the live helper and its regression
  suite by name. §22.5 in particular no longer says “no separate
  reserve/build-limit model” — `engine/poland.ts` has carried the printed
  3 standing / 2 reserve allowance since the Poland pass.

Also corrected from the printed book: the map **does** have a Rome space
(`constant/spaces.ts` `rome` is the Papal States capital, and
`engine/gwMajors.ts#ITALIAN_CAPITAL` points at it), so the “Rome taken” Italian
surrender clause is not inert.

## 1–4 Key concepts

- 1.0 abbreviations, 4.3 seat order (GE, UK, FR, AU, RU, OT), 4.4 active player,
  4.6 powers, 4.7 control, 4.8 markers, 4.9 war/peace/GW state — **implemented**
  in the live game.
- 4.1 dice/rounding and 4.1.1 half-FP rounding — **implemented** (`die`,
  `engine/combat.ts`).
- 4.2 counter limits — **implemented**. `engine/counters.ts` transcribes the
  printed counter chart: `PLAYER_COUNTER_CHART` for GE/UK/FR/AU/RU/OT and
  `NON_PLAYER_COUNTER_CHART`'s 24 rows (Poland 5 armies + 1 EC, Italy
  5/1/3/1/5, and so on). `hasCounterFor`/`counterRemaining`/
  `nonPlayerHasCounterFor` gate every creation path — `recruit`, `buildEf`,
  `constructFleet`, `minorBuildDecision`, the GW draft and
  `polishRecruitDecision` — and `navalCounterLimit` adds the printed 2/2
  squadron/dreadnought ceiling (A092 raises it to 4/4; GE Continental Focus
  keeps 2/2 until unification). The six chart-less non-player rows (Tuscany,
  Papal States, Egypt, Morocco, Korea, Mexico) stay `null` by design rather
  than invented. Pinned by `counterLimits`, `counterPoolChart`,
  `nonPlayerCounters` and `nonPlayerPlacementLimits`.
- 4.5 impulses vs turns — **implemented**: an impulse ends when CP are spent or
  the active player ends it; one `pass` move covers both readings (12.0), then
  advances to the next seat with a hand, otherwise to the end phase.
- 12.0 one card per impulse — **implemented and enforced**: `playCard` refuses a
  second card in the same impulse. The impulse counts as used while CP are
  banked **and** after they have all been spent
  (`impulseAlreadyUsed`: `cpRemaining > 0` or the action-phase
  `actionCpSpentThisImpulse` flag), so a mandatory event's 2 CP may be spent but
  the seat may not then open another card in that impulse. `cardAvailability`
  reads the same predicate, and the hand's reason line says
  “One card per impulse; finish this impulse first”.

## 5 Units, stacking, LoC

- Standing/reserve armies, ECs, EFs, elite colonial EFs, Zouaves, squadrons and
  dreadnoughts — typed units; armies two steps, EC/EF one step.
- Stacking caps — 3 on the main map (North Africa included), 2 on the submaps and for all Ottoman home spaces;
  ports hold 4 naval units; EC/EF attachment and loss rules are applied in
  combat. **5.5.3 overstacking** now costs one step per overstacked stack at the
  start of the owning player's impulse (owner chooses; one step total) and caps
  overstacked defenders' contributing FP.
- `hasLoc` / `isSupplySource` / `brokenLoc` — BFS trace through friendly or
  occupied spaces; a supply source is a controlled home key connected to
  another. **5.6.2 broken LoC** costs one step at the start of the owning
  player's impulse, gives −1 BDRM and forbids support; **5.6.3** displaces a
  peacetime broken-LoC army to the nearest friendly LoC space. **5.7 event
  displacement** is implemented: `effects.ts#displaceUnitToFriendlyLoc` /
  `displaceUnitsNotFriendlyTo` / `navalDisplacementTarget` and
  `rules.ts#sweepOrphanedMinorUnits` are the single shared path — land units go
  to the nearest friendly LoC space, ships to an adjacent naval box, and a unit
  with no legal destination is eliminated. Live callers: `limitedWar.ts`
  (16.2 cession, 17.0 war end), `scenarioSetup.ts`, `effects.ts` (20.8 WoI
  independence and 21.x events), `moves.ts` and the 5.7 sweep. Pinned by
  `displacementRules.test.ts`.
- **5.6's two clocks (audited 2026-11-21).**  5.6 reads "if, **at any point**,
  an army cannot trace to a supply source it has a broken LoC"; 5.6.2 then
  charges its step loss "(1) … at the start of the player's impulse" while
  (2) the −1 land battle modifier and (3) the loss of support are properties of
  the battle.  The two clocks are now kept apart in one place — the engine's
  broken-LoC predicate (`rules.ts#brokenLoc` / `minorBrokenLoc` /
  `italianBrokenLoc`) is answered at the moment of the check, and only the
  **step** is charged on an impulse boundary:
  - **(2)/(3) are live at "any point"**: `combat.ts#locBlocksSupport` filters the
    support candidates at every support window and the broken-LoC DRM block is
    re-evaluated at every battle start, so a LoC cut inside an impulse — by a
    won battle, an event, a treaty, an alliance shift, a detachment of the
    column — forbids support and gives −1 for the rest of that impulse.
  - **(1) is charged only at the start of the owner's next impulse** and once
    per impulse (`beginImpulseUpkeep` → `impulsePenalties`, with the
    `impulseUpkeepStamp` guard).  A stack whose corridor is restored before
    that point is not broken at the printed moment of step (1) and keeps its
    step; a stack cut mid-impulse pays at the next impulse start, never inside
    the battle that cut it.
  Coverage: `supplyWindow5_6.test.ts` (timing, once-per-impulse, in-supply and
  -1/no-support-before-the-step behaviour).
- **5.6 is a supply *check*, not a supply *economy*.**  The printed 5.6 has no
  supply points, no consumption and no forage step: an army either traces an
  uninterrupted chain of land connections and/or naval boxes back to a supply
  source or it is out of supply, and the only effects are 5.6.2's three
  penalties and 5.6.3's peacetime displacement.  The errata (March 2026) and
  the playbook add none.  There is no printed supply to consume, so none is
  invented; the "consumption/forage step" an earlier refresh listed as a gap
  does not exist in the printed rules and adding one would change the game.
- **Only armies check a LoC (5.6).**  "Naval units, ECs, EFs, and Elite Colonial
  EFs do not check for LoCs", so they never take a 5.6.2 penalty and never
  supply themselves; the supply check in a space is its army's.  The engine
  already keeps them out of `impulsePenalties` (armies only) and the support
  filter, which is the printed reading.
- **5.1.3 / 5.1.5 / 5.1.6 "alone in a space" (audited 2026-11-21).**  "If an EC
  is ever alone in a space at the end of a combat or at the end of a movement,
  it is eliminated."  `rules.ts#eliminateAloneEliteUnits` sweeps every EC, elite
  colonial EF and Zouave that has no land army of its own owner in its space.
  It runs at the end of a battle (`combat.ts#finishBattle`, claim-based: only a
  counter that battle stranded) and at the impulse boundary
  (`beginImpulseUpkeep`) — the end of the movement, whatever move produced the
  split (redeploy, march, rail, naval transport, 5.7 displacement, an event
  placement).  Two exemptions keep printed positions legal: the campaign setup's
  own lone counters (the FR Zouave in Algeria, the UK elite colonial EF at Suez)
  and A78's placement carry a `setupPlacedTurn` stamp until the game has moved
  on.  5.1.4's ordinary EFs and 5.1.2's reserve armies print the weaker "must
  end a move with a standing army" form and are not swept.  Coverage:
  `aloneEliteElimination.test.ts` (8).
- **33.2.2's port clause.**  "Land units using this movement must end their
  movement in a friendly port" is transitive: the grant is one free naval
  movement, which embarks no land unit, and every path out of that movement
  (`freeNavalDestinations`, the 5.5.4/movement-end checks, 12.3's transport) is
  already friendly-port gated, so no separate clause is owed.  Verified by
  `ukRapidDeployment.test.ts` (the free move ends in a friendly port or box, and
  a land unit is never carried by it).
- **5.1.2 has no "standing army" movement clause.**  The printed 5.1.2 lists
  exactly three differences from a standing army (the peacetime holding box,
  wartime-only deployment and the demobilisation return) after "reserve armies
  function identically to standing armies", so only the deployment gate is owed;
  the earlier "must end a move with a standing army" note was not printed.
- **5.3.2 / 18.6.3 loss coupling (audited 2026-11-21).**  `lossCandidates` keeps
  an EF out of the loss list whenever its force holds an army (5.3.2's "a force
  comprised of EFs and armies cannot take losses on the EFs" / 18.6.3's first
  bullet) and a force of EFs only may not eliminate a full-strength non-rebel
  army, only reduce it.  18.6.3's third bullet — "when a force comprised of EFs
  and armies takes a step loss on an army they must also eliminate an EF" — now
  runs for the whole loss group (`combat.ts#eliminateCoupledEfs`), not only when
  the army happens to be eliminated; the counter is recorded on the battle and
  in the public `BattleReport.efCouplings`, and the per-unit elimination
  fallback is kept.  5.1.5's elite colonial EF and 5.1.6's Zouave are "treated
  as ECs for the purposes of elimination", so a force that also holds one does
  not print the plain EF coupling.  Coverage: `efLossCoupling.test.ts` (9).
- **2026-11-21 supply audit:**
  - 5.6's source list is enforced.  `isSupplySource` now requires an actual
    controlled **home key** for the acting power, and a wartime second source
    may also be an allied minor's home key (`isSupplySource` + the new
    `alliedMinorController`); a foreign key a power merely occupies, such as
    Britain holding Shanghai, no longer supplies its garrison.
  - 5.6.3's "immediately displace" is now immediate.  New
    `rules.ts#repairBrokenLinesOfCommunication` re-checks every army's LoC and
    runs after every resolved pending decision (`resolvePending`), at
    `startWarManeuver`, and on the impulse boundary (which stays the fallback
    for older saves).  Coverage: `supplyRule5_6.test.ts`.

## 6–7 Displays and tracks

- Stability, manpower, industry, territorial/colonial/Arab keys, reserve box,
  City of Light, citizenship/rights, India stability, TSRR and Jihad are typed
  and displayed. Track starts match the playbook/module cross-check.
- Stability VP/BM/card tables, industry card counts and key→manpower tables are
  transcribed in `constant/powers.ts`.
- **Corrections carried in the data:** UK colonial keys start at **7** (not 9);
  the UK secondary-manpower track follows the printed boxes (1 at box 4, 2 at
  box 8, 3 at box 12, 4 from box 17); four port↔naval-box sea links were added so
  every listed port connects; Egypt is an independent minor with
  `minorHome: "Egypt"` and the three Egyptian spaces under an Egypt control
  override. `data.test.ts` and `mapValidation.test.ts` pin these.
- **Display bullets are all live.** `engine/characteristicsCoverage.ts` holds
  one entry per printed characteristic bullet: 39 `status: "live"`, zero
  `display-only` entries. The registry is the audit layer for §33 — see that
  section and
  `IMPLEMENTATION_STATUS.md#national-characteristics-enforced-vs-sub-clause-approximations`
  for the per-bullet sub-clauses that remain approximations.

## 8 Alliance system

- Alliance track boxes, committed/aligned state, declarations of war and
  card-driven alliance shifts — **implemented**.
- MPIT influence and the alliance resolution step (one d6 per positive marker + influence; differential
  ≥10 = two boxes) — **implemented** in `engine/effects.ts`; the `placeMpit`
  move spends 1 CP.
- **8.4 three-player maximum is enforced** by `engine/alliance.ts` in the 20.9
  resolution, every event/card chit shift and GW 29.3 neutral entry; a fourth
  join is refused and logged. `callWarAlly` carries a defensive cap check.
- **8.2 declaration shift is live:** a declaration moves the defender away
  from the attacker (the printed 8.4 cap is excepted for the forced shift; a
  both-neutral direction is chosen by the defender and defaulted at the
  maneuver start). The UK’s **Maintaining the Status Quo** and **Balance of
  Power** paths are live; a **unified Italy’s random declaration shift**, the
  **8.6 action-phase Alliance System tie** (same live `allianceTie` pending as
  20.9) and **13.4.1/13.4.2** abandonment/Seeking Aid are modelled.
- **A015/A111 complete their printed alliance sequence:** legal adjacent initial
  shift, an impulse-start neutral lock scoped to this resolution, and the
  conditional post-resolution WTT increase (allied players > neutral players OR
  three players in an alliance; only +1, excluding Italy). Tied decisions retain
  the event's original actor and inciting card, so WTT 5 opens the correct crisis.
  The one-d6-per-positive-marker rule also applies to Italy; Italian ties reroll.
  See `allianceSystem.test.ts` and the 2026-11-15 status follow-up.
- The US and Italy are exempt from the cap by the printed “not a player power”
  wording. Italy's MPIT resolves after the six player columns.
- **8.3 / 16.2 harsh terms:** two actual treaty options against the losing
  primary shift both primaries away from each other at settlement completion.
  The both-neutral case rolls independently; the three-player cap still applies.
  Unused major-victory picks and ally-knockout terms do not count. The saved
  interactive ledger and explicit settlement use the same idempotent resolver
  (`harshTerms.test.ts`), with bilingual public logs.

## 9–12 Cards and the action phase

- **Data:** 100 action cards 13–112, 12 home cards, 10 Great War cards, 49
  National Goals (48 in the campaign). Action types: 57 event, 23 mandatory,
  12 response, 7 combat, 1 mandatory-response. Action CP: 24×1, 54×2, 17×3, 5×4.
- **Deck/prep:** printed decade build **58 / 11 / 10 / 8 / 13** for 1850s/1870s/
  1880s/1890s/1900s (cards 13–70 / 71–81 / 82–91 / 92–99 / 100–112), reshuffle,
  draw, optional random discard for +1 stability, initial deal. Campaign turn
  labels are the seven playbook values: turns 1–7 = 1850s, 1860s, 1870s, 1880s,
  1890s, 1900s, 1910s. The 1860s and 1910s are **empty label-only bands** — no action card is
  printed for either — so per-turn additions are 58/0/11/10/8/13/0 (turns 1–7;
  turns 2 and 7 add none) and no card was moved into either band. `prepBegin`
  calls
  `beginTurnDecade`, advances `G.decade`, and passes its `entering` list —
  already filtered against deck/discard/removed, hands, home slots, CP chains
  and the industry slot — to `prepareDeck`. `deck.ts` re-exports economy's
  canonical `decadeForTurn`, and `logText` localizes the 1860s/1910s labels.
  The first deal now uses the printed 10.2 `cardsToDraw` formula (industry
  cards, stability, flashpoints and characteristics), not a hard-coded table.
- **Diplomacy (11.0/11.1):** home-card selection, Metternich’s Legacy on turn 1,
  and the **negotiation table** — **implemented**. 11.0’s “players are allowed
  to show other players their action cards” is `showCard`/`hideCard`; a shown
  card is faceup to the whole table (or privately to one power) for the
  diplomacy phase that showed it, and never has a rules effect. 11.1’s card
  transfer is a **formal agreement, not a one-way gift**: `proposeDeal` takes
  counts only (a specific card can never be named), the other side
  `respondDeal`s or `counterDeal`s, and `settleDeals` performs the random draws
  in printed seat order when the diplomacy phase closes — so accepting a deal
  moves nothing by itself. Every draw excludes home cards and is announced in
  the public log (“the random card draw is done in full view of all players”).
  Unconfirmed offers lapse at the phase’s end rather than blocking it. The deal
  form is one-way in practice: a give/take switch plus a count dropdown, with
  the inactive direction zero. See [`NEGOTIATION.md`](NEGOTIATION.md). The
  **home-card choice** comes after the table in this implementation, and the
  order is enforced: every surviving seat presses `finishNegotiation`
  (`ie-finish-negotiation`) and `chooseHomeCard` refuses until
  `negotiationConcluded`; only then do the dock (`ie-open-home-card`) and the
  Deals page (`ie-deals-home-step`) offer the dialog. It closes without
  answering while the choice stays owed. It used to pop up as diplomacy opened
  and covered the negotiation table.
- **Bot box (9.2 / 34.3.4):** the printed 2×3 box under each action card’s CP
  value is transcribed card by card (`BOT_BOX` in `constant/cards.data.ts`,
  read onto `CardDef.botBox`). 32 action cards print a box; the rest print none
  or an all-blank grid, which read the same at the table. Cards 21 and 82 print
  no box at all, so no bot auto-plays them (`CORRECTIONS.md` §8). The Rule 34
  bot now honours B1 Priority 1 step 3 (`botBoxEvent`) and 34.3.4’s “always
  play the event” rule, gated by `eventPlayability` so a refused event is never
  re-sent. The card list’s Flags column and the vector card face both show the
  box.
- **Action:** CP/event play, mandatory handling, recruitment, fleet construction,
  naval movement, influence/diplomacy placement/removal, minor alliances, EF
  build/move, pacification, forts, industrialisation, CP chain, redeployment
  (12.15 in the action phase, 15.2.4 march / 15.2.5 rail in a war),
  declarations of war and land battles — **live**, with the simplifications
  below. **12.10 EF destination is enforced** from the March 2026 errata text
  (`efDestinationAllowed`: a friendly controlled/home space or the player's
  influence marker; no LoC, no path; naval boxes refused) by the move, the
  Rules 34 bot and the Orders panel. **12.1 forts are complete:** a new fort
  needs a European space you control or occupy with a land unit, its level is
  the CP spent (1 or 2), and a fort of your own upgrades one level for 1 CP and
  never past level 2 — all four rows share the move's gate, and 20.1 offers only
  your own forts to protect.
- **A16 Liberal Reforms** now applies its no-new-armies restriction to the
  minor-ally build gate as well as the player's own recruitment.
- **H-GE-2 German General Staff** offers the printed "take a response/combat
  card from the discard pile OR gain two elite corps" choice, with the ECs
  stacked on an army as 5.1.3 requires.
- **H-FR-6 Aux Armes** takes French Intervention or Papal Influence from the
  discard and allows that card to be played immediately, once, as printed.
- `minorAlliance` and event-driven `gainMinorAlliance` recompute the tracks at
  once, so 3.3.1's allied-minor naval units reach Power Projection immediately.
- **12.11 pacification is complete.** One shared gate
  (`engine/pacification.ts#pacificationProblem`) requires either the acting
  power's own influence marker (an uncontrolled space, which the success
  replaces with control) or its control marker (12.11.2's event marker in a
  player-controlled space), one of its land units in the space, no rebel army
  (12.12.1: "it must first be eliminated in a land battle before a pacification
  roll can be attempted") and the printed once-per-space, **per impulse** limit
  — the old `pacified_<space>` flag was permanent, so one failed roll locked a
  space for the rest of the match. A65's marker mode is the printed pre-roll
  window; its *rebel* branch is a separate normal-event play that makes no roll.
  The marker lifecycle is reconciled at the impulse boundary
  (`rules.ts#reconcilePacificationMarkers`): a land unit entering an
  uncontrolled space places the printed 0 marker (2 in a naval base), and the
  marker goes when the last land unit leaves. A 0-value marker is a real marker:
  `SpaceState.pacificationMarker` records presence separately from the value, so
  a controlled space's 0 marker costs its key (`recomputeTracks`) and a
  controlled space with no marker has no "Pacify" action (`no-marker`).
  Controlled spaces keep their event markers, and their controller now clears
  them (12.11.2). The two special counters use their printed targets in
  `pacificationTarget`: Graveyard of Empires on 12+ and the Boers on 11+;
  success removes the counter.
- **15.2 / 27.5's action lists are enforced.** `engine/phaseActions.ts` is the
  single gate: 12.1's peacetime actions (recruit, fleet, refit, influence,
  diplomacy, minor alliance, break alliance, EF, pacification, fort,
  industrialisation, MPIT) are refused once a limited war's maneuver step or the
  Great War replaces the list, and the Orders panel disables the same rows with
  the printed reason. 33.3's Third Republic grant remains spendable on 12.7
  during the war, because that clause names the moment and the action itself.
- **13.4.4 Attacking China (errata):** a war of conquest on Qing China places
  the Qing army at full strength in the targeted key, and the aiding player
  gains a +1 card marker regardless of the outcome. 12.4's refit row is live as `refitNavalUnit`: 1 CP flips a reduced
  squadron/dreadnought in a friendly port, refuses naval boxes, enemy ports and
  a limited-war phase (15.2), and leaves the GW to its own 27.5.4
  `gwRefitFleet`. 12.4's placement rule is enforced before CP is spent: a new
  fleet goes only in a controlled **territorial** home key on the **main map**
  with a port, so a colonial home key on a submap (Canada, India, South Africa,
  Australia) is refused. The Orders panel mirrors both gates: a selected
  reduced fleet in a friendly port shows the 1-CP "Refit fleet" row, and the
  build rows are disabled with the main-map/territorial reason on colonial
  home ports.
- **Foreign-affairs markers (4.8 / 12.5.1–12.5.3 / 12.6 / 12.8 / 12.9):** one
  shared gate in `engine/foreignAffairs.ts`, read by both the moves and the
  Orders panel, so a row is never offered for a marker the engine refuses.
  - 12.5.3 diplomacy markers go **only** in minor power spaces: player spaces,
    the US (`the-south`) and a unified Italy (`IT`) are refused, per 4.6.2’s
    “the United States and a unified Italy are major powers.” Qing China’s
    spaces are barred outright; the South needs the American Civil War in
    effect; Japan takes none before Meiji Restoration (3.4.6); an independent
    India takes none at all (33.2.2). When a minor still holds its namesake
    space the marker must go there (Egypt → `egypt`, not Sinai).
  - Diplomacy needs **no LoC** — 5.6 lists one only for influence — which the
    engine used to demand anyway.
  - 12.5.1 influence needs an uncontrolled land space: naval boxes are refused,
    and the 12.5.2 African cap and LoC requirement remain. For this action only,
    the LoC may pass through spaces controlled by a minor power allied to the
    player (“players can trace LoCs through allied minor power spaces”);
    `hasLoc` gains an explicit `throughAlliedMinorSpaces` option so supply and
    every other LoC check keep the strict rule.
  - 12.8 allies only from your own diplomacy marker on the minor, one player per
    minor, and 4.2.1’s five-ally cap (counted per minor, not per space).
  - 12.6 removal is own markers only; the Berlin-Conference bar and the
    “another player’s unit present” bar are both printed against influence, so
    neither applies to removing a diplomacy marker.
  - 12.9 “flip any one ally marker … to its diplomacy side”: **any** player may
    do it, and the flipped marker keeps the ally’s owner (the engine used to
    hand it to whoever paid).
  - 12.9.1 Naval Supremacy: when the marker sits in a port space adjacent to a
    naval box where the acting player has **more** naval units than the player
    allied to the minor, the flip costs 3 CP instead of 4. `navalSupremacyPort`
    checks every box the port touches and requires a strict majority; a tie, a
    landlocked minor and an unallied minor all stay at the printed 4 CP. The
    Orders row quotes the cost it will actually charge.
- **Response cards:** live at the start of an action impulse, a limited-war
  maneuver impulse, the limited-war alliance step (A063/A064) and a Great War
  maneuver impulse. `responseWindowFor` requires the active power (every
  belligerent at the alliance step), no pending decision, no battle, and no
  CP/action spent in the current impulse (`actionCpSpentThisImpulse` /
  `warCpSpentThisImpulse` / `gwActionsThisImpulse`). `responseCardEligibility`
  enforces `warOnly`/`gwOnly` and the printed A063/A064 window restrictions;
  combat cards and GW-06 are rejected from this path and stay in the combat-card
  window. The board hides or disables the response control with the same gate.
  Each response's own printed trigger is checked too (`responseTriggerBlock`):
  A44/A89/A109 need France's/Russia's recorded stability (or lost-war) trigger;
  A67 (International Conference) exists only inside the open crisis decision,
  where it adds its +2 DRM and keeps the roll open, and refuses a crisis incited
  by A105 (its normal-event mode offers the printed WTT decrease); A65 (Indian
  Ocean Arms Trade) is offered by `pacify`'s printed pre-roll mode. A066
  is a combat card, not a response card.
  A063's free-deploy and extra-reserve clauses are live through the
  deploy-reserves action (see §13–17).
- **Combat-card window:** appears after support declarations, attacker then
  defender, before dice; a post-dice window handles GW-05/GW-06. The card set is
  data-driven: all seven printed action combat cards plus GW-03–GW-06.
  A061 and A066 expose their printed modes.
- **A058 Siege Guns is live.** It is offered only against an enemy fort,
  reduces that fort by two levels before the dice (a level-2 fort is removed)
  and queues the printed end-of-battle draw. If the fort was the battle space’s
  only defender, the battle ends before dice and the attacker advances.
- **A059 Flank Attack is live.** Attacker-only; it puts one step loss on an
  enemy army in the main defense (never an EC/EF) before dice and queues the
  extra draw. If it removes the last step in the space the battle ends
  immediately as a battle-level **decisive victory**, not a war-level major
  victory, and `G.war.victor` is not set. The printed card says “major victory”;
  the official playbook correction is “decisive victory”.
- **A062 Miscommunication is live.** It opens an explicit choice of a space
  that cannot support, denies that space for the rest of the battle, strips any
  committed support from it on either side and recomputes the recorded BDRM
  totals; a decline reopens the choice. It also queues the extra draw.
- **Extra draws:** A058/A059/A062 queue `battle.extraDraws`; `finishBattle`
  draws them, including when the battle ended before dice.
- **GW-05 is live for both printed modes:** after dice the player chooses a
  side, that side rerolls one die, and the differential and CRT losses are
  recomputed; it is limited to one reroll per battle. At the start of a GW
  impulse its normal-event mode flips one facedown in-front combat card face up
  (once per impulse). GW-05 is now typed `response` and the event is consumed
  into `G.gw.discard`.
- **GW-03/GW-04 lifecycle is live:** after the battle the card is placed face
  down in front of the opponent and is never discarded or redealt; planning
  flips in-front cards face up, after which they are usable and public. A power
  may hold both cards. GW-05/GW-06 go to `G.gw.discard`, never the action
  discard.
- **Card-text specials are live:** A043 requires a German elite corps and may
  be played from the discard pile by discarding a hand card (without its
  extra draw); A061 is removed and replaced when drawn after Dreadnoughts; and
  GW-06 can be marked face up.
- **Saving a card (12.0):** implemented; UK may save two, others one.
- **Every card is a CP card (12.0/12.1):** response and combat cards are spent
  for their printed CP like any other card — only their *event* modes are
  window-bound (`playResponseCard` / the combat-card window). A mandatory event
  has no plain CP mode: playing it “for CP” resolves its printed event first and
  then grants its CP, so the move shares the event path and the event gates. The
  single printed CP restriction is A105 Impulsive Ruler (“may be played for CP
  if you have 3 or fewer cards in hand”), enforced by `cpPlayability` and
  reported as `impulsive-ruler-hand`. `cardAvailability` derives
  `cpAllowed`/`cpModeOk` from the same predicate, so the tray button and
  `playCard(id, "cp")` always agree; the bot's `isCpSpendable` no longer filters
  by card type and consults the predicate before naming a card. 9.1.5's
  compensation is live too: resolving A105 clears the mandatory CP, raises the
  WTT by 1 and draws a card (`impulsiveRuler`), while its CP mode resolves no
  event.
- **Free colonial CP (A088 / UK-3):** both cards' printed "free CP" grant is
  live. `rules.ts#spendColonialCp` drains `flags.freeColonialCp` before the
  ordinary wallet, `moves.ts#requireColonialCp` is the shared payer for the four
  printed colonial actions (naval movement, construct fleet, expeditionary force,
  pacification) and restores the grant when an action is refused, and the Orders
  panel enables those rows when the grant alone can pay.
- **CP chain (12.14):** **implemented.** `cpChain` moves up to two cards from
  hand into `PowerState.cpChain`; a chained mandatory event resolves immediately,
  controlled by the active player. On a future impulse the player must **play a
  card for CP** (`useCpChain(cardId)`, rendered as a card select plus the
  “Use CP chain” button); the card is discarded normally and its CP joins the
  chain's spendable amount, with the single action capped at 4 CP. The two
  chained cards do not include that funding card (errata), stay face-up while
  the phase runs and are discarded at action-phase end; they are not returned
  to hand and their CP does not carry over. `spendCpFor`/`requireColonialCp`
  mark the chain's one CP-funded action, so a second action cannot draw on the
  same chain. Chained cards cannot be used to industrialize.
- **Industrialisation:** card + end-phase roll (`d6 + CP + DRM` vs 5; RU/OT
  target 6), with `autoIndustry` carrying a failed roll into the next turn.
  The selected home card may be used as the industry card; it leaves the hand,
  clears the home selection and returns to the permanent home slot after the
  end-phase roll instead of being discarded. `resolveEnd` now uses
  `industryTarget`/`industryRollNeeded` and the auto-chit helper. A mandatory
  event (or the mandatory response) placed into the slot still triggers its
  event, with no CP granted (12.13 *Important*). **12.13.1 Ottoman
  Industrialization** is a separate path: the Ottomans cannot use their own
  cards at all (33.6 Europeanization, enforced by the move and shown in the
  tray), and only OT-11 Modernization puts a card into their slot. That card
  asks every other power in seat order whether it will gift a card (announcing
  its true CP); with at least one offer the Ottoman seat **must** accept one,
  the giver draws a replacement and the card becomes the industrialization
  card, while the auto chit survives the gift; a gifted mandatory event is
  conducted by the Ottoman player without its CP. Only a round with no offer at
  all lets the home card be spent for its printed 3 CP. **Implemented**: the
  printed sequence has no modifiers of its own, and each step has a live
  branch — `effects.ts#openModernizationStep` (offer round in seat order, “tell
  the OT player the CP value … they cannot lie”: the option label and
  `args.card` carry the true CP and only non-home cards are offerable),
  `resolveCardDecision` (mandatory gift → `industryCard` + the event is
  conducted for OT, giver draws a replacement, `modernizationNoOffer` when
  nobody offers, and the industry-slot-already-full path spends the home card
  for 3 CP), plus `economy.ts#industryTarget` / `industryRollNeeded` /
  `autoIndustrySuccess` for RU/OT’s printed 6 target. Pinned by
  `ottomanRecruitmentUi`, `cardAvailability` and `cardEventSettlement`.
  Berlin Conference’s 12.5.2 Africa influence limit and 12.6 removal exception
  are live.
- **Card targets:** explicit, validated choices now exist for Second Opium
  War, Rebellions in China, Berlin Conference (incl. 12.5.2/12.6), Urabi Revolt
  and Moroccan Crisis (printed card auctions), Naval Arms Race, High Seas Fleet,
  Empire of the Sun, The Balkan Wars (independence + Macedonia award),
  Submarines (blockade condition, ±2 DRM), Political Pressure, Exhaustion,
  Nicholas II and The Young Turks. Older explicit choices remain for Diplomatic
  Incident, Chinese Intervention, Decline of the Qing, The Great Game, French
  Intervention, Loose Grip, Nationalist Uprising and Mahdist War; Quagmire and
  Divide and Conquer also prompt; A13/A14 now require a player-controlled,
  not-yet-marked space as printed. A025 now asks which space receives the +2 and
  resolves the printed two-dice pacification roll (including the errata's
  Egyptian special); A037 follows the five spaces' normal placement
  restrictions and makes its printed pacification roll. A097 now chooses which
  0 WoI marker to flip and runs 20.8's displacement/stability independence
  sequence. The cards whose printed “OR” used to resolve by
  a deterministic default (A045 A048 A051 A052 A068 A073 A107 A109, GW-01 and
  AU-7) now open real player choices; A073 and A107 run a per-player sequential
  chain. A039 offers the UK its printed 3/4-CP discard-to-ignore window, A069’s
  removal is conditional on the campaign turn (`removeFromTurn`), A072 places the
  naval squadron, and A099 grants its first-card-of-the-turn dreadnought.
  Urabi’s Egypt colonial-home key type switches
  for a UK/FR winner (with a legacy-save fallback), Loose Grip applies every
  named Ottoman space, and auction cards are publicly revealed; see
  [`CARD_EVENTS.md`](CARD_EVENTS.md) for the card-by-card record — the
  previously recorded defects (the four stability gains applied twice and the
  printed “OR” cards that auto-resolved) are closed there with per-clause
  regressions — and `IMPLEMENTATION_STATUS.md` for the current per-card
  boundaries.

## Information security (playerView)

- `game.ts#playerView` calls `engine/privacy.ts#redactForView`; secret moves are
  `redact: true`, and undo is disabled. **Implemented.**
- Each seat sees only its own hand, goals, goal deck, GW card and per-power
  flags. Opponents’ private zones are emptied and replaced by `handCounts` /
  `goalCounts`; deck, discard and removed order become public counts.
- Active and suspended pending decisions (`pending`, `pendingStack`) expose
  options, context and prompt arguments only to the deciding seat. The inciting
  card fields at the top level and in `flags` are hidden from non-owners.
- Log arguments naming a card (`card`, `incitingCard`) are masked for
  non-owners **unless the printed rules play that card in the open**:
  - 12.0/12.1 — any `cardPlayed` line names the card to every seat: an event is
    announced and its text followed in the open, and a card spent for CP is
    played openly as well (the log never says “played a hidden card for CP”).
    Only the card identity is public; the discard order and hand stay redacted.
  - 9.1.2/9.1.3 and 27.2 — response, combat and Great War cards are played
    openly; `responsePlayed`/`combatCardPlayed` are public.
  - 12.13/12.14 — industrialization cards and CP-chain cards are placed faceup;
    `industrializeCard` and `cpChained` are public. (A 11.1 card gift is a random
    draw, so `cardGiven` stays masked like any other random discard: the
    recipient learns the card from their own hand, not from the public log.)
  - 26.1 — GW combat cards are public information even while facedown;
    `gwCombatCardFaceup`/`gwCombatCardFlipped` are public.
  - the notes a resolving card emits about itself (`noLegalTarget`,
    `unhandledSpecial`, `gwTurnZero`) name the same played card, as does
    `incitingCard` (that card is resolving, so it was announced); a removal or WTT
    maximum about a card already played this turn stays readable. Without this
    the public log said “played a hidden card as an event”, contradicting the
    table.
  - Everything else keeps the mask: a card saved for the next turn, discarded at
    random, drawn and removed (Ironclads after Dreadnoughts) or refused for play
    was never revealed.
- Public log entries are otherwise unchanged. Face-up Great War combat cards
  are exposed through `faceupCombat`; the identities of in-front GW combat cards
  (`G.gw.combatCardsInFront`) are public even while facedown.
- Spectators (`playerID === null`) see no private zones or decision details.
- **Caveat:** per-power flags are split by an explicit `PUBLIC_POWER_FLAGS`
  allowlist (power projection, professional army, rapid mobilization, reserve
  bonus, naval limit/discount, etc.) rather than a full public/private field
  split. A future flag must be added to the allowlist to be visible; secret flags
  and auction bids stay hidden.

## 13–17 Limited war

- Declaration validation (aim and objectives checked before CP is spent), war
  aim, one or two objectives controlled by the defender, CP war budget (card CP
  + industry), **13.7's one defender card played into that budget**, ally calls,
  initiative, march/rail/naval/land-battle/deploy/reserves actions, surrender
  move, victory classification, interactive treaty chooser, truce length and
  demobilisation — **live**; the residual items are the printed-choice
  fallbacks under **Fallbacks and interpretation notes** below.
- **Step ownership (4.4):** the aim and maneuver start belong to the attacker,
  a maneuver impulse to exactly one belligerent (`holdsWarImpulse`), and the war
  settles at 15.0's all-passed boundary.  The panel and the moves read the same
  helper, so dispatch widening (`{all: "play"}`, needed for the defender's 13.7
  and 15.5 answers) no longer lets an arbitrary seat act out of turn.
- **Live details:**
  - `declareWar` uses `validateWarAim`; conquest applies the WTT/stability
    penalty; the attacker’s starting control is snapshotted for defensive
    victory.
  - `startWarManeuver` computes `war.initiative` from card CP, GE’s
    Bewegungskrieg tie-break, industry and a deterministic seat-order fallback.
    A063 Rapid Mobilization then moves the belligerent that played it to the
    front of the maneuver order.
  - `deployReserves` implements 15.2.3: one CP, reserve armies equal to half
    industry (rounded up, minimum 1, maximum 3), a controlled or occupied
    main-map space with a land-only LoC, and no attack/support/move in the
    placement impulse. A063 makes the first deploy free and adds one reserve
    army per deploy (still capped at three).
  - **15.2.4 / 15.2.5 land movement is live** (`engine/wartimeMovement.ts`):
    a march is one space, or two over clear connections, and stops at an enemy
    land unit, an enemy fort or neutral territory (an enemy space with no enemy
    land unit/fort may be passed through); a rail move traces an unlimited
    friendly-only land path and spends one slot of the half-industry allowance
    (`ceil(industry / 2)`, minimum 1) per army. `redeploy` routes wartime land
    moves through the planner, logs `wartimeMoveRejected` with the printed
    reason, and `components/legalTargets.ts` draws the rings from the same
    planner. Peacetime keeps the 12.15 unlimited redeployment. **19.11** is
    attached to this path: a march/rail that displaces enemy ships resolves
    its interception window and naval battle when the action closes
    (`combat.ts#resolveDeferredNavalWork`, drained from `resolvePending`/
    `declinePending`).
  - `war.treaties` is populated by the treaty chooser. Realignment with more than
    one legal minor opens a follow-up `treatySpace` decision with
    `context.kind = "minor"`; exactly one legal minor applies the validated
    default, and the GE-unification group special still applies.
  - `resolveWar` classifies major/normal/defensive/negotiated/white peace and
    ally knockout, opens a `treatyOption` pending for the winner when legal
    options exist, and demobilises after the chooser (or “Finish treaties”).
  - Demobilisation returns reserve armies, records the war in `G.wars`, clears
    `G.war` and hands the action phase to the winning side.
  - `resolveEnd` counts truces down at the end of each turn.
- **Live additions:** ally calls are consented (private accept/refuse for the
  called ally; 14.0 refusal penalties, truce exemption, no second call);
  multi-ally treaty allocation and ally-knockout target choosers are live
  (territorial cession/reparations may go to allies; realignment/colonial cession
  stay primary-only); demobilisation free actions are prompted per entitled
  power (winning side first, free land redeploy/naval move, done/decline,
  archived on the war); truces block declarations and allied calls.
- **Fallbacks and interpretation notes:**
  - 13.5’s “war on a minor with a player ally counts as declaring war on that
    player” is live through the minor-war path; treaty beneficiaries are player
    powers and independent minors (colonial cessions included), not arbitrary
    neutral minors; the both-sides-knockout
    white-peace order is negotiated (proposal/response/counter with an
    initiative fallback); a treaty decline can skip outstanding optional picks.
  - The final initiative tie-break is a die roll-off (`initiativeRollOff`,
    rerolling ties).
  - **16.2.4/16.2.5 follow-up:** righteous defense honors the defending major
    victory's occupation exemption and returns homes to their actual allied
    owner, while keeping LoC and knockout-target checks. Colonial cession uses
    the losing power's owned-land connection to its capital (3.2.1), including
    AU/RU/OT overseas keys and keys without a printed track type. Space-choice
    continuations preserve beneficiary and knockout target; event-granted home
    status and stale-choice validation are covered in `treatyTerritoryRules`.
  - **Living Rules v1.1 16.2.4:** acquisition now validates the post-cession
    peacetime LoC. The separate home-return option restores the actual owner
    without an occupation/LoC requirement. Minority liberation is an explicit
    space/nationality choice: occupied target, independent control and immediate
    defensive alliance, with AU citizenship, ally cap, permanent-minor and
    knockout-target guards. Dynamic independent homes survive reconquest and
    participate in supply, subsequent declarations and realignment. See
    `righteousDefenseV11.test.ts` and the real treaty-panel rendering regression.
  - **15.5 surrender:** an attacking primary's offer opens a defending-primary
    accept/refuse decision. Refusal preserves the current impulse; acceptance
    records the major result for `resolveWar`'s classification/treaty step.
    Defender surrender remains immediate (including 13.6), and a lone minor
    never owns a player prompt. The shared UI/engine boundary check, saved
    continuation and private options are covered by `surrenderConsent.test.ts`.

## 18–19 Combat

- Land combat: CRT, BDRM, support (full/half, two spaces, capped at two spaces
  per side with no duplicate), elite units, losses (18.6 main-force first, then
  supporting armies), EC/EF elimination, retreat, advance, forts, trench
  modifiers, machine guns, hydraulic recoil, stability DRMs,
  A043/A058/A059/A062 specials with end-of-battle draws, the GW-05 reroll,
  the GW-03/04 face-down lifecycle,
  18.8 decisive-battle follow-ups (another land battle or one free space, once
  per impulse) and minor-defender windows/support halving —
  **implemented** in `engine/combat.ts`; the only residual limits are the
  interpretation notes listed below.
- **18.5 Machine Guns / Hydraulic Recoil:** machine guns floor land-battle dice
  at 3 for non-rebel units only (`combat.ts#machineGunsApplies` refuses naval
  battles and any side fighting or fielding a rebel army); hydraulic recoil
  applies the CRT's `**` row (both sides +1 loss, mandatory) and `*` row (the
  victor chooses, via the `hydraulicRecoil` pending). Both are permanent once the
  card is played. A078's elite combat bonus is now live too: the controlling
  player commits an elite corps / elite colonial EF / Zouave for +1 after the
  combat-card windows (`combatElite`), and the counter is destroyed after a
  non-rebel battle (`engine/eliteBonus.ts`). The addendum is printed on the
  sub-rule, so an ordinary EC keeps its counter until A080 Machine Guns or A091
  Hydraulic Recoil is in effect, while an elite colonial EF and the Zouave
  (5.1.6) always carry the clause. Building on 18.6.2/18.6.3, ECs never take
  step losses, an eliminated army takes an attached EC (and, except for the
  elite colonial EF/Zouave exception, an attached EF) with it, and an army can
  only be targeted while one is present. The elite bonus is a pre-war rule, so
  it is not offered once the GW is active.
- **12.16 land-battle legality:** outside wartime only rebel armies are legal
  targets; in a war the defender must be an enemy player or a non-player power
  that the declaration actually made a belligerent (13.4's declared minor, an
  enemy-controlled minor, or one allied to the enemy). `beginLandBattle` and
  the board's target ring share `rules.ts#legalLandBattleTarget`.
- Minor-defender support (18.3.2): a controlling player gets the defender
  support and combat-card windows; an independent minor (no player controller)
  auto-commits its legal support and skips the defender window. The defending
  minor’s own armies are full FP; the controller’s and other minors’ armies are
  halved. Both sides are capped at two supporting spaces with no duplicates.
- Naval combat: naval dice, dreadnought/squadron FP, a defending fort's FP,
  mines in a defended port and the combat-card window — **implemented**. Mines
  are deferred until after the pre-dice card window, so A061/A066 can cancel
  them (`navalPortContinuation`, `portMinesAll`). 19.7–19.9
  retreat/occupation/port-fort handling, GW-06's naval no-retreat and **19.11
  displaced naval units** are live.
- **19.11 displaced naval units during wartime:** when a land move enters an
  enemy port holding enemy ships, `combat.ts#queuePortNavalDisplacements`
  displaces them to an adjacent naval box immediately (so the 15.3 occupation
  and the rest of the action proceed), then parks one
  `G.flags.portDisplacementQueue` entry per displaced fleet
  (`combat.ts#parsePortDisplacementQueue` / `setPortDisplacementQueue` /
  `portDisplacementQueuePending`). `resolveDeferredNavalWork` runs at action
  close (`moves.ts#moveOneWartimeLandUnit` / `redeploy` / `resolvePending` /
  `declinePending`, `greatWarFlow.ts#performGwManeuver` march/rail exits): it
  opens the 19.1 interception window first
  (`combat.ts#openNavalInterceptionWindow` with `{displaced, port}`), then
  fights the battle with the displaced ships as `attackerUnits` and **no**
  19.2 avoidance step, as printed. It drains one entry at a time and falls back
  to the 15.1 `navalStartQueue`. Pinned by `displacedNavalUnits.test.ts`.
- **Live additions:** 28.1 trenches (terrain at GW turn 1 on every printed key,
  attack restrictions, extra attacker loss, support halving, trench-battle
  markers/lifecycle), 19.10 amphibious assault, 19.1 naval interception, 19.2
  naval avoidance (defender destination choice, printed DRMs, split-port
  fallback, failure −1), 28.1.2 intra-space trench battles and the adjacent
  attack prohibition, 28.1.5 first-space restriction, movement-end stacking/port
  capacity for redeploy/GW march/rail/navalMove/free demobilisation, and
  minor-owned broken-LoC penalties; 5.5.3 overstacking and 5.6.2 broken-LoC
  penalties are applied at impulse start.
- **Remaining interpretation notes (not missing features):**
  - 19.5’s non-port DRM entries (stability, reduced-only, manpower exhausted)
    are applied in `beginNavalBattle`; 19.4/19.6 dreadnought-majority losses are
    enforced by `recordDreadnoughtRequirement`/`withDreadnoughtPriority`.
    19.1’s interception is destination-contact for ordinary moves and opens for
    12.3 transports at their first transit box (`firstTransitInterceptHop`).
    19.11’s interception window is the same 19.1 window, opened after the
    action closes rather than mid-move, as 19.11 explicitly orders.
  - 19.1 keeps the interrupted movement for ships left at sea after a partial
    19.8 port move (only a whole-force move consumes it); the 19.4 mine-retreat
    choice is unconditional and a force that cannot retreat is eliminated by
    19.7; defenders cannot retreat into the box the attacker came from.
  - Split retreats enumerate completely up to 512 assignments; 19.8 enumerates
    every legal port split up to 512 list options and uses a complete per-unit
    chooser above that. Interception battles cannot be avoided (19.2), and an
    unescorted transport caught alone is not given 19.6.1(2) elimination — it
    has no attacking ships, so no battle opens.
  - 19.5 correctly provides no adjacent support in naval battles; only naval
    units and a defending fort add FP. The 19.7–19.9 retreat, occupation and
    port-fort rules are live.

## 20 End phase
- The live end phase (`beginEndPhase`, with `resolveEnd` as the deterministic
  one-shot driver) walks `engine/economy.ts#endPhaseOrder()` and suspends on
  decisions: **20.1** one army step or protection for a level 1–2 fort per
  player in seat order; **20.2** fort decay (Indian fort exempt, protected forts
  survive); **20.3** non-player build box; **20.4** naval return with
  enemy-occupied friendly ports excluded; **20.5** owner-chosen trimming of
  standing armies over the final manpower; **20.6** industrialisation; **20.7**
  truces; **20.8** WoI progress/independence; **20.9** alliance resolution with
  a player choice on a tied roll; 20.10 WTT −1; 20.11 NG draw (1/3/5) with the
  printed choice of which Goal to return when the player would hold a fourth;
  20.12 turn/decade advance and the turn-7 finish; `endPhaseTurn` keeps the
  first drawn Goal only when the NG choice itself is still undecided.
- **Remaining fallbacks:** 20.1 offers “skip” only when no legal benefit
  exists (it is the deterministic fallback, not an option); 20.5 uses UK/OT
  per-track limits; 20.8 follows the printed displacement/−1 stability/0→+1
  flip; 20.3’s Italian rebuild reads the shared 22.4 plan and reports counters
  it cannot place in `heldBack` (the printed 4.2 ceiling, not a fallback); the
  action-phase Alliance System tie prompts (the printed neutral-lock/WTT
  clauses landed in the 2026-11-15 follow-up); 22.1.3 prompts for
  Sardinia-Piedmont vs the Two Sicilies when both are legal; 23.1’s Powder Keg
  and The Balkan Wars open the Crisis Table before the rest of their text.

## 21–23 Rebels, Italy/Poland, crisis

- Rebels, per-space WoI state, control denial and rebel armies — **implemented**
  as state plus card/GW events.  21.1's key penalty is applied in
  `recomputeTracks` whenever a space actually contains a rebel army, and 21.0's
  rule — eliminating a rebel under a WoI marker removes the marker and restores
  the key — is handled by `removeUnit`.
- Italy: Italian Minor Power Table, unification roll, Kingdom of Italy table and
  Italian units — **implemented** (`engine/greatWar.ts#italyTable`):
  - 22.1 A Lost Dream (≤0) removes IE-A030; 22.1.1 Uprising unifies immediately
    when no Italian space is player-controlled, else places the Italian Rebels;
    22.1.2 Petition removes an allied Italian minor's marker and sets the
    permanent `italyPetition` +1 (`placeItalianUnificationCardMarker` /
    `applyItalianPetition`, interactive chooser when several qualify); 22.1.3
    Internal Italian War goes through the 4.2 pool
    (`applyInternalItalianWar`, prompts for the minor when both are legal);
    22.1.4 Nationalist Wave takes the two named uncontrolled keys then rolls;
    22.1.5 `italianUnificationRoll` applies the printed DRMs (+2 if no player
    controls an Italian space, +1 per space held by the strongest Italian minor,
    plus the unification-box +1 card marker from 22.1.2). The book's "+1 per
    **key** controlled by the minor with the most keys" is counted over the
    Italian spaces; every one of them is a key except Rome, which is the Papal
    States capital, so the two counts agree in practice. The table's "-2 for the
    player who dominates the Italy flashpoint" DRM is applied too.
  - 22.2 `unifyItaly` flips the marker, converts uncontrolled Italian spaces
    (Rome included) to `IT`, strips influence/ally markers, removes the Italian
    minor units, grants three standing armies + one squadron, and runs the 22.4
    redeployment.
  - 22.3.1 the Kingdom table is live for 1–2 (2 neutral MPIT), 3–4 (control
    marker on an uncontrolled naval base, optional prompt), 5–6
    (`grantItalianReinforcement`: one reserve army + one naval unit), 7+
    (`resolveItalyOttomanWar` with the printed +1/−1/`−2 if OT army in Africa`
    DRMs, ≥4 to win, Tunisia/Libya choice, `Do not increase the WTT`, and the
    “treat this result as a 5” fallback when OT holds none of the targets or a
    truce is up). **22.3.1's allied clause** shifts Italy's chit straight to the
    neutral box and ends the procedure
    (`setItalyAllianceBox` / `italyAlliedToOttomans`).
  - 22.4 `greatWarFlow.ts#redeployItaly` uses
    `rules.ts#italianRedeployPlan` / `italianArmyDeploySpaces` /
    `italianNavalDeploySpace`: Rome first, then up to two frontier spaces
    adjacent to player control, then the remaining Italian spaces; the squadron
    goes to Naples, or Piedmont when Naples is not Italian. The same plan drives
    the 20.3 rebuild, so the two paths cannot drift. Counter ceilings:
    `ITALIAN_ARMY_COUNTER_MAX` = 5, `ITALIAN_EXTRA_NAVAL_MAX` = 2, and the 4.2
    `IT` rows.
  - **Residual 22.4 clauses** (printed, still simplified): “Italy defending
    alone” does not displace its non-Rome standing armies onto the war-goal
    spaces at war start, and its “always deploy a reserve army to defend/support
    the goal space(s)” impulse is not scripted; “Italy is controlled by the
    allied player earliest in the wartime initiative order” is modelled only
    for the GW `IT` impulse slot rather than every war; “treat Italy as 1
    industry” for rail movement and deploy reserves is not applied, so the
    generic minor/industry paths answer instead; `italianRedeployPlan`’s naval
    fallback order is Naples → Piedmont only.
  - Tests: `italianInternalWar`, `gwRuleGaps`, `italianRebuild`,
    `greatWarIntegration` and `italyRandomShift`.
- Poland (22.5): the printed special rules are a live model in
  `engine/poland.ts` — `POLISH_STANDING_COUNTERS` = 3 and
  `POLISH_RESERVE_ARMY_COUNT` = 2, `polishArmyCap` (controlled Polish spaces
  +1), `polishArmyTotal` / `polishMapArmyCap` (the 4th/5th armies are reserves
  that sit in the holding box in peacetime), `polishReserveIds` /
  `polishReserveDeployer` (one extra reserve army on a wartime deploy-reserves
  action), `polishRecruitDecision` (the +1 key build limit), the 20.3
  two-step rebuild for an independent Poland, and the TSRR interaction.
  Wired through `moves.ts#polishRecruit` / `deployPolishReserve`, the end-phase
  induction and `registerPolishIndependence`; pinned by `polishLimits`,
  `polishRecruitment`, `polishCap`, `foreignAffairs`, `ottomanRecruitmentUi`,
  `pacificationAndDecline` and `fortConstruction`. **Implemented** — printed
  22.5 says Poland “follows all normal minor power rules” plus three special
  ones, so the minor-power ally/controller machinery is the correct driver
  rather than a fallback.
- Crisis: **the printed 23.0–23.5 table is implemented** (`engine/crisisTable.ts`
  + live `crisisRoll`): every row/column, the Balkan States table, the `*`/`**`/
  `†`/`>6` footnotes, 23.3 special results, 23.4 impossible results, 23.5
  neutral joins with the three-player limit, conference once/reroll and the real
  blamed incident driving 25.3 Italy. A067’s +2 DRM is live. **Remaining:**
  minor powers drawn into the GW are ally markers (no minor-belligerent list);
  Powder Keg/Balkan Wars apply their whole handler before the crisis opens; some
  rows are reachable only when the inciting card actually raises the WTT.

## 24–32 The Great War

- Outbreak via crisis roll; discard action/home cards; form alliances; score
  National Goals; national will; build the alternating order with a bonus slot;
  deal GW cards; budgets; planning → maneuver → winter; blockade; colonial war;
  neutral entry; turn-5 limit; elimination and victory — **live**; the
  printed-choice defaults that remain are under **Fallbacks and interpretation
  notes** below.
- **Live flow (`engine/greatWarFlow.ts`, wired):**
  - `beginGwTurn` deals/refreshes GW cards, marks combat cards face-up, resets
    budgets (`max(2, industry)`, plus FR Second Empire +1) and planning flags.
  - `startGwManeuver`/`advanceGwImpulse` run the order. `"bonus"` slots open
    an alliance member/pass choice, and the last ordinary pass still processes
    bonus and US/Italian slots later in the initiative track. Outbreak slots
    alternate and fill missing player positions; 30.1 permits multiple markers
    for one alliance and removes all markers if both alliances would hold them.
  - `performGwManeuver` validates deploy, draft, refit, march, rail, naval,
    joint naval and land battle, each costing one GW budget.
  - **27.1–27.3:** `engine/gwImpulse.ts` shares the one-budget-action allowance
    with all live maneuvers, transport, cards, controls and the bot. A card funds
    an immediate distinct non-land-battle action; GE's free deploy is separate.
    Finishing an action is distinct from passing an unused ≤2-budget impulse.
    Exhaustion resolves its event and bonus and activates only at impulse end.
  - **27.7 / 27.4:** actions clear the consecutive-pass history. Turn-end checks
    reject premature winter; neutral players then get event-only impulses in
    normal seat order, with serializable continuation.
  - **27.5.1 / 27.5.3 / 27.5.4:** refit requires LoC, fleet refit requires a
    friendly port, and the live 1-CP EC move attaches to a supplied friendly
    army. Fleet-refit/EC moves have board controls and share the action allowance.
  - Planning player CP transfer (`gwTransferBudget`) is allied-only, exactly
    one CP, once per donor, and requires a LoC to the recipient.
  - GW combat cards are offered from `gwCard` and from face-up cards in front,
    including the post-dice GW-05/GW-06 window. Face-up combat cards are public
    via `G.flags.gwFaceupCombat` and `revealGwCombatCard`.
  - Planning flips every facedown in-front GW combat card face up. GW-03/GW-04
    are placed face down in front of the opponent after battle and never
    discarded or redealt; GW-05/GW-06 go to `G.gw.discard`. GW-05’s normal
    event at the start of a GW impulse flips one facedown in-front card face up.
  - `resolveGwWinter` runs blockade, colonial war, automatic neutral entry,
    elimination, the turn-5 limit and the next planning step.
- **Fallbacks and interpretation notes:**
  - US and Italy entry are live through GW #2 (`majorEntryOptions` /
    `resolveMajorPowerEntry` → `enterGwAlly`), and an entered major takes its
    own impulse after the players on its own budget. 25.3 Italy in the GW is
    live (`engine/italyEntry.ts`, `resolveItalyAtOutbreak`): Italy's Alliance
    Track chit (neutral stays out / aligned rolls 4+ / committed is automatic /
    a blamed incident forces the join), the independent Kingdom of Italy on the
    map, and 25.4's 1 stability for an Italy entering at 0. 32.1’s Mexico/Canada
    exit restriction is live in march/rail/battle/naval transport.
    Major initiative slots now recur each cycle and keep their budget, pass
    history, commanded units and upkeep separate from the player's. Controlled
    minor armies/fleets can move through the controller's march/naval paths.
  - 32.4 GW non-player declarations are live (`engine/gwNonPlayerWar.ts`):
    a belligerent may declare on a neutral non-player during its impulse, the
    opposing alliance immediately places its ally marker (agreed member or the
    printed die-roll fallback), and a neutral player holding an ally/diplomacy
    marker in the space is asked whether to join the opposing alliance
    (`gwNonPlayerJoin`).  `G.gw.nonPlayerBelligerents` is the public ledger read
    by `hostileOwner`/`legalLandBattleTarget`; 30.2's effective elimination of a
    minor (no troops, home space(s) occupied) marks the row and inherits its
    marker to a surviving alliance member.
  - 30.2 / 32.1 / 32.2 / 29.1.1 US and Italian stability and surrender are
    live (`engine/gwMajors.ts`): US army loss, decisive defeats of a
    US-/Italian-led force, the US North Atlantic winter check, Italian home-key
    loss/recapture, and immediate surrender at 0 that removes the major’s
    units. Italy’s “Rome taken” surrender is live: `constant/spaces.ts` defines
    `rome` (the Papal States capital) and `engine/gwMajors.ts#ITALIAN_CAPITAL`
    points at it, so `combat.ts` records the capital loss like any other major.
    Note that 25.3’s `resolveItalyAtOutbreak` and 22.2’s `unifyItaly` already
    treat Rome as an Italian unification space.
  - 30.0 key loss (−1; RU Scorched Earth absorbs the first) and recapture (+1)
    apply on a GW land advance (`applyGwKeyCapture`).
  - **29.3 neutral entry is a player choice:** each living neutral chooses a
    legal alliance (three-player cap, not larger than the opposing alliance) or
    to stay out; multiple neutrals roll off for order; a joiner gets a free
    redeployment, a free deploy-reserves and the next order slot; a stayer may
    redeploy and give one bonus CP to a legal belligerent.
  - **30.1 capital-occupation surrender is live in the GW:** AU/RU/OT need both
    capital and subcapital; enemy occupation is immediate and idempotent; the
    eliminated power’s alliance chit is removed, its initiative slot becomes a
    bonus impulse for its alliance (multiple markers for one alliance; removal
    and compaction only if both alliances would have markers), and its minor ally markers
    are reassigned. **22.4** places one Italian army in Rome and two on the
    frontier with the squadron in Naples/Piedmont; **15.6** records an ally
    knockout when a capital is taken so a retaken capital does not erase it.
  - 28.1 trench terrain/markers are live: `beginGwTurn` creates trenches on the
    printed keys at GW turn 1, attacks need a full-strength army and cost the
    extra step, support is halved, and the battle path maintains the trench-battle
    marker. The unused `engine/greatWar.ts#beginGwPlanning` still mass-sets
    trenches if called; the live loop never calls it.
  - GW-05 and GW-06 are both `response`-typed and are played from the GW slot
    in the battle window. GW-06 can now be marked face-up; GW-05's event mode
    flips another combat card.
  - **29.1 blockade** tracks the blockaded set from capital→naval-box LoC
    (Baltic/Black Sea endings count; RU Pacific needs the TSRR; sea hops respect
    a closed/blocked Suez and a refused Dardanelles), reduces each
    blockaded power’s maximum industry by 1 per GW year (floor 3) and clamps
    industry; the US North Atlantic check is part of the winter result.
    4.9.4's "RU and its allies" is now read from the running war: the new
    `blockade.ts#ruWarAlly` refuses a neutral RU whose 8.x box happens to match
    a belligerent's, so one alliance's neutrality can no longer cut the other
    alliance's ordinary Pacific sea route (`blockadeNeutralRu.test.ts`).
  - **29.2 colonial war** applies the printed EF/elite/army/naval-supremacy
    modifiers, opposed rolls, one/two-step losses, territorial transfer, UK/RU
    stability and the 1/3 bonus CP at the next planning step. Transfer LoC
    traces apply the same Suez/Dardanelles gates; the losing side’s loss
    choice, the winner’s transfer and the bonus-CP split are live pendings.
  - **Round-8 additions:** 30.0 charges the −1 stability for a lost dreadnought
    and counts committed supporting armies for the decisive-force threshold;
    31.0’s second defeat condition (one living power in an alliance with no
    neutral players left) ends the GW immediately at the winter step or the end
    of any battle; 29.3’s free redeployment moves all of a neutral’s land units.
  - Multi-ally treaty allocation, the ally-knockout chooser, independent-minor
    and colonial-cession beneficiaries and the negotiated both-sides-knockout
    white-peace order are live; arbitrary neutral-minor beneficiaries remain a
    gap.

## 33 National characteristics

All six displays’ characteristics are transcribed and shown.
`engine/characteristicsCoverage.ts` holds one typed registry entry per printed
bullet — **39 `live`, zero `display-only`** — and
`characteristicsCoverage.test.ts` pins both directions (every printed bullet has
exactly one entry, every entry points at a real bullet). The authoritative
enforced-vs-sub-clause table, including the per-bullet approximations that remain
approximations, is in
`IMPLEMENTATION_STATUS.md#national-characteristics-enforced-vs-sub-clause-approximations`.
Summary:

- **GE:** Bewegungskrieg’s initiative tie-break and GW first move; German
  unification control conversion; Imperial Germany’s +1 manpower; Continental
  Focus pacification 2 CP and the 2/2 naval cap until unification; **Superior
  Staff Work**, **German Confederation**, **Zollverein** (GE-controlled German
  unification spaces are keys) and **Blood and Iron!** (turn-1 NG search).
  Full Zollverein home/source treatment remains limited.
- **UK:** no reserve armies; global pre-GW British army limit; starting 1st Army
  +1 DRM; India card/DRM; Crown Jewel; pass/save at two; Indian armies limited
  by colonial manpower at build and auto-displaced to Bengal/India at end of
  turn/war; Indian Fort placement/exemption; **India independence** (33.2.2
  displacement/fort/army removal/1-army cap); **Rapid Deployment**; **Join Your
  Country’s Army!**; **Maintaining the Status Quo** and the **CW army**; treaty/
  event marker writes into independent India are rejected; **13.4.1/13.4.2**
  minor abandonment/Seeking Aid are live.
- **FR:** City of Light; Second Empire → Third Republic (stability ≤1 or lost war
  outside the GW); Second Empire +1 GW budget; Third Republic 2 free CP; Zouave
  +1 DRM/pacification, 1-CP Algeria rebuild and free prep rebuild; the
  card-driven `lostWar` switch and Napoleon’s Legacy reveal are live.
- **AU:** Metternich; Dual Monarchy card and turn-2 add-to-hand; 3 CP
  Reforms/Expand Citizenship/Incorporate; full Unstable Situation
  discard-or-marker choice (private pending);
  A New Way Forward; Continental Power pacification; Bind Them Together; wars of
  unification on citizen nationalities and Arbiter of Italy liberation targets
  (validated in `auWarAims.test.ts`); full citizenship now removes a nationality
  from the minority list for Nationalist Uprising targeting, and granting
  citizenship also records rights.
- **Italy (5.6.1 Italian Exception):** after unification, `IT` units trace a
  player-style LoC to an Italian controlled home key that has a LoC to another
  Italian controlled home key; a broken Italian LoC is charged to the combat
  DRM/support/impulse paths.
- **RU:** TSRR +1 card/+2 keys and free rail move; Endless Space; Agrarian 6;
  Tsarist Repression; Second Rome VP/Istanbul capture (the start-of-GW 2 VPs
  are awarded separately at outbreak); Scorched Earth; Russian Steamroller
  reserve limit; Endless Space keys on the battle spaces only; the printed
  Total Keys ladder (MP 5 at keys 10-14, the first MP 6 at key 15). The TSRR is
  a movement allowance, not a distinct railroad unit (as printed).
- **OT:** 2-stack home limit; Local Autonomy incl. Egypt Arab key and
  Tunisia/Tripoli LoC; Turkish/Arab split with separate Arab manpower;
  Europeanization 6 and no-own-card rejection; Jihad gain/use/discard; A106 two
  ECs; the 29.2 colonial-war EF/elite/naval modifiers. OT colonial-war Jihad
  interaction remains simplified.

## Deliberately deferred

- Bots (rule 34) **partially implemented**: `engine/bot.ts` provides Priority 1/2 action tables, BDIT targeting, BMPIT influence, wartime/GW priorities and pending-decision auto-answers; wired into `ImperialElegyGameDef` as `ai.enumerate`; hotseat local mode has a per-seat bot toggle. The printed BOT BOX (9.2/34.3.4) is transcribed for every action card that prints one and drives B1 Priority 1 step 3. Random PAC dice and power-specific home-card edge cases use deterministic defaults.
- ~~Alternate scenarios (1870, 1880, No GW, alternate GW) and the 1850 tutorial.~~
  **Implemented** — every printed scenario in `IE_playbook.pdf` pp. 3-10 is
  playable: `constant/scenarios/` holds the transcribed data and
  `engine/scenario.ts` / `engine/scenarioSetup.ts` hold the printed rules that
  differ per scenario. See [`SCENARIOS.md`](SCENARIOS.md).
- Promotional cards P1–P3.
- The printed Quick Start tutorial script.

These are the campaign release’s deliberate exclusions. They are not the only
gaps: the partial/fallback items above are live-code approximations, not
deferred content. Excluding P1–P3, the tutorial script and the bot’s
deterministic defaults, **every printed rule now has a live path** — the
2026-11-23 audit found no unimplemented printed rule after 19.11 landed.

## Inventory and test evidence

- Card counts, corrections and the exact inventory: see
  `IMPLEMENTATION_STATUS.md#exact-card-inventory-and-corrections`.
- Test/build commands and the evidence gathered for this refresh: see
  `IMPLEMENTATION_STATUS.md#test-and-build-evidence`.
- **Recorded evidence (2026-11-23, 19.11 pass):** targeted regressions green —
  `displacedNavalUnits` (17), the naval suites (`navalStartBattle`,
  `navalTransport`, `navalAvoidance`, `displacementRules`, `amphibiousInterception`,
  `navalPortContinuation`, `portMinesAll`, `gwNavalContact`), the movement
  suites (`wartimeMovement`, `redeployActionCost`, `formerlyControlledRail`,
  `ordinaryRetreatChoice`, `components/logText`), the combat residuals
  (`navalSequenceOrder`, `transitInterception`, `interceptionContinuation`,
  `occupationRecording`, `redeployPath`, `combatResiduals`, `fuzz`,
  `selfPlayRegression`), the counter suites (`counterLimits`,
  `counterPoolChart`, `nonPlayerCounters`, `characteristicsCoverage`,
  `nonPlayerPlacementLimits`) and the settlement/integration suites (`data`,
  `mapValidation`, `limitedWarIntegration`, `treatyTerritoryRules`,
  `demobilization`, `surrenderConsent`, `righteousDefenseV11`,
  `treatyAllocation`, `italianInternalWar`, `gwRuleGaps`, `italianRebuild`,
  `cardEventSettlement`, `greatWarIntegration`); `npx tsc --noEmit` is clean.
  The project carries no ESLint config, so no lint pass is runnable. GitHub
  Actions is the authoritative full-suite result for this commit.
- **Earlier recorded evidence (round 8):** the full IE Jest suite passed
  **2641/2641 tests in 205/205 suites**, `tsc --noEmit`, `yarn build` and
  `yarn build:server` were clean, and `python3 scripts/extract-imperial-elegy.py
  --check` verified 501 assets. The browser specs were rerun on that build:
  **5/5 regression, 3/3 controls, 3/3 spectator**. See
  `IMPLEMENTATION_STATUS.md#test-and-build-evidence` for the new suites and
  targeted files.
