# Rules coverage map

**Snapshot:** 2026-11-12 refresh (tree read statically). **Campaign scenario only.**

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

## 1–4 Key concepts

- 1.0 abbreviations, 4.3 seat order (GE, UK, FR, AU, RU, OT), 4.4 active player,
  4.6 powers, 4.7 control, 4.8 markers, 4.9 war/peace/GW state — **implemented**
  in the live game.
- 4.1 dice/rounding and 4.1.1 half-FP rounding — **implemented** (`die`,
  `engine/combat.ts`).
- 4.2 counter limits — **partial**: `engine/counters.ts` enforces the printed
  naval limits (GE/AU/OT 2 squadrons + 2 dreadnoughts; A092 raises to 4/4;
  GE Continental Focus keeps 2/2 until unification) and a documented derived
  army-counter pool in `recruit`/`buildEf`/`constructFleet`/GW draft. There is no
  transcribed 312-counter manifest, so EC/EF and the non-printed naval mixes
  remain uncapped rather than invented.
- 4.5 impulses vs turns — **implemented**: an impulse ends when CP are spent or
  the active player ends it; pass/end-impulse advance to the next seat with a
  hand, otherwise to the end phase.

## 5 Units, stacking, LoC

- Standing/reserve armies, ECs, EFs, elite colonial EFs, Zouaves, squadrons and
  dreadnoughts — typed units; armies two steps, EC/EF one step.
- Stacking caps — 3 in Europe, 2 elsewhere and for all Ottoman home spaces;
  ports hold 4 naval units; EC/EF attachment and loss rules are applied in
  combat. **5.5.3 overstacking** now costs one step per overstacked stack at the
  start of the owning player's impulse (owner chooses; one step total) and caps
  overstacked defenders' contributing FP.
- `hasLoc` / `isSupplySource` / `brokenLoc` — BFS trace through friendly or
  occupied spaces; a supply source is a controlled home key connected to
  another. **5.6.2 broken LoC** now costs one step at the start of the owning
  player's impulse, gives −1 BDRM and forbids support; **5.6.3** displaces a
  peacetime broken-LoC army to the nearest friendly LoC space. **Partial:**
  supply remains an approximation, minor-owned armies are not penalised, and
  general 5.7 event displacement is limited to the WoI/broken-LoC paths.

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
- **Partial**: several display rules remain text-only; the enforced-vs-displayed
  set is in §33.

## 8 Alliance system

- Alliance track boxes, committed/aligned state, declarations of war and
  card-driven alliance shifts — **implemented**.
- MPIT influence and the alliance resolution step (2d6 + influence; differential
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
- **Partial**: 14.2’s “player ally aiding a minor also shifts” is not modelled;
  the unified-Italy random shift is unreachable; the 8.6 tie is deterministic
  except at the live 20.9 step; the US and Italy are exempt from the cap by the
  printed “not a player power” wording.
- **Automatic fallback**: the Italy special branch resolves automatically.

## 9–12 Cards and the action phase

- **Data:** 100 action cards 13–112, 12 home cards, 10 Great War cards, 49
  National Goals (48 in the campaign). Action types: 57 event, 23 mandatory,
  12 response, 7 combat, 1 mandatory-response. Action CP: 24×1, 54×2, 17×3, 5×4.
- **Deck/prep:** printed decade build **58 / 11 / 10 / 8 / 13** for 1850s/1870s/
  1880s/1890s/1900s (cards 13–70 / 71–81 / 82–91 / 92–99 / 100–112), reshuffle,
  draw, optional stability discard, initial deal. Campaign turn labels are the
  seven playbook values: turns 1–7 = 1850s, 1860s, 1870s, 1880s, 1890s, 1900s,
  1910s. The 1860s and 1910s are **empty label-only bands** — no action card is
  printed for either — so per-turn additions are 58/0/11/10/8/13/0 (turns 1–7;
  turns 2 and 7 add none) and no card was moved into either band. `prepBegin`
  calls
  `beginTurnDecade`, advances `G.decade`, and passes its `entering` list —
  already filtered against deck/discard/removed, hands, home slots, CP chains
  and the industry slot — to `prepareDeck`. `deck.ts` re-exports economy's
  canonical `decadeForTurn`, and `logText` localizes the 1860s/1910s labels.
  The first deal now uses the printed 10.2 `cardsToDraw` formula (industry
  cards, stability, flashpoints and characteristics), not a hard-coded table.
- **Diplomacy:** home-card selection, card gifts, Metternich’s Legacy on turn 1
  — **implemented**.
- **Action:** CP/event play, mandatory handling, recruitment, fleet construction,
  naval movement, influence/diplomacy placement/removal, minor alliances, EF
  build/move, pacification, forts, industrialisation, CP chain, redeployment,
  declarations of war and land battles — **live**, with the simplifications
  below.
- **Response cards:** live at the start of an action impulse, a limited-war
  maneuver impulse, the limited-war alliance step (A063/A064) and a Great War
  maneuver impulse. `responseWindowFor` requires the active power (every
  belligerent at the alliance step), no pending decision, no battle, and no
  CP/action spent in the current impulse (`actionCpSpentThisImpulse` /
  `warCpSpentThisImpulse` / `gwActionsThisImpulse`). `responseCardEligibility`
  enforces `warOnly`/`gwOnly` and the printed A063/A064 window restrictions;
  combat cards and GW-06 are rejected from this path and stay in the combat-card
  window. The board hides or disables the response control with the same gate.
  A065 (Indian Ocean Arms Trade) and A067 (International Conference) prompt with
  their two printed options. A066 is a combat card, not a response card.
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
- **CP chain (12.14):** **implemented.** `cpChain` moves up to two cards from
  hand into `PowerState.cpChain`; a chained mandatory event resolves immediately,
  controlled by the active player. `useCpChain` starts one chain-funded impulse
  per action phase, setting `cpRemaining` to the banked total capped at 4. The
  cards stay face-up while the phase runs and are discarded at action-phase end;
  they are not returned to hand and their CP does not carry over. The board
  exposes a “Use CP chain” button, and chained cards cannot be used to
  industrialize.
- **Industrialisation:** card + end-phase roll (`d6 + CP + DRM` vs 5; RU/OT
  target 6), with `autoIndustry` carrying a failed roll into the next turn.
  `resolveEnd` now uses `industryTarget`/`industryRollNeeded` and the auto-chit
  helper. **Partial** relative to the printed modifiers; the OT “no own card”
  rule is now enforced. Berlin Conference’s 12.5.2 Africa influence limit and
  12.6 removal exception are live.
- **Card targets:** explicit, validated choices now exist for Second Opium
  War, Rebellions in China, Berlin Conference (incl. 12.5.2/12.6), Urabi Revolt
  and Moroccan Crisis (printed card auctions), Naval Arms Race, High Seas Fleet,
  Empire of the Sun, The Balkan Wars (independence + Macedonia award),
  Submarines (blockade condition, ±2 DRM), Political Pressure, Exhaustion,
  Nicholas II and The Young Turks. Older explicit choices remain for Diplomatic
  Incident, Chinese Intervention, Decline of the Qing, The Great Game, French
  Intervention, Loose Grip, Nationalist Uprising and Mahdist War; Quagmire and
  Divide and Conquer also prompt. Urabi’s Egypt colonial-home key type switches
  for a UK/FR winner (with a legacy-save fallback), Loose Grip applies every
  named Ottoman space, and auction cards are publicly revealed; see
  `IMPLEMENTATION_STATUS.md` for the current per-card boundaries.

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
  non-owners **unless the printed rules put that card faceup on the table**:
  - 12.0/12.1 — an event is announced and its text followed in the open, so a
    `cardPlayed` line with `mode: "event"` names the card to every seat. A card
    spent for CP is not revealed and its `cardPlayed` line stays masked.
  - 9.1.2/9.1.3 and 27.2 — response, combat and Great War cards are played
    openly; `responsePlayed`/`combatCardPlayed` are public.
  - 12.13/12.14 — industrialization cards and CP-chain cards are placed faceup;
    `industrializeCard` and `cpChained` are public. (11.1 card gifts and 14.0 ally
    cards are also public at the table, but their log entries carry no `card`
    argument, so they are outside this mask.)
  - 26.1 — GW combat cards are public information even while facedown;
    `gwCombatCardFaceup`/`gwCombatCardFlipped` are public.
  - the notes a resolving card emits about itself (`noLegalTarget`,
    `unhandledSpecial`, `gwTurnZero`) name the same faceup card, as does
    `incitingCard` (that card is resolving, so it was announced); a removal or WTT
    maximum about a card already played faceup this turn stays readable. Without
    this the public log said “played a hidden card as an event”, contradicting
    the table.
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
  + industry), ally calls, initiative, march/rail/naval/land-battle/deploy/
  reserves actions, surrender move, victory classification, interactive treaty
  chooser, truce length and demobilisation — **live and partial**.
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
- **Partial/fallback:**
  - 13.5’s “war on a minor with a player ally counts as declaring war on that
    player” is live through the minor-war path; treaty beneficiaries are player
    powers and independent minors (colonial cessions included), not arbitrary
    neutral minors; the both-sides-knockout
    white-peace order is negotiated (proposal/response/counter with an
    initiative fallback); a treaty decline can skip outstanding optional picks.
  - The final initiative tie-break is a die roll-off (`initiativeRollOff`,
    rerolling ties).
  - `surrender` is a simple status/victor setter; the subsequent `resolveWar`
    still drives classification and treaties.

## 18–19 Combat

- Land combat: CRT, BDRM, support (full/half, two spaces, capped at two spaces
  per side with no duplicate), elite units, losses (18.6 main-force first, then
  supporting armies), EC/EF elimination, retreat, advance, forts, trench
  modifiers, machine guns, stability DRMs, A043/A058/A059/A062 specials with
  end-of-battle draws, the GW-05 reroll, the GW-03/04 face-down lifecycle,
  18.8 decisive-battle follow-ups (another land battle or one free space, once
  per impulse) and minor-defender windows/support halving —
  **implemented/partial** in `engine/combat.ts`.
- Minor-defender support (18.3.2): a controlling player gets the defender
  support and combat-card windows; an independent minor (no player controller)
  auto-commits its legal support and skips the defender window. The defending
  minor’s own armies are full FP; the controller’s and other minors’ armies are
  halved. Both sides are capped at two supporting spaces with no duplicates.
- Naval combat: naval dice, dreadnought/squadron FP, a defending fort's FP,
  mines in a defended port and the combat-card window — **partial**. Mines are
  deferred until after the pre-dice card window, so A061/A066 can cancel them.
  19.7–19.9 retreat/occupation/port-fort handling and GW-06's naval no-retreat
  are live.
- **Live additions:** 28.1 trenches (terrain at GW turn 1 on every printed key,
  attack restrictions, extra attacker loss, support halving, trench-battle
  markers/lifecycle), 19.10 amphibious assault, 19.1 naval interception, 19.2
  naval avoidance (defender destination choice, printed DRMs, split-port
  fallback, failure −1), 28.1.2 intra-space trench battles and the adjacent
  attack prohibition, 28.1.5 first-space restriction, movement-end stacking/port
  capacity for redeploy/GW march/rail/navalMove/free demobilisation, and
  minor-owned broken-LoC penalties; 5.5.3 overstacking and 5.6.2 broken-LoC
  penalties are applied at impulse start.
- **Remaining gaps (round-8 refresh):**
  - 19.5’s non-port DRM entries (stability, reduced-only, manpower exhausted)
    are applied in `beginNavalBattle`; 19.4/19.6 dreadnought-majority losses are
    enforced by `recordDreadnoughtRequirement`/`withDreadnoughtPriority`.
    19.1’s interception is destination-contact for ordinary moves and opens for
    12.3 transports at their first transit box (`firstTransitInterceptHop`).
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
  a player choice on a tied roll; 20.10 WTT −1; 20.11 NG draw (1/3/5); 20.12
  turn/decade advance and the turn-7 finish; `endPhaseTurn` auto-keeps an
  undecided NG draw.
- **Remaining (round-8 refresh):** 20.1 offers “skip” only when no legal
  benefit exists (it is the deterministic fallback, not an option); 20.5 uses
  UK/OT per-track limits; 20.8 follows the printed displacement/−1 stability/0→+1
  flip; 20.3’s Italian rebuild now uses the shared 22.4 plan; the action-phase
  Alliance System tie now prompts (the printed neutral-lock/WTT clauses are not
  modelled). 22.1.3 now prompts for Sardinia-Piedmont vs the Two Sicilies when
  both are legal; 23.1’s Powder Keg and The Balkan Wars open the Crisis Table
  before the rest of their text.

## 21–23 Rebels, Italy/Poland, crisis

- Rebels, per-space WoI state, control denial and rebel armies — **implemented**
  as state plus card/GW events.
- Italy: Italian Minor Power Table, unification roll, Kingdom of Italy table and
  Italian units — **partial**; several table results only log or set flags.
- Poland: represented through card handlers and minor-power units; no separate
  reserve/build-limit model.
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
  neutral entry; turn-5 limit; elimination and victory — **live and partial**.
- **Live flow (`engine/greatWarFlow.ts`, wired):**
  - `beginGwTurn` deals/refreshes GW cards, marks combat cards face-up, resets
    budgets (`max(2, industry)`, plus FR Second Empire +1) and planning flags.
  - `startGwManeuver`/`advanceGwImpulse` run the order. The `"bonus"` slot now
    grants an extra impulse to the alliance with fewer living slots instead of
    being skipped.
  - `performGwManeuver` validates deploy, draft, refit, march, rail, naval,
    joint naval and land battle, each costing one GW budget.
  - Planning CP transfer (`gwTransferBudget`) is allied-only and once per donor.
  - GW combat cards are offered from `gwCard` and from face-up cards in front,
    including the post-dice GW-05/GW-06 window. Face-up combat cards are public
    via `G.flags.gwFaceupCombat` and `revealGwCombatCard`.
  - Planning flips every facedown in-front GW combat card face up. GW-03/GW-04
    are placed face down in front of the opponent after battle and never
    discarded or redealt; GW-05/GW-06 go to `G.gw.discard`. GW-05’s normal
    event at the start of a GW impulse flips one facedown in-front card face up.
  - `resolveGwWinter` runs blockade, colonial war, automatic neutral entry,
    elimination, the turn-5 limit and the next planning step.
- **Partial/fallback:**
  - US and Italy entry are live through GW #2 (`majorEntryOptions` /
    `resolveMajorPowerEntry` → `enterGwAlly`), and an entered major takes its
    own impulse after the players on its own budget. 25.3 Italy in the GW is
    live (`engine/italyEntry.ts`, `resolveItalyAtOutbreak`): Italy's Alliance
    Track chit (neutral stays out / aligned rolls 4+ / committed is automatic /
    a blamed incident forces the join), the independent Kingdom of Italy on the
    map, and 25.4's 1 stability for an Italy entering at 0. 32.1’s Mexico/Canada
    exit restriction is live in march/rail/battle/naval transport.
  - 30.2 / 32.1 / 32.2 / 29.1.1 US and Italian stability and surrender are
    live (`engine/gwMajors.ts`): US army loss, decisive defeats of a
    US-/Italian-led force, the US North Atlantic winter check, Italian home-key
    loss/recapture, and immediate surrender at 0 that removes the major’s
    units. Italy’s “Rome taken” surrender is inert because the map has no Rome
    space.
  - 30.0 key loss (−1; RU Scorched Earth absorbs the first) and recapture (+1)
    apply on a GW land advance (`applyGwKeyCapture`).
  - **29.3 neutral entry is a player choice:** each living neutral chooses a
    legal alliance (three-player cap, not larger than the opposing alliance) or
    to stay out; multiple neutrals roll off for order; a joiner gets a free
    redeployment, a free deploy-reserves and the next order slot; a stayer may
    redeploy and give one bonus CP to a legal belligerent.
  - **30.1 capital-occupation surrender is live in the GW:** AU/RU/OT need both
    capital and subcapital; enemy occupation is immediate and idempotent; the
    eliminated power’s alliance chit is removed, its initiative slot becomes the
    alliance bonus impulse (one-marker/compaction), and its minor ally markers
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

All six displays’ characteristics are transcribed and shown. The
`engine/characteristics.ts` helpers are now partly live, but many effects are
still display-only or helper-only. The authoritative enforced-vs-displayed table
is in
`IMPLEMENTATION_STATUS.md#national-characteristics-enforced-vs-displayed-only`.
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
  reserve limit; Endless Space keys on the battle spaces only. The TSRR is a
  movement allowance, not a distinct railroad unit (as printed).
- **OT:** 2-stack home limit; Local Autonomy incl. Egypt Arab key and
  Tunisia/Tripoli LoC; Turkish/Arab split with separate Arab manpower;
  Europeanization 6 and no-own-card rejection; Jihad gain/use/discard; A106 two
  ECs; the 29.2 colonial-war EF/elite/naval modifiers. OT colonial-war Jihad
  interaction remains simplified.

## Deliberately deferred

- Bots (rule 34) **partially implemented**: `engine/bot.ts` provides Priority 1/2 action tables, BDIT targeting, BMPIT influence, wartime/GW priorities and pending-decision auto-answers; wired into `ImperialElegyGameDef` as `ai.enumerate`; hotseat local mode has a per-seat bot toggle. Random PAC dice and power-specific home-card edge cases use deterministic defaults.
- Alternate scenarios (1870, 1880, No GW, alternate GW) and the 1850 tutorial.
- Promotional cards P1–P3.
- The printed Quick Start tutorial script.

These are the campaign release’s deliberate exclusions. They are not the only
gaps: the **partial** items above are live-code gaps, not deferred content.

## Inventory and test evidence

- Card counts, corrections and the exact inventory: see
  `IMPLEMENTATION_STATUS.md#exact-card-inventory-and-corrections`.
- Test/build commands and the evidence gathered for this refresh: see
  `IMPLEMENTATION_STATUS.md#test-and-build-evidence`.
- **Recorded evidence (round 8):** the full IE Jest suite passes
  **2641/2641 tests in 205/205 suites**, `tsc --noEmit`, `yarn build` and
  `yarn build:server` are clean, and `python3 scripts/extract-imperial-elegy.py
  --check` verifies 501 assets. The browser specs were rerun on this build:
  **5/5 regression, 3/3 controls, 3/3 spectator**. See
  `IMPLEMENTATION_STATUS.md#test-and-build-evidence` for the new suites and
  targeted files.
