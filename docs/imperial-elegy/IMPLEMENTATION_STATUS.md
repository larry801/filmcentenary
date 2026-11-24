## Verified: the Partial-section audit round 1 — §8 and §20 promoted (2026-11-23)

The six sections still labelled **Partial** (§8, §9–12, §13–17, §20, §24–32,
§34) were audited clause by clause against `IE_rule.pdf` and the March 2026
errata.  This round closed the printed rules that were genuinely unwired and
promoted the two sections with no remaining gaps.  The rest stay Partial with
named blockers.

**Promoted to Implemented**

- **§8 Alliances and MPIT.**  Two real holes were closed:
  - *8.1.2's first bullet* — an alliance member (or a minor defended by one)
    can no longer be a declaration target.  The gate lives in
    `moves.ts#declareWar` (single and two-power declarations) and in the panel
    list `engine/declarationTargets.ts#declarationDefenders`.
  - *8.4's absolute cap* — A92 Naval Arms Race wrote chits directly and could
    seat a fourth player in a full alliance.  `effects.ts#shiftAllianceAway`
    now goes through `engine/alliance.ts#shiftAlliance` and logs a blocked
    step, exactly like 20.9.
  Tests: `allianceDeclarationGate.test.ts` (6).  The section's remaining items
  are interpretation notes (the Aux Armes neutral-volunteer both-neutral
  direction is deterministic; a stall-safety default answers an unanswered 8.2
  choice), not gaps; see
  `RULES_COVERAGE.md#8-alliance-system--implemented`.
- **§20 End phase.**  A full clause audit of printed pp. 41–42 and the 12.12
  obsolescence errata found no unwired rule: every one of the twelve steps has
  a live decision/suspension plus regression coverage, including 20.4's
  nearest-port choice and the 20.3 build-box exceptions.  The remaining items
  are printed-unspecified-case interpretations (own-fort protection, full-port
  ships stay at sea, first-drawn NG default).  Evidence: `endPhaseSteps`,
  `endPhaseResiduals`, `navalEndReturn`, `manpowerTrackChoice`,
  `ngDrawShuffle`, `ngLimit`, `italianRebuild`, `minorBuildIndependence`,
  `industryCeilings`, `economyIntegration`, `polishLimits` and
  `components/phaseSteps` (175 tests / 16 suites).

**Other printed rules closed this round**

- §9–12: `recruit` reads the shared 15.2/27.5 phase gate (no wartime/GW
  recruitment); 12.16 same-space rebel battles are legal; 12.17.1's “never
  declare war on the US or the CSA” is enforced in the panel and the engine;
  12.3's errata requires a peacetime landing in a **controlled** port
  (`auditFixes.test.ts`, 8).
- §13–17: errata 13.4.3 (Denmark's 3rd Choice is Austria) and errata 13.4.4
  (Qing army in the targeted key) applied; `seekingAid.test.ts` was corrected
  to the errata cell.
- §24–32: 26.0 GW discard reshuffle at planning; 25.2 US chit removed while
  the ACW runs / after the CSA wins; 25.4 player entrant at 0 stability +1
  (`greatWarFlow.test.ts`).

**Named blockers left Partial (carried into the next round)**

- **§9–12:** 9.1.4/10.3 mandatory-discard trigger and card-marker expiry;
  10.4 UK India flip; 12.2 new-EC LoC; 12.8 allied-minor EC; 12.15 special
  redeployment through naval boxes; 12.17 errata all-card CP; 9.1.3 response
  timing.
- **§13–17:** 13.2.1 Italian unification wars; 13.4.5 co-defender/Bismarck
  errata; unified Italy in a limited war (14.0/15.4.1/15.6); 15.0 pass ≤2;
  15.2.2 limited-war joint naval; 15.5 capital end; 16.1.3(2) blockade victory;
  16.1.4/16.1.5 peace agreements; 16.2 errata targeting; 17.0 errata
  displacement.
- **§24–32:** 15.2.3 multi-army GW deploy; 26.2 US CP transfer; 25.7 secret
  alliance order; 25.5/25.6/25.6.1 fallbacks; 28.1.5 trench-battle port naval
  movement.
- **§34:** bot Priority-2 auto-pacification, 34.3.1 placement order, 34.2 pile
  order, 34.4.1/34.4.2/34.4.3/34.4.4/34.4.7/34.4.8 printed answers; the
  scenario sub-scope is complete.

## Verified: §13–17's 13.4.5 and 16.2 errata (2026-11-23)

- **13.4.5 Bismarck auto-alliance.**  When a Bismarck declaration names a minor
  with a player ally and an unaligned minor, the allied player immediately
  allies the unaligned minor — before the 13.4.2 aid search, over the five-ally
  cap — and the declaration then resolves as an attack on that player.
- **16.2 one option per non-primary player.**  The treaty cap is enforced from a
  recorded allocation history (`WarState.treatyTargets`): a second option
  imposed on a player who is not a primary belligerent is rejected with
  `non-primary-cap`.

Coverage: `bismarckWar.test.ts`, `treatyAllocation.test.ts` (new cases).  §13–17
remains Partial: 13.2.1, unified Italy in a limited war, 15.0, 15.2.2 and
16.1.4/16.1.5 stay open.

## Verified: §13–17's war-ending pair — 15.5 and 16.1.3(2) (2026-11-23)

- **15.5 capital-capture end.**  A primary belligerent's occupied capital ends
  the maneuver step immediately: `resolveWar` accepts the settlement without the
  all-passed boundary, and the bot calls `resolveWar` as soon as
  `warCapitalFallen` is true.  A lone non-player defender still has no capital
  to fall (its capture is the defensive result classifyVictory assigns).
- **16.1.3(2) blockade defensive victory.**  `resolveWar` now computes the live
  17.1 blockade of the attacker (`blockadedAt`) in addition to the old flag, so
  a blockaded attacker who missed the war aims gives the defender a defensive
  victory (`defensive:blockade`).

Coverage: `warEndingRules.test.ts` (3).  §13–17 remains Partial; 13.2.1,
13.4.5, Italy in a limited war, 15.0, 15.2.2, 16.1.4/16.1.5 and 16.2 stay open.

## Verified: §34's final two clauses — section promoted (2026-11-23)

Round 8 closed the last rule-34 blockers.

- **34.2 random home-card pile.**  Every bot now draws a random home card; the
  printed pile order is the bot's hand order (the dealt action cards arrive in
  shuffled deck order): GE/OT put the home card on top, the UK on the bottom,
  FR/AU/RU shuffle it in.  `revealHomeCard` still reveals the home card at the
  bot's impulse.
- **34.4.3 top-card war budget.**  A defending bot plays its top non-home,
  non-mandatory card for 13.7's war-budget action; a mandatory/home top card is
  left in the pile and the next usable card is played.

**§34 is promoted to Implemented** (all eight printed scenarios were already
complete; promotional cards P1–P3 remain a documented exclusion).  The shipped
bot PAC is not in this repository, so the B1/B2 transcription cannot be
re-checked against the printed chart.  Coverage: `botPrintedRules.test.ts` (12).

The pile change shifts seeded RNG consumption, so the fixed full-game seed moved
from `IE-FULL-2` to `IE-FULL-3` (both play to the GW turn limit; the old seed's
new trajectory exposed a stale-view race in the hotseat harness).  That harness
race was fixed too: a refused GW card is remembered per power/card/mode instead
of globally, and the bot only takes a 27.4 neutral event impulse for the neutral
player whose slot is open.

## Verified: §34 placement, war aims and ally calls (2026-11-23)

Round 7 closed the remaining placement/alliance clauses of rule 34.

- **34.3.1 placement order.**  `orderedHomeSpaces` puts the capital first when
  it holds no land unit, then home keys bordering another player (allied
  borders are ranked last while a non-allied target exists); the same ordering
  drives fort builds, and UK naval builds pick a random controlled port below
  the port stacking limit.
- **34.4.2 closest/two-space war aims.**  The bot sorts a target's legal
  objectives by land-hop distance from its nearest army and names two spaces
  when the closest target controls two legal ones (one space at 0 industry).
- **34.4.4 ally calls and joins.**  A primary belligerent calls every eligible
  ally in the alliance step; an aligned bot joins a call on 3+ (committed bots
  always join), Balance of Power joins on 3+, and the bot always answers a
  Seeking Aid request with aid.

Coverage: `botPrintedRules.test.ts` (9).  Still open in §34: 34.2's random
home-card pile order and 34.4.3's top-card war-budget draw.

## Verified: §34 bot decisions and §13–17's 17.0 errata (2026-11-23)

Round 6 closed five printed bot decisions and the 17.0 demobilisation errata.

- **34.3.2 automatic pacification.**  A Priority-2 roll of 1–4 spends 1 CP to
  pacify a space where the bot has a land unit and the engine's
  `pacificationProblem` accepts the action, before any other Priority-2 row.
- **34.4.1 declaration-strength guard.**  `withinDeclarationStrength` excludes
  any declaration target with at least four more army steps (the target plus
  its minor allies), applied to the bot's home-card declaration candidates.
- **34.4.7 EC differential.**  The bot commits its elite corps only when the
  differential after support is −2…+2 in its favour (`battleDrmTotals`).
- **34.4.8 treaty options.**  The bot skips treaty options whose beneficiary is
  another player and keeps the option for itself (or finishes).
- **34.5 Impulsive Ruler.**  A bot plays A105 for CP (its printed mode, which
  resolves no event) whenever the hand-size clause allows it, never for its
  event.
- **§17.0 errata displacement.**  Demobilisation now displaces every
  belligerent **land** unit that is not in its own **controlled home space**,
  including units sitting in ally-controlled or occupied spaces — the earlier
  code used the superseded "enemy controlled territory" wording.  Naval units
  are left to their own return steps (20.4 and the 17.0 free naval move).

Coverage: `botPrintedRules.test.ts` (5) and `demobErrta.test.ts` (1); the full
GW/limited-war regression batches and the fixed-seed full game stay green.

Still Partial: §13–17 for the remaining war-engine blockers (13.2.1, Italy in a
limited war, 15.0 pass cap, 15.2.2 joint naval, 15.5 capital end, 16.1.3(2),
16.1.4/16.1.5, 16.2 errata targeting, 13.4.5) and §34 for 34.3.1 placement,
34.2 pile order, 34.4.2 war aims, 34.4.3 war budget and 34.4.4 ally calls.

## Verified: §9–12 final round — three blockers closed, section promoted (2026-11-23)

Round 5 finished the §9–12 blockers and promoted the section.

- **9.1.4 discarded mandatory events trigger.**  `discardRandomHandCardTriggering`
  runs a random-discard effect, files a discarded mandatory/mandatory-response
  card on `G.flags.mandatoryDiscardQueue`, and `drainMandatoryDiscardQueue`
  resolves it for the discarder in 4.3 seat order once no decision/battle is
  open (a triggered event that opens its own decision leaves the rest queued for
  its resume).  Used by A073 Economic Panic and A109 Revolution of 1905,
  including A073's printed "Discarded mandatory events trigger in turn order".
- **12.8 generic minor ECs.**  `minorBuildDecision`/`buildForMinor` accept
  `eliteCorps` for an allied minor: 2 CP, placed with the controller's or the
  minor's army that has a LoC, marked `mp`, one EC per minor; the Orders panel
  has the row.
- **12.15 Special Redeployment.**  ECs, elite colonial EFs and Zouaves may trace
  a naval-box route during a redeployment action when they end stacked with a
  friendly army (`navalMovement.ts#specialRedeployPath`, shared by the move and
  the map's legal-target rings).

The section is **Implemented**; 9.1.3's response-window timing and 12.14's
chain-action granularity remain documented interpretation notes, not unwired
rules.  Coverage: `cardsPartialFixes.test.ts` (10 total, including the A073
discarded-Boxer trigger, minor EC cap and the naval redeploy path).

## Verified: §9–12 partial-rule round — five printed clauses closed (2026-11-23)

Round 4 of the Partial-section audit closed five §9–12 blockers; the section
stays Partial for the three named items below.

- **10.3 card-marker lifetime.**  Transient `cardMarkers` are added to the deal
  and discarded after all cards are dealt (`prepBegin`); A094 The Boxer
  Rebellion's −1 marker lives in `PowerState.persistentCardMarkers` and is
  removed when the last Boxer army is eliminated.
- **10.4 UK Indian Stability.**  `moves.ts#discardForIndianStability` is the
  printed separate prep action (UK only, own once-per-prep guard, random card,
  mandatory events/home cards excluded) with a dock control; it flips the
  Indian Stability marker to its stable side.
- **12.2 newly built ECs need a LoC.**  `canRecruitIn`'s elite-corps branch now
  requires the army to have a LoC, not merely to be friendly.
- **12.6 influence-only bar.**  The once-per-impulse removal bar applies only
  to influence markers; diplomacy markers can be removed again in the same
  impulse.
- **12.17 errata all-card CP.**  A card played for CP records its printed value
  in `impulseCardCp`; an ordinary war declaration must spend exactly that whole
  value and nothing may have been spent from it yet.  The War panel locks the
  declaration CP to that card and explains the refusal.

Coverage: `cardsPartialFixes.test.ts` (7 — transient marker/Boxer lifetime,
India flip and its guards, supplied/unsupplied EC, influence vs diplomacy bar,
4-CP card refusing a 1-CP declaration).  Still open: 9.1.4's mandatory-event
discard trigger, 12.8's allied-minor EC build and 12.15's special redeployment
through naval boxes (plus the 9.1.3/12.14 timing interpretations).

## Verified: 25.7 alliance-set GW order — §24–32 promoted (2026-11-23)

Round 3 of the Partial-section audit closed the last §24–32 blocker and
promoted the section.

- **25.7 is live.**  During GW turn 0 planning one member of each alliance may
  submit its own impulse permutation (`moves.ts#chooseGwOrder` →
  `greatWar.ts#setGwOrderChoice`).  `greatWar.ts#rebuildGwOrder` folds the
  submitted orders into the printed alternating track: GE's alliance still
  goes first, but the chosen order decides which of its members receives the
  first impulse ("GE does not have to get the first impulse"), 25.7.1's bonus
  slots are preserved for the outnumbered alliance, and the US/Italy major
  slots stay after the player powers.  An alliance that never submits keeps
  its 4.3 seat order; `startGwManeuver` reveals the result and later GW years
  never rebuild (30.1 owns the order then).  Pinned by
  `gwOrderChoice.test.ts` (4: default order, single-alliance choice, both
  alliances choosing with GE not first, and the membership/permutation/once
  refusals).
- The remaining §24–32 items are documented deterministic fallbacks, not
  unwired rules: 25.5's outbreak NG top-up keeps the highest printed VP,
  25.6's national-will boosts use the printed stability→industry→manpower
  order, and 25.6.1 attaches the UK EC to the first on-map army.  The 25.7
  order selector and the 26.2 US transfer control are engine moves only; the
  planning panel still shows the player-to-player transfer control.

## Verified: GW partial-rule follow-up — 15.2.3, 26.2 and 28.1.5 (2026-11-23)

Round 2 of the Partial-section audit closed three more §24–32 blockers.

- **15.2.3 multi-army GW deploy is live.** `performGwManeuver`'s `deploy` case
  now places up to the printed half-industry allowance (minimum 1, maximum 3)
  in one 1-CP action.  The request accepts a `unitIds` batch, validates every
  unit against the reserve box, the allowance and the stacking cap, and the
  `gwDeploy` move defaults to the whole allowance when no unit is named (the
  board button and the bot use that default).  `beginGwTurn`'s budget reset is
  unchanged; the free 33.1 staff deploy uses the same allowance.
- **28.1.5 trench-battle port naval movement is live.**  A port space holding
  a 28.1 trench battle marker may be entered and left by a 12.3 naval movement
  without an amphibious assault.  `planNavalMove` gained `allowTrenchPort` and
  `planNavalTransport` lifts the 19.10 hostile-port gate in both directions
  for the marker space, so the board's transport target list and the live
  `navalTransport` move agree.
- **26.2's US planning transfer is live as an engine move.**
  `engine/greatWarFlow.ts#transferGwMajorBudget` debits `G.gw.usBudget` once
  per planning step, requires the recipient to be on the US's GW side and
  traces the transatlantic LoC from The South through the US's own/allied
  spaces to the recipient's capital (an enemy fleet in a sea box severs it).
  `moves.ts#gwUsTransferBudget` exposes it to the players on the US's side;
  the planning panel still renders only the player-to-player transfer control.

Coverage: `greatWarFlow.test.ts` (25 — the multi-army deploy, its stacking and
allowance refusals, the US transfer and its ally/war/LoC refusals) and
`trenchBattleSpace.test.ts` (12 — the port entry/exit plan, the live landing
and the no-marker control).  Local `tsc --noEmit`, the fixed-seed full game and
a focused GW/naval/bot regression batch passed; GitHub Actions is the
authoritative full result.

## Verified: paid rule 19.11 and the printed-rulebook audit (2026-11-23)

The coverage map was re-read against the printed `IE_rule.pdf` rather than
against earlier prose, and the one genuine hole was closed.

- **19.11 Displaced Naval Units During Wartime is now live.** When a land move
  enters an enemy port holding enemy ships, `engine/combat.ts#queuePortNavalDisplacements`
  displaces the ships to an adjacent naval box *immediately* — so the 15.3
  occupation and the rest of the active player's action are not blocked — and
  parks a resumable entry on `G.flags.portDisplacementQueue`
  (`parsePortDisplacementQueue` / `setPortDisplacementQueue` /
  `portDisplacementQueuePending` / `displacedFleetSeat`). At action close
  `resolveDeferredNavalWork` opens the 19.1 interception window first
  (`openNavalInterceptionWindow` with `{displaced, port}`,
  `attemptInterception` / `resumeInterruptedNavalMove` /
  `resolveNavalInterception` gained the same options) and then fights the battle
  with the displaced fleet as `attackerUnits`, with **no** 19.2 avoidance step —
  "displacing naval units cannot attempt to avoid battle". It drains one entry
  per decision and falls back to the 15.1 `navalStartQueue`.
  Hooks: `moves.ts#moveOneWartimeLandUnit` / `redeploy` / `resolvePending` /
  `declinePending` and `greatWarFlow.ts#performGwManeuver`'s march/rail exits
  (which also drains on `finish`). `components/logText.ts` gained
  `portNavalDisplacement`, `portNavalBattle` and
  `portNavalInterceptionWindow`.
  Coverage: new `displacedNavalUnits.test.ts` (17 — immediate displacement,
  15.3 occupation still possible, deferred battle, displaced-as-attacker, no
  avoidance window, interception window, queue drain, GW path, empty-port and
  no-contact negatives), plus green reruns of `navalStartBattle`,
  `navalTransport`, `navalAvoidance`, `displacementRules`,
  `amphibiousInterception`, `navalPortContinuation`, `portMinesAll`,
  `gwNavalContact`, `navalSequenceOrder`, `transitInterception`,
  `interceptionContinuation`, `occupationRecording`, `redeployPath`,
  `combatResiduals`, `fuzz` and `selfPlayRegression`.
- **The doc's `partial` labels were re-audited against the book, not the code.**
  4.2 counter pools, 5.7 event displacement, 12.13.1 Ottoman Modernization, the
  22.5 Poland model and the §33 “many effects are still display-only” claim were
  all stale: each has a live helper and a regression suite, and the coverage map
  now names them. See
  [`RULES_COVERAGE.md`](RULES_COVERAGE.md#printed-rulebook-audit-2026-11-23).
- **Corrected: the map does have a Rome space.** `constant/spaces.ts` defines
  `rome` (the Papal States capital) and `engine/gwMajors.ts#ITALIAN_CAPITAL`
  points at it, so 30.2's Italian “Rome taken” surrender is live, not inert.
- **22.4's lone-defender clauses are implemented** in the new
  `engine/italyMilitary.ts`: non-Rome standing armies displace onto the war
  goals when Italy defends alone, its reserve army deploys to the threatened
  goal first, the earliest allied player in the war's initiative order commands
  Italy (GW and limited war), and Italy uses 1 industry for rail and deploy
  reserves. The printed naval order remains Naples, else Piedmont.

## Fixed: no engine-built English left in the zh_CN UI (2026-11-23)

Reported as "查找帝国挽歌未本地化文本并修正".  A second audit pass — this one
following the text the *engine* builds rather than the panels' own markup (that
half was covered on 2026-11-20) — found three independent leaks; each is fixed
and pinned by `components/i18nCoverage.test.ts`.

- **Eight fixed decision prompts had no Chinese.**  `Divide and Conquer: …`,
  `German General Staff: …` (twice), `Aux Armes: …`, `Divide and Conquer: place
  or move an EF …`, `Return one National Goal to your NG deck` (used in two code
  paths) and the two scenario deck-edit questions were built by `decision(...)`
  without `promptZh` and were absent from `PROMPT_ZH`, so a zh_CN player read the
  English prompt.  All of them are in `PROMPT_ZH` now, and the stale key left
  over from an earlier wording ("Remove one of these National Goals from the
  deck?") — which no longer matched any engine prompt — is gone.
- **Engine refusal reasons stayed English in the log and in the Polish rows.**
  `logText` interpolated `Decision.reasons` verbatim (the engine joins them with
  " | ", not the board's " · "), and `spaceActions` translated every recruit row
  except `polishArmy` / `polishReserve`.  The log now runs the reasons through
  `engineReasonText` (`reasonText.ts`), which splits on both separators and puts
  the original one back; the two Polish rows go through the same helper.
  `auActionRejected` also names the special action in the UI language (`改革` /
  `扩大公民权` / `吞并`) instead of printing its code.
- **The reason table itself covered only a fraction of the engine.**  It had 23
  exact entries and 8 patterns against the ~190 sentences the engine can store,
  so the national-characteristic refusals printed English (`Agrarian: needs a 6
  after DRMs`, `Local Autonomy: …`, `Poland is not independent`, `The
  Trans-Siberian Railroad is not complete`, the Jihad refusals, …).  The table
  now carries 116 exact entries and 13 patterns; the parameterised ones name the
  nationality, the non-player power and its counter kind, the manpower ceiling,
  the power in the reserve-army refusal, or the colonial-war stability cause.

Coverage: new `components/i18nCoverage.test.ts` (2 — every fixed `decision(...)`
prompt is in `PROMPT_ZH` or passes `promptZh`; every English refusal sentence in
`engine/` + `moves.ts` is translated by `engineReasonText`), `reasonText.test.ts`
(+5 — the " | " list, the minor/counter patterns, the reserve-army power name,
the colonial-war cause, a plural list) and `logText.test.ts` (+4 — a recruit
refusal's reason list, the Polish refusal, the colonial-war cause, the AU action
name).

## Fixed: the printed stability card markers and the Russian key ladder (2026-11-23)

Found by playing a solo Russia campaign straight off the published player
displays (`public/imperial-elegy/displays/`).  Two transcribed values disagreed
with the board a player actually reads.

- **The stability track's card values are plus/minus markers, not hand sizes.**
  Every display prints a boxed **`-1 card`** in the 0 and 1 boxes and a boxed
  **`+1 card`** in the 6 box.  10.2 deals from the industry level and then
  applies "any plus or minus card markers", with a printed minimum of three
  cards; 10.3 discards those markers after the deal.  `POWER_DEFS` stored the 0
  and 1 boxes as an **absolute** `cards: 1`, so `cardsToDraw` returned a single
  card — under the three-card floor and one *more* than stability 2, inverting
  the printed ladder.  The boxes are now `cardDelta: -1` (and OT's own row is
  aligned with them), so a low-stability power draws `industry - 1`, floored at
  three, exactly as the display reads.
- **Russia's Total Keys ladder was one box early.**  `displays/RU.jpg` prints
  **MP=5 at keys 10-14** and the first **MP=6 at key 15**; the transcribed table
  advanced to 5 at box 10 and to 6 at box 14, so Russia gained a manpower step a
  key early.  The table (and the independent `KEY_MANPOWER_EXPECTED` copy the
  validation suite compares against) now reads
  `[2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6,6]`.  The campaign still opens on the
  circled box 12 with MP 5, so the start position is unchanged.

`mapValidation.test.ts` used to forbid a negative `cardDelta`, which is why the
absolute reading survived; it now checks that the card ladder is non-decreasing
(the printed `-1 … +1` shape).  `components/PlayerMat.test.tsx` prints the
corrected `-1 card` box.

**Coverage:** new `printedDisplayData.test.ts` (7 — the card marker in every
display's boxes, the three-card floor at stability 0-1, the industry draw above
the floor, the full Russian ladder box by box, and the campaign's 12-key/MP-5
opening).  Full IE Jest suite **335 suites / 4411 tests** pass locally;
`tsc --noEmit` clean.

## Fixed: a click on the hotseat bot-seat button used to force a new match (2026-11-22)

Reported as "帝国挽歌本地热座 点击选择机器人席位无法关闭相当于强制新开一局 按钮文字改成新游戏并添加确认 solo模式重新开局应该回到选择剧本和国家的页面而不是直接不改设置重新开局".

The hotseat header button opened the seat-setup screen with no way back, so
reading it as "change bot seats" and clicking it silently promised a brand-new
match.  Solo's "restart" had the same complaint from the other side: it dealt
the same power and scenario again instead of letting the player choose.

- **The hotseat button reads New game** (`新游戏`) and only raises a
  confirmation dialog (`ie-new-game-dialog`, `ie-new-game-cancel` /
  `ie-new-game-confirm`).  Cancel (or Esc, or the backdrop) leaves the running
  match exactly as it was.
- **The setup screen is closable.**  Confirming opens the seat-setup screen, and
  that screen now carries `ie-back-to-match` (`返回对局` / Back to the match):
  leaving it without pressing Start match keeps the running match, its turn and
  its state.  A new match is dealt only by `ie-start-match` (`开始对局`), which
  is exactly what the dialog's body says.
- The seat strip's number shortcuts are ignored while the setup screen is open,
  so the form cannot be switched out from under the reader.
- **Solo's New game returns to the setup page.**  `ie-solo-new-game` (label
  `新游戏` / New game) confirms through `ie-solo-new-game-dialog`, then
  navigates back to `/localIE/solo`, where the great power and the scenario are
  chosen again.  It no longer re-deals the same power and scenario.

**Coverage:** the new `e2e/imperial-elegy-controls.spec.ts` cases "the hotseat
New game button asks for confirmation and can go back" (dialog without a state
change, cancel, then confirm → setup → back with the same match id and turn) and
the reworked "solo new game is confirmed and returns to the setup page" (cancel
keeps the match, confirm lands on `/localIE/solo`, and the next start deals a
different seat).

## Fixed: a printed free-CP event ended the impulse before the CP were spent (2026-11-22)

Reported as "帝国挽歌英国打出日不落事件没有花费2cp界面直接结束行动轮了".

UK-3 Sun Never Sets pays its printed "then spend 2 CP" as a restricted grant
(`freeOperationCp` for the naval half, `freeIndianCp` for the India half) rather
than as ordinary `cpRemaining`; A088 Our Place in the Sun does the same with
`freeColonialCp`.  The impulse tail only asked whether `cpRemaining` was zero, so
playing the card (or, for Sun Never Sets, answering its printed choice) handed
the impulse on immediately: the 2 CP could never be spent, and because nothing
cleared the flag it survived into a later impulse where it bought a free action.

- `moves.ts#hasUnspentGrant` treats every named grant (`freeColonialCp`,
  `freeOperationCp`, `freeIndianCp`) as part of the impulse's budget, exactly
  like banked ordinary CP.  The three event tails — `playCard`'s synchronous
  resolution, its A067 special case, and `finalizePendingCard` (the path a card
  choice takes) — now keep the impulse open while a grant is unspent.
- `clearActionImpulseSpend` clears all three grants when the impulse hands over
  or the action phase ends, so whatever the seat does not spend is forfeited
  instead of leaking into a later impulse.
- The board says where the budget is: the dock summary reads "你的行动轮——还有
  N 点事件赠予 CP 可花" / "Your impulse — N event CP still to spend", and the
  action foot's CP note adds "另有 N 点事件赠予 CP（仅限对应行动）" beside
  "本行动轮剩余 CP：0".  The colonial rows were already enabled from the grant
  (`actionAvailability.ts`), so the seat can act immediately.

**Coverage:** `colonialFreeCp.test.ts` (+5 — Sun Never Sets keeps the impulse open
after its choice, the India half likewise, A088 likewise, the grant is spendable
in the same impulse, and a hand-over forfeits it) and
`components/board.test.tsx` (+1 — the dock names the unspent grant).

## Fixed: two-target declarations and the non-player aid hint (13.0 / 13.4.2 / 14.1) (2026-11-22)

Reported as "帝国挽歌俾斯麦应该是可以选择2个power做目标 其他统一和解放战争是同一power的2个地块 按照这个修复宣战界面 同时标明non player power可能触发的盟友".

Rule 14.1 lets the GE and FR home cards attack **two different powers** with one
declaration.  The engine accepted that pair, but the panel could not express it
and could not show what a non-player target would drag in:

- **The panel offered no second target that worked.** `secondPowerOptions` only
  listed player powers *when the first target was a player*, so a declaration
  was always "power + power".  A second target is now a `WarTarget`: `minor +
  power`, `power + minor` and `minor + minor` are all declarable, and the select
  sits beside the first target so the shape of the declaration is visible before
  any space is picked.
- **The objective lists came from the first target only.** A legal "FR + AU"
  declaration could never name AU's space, because both the first and second
  objective lists were enumerated from the first defender.  `declarationObjectives`
  and `declarationSecondObjectives` now take the second target and enumerate the
  union of both targets' legal spaces, still through one `validateWarAim` call
  with `{defenders: pair}`.  Rule 13.0's "up to two spaces" is offered for the
  ordinary single-target case too (13.1/13.2 print it; 13.3 allows two as long
  as only one is a key), which is the reporter's "其他统一和解放战争是同一power
  的2个地块".
- **Nothing said who a non-player target would call.** `ie-war-nonplayer-aid`
  reads `seekingAidSlots` — the enumeration `beginSeekingAid` runs — and names
  the 13.4.2 order: the diplomacy-marker holder, then the 13.4.3 table's
  1st/2nd/3rd Choice, with `(*)` on the roll-off cells.  Bismarck's join ban
  replaces it with "defends alone (13.4.2 / 15.4.2)", and a minor that already
  has a player ally is named with that ally (13.4.1).
- **The engine records both targets.** `declareWar` takes a `WarTarget` for
  `secondTarget`/`primary`, `WarState.coDefenderMinors` carries the non-player
  parts of a pair (it was declared but never written), `warTargetKey` /
  `warTargetFromKey` carry a target through the 13.4.1/13.4.2 and Napoleon's
  Legacy decisions as string flags, and `finalizeWarDeclaration` resolves which
  named target is the primary (only a player power can be one — 14.1 uses it for
  the capital that ends the war).  A pair may take one space from each target.
- `declarationSecondTargets` hides a second target whose pair shares no legal
  space, so no dead row reaches the panel.

**Coverage:** `declarationTargets.test.ts` (6 new — second targets of both
kinds in both directions, a card without the clause, the aim gate, the union of
spaces, "every offered pair is accepted by `declareWar`", and a pair taking one
space each), `components/warDeclarationPanel.test.tsx` (4 new — a non-player
second target, two non-player targets, two spaces across a pair, and the aid
hint with and without the join ban), and `e2e/imperial-elegy-controls.spec.ts`
(a new two-target case: Denmark + France, asserting the aid candidates and the
settled war; the existing Bismarck case now also asserts the second-target
select).  Full IE Jest suite **335 suites / 4447 tests** pass locally.


## Fixed: show targets, one-way deals, and negotiation before the home card (2026-11-22)

Reported as "外交阶段展示卡牌没有向单独一个玩家展示的入口 点击展示之后应该选择目标玩家 展示按钮本身名字容易误会 改成向他人展示 谈判时不应该能选择本土牌 谈判结束后再选"，随后追加"外交阶段卡牌交易一般是单向的 改成开关切换 给出/获取 数量用下拉列表"。

The 11.0/11.1 table had three gaps:

- **11.0 had no private-show entry.** The hand row's button was labelled `展示`
  / "Show" and always called `showCard(card, null)`, so the engine's
  one-power show could only be reached by a crafted client. The button now
  reads `向他人展示` / "Show to others" and opens `ie-show-target-picker`,
  which names `ie-show-target-table` (public) and one `ie-show-target-<POWER>`
  per surviving opponent. The tray's `本阶段已展示` list names each recipient,
  so the same card may be shown to more than one seat.
- **The deal form asked for two counts.** Deals are usually one-way, so the
  form is now a `给出 / 获取` switch (`ie-deals-direction-give|take`) plus a
  `ie-deals-count` dropdown bounded by that direction's live dealable hand.
  The inactive direction is always zero; the terms preview prints one
  sentence. `startCounter` still mirrors the original terms into the form,
  so a counter starts from the offer's direction.
- **The home card could be chosen during negotiation.** `diplomacyBegin`
  writes `flags.negotiationDone = false` for every seat, and the new
  `finishNegotiation` move closes one seat's segment. `chooseHomeCard`
  refuses until every surviving seat is done (`negotiationConcluded`). Both
  the dock (`ie-finish-negotiation`) and the Deals page
  (`ie-finish-negotiation-from-deals`, `ie-deals-negotiation-step`) offer the
  step; the home-card entry (`ie-open-home-card` /
  `ie-deals-home-step`) appears only afterwards. The Deals page names the
  seats still negotiating, and the panel/national-goal inline fallback
  (`HandChoices.homeReady`) hides the home faces until then. A legacy save
  without the flag reads as already finished, so resumed games do not stall.

Bots close their own segments (`finishNegotiation`) before choosing a home
card; the online driver picks any bot still at the table instead of waiting
behind the framework's current player, and parks a finished bot while human
seats talk.

**Coverage:** `negotiation.test.ts` adds the finish/gate cases (5),
`homeCardChoice.test.tsx` rewrites the diplomacy suite around the two-step
flow (7), `diplomacyPanel.test.tsx` adds the negotiation-step and one-way
deal-form assertions, `HandTray.test.tsx` pins the renamed show button and
the recipient list, `ieBotDriver.test.ts` covers bots finishing the segment,
and the e2e helpers sweep `ie-finish-negotiation` before opening the home
card.

## Fixed: Bismarck's white-peace war no longer gives GE a second card (2026-11-22)

Reported as "德国bot在事件俾斯麦之后打出了另一张牌".  The record showed GE
playing Bismarck, declaring its unification war, the war ending in a white
peace, and then the GE bot playing South German Confederation for CP before the
UK had acted.

Rule 16.1.5: a white peace has **no winning side**.  `demobilizeWar` nevertheless
fell back to `war.victor ?? "attacker"` and set `G.activePower` to the attacker,
so the action phase restarted with the very seat whose impulse the declaration
had already spent.  A white peace now resumes at the next seat in printed turn
order after the attacker (4.3); a real winner still receives the first impulse
as before.

**Coverage:** `bismarckWar.test.ts` (a full Bismarck → white peace → demobilise
run asserts `activePower === "UK"`) and the white-peace case in
`campaignWar.test.ts`.

## Fixed: Sun Never Sets is now the printed two-way choice (2026-11-22)

Reported as "英国的日不落应该有选项让玩家二选一 印度还是建造 1 个分舰队/无畏舰并花 2 CP 于远征军、绥靖或海军移动".

The old handler resolved **both** halves: it flipped the Indian marker, placed a
London squadron, granted 2 free colonial CP and placed the Indian Fort.  The
card now opens an `eventChoice`:

- **Naval** — build 1 squadron **or** dreadnought (a second choice when both are
  legal) at a legal territorial home port, then grant 2 CP restricted to
  expeditionary force, pacification and naval movement.
- **India** — flip the Indian Stability marker (forced unstable while India is
  independent), place/upgrade the Indian Fort, then grant 2 CP restricted to
  Indian army steps or an EF in India/Bengal.

The grants are separate public flags (`freeOperationCp`, `freeIndianCp`) with
their own payers, so neither can pay for a fleet or a British army.  A British
army build in India/Bengal now also refits the matching Indian counter, and an
Indian refit is no longer blocked by the Indian army cap.

**Coverage:** `sunNeverSetsChoice.test.ts` (9 — both halves, fort upgrade,
squadron/dreadnought choice, and each grant's allowed/refused spends), plus the
updated `endPhaseSteps.test.ts` and `indiaIndependence.test.ts`.

## Changed: solo play has its own match page, not the hotseat shell (2026-11-22)

Reported as "帝国挽歌 solo模式使用单独页面 不复用本地热座 solo不显示其他机器人的界面 solo没有更换席位功能 只能重新开局 重开增加确认防止误点".

The solo setup page already existed, but it handed over to `/localIE`, the
six-board hotseat shell with five bot seats.  That let a solo player switch into
a bot's board (and read its private hand), change seats or bot seats mid-game,
and left `?fresh=` as the only guard against resuming an old match.

- **`/localIE/solo/play` is a dedicated match page** (`components/soloMatch.tsx`).
  The setup page writes the solo choice as before and navigates there; the
  hotseat shell is no longer part of solo play.
- **One visible board.**  Only the player's power is mounted.  The other five
  seats are headless `Client`s driven by `components/soloBots.tsx`, which never
  render a seat UI, so there is no bot board, no private bot hand and no
  `ie-seat-<power>` element to switch to.
- **No seat switching.**  There is no `SeatStrip`, no `ie-seat-setup` button and
  no keyboard seat shortcut on the solo page.  The player's board also passes
  `allowSeatHandover={false}`, so Rule 34's "hand this seat to the bot" control
  is absent.
- **Restart is guarded.**  `ie-solo-new-game` (label `新游戏` / New game) opens
  a confirmation dialog (`ie-solo-new-game-dialog`) with cancel/confirm.  A
  stray first click only opens the dialog; cancel leaves the match running.
  Confirming returns to `/localIE/solo`, the setup page, instead of silently
  dealing the same power and scenario again, so the power and the scenario are
  chosen anew and the next match is genuinely different.

**Coverage:** `components/localSetup.test.tsx` (the dedicated route and the
setup page's removal of the hotseat link), `components/board.test.tsx` (a board
can opt out of the hand-over control), and the reworked solo tests in
`e2e/imperial-elegy-controls.spec.ts` (one visible seat, no hotseat controls,
and the cancel/confirm new-game flow back to the setup page).

## Fixed: the home-card dialog covered the negotiation table (9.1) (2026-11-22)

Reported as "外交阶段直接弹出必选本土牌了 无法进行谈判 应该谈判完成后再弹出 而且改为可关闭/打开发界面".

The diplomacy phase raised `ie-choice-modal` the instant it opened, as a
**blocker** with no close button.  That covered the very table the 11.0/11.1
negotiation work added, so the negotiation segment 9.1 prints first could not be
played at all.

- `useBoardModel` no longer derives the dialog from `choiceKinds.required`.
  The home choice is `homeChoice` (the seat's own turn in the diplomacy step),
  and the dialog opens only when the reader asks for it, via
  `homeCardDialogOpen`.
- New dock button `ie-open-home-card` (`选择本土牌`) for the seat whose diplomacy
  turn it is, and `ie-deals-home-step` / `ie-open-home-card-from-deals` at the
  end of the negotiation table: finish talking, then choose.
- `CardChoiceModal` takes a `continueLabel`, and the home dialog is now
  `dismissible`: `ie-choice-close` and `ie-choice-continue`
  (`暂时关闭——稍后再选` / "Close for now — choose later") hide it **without
  answering**.  The choice stays owed — `endDiplomacy` still refuses until a card
  is chosen — and the dock button brings the dialog back.
- The dock summary now says `尚未选择本土牌` / "Home card not chosen yet" in the
  diplomacy step (so it never reads as "a dialog is blocking you"), and the hand
  tray's hint says to negotiate first.  The end-step National Goal pick is
  unchanged: it still raises itself and still closes with
  `继续（保留第一张目标）`.

**Coverage:** `components/homeCardChoice.test.tsx` (5 — the dialog is absent on
open, the dock button opens it, closing leaves it owed, the Deals page carries
the same step, only the seat being asked gets the button, and choosing calls
`chooseHomeCard`), plus the reworked board assertions in
`components/board.test.tsx`.  The e2e helpers now open the dialog before
clicking a face (`e2e/imperial-elegy.spec.ts` adds an open → close → reopen
case).  Full IE Jest suite **333 suites / 4378 tests** pass locally.

## Fixed: 12.13.1 Ottoman Industrialization now follows the printed text (2026-11-22)

Checked clause by clause against `IE_rule.pdf` p. 27 §12.13.1, the OT-11 card
face and the playbook's own Ottoman example.  The offer round itself existed;
four clauses did not.

- **"If a player gives OT a mandatory event, the OT player conducts the event."**
  A gifted mandatory event was parked in the industrialization slot and never
  resolved.  It is now resolved with the Ottoman seat as the actor — carrying no
  CP, because the card is industrializing rather than being played for CP.  The
  same gap existed on the generic path, so 12.13's *Important* clause
  ("mandatory events that are played into industrialization still trigger") is
  now honoured by `moves.ts#industrialize` too.
- **"The OT player accepts one of these cards."** The accept step offered an
  `accept:none` escape, which turned a round with offers into the 3 CP fallback.
  The 3 CP now belong only to a round in which *nobody* gave OT a card; a round
  with at least one offer must take one.  (A legacy save still answering
  `accept:none` falls back to the 3 CP instead of stalling the card.)
- **The auto-industrialization chit survives a gift.** The old handler forced
  `autoIndustry = false`, so a failed Ottoman roll was thrown away by accepting
  a card.  12.13 says the auto chit industrializes "if they played a card, of
  any CP value, into industrialization", and the playbook's example is exactly
  that: failed last turn, accepts a 1 CP card, industrializes.
- **A taken industry slot is respected.** A027 Foreign Investment can already
  park a card there; a second chit would overwrite it and the parked card would
  exist in no zone.  The offer round is skipped and the home card is its printed
  3 CP.
- 33.6 Europeanization is visible in the UI: `cardAvailability.industOk` is
  false for every OT card (the move always refused it, so the tray offered a
  guaranteed refusal), with the printed reason on the button.
- The offer/accept prompts carry `promptZh` and `PROMPT_ZH` entries;
  `modernizationAccepted` is a public card argument like `industrializeCard`
  (the card is faceup in the slot), while `modernizationOffered` keeps its card
  masked and exposes only the CP the giver announced.
- The bot's default "first option" answer always passed in the offer round, so
  no bot ever offered and the Ottoman bot never industrialised; it now offers
  its cheapest card (free — it draws a replacement) and accepts the highest CP
  offer.

**Coverage:** `cardEventSettlement.test.ts` (a mandatory gift is conducted, the
accept step has no escape, the auto chit survives, an occupied slot falls back),
`economyIntegration.test.ts` (mandatory event/response industrialization triggers
its event and grants no CP), `components/cardAvailability.test.ts` (OT closure),
`privacy.test.ts` (accepted gift faceup, offered card masked, CP public).

## Fixed: a limited war's steps belong to the seat the rules name (4.4 / 13.2 / 14.3 / 15.0) (2026-11-22)

`declareWar` widens boardgame.io's dispatch to `{all: "play"}` so the defender
can answer 13.7's budget card and 15.5's surrender inside the attacker's move.
That widening was the only check on the war moves: any seat could announce the
war aim, open the maneuver, spend a foreign war budget, pass for a belligerent
or settle the war early — the buttons were merely hidden in `WarPanel`.

- `engine/limitedWar.ts#holdsWarImpulse` is the one answer to 4.4/4.5: the
  impulse belongs to `G.activePower` while the war is in `maneuver`, and a
  belligerent that has passed holds nothing.  `warAllPassed` and
  `canPassWarImpulse` sit beside it, so a hidden button and a refused move
  cannot drift apart.
- `chooseWarAim` (13.2) and `startWarManeuver` (14.3) now require the attacker;
  the defender's own choices in those steps (`playWarBudgetCard`, 8.2's shift,
  13.6's surrender) keep their own seats.
- `passWarMove` refuses outside `maneuver`, refuses a non-holder, and settles
  only at 15.0's all-passed boundary; `resolveWar` no longer offers an unprinted
  "settle now" shortcut.  `resolveWar` reads the passive (`nullctx`) case too,
  so the panel and the direct settlement path agree.
- The bot uses the same helper: it starts the maneuver only as the attacker and
  acts only while it holds the impulse, so a waiting seat stops instead of
  re-sending a refusal.
- A war already recorded as won by a 15.5 surrender has no maneuver left, so
  `passWarMove` routes it to the victory step instead of being refused.

**Also removed the dead rungs:** `WarState.status` declared `shift`,
`initiative` and `demobilization`, and `PENDING_KINDS` declared `warAim`,
`warAlly` and `warInitiative`, but the engine never writes or opens them — the
alliance-shift and initiative rolls happen inside `startWarManeuver`, and
demobilisation is the victory step's tail.  The union now holds only the five
statuses a save can carry, the three pending kinds are gone from `i18n`,
`pendingSafety`, `logText`'s inventory and the bot switch, and the status label
map lists only what a war can be.  The printed ladder in
`components/phaseSteps.ts` still shows all seven steps, because that panel is
the reference for the rulebook, not a readout of `G.war.status`.

**Coverage:** `warAuthority.test.ts` (23 tests) pins each rule above;
`campaignWar.test.ts`, `loneMinorWar.test.ts`, `warFlagCleanup.test.ts` and
`displacementRules.test.ts` now reach 15.0's boundary before settling, as the
printed rule requires.  Full local Jest suite **602 suites / 5997 tests** pass;
TypeScript, the token check and the contrast check pass.

`tools/ie-sim/war.test.ts` (`yarn test` excludes `tools/`, run explicitly)
still reports 12 UK `recruit` refusals for Indian armies in the **action**
phase and the harness's 3-step deadlock fallback.  That signature is
**pre-existing**: stashing this branch and re-running the same suite reproduces
it exactly, and no war move is named.

## Fixed: the bot named another phase's exit (12.0 / 27.1) (2026-11-22)

Re-running `IE_BATCH=24` (144 games, six modes) against the fixed tree confirmed
the earlier locks are gone — **144/144 finish** — and surfaced one dominant
remaining signature: *"bot repeated a rejected decision three times: `pass` in
the Great War"*, 38 seeds.  The bot assembled the action-phase exit (12.0's
`pass`) for a Great War state, where the board offers `gwPass`; the engine
refused it and the driver's repeat guard tripped.

- `bot.ts#actionPhaseExitForPhase` rewrites an exit named against the wrong phase
  into that phase's own (`gwPass` for the GW, `passWarMove` for a limited war),
  and `botDecision` runs it over every decision.
- `moves.ts#pass` now logs the bilingual `passRefused` with its reason (wrong
  phase, or `canPassNow`), so the next sweep names the phase instead of only
  "invalid move".

**Coverage:** `gwRuleGaps.test.ts` (+2 — the three-phase mapping and the logged
wrong-phase refusal) plus `components/logText.test.ts` for the new key.  Full IE
Jest suite **327 suites / 4275 tests** pass locally.  The remaining batch
signatures are the sweep's own staging probes (`amphibiousAssault` with invented
units) and `recruit` refusals the engine is right to make; the games finish and
the harness falls back.

## Fixed: two Great War impulse locks found by a 24-seed batch (2026-11-22)

`IE_BATCH=24` over all six modes (144 games) surfaced two seeds that cannot
leave a Great War impulse.  They are **not** regressions from this work; both
predate it.

### Fixed: a GW-06 response could leave `bonusPending` set forever

`noteGwCard` sets `impulse.bonusPending` when a card is played for its bonus,
and only a **budget**-funded action cleared it.  A GW-06 "They Shall Not Pass"
played inside the post-dice window therefore left the impulse "waiting for a
bonus" the seat had already used, and `gwPass` refused it forever (seed
`IE-BATCH-8-war`: three refused `gwPass` calls, then the harness deadlock).

- `gwImpulse.ts` now also settles `bonusPending`, `cardPlayed` and `acted` when
  an action is funded by the card's bonus (27.2: that action *is* the bonus).
- `gwPass` tolerates exactly that one flag when the impulse's action is already
  played — the seat's printed exit — and logs the bilingual `gwPassRefused`
  with its reason for every other refusal.

### Fixed: an eliminated seat could not wind down its own slot

The same seed's second half: 30.0 eliminates a power the instant its stability
(or capital) falls, and 30.1 turns its initiative position into a bonus marker
for its alliance.  A seat eliminated *while its impulse was open* is still
`G.activePower` and is still asked for the pass that ends it — but
`gwFinishImpulseProblem` now reports it as no belligerent (`notActive`), so
`gwPass` was refused on the only slot that seat could still reach and the
maneuver step could never reach the bonus marker (seed `IE-BATCH-8-war`, which
now finishes in 764 steps by GW turn limit).

- `gwPass` treats the eliminated seat's pass as what 30.0 prints — it has
  nothing left to end — and advances instead of refusing, still logging
  `gwPassRefused` for every other refusal.
- `advanceGwImpulse` starts from the previous slot when the cursor stands on a
  bonus slot of a seat that is no longer a belligerent, so 25.7.1's alliance
  choice is reached instead of the dead seat being asked forever.

**Coverage:** `gwRuleGaps.test.ts` (+1) pins the pass; the decisive evidence is
the seeded sweep, `IE_SEEDS=IE-BATCH-8-war … "tools/ie-sim/war"` →
`steps=764 turn=3 phase=gameOver finished=true reason=gwTurnLimit:stability`.

**Evidence:** full IE Jest suite **327 suites / 4273 tests passed**;
`components/logText.test.ts` covers the new key.  **Seed status:**
`IE-BATCH-8-war` now finishes.  `IE-BATCH-10-amphibious` still reports refused
harness staging probes (`amphibiousAssault` with invented units) that the engine
correctly refuses; the game itself finishes, and the harness falls back, so this
is a sweep-heuristic limitation rather than an engine lock.  Remote verification
is the feature branches' GitHub Actions runs.

## Fixed: an answered Nationalist Wave could lock the table (22.1.4) (2026-11-21)

A seeded self-play sweep found a live-lock, not a rules gap: **IE-SIM-2**'s
campaign stood in turn 4 for 40 000 steps, answering the same
`italianNationalistWave` decision (`piedmont|tuscany`) over and over with no
refusal — and it reproduced on the pre-session engine with identical numbers,
so it was not a regression from this work.

The cause is 22.1.4's interactive path.  The wave grants an Italian minor two
uncontrolled Italian keys and then rolls the unification die; when the roll
fails, `italianUnificationRoll`'s 22.1.4 branch *re-opened the wave*.  By then
the wave's own grants had left fewer than two uncontrolled keys, so the pair
choice offered inside the decision could no longer satisfy its own validation:
every answer was refused, `resolvePending` returned `INVALID_MOVE`, and a
client that re-sends the decision spins forever.

The wave now happens once and always terminates:

- `applyItalianNationalistWave` stamps `flags.italianNationalistWaveApplied`;
- a failed unification roll no longer re-offers the interactive wave;
- answering either stage on an already-applied wave closes the decision
  instead of re-opening it, and a minor answer with fewer than two free keys
  applies the wave to what is left.

**Coverage:** `gwRuleGaps.test.ts` (+2 — the lock itself: a post-wave decision is
answered and closes at every stage, and the wave terminates with 0, 1 or 2 keys
left) and the self-play evidence above: `IE_SEEDS=IE-SIM-2 npx jest
--testPathPatterns "tools/ie-sim/sweep" --runInBand` now reports
`steps=1431 turn=8 phase=end finished=true reason=endOfTurn7`.  `npx tsc
--noEmit` clean; the full IE Jest suite passes locally (**326 suites / 4257
tests**).  Remote verification is the feature branch's GitHub Actions run.

## Fixed: card events bypassed the five-minor-ally cap (4.2.1) (2026-11-21)

4.2.1 prints *"Players can have a maximum of five minor power allies."*  The
12.8 `minorAlliance` move enforced it, and `counterLimits.test.ts` pinned the
move — but the card handlers wrote `SpaceState.ally` directly, so an event
could take a player past the cap:

- `effects.ts#gainMinorAlliance` (Russo-Turkish Wars' Balkan alliance, A097's
  follow-up, the treaty lib eration path) returned **true with six allies**;
- 22.1.1's Italian petition (`allyItalianMinor`, and its diplomatic-recognition
  follow-up) did the same.

Both now go through one guard, `effects.ts#canGainMinorAlly`: a sixth *distinct*
minor is refused with the bilingual `minorAllyCapRefused` log line, re-affirming
an **existing** ally is always allowed (22.1.1 may re-petition one of the five),
and a player's own space is never a minor-ally target.

**Coverage:** `counterLimits.test.ts` (+3 in a new
"4.2.1 — the five-minor-ally limit on the event paths" block: the sixth ally
refused with its log line, the existing ally re-affirmed, and a player's own
space refused) plus the new `minorAllyCapRefused` log key in
`components/logText.test.ts`.  `npx tsc --noEmit` clean; the full IE Jest suite
passes locally (**326 suites / 4255 tests**).  Remote verification is the
feature branch's GitHub Actions run.

## Fixed: the bot never split a neutral's BMPIT spending (34.3) (2026-11-21)

34.3 prints *"Bots will always spend all their CP to influence a single power.
Exception: Neutral bots may split their CP, see below BMPIT on bot PAC."*  The
bot's excess-CP step always named **one** power (the next one in seat order, on
whichever track its TE stood lower), for every bot — so a bot in the neutral box
was forced onto the single-power rule the text exempts it from.

- `bot.ts#neutralBmpitTarget` is 34.3's neutral branch: it picks the least
  influenced column (deterministic, printed column order on ties) and the track
  the split is furthest from, so a neutral bot's CP spread over powers instead of
  pouring into one.
- `excessCp` uses it only while the bot sits in the neutral box; an allied bot
  keeps the printed single-power row.

The rest of 34.2's SoP was checked against the printed text and is already
exact: the prep stability discard at stability ≤ 2, the 34.3.1 unit placement
order, the 34.3.4 always-play card, and the 34.3.3 home-card exception that the
matrix called a "simplification".

**Coverage:** `botNeutralSplit.test.ts` (4 — the deterministic split and its
track, the spread across impulses, the allied single-power row, and the reachable
excess-CP decision), plus the existing bot suites.  `npx tsc --noEmit` clean;
the full IE Jest suite passes locally (**326 suites / 4250 tests**).  Remote
verification is the feature branch's GitHub Actions run.

## Verified: §18–19, §20 and §24–32's remaining bullets (2026-11-21)

Another audit pass with no code change: each bullet on these three rows was
checked against the printed rulebook and against its regression suite.

- **§18–19.**  Every 19.5 naval modifier is live and named — firepower edge,
  stability, the "no friendly ports adjacent: −2" / "≥2 more ports: +1" pair
  (with the footnote that a port battle counts in its adjacent box, and the
  attacker's box choice when a port touches two), reduced-only, failed avoid
  and the GW manpower line — through `navalPortBattleModifiers` and the DRM
  breakdown, pinned by `portBattleDrms.test.ts` and `navalDrmComplete.test.ts`.
  "Interception battles cannot be avoided (19.2)" is 16.3's printed exception
  ("a battle which results from an interception can never be avoided"), and
  the unescorted-transport case is 19.6.1's own wording.
- **§20.**  "20.3 Italy keeps some unplaced counters in the box when the chart
  is full" is the printed ceiling, not a fallback: `italianRebuildPlan` reports
  them in `heldBack`, with the chart-full and no-legal-space cases in
  `italianRebuild.test.ts`.  4.5 prints only "certain actions can be taken once
  per impulse whilst others can be taken once per turn"; the engine models both
  (impulse flags vs `duration: "turn"` flags).
- **§24–32.**  The alliance-selected bonus-impulse order is a real cross-seat
  choice, not a rotation: `gwBonusImpulseChoice.test.ts` drives the live phase
  hook, the move dispatcher, the deciding-seat visibility, pass/pass-through
  semantics and the sole-candidate case.

**Evidence:** `portBattleDrms.test.ts`, `navalDrmComplete.test.ts`,
`italianRebuild.test.ts`, `gwBonusImpulseChoice.test.ts` and the full IE Jest
suite.  No code changed in this pass.

## Fixed: a minor power's GW participation was only an ally marker (25.2.1 / 23.3) (2026-11-21)

25.2.1 prints *"Minor power allies will not join the GW at this time. They will
only join the GW via certain special crisis table results or the Minor Power
Entry GW card"*, and 23.0's `**` note says those results "draw minor powers into
the GW when it starts (otherwise no minor powers enter the war when it starts
regardless of who is their current ally)".  The engine stored GW participation
as `SpaceState.ally` alone, so a **leftover pre-GW ally marker** was
indistinguishable from a **minor drawn into the GW** — the very distinction the
rule is about.

- `greatWar.ts#markMinorGwBelligerent` stamps the minor's home space in the
  public `G.flags.gwMinorBelligerents`; `gwMinorBelligerents(G)` reads it back.
- Every drawing path goes through it: the bordering-nation `**` result, every
  Balkan Table draw, the threatened and threatening Balkan states (all via
  `setMinorAlly`), and GW-01's successful "joins on a 5+" roll.
- A minor allied in an earlier limited war keeps its ally marker and is **not**
  listed as a GW belligerent.

**Coverage:** `gwMinorBelligerents.test.ts` (4 — the leftover limited-war marker,
the `**` draw and its idempotence, the JSON-save round trip plus a legacy save
without the field, and the player-seat check), plus the existing crisis/GW
suites.  `npx tsc --noEmit` clean; the full IE Jest suite passes locally
(**325 suites / 4246 tests**).  Remote verification is the feature branch's
GitHub Actions run.

**Remaining on this row:** A100's two printed increases are already covered by
`balkanWarsSequence.test.ts` (independence before the second increase,
conference, outbreak suppression, award suspension); the `**` crisis rows stay
reachable only when a handler raises the WTT, which is 23.0's printed trigger.

## Verified: §1–4's counter chart and the §7.1.1 stability table (2026-11-21)

An audit pass, not a code change.  Two `Partial` rows named specific data
claims that could be settled directly against the printed sources.

- **§4.2's `counter-count` chart.**  The published
  `charts/counter-count.png` was read row by row against
  `engine/counters.ts#PLAYER_COUNTER_CHART` / `NON_PLAYER_COUNTER_CHART`:
  the six player rows (5/5/5/5/5/4 standing, 11/0/9/9/11/1 reserve, the UK's
  5 special standing and the OT 2+2 Arab armies, 79/68/26/26 totals), every
  "Special" counter, and all 24 non-player rows (Italy … Boxers) match the
  transcription exactly, including the Sar-Pied control-marker flip-side note.
  The six rows the chart does not print stay `null` by design.  §4.2.1's
  five-minor-ally cap is pinned by `counterLimits.test.ts` and
  `foreignAffairs.test.ts`.
- **§1–4's "cannot be played by" clauses.**  A search of all 122 card faces
  prints no per-power playability clause; the only printed power windows
  (A041 GE, A054 OT, A098 FR) are gated by `PRINTED_RESPONSE_POWERS` in
  `moves.ts`.  §5.5.3's overstacking ("the stack suffers one step loss total,
  not every unit ... FP limited to the space's stacking limit") is fully
  modelled by `impulsePenalties`.
- **§7.1.1's stability table.**  Every printed cause is live:
  a WoI independence −1 and a major defeat −1 / major victory +1
  (`applyWoiIndependence`, `classifyVictory`'s `{winner: 1, loser: -1}`),
  a conquest declaration −X on the post-increase WTT
  (`conquestDeclarationPenalty`), and a dreadnought lost in battle −1.
- **§33's port-formula discrepancy was reconciled, not left open.**
  `computePowerProjection` yields FR 3 and RU 3, matching the v1.1 playbook's
  display line.  France's third point is the printed naval-base station at Algeria
  (the map model marks it as a base inside the ordinary Western Mediterranean
  port space), so the campaign setup and rule 3.3.1 agree.  `CAMPAIGN_SETUP` stores the formula's FR 3, and
  `powerProjection.test.ts` pins the formula over every printed power; RU stays
  level with FR instead of dominating the track alone.

**Evidence:** `counterLimits.test.ts`, `foreignAffairs.test.ts`,
`powerProjection.test.ts`, `supplyRule5_6.test.ts` and the full IE Jest suite
are the existing coverage; nothing in this pass changed code, so the last green
remote run remains the reported verification.

## Fixed: 18.6.3's EF loss coupling only ran on elimination (2026-11-21)

Continuing the §5 residual audit, the printed loss coupling was the next
unwired item.  The rulebook prints four clauses around one idea:

- 5.3.2 / 18.6.3(1) *"A force comprised exclusively of EFs cannot eliminate
  non-rebel armies (full strength armies can still suffer losses)"*;
- 18.6.3(2) *"A force comprised of EFs and armies cannot take losses on the
  EFs"*;
- 18.6.3(3) *"When a force comprised of EFs and armies takes a step loss on an
  army they must also eliminate an EF"*;
- and 18.6.3's exception *"Elite colonial EFs (and the Zouaves) are not subject
  to the third bullet point. Instead, in such cases, they are treated as ECs for
  the purposes of elimination."*

Three defects were live:

- **(3) only fired on elimination.**  The EF side-effect lived inside
  `applyOneLoss` and ran only when `!G.units[target.id]`, so a mixed force whose
  army merely went full → reduced kept its EF.  The coupling is now answered for
  the whole loss group (`combat.ts#eliminateCoupledEfs`, from `applyLosses` and
  `chooseLoss`), recorded on the battle, listed among its casualties, and
  carried into the public `BattleReport.efCouplings`; the per-unit fallback is
  kept so a chosen loss still pays it.
- **(1) was bypassed.**  An all-EF side's step loss eliminated a full-strength
  army outright, the very thing the bullet forbids.  Such a step is now taken —
  the army is reduced — but it never removes the army (`applyOneLoss`'s
  `skipElimination`, decided by `isEfOnlyForce`).
- **(2) could not be observed.**  `lossCandidates` drops EFs from a mixed force,
  and the new coupling is the only way an EF leaves; the exception keeps 5.1.5's
  elite colonial EF and 5.1.6's Zouave with their army, so an EC-bearing force
  does not print the plain EF coupling.

5.1.2 was also re-read against the printed page: it lists only three
differences from a standing army (the peacetime holding box, wartime-only
deployment and the demobilisation return) and says reserve armies "function
identically to standing armies", so the matrix's earlier "must end a move with a
standing army" note was not printed.  It is retired rather than implemented.

**Coverage:** `efLossCoupling.test.ts` (9 — the mixed-force coupling, a
full→reduced army still costing its EF, the Zouave/elite-EF exception, an
EC-only force, the attacker's own coupling, a defender whose EF survives an
attacker loss, an EF-only force that reduces but cannot eliminate, and its second
step) plus the new bilingual `efLossCoupling` log key in
`components/logText.test.ts`.  `npx tsc --noEmit` clean; the full IE Jest suite
passes locally (**324 suites / 4242 tests**).  Remote verification is the
feature branch's GitHub Actions run.

## Fixed: 5.1.3–5.1.6's lone EC / elite colonial EF / Zouave was never eliminated (2026-11-21)

Continuing the residual-rule audit for §5, the "alone in a space" clauses were
the next unwired item:

- **5.1.3 ECs** print *"They can move on their own but must always begin and end
  their movement stacked with (attached to) an army. … If an EC is ever alone in
  a space at the end of a combat or at the end of a movement, it is eliminated."*
  5.1.5's elite colonial EFs and 5.1.6's Zouaves carry the same clause.  Nothing
  removed such a counter: an EC whose army died in the battle it fought, or
  whose army was redeployed out from under it, stayed on the board forever.

What is live now:

- `rules.ts#eliminateAloneEliteUnits` is the single sweep: an EC, elite colonial
  EF or Zouave with no land army of its own owner in its space is eliminated
  (logged as the bilingual `aloneEliteEliminated`).
- It runs where the printed moments are observable: at the end of a battle
  (`combat.ts#finishBattle`, claim-based — only a counter *that* battle
  stranded, so an unrelated battle never destroys a counter a draft or an event
  placed alone), and at the impulse boundary (`beginImpulseUpkeep`), the end of
  the movement whatever move produced the split (redeploy, march, rail, naval
  transport, 5.7 displacement, event placement).
- **The printed positions are not swept.**  The campaign setup's own lone
  counters (the FR Zouave in Algeria, the UK elite colonial EF at Suez) and A78's
  placement are stamped `SETUP_PLACEMENT_FLAG` with their start turn and are
  exempt until an impulse of a later turn has passed.
- 5.1.4's ordinary EFs and 5.1.2's reserve armies print the weaker "must end a
  move with a standing army" form, so they are deliberately not swept.

**Coverage:** `aloneEliteElimination.test.ts` (8 — all three counter kinds, a
stacked counter that stays, a foreign army not sheltering it plus idempotence,
EFs/reserve armies untouched, the printed setup exemption, the impulse sweep, a
live `redeploy` split and a battle that eliminates the covering army), plus
`components/logText.test.ts`
covering the new log key.  `npx tsc --noEmit` clean; the full IE Jest suite
passes locally (**323 suites / 4230 tests**).  Remote verification is the feature
branch's GitHub Actions run.

## Fixed: 5.6 supply accepted any held home territory, and 5.6.3 was not immediate (2026-11-21)

Continuing the residual-rule audit for §5.6 / LoC and the §13–17 war
settlement, two shared-engine defects were live:

- **5.6 printed a controlled home *key* as the source.**  `isSupplySource`
  already required one, but its trace ran through `locFriendlySpace`, and the
  peacetime branch of that helper accepted any space the power merely *held*
  (`control === power`), home territory included.  A player could therefore
  draw supply from an ordinary home space, or from a wartime ally's home
  territory with no ally home key on the route.  The `5.6.1` allied-minor
  exception ("home spaces of minor powers allied to your major power allies")
  was also absent from the peacetime source list.
- **5.6.3 printed "immediately displace".**  `displacePeacetimeBrokenLoc` only
  ran inside `beginImpulseUpkeep`, so an army stranded by a card event or a
  treaty waited until its owner's next impulse.

What is live now:

- `isSupplySource` requires the acting power's own controlled **home key** and
  admits a wartime second source that is an allied minor's home key
  (`alliedMinorController`, keyed by the literal `ally` marker).
- New exported `rules.ts#repairBrokenLinesOfCommunication` re-checks every
  peacetime army and displaces it through the existing 5.7 destination helper.
  It runs after every resolved pending decision (`resolvePending`), at
  `startWarManeuver`, and the impulse boundary keeps calling it as the fallback
  for older saves.
- **17.1 / 29.1 follow-up:** `blockade.ts#tsrrConnectionUsable` (and
  `blockadeTrace`'s own `usesRuPacific`) used the 8.x `allied()` question, so a
  *neutral* RU sharing an alliance-track box with a belligerent silently cut
  that alliance's ordinary Pacific sea route.  Both now read the running war's
  side rosters (`ruWarAlly`), per 4.9.4.

**Coverage:** `supplyRule5_6.test.ts` (7 — a held foreign key, an occupied
foreign home territory, a peacetime ally corridor, an ally home key that only
counts once the war starts, the immediate repair helper, the impulse-boundary
fallback, and a resolved event leaving an in-supply army in place) and
`blockadeNeutralRu.test.ts` (3 — neutral RU vs a real RU war ally vs the
peacetime question).  `npx tsc --noEmit` clean; the supply/LoC, blockade,
displacement, foreign-affairs, demobilisation, treaty and Great-War suites
pass locally (15 suites / 180 tests targeted).  Remote verification is the
feature branch's GitHub Actions run.

## Closed: every printed card now has a direct or handler regression (2026-11-21)

The per-card inventory had five zero-signal cards left.  Added direct assertions
for them in `uncoveredPrintCards.test.ts`:

- A42 The Ruhr raises German industry by one and does not occupy the
  industrialisation slot;
- A50 Reforms of the 1860s covers all three die bands (1–2, 3–4, 5–6);
- A90 The Eiffel Tower adds one City of Light point and stops at the printed
  maximum of 6;
- H-OT-12 Jihad grants two markers and its declaration entitlement without a
  WTT/stability penalty;
- H-RU-9 Russo-Turkish Wars turns a Balkan diplomacy marker into an alliance and
  leaves the OT declaration entitlement.

The same pass found a stale-cache issue on the alliance path: both the
`minorAlliance` move and `gainMinorAlliance` (used by H-RU-9 and other events)
wrote the ally marker without recomputing the tracks, so 3.3.1's allied-minor
naval units did not reach Power Projection until a later recompute.  Both paths
now call `recomputeTracks` immediately.

**Coverage:** `uncoveredPrintCards.test.ts` (5) plus the existing card/board
suites.  `npx tsc --noEmit` clean.

## Added: the defender can play one card into its war budget (13.7) (2026-11-21)

13.7 prints *"At this point the defender may play a card to add CP to their war
budget [14.3].  Important: the defending player cannot play a mandatory event to
add to their war budget."*  `createWarState` always gave a player defender a
budget of 0 and the only card-CP path was the attacker's declaration card, so
the defending seat had no way to use the printed allowance.

- New move `playWarBudgetCard(cardId)`: available to a defending power (the
  primary or a defending ally) while the war is still in its war-aim / alliance
  / shift steps; one card per defending power; mandatory events refused; the
  card is discarded and its printed CP is added to `war.budgets`.
- `WarState.defenderBudgetCards` records the card, and the move logs
  `warBudgetCard`.
- The War panel shows one button per eligible defending hand card while the
  allowance is unused; declaring war widens move dispatch to all seats so the
  defending seat can act, while every other move still checks `G.activePower`.

**Coverage:** `defenderWarBudget.test.ts` (3 — the budget increase and discard,
the attacker's refusal, and the mandatory-event refusal).  `npx tsc --noEmit`
clean; the war, board, card-state and log suites pass.

## Fixed: Aux Armes left French Intervention and Papal Influence in the discard (2026-11-21)

H-FR-6 prints *"Take either French Intervention or Papal Influence from the
discard pile; you may play it immediately."*  The handler only added two reserve
steps and the war-declaration entitlement; both events stayed in the discard.

The event now:

- offers every one of the two cards that is actually in the discard pile and
  moves the chosen one into the French hand (the take is mandatory when one is
  present);
- records `auxArmesFreePlay` for that exact card.  `playCard` recognises it once
  and ignores 12.0's one-card-per-impulse limit for that card, so "you may play
  it immediately" is real; the marker is cleared when it is used or when the
  impulse passes;
- leaves the normal discard/removal flow intact for the played event, and logs
  `cardTaken` when the card leaves the discard.

**Coverage:** `auxArmes.test.ts` (3 — the two-card choice, the immediate play
of French Intervention, and the no-card case).  `npx tsc --noEmit` clean; the
card-choice, board and one-card-per-impulse suites pass.
## Added: the unit-move console is also in the War tab (2026-11-21)

Reported as "帝国挽歌的单位移动ui 在战局标签里面也放一份 战争时不用来回切换".
Declaring a war parks the turn panel on the War tab, but every march, rail,
naval move and battle lived only on the Orders page, so a wartime player had to
switch tabs between the war situation and the units doing the fighting.

- **One console, printed twice.**  New `components/MoveConsole.tsx` mounts the
  Orders page's own two controls — the unit picker and the space's action rows —
  a second time inside the War tab, restricted to the player aid's "Move &
  battle" group (`isMovementRow`).  Nothing is re-implemented: it calls the same
  `useSpaceActions` hook and renders the same `SpaceActionsPanel`, so labels,
  costs, engine legality gates and the printed refusal reasons cannot drift
  between the two copies.
- **Both mounted copies stay addressable.**  The turn panel only hides inactive
  bodies, so both copies are in the DOM at once.  `SpaceUnitPicker` and
  `SpaceActionsPanel` take a `testIdPrefix` (`ie-` by default); the War copy
  passes `ie-war-`, giving `ie-war-unit-<id>`, `ie-war-action-move`,
  `ie-war-march`, … while the Orders page keeps `ie-unit-<id>`,
  `ie-action-move`.  The e2e and control suites that address the Orders ids are
  unchanged.
- **It drives the board's one selection.**  Picking a unit in the War tab rings
  the same legal destinations on the map and shows the same unit pressed on the
  Orders page; a half-made selection and the bots' effects survive a tab switch.
- **It leads the war report** and appears once a limited war or the Great War
  runs (a declaration form has no units to move), never for a spectator.  With
  no space picked it prints a one-line "pick a space, then a unit" hint instead
  of an empty list, and a refused row keeps its printed reason rather than
  disappearing.

**Coverage:** `components/moveConsole.test.tsx` (12 — movement-only filter,
prefixed ids vs the Orders copy, empty selection hint, locale space label,
selection echo, controlled-minor command in the GW, printed reasons at zero CP,
no duplicated Orders head, engine-derived battle row) plus the new e2e case in
`imperial-elegy-controls.spec.ts`: after a declaration the console is visible in
the War body, lists Berlin's army under `ie-war-unit-…`, arms the map rings on
click while the Orders copy shows it pressed, and offers the movement row
without the recruitment rows.

## Added: every battle dice modifier now names its printed source (2026-11-21)

Reported as "帝国挽歌战斗进行中和展示结果时 详细展示每个dice modifier的来源".
The live battle panel printed only `DRM 3/-1` and the result dialog only
`+3 / -1`, so a table could not tell a stability penalty from a card, a broken
LoC, the committed elite bonus or the force-point edge.

What is live now:

- **The engine records each clause.**  New `engine/battleDrm.ts` owns
  `recordBattleDrm`: every site that used to write `attackerDrm`/`defenderDrm`
  directly now records the clause's key, side, signed value and detail
  (`types.ts#BattleDrmSource`).  Covered sites: 18.2.1's amphibious, stability,
  exhausted-manpower, reduced-only, difficult-terrain and broken-LoC lines,
  national characteristics (1st Army, Indian armies, Zouaves, Bewegungskrieg,
  Prussian Military Tradition, Dreyfus Affair), the `warLandDrm`/`combatDrm`/
  `enemyLandDrm`/`gwCombatDrm` event flags, 19.5's port-count and failed-avoid
  lines, combat cards (`combatCards.ts`), and 33.6 Jihad.
- **Derived entries are computed, not stored twice.**  The committed elite
  bonus and the force-point edge depend on the live main forces and support, so
  `combat.ts#battleDrmBreakdown` derives them on read; A080 Machine Guns is
  listed at 0 because it changes a die rather than a total.
- **The dice freeze a snapshot.**  `rollBattleDice` stores `drmBreakdown`, so a
  running loss sequence or the finished report still explains the roll it
  actually scored.  A late modifier (a 19.5 failed avoid, 33.6 Jihad) re-freezes
  it through `refreshBattleDrmSnapshot`, and A062's denied support refreshes
  the totals and the list together.
- **Both surfaces render the list.**  New `components/BattleDrmList.tsx` prints
  one row per clause with its signed value and a total header.  The live battle
  panel (`PendingPanel`) shows it for both sides while the battle runs; the
  result dialog (`BattleResultModal`) shows the same two columns under the
  rolls, from `BattleReport.drmSources`.  A saved report or a hand-written state
  with no breakdown still prints both totals.

**Coverage:** `battleDrmBreakdown.test.ts` (10 — the entries add up to each
side's total on land and at sea, per-clause signed values, the reduced-only and
force-point lines, the post-roll snapshot in the report, public visibility to
both seats, the GW manpower line and the late-modifier refresh),
`components/battleResultModal.test.tsx` (2 new — the named list renders, and a
report without a breakdown still prints both totals) and
`components/boardActions.test.tsx` (1 new — the live panel shows both DRM
columns).  `npx tsc --noEmit` clean; the battle, card, characteristic, save and
bot suites pass locally.
## Fixed: German General Staff always took the first discard card and had no EC option (2026-11-21)

H-GE-2 prints *"Take any response or combat card from the discard pile; it cannot
be played this impulse. OR gain 1 stability and two elite corps."*  The handler
took the first response/combat card it found and never offered the elite-corps
branch; with no eligible discard card it still resolved silently.

The card now opens the printed OR:

- **Take a card** — a second choice lists every response/combat card in the
  discard pile and puts the chosen one into the German hand.  The event ends the
  impulse, so the printed "cannot be played this impulse" restriction holds.
- **Elite corps** — two ECs are placed with one of Germany's armies in its
  current space (5.1.3 requires an EC to stack with an army), respecting the
  counter pool; the placement logs `eliteCorpsGained`.

With no eligible discard card the EC branch resolves directly.

**Coverage:** `germanGeneralStaff.test.ts` (3 — the OR, choosing the discard
card, and the two-EC branch).  `npx tsc --noEmit` clean.

## Fixed: Sepoy Mutiny left the key penalty until the next end phase (2026-11-21)

A33 places a Sepoy rebel army in India, and 21.1 says the rebel-held space
cannot be controlled and the UK loses India's keys *until the Sepoys are
eliminated*.  The handler placed the rebellion but did not call
`recomputeTracks`, which is not automatic; the double colonial key (and the
India card bonus) stayed on the UK display until some later move happened to
recompute the tracks.

The handler now recomputes immediately after placing the rebel, so the key loss
and the loss of the India card bonus are visible at once.  Eliminating the
Sepoy still clears the 0 WoI marker and restores the keys through the 21.0
`removeUnit` path.

**Coverage:** `sepoyMutiny.test.ts` (2 — immediate key/card-bonus loss with the
marker cleanup, and a second rebel keeping the WoI alive).  `npx tsc --noEmit`
clean; the India/rebel/characteristics suites pass.

## Fixed: rebels did not reduce keys, and a cleared rebellion never ended (2026-11-21)

21.1 prints *"While a space contains rebel units it cannot be controlled. When
rebel armies are placed, decrease the controlling player's keys by the
appropriate amount … until the rebels are eliminated."*  21.0 adds *"If a rebel
army under a WoI marker is ever eliminated, the WoI marker is also removed, and
the player regains control of the space."*  Neither clause was live:

- `recomputeTracks` counted a rebel-held space's key normally; only flashpoint
  domination skipped it.  The Sepoy Mutiny therefore did not take India's
  double colonial key (or its card) away.
- `removeUnit` deleted the rebel counter but left its id in
  `SpaceState.rebellion.rebels` and left the WoI marker in place, so
  `recomputeTracks`/flashpoints kept treating the space as in rebellion forever.

`recomputeTracks` now skips a space whose actual unit list contains a rebel army
(so a stale id cannot suppress a key either), and `removeUnit` drops the rebel
from the rebellion record and clears the WoI marker once no rebel army remains.
The control marker itself is left in place, which matches the engine's
representation of the previous controller; key counting resumes immediately.

**Coverage:** `rebelElimination.test.ts` (2 — the last rebel removes the marker
and restores India's key, and a second rebel keeps the WoI alive).  `npx tsc
--noEmit` clean; the India/GW-rebel/end-phase/nationality suites pass.

## Fixed: Liberal Reforms' CP still built minor-ally armies (2026-11-21)

A16 prints *"The CP from this card cannot be used to build new armies."*  The
own-power gate (`characteristics.ts#recruitmentLimits`) enforced
`noBuildArmiesThisImpulse`, but the 12.2/12.4 minor-ally path
(`minorBuildDecision`) never read it.  A GE player could therefore play Liberal
Reforms and spend its CP on a Bavarian or Serbian army.

`minorBuildDecision` now refuses a `minorArmy` build when the controlling
power's `noBuildArmiesThisImpulse` flag is set, with the printed reason.  Naval
construction and other non-army builds are untouched.

**Coverage:** `liberalReforms.test.ts` (2 — the own-army refusal and the
minor-ally refusal).  `npx tsc --noEmit` clean; the recruitment and
characteristics suites pass.

## Fixed: a fourth National Goal was kept, and A22 returned the oldest automatically (2026-11-21)

2.4 and 20.11 print *"if a player has more than 3 NG cards, they choose one and
return it to their NG deck."*  A22 New Administration repeats the clause.

- The end-phase `chooseGoal` pushed the kept Goal and never returned one, so a
  player could end a turn holding four Goals and score them all.
- A22 did check the fourth Goal, but removed `p.goals.shift()` — the oldest —
  without asking the player.

Both paths now open a `goalChoice` decision with `mode: "return"` and one option
per held Goal.  The chosen Goal goes back to its deck and logs `goalRemoved`;
the card/end phase then continues.  `endPhaseTurn` still refuses to close while
the return decision is open.

**Coverage:** `ngLimit.test.ts` (2 — A22's draw→return chain and the end-phase
draw→return chain).  `npx tsc --noEmit` clean; the end-phase, card-defect and
board suites pass.

## Fixed: Colonial Conflict accepted minor-controlled and already-marked spaces (2026-11-21)

A13/A14 print *"Choose a space in Asia, Africa, or North America that is
controlled by a player but is not a home space belonging to that player … As
each space can only contain a single pacification marker it is possible that
there are no eligible spaces."*  The handler only checked `control !== null` and
`home !== control`:

- a **minor-controlled** space (Egypt, Persia, …) was offered even though the
  card names a player-controlled space;
- a space that **already had a pacification marker** was offered, and the naval
  base branch then added 2 on top of the existing marker instead of treating the
  space as ineligible.

The filter now requires `isPower(control)`, excludes the controller's home space
and excludes `hasPacificationMarker` (so a 0-value marker counts).  With no legal
space the mandatory event resolves with no effect, as printed.

**Coverage:** `colonialConflict.test.ts` (3 — minor/marked exclusion, A14's
shared eligibility and the naval-base 2 marker).  `npx tsc --noEmit` clean.

## Fixed: the CP Chain started a card-less impulse and funded several actions (2026-11-21)

12.14 prints *"Players may spend the CP in their CP Chain when they play a card
for CP on a future impulse"*, and the errata clarifies that the two-card limit
*"does not include the card played to expend CP in the chain"*.  The old
`useCpChain()` ignored both clauses: it required no card, set `cpRemaining` to
the chain total alone, and left the ordinary CP payer free to spend that budget
on several actions in the same impulse.

- `useCpChain(cardId)` now requires a non-mandatory, non-home card in hand, plays
  it through the canonical CP path (so A70/A79 removal and the discard pile stay
  correct), and adds the chain's spendable CP to that card's CP.  The combined
  single action is capped at 4 CP.
- `spendCpFor` and `requireColonialCp` reject a second CP-funded action while
  `cpChainActive` is set and record the first one with `cpChainActionUsed`.  The
  marker is cleared when the impulse passes; `cpChainSpent` still prevents a
  second chain use in the same action phase.
- `cpChain` also refuses a card id already in the chain, so one physical card
  cannot be chained twice.
- The hand tray now selects the funding card (`ie-cp-chain-card`) before the
  “Use CP chain” button; with no eligible card the button and its printed reason
  explain why.

**Coverage:** `cpChainRules.test.ts` (5 — card requirement, card + chain totals,
single-action enforcement, mandatory/home refusal, impulse hand-over) and the
updated `economyIntegration.test.ts` CP-chain fixtures.  `npx tsc --noEmit`
clean.

## Fixed: a 0-value pacification marker was invisible to key counting (2026-11-21)

12.11 prints *"When a land unit is placed in (or moved to) an uncontrolled
space, a 0 pacification marker is also placed"*, and 12.11.2 prints the same
0-value marker for Colonial Conflict and Boer Wars.  `SpaceState` stores the
marker as a number and every space starts at `pacification: 0`, so the engine
could not tell "no marker" from "0 marker".  Two consequences were live:

- `recomputeTracks` only docked a controlled space's key when
  `pacification > 0`, so a freshly played Colonial Conflict / Boer Wars marker
  (value 0) had no effect until a failed roll raised it.
- After 12.11.2 allowed a controller to clear its own controlled-space marker,
  the Orders panel offered a "Pacify" row on every controlled space with a land
  unit, even where no marker existed.

`SpaceState.pacificationMarker` now records the marker itself, separate from its
value.  `hasPacificationMarker` is the single presence predicate used by
`recomputeTracks`, the marker lifecycle, the move gate and the Orders panel.
`pacificationProblem` gains `no-marker` for a controlled space with nothing to
clear; success removes the flag, failure/entry sets it.  Legacy saves that only
have a positive value still read as marked, and the 0-marker key penalty is now
live.

**Coverage:** `pacificationSpecialMarkers.test.ts` (7 — the controller-only
clear, the no-marker refusal, the 0-marker key penalty, the foreign-controller
refusal, A86's 0 marker, the 11+ Boer roll and the 12+ GoE roll).  `npx tsc
-—noEmit` clean; the 12-suite pacification/end-phase/card sweep and the
6000-state card sweep pass.

## Fixed: 12.11.2's controlled-space markers and special pacification targets (2026-11-21)

Found in the hotseat rules audit.  12.11.2 prints two clauses the live gate did
not implement:

- **A marker in a player-controlled space.**  *"When a pacification marker is
  placed in a player-controlled space it represents local tribes and/or kingdoms
  rebelling against colonial rule … the space must be pacified in order to count
  as a controlled space for all other purposes."*  A13/A14 Colonial Conflict and
  A86 Boer Wars place exactly such a marker, but `pacificationProblem` required
  the acting power's **influence** marker.  A controller has control, not
  influence, so the marker could never be removed (and `recomputeTracks` kept
  docking its key).  The gate now accepts the controller of a controlled space;
  success clears the marker and leaves control unchanged, and any other power is
  refused as `not-controller`.
- **The GoE and Boer counters.**  *"These events increase the difficulty of
  pacifying certain spaces … Remove the counter once the space is pacified."*
  A31 wrote `persistent.goe`, but nothing read it, and A86 added **+2** to the
  ordinary marker (making the Boers easier) instead of placing the special
  counter.  `pacificationTarget` now returns 12 for Graveyard of Empires
  (Afghanistan) and 11 for the Boers (South Africa), and a successful roll
  removes the counter.  A86 places the marker at 0 and logs `boerWars`.

**Coverage:** `pacificationSpecialMarkers.test.ts` (5 — controller-only clearing,
the foreign-controller refusal, A86's 0 marker, the 11+ Boer roll with the
failed retry, and the 12+ GoE roll) plus the updated
`pacificationAndDecline.test.ts` fixtures.  `npx tsc --noEmit` clean.

## Fixed: A97 Diplomatic Recognition skipped the independence sequence (2026-11-21)

Found in the same hotseat rules audit.  A97 prints *"Flip a 0 WoI marker to its
+1 side.  A space with a +1 WoI marker immediately gains independence."*  The
handler instead searched the map for the **first** 0 marker, flipped it, wrote
the minor's control marker and deleted the rebellion.  It never let the active
player choose which marker to flip, and it skipped the two clauses 20.8 attaches
to independence: *"all units, except those belonging to the newly independent
minor power, are immediately displaced [5.7], and the player who lost the space
decreases their stability by 1."*

`engine/effects.ts#applyWoiIndependence` is now the shared 20.8 sequence; both
the end-phase step (`moves.ts#endPhaseProgressWarsOfIndependence`) and A97 call
it.  A97 opens one `eventTargetSpace` option per 0 marker, and the chosen space
displaces non-minor units, applies the controller's −1 stability, hands control
to the new minor and logs `woiIndependence`.  With no 0 marker the card has no
effect and logs `noLegalTarget`.

**Coverage:** `diplomaticRecognition.test.ts` (3 — every 0 marker offered,
the chosen space's displacement/stability/control, and the no-marker case).
`npx tsc --noEmit` clean; the end-phase, card-defect and hotseat-audit suites
pass.

## Fixed: A25 Divide and Conquer and A37 The Great Game settled the wrong spaces and never rolled (2026-11-21)

Found during the local-hotseat rules audit and reproduced through the real
`playCard` / `resolvePending` path; the same audit ran a local `/localIE`
session to check the live board.  These are card-text/rules inconsistencies,
not display bugs: the cards were resolving to a deterministic default that the
printed text does not allow.

### A25 Divide and Conquer

The printed card offers three things: *"Add two to the pacification value in a
space. Roll to pacify that space. OR eliminate a rebel army in a space you
control or influence, then you may place an EF in (or move an existing EF to)
the chosen space and immediately make a pacification attempt."*  The errata adds
the Special: *"this card can eliminate the Egyptian army if Egypt is an
independent minor power, and the active player has a diplomacy marker in Egypt.
If this occurs all Egyptian spaces immediately revert to OT control."*

The handler only opened a two-way "pacify / rebel" choice, then:

- added 2 to the **first legal pacification space on the board** instead of the
  chosen one, and never rolled (so the marker was left at +2);
- removed the **first rebel army anywhere on the map**, with no control /
  influence check, no EF placement or movement, and no pacification attempt;
- had no Egyptian branch at all;
- transcribed the Special as "influence in Egypt" instead of the errata's
  "diplomacy marker in Egypt".

The card now presents every legal target as a `pacify:<space>`,
`rebel:<space>` or `egypt` option.  The pacify branch adds 2 and runs the shared
12.11 two-dice `attemptPacification`; the rebel branch removes the chosen rebel,
then offers *place a new EF / move an existing EF / no EF*, and rolls
pacification in the chosen space; the Egyptian branch removes the Egyptian
armies and returns Egypt, the Great Sand Sea and Sinai to Ottoman control.

### A37 The Great Game

The errata prints *"Place an influence marker and an EF in either Persia,
Kuwait, Balochistan, Central Asia, or Afghanistan. If you already have an
influence marker, just place the EF. You must follow normal placement
restrictions. Then immediately make a pacification roll in the chosen space."*

The old handler offered all five spaces even when another power already held
the influence marker or the space was controlled, overwrote that marker, and
added a flat +1 to the pacification marker instead of rolling.  It now filters
the five spaces through the same influence/EF placement gates the live moves
use and runs `attemptPacification`, so a high roll can actually take control.

**Coverage:** `divideAndConquer.test.ts` (7 — the A25 space choice, the +2 before
the roll, success and failure, the rebel/EF choice, both Egyptian cases, A37's
real roll and the foreign-influence filter) and the updated
`cardTargets.test.ts` A37 case.  Also exercised the local `/localIE` hotseat in a
headless browser: six seats finished prep, chose home cards, answered the
Metternich follow-up and played a GE CP card (state `phase:"action"`,
`active:"GE"`, 3 CP, 19 log entries) without a console error.  `npx tsc --noEmit`
clean; the IE card-state sweep (`tools/ie-sim/cardStates`, 6000 runs) passed with
0 refusals and 0 failures.

## Fixed: six printed rules found by playing a local hotseat campaign (2026-11-21)

Found by actually playing `/localIE` and reading the state back.  Six clauses
were not enforced; every one below was reproduced against the real moves before
being fixed, and each now has a regression test in
[`hotseatRuleAudit.test.ts`](../../src/imperialElegy/hotseatRuleAudit.test.ts).

### 12.11 — a failed pacification could never be retried

The once-per-attempt guard was a `pacified_<space>` flag on the acting power,
and nothing ever cleared it.  One bad roll therefore locked that space for the
rest of the match, although 12.11 prints "Pacification actions can only be taken
once per space, per impulse; meaning if the attempt fails you must wait until a
future impulse to roll again in that space."

The limit is now impulse-scoped (`pacifiedThisImpulse:<space>`), cleared by
`clearPacificationImpulse` when the impulse passes, and the old permanent flag
is dropped on load so an existing match is unlocked too.

### 12.11 — pacification required no land unit

"Players must have a land unit in a space to pacify it" was never checked: the
move only looked at the influence marker, so a seat could pacify a space its
armies had never reached.  The new shared gate in `engine/pacification.ts`
(refused as `no-land-unit`) now requires one of the acting power's own armies.

### 12.12.1 — a rebel army did not block the roll

"If a rebel army occupies a space with a pacification marker, it must first be
eliminated in a land battle before a pacification roll can be attempted."  A
rebel now blocks the action (`rebel-present`).  A65's *rebel* branch is a
different printed thing ("OR play as a normal event to flip a rebel army from
reduced to full strength"), so it is a separate path that makes no roll and is
not gated by 12.12.1.

### 12.11 — the marker lifecycle never ran

Both halves were missing: "When a land unit is placed in (or moved to) an
uncontrolled space, a 0 pacification marker is also placed … Exception: if the
space is a naval base, place a 2 pacification marker instead" and "If all a
player's units leave an uncontrolled space with a pacification marker, remove
the pacification marker."

`rules.ts#reconcilePacificationMarkers` runs in the impulse-upkeep pass, so every
movement path (redeploy, march, rail, naval transport, event placement, combat
advance) is covered once.  Controlled spaces are untouched — their markers are
12.11's event markers with a different lifecycle.

### 12.12 — a fort destroyed by 20.2 could never be rebuilt

`buildFort` set a `fort_<space>` flag that nothing cleared, and refused any
space carrying it.  A level 1 fort is removed by 20.2's decay, so the space was
permanently barred from a new fort.  12.12 prints no once-per-game limit; the
printed limits are the CP, the placement rule, one fort per space and three per
player, and those still apply.  The flag and its misleading "this decade" row
copy are gone.

### 15.2 / 27.5 — the action list did not change with the phase

Every 12.1 peacetime action was accepted during a limited war **and** during the
Great War, on the war budget: recruit, construct fleet, EF, influence,
diplomacy, minor alliance, pacification, fort, MPIT.  15.2 prints a six-item
limited-war list ("players cannot perform recruitment or refit actions in
wartime"), and 27.5 prints the GW list.  `engine/phaseActions.ts` holds both
lists as one gate read by the moves and the Orders panel; 33.3's Third Republic
grant is a named, printed exception that still buys 12.7 during the war.

**Coverage:** `hotseatRuleAudit.test.ts` (35 — the retry, the legacy flag, the
land-unit gate, the rebel gate, the marker entry/removal/naval-base cases, the
fort rebuild and its caps, and every peacetime action in action/wartime/GW).
Full local run: `npx tsc --noEmit` clean, `npx jest src/imperialElegy` →
**303 suites / 4120 tests passed**.  The seeded self-play harness
(`tools/ie-sim/sweep`) still finishes with no refused decision or stall.

## Fixed: the fort action had no placement rule, no level 2 and no upgrade (2026-11-20)

Found by playing the 1850 campaign hotseat: GE spent 1 CP and built a level 1
fort in **Vienna**, Austria's capital, which was controlled by AU and held an AU
army.  The log read `fortBuilt {space: vienna, level: 1}`.

`moves.ts#buildFort` checked the CP, the region, a once-per-decade flag, an
existing fort and the three-fort cap, and nothing else.  Two printed clauses of
12.1 were therefore unreachable, because the only UI entry point
(`actionAvailability.ts`) called `buildFort(space, 1)` and the move refused every
space that already held a fort:

- **placement** — a fort now needs a European space the power controls or
  occupies with one of its own land units.  The printed card that places a fort
  outside a battle says "a friendly controlled space", and 20.1's benefit is
  written for the player's own fortification;
- **level = CP spent** — a new fort may be built at level 1 (1 CP) or level 2
  (2 CP), so the Orders list offers a "Build level 2 fort" row;
- **the 1 CP upgrade** — a fort of your own is upgraded one level for 1 CP and
  never past level 2 (a third attempt is refused), logged as `fortUpgraded`.

The missing upgrade was not cosmetic: 20.2 degrades every unprotected fort by one
level and removes it at level 0, so a fort built with the only available 1 CP was
deleted in the same turn's end phase.  A level 2 fort now survives that step.

**20.1 Militarism offered every fort on the board.**  `militarismOptions` did not
filter by owner ("the printed text does not restrict which fort may be
protected"), so a seat's whole Militarism step could go to an opponent's fort —
and the Rule 34 bot took it every time: in a seeded campaign's turn-1 end phase
GE, UK, RU and OT all chose `fort:berlin`, a fort only GE owned.  The step now
offers the power's own forts only.

### Two smaller defects found in the same session

- **12.1 pacification price.**  The Orders row passed no `cost`, so it fell back
  to `ACTION_COSTS.pacify = 1` and displayed "Pacify · 1 CP" for GE (not unified)
  and AU, while `moves.pacify` charges `pacificationCost()` = 2.  The row now
  quotes the cost the move charges, including the A065 rows.
- **A printed decline and the generic one.**  13.4.2's aid search prints its own
  "decline" option, and `PendingPanel` also appended the panel's generic
  拒绝/Decline button, so the seat saw two identical decline buttons.  One
  `pendingDeclinesItself` predicate now hides the generic one when the decision
  already has a `decline`/`refuse` option.

Coverage: `fortConstruction.test.ts` (11 — foreign capital, neutral minor,
controlled home key, occupied-but-foreign space, level 1 and 2 builds, the 1 CP
upgrade, the level 2 ceiling, a foreign fort, the three Orders rows and 20.1's
own-fort filter) and `pacificationAndDecline.test.ts` (4 — AU's 2 CP row against
the move's wallet, unified/ununified GE, 13.4.2's single decline).

## Fixed: three printed events that settled nothing (2026-11-20)

Reported as "帝国挽歌大部分特殊事件效果都没实现 … 干练外交官 俄土战争 现代化
都有效果未结算".  The report named three cards; each was reproduced by playing
the real card and reading the state back, and each failed for a *different*
reason, so the generalisation "most special events are unimplemented" does not
hold — but these three were genuinely broken.

### A019 Skilled Diplomats — 4 CP allocated in one answer

`mpitChoice` opened a single `mpitAllocation` decision, and
`resolveCardDecision` added the whole printed amount to the chosen track of the
actor's own column.  A GE player therefore always ended with `GE/TA = 4`, and
12.7's *"Players can move their own MPIT markers or MPIT markers belonging to
other powers … not limited to influencing a single power … in any direction"*
was unreachable.

- The decision now offers every column × track pair (`GE:te`, `UK:neutral`, …),
  one marker per answer, and re-opens itself with the remaining amount so the
  4 points can be split across powers and tracks.
- Each marker logs `mpitInfluenceAllocated` (both locales), so the allocation is
  readable in the log instead of appearing as one silent 4-point jump.

### RU-9 Russo-Turkish Wars (and every home-card declaration) — the bot never declared

The event itself resolved correctly: it allies the Balkan minor and leaves the
errata-12.17 declaration entitlement funded by the card's 3 CP.  The defect was
downstream — Rule 34's bot had no declaration row, so `priorityOne` fell through
to `pass`, and `finishImpulse` clears the entitlement.  In solo play (RU is a bot
seat) the card read as "no effect".

- `engine/bot.ts#homeDeclarationMove` sends the `declareWar` the entitlement
  owes, taken from the shared `declarationTargetCandidates` enumeration so the
  bot can only send a declaration `declareWar` accepts.  Preference is
  liberation → conquest → the enumeration's first row, which makes RU-9's
  printed Balkan liberation the bot's choice.
- The same path covers Bismarck, Aux Armes and Jihad.

### OT-11 Modernization — only the +1 stability settled

12.13.1's offer round was missing entirely, and the `modernization` flag the
handler wrote was read by nothing (it has been dropped from the public-flag
allowlist).

- `effects.ts#openModernizationStep` asks each other power in seat order whether
  it will offer a card (its printed CP value is on the option label, matching
  the card's "they must tell you the true CP value"), then the Ottoman seat
  accepts one offer or none.
- An accepted card leaves the giver's hand, becomes OT's `industryCard`, and the
  giver draws a replacement — exactly the printed clause.  With no offer the
  home card is spent for its printed 3 CP of actions.
- New bilingual log keys: `modernizationOffered`, `modernizationAccepted`,
  `modernizationNoOffer`.

Coverage: `cardEventSettlement.test.ts` (11 — per-marker allocation across
columns and tracks, the all-in-one-cell case, the allocation log, the bot's
`declareWar` for RU-9 plus the Bismarck/Jihad path, the hand-over control that
still drops the entitlement, the 12.13.1 offer→accept chain with the giver's
draw, declining every offer for the 3 CP fallback, and the no-offer case).
Full local run: `npx tsc --noEmit` clean, `npx jest --ci` → **559 suites /
5669 tests passed**.

## Added: a solo page that asks which great power you command (2026-11-20)

Reported as "帝国挽歌单人模式添加独立页面 单选一个大国开始游戏".  Solo play used to
hide inside the hotseat shell: `/localIE?solo=1` opened a six-checkbox seat
setup where the player had to work out that the one seat they left unticked was
their own, and a solo match opened on P1 even when they had taken another seat.

- **`/localIE/solo` is its own page** (`components/solo.tsx`, linked from the
  nav drawer, the home page and the online create panel).  It is one radio group
  — `ie-solo-powers`, one `ie-solo-power-<POWER>` per printed seat, with the
  power's pip — plus the scenario picker and Scenario 4's "No GW" toggle.  The
  other five powers are always the bots; `ie-solo-summary` names the player's
  power and counts them.
- **The choice is a real hand-over, not a pre-tick.**  The page writes
  `{power, scenario, noGw}` through `components/localSetup.ts` and navigates to
  `/localIE?fresh=<stamp>`.  The stamp becomes the shell's `matchID` nonce, so a
  solo start **deals a new match** instead of resuming the `Local()` master the
  hotseat tab may still hold, and the shell opens on the picked seat instead of
  P1.
- **The hotseat entrance is unchanged.**  `/localIE` still starts on P1 with six
  human seats, and `/localIE?solo=1` still opens the multi-seat setup screen
  with P2–P6 pre-ticked (now reachable from the solo page too).  Both entrances
  read their saved setup through the same `readLocalSetup`, so they can no
  longer disagree about the bot seats, the scenario or the starting tab.  A
  saved setup whose P1 is a bot opens on the first human seat rather than a
  read-only board.
- **"No GW" follows the playbook.**  The toggle is disabled (and a stale tick
  cleared) for the tutorials, which print their own victory checks
  (`allowsNoGw: false`), instead of being accepted and silently ignored.

`components/localSetup.test.tsx` pins the seat set, the storage round trip, the
`?fresh=` hand-over, the starting-seat fallback and the rendered solo page; the
`e2e/imperial-elegy-controls.spec.ts` "solo vs bot" block picks France (a middle
seat) and checks the match opens on that seat with the other five as bots.

## Added: the nine printed reference charts, transcribed in both languages (2026-11-20)

Reported as "帝国挽歌9个参考表翻译成中文".  The nine charts are published
English PNGs, so a zh_CN board could only ever show English art.  Each one now
has a bilingual transcription (`src/imperialElegy/components/referenceCharts/`,
one module per chart, rendered by `ChartTextView`):

- **The lightbox gained a view switch.**  `ChartLightbox` opens a transcribed
  chart as text on a zh_CN board and as the printed sheet in English, and its
  bar carries `文字` / `印刷原图` (`ie-chart-mode-text` / `ie-chart-mode-print`)
  so either view is one click away.  `data-mode` states which is showing, and
  the printed PNG stays the authority — the transcription says so in its own
  heading.  The player-display boards are art only and still open as art.
- **Text, not pictures.**  Each chart is structured data (prose, bullets, a
  table, a sub-heading) rather than an image, so it reflows, takes the board's
  own type scale, and can be checked against the engine.  The CRT rows, the
  crisis rows, the Balkan States table, the non-player alliance rows and the
  counter mix are all cross-checked against `crt()`, `engine/crisisTable.ts`,
  `engine/limitedWar.ts` and `engine/counters.ts` in
  `components/referenceCharts.test.tsx`; a transcription that drifts from the
  rules fails the suite.
- **The drawer says where the text is.**  `ie-ref-charts` carries a line
  explaining that the printed art is English and each of the nine has a text
  view.

Two discrepancies surfaced while transcribing, and both are recorded rather
than silently smoothed over:

1. **Denmark's 3rd Choice.**  The player-aid chart prints `GE/RU*` in the 2nd
   Choice column and `Germany` in the 3rd; the rulebook's own 13.4.3 table
   (`IE_rule.pdf`, p. 15) prints `-` there, and the Mar. 2026 errata ("13.4.3
   Non-Player Alliance Table (page 30) — Denmark's 3rd choice is Austria")
   corrects the aid.  `NON_PLAYER_ALLIANCE_TABLE` carries no third choice for
   Denmark, so it matches neither source.  The transcription prints the aid's
   cell with the errata note, and the test asserts that `Germany` is the only
   printed column the engine does not carry.  **Open question:** add AU as
   Denmark's 3rd Choice (errata) as a separate rules change with its own tests.
2. **The Flashpoint Summary's Germany threshold.**  The chart prints "control 8
   keys" for Germany while `FLASHPOINTS.germany.keys` is 6 (the "three keys"
   printed on the vector board's own Flashpoints panel is a different,
   unverified number again).  The chart's numbers are transcribed as printed;
   the engine's threshold is left alone because no rulebook page states it and
   the chart is the only source, so changing it would be a rules change, not a
   translation.  **Open question for the rules audit:** which of 6 / 8 is the
   printed value.

## Fixed: five printed rules that were still simplified (2026-11-20)

Reported as "帝国挽歌规则简化部分实现".  The pass took the open items in
"Known fallbacks and simplifications" and closed the ones whose printed text the
live engine can now express.  Each closed item names the printed clause, the live
path and the evidence.

### 15.2.4 / 15.2.5 — wartime land movement is a march or a rail, not 12.15

The live wartime land move used to be the peacetime 12.15 redeployment: unlimited
distance along controlled/influenced land, ending in a friendly space.  That is
the *action phase* action, not the wartime one, so a wartime army could reach any
friendly space for 1 CP and the printed distance/network rules never applied.

- New `engine/wartimeMovement.ts` is the single pure planner:
  - **15.2.4 march** — one space, or two when *both* hops are clear connections
    ("two spaces, if both spaces have clear connections, or 1 space via difficult
    or severe connections").  An enemy land unit, an enemy fort or neutral
    territory stops it; an enemy space with no enemy land unit/fort may be passed
    through, which is the printed exception.
  - **15.2.5 rail** — an unlimited path over friendly controlled/occupied land
    only ("cannot move through enemy or neutral spaces"), gated by the printed
    half-industry allowance (`ceil(industry / 2)`, minimum 1).  The allowance is
    charged per army and cleared with the other per-impulse flags.
- `moves.ts#redeploy` routes wartime land moves through the planner and keeps the
  peacetime 12.15 path for the action phase; a refusal is logged as
  `wartimeMoveRejected` with the printed reason.  Successes log `wartimeMarch` /
  `wartimeRail` (both localized).
- `components/legalTargets.ts` reads the same planner, so the map's move rings and
  the move agree instead of the rings promising the old unlimited move.
- `combat.ts#commandsAlliedMinor` moved to `rules.ts` so the battle path, the
  planner and the Great War maneuvers share one allied-minor command predicate.

Coverage: `wartimeMovement.test.ts` (16 — distance, difficult/severe hops,
pass-through, enemy army/fort/neutral stops, the half-industry allowance and its
per-impulse reset, the live march/rail/rejection paths, and peacetime 12.15 still
being unlimited).  `movementStacking.test.ts` / `occupationRecording.test.ts`
fixtures were rewritten to a legal march or rail because they had encoded the old
unlimited move.

### 9.1.5 — A105 Impulsive Ruler granted CP and drew nothing

`impulsiveRuler` was an empty handler, so a played Impulsive Ruler kept the
mandatory event's 2 CP in the wallet and never drew the printed compensation.

- The handler now clears `cpRemaining`, raises the WTT by 1 (the card's response
  clause) and draws one card — exactly 9.1.5's "does not get any CP to spend …
  but instead draws another card".
- Playing it for CP still resolves no event (the printed "If played for CP the
  event does not trigger"), which the `cp` path already guaranteed.

Coverage: `impulsiveRuler.test.ts` (4).

### A088 / UK-3 — the free colonial CP was a flag nothing read

Both cards grant CP restricted to colonial actions ("naval movement, construct
fleet, expeditionary force and/or pacification").  The grant was written to
`flags.freeColonialCp` and never spent, so the cards' CP were unusable.

- `rules.ts#freeColonialCp` / `spendFreeColonialCp` / `spendColonialCp` drain the
  grant before the ordinary wallet.
- `moves.ts#requireColonialCp` is the shared payer for the four printed colonial
  actions (naval move, construct fleet, EF, pacification) and keeps the impulse
  bookkeeping; a refused action restores the grant untouched.
- `components/actionAvailability.ts` enables those four rows when the grant alone
  can pay, so the board does not hide a legal action behind an empty wallet.

Coverage: `colonialFreeCp.test.ts` (6 — grant-first spending, wallet overflow,
each of the four actions, non-colonial actions refused, a refused action spends
nothing).

### GW-08/09 — "occupying an empty enemy key" also satisfies the pressure

Political Pressure's attack condition only counted a *land battle*
(`landAttackTurn` was stamped in `beginLandBattle`), so the printed occupation
clause was unreachable.

- `greatWarFlow.ts#notePoliticalPressureOccupation` stamps the condition when a
  pressured power's army comes to hold an enemy-controlled/occupied key; it is
  called from the great-war march/rail finish path (the printed way to walk into
  an empty key).

Coverage: `flagEnforcement.test.ts` (+2).

**Closed 2026-11-21 (next pass):**

- **Printed response triggers are live.** `playability.ts#responseTriggerBlock`
  gates A44, A65, A67, A89 and A109. `changeStability` records the decrease
  (`stabilityDecreased`, `stabilityDecreasedTurn`) and the war-end step stamps
  `frLostWarTurn`, so A44 ("France lost a war or lost stability") and
  A89/A109 ("Russian stability has been decreased") now answer from state.
  A67 is offered inside the open crisis decision and refuses the Impulsive
  Ruler crisis; its printed normal-event mode is enabled. A65 is offered by
  `moves.ts#pacify`'s `a065` mode (and the matching board rows) as the printed
  pre-roll window instead of the generic impulse window.
- **Egypt's colonial home spaces are honoured engine-wide.** The live typed
  `keyTypeOverride`/`homeOverride` now drive 12.4 fleet construction, 30.0 GW
  stability keys, A78's colonial-key target and the board's build row.
  `SpaceDef` itself is not mutated: the static catalog is the printed map for
  every seat and every save, and `effectiveKeyType` is the live accessor.
- **GW joint naval already crosses several sea connections.** A regression
  test now pins Pomerania → Baltic → North Atlantic → Western Mediterranean in
  one joint action; the old "one sea connection per action point" note was
  stale. The real remaining joint-naval simplification is that both
  contingents must start in the same box.

## Fixed: no English left in the zh_CN UI (2026-11-20)

Reported as "帝国挽歌 检查UI没有本地化的文本并修复".  An audit of what a zh_CN
board actually renders found four independent leaks; each one is fixed and
pinned by `components/localization.test.tsx`.

- **Unit chips printed English.**  `unitLabel` in `components/boardHelpers.ts`
  built `"GE army · full"` with no language at all.  It now takes the locale and
  prints `GE 军团 · 满编` / `· 减员`.  The kind table moved to
  `engine/unitKind.ts` so the engine's own decision labels (a retreat split, a
  demobilization choice) print the same words.
- **Rule badges and rule links printed the anchor.**  `RuleRef` had
  `title="Rule 19.10"` hard-coded in four panels, and `RuleLink`'s label was
  derived from the anchor id — so a zh_CN board showed `Influence Track`,
  `War Aims Minors` and a bare `costs` on the hand tray and the War panel.  The
  badge title now follows the locale, and `ruleRefDisplayLabel` resolves a
  chart anchor through the chart catalogue's own bilingual title and an inline
  section through a small bilingual table.
- **Engine-built decision prompts stayed English.**  About 80 prompts are
  assembled by the engine, and roughly half interpolate state (a power name, a
  space, a count, a stage) that the board's fixed `PROMPT_ZH` table cannot look
  up.  `PendingDecision` gained an optional `promptZh`, `decision()` and
  `openDecision()` carry it, and every such prompt now sets it; the fixed
  prompts are all in `PROMPT_ZH` and the fixed option labels in `OPTION_ZH`.
  The engine's dynamic option labels (space/unit/card lists) gained `labelZh`
  the same way.
- **The printed-board route had no language at all.**  `PrintedBoard` takes a
  `locale` and translates its toolbar (title, zoom labels, export, print, back
  link); the sheet's own printed art stays English, which is what it
  reproduces.

## Fixed: the battle result is a public dialog showing both sides' damage (2026-11-21)

Reported as "帝国挽歌战斗结果弹出提醒所有玩家 对战斗双方承受伤害界面也在弹出的里面".
A battle used to end with only a log line: the loss panel vanished as the last
`combatLosses` answer resolved, and nothing announced the result to the other
seats.  The engine now keeps the finished battle as public state and the board
raises it as a dismissible dialog for every client.

- **`G.battleReport`** (`types.ts#BattleReport`) records the kind, spaces,
  powers, winner, decisive flag, dice, differential, resolved DRMs, mine hits,
  trench flag, retreat and no-retreat state, and — the part the report is for —
  the step losses each side actually took.
- **Actual losses, not the CRT budget.**  `BattleState` gained `lossesTaken` and
  `casualties`; `applyOneLoss` increments them, so a `combatLosses` answer that
  decrements the queue still leaves the report counting what was really lost.
  Casualties collapse per unit counter (steps + reduced/eliminated).
- **`components/BattleResultModal.tsx`** reads the public report and puts the
  two damage columns inside the same popup as the winner and dice:
  `ie-battle-result-modal`, `ie-battle-result-damage`,
  `ie-battle-result-attacker` / `-defender`, `-losses`, `-units`.  The dialog is
  dismissible (✕, footer `知道了` / "Got it", Escape) and remembers only the
  report id it closed, so the next battle opens again; `BoardLayout` suppresses
  it while a new battle is live or this seat owes a decision/card choice.
- **Public by construction.**  The report lives in `G`, so every opponent and
  spectator's `playerView` gets the same object (covered by
  `battleReport.test.ts`), unlike a client-local notice derived from the log.

Coverage: `battleReport.test.ts` (3), `components/battleResultModal.test.tsx`
(5) and `components/board.test.tsx` (+2: the dialog opens for attacker and
defender, and stays closed while a new battle owns the board).

## Fixed: every decision is a dialog, the map key tells targets apart, home cards pin to the front (2026-11-20)

Reported as "帝国挽歌home card固定置顶放置 进攻 和 仅铁路 目前颜色一样应该不同
所有决策弹出modal".  Three separate defects, one pass:

- **The map key gave `attack` and `rail` the same swatch.**  `MapLegend`
  emitted `ie-key <style>` for every entry, but the stylesheet only coloured
  `move`, `battle` and `legal` — so `attack`, `rail`, `choice` and `pending`
  all fell through to the default `--ie-focus-dark` brass.  Two different
  targets were drawn identically in the key.  Every style now has its own
  colour, matching the ring `map.tsx` draws: `move` blue-ink, `attack`
  overprint, `rail` brass-soft, `choice` ok-green, `pending` warn-amber.  The
  move swatch on the dark key needed a dark-surface token
  (`--ie-move-ink-on-dark: #8FB4D4`, 7.58:1 on panel); the paper-only
  `--ie-move-ink` measures 2.14:1 there and the contrast gate now covers the
  new pair.
- **A decision this seat owed was painted inline.**  It is a blocker, so it
  pushed the space's action list below the fold.  It is now
  `components/DecisionModal.tsx`, sharing `components/Modal.tsx` with the card
  choice: `ie-decision-modal` / `ie-decision-modal-backdrop`, no ✕, no backdrop
  dismiss, Escape held, focus trapped.  Another seat's decision, an open battle
  and the final score stay in the Orders body — they are reports, not this
  seat's choice — and the Orders body behind the dialog stays mounted.
- **A long hand pushed the home card off the row.**  `pinHomeCards`
  (`components/cardDisplay.ts`) lists every `kind: "home"` card first, then the
  rest in the order they are held; the order within each group is unchanged and
  no card is dropped or duplicated.

Coverage: `components/mapLegend.test.tsx` (6), `components/decisionModal.test.tsx`
(5), `components/cardDisplay.test.ts` (+5 for `pinHomeCards`),
`components/HandTray.test.tsx` (+1 for the pinned row) and the rewritten
`components/board.test.tsx` decision tests (2).

## Rules 11.0 / 11.1: the diplomacy negotiation table (2026-11-22)

The diplomacy phase only offered home-card selection, a one-way "give one random
card" button and Metternich's Legacy. The printed rules ask for more, and for the
one binding clause to be a *formal agreement*:

- **11.0** — "Players are allowed to show other players their action cards to
  encourage cooperation or to back up a threat." `showCard(card, to|null)` and
  `hideCard(card)` are live: a shown card is faceup to the whole table or
  privately to one power, for the diplomacy phase that showed it only
  (`diplomacyBegin` and the phase's close both clear the list). It carries no
  rules effect, exactly as 11.0 says.
- **11.1** — the card transfer is "a formal agreement between both players …
  done at the end of the diplomacy phase", "cannot give other players specific
  cards, all card draws must be random and home cards can never be drawn", and
  "the random card draw is done in full view of all players". The old `giveCard`
  move was a one-way, immediate, unconfirmable gift; it is **gone**. In its place:

| Rule text | Implementation |
| --- | --- |
| formal agreement between both players | `proposeDeal` → `respondDeal(accept)`; nothing moves on a proposal |
| done at the end of the diplomacy phase | `settleDeals` runs from `beginActionPhaseAfterDiplomacy`, idempotent via `settledTurn` |
| a number of cards, committed by each side | `DealOffer.give` / `DealOffer.take`, clamped to the live hand by `dealProblem` |
| cannot give specific cards; all draws random | no move takes a card id; `drawRandomCards` resolves each card with `randomIndex(ctx, pool.length)` |
| home cards can never be drawn | `dealableCards` filters `kind === "home"` |
| announce the draws in turn order | accepted offers sort by printed seat order, then creation order |
| must be confirmed by the other player | an unconfirmed offer lapses at the phase's close (`expireOffers`) |
| draw done in full view of all players | every drawn card is logged as `dealCardDrawn` and left unmasked by `redactLog` |

The panel is a fifth conditional page of the Orders body (`Deals`), reachable
only during the diplomacy phase and pulled forward when an offer arrives. It
carries the offer form (counts + up to three non-binding promises, mirrored into
a terms sentence), an inbox with confirm / refuse / counter / withdraw, the
faceup card list, and this turn's public settlements. A counter reverses the
table and retires the previous offer, so the form's counts always mean *what the
reader gives and receives*. The Rule 34 bot answers any offer addressed to it
with a refusal rather than negotiating back and forth.

Evidence: `negotiation.test.ts` (table legality, confirmation, refusals,
withdrawals, counter chains), `negotiationSettlement.test.ts` (die→card mapping
in both directions, home-card exclusion, seat order, shortfall, idempotence,
lapsing, the public record), `negotiationPrivacy.test.ts` (third seats and
spectators see neither an open offer nor a private show, while the settlement is
public), `negotiationStage.test.ts` (six real boardgame.io clients: answering out
of turn, the phase-close draw, a stale offer after the close), and
`components/diplomacyPanel.test.tsx` (static render). `docs/imperial-elegy/
NEGOTIATION.md` is the design note.

## Visual system pass (2026-11-18)

Implemented [`VISUAL_SYSTEM.md`](VISUAL_SYSTEM.md) phases 1–7 on
`feature/ie-visual-system`.

| Phase | Delivered |
| --- | --- |
| 0 | Baseline inventory: the stylesheet split preserved every selector, `data-testid` and `ie-*` class. |
| 1 | `src/imperialElegy/design/tokens.json` is the single token source; `scripts/generate-ie-tokens.mjs` writes `components/styles/00-tokens.generated.css`; `npm run ie:tokens:check` fails on drift; `ieTokens.test.ts` checks CSS ↔ JSON ↔ MUI theme, the 12 px floor, `!important` policy and pill radii. EB Garamond and Libre Franklin (Latin variable subsets, 73.5 KB total) are self-hosted with licences and checksums in `public/imperial-elegy/fonts/`. |
| 2 | Table/paper/plate surfaces, vignette + grain, 40 px seat strip, 52 px track strip with a 24 px tabular CP readout, plate panels with a brass top hairline, paper index tabs, the button hierarchy (one brass primary per viewport) and the state matrix. |
| 3 | Hand rows are ledger rows (34 px desktop / 40 px phone), CP stamps, paper card faces, a 440 px inspector with a brass top rule, and a ≤ 2 px hover lift. |
| 4 | Map paper/sea/rules, nameplate ink, cream counter edges with RU's printed grey edge, and target rings encoded by colour **and** dash/tick (move blue-ink, attack overprint, rail brass-ink, choice ink). |
| 5 | Phone dock keeps its frozen heights; 2 px brass bar rule, brass-soft selected tabs with a 2 px top rule, 36 px controls with 44 px hit areas. |
| 6 | `components/Icon.tsx` (28 inline SVGs, 16 × 16, 1.5 px stroke) replaced every UI glyph; motion tokens and reduced-motion/forced-colours handling. |
| 7 | Alias tokens removed; `scripts/check-ie-contrast.mjs` gates 85 computed pairs; docs updated. |

Local verification for this pass (2026-11-18, branch `feature/ie-visual-system`):

- `node scripts/generate-ie-tokens.mjs --check` — in sync.
- `node scripts/check-ie-contrast.mjs` — 85 computed pairs pass, no brass or
  status fill used as text.
- `npx tsc --noEmit` — clean.
- `npx jest src/imperialElegy/components --ci` — 40 suites / 1006 tests passed.

Remote GitHub Actions remains authoritative (AGENTS.md §7/§10); the local run
is not a substitute.

## Fixed: declaring a war brings the War screen to the front (2026-11-19)

> The tab contract below was superseded on the same day: the War body is
> now always present. See "all war operations consolidated into the War
> panel" further down.

Reported as "帝国挽歌事件俾斯麦选择目标之后没有开启战争界面". The war-target
chooser and the declaration form both worked: the state really reached
`phase = "wartime"` with a `WarState`. What was missing was the hand-off to the
war screen. `useBoardModel` already ran a "a war just started, bring its panel
into view" effect, but it wrote a `railTab` value nothing read — the desktop
`TurnPanel` was only given an `activeTab` on phones (the dock's tab) and
otherwise fell back to its own internal state, so the seat stayed on the Orders
page and the declaration looked like it had done nothing.

- `components/turnPanelTab.ts` is now the one definition of the turn panel's
  bodies: `turnTabKeys` (the War body exists only while `war` or `gw` runs),
  `resolveTurnTab` (a body that disappeared falls back to Orders), and the
  `mobileTabForTurnTab` / `turnTabForMobileTab` pair the phone dock needs. The
  panel and the shell both read it, so they cannot disagree.
- `BoardLayout` passes `activeTab={resolveTurnTab(railTab, warVisible)}` on
  desktop and an `onTabChange` that writes `railTab`, so the tab the reader
  clicks is the tab the model keeps. On a phone it keeps writing `mobileTab`
  through the dock.
- `useBoardModel`'s war-start effect now moves both shells: `setRailTab("war")`
  and `setMobileTab("war")`, and on a phone it also raises the bottom sheet at
  half height (the same edge behaviour a decision already had). A later manual
  switch is still respected; the effect only fires on the war's rising edge.

Coverage: `components/turnPanelTab.test.ts` (4 — keys, fallback, the two shells'
mapping and round-trip) plus the two e2e assertions in
`imperial-elegy-controls.spec.ts`: after a declaration the `ie-war` panel is
visible and `ie-turn-tab-war` is already `aria-selected="true"` (both the Bohemia
declaration and the Bismarck unification war), with no manual tab click.

## Fixed: all war operations consolidated into the War panel (2026-11-19)

Reported as "帝国挽歌战争操作太分散了 而且依赖点击地图 都集中到一个面板上完成".
Declarations were split across three places: the Orders panel's Actions page
(which only appeared after a legal objective space was clicked on the map), a
separate home-card target chooser dialog, and the War tab (which only existed
once a war already ran). Nothing about declaring a war needs a map selection —
`declareWar` takes the defender, aim and objective as arguments.

- The War body is now always present (`components/turnPanelTab.ts` drops the
  `warVisible` condition; the desktop tab strip and the phone dock both list it).
  It carries the declaration form before a war and `WarPanel`/`GreatWarPanel`
  once one runs, so every war operation is in one place.
- `components/WarDeclarationPanel.tsx` is that form: defender, aim, objective,
  CP and the 14.1 second-power / primary / Bismarck join-ban clauses, all
  picked in the panel. Maybe-edits are local state, clamped on every render, so
  a new card or impulse cannot leave a stale selection.
- `engine/declarationTargets.ts` grew `declarationDefenders`,
  `declarationObjectives` and `declarationSecondObjectives` beside the existing
  `declarationTargetCandidates`, so the panel asks one question at a time while
  reading the same `declareWar` gates (13.0, 13.5, 13.4, `validateWarAim`).
  `declarationTargetCandidates` keeps its entitlement-only contract.
- The Orders panel's declaration block and prompt, its model state
  (`warAim`, `warCp`, `secondObjective`, `warTargetControl`, …) and
  `components/WarTargetDialog.tsx` are gone. The board's dead declaration
  plumbing (`warCp`, `onDeclareWar` in `actionAvailability`/`spaceActionModel`)
  was removed with them.
- A live home-card entitlement brings the War tab to the front and badges it,
  replacing the auto-opened dialog; the e2e Bismarck case now reads the locked
  aim/CP straight from the panel.

Coverage: `components/warDeclarationPanel.test.tsx` (8 — player and minor
targets, locked card aim/CP, RU-9/Jihad target rules, the 14.1 clauses,
ordinary aim/CP, the phase gate and the empty state), `components/turnPanelTab.test.ts`
(rewritten for the always-present body) plus the two e2e cases (ordinary
Bohemia declaration and Bismarck's unification war) driven entirely from the
panel.

> Superseded: the sections below describe the chooser dialog and the map-first
> declaration flow that this change replaced.

## Fixed: the home-card declaration now opens its war-target chooser (2026-11-19)

Reported again as "帝国挽歌 俾斯麦事件之后不能统一战争". The previous fix
granted the declaration entitlement and taught `declareWar` to spend the
card's CP, but the board still only offered the declaration after the player
selected a legal objective space on the map. Nothing prompts a player to look
at Denmark or Bavaria after the Bismarck event, so the card still looked dead.

- `engine/declarationTargets.ts#declarationTargetCandidates` enumerates every
  legal (defender, printed aim, objective space) declaration for a live
  entitlement. It mirrors `declareWar`: 13.0 World Tension, 13.5 truces,
  eliminated seats, 13.4 resolution of a non-player target (an allied minor is
  reached through its player), the card's target/aim policy and
  `validateWarAim`. The UI can therefore never offer a refused move.
- `components/WarTargetDialog.tsx` groups those candidates by defender, filters
  by war aim for the cards that leave the aim open, and hands the chosen
  objective to the existing declaration form. The dialog opens by itself when
  the card resolves; `components/SpacePanel.tsx` keeps an
  `ie-war-target-prompt` ("选择战争目标") so a dismissed chooser can be
  reopened, and explains why there is no target when the list is empty.
- The chooser is limited to the seat's own action impulse and to the seat the
  hotseat reader is looking at; a running war or a pending decision hides it
  without losing the dismissal state.

Coverage: `declarationTargets.test.ts` (9 — including "every candidate is
accepted by `declareWar`" for all four cards), `components/warTargetDialog.test.tsx`
(7 — auto-open, grouping, aim filter, close/reopen, other seats) and the new
`e2e/imperial-elegy-controls.spec.ts` Bismarck case.

## Fixed: RU-9's Balkan alliance and the three home-card win bonuses (2026-11-19)

The last two printed clauses recorded as open in `CARD_EVENTS.md` §3.13 are live:

- **Russo-Turkish Wars** now resolves *“If possible gain an alliance with a
  Balkan minor power with which you have a diplomacy marker”* before its
  declaration entitlement.  Candidates are the `BALKAN_MINORS` homes that the
  minor still controls and that carry an RU diplomacy marker, filtered through
  the shared 12.8 `minorAllianceProblem` gate; a single candidate is automatic,
  several open an `eventTargetSpace` choice.  `finalizePendingCard` keeps the
  impulse open while a declaration entitlement is live, matching `playCard`.
- **Aux Armes, Russo-Turkish Wars and Jihad** pay their *“win the war gain 1
  stability”* clause.  `WarDeclarationPolicy.winStability` records it and
  `applyVictoryOutcome` adds the point when the declaring side wins anything
  other than a white peace (on top of 16.1's major-victory swing).

Coverage: `homeWarDeclarations.test.ts` (9 new) and
`components/logText.test.ts` (`warWinStability`).  No remaining clause from
`CARD_EVENTS.md` §3.13 is open.

## Fixed: a reduced army could not be refit at the manpower ceiling (2026-11-19)

Reported as "帝国挽歌找不到把 reduced army 用 CP 恢复成 full 的入口".  The entry
is 12.2's **Recruit army** row (`recruitArmy`, 1 CP) in a controlled home key;
`recruit` already flips a reduced counter in place.  But `canRecruitIn` applied
the manpower/counter ceilings before its stacking exception, and every power
starts the campaign at its manpower track (GE 2/2, RU 5/5, OT 3/3 …), so the
row was always disabled and folded away behind "show unavailable".

- `characteristics.ts#canRecruitIn`: a same-kind reduced army makes the build a
  refit; the manpower, British/Indian/CW colonial and Ottoman Turkish/Arab
  ceilings no longer refuse it (they count counters, and a flip adds none).  The
  home-key, control, A83 and Ottoman placement gates still apply.
- `moves.ts#recruit`: the flip targets the reduced counter
  (`existing.find((unit) => unit.steps < 2)`) instead of `existing[0]`, so a
  stack with a full army ahead of a reduced one refits the reduced one.
- `endPhase.ts#militarismOptions` reads the same helper, so 20.1's free army
  step no longer needs a spare manpower slot before it can refit.

Coverage: `recruitmentLimitsLive.test.ts` (5 new) and
`components/actionAvailability.test.ts` (2 new).

## Fixed: two-power declarations and join limits (2026-11-19)

The remaining card-text gaps from §3.12/§3.13 of `CARD_EVENTS.md` are now live:

- `declareWar` takes an optional `{secondTarget, primary, forbidPlayers}` bag.
  A two-power declaration is one war: `WarState.defender` is the primary,
  `coDefenders` records the second attacked player, and the second player also
  sits on the defending side (budget = industry, no card played).  14.1's
  primary choice is recorded through the `primary` argument.
- Bismarck may forbid other players from joining (`WarState.forbidPlayerJoins`);
  14.0 player-ally calls return `forbid-join` on both sides while
  `joinWarAsMinor` still works.
- Aux Armes sets `WarState.allowNeutralJoin` when the conquest targets two keys
  or two powers; the new `joinWarAsNeutral` move lets a neutral player spend an
  event card and join the defending side (8.2 shift, 8.4 cap).
- The Orders panel exposes the second power, primary and join-ban controls; the
  War panel shows both join limits and the neutral-volunteer button.

Coverage: `bismarckWar.test.ts` (10), `homeWarDeclarations.test.ts` (19) and
`components/bismarckDeclarePanel.test.tsx` (6). Still open and out of this
fix's scope: RU-9's Balkan-minor alliance and the three cards' "win: +1
stability". Modelling boundaries are recorded in `CARD_EVENTS.md` §3.14.

## Fixed: Bismarck's join ban also covers 13.4.2 Seeking Aid (2026-11-19)

Reported as "帝国挽歌俾斯麦事件的统一战争没有阻止其他玩家参战". The 14.0
player-ally call was already refused under `WarState.forbidPlayerJoins`, but a
war of unification declared on a non-player power **without** a player ally
still opened 13.4.2's aid search: the diplomacy-marker holder and the
Non-Player Alliance Table candidates were asked, and a seat that accepted the
aid became the defending primary. That is another player joining the war
despite the printed clause.

What is live now:

- `moves.ts#beginSeekingAid` skips the aid search when the declaration carries
  the ban (`G.flags.declarationForbid`), logs `minorAidForbidden`, and finishes
  the declaration with the minor defending alone (15.4.2).
- `moves.ts#finalizeMinorAid` refuses an "aid" answer while the ban is set, so
  a queued 13.4.2 decision cannot bypass the clause.
- 13.4.1 is unchanged: a minor that already has a player ally still offers that
  ally the printed choice to fight for it (the card's Clarification), and
  `joinWarAsMinor` still lets minor-power allies join normally.
- `components/logText.ts` renders the new `minorAidForbidden` entry in both
  locales.

Coverage: `bismarckWar.test.ts` (3 new: no `minorAid` pending with the ban, a
forced/queued aid answer is refused, and an existing minor ally still gets the
13.4.1 fight-or-abandon choice) and `components/logText.test.ts`.

## Fixed: Bismarck's event could not launch its war of unification (2026-11-19)

Reported as "事件俾斯麦无法发动统一战争". Reproduced by running the engine:
`playCard(IE-H-GE-1, "event")` moved GE's stability 3 → 4 and then **ended the
impulse** with `cpRemaining = 0`; the handler's `warDeclaration` flag was read
by no code, and the `{type: "war"}` / `special: "warDeclaration"` decision in
`engine/effects.ts` had no card reference and no `resolvePending` branch. A GE
player therefore had no way to make the declaration printed on the card.

What is live now (errata 12.17: all the CP from one card must go into the war):

- `engine/rules.ts#grantWarDeclarationEntitlement` / `warDeclarationEntitlement`
  / `clearWarDeclarationEntitlement` record the entitlement on the public
  `warDeclaration` + `warDeclarationCard` flags.
- `engine/effects.ts` (`bismarckWar`) grants it; `moves.ts#playCard` keeps the
  impulse open while it is outstanding, and `moves.ts#finishImpulse` clears it
  when the seat hands over.
- `moves.ts#declareWar` consumes it instead of `G.cpRemaining`: CP must equal
  the card's printed 3, the aim must be `unification`, and the declaration
  stamps `war.declarationCard = IE-H-GE-1` (14.2.1 Balance of Power cannot
  answer it).
- `components/SpacePanel.tsx` locks the declaration's aim/CP to the card and
  accepts a **non-player power** as the target (13.4) — the German minors are
  the actual unification objectives, and the old `isPowerKey(control)` gate
  never offered a declaration on them.

Coverage: `bismarckWar.test.ts` (10) and
`components/bismarckDeclarePanel.test.tsx` (6). The same declaration
entitlement now covers Aux Armes / Russo-Turkish Wars / Jihad (§3.13), and the
two-power and join-limit clauses are live (§3.14): Bismarck may name a second
power and forbid player allies (minor allies still join), Aux Armes may name a
second power and — after two keys or two powers — lets neutral powers volunteer
for the defending side. Still open: RU-9's Balkan alliance and the three
cards' "win the war: +1 stability" (recorded in `CARD_EVENTS.md` §3.14).

## Rules-completion pass (2026-11-18)

Authorities for this pass: `/Users/larryw/tools/ie-assets/IE_rule.pdf` (60 pp.)
and the repository's `IE_ERRATA_-_Mar_20_2026.pdf`. Each item below was
implemented from the printed/errata text and covered by
`src/imperialElegy/rulesCompletion.test.ts`.

| Rule | Printed clause | Live implementation |
| --- | --- | --- |
| 22.3.1 | "If Italy and OT are allied, shift Italy into the neutral box and end this procedure." | `greatWar.ts#resolveItalyOttomanWar` checks the clause before the war (GW rosters first, Alliance Track second) and calls the new `setItalyAllianceBox`; result logged as `italyOttomanWar:alliedNeutral`. |
| 12.10 (errata) | EF goes to a friendly controlled/home space or a space with the player's influence marker; no LoC or path. | New `rules.ts#efDestinationAllowed`, read by `moves.ts#buildEf` (both build and move), the Rule 34 bot and `components/actionAvailability.ts`. Naval boxes refused; CP is not spent on a refusal. |
| 13.4.4 (errata) | Conquest on Qing China: place the Qing army at full strength in the targeted key; the aider gains a +1 card marker. | `moves.ts#finalizeWarDeclaration` places (or moves) the single Qing army counter; `finalizeMinorAid` grants the aider's card marker, logged as `qingAidCardMarker`. |

Verification for this pass: `npx tsc --noEmit` clean, and
`npx jest src/imperialElegy --ci` → **269 suites / 3580 tests passed** locally.
Remote GitHub Actions verification is still **required** before this branch is
merged (AGENTS.md §7/§10); the local run is not a substitute.

### Residual rules pass (2026-11-18, second pass)

The five items the first pass left open are now closed:

| Rule | Printed clause | Live implementation |
| --- | --- | --- |
| 15.1 | "At the start of the maneuver step, if opposing units occupy a naval box a naval battle is immediately fought (players are still allowed to attempt to avoid battle)." | `combat.ts#beginNavalStartBattles` builds the contact list (one per contested box, highest-initiative owner as attacker, `hostileSeatIn` for the defender) into `G.flags.navalStartQueue`; `resolveNextNavalStartContact` opens the 19.2 avoidance decision one box at a time. The queue is drained from `finishBattle`, `resolveNavalAvoid` and the pending-decision wrappers, so a 19.8/18.8 or upkeep decision cannot stack battles. Called by `moves.ts#startWarManeuver` and `greatWarFlow.ts#startGwManeuver`. |
| 34.4.5 (errata) | Bots get a free redeployment at the start of a war's (or the GW's) maneuver step: Easy 1 army, Normal half, Hard all; peacetime movement, so only through spaces they control. | New `engine/botRedeployment.ts#botFreeRedeployment` (deterministic: closest-first toward the nearest enemy over controlled land, never over water), `warBotPowers`/`gwBotPowers` belligerent lists and a per-step `G.flags` stamp. Difficulty is 34.1's table-wide setting in `G.botDifficulty` (`configuration.ts#botDifficultyOf`, parsed at setup, normalised by the migration). Logged as `botFreeRedeploy`. Covered by `botRedeployment.test.ts`. |
| 12.2 / 12.4 (errata) | Recruitment may build land units for minor allies in a home space of the minor; construct fleets may build naval units in a minor home space with a port. | `moves.ts#buildForMinor` delegates the gate to `characteristics.ts#minorBuildDecision`, shared by the moves, the Orders panel and the Rule 34 bot; refusals log `minorBuildRejected`, builds log `minorBuilt` with their CP cost. Covered by `minorAllyBuild.test.ts`. |
| 26.1 | "After GW combat cards are flipped faceup, players may give their GW combat card(s) to another player(s) in their alliance." | `greatWarFlow.ts#giftGwCombatCard` (planning step, faceup cards only, same alliance), exposed in `components/GreatWarPanel.tsx` and `actionAvailability.ts`; logged as `gwCombatCardGifted`. |
| 27.5.2 | "Likewise, the FR player can rebuild the Zouaves in this manner." | The GW draft substitution in `moves.ts` / `characteristics.ts#gwDraftZouaveChoice`: when FR has no Zouaves in play, the Zouaves replace the second drafted army in a legal FR space (offered as a draft decision option). The Outbreak Step placement of the Zouaves was already live. Covered by `gwDraftEf.test.ts`. |

Two labels from the first pass needed no further code. "26.1/US planning
gifts" is the GW combat-card transfer above: the rulebook's 26.1 gives no
separate US gift, so nothing else was owed. "27.5.2's remaining recruitment
substitutions" is the Zouave draft substitution above (the allied-minor and
elite-colonial-EF substitutions were already implemented).

## Active Partial-completion audit (2026-11-15)

The section matrix below contains historical claims, including already-fixed
items labelled partial. Completion requires checking the printed rule, the live
call path and regression evidence; a documentation-only relabel is not closure.
This table tracks the current audit until every Partial row is reconciled.

| Section | Audit / implementation still to close | Evidence already verified remotely |
| --- | --- | --- |
| 1–4 | Unlisted non-player physical counters; per-mode card restrictions; key/territory semantics. | Existing chart tests; source/data verification remains open. |
| 5 | Home **key** supply sources; friendly/neutral/occupied LoC routes; land-only and sea-gate traces; minor/Italian supply; displacement and impulse lifecycle audit. | Existing stacking/displacement suites; **2026-11-23: 5.7 event displacement closed** — `effects.ts#displaceUnitToFriendlyLoc` / `displaceUnitsNotFriendlyTo` / `navalDisplacementTarget` and `rules.ts#sweepOrphanedMinorUnits` are the single shared path on every event caller, pinned by `displacementRules`. |
| 6–7 | Key/colonial/Arab track derivation and power-projection baseline audit. | Existing display/track suites; **2026-11-23: the display-only claim is gone** — `characteristicsCoverage.ts` registers 39 `live` bullets and zero `display-only`, pinned by `characteristicsCoverage`; the campaign setup now stores FR 3, matching the 3.3.1 port formula (Algeria’s printed naval-base station is the second Western Mediterranean point) and the derived track. |
| 8 | **Closed 2026-11-23.** Full section audited; 8.1.2's alliance-member declaration gate and 8.4's A92 cap bypass were the two real holes and are now fixed (`allianceDeclarationGate.test.ts`, 6); everything else is a live helper + suite. | A015/A111 + d6 resolution: [0184ee01 CI](https://github.com/larry801/filmcentenary/actions/runs/43683138802); harsh terms: [ef8b259c CI](https://github.com/larry801/filmcentenary/actions/runs/43687623222); new gate tests. |
| 9–12 | **Closed 2026-11-23.** All ten audit blockers are live: recruit phase gate, same-space rebel battles, US/CSA war immunity, 12.3 controlled-port landing, 10.3 marker expiry (+A094 persistence), 10.4 UK India flip, 12.2 EC LoC, 12.6 influence-only bar, 12.17 all-card CP, 9.1.4 discarded-mandatory trigger, 12.8 generic minor EC and 12.15 Special Redeployment. Only the 9.1.3/12.14 interpretation notes remain; section promoted to Implemented. | `auditFixes.test.ts` (8), `cardsPartialFixes.test.ts` (10), and the existing card/response/turn-flag suites. |
| 13–17 | **Still open.** Closed 2026-11-23: errata 13.4.3 (Denmark→Austria), 13.4.4 (Qing army in the targeted key), 17.0’s errata displacement (`demobErrta.test.ts`), 15.5’s capital-capture end, 16.1.3(2)’s blockade defensive victory (`warEndingRules.test.ts`, 3), 13.4.5’s Bismarck auto-alliance and 16.2’s one-option-per-non-primary cap (`bismarckWar.test.ts` / `treatyAllocation.test.ts`). Remaining blockers: 13.2.1 Italian unification wars, unified Italy in a limited war (14.0/15.4.1/15.6), 15.0 pass at budget ≤2, 15.2.2 limited-war joint naval, 16.1.4/16.1.5 negotiated/agreed white peace. | Treaty territory/continuation: [ca46b63b CI](https://github.com/larry801/filmcentenary/actions/runs/43690347798), after correcting the stale surrender assertion and random-card browser fixture. |
| 18–19 | Audit the remaining combat/naval fallback claims against current code and rules. | **Closed 2026-11-23** against the printed pages 37–41: 19.11 displaced naval units implemented (`combat.ts#queuePortNavalDisplacements` → `resolveDeferredNavalWork`, pinned by `displacedNavalUnits.test.ts`, 17) and the naval-combat bullet relabelled after re-reading the code; the remaining items are interpretation notes, not unwired rules. |
| 20 | **Closed 2026-11-23.** The twelve steps were re-read against printed pp. 41–42 + the 12.12/20.2 errata; every printed clause has a live path and suite, and the remaining items are printed-unspecified interpretations (own-fort protection, full-port ships stay at sea, first-drawn NG default). Section promoted to Implemented. | `endPhaseSteps`, `endPhaseResiduals`, `navalEndReturn`, `manpowerTrackChoice`, `ngDrawShuffle`, `ngLimit`, `italianRebuild`, `minorBuildIndependence`, `industryCeilings`, `polishLimits` (175 tests / 16 suites). |
| 21–23 | Crisis continuation/double-WTT audit, minors' actual GW participation, Italian/Polish table completeness. | **Closed 2026-11-23** against printed pp. 42–44: every 22.1/22.2/22.3.1 row, 22.4's plan helpers and the 22.5 Poland model are named in `RULES_COVERAGE.md` with their suites; the 22.4 lone-defender sub-clauses are now implemented (`engine/italyMilitary.ts`). The A100 double-WTT clause remains a recorded note. |
| 24–32 | **Closed 2026-11-23.** 26.0 GW discard reshuffle, 25.2 US chit gate, 25.4 entrant at 0 stability, 15.2.3 multi-army GW deploy, 28.1.5 trench-battle port naval movement, 26.2 US planning transfer and 25.7 alliance-set GW order are live; 25.5/25.6/25.6.1 remain documented deterministic fallbacks. Section promoted to Implemented. | `greatWarFlow.test.ts` (25), `trenchBattleSpace.test.ts` (12), `gwOrderChoice.test.ts` (4); focused GW/naval/bot regressions and the fixed-seed full game passed locally. |
| 33 | Reconcile every registry bullet and timing clause; resolve printed FR/RU power-projection mismatch. | **Closed 2026-11-23** against the printed pp. 53–56 characteristic cards: 39 `live`, zero `display-only`, and the per-bullet sub-clauses are listed in the enforced-vs-sub-clause table. The printed FR 3 discrepancy is reconciled to the rule formula (2) in the scenario data, so the setup display and the first end-phase recompute agree. |
| 34 | **Closed 2026-11-23.** All twelve audit blockers are live: auto-pacification, declaration guard, placement order, closest/two-space war aims, pile order, war-budget card, ally calls/joins/aid, EC differential, self-only treaties and Impulsive Ruler (`botPrintedRules.test.ts`, 12). Scenarios complete; P1–P3 remain the documented promotional exclusion, and the bot PAC is not in the repo so B1/B2 cannot be re-checked against the chart. | `botPrintedRules.test.ts` (12), `scenarioPlaythrough.test.ts`, `botRoster`/`botSelfPlay` suites. | (9.2/34.3.4) are live; online matches now run the same bot for the seats no human takes (2–6 humans, `src/game/ieBotDriver.ts`); `scenarioPlaythrough.test.ts` covers all eight printed scenarios. |

Latest fully verified baseline: **2591c8f1284fd31cb6239695a90b4c55ed004d9c**,
449 suites / 4288 tests, frontend + server builds, 37 general browser tests and
16 IE browser tests, all passed. [Full run](https://github.com/larry801/filmcentenary/actions/runs/43695994681).
The downloaded general-browser HTML report records 0 failed/flaky/skipped tests.

### Current local verification (2026-11-15 follow-up, rebased onto master)

The 26–27 / 25.7.1 / 29.3 / 30.1 follow-up recorded below (the two tip commits
of this branch) has been rebased onto `origin/master` at `327b19a9` ("Merge
branch 'feature/ie-rules-continuation'"). Local verification on the rebased
tree:

- `npx tsc --noEmit -p tsconfig.json` — clean.
- `npx jest --ci` — **460 suites / 4425 tests passed**, 0 failed, 0 skipped.

The rebase adds seven map/board suites from master, superseding the earlier
453-suite / 4347-test count as well as the focused 80-test / 8-suite and
600-test / 8-suite runs and the 452-suite / 4337-test full local run cited
below. The pre-existing rule
fixtures (legacy saves and hand-built `GreatWarState`s with no impulse ledger)
stay green through a compatibility gate that applies the 27.1–27.3 strictness
only once `beginGwImpulse` has created `G.gw.impulse`; the 27.1 end-turn guard
and the 27.7 consecutive-pass reset still apply to them. Frontend/server
builds, browser specs and seeded self-play sweeps were **not** re-run for this
commit, so the 449-suite CI baseline above remains the last full build/browser
verification.

### 26–27 Great War impulse and action follow-up

- **27.1 / 27.7:** an ordinary impulse permits one budget-funded action.
  Finishing that action advances the initiative without recording a pass;
  an unused ordinary impulse may pass only at budget ≤2. Any action clears
  the consecutive-pass history, and a previous pass does not withdraw the
  player for the rest of the year. `gwEndTurn` now validates the active seat,
  unresolved work and actual end condition instead of skipping to winter.
- **27.2 / 27.3:** a card spent for its bonus funds a separate immediate action,
  not banked war-budget CP. Repeating an action or taking a land battle in a
  card-bonus impulse is refused. GE's free staff deploy is accounted separately.
  Exhaustion resolves its mandatory event even through the CP entry point and
  grants the immediate bonus; its chosen effect still activates at impulse end.
  The last ordinary budget CP cannot be spent while Exhaustion is still held.
- Normal GW events require the active player's budget action first; planning,
  another player's impulse and battle-only cards are rejected. GW-05 retains
  its start-of-impulse response exception. Pending GW-card finalization no longer
  invokes the normal action-phase impulse finisher. The optional saved impulse
  ledger distinguishes ordinary/card/free actions and stores no private card ID.
- **27.4:** after military maneuver, living neutrals get event-only impulses in
  normal seat order before winter. Each can play or keep its card; the sequence
  survives saves and pending event choices. Neutral players cannot buy military
  actions from this window.
- **26.3:** US/Italian initiative slots recur each cycle while their budget
  remains. Their units, pass history and upkeep are separate from the commanding
  player's; a major's slot cannot spend the controller's card or move its armies.
  Controlled minor armies and fleets can use the controller's march/naval paths.
- **27.5.1 / 27.5.3 / 27.5.4:** army refit requires a LoC; fleet refit requires
  a friendly port. New live `gwEliteCorps` and `gwRefitFleet` moves have board
  controls. An EC costs 1 CP, joins a supplied friendly army (including outside
  home territory), and observes the counter/EC limits. **26.2 player transfers**
  are exactly 1 CP, once in planning, with a LoC to the recipient.
- The map, hand, maneuver controls and bot read the same allowance helpers;
  the bot finishes completed impulses and selects a legal required action when
  its priority row cannot act. Verification is intentionally focused for this
  follow-up: **80 tests / 8 impulse/flow/card/control suites passed**, plus
  TypeScript and diff checks, rather than a new full build/browser/self-play
  sweep. The previous full totals below are
  historical evidence, not a claim that this follow-up has full verification.
  This focused run has since been superseded by the full local suite run in
  "Current local verification" above.
- Remaining section audit includes 25.7 alliance-selected order, 26.1 card
  transfers, US planning gifts, 27.5.2's remaining recruitment substitutions /
  manpower pools and full multi-army deploy choices.

### 25.7.1 / 29.3 / 30.1 Great War bonus impulses

- The alliance now selects its bonus-impulse player instead of rotating through
  a deterministic list. Its first living player in initiative order submits the
  alliance choice, with every living belligerent member available; a sole member
  is unambiguous. The bilingual pending panel also offers an explicit pass.
- Selecting a player activates the exact bonus slot and applies that player's
  upkeep once. Passing the slot costs no CP and preserves ordinary pass history.
  The saved choice validates the GW year, order, cursor, deciding seat, alliance
  and current candidates before mutation; duplicate and stale answers are refused.
  A leading bonus marker is also resolved at the start of the next GW year;
  the last ordinary pass still visits bonus/major slots later in the track.
- At outbreak, each missing alliance position becomes a bonus slot **inside**
  the alternating order. GE neutrality uses the printed UK / FR / AU / RU
  priority for the alliance that goes first. A neutral entrant replaces the
  lowest-numbered non-player position, including an intervening bonus marker,
  while US/Italy remain after the player slots.
- 30.1 says only **one alliance** may hold bonus markers, not only one marker.
  An eliminated player's position becomes another bonus for that same alliance;
  if this would give both alliances markers, all bonus markers are removed and
  the track closes up. Cursor bookkeeping preserves the exact position even
  when several slots carry the identical `"bonus"` value.
- Source: Living Rules v1.1 §§25.7–25.7.1, 29.3 and 30.1 (pp. 47, 52).
  Regression evidence: `gwBonusImpulseChoice.test.ts`, corrected source-based
  `capitalBookkeeping.test.ts`, and the live board choice in
  `components/board.test.tsx`. Targeted run: **600 tests / 8 suites passed**,
  including the real boardgame.io phase hook and cross-seat dispatcher.
  Full local run: **452 suites / 4337 tests passed**, plus six seeded
  campaign/GW self-play games, frontend/server builds, and all **16 IE browser
  tests**. Remote verification remains open.
- Section 24–32 remains Partial. The ordinary action/pass/turn-end and major
  impulse follow-up is recorded above; alliance-selected order and the remaining
  recruitment / card-transfer clauses still require implementation/audit.

### Supply-source corrections under verification

- 5.6 sources and their second home must be actual controlled **keys**;
  ordinary home territories and naval bases cannot supply armies. Unprinted
  key track types and permanent German home overrides remain valid. German
  unification no longer turns foreign-controlled German spaces into foreign homes.
- 4.9.4 / 5.6: peace traces through own control; wartime routes use participating
  allies, including neutral-chit players who joined the war. Occupation takes
  precedence over control; rebels deny a land source. An uncommitted diplomatic
  ally is not a supply corridor. Player traces and second-key qualification obey
  Suez/Dardanelles closures; land-only traces reject direct port-to-port sea edges.
- 5.6.1: minor sources require keys and cannot be enemy-occupied. Italy's GW
  routing no longer mistakes neutral players for allies, and respects occupation.
- 5.5.3 / 5.6.2: a new action/war impulse resets the upkeep guard even when the
  same sole remaining player acts again; repeated upkeep within one impulse
  remains idempotent. `supplySources.test.ts` covers these cases and live loss.
- This closes identified defects, not the entire section-5 audit: minor/Italian
  sea-gate paths and the remaining displacement/movement clauses still require
  source-level verification before changing the section's status.

### Power-projection / source audit in progress

- Current publisher downloads are [Living Rules v1.1 (January 2026)](https://cdn.shopify.com/s/files/1/0295/6650/0908/files/rulebook_V1.1_Lowrez.pdf?v=1769177925)
  and [Living Playbook v1.1](https://cdn.shopify.com/s/files/1/0295/6650/0908/files/Playbook_V1.1_Lowrez.pdf?v=1769177919).
  The product page still links the older production PDFs. Future section closure
  must cross-check v1.1; notably 16.2.4 adds minority liberation and explicitly
  requires a peacetime LoC for a foreign territorial acquisition.
- 3.3.1 projection is one point per box with a port, two with an ordinary port
  **and** a naval base, not additive per ordinary port. Score the best three
  European boxes; count allied-minor naval units in the two-per-ship cap. Egypt's
  Indian Ocean port is enabled by Suez. Hong Kong is a printed triangle/naval
  base, not a territory; its Pacific anchor is a sea connection, and the three
  unprinted direct land links to Chinese keys have been removed.
- PP domination itself grants no cards. A028 awards actual +1 card markers,
  reading current projection and enforcing the UK's double-next-highest clause.
  Three-way ties for the top two places grant no domination.
- **Printed FR 3 now agrees with the rule formula.** v1.1 Playbook p.3 prints
  FR 3, and the map data now marks Algeria's printed naval-base station
  (`SpaceDef.navalBase`), so rule 3.3.1 yields FR 3 as well: North Atlantic,
  and Western Mediterranean at two (Provence port + Algeria base). RU yields 3; UK 8 and the other printed
  zeros agree. `CAMPAIGN_SETUP` stores the derived FR 3, so the setup display
  and the first end-phase recompute cannot disagree;
  `powerProjection.test.ts` pins the formula over the whole printed setup.

### A100 / 23.1 crisis sequencing corrected

- Both WTT increases are printed on A100. Two crises are therefore legitimate
  when a conference at the first increase leaves WTT at 4; suppressing the
  second would contradict the card. The defect was the order: independence
  choices must finish before the second increase, and Macedonia must wait
  until after its crisis. An outbreak keeps preceding effects and skips the award.
- The two increases, independence/loss resolution and Macedonia award are now
  separate continuable effects. Corrected the handler's inverted pending return
  value, so mandatory-card bookkeeping cannot finish while a choice is open.
- The independence DRM counts armies throughout the Balkans, not only the
  Ottoman-controlled target spaces. With no qualifying Ottoman space, the
  conditional ally removal and die are skipped; the second WTT/award still run.
- Legacy saved independence choices (which already charged the second WTT)
  retain their award without a duplicate increase. `balkanWarsSequence.test.ts`
  exercises both crisis boundaries, conference/outbreak, low-roll loss, forced
  independence, no-target handling, all-space DRMs and legacy continuation.

### Balance of Power post-war draw choice

- The UK now chooses **one** player it invited who actually joined, instead of
  granting every accepted invitee a card. The original defender and players
  who refused do not qualify. With a single candidate the award is unambiguous;
  with several, the UK gets a required private power choice at war settlement.
- Both interactive and explicit treaty settlements suspend before draws and
  resume exactly once. The saved continuation retains treaty choices and harsh-
  terms bookkeeping. Old saves whose `postWarDraws` contained several invitees
  are converted to the same chooser. Plain Status Quo invitations do not create
  Balance of Power rewards.
- Candidates, the chosen player and final recipients are recorded on the war;
  the existing power-choice panel provides English/Chinese labels. Verified
  locally by `balanceOfPowerDraw.test.ts` plus existing Balance of Power and
  Status Quo suites (35 tests); remote validation remains required.

### 3.3.1 / 20.6 projection industrialization bonus

- PP domination now contributes the printed +1 industrialization DRM. The
  live economy threshold and characteristic helper share one modifier, stacking
  PP with A075's +2 for other players. The end-phase step refreshes projection
  before rolling, so captured ports and lost fleets cannot leave a stale bonus.
- `projectionIndustry.test.ts` covers the shared modifiers, tied second place
  and a live roll where UK succeeds only because of PP. A075 and RU/OT target
  fixtures now isolate their own rule from the separately earned PP modifier.

### Living Rules v1.1 16.2.4: all three righteous-defense options

- **Acquire:** an occupied enemy key/territory (occupation waived for a primary
  major defensive victory) must be supplied in a read-only **post-cession
  peacetime** view. Wartime occupation corridors and allies cannot supply a
  permanent acquisition. Source qualification still needs connected home keys.
- **Return a home:** the separate v1.1 option restores the actual owner,
  including a non-participating player or minor. It requires neither occupation
  nor the acquisition option's LoC. Permanently eliminated unification minors
  cannot be resurrected. Older choices infer this mode from the recipient's home.
- **Liberate:** the treaty panel explicitly lists each eligible space/nationality
  pair, with bilingual labels. The defender must occupy a space controlled by
  the named treaty target; a major victory does not waive that condition. AU
  citizenship, actual printed minority flags, permanent elimination and the
  five-minor-ally cap are validated before mutation. No rebellion or LoC is
  required by this third bullet.
- Liberation creates independent control and immediately allies the minor to
  the defender. `SpaceState.independentHome` persists its nationality/home after
  reconquest, lets the new minor supply units, be declared on and be realigned,
  and survives JSON saves. Polish liberation uses the existing reserve/build-box
  registration even when Poland starts in Galicia. Unfriendly units displace;
  the one-per-war righteous-defense allowance is shared by every mode.
- Direct and interactive settlements use the same validator/application. New
  regression suite `righteousDefenseV11.test.ts` exercises choices, independence,
  alliance/cap, displacement, minority targeting, peace supply, neutral home
  returns, save/resume and invalid-option immutability. `components/board.test.tsx`
  renders the real engine-created liberation button in Chinese. Targeted local
  run: **505 tests / 5 suites passed**. Full remote verification passed on
  **cd87d19f**, as recorded in the baseline above.

### 20.3 independent-minor build corrections

- The automatic build step now requires an independent minor to control its
  home. A red campaign build-box reminder no longer creates Serbian/Bosnian/
  Bulgarian armies inside an Ottoman-controlled homeland. Permanently removed
  minors never rebuild, even if a stale control marker remains.
- One automatic army per minor is the printed 20.3 ceiling. The larger physical
  pools in 4.2 allow player recruitment/events to create a second army; they do
  not raise the automatic ceiling. Existing reduced second armies can still
  receive the one-step promotion. Poland keeps its two-step/spaces+1 exception.
- Polish placement uses a controlled Polish home (preferring Poland itself),
  including a newly liberated Galicia; it cannot place troops in still-Russian
  Poland. Dynamic liberated homes are recognized when a minor is in the box.
- `minorBuildIndependence.test.ts` and corrected source-based assertions in
  `endPhaseSteps` / `nonPlayerPlacementLimits` pin the independence and placement
  rules. No new automatic build entitlement is invented for a minor absent
  from the printed build box.

### 20.6 industry track endpoints and automatic success

- Successful end-phase industrialization and event-based industry increases
  now use the same per-power maximum as the printed display / GW blockade cap,
  rather than allowing every power to reach the hard-coded German maximum 7.
- An automatic industrialization with a supplied card no longer consumes a die
  before applying its guaranteed result. The card is still discarded and the
  auto marker cleared; no-card behavior is unchanged.
- `industryCeilings.test.ts` checks all six powers' live end-phase and event
  paths, a reduced industry ceiling and the automatic no-die path. Combined
  local industry/end-phase regressions: **48 tests / 3 suites passed**.

### 15.5 attacker-surrender consent

- An attacker's surrender during maneuver now opens an accept/refuse decision
  for the **current defending primary**, including the UK after Balance of
  Power. The offer itself leaves victor, budgets, initiative, pass history,
  stability and active power untouched. Acceptance records the defender's major
  victory for the existing victory/treaty step; refusal (including decline)
  resumes the same war impulse.
- The defender's own surrender is immediate, including the pre-maneuver 13.6
  window. The attacker can only offer at a maneuver boundary; battles, pending
  choices, already-settled results, allies, outsiders and eliminated powers are
  rejected. An unaided non-player defender gets no unanswerable player prompt.
- The board uses the same eligibility helper and renders bilingual accept/refuse
  buttons and public logs. Pending context stores the participants and war turn;
  save/resume, stale decisions, wrong-seat answers and duplicate acceptance are
  validated. `surrenderConsent.test.ts` and the real board-panel test cover the
  live flow; updated campaign tests explicitly accept the offer before settlement.
- Local surrender/lone-minor/board regressions: **64 tests / 3 suites passed**;
  TypeScript and diff checks pass. Full remote verification remains required.

### 20.4 complete sea-unit return and nearest-port choice

- The return planner reserves earlier arrivals' capacity instead of assigning
  every ship to the same initially empty port. Naval and land stacking limits
  are enforced; armies cannot enter naval bases. All sea-borne unit kinds are
  considered, including reserve armies, elite colonial EFs and Zouaves; an army
  and its attached corps return together.
- The live end phase suspends on an owner-controlled nearest-port choice when
  several destinations tie (a controlled minor's player decides too). The
  existing bilingual movement-destination panel renders the choices. Save/resume
  revalidates the current capacity, then continues step 20.4 before manpower.
  A one-shot resolver uses the deterministic nearest legal port.
- Empty enemy-occupied ports are excluded even after their garrison leaves;
  player traces use the Suez/Dardanelles gates. `navalEndReturn.test.ts` covers
  multi-ship capacity, reserve/corps grouping, omitted unit kinds, army/base
  restrictions, saved owner choices, stale destinations and occupation markers.

## 2026-11-15 treaty-territory follow-up

- **16.2.4 Righteous Defense:** a defending primary's major victory waives
  occupation of the losing primary's key/territory; ordinary and negotiated
  defensive victories still require occupation unless returning a home.
  The recipient's own home may be returned to a victorious ally (including an
  independent minor's occupied home, preserving its alliance). Event-granted
  homes are recognized. A valid LoC to a supply source is still required, with
  naval gates respected. Knockout options stay restricted to their named target
  and do not borrow the primary-major exception.
- **16.2.5 Colonial Cession:** eligibility now reads the key's controlled
  overland connection to the losing player's current capital (3.2.1), rather
  than requiring a fixed `keyType: "colonial"` label. This includes AU/RU/OT
  overseas keys and square/star keys without a printed track type. Allied,
  neutral, influenced and sea links do not bridge the owned-land connection;
  formal control and temporary occupation remain distinct (15.3). Colonial
  homes, including event-granted Egypt, retain the occupation requirement.
- **Chooser continuation:** candidate generation and follow-up validation share
  the live treaty rules. A `treatySpace` choice retains the parent's beneficiary
  and knockout target, including after JSON save/resume; stale choices are
  rejected before changing control. The older default-first-space regression
  now explicitly chooses its intended home because major victory offers more
  legal spaces.
- Source: publisher rulebook §§3.2.1–3.2.2, 3.2.5, 5.6, 15.3 and 16.2.4–16.2.5
  (pp. 8–9, 16, 32–33). Focused regressions: `treatyTerritoryRules.test.ts`.
  Full verification is reported by the exact feature commit's GitHub Actions run.

## 2026-11-15 harsh-terms follow-up

- **8.3 / 16.2:** completing a settlement that actually imposes two distinct
  treaty options on the losing primary shifts both primary belligerents one
  box away from each other. Merely winning a major victory, declining an
  optional term, negotiated peace's single concession, or imposing additional
  knockout terms on allies does not trigger this rule. A concession awarded
  to a victorious ally still counts against its primary target.
- Both directions use the pre-shift positions. If both primaries are neutral,
  the live server rolls independently for each (1–3 TE / 4–6 TA, using §8.2's
  direction convention). The ordinary three-player maximum remains in force;
  the declaration exception is not used. Track ends stop further movement.
- Interactive and explicit settlements share `applyHarshTerms`. The existing
  applied-choice ledger survives saved pending decisions; a war-local
  `harshTermsApplied` marker prevents duplicate shifts/rerolls and remains in
  the war archive. Public English/Chinese logs record each result.
- Source: publisher rulebook §§8.3, 8.4 and 16.2 (pp. 19, 33). Regression
  coverage is in `harshTerms.test.ts`; full verification is the exact commit's
  feature-branch GitHub Actions run.

## 2026-11-15 alliance-rules follow-up

- **A015 / A111:** the initial shift offers only legal adjacent boxes (8.0 / 8.4),
  with bilingual destination labels. A power that began the impulse neutral
  cannot return to or pass through neutral during this event's resolution.
  The impulse-start snapshot and event-local restriction survive tied rolls,
  other players' decisions and CP-chain insertion; the next impulse resets it.
- **Post-resolution WTT:** after all player powers and unified Italy resolve,
  raise tension once if allied players outnumber neutrals **or** either alliance
  contains three players. Italy is excluded from those player counts. Reaching
  5 opens the original card's Crisis Table row for its original player, including
  after another player's tie; a conference resumes and finishes the card once.
- **8.6 dice correction:** each positive influence marker rolls **one d6**,
  not two. Zero-influence markers neither roll nor compete. This applies to
  players and Italy, in card events and the end phase; Italy still rerolls ties.
  The 10-point double-shift threshold is unchanged.
- **Source:** publisher [rulebook, pp. 19–20, §§8.0–8.7](https://cdn.shopify.com/s/files/1/0295/6650/0908/files/rulebook_Prod_10mmBleed-upload.pdf?v=1756972319)
  and the transcribed A015/A111 card faces. The new `allianceSystem.test.ts`
  includes the printed §8.7 GE example, legal shifts, neutral restrictions,
  WTT boundaries, cross-seat crisis continuation and CP-chain ownership.

The historical round-9 test totals below predate this follow-up. Full validation
for subsequent commits is reported by the feature branch's GitHub Actions run.

**Snapshot:** 2026-11-13 round-9 pass, workspace
`/Users/larryw/tools/filmcentenary`.
**Round-9 pass:** 29.2 now opens a losing-alliance `gwColonialLoss` decision
before the winner's transfer; 30.1's two-survivor minor-heir case uses the
printed die roll; AU's Unstable Situation is a live discard-or-marker choice;
5.6.1's Italian Exception gives unified Italy player-style LoC/supply; the
Great War joint naval operation has board controls; and the remaining one-off
card option labels carry Chinese text. The deliberately deferred 34.x content
(bots and promo cards P1–P3); the alternate scenarios are now implemented —
see `SCENARIOS.md`.
**Earlier fix pass:** 16.2.1 mandatory cession is enforced; the both-sides white-peace
chooser order is negotiated; 13.4.1 and 14.0 stability penalties stack; GW-05
rerolls no longer double mine/trench hits; 19.8 enumerates complete splits and
switches to a per-unit chooser above the list limit; direct control writes clear
stale `occupiedBy` markers; `surrenderGwMajor` runs the permanent-minor sweep;
blockade/colonial LoC traces apply Suez/Dardanelles closure; and Egypt’s
colonial key type has a dynamic legacy-save fallback.

**Round-8 pass:** the remaining live-code gaps from the previous snapshot were
worked section by section. 5.6 supply may now trace through naval boxes (blocked
by enemy naval units in wartime) and 5.5.3 movement-end stacking is enforced on
the free TSRR rail move and GW deploy/draft; 12.3 transports open the 19.1
interception chain (including the 19.6.1 carried-land-unit consequences) and the
first deal uses the printed 12.2 `cardsToDraw` formula; 15.0’s consecutive-pass
reset, 16.2.5 colonial cessions to allies and 17.0/17.1 war-end displacement +
blockade are live, with the blockade trace shared with 29.1 in
`engine/blockade.ts`; 19.1 keeps the interrupted movement for ships left at sea
after a partial 19.8 move, the 19.4 mine-retreat choice is unconditional, and
19.7 forbids retreating into the box the attacker came from; 22.1.3 is an
interactive Sardinia-Piedmont / Two Sicilies choice when both are legal, 20.1
offers “skip” only when no benefit exists, and Powder Keg / The Balkan Wars open
the Crisis Table before the rest of their text; 30.0 charges the −1 stability
for a lost dreadnought and counts committed supporting armies for the
decisive-force threshold, 31.0’s second alliance-defeat condition ends the GW
immediately, 29.3’s free redeployment moves all of a neutral’s land units, and
33.4/33.5 add citizenship-aware nationalist targeting, the start-of-GW Second
Rome VPs and a live `refreshPowerProjection`; 27.5.2 places one drafted army per
space (the second space is a pending choice, including the printed
EF/elite-colonial-EF substitution); 12.15 redeployment now follows the printed
land route (controlled/influence spaces only, enemy spaces block, rebels stop
the move) instead of teleporting, **and is priced as printed — 1 CP for the
action, not 1 CP per unit**: `redeploy` charges on the first unit of an impulse
and moves every later unit of that action for free, and accepts a whole stack so
a group moves in one click (`redeployActionCost.test.ts`); 32.5 now displaces units from rebel
spaces at the outbreak, keeps trenches out of rebel spaces and refuses GW
maneuver destinations there; A17/A18/A56's stability-or-card choice belongs to
the chosen player (forced stability loss with no card), A18 rolls its backfire
die and A56 targets a minority-nationality controller and grants +1 stability.
Player-facing: pending options
carry optional Chinese labels, treaty keys render as human labels, the newer
naval-limit flags are public, `deployReserves` is registered in `ALL_MOVES`
so its board control works, and the Great War maneuver now has board controls
for march, rail, deploy, planning CP transfer and combat-card reveal, and
14.0's minor-ally call has a board control.

**Scope:** every printed scenario in `IE_playbook.pdf` pp. 3-10 — the
1850-1920 campaign, the 1850 tutorial, the 1870 and 1880 scenarios, the
Historical Great War tutorial, Alternate GW 1-3 and Scenario 4's "No GW"
victory modifier — plus rule 34 bots. Promotional cards P1-P3 remain outside
the scope. See [`SCENARIOS.md`](SCENARIOS.md).

> **This is a snapshot, not a freeze.** The rule matrix describes the live game
> wiring (`game.ts` / `moves.ts` / engine modules imported by those files), not
> merely files that happen to exist. The newer integration modules, including
> `engine/economy.ts`, `engine/crisisTable.ts`, `engine/counters.ts`,
> `engine/alliance.ts`, `engine/endPhase.ts` and `engine/navalMovement.ts`, are
> imported by the live game; `engine/greatWar.ts` keeps older flow helpers that
> the live loop no longer calls. The full IE Jest suite passes **2641/2641 tests
> in 205/205 suites** with clean `tsc`, `yarn build` and `yarn build:server`;
> the 501-asset manifest check verifies 501 files. The three browser specs were
> rerun on this build: **5/5 regression, 3/3 controls, 3/3 spectator**.

## Status key

| Label | Meaning |
| --- | --- |
| **Implemented** | Typed state, validated move/effect and deterministic engine resolution exist and are exercised by tests. |
| **Partial** | The mechanic exists but covers only a subset of the printed rule, or a live path is simplified. |
| **Automatic fallback** | The rule expects a choice; the engine deterministically picks an option (first legal target, auto entry, auto peace) instead of prompting. |
| **Not implemented** | No live engine path. |

## Rule-section matrix

| Rules | Status | Live implementation at this refresh | Principal fallbacks / interpretation notes |
| --- | --- | --- | --- |
| **1–4 Key concepts** | **Implemented** | Seat order GE, UK, FR, AU, RU, OT; phases; active power; dice through `ctx.random`; half-FP rounding; impulse loop with pass/end-impulse. **4.2 counter pools are transcribed from the printed `counter-count` chart** for all six players **and 24 non-player rows** (armies/reserves/EC/EF/squadrons/dreadnoughts) and enforced in recruit/buildEf/constructFleet/GW draft/Polish recruitment; the printed naval limits (GE/AU/OT 2/2 until A092 4/4 or GE unification) sit on top. 4.2.1’s five-minor-ally cap is enforced by distinct minor power **on every path** — the 12.8 move, the card handlers (RU-9's Balkan alliance, A097's follow-up) and 22.1.1's Italian petition all read `effects.ts#canGainMinorAlly`. | **The counter-count transcription was verified row by row against the published PNG (2026-11-21):** all six player rows (standing/reserve/EC/EF/squadron/dreadnought, the UK 5 special standing armies and the OT 2+2 Arab armies, with the 79/68/26/26 totals) and all 24 non-player rows match the chart. The six non-player rows the chart does not print (Tuscany, Papal States, Egypt, Morocco, Korea, Mexico) stay `null` by design rather than invented, and the only printed per-mode power restrictions (A041/A054/A098's own response windows) are gated engine-wide — the 122 card faces print no further "played by" clause (searched across the whole deck). |
| **5 Units, stacking, LoC** | **Implemented** | Typed armies, reserve armies, EC/EF, elite colonial EF, Zouaves, squadrons, dreadnoughts; two-step armies; stacking caps 3 (Europe) / 2 (elsewhere, including all OT home spaces); ports hold 4 naval units; BFS LoC and supply sources. **5.5.3 overstacking** costs one step per overstacked stack at the start of the owning player's impulse (owner chooses; one step total) and caps contributing defenders; **5.6.2 broken LoC** charges its step at impulse start, gives −1 BDRM and forbids support; **5.6.3** displaces a peacetime broken-LoC army to the nearest friendly LoC space. **5.6's two clocks are kept apart**: (2)/(3) are answered at "any point" — at every battle start and every support window — while (1) is charged only at the start of the owner's next impulse, and only to a stack that is still cut off then (a corridor restored before that point costs no step). **Only armies check a LoC**, so EC/EF/elite/naval counters never take a 5.6.2 penalty. | 5.6 prints no supply points or consumption step, so none is modelled; 5.1.3–5.1.6's "alone in a space at the end of a combat or at the end of a movement" elimination is live for ECs, elite colonial EFs and Zouaves (`rules.ts#eliminateAloneEliteUnits`, run at battle end and at the impulse boundary, with the printed setup placements exempt); 5.1.2 prints no "standing army" movement clause (its only three differences are the peacetime holding box, wartime-only deployment and the demobilisation return, and "they function identically to standing armies"), so there is nothing to wire there, and 33.2.2's "land units using this movement must end their movement in a friendly port" is transitive on the free naval movement the UK's Rapid Deployment grant performs, which embarks no land unit and whose land-unit continuations are already port-gated (`freeNavalDestinations`/movement-end checks); 5.3.1/5.3.2's loss coupling — 5.3.2's two bullets and 18.6.3's EF coupling plus "a force comprised exclusively of EFs cannot eliminate non-rebel armies" — is live in `combat.ts` (`lossCandidates`/`applyLosses`/`eliminateCoupledEfs`/`isEfOnlyForce`); the one remaining interpretation is the 5.1.5/Zouave "treated as ECs for the purposes of elimination" exception to the EF coupling, which the engine reads as suppressing it for an EC-bearing force; supply now traces through naval boxes and is blocked by enemy naval boxes in wartime; the 5.6.1 minor supply sources are live, including the sea trace. 5.7 event displacement is live on every event path through `effects.ts#displaceUnitToFriendlyLoc` / `displaceUnitsNotFriendlyTo` / `navalDisplacementTarget` and `rules.ts#sweepOrphanedMinorUnits` (nearest friendly-LoC space for land, adjacent naval box for ships, elimination with no legal destination), pinned by `displacementRules`; movement-end stacking is enforced on the remaining movement paths (free TSRR rail, GW deploy and draft). The 5.6.1 Italian Exception is live: after unification, `IT` units trace a player-style LoC to an Italian controlled home key that has a LoC to another Italian controlled home key, and their broken LoC charges the combat DRM/support/impulse rules. |
| **6–7 Displays and tracks** | **Implemented** | Stability, manpower, industry, territorial/colonial/Arab keys, reserves, City of Light, citizenship/rights, India stability, TSRR, Jihad; stability VP/BM/card tables, industry card counts and key→manpower tables. UK colonial keys 7; UK secondary-manpower track, four port links and Egypt `minorHome` corrected. `engine/characteristicsCoverage.ts` holds 39 `live` entries and zero `display-only` entries, and `characteristicsCoverage.test.ts` pins the registry against every printed bullet. | A71’s Egypt colonial-home key type is live (explicit override plus a dynamic legacy-save fallback keyed on the UK/FR home override); India independence and Poland’s limits are live; the remaining sub-clause approximations are listed per bullet in the registry notes. |
| **8 Alliances and MPIT** | **Implemented** | Alliance track boxes, committed/aligned state, neutral-box prohibitions, the UK-defender and Aux Armes invitation exceptions, the status-quo/Balance of Power paths, declarations of war and card-driven shifts; **8.1.2's alliance-member declaration prohibition is enforced** in `moves.ts#declareWar` and the panel list `engine/declarationTargets.ts#declarationDefenders` (single- and two-power declarations, including a minor defended by an alliance member); **8.2 declaration shift** (defender choice when both neutral, forced-shift 8.4 exception, unified Italy random shift, 13.4.1/13.4.2 abandonment/Seeking Aid, 14.2 Italy aid shift); **8.3 harsh terms**; **8.4 three-player maximum through the single `shiftAlliance` helper** (20.9, A015/A111, A92 Naval Arms Race, GW 29.3 neutral entry, ally calls/consents); **8.5 MPIT reset/replacement**; **8.6 resolution step** (per-positive-marker d6 + influence, highest total then turn order, tie choice, Italy reroll, ≥10 double shift "if possible", 8.4 stop, WTT 5 crisis, action-phase Alliance System/Shifting Alliances); 8.7 example. **Alliance-system events (A015/A111, RU-9, Bismarck, Aux Armes) shift through the same helper.** | Interpretation notes, not gaps: the Aux Armes neutral-volunteer path resolves its both-neutral 8.2 direction deterministically (Triple-Entente-first) while the declaration/14.2 paths prompt; `settleDefenderShiftChoice`/`tieBreakDirection` are stall-safety defaults after a live prompt; there is no separate alliance-resolution phase (8.6 runs inside 20.9 and the two events); a unified Italy resolves after the six player columns; the US and Italy are exempt from 8.4 as printed. Tests: `allianceSystem`, `allianceCap`, `allianceDeclarationGate`, `defenderShift`, `allianceCardTie`, `harshTerms`, `italyRandomShift`, `italyCardResolution`, `italyAbandonMpit`, `statusQuo`, `allyConsent`, `allyAidShift`, `minorWar`, `homeWarDeclarations`, `endPhaseResiduals`. |
| **9–12 Cards and action phase** | **Implemented** | 100 action, 12 home and 10 GW cards; types, decade build, prep deals, CP chain, response/combat/GW windows, save card. **4.8/12.5–12.9 foreign-affairs markers** share one gate (`engine/foreignAffairs.ts`) read by both the moves and the Orders panel — 12.5.3 minor-power spaces only (no player, US or unified-Italy space; Qing barred; the South only during the ACW; Japan only after Meiji; namesake-space rule), diplomacy needs no LoC, 12.5.1 influence is land spaces only and may trace through allied minor power spaces, 12.6 bars are influence-only, 12.4's 1-CP naval refit is live (`refitNavalUnit`, friendly ports only; 15.2 excludes wartime and the GW keeps 27.5.4), 12.9 lets any player flip an ally marker back to its original owner, and 12.9.1 charges 3 CP instead of 4 for that flip when the port outnumbers the allied player in an adjacent naval box (`foreignAffairs.test.ts`). Card targets/playability (A41/A98/A54 windows, A59 attacker-only, GW-10 timing, A70 removal, A54 Young Turks), Loose Grip’s full Ottoman set, auction reveal and 12.3 land-plus-naval transport (incl. 32.1 US exit) are live. A078's elite combat bonus is now a real choice (`combatElite`, +1, auto-elimination against a non-rebel army), GW-01 offers both printed branches including the strict neutrality marker, and a crisis now resumes the inciting card's suspended tail on every non-outbreak outcome. Every card event now matches its printed text on the points listed in `CARD_EVENTS.md`: stability is granted once (A047/GE-1/UK-3/FR-5), A083 subtracts pacification and a card marker, A072/A099 place their full units, A069 removes itself only from turn 5, A039 offers its UK cancel window, A032 runs its end-phase roll, and the printed “OR” cards (A045 A048 A051 A052 A068 A073 A107 A109, GW-01, AU-7) open real choices. A98/A41 DRMs are consumed, all `duration:"turn"` flags clear at the printed boundary, Exhaustion activates at impulse end, A85/A75 are correctly scoped, and every printed characteristic bullet has a live path (`characteristicsCoverage`). **Audited 2026-11-23:** `recruit` reads the 15.2/27.5 phase gate; 12.16 same-space rebel battles; 12.17.1 US/CSA war immunity; 12.3 errata controlled-port landing; 10.3 transient card markers expire after the deal (A094's Boxer marker persists in `persistentCardMarkers`); 10.4 UK India flip move + dock control; 12.2 new-EC LoC; 12.6 influence-only removal bar; 12.17 errata all-card CP (`impulseCardCp` + War-panel lock). | The only remaining notes are interpretation boundaries, not unwired rules: 9.1.3 response-window timing (A44/A89/A109 are offered at their holder's impulse start rather than the printed Victory Step/stability moment) and 12.14 chain-action granularity (the chain's "single action" is tracked as one spend, not one action family). Everything else is live and pinned: `cardsPartialFixes.test.ts` (10), `auditFixes.test.ts` (8), plus the card/response/turn-flag suites. |
| **Privacy / playerView** | **Implemented** | `engine/privacy.ts#redactForView` runs from `game.ts#playerView`; hides opponents’ hands/goals/goal decks/GW cards/per-power secret flags, replaces deck/discard/removed order with public counts, redacts active and suspended pending decisions, hides inciting-card fields, and masks card-naming log arguments unless the printed rules play the card in the open (any `cardPlayed` line, so both events and CP plays are named, plus responses, combat/GW cards, industrialization and CP-chain cards; saved, random-discard and refused plays stay masked). A documented `PUBLIC_POWER_FLAGS` allowlist now exposes the genuinely public flags (power projection, professional army, rapid mobilization, reserve bonus, naval limit/discount, etc.) while keeping secret flags hidden. Face-up GW combat cards remain public; auction bids are private. | Per-power flags are split by an explicit allowlist rather than a full public/private field split, so a future flag must be added to the allowlist to be visible; log entries that do not name a card are public by design. |
| **13–17 Limited war** | **Partial** | Declaration validation, war aims/objectives, budgets, ally calls, 8.2 shift, Status Quo, Balance of Power, **13.4/13.5 non-player war**, **13.4.1 abandonment + 14.0 refusal**, **13.4.2 Seeking Aid**, **14.2 Italy aid shift**, **home-card declaration entitlement (Bismarck)**, **16.1.6 two-stage knockout treaties**, **15.4.2 lone non-player WarState**, **Italy MPIT (8.5/8.6) in 20.9 and card events**, **independent-minor treaty beneficiaries**, white-peace both-side knockout sequence with chooser order, initiative, maneuver/battles, surrender, multi-ally treaties, demobilisation and truces. | 16.2.1 mandatory cession is enforced in both the interactive chooser (no early finish) and the explicit settlement path; the both-sides white-peace order is a proposal/response/counter negotiation with an initiative fallback; 13.4.1 and 14.0 stability penalties stack; 15.0’s consecutive-pass reset, 16.2.5 colonial cessions to the primary/player allies/independent minors and 17.0/17.1 war-end displacement + blockade are live; Bismarck's two-power target and forbid-join clauses and Aux Armes' two-power/neutral-volunteer clauses are live (see `CARD_EVENTS.md` §3.14; a two-power declaration is modelled for player targets, the recorded primary is the printed attacker fallback, and a co-defender's capital loss follows the 15.6 ally-knockout path); Russo-Turkish Wars / Jihad carry their own declaration entitlements and printed target/aim limits; the three declaration cards' “win the war, +1 stability” clause is paid on a non-white-peace win; treaty beneficiaries still exclude arbitrary neutral minors. |
| **18–19 Combat** | **Implemented** | CRT/BDRM, support, elites, losses, EC/EF, forts, trenches/machine guns, naval dice/mines, data-driven cards, 28.1 trench lifecycle, 19.10 amphibious, 19.1 interception/19.2 avoidance and the contact chain, **19.11 displaced naval units during wartime** (`queuePortNavalDisplacements` → `resolveDeferredNavalWork`, displaced fleet as attacker, no 19.2 avoidance, interception window then battle after the action closes), GW multi-box NMP/continuation, complete 19.5 DRMs, 19.4/19.6 dreadnought-majority losses, **19.3 mine-first sequence + two-hit retreat**, **19.8 split port retreat**, transit interception incl. `gwJointNaval`, **all-port mines**, land/naval manpower exhausted, Dardanelles prompts including allied controllers, per-unit land/naval/trench retreats, movement-end stacking/port capacity and minor broken-LoC penalties. | GW-05 rerolls keep mine/trench hits outside the decisive doubling; 19.8 enumerates every legal split up to 512 list options and switches to a complete per-unit chooser above that (no lossy covering set); 19.1 keeps the interrupted movement for survivors of a partial 19.8 move; the 19.4 mine-retreat choice is unconditional; 19.7 forbids retreating into the attacker’s origin box. Interception battles cannot be avoided (19.2), and an unescorted transport caught alone gets no 19.6.1(2) elimination — this is 16.3's printed exception ("a battle which results from an interception can never be avoided"), so it stays. **Audited 2026-11-21:** every 19.5 naval modifier (firepower edge, stability, the −2/+1 port-count pair with the port-is-a-box footnote, reduced-only, failed avoid, GW manpower) is recorded in `navalPortBattleModifiers`/the DRM breakdown and pinned by `portBattleDrms.test.ts`/`navalDrmComplete.test.ts`. **19.11 audited 2026-11-23** against the printed page 41 text and pinned by `displacedNavalUnits.test.ts`. |
| **20 End phase** | **Implemented** | `beginEndPhase` walks the printed twelve-step order (`engine/economy.ts#endPhaseOrder`), with `resolveEnd` as the deterministic driver and live decisions where the print offers a choice: **20.1** one army step or own level 1–2 fort protection per player in seat order; **20.2** fort decay (maintained and Indian forts exempt, 12.12 errata); **20.3** non-player build box (one step, Poland two, name-space placement, Italy via the shared 22.4 plan; build-box membership and independence gates); **20.4** naval return to the nearest friendly/influence port with owner-chosen ties, enemy-occupied ports excluded; **20.5** owner-chosen standing-army trimming; **20.6** industrialisation; **20.7** truces; **20.8** WoI progress with displacement/−1/0→+1; **20.9** alliance resolution with tie choice; 20.10 WTT −1; 20.11 NG draw (1/3/5) with the return-a-Goal choice; 20.12 advance/finish and turn-flag clear. | No unwired printed rule; the remaining items are printed-unspecified interpretations: 20.1 offers “skip” only when no legal benefit exists (the benefit is mandatory) and protects only the player's own forts; 20.3's Italy `heldBack` counters are the 22.2/22.3.1/4.2 ceiling (`italianRebuild.test.ts`); 20.4 leaves a ship at sea when every legal port is full and treats an enemy-garrisoned friendly port as not friendly; 20.11 defaults to the first drawn Goal if the turn ends undecided. Audited 2026-11-23 against printed pp. 41–42 + the 12.12/20.2 errata. Tests: `endPhaseSteps`, `endPhaseResiduals`, `navalEndReturn`, `manpowerTrackChoice`, `ngDrawShuffle`, `ngLimit`, `italianRebuild`, `minorBuildIndependence`, `industryCeilings`, `economyIntegration`, `polishLimits`, `components/phaseSteps`. |
| **21–23 Rebels, Italy/Poland, crisis** | **Implemented** | Per-space rebellion state and rebel armies; **the full 22.1 Italian Minor Power Table** (`greatWar.ts#italyTable`: Lost Dream, Uprising, Petition with its permanent +1 marker, Internal War through the 4.2 pool with an interactive Sardinia-Piedmont / Two Sicilies choice, Nationalist Wave, and the `italianUnificationRoll` DRM set), **22.2 `unifyItaly`**, **22.3.1 Kingdom table incl. the Ottoman-war DRMs and the treat-as-5 fallback**, **Italy’s 5th army/22.3.1 grants**, **22.4 `redeployItaly` on the shared `italianRedeployPlan`**, **22.5 Polish recruitment/reserve/build limits and TSRR** (`engine/poland.ts`: 3 standing / 2 reserve, controlled-keys+1 cap, reserve box, two-step independent rebuild); Poland/AU/RU special cases via card handlers; **the printed Crisis Table (23.0–23.5)** as typed data + live resolver: every printed row, the Balkan States table, footnotes (`*` conference once/reroll, `**` special, `†`, `>6`), 23.3 bordering nation/minority/Balkan special results, 23.4 impossible results, 23.5 neutral players joining an alliance with the three-player limit, and the real blamed incident driving 25.3 Italy; GW outbreak; 23.1’s Powder Keg / The Balkan Wars open the crisis before the rest of their text. | 22.4's lone-defender clauses are implemented in `engine/italyMilitary.ts`: non-Rome armies displace onto the war goals, a reserve army deploys to defend/support the goals, the earliest allied player commands Italy, and Italy uses 1 industry for rail/deploy; the printed naval order is Naples, else Piedmont. “Minor powers drawn into the GW” are recorded two ways — the ally marker that decides control, and the `G.flags.gwMinorBelligerents` stamp (`greatWar.ts#gwMinorBelligerents`) that separates a *drawn* belligerent from a leftover pre-GW ally marker, per 25.2.1’s "minor power allies will not join the GW at this time"; A100’s second printed WTT increase inside the handler can still open a second crisis after its sub-decisions; some rows are reachable only when a handler raises the WTT. |
| **24–32 The Great War** | **Implemented** | Outbreak, alliances, NGs, national will, **25.7 alliance-set GW order** (`chooseGwOrder` / `rebuildGwOrder`, default seat order), order/bonus, planning/maneuver/winter, **26.0 GW discard reshuffle**, 29.1 blockade, 29.2 colonial war, 29.3 neutral entry, 30.0 key loss/recapture, 30.1 capital surrender/marker bookkeeping, 30.2 majors, **32.4 GW non-player declarations**, 15.6 knockout, 15.3 occupation, GW #2/25.3 Italy, **25.2 US chit gate during/after the ACW**, **25.4 player entrant at 0 stability +1**, 28.1 trenches, 28.1.5 trench-battle port naval movement, crisis blame, multi-ally treaties, Rome/Italy capital, 32.1 US Mexico/Canada, Ankara capital, 22.4 Italian redeployment, **15.2.3 multi-army GW deploy** and **26.2 US planning CP transfer** (engine move). | Blockade/colonial LoC traces apply Suez/Dardanelles closure; direct/event control writes route through `setSpaceControl`; `surrenderGwMajor` runs the permanent-minor sweep; 30.0 charges the dreadnought stability loss; 31.0's one-power/no-neutral condition ends the GW; 32.4 is enforced by `hostileOwner`/`legalLandBattleTarget`. Documented deterministic fallbacks: **25.5** NG top-up keeps the highest printed VP, **25.6** track boosts use the printed stability→industry→manpower order (a maxed track grants the bonus reserve army), **25.6.1** attaches the UK EC to the first on-map army.  The 25.7 order selector and 26.2 US transfer panel control are pending; both engine moves are live. |
| **33 National characteristics** | **Implemented** | Live and covered by `characteristicsCoverage` (zero display-only bullets/gaps): UK pools/India/Rapid Deployment/Join Your Country’s Army/Status Quo/CW; OT Turkish-Arab split/Local Autonomy/Europeanization/Jihad; AU Dual Monarchy/Reforms/Expand Citizenship/Incorporate/Unstable Situation/Continental Power/Metternich/New Way Forward/Arbiter; FR Third Republic/CP/Zouaves/Cultural Symbol/Second Empire/Napoleon’s Legacy; RU TSRR/Second Rome/Ankara; GE Imperial Germany/Continental Focus/Superior Staff Work/German Confederation/Zollverein/Blood and Iron!; **22.5 Polish recruitment/reserve/build limits**. | Remaining are printed-clause boundaries, not unwired abilities: Zollverein has no fuller home/source text, Poland’s total-cap interpretation, chart-less non-player rows stay null, and a few timing conventions (GE’s limited-war “first impulse” window). Round 8 added citizenship-aware Nationalist Uprising targeting, the start-of-GW Second Rome VPs and a live `refreshPowerProjection`; the campaign setup now stores the formula-derived FR 3 (RU 3, UK 8; Algeria’s naval-base station is the third French point), so the displayed track no longer disagrees with the first end-phase recompute. |
| **34 Bots, scenarios, promos** | **Implemented** | Every printed scenario (see `SCENARIOS.md`). Bot engine (rule 34) implemented in `engine/bot.ts`: Priority 1 and Priority 2 action tables, BDIT targeting, BMPIT influence, wartime priorities, GW priorities, end-phase army-build preference, and pending-decision auto-answers. The printed **BOT BOX** (9.2/34.3.4) is transcribed for all 32 cards that print one and drives B1 Priority 1 step 3 and 34.3.4’s always-play-the-event rule. Bots play both entrances: hotseat local mode has per-seat bot toggles, and an online match of 2–6 humans fills the remaining seats from `setupData.bots` with the same bot, driven on the server by `src/game/ieBotDriver.ts`. **Any seat may be a bot, not only the tail**, and a seat can be handed over or taken back mid-match: the online lobby's seat chips toggle each power (`configuration.ts#toggleBotSeat`, `e2e/lobby.spec.ts`), and `moves.ts#setSeatBot` rewrites the public `G.bots` list so the client and server drivers follow without a restart (`seatHandover.test.ts`, `board.test.tsx`). | PAC/priority dice are rolled through `engine/botRandom.ts` when the board or server ctx carries no random plugin; unlisted pending decisions roll per 34.3; GW maneuver land battles are chosen by die among the legal targets; and the power-specific home-card pile order follows 34.2/PAC. **Audited 2026-11-21 against the printed 34.2/34.3: the four SoP rules are exact** — a stability ≤ 2 bot takes the prep stability discard, only an allied bot is forced onto one BMPIT power ("Bots will always spend all their CP to influence a single power. Exception: Neutral bots may split their CP"), and the excess-CP order is armies-then-BMPIT (`botNeutralSplit.test.ts`, 4). The home-card rule is §34.3.3's own exception ("a bot will not play its home card for its event if their stability is at 6 and their home card event would have had less of an effect"), not a simplification. Cards 21 and 82 print no bot box, so no bot auto-plays them. Every printed scenario (campaign, 1850 tutorial, 1870, 1880, Scenario 4 No-GW, Historical GW tutorial, Alternate GW 1-3) is implemented: `constant/scenarios/` holds the transcribed page data and `engine/scenario.ts` / `engine/scenarioSetup.ts` the printed per-scenario rules (`SCENARIOS.md`). Promotional cards P1–P3 remain deferred. |

### Round-8 delta (what closed)

| Rules | Closed in this pass | Principal tests |
| --- | --- | --- |
| 1–8 | 5.6 supply traces through naval boxes and is blocked by enemy naval boxes in wartime; 5.6.1 minor sea trace; 5.5.3 movement-end stacking on the free TSRR rail, GW deploy and draft. | `brokenLoc.test.ts`, `minorBrokenLoc.test.ts`, `movementStacking.test.ts` |
| 9–12 | 12.3 transports open the 19.1 interception chain (with the 19.6.1 carried-unit retreat/elimination); the first deal uses `cardsToDraw`; 12.15 redeployment follows the printed land route; A17/A18/A56 give the victim the stability-or-discard choice (A18 backfire die, A56 minority target). | `navalTransport.test.ts`, `setup.test.ts`, `usExit.test.ts` |
| 13–17 | 15.0 consecutive-pass reset; 16.2.5 colonial cessions to the primary/player allies/independent minors; 17.0/17.1 war-end displacement and blockade (shared trace in `engine/blockade.ts`). | `demobilization.test.ts`, `limitedWarIntegration.test.ts`, `treatyAllocation.test.ts`, `minorTreatyBeneficiary.test.ts` |
| 18–19 | 19.1 keeps the interrupted movement for survivors of a partial 19.8 move; 19.4 mine retreat is unconditional; 19.7 excludes the attacker’s origin box. | `interceptionContinuation.test.ts`, `mineRetreatOption.test.ts`, `ordinaryRetreatChoice.test.ts` |
| 20–23 | 22.1.3 interactive Sardinia-Piedmont / Two Sicilies choice; 20.1 skip only when no benefit exists; 23.1 Powder Keg / The Balkan Wars open the crisis before the rest of the text. | `italianInternalWar.test.ts`, `endPhaseResiduals.test.ts`, `crisisFlow.test.ts` |
| 24–32 | 30.0 dreadnought stability loss + decisive-force threshold; 31.0 second alliance-defeat condition; 32.5 rebel/player coexistence (outbreak displacement, no trenches in rebel spaces, no GW destination in a rebel space); 29.3 all-unit free redeployment; 27.5.2 one drafted army per space with the EF / elite-colonial-EF substitution. | `dreadnoughtLosses.test.ts`, `greatWarFlow.test.ts`, `gwNeutralEntry.test.ts`, draft tests |
| 33 | Citizenship-aware Nationalist Uprising targeting and rights-on-citizenship; start-of-GW Second Rome VPs; live `refreshPowerProjection`; Endless Space battle-scope fix. | `nationality.test.ts`, `characteristicsLive.test.ts`, `powerProjection.test.ts` |
| UI | Pending options carry optional Chinese labels; treaty keys render as human labels (war panel); the newer naval-limit flags are public; `deployReserves` is registered in `ALL_MOVES`; the Great War maneuver march/rail/deploy/transfer/reveal controls are now on the board. | `board.test.tsx`, `pendingKindLabels.test.tsx`, `privacyFlags.test.ts`, `components/gwControls.test.tsx` (plus the 14.0 minor-call case in `boardActions2`) |

### Round-10 delta: printed-rulebook audit (2026-11-23)

| Rules | Closed in this pass | Principal tests |
| --- | --- | --- |
| **19.11** | Displaced naval units during wartime: immediate displacement during the land move, deferred 19.1 interception window then battle, displaced fleet as attacker, no 19.2 avoidance. New queue on `G.flags.portDisplacementQueue` with resumable resolution in `combat.ts#resolveDeferredNavalWork`, hooked from the wartime land move, both pending-drain paths and the GW maneuver. | `displacedNavalUnits.test.ts` (17), plus `navalStartBattle`, `navalTransport`, `navalAvoidance`, `navalPortContinuation`, `portMinesAll`, `gwNavalContact`, `navalSequenceOrder`, `transitInterception`, `interceptionContinuation`, `combatResiduals`, `fuzz`, `selfPlayRegression` |
| 4.2 / 5.7 / 12.13.1 / 22.5 / 33 | Relabelled from stale `partial` to implemented with live helper + suite named in `RULES_COVERAGE.md` (counter chart, 5.7 displacement helpers, Ottoman Modernization, the Poland model, the 39-entry `characteristicsCoverage` registry). | `counterLimits`, `counterPoolChart`, `nonPlayerCounters`, `nonPlayerPlacementLimits`, `displacementRules`, `cardAvailability`, `ottomanRecruitmentUi`, `polishLimits`, `polishRecruitment`, `polishCap`, `characteristicsCoverage` |
| 30.2 / 22.2 | Rome is a real map space (`constant/spaces.ts` `rome`, `gwMajors.ts#ITALIAN_CAPITAL`), so Italy’s capital surrender and 22.2’s Rome conversion are live rather than inert. | `romeSpace.test.ts`, `italianRebuild.test.ts`, `greatWarIntegration.test.ts` |
| Docs | `RULES_COVERAGE.md` header snapshot refreshed to the printed book (MD5 pinned); new “Printed-rulebook audit” section; §22's 22.4 clauses now implemented and named by helper. | — (documentation only) |


## Integrated modules at this refresh

These are the newer modules and their actual wiring, not merely their tests.

| Module | What it adds | Wired into the live game? | Principal tests |
| --- | --- | --- | --- |
| `engine/limitedWar.ts` | War-aim validation, war budgets, consented ally calls/refusal penalties, initiative order, victory classification, multi-ally treaty validation/application, demobilisation and free-action entitlements. | **Yes** — imported by `moves.ts` (and `treatyChoice.ts`). | `limitedWar.test.ts`, `limitedWarIntegration.test.ts`, `allyConsent.test.ts`, `treatyAllocation.test.ts`, `demobilization.test.ts` |
| `engine/treatyChoice.ts` | Legal treaty option/space generation, per-beneficiary/per-knockout option expansion, `treatyOption`/`treatySpace` pending decisions, the realignment minor chooser, choice application and follow-up spaces. | **Yes** — imported by `moves.ts`. | `treatyChoice.test.ts`, `treatyResponse.test.ts`, `treatyAllocation.test.ts` |
| `engine/greatWarFlow.ts` | GW planning deal/refresh, in-front facedown flips, face-up combat cards, CP transfer, bonus/ally impulses, GW maneuver validation, neutral entry, winter resolution, trench creation/markers, blockade sets, the 29.1/29.2/29.3 blockade–colonial-war–neutral-entry chain, Political Pressure/Exhaustion end-of-turn enforcement. | **Yes** — imported by `game.ts`, `moves.ts` and `privacy.ts`. | `greatWarFlow.test.ts`, `greatWarIntegration.test.ts`, `greatWarFlowStability.test.ts`, `trenchCreation.test.ts`, `flagEnforcement.test.ts`, `combatFallbacks.test.ts` |
| `engine/crisisTable.ts` | Pure printed Crisis Table data + resolution: every row/column, Balkan States table, footnotes, special/impossible results, incident and blame resolution. | **Yes** — `engine/greatWar.ts#crisisRoll` and the live crisis decisions. | `crisisTable.test.ts`, `crisisFlow.test.ts` |
| `engine/characteristics.ts` | Pure national-characteristic decisions: stability loss, card draws, land DRMs, support halving, recruitment limits, citizenship, Metternich, Dual Monarchy, government benefits, special actions. | **Yes** — imported by `rules.ts`, `combat.ts`, `deck.ts`, `effects.ts` and `moves.ts` (recruitment and the AU/FR/RU/OT special moves now call it). | `characteristics.test.ts`, `characteristicsIntegration.test.ts`, `recruitmentLimitsLive.test.ts`, `characteristicsLive.test.ts` |
| `engine/nationality.ts` | Core vs minority nationalities, Nationalist Uprising candidates, AU citizenship/space matching. | **Yes** — imported by `rules.ts`, `victory.ts` and `effects.ts`. | `nationality.test.ts`, `nationalities.test.ts`, `nationalityIntegration.test.ts` |
| `engine/combatCards.ts` | Data-driven action/GW combat cards, availability conditions, printed modes, pure battle application, GW-03/04 in-front lifecycle. | **Yes** — imported by `combat.ts`, `moves.ts` and `effects.ts`. | `combatCards.test.ts`, `combatCardsIntegration.test.ts`, `combatCardModes.test.ts`, `combatCardModesIntegration.test.ts`, `combatFallbacks.test.ts`, `gw05Flip.test.ts` |
| `engine/privacy.ts` | Pure `redactForView` redaction of hands, goal decks, deck order, per-power flags (public allowlist), pending decisions and hidden-card log arguments (every `cardPlayed` line — event or CP — plus response/combat/industrialization/CP-chain plays stay public). | **Yes** — `game.ts#playerView` calls it. | `privacy.test.ts`, `privateInfo.test.ts`, `privacyFlags.test.ts`, `newPendingPrivacy.test.ts` |
| `engine/economy.ts` | Decade/turn mapping, CP-chain resolution, industry target/roll helpers, reserve allowance, printed end-phase order. | **Yes** — `game.ts` uses `beginTurnDecade`, `moves.ts` uses the CP-chain/industry/reserve helpers and walks `endPhaseOrder`, and `board.tsx` uses `cpChainResolution`. | `economy.test.ts`, `economyIntegration.test.ts`, `decadeAudit.test.ts`, `decadeLabels.test.ts`, `cardDecadeBand.test.ts` |
| `engine/playability.ts` | Printed action-event playability predicates (`eventPlayability`/`canPlayEvent`), shared by `moves.ts#playCard` and the board event button. | **Yes** — imported by `moves.ts` and `components/board.tsx`. | `cardPlayability.test.ts`, `components/boardActions.test.tsx` |
| `engine/counters.ts` | Printed 4.2 naval limits (GE/AU/OT 2/2, A092 4/4, GE Continental Focus), a documented derived army pool and `counterRemaining`/`hasCounterFor` guards. | **Yes** — imported by `moves.ts` (recruit/buildEf/constructFleet/GW draft) and `greatWarFlow.ts`. | `counterLimits.test.ts`, `overstacking.test.ts` |
| `engine/poland.ts` | 22.5 Polish independence/controller/cap/supply, reserve holding box, deterministic deploy target and the wartime extra reserve army. | **Yes** — imported by `endPhase.ts`, `limitedWar.ts` and `moves.ts`. | `polishLimits.test.ts`, `displacementRules.test.ts` |
| `engine/alliance.ts` | Alliance box helpers, the three-player cap, chit shifting and the side-of-box predicate. | **Yes** — used by the 20.9 resolution, event/card shifts, neutral entry and the call-war ally invariant. | `allianceCap.test.ts`, `greatWarFlow.test.ts` |
| `engine/endPhase.ts` | Typed non-player build box, 20.1 militarism options, 20.3 minor builds, 20.4 naval return (enemy-port exclusion), 20.5 excess-army candidates, 20.8 WoI progress and the 20.9 alliance step. | **Yes** — the live `beginEndPhase` and the one-shot `resolveEnd` walk it. | `endPhaseSteps.test.ts`, `endPhaseResiduals.test.ts`, `economyIntegration.test.ts` |
| `engine/navalMovement.ts` | 12.3 naval movement points: multi-box paths, European cruising, Suez/Dardanelles gates, port entry/exit, enemy-box/port refusal. | **Yes** — `moves.ts#navalMove` and the free demobilisation naval move. | `navalPath.test.ts`, `demobilization.test.ts` |

`engine/greatWar.ts` still owns the one-off rules (crisis orchestration, outbreak,
Italy, key-loss helper, victory) and retains older flow helpers
(`beginGwPlanning`, `endGwPlanning`, `nextGwImpulse`, `winter`, `playGwCard`)
that the live game no longer calls. The live Great War loop is
`engine/greatWarFlow.ts`.

## Exact card inventory and corrections

| Inventory | Count | Notes |
| --- | --- | --- |
| Action cards | **100** | Numbers 13–112 inclusive; ids `IE-A013`–`IE-A112`. |
| Action types | **57 event, 23 mandatory, 12 response, 7 combat, 1 mandatory-response** | Sum = 100. |
| Action CP values | **24×1 CP, 54×2 CP, 17×3 CP, 5×4 CP** | Sum = 100 cards. |
| Home cards | **12** | Two per power, all 3 CP, all event type. |
| Great War cards | **10** | All 1 CP; 5 event, 2 combat, 2 response, 1 mandatory (GW-05 corrected to `response`). |
| National Goals | **49** | 24 ranked + 25 achievement; **48 in the campaign** (AU #31 is scenario-only). Each power has 8 campaign goals. |
| 1850s deck | **58** | Cards 13–70. |
| Later decade entries | **11 / 10 / 8 / 13** | 1870s (71–81), 1880s (82–91), 1890s (92–99), 1900s (100–112). |
| Campaign turn labels | **7** | Turns 1–7 = 1850s, 1860s, 1870s, 1880s, 1890s, 1900s, 1910s. The 1860s and 1910s are label-only bands with **0** printed cards. |
| Per-turn additions | **58 / 0 / 11 / 10 / 8 / 13 / 0** | Turns 1–7; turn 1’s 58 are the setup deal. Turns 2 and 7 add no cards because the 1860s/1910s bands are empty. |
| Published card faces | **98 action, 12 home, 10 GW, 48 goal** | Missing action faces: 21 and 82; missing goal face: 22. |
| Published assets | **501 total** | 2 maps, 6 displays, 9 charts, 4 backs, 312 counters plus the cards above. |

### Corrections/reconstructions carried in the data

1. **Wilhelm II is card 82**, not 81. The module has no face image; the saved
   deck placed `Conquest of Central Asia` in the 1870s and `Wilhelm II` in the
   1880s, matching the playbook. Reconstruction: 2 CP, mandatory, 1880s, removes
   Bismarck (`IE-H-GE-1`) and then removes itself. Rendered as a text card.
2. **French National Goal 22 (`Peace in Our Time`) is missing from the module.**
   Restored in `constant/goals.ts`; 3 VP if the Great War does not occur; part of
   the 49-card inventory and the 48-card campaign pool. No face image.
3. **Card 21 (`National Railroad`) has no face image** (the module’s “21” slot is
   a duplicate of card 27). Reconstructed: 2 CP, “increase your industry by 1;
   this does not count as the one card spent to industrialize”; text card.
4. **UK display** uses the module-selected `Playerboard UK.png`, not the older
   `Playerboard UK.jpg`.
5. **Decades use printed card numbers and faces**, not the module’s image-slot
   placement: **13–70 / 71–81 / 82–91 / 92–99 / 100–112**, i.e.
   **58 / 11 / 10 / 8 / 13**. Card **100** is printed and placed in the 1900s
   band; the corrected 1890s/1900s boundary is card 99 / card 100. The seven
   campaign labels are 1850s…1910s; **1860s** and **1910s** are empty label-only
   bands with no printed cards, and no card was moved to create them.
   See [`DECADE_AUDIT.md`](DECADE_AUDIT.md).
6. **National Goal 31** (`Precarious Position`, AU) is scenario-only and excluded
   from `CAMPAIGN_GOALS` and the campaign draw pools.
7. Cards **95** and **112** genuinely share the printed citizenship/rights
   template; this is not a transcription error.

### Data corrections checked at this refresh

- **UK colonial keys are 7**, not 9 (`POWER_DEFS.UK.start`, `CAMPAIGN_SETUP`,
  `data.test.ts`).
- **Track arrays were corrected.** The UK secondary-manpower track now matches
  the printed Colonial Keys boxes (1 at box 4, 2 at box 8, 3 at box 12, 4 from
  box 17); the other key→manpower tracks were re-derived and are checked by
  `mapValidation.test.ts`.
- **Four port links were added** so every space that lists a port has a sea
  connection to that naval box. `mapValidation.test.ts` now asserts every port
  entry names a real naval box and has a sea link.
- **Egypt gained `minorHome: "Egypt"`**, with `egypt`, `sinai` and
  `great-sand-sea` under an Egypt control override and `MINOR_POWER_HOMES.Egypt`;
  `mapValidation.test.ts` pins the independent-minor start.
- **Card 100 is 1900s**; `data.test.ts`, `decadeAudit.test.ts`,
  `decadeLabels.test.ts` and `cardDecadeBand.test.ts` pin the 58/11/10/8/13
  bands and the 99/100 boundary.

## Fixed: the no-pass cards could deadlock an impulse

Rules 12.0 and 27.3 forbid passing while holding **A047 The Dual Monarchy**
(AU) or **GW #10 Exhaustion**. Because `pass` is the only exit from an action
impulse, a literal reading deadlocked the table: the holder could not pass, and
`playCard` refused any card while CP were still banked, so a hand such as
`[A043 (combat), A047, home card]` had **no legal move at all**. The seven-turn
auto-play campaign reached exactly that state on turn 5 (OT, 2 CP left) and hung
there; a human hitting the same point saw "End impulse" and "Pass" both do
nothing with no explanation.

Fixed in three places:

- `engine/characteristics.ts#passRestriction` — one pure helper naming both
  printed no-pass cards and reporting `forced` / `cpRequired`.
- `moves.ts#pass` and `moves.ts#gwPass` — the no-pass clause is enforced
  (previously `gwPass` ignored 27.3 entirely).
- `moves.ts#playCard` — 12.0's one-card-per-impulse rule is enforced without an
  exception for those cards. The legal exit is `pass`: `hasActedThisImpulse`
  already treats a played card as a used impulse, so the seat hands the impulse
  over instead of spending a second card. (An earlier `rescueMode` allowed the
  no-pass card to be played for CP on top of banked CP; that was itself a second
  card in one impulse and has been removed.) `board.tsx` still disables `pass`
  with a tooltip explaining the printed restriction, and gates the GW pass
  button.

Regression coverage: `passRestriction.test.ts`, plus the campaign auto-play
test, which had been intermittently failing (~1 run in 3) for this reason.

## Fixed: six deadlocks and duplicates found by seeded self-play

A seeded self-play harness (`tools/ie-sim/`) drives the real boardgame.io
engine — seeded random plugin, phase/turn flow, move validation and
`playerView` redaction — with the Rule 34 bot for every seat, for the 1850
campaign, a match started in the Great War, and a variant that declares limited
wars, a naval variant that builds fleets and fights 19.0 contact battles, and an
amphibious variant that stages landings next to enemy ports. Running many seeds
surfaced fifteen engine bugs that the hand-built fixtures never reached. All
eleven are fixed; fourteen are engine fixes and one (the rebel-space naval destination, see
below) was a harness gap that surfaced while sailing during a war. All are
pinned by `selfPlayRegression.test.ts`.

1. **The Dual Monarchy was duplicated.** `applyPrepCharacteristics` pushed
   `IE-A047` into AU's hand without taking the physical copy out of the deck or
   discard pile. When AU had played it for CP on turn 1 the copy sat in the
   discard pile, which the prep deck merge then shuffled back in, so the game
   carried two A047s (observed as the same card twice in AU's hand, and as one
   copy in the deck plus one in hand). It is now moved, never copied.
2. **`canRecruitIn` and `recruit` disagreed on the 5.5 stacking cap.** The
   helper said a build was legal and the move then refused it, so the hotseat
   bot re-sent the rejected build every 500 ms forever. The stacking gate now
   lives in `canRecruitIn` (reported after the power-specific reasons, so
   Professional Army / colonial / Local Autonomy messages are unchanged) and the
   duplicate check in `recruit` is gone.
3. **`canRecruitIn` ignored A83 Liberal Reforms.** `recruit` refused with "no
   armies may be built this impulse" after the helper had said legal, with the
   same deadlock. The gate is now part of the helper.
4. **The Great War winter could never resolve.** `gwWinterBegin` (a phase
   `onBegin` hook) ran `resolveGwWinter`, whose 29.2/29.3 steps open pending
   decisions; `openDecision` calls `setActivePlayers`, which boardgame.io
   rejects inside a phase `onBegin`. The whole move was then rolled back and the
   game stuck in `gwWinter` for every seed. The hook now runs the resolver with
   the events plugin removed (the same `endPhaseCtx` pattern the end phase
   already used), and the deciding seat opens the decision from its own move.
5. **The bot passed while holding GW-10 Exhaustion.** 27.3 forbids it, and the
   GW card is not in `hand`, so `passRestriction` was never asked. The bot now
   plays the card for CP — the printed escape — instead of passing.
6. **The bot attacked allies and "marched" onto enemy spaces.** In the GW
   maneuver it treated every non-own unit as an enemy (`u.owner !== power`,
   which includes allies) and named `gwMarch` for a destination that must be
   friendly. Both are refused by `performGwManeuver`. It now uses
   `hostileOwner` and the engine's own `beginLandBattle` gate.

Two more surfaced once the sweep also declared limited wars (the Rule 34 bot
never does, so the whole `wartime` phase had no coverage):

7. **A rebel space was treated as a legal GW battle target.** 32.5 forbids
   rebels and non-rebels coexisting, and the GW flow refuses that battle before
   `beginLandBattle` runs, but the bot's probe only asked `beginLandBattle`, so
   it re-sent the refused battle every impulse. The probe now asks
   `maneuverDestinationProblem` first, the same gate the flow uses.
8. **The prep stability discard was retried after it had been used.**
   `discardForStability` allows one discard per prep phase (`prepStability`),
   and the bot never checked that flag. A power that discarded but stayed at
   stability ≤ 2 then looped on the refused move forever.

A ninth bug came from the naval sweep (`navy` mode builds fleets, sails them
and fights 19.0 contact battles):

9. **A minor power's fleet crashed the 19.2/19.5 naval modifiers.**
   `beginNavalBattle` falls back to the port's control marker for `defender`,
   which is a minor name (for example an independent `Denmark`) rather than a
   player. `friendlySpace` reads `G.powers[power].alliance` and threw
   `Cannot read properties of undefined (reading 'alliance')` from
   `navalPortBattleModifiers`, `navalAvoidanceModifiers`,
   `navalRetreatDestinations`, `navalAvoidPlans` and the Gibraltar gate check.
   A battle against a minor's squadron therefore aborted mid-resolution. These
   helpers now take `PowerOrMinor` and route non-players through their own
   control/ally markers, and a non-player retreat skips the player-only route
   and gate checks.

A tenth bug came from the amphibious sweep (`amphibious` mode stages two armies
plus an escort beside an enemy port, then plays the real 19.10 landing):

10. **The GW bot attacked from a naval box.** `gwPriorityTwo` walked every
    space for a land battle without excluding naval boxes, and a box that
    shares a border with an enemy-held coast then produced
    `landBattle(box, port)`. `performGwManeuver` refuses that with "Land
    battles need land spaces" on every impulse, so the game deadlocked. The
    bot now skips boxes for both the origin and the target and still routes the
    decision through `legalLandBattle`.

Making the sweep sail during a war also exposed a **harness** gap rather than an
engine bug: 32.5's "rebels and non-rebels cannot coexist" is a Great War rule,
so the action phase has no rebel gate at all, and the sweep's route planner
happily named a GW naval move into a rebel space. The naval path now consults
`maneuverDestinationProblem` (the same gate the flow uses), which is where the
engine check already lived.

**19.1 interception was already covered.** The engine opens a
`navalInterception` *pending decision* after a naval move (the board's explicit
`navalIntercept` move is a second entry point for the same rule). The sweep
answers that decision like any other, and a run across six seeds logs dozens of
`intercept:<port>` choices, including successful battles. No engine change was
needed there.

A twelfth bug came from batch statistics rather than a single game:

12. **The Rule 34 B1 die was never rolled.** `botDecision` called
    `priorityTwo(G, power, 3, 3)` and `gwPriorityTwo(G, power, 3)` with
    hard-coded dice, on the theory that "the UI/MCTS layer should supply a real
    roll" — but `ai.enumerate` goes through the same function, so every bot seat
    in every real game used the constant. B1's rows (1 = influence/EF,
    2 = minor alliance/diplomacy, 3-4 = build armies, 5-6 = play an event)
    therefore collapsed onto 3-4, the bot played identically in every match, and
    most of the move vocabulary was unreachable. It now rolls `ctx.random.Die`
    and keeps the constant only as the documented fallback for a bare ctx.

**Batch statistics** (`tools/ie-sim/batch.test.ts`) run N seeds across all six
modes and report, deduplicated by failure signature: completion rate per mode,
result reasons, average steps/turns, every distinct fatal signature with a
reproducing seed, and the set of game moves the batch never touched. On 24
games it finishes every one with no crash or stall; the 300-game run (50 seeds
x six modes, sharded across four processes and merged with
`tools/ie-sim/batch-report.js`) is what surfaced bug 13.

That report also measures a bot limitation rather than an engine bug: `buildFort`
and `placeMpit` absorb almost every action impulse because `priorityOne`'s army
rules nearly always apply, so rows 1-2 of the B1 table are still rarely reached
even with the die fixed. The move-coverage line in the batch output is the
standing reminder; raising it would mean changing the bot's strategy, which is
out of scope here.

A thirteenth bug came from the 300-game batch — one game in 300, which no
single-seed sweep had ever hit:

13. **A non-player defender could own a decision nobody can answer.** A unified
    Italy that entered the Great War on its own fights under `"IT"`, which is
    not a seat. `defenderSupportPower` returned `battle.defender` whenever it
    differed from the attacker without checking that it was a *player*, so
    `defenderHasPlayer` reported "a player decides". The engine then skipped
    its no-player fallback and opened a `combatLosses` decision owned by `"IT"`.
    `resolvePending`/`declinePending` only accept a seat, so the decision could
    never be answered and the game deadlocked. `defenderSupportPower` now
    returns only a real player, and the combat-card path refuses outright when
    the defending side has no player.

A fourteenth bug came from the card-effect **combination** sweep
(`tools/ie-sim/cardCombo.test.ts`), which plays every ordered pair of playable
action cards on one state — the existing `fuzz.test.ts` only plays each card
once on a fresh board, so it could never see this:

14. **A027 Foreign Investment left one physical card in two zones.** The event
    parks the card face up in front of the Ottomans or Russians as that
    player's industrialization card, but the decision resolved *after*
    `playCard` had already pushed the card into the discard pile (and
    `finalizePendingCard` pushed it again). A card that is a player's industry
    slot is now never also discarded, in both the event tail and the pending-card
    finaliser. The sweep also hardened the `polishRevolt` random-discard index
    against an out-of-range die, which previously threw on `cardById(undefined)`.

## Fixed: one card per impulse, and three bot deadlocks it reached

Rule 12.0 gives an impulse exactly **one** card play (for CP or as its event)
and then the CP that card provides. `playCard` only refused a second card while
CP were still banked, so spending the last CP — including the 2 CP a mandatory
event grants — let the same seat play a second card in the same impulse, i.e.
take two impulses in one. `impulseAlreadyUsed` now reads the whole impulse
(`cpRemaining > 0` **or** the action-phase `actionCpSpentThisImpulse` flag), and
`cardAvailability` uses the same predicate so the disabled buttons agree with
the refused move. The old `rescueMode` exception for the printed no-pass cards
(A047 / GW-10) was itself a second card in one impulse and is gone: a used
impulse can always be handed over through `pass`.

That stricter rule then exposed three latent "no legal move" bugs, all
pre-existing and all found by the seeded self-play harness:

- **A040 British Trade's extra home card was unplayable.** The card explicitly
  puts the home card *not* chosen this turn into the UK's hand, and a home card
  in hand forbids passing (12.0) — but `playCard` only accepted the card
  selected during Diplomacy. Hand membership is the printed criterion, so the
  selection-only guard is gone; the diplomacy selection still decides 12.13's
  industrialization slot. The bot also plays a home card in hand rather than
  naming a refused `pass`.
- **The bot never started a war's maneuver step.** A war sits in `warAim` and
  `alliance` before `maneuver`, and `deployReserves`/`landBattle` require
  `maneuver`. The bot went straight to `deployReserves`, which the engine
  refused forever; it now presses the board's own "start maneuver" move first.
- **The bot built armies its counter pool could not supply.** 4.2's printed
  counter pool is enforced by `recruit` *after* `canRecruitIn` says "legal", so
  the build helper now checks `hasCounterFor` too (a reduced army of the same
  kind upgrades in place and needs no new counter). The same guard applies to
  the auto-industry branch, which used to name a card already parked in the
  industry slot.

Regression coverage: `oneCardPerImpulse.test.ts`, `botSelfPlay.test.ts` (each of
the three decisions is executed against the real moves), `passRestriction.test.ts`,
`cardAvailability.test.ts` and `cpAnyCard.test.ts`. On seeds IE-SIM-1 and
IE-SIM-2 the seeded campaign and war sweeps finish with no rejected move; the
remaining harness stalls on other seeds are pre-existing gaps in master (the
Great War card window and an Italian Nationalist Wave livelock), not this rule.

The card sweeps now cover three axes, all reporting second-card refusals
separately — once an earlier card has changed the board, a printed playability
gate legitimately refuses the next one, and that is not an interaction bug:

| sweep | scope | result |
| --- | --- | --- |
| `cardCombo.test.ts` | every ordered pair of playable **event** cards | 6642 pairs, 0 failures |
| `cardTriple.test.ts` | deterministic sample of ordered **triples** (a cover pass puts every card first, middle and last, then a seeded sample) | 20000 triples, 0 failures |
| `cardComboSituations.test.ts` | every ordered pair in each board situation — action, wartime maneuver, wartime alliance, Great War | 33042 / 35766 / 30002 / 32742 pairs, 0 failures |

The situation matrix is what reaches the four `warOnly` responses (A023/A024 in
a maneuver, A063/A064 in the alliance step): they are `response` cards, so the
event-pair sweep never sees them and the action-phase sweep correctly refuses
them. Each situation pairs only the cards its own gates admit, and the differing
pair counts (35766 in a maneuver vs 30002 in an alliance) are that measurement.
`responseCardEligibility`/`eventPlayability` decide entry, so `playResponseCard`
is used where it is the right move.

A fifteenth bug came from a state-stress sweep that pushes card effects against
deliberately extreme boards (empty hands, one-card hands, no reserves, no
manpower/industry, stability pinned at both ends, every speaker fortified, an
eliminated power, the whole board industrialised, the WTT pinned at 5):

15. **Five "discard a random card" effects could index past the hand.**
    `nationalism` (A056), `revolution1905`, `nationalistUprising`,
    `empireOfTheSun` and the `stabilityOrCard` prompt computed
    `die(ctx, hand.length) - 1` and used it directly. A real die cannot escape
    its range today, but any out-of-range face — a migrated save, a mocked die,
    a future caller passing the wrong `sides` — indexed past the hand and threw
    `unknown card undefined` from `cardById` instead of discarding nothing.
    A040/A041 Polish Revolt had already been patched in an earlier round; all
    of them now go through `rules.ts#randomIndex`, one clamping helper, and a
    regression test drives every one of them with faces 0, 1, 3, 6 and 99.

**The prep discard and the diplomacy gift were not random.** Both moves used to
take a `cardId` from the client, and the dock/hand panel rendered one button per
candidate card (`ie-discard-<id>` / a `giveCardId` dropdown with a face preview).
The printed text is a *draw* — the prep discard is "discard a random card" and
the 11.1 gift is a random card draw — so a pick let a player keep the good card
and dump the one that was about to be reshuffled, or push a chosen card onto an
ally. `discardForStability(G, ctx)` and `giveCard(G, ctx, target)` now take no
card, resolve it through `randomIndex` and exclude mandatory events (and home
cards, which never leave their owner); the UI renders a single "discard/give a
random card" control. `randomDiscardAndGift.test.ts` pins the die→card mapping
in both directions, the exclusions, and the once-per-phase guard.

**Follow-up audit: the same class elsewhere.** After fixing the random-index
crash, the remaining unchecked `[0]`-style accesses (138 of them) were audited
rather than patched blindly. Two new sweeps now cover the risk without asserting
on every line:

- `tools/ie-sim/exceptionHunt.test.ts` runs a wide seed sweep and asserts only
  "no engine exception", reporting the first stack frame inside
  `src/imperialElegy` so a failure names the line. 60 games across all six modes:
  no exception.
- `tools/ie-sim/saveMigration.test.ts` deletes one documented optional field at
  a time — then all of them plus the container records — and keeps *playing*
  afterwards, because a save that only survives loading is not enough. A
  progress guard asserts each scenario actually advanced the game, so the suite
  cannot pass vacuously.

Neither found a new defect, which is the useful result: the remaining index
accesses are guarded, and the migration is additive as documented.

**Data cross-check against the publisher's module.** The setup numbers in
`constant/setup.ts` were transcribed by hand, and no logic test can catch a
transcription slip. `tools/ie-sim/moduleCrossCheck.test.ts` uses the generated
`campaign-setup.json` (591 pieces from the publisher's own VASSAL save) plus the
map's zone polygons in `module.json` to put each piece on a printed space, then
requires our setup to agree on which power starts where.

Reading the module surfaced four naming conventions that a naive comparison
gets wrong, and the test now records them instead of tripping on them:

- the module labels a minor's army by its **space** (`Piedmont 1st Army/0`,
  `Naples 1st Army/0`, `Ethiopia Army/0`), not by the minor's name;
- India's army is `Indian Army/1`, not a UK unit (our setup's
  `special: "indian"`);
- an expeditionary force is `EXP Force/1` (`South Africa`, `Russian Far East`);
- display markers (`FP …`, `VP & PP`, influence, pacification, fortress
  markers) sit on the map but are not space units — 24 of the 100 main-map
  pieces are these.

The remaining genuine differences are in one table — a UK influence marker in
Belgium, the Indian Army in India, and the garrisons in Lombardy and Sevastopol —
and a second test keeps that table honest: a note that no longer matches
anything, or whose space no longer holds that owner's unit, fails. That test
already removed one note the author had added defensively.

The same treatment applies to the **card decade bands**.
`tools/ie-sim/deckBands.test.ts` compares our assignment against the module's
saved deck placement (`data/generated/deck-entry.json`, 42 cards across
1870s–1900s). It checks three things, each in both directions:

- the band sizes are 11 / 10 / 8 / 13, matching the module's groups;
- every module entry sits in the band the module files it under;
- every card we place after the 1850s band appears in the module's list, so a
  band cannot be invented here rather than transcribed.

One printed spelling variant surfaced — the module's deck label says
**"Dreadnaught"** where the card face and our data say **"Dreadnought"** — and
it is handled as a documented variant rather than by fuzzy matching. A probe
confirmed all 42 entries match a card title **exactly** after normalisation, so
the prefix fallback was removed: a fuzzy match would only hide a future
misfiling behind a plausible-looking hit.

**Verification:** the sweep at `IE_SEEDS=IE-SIM-1…10` finishes every campaign
with zero refused moves and zero invariant breaks; the limited-war sweep
(`W-1…8`) declares wars, runs the wartime impulses and settles them; and the
Great War sweep (`GA-1…6`, `GW-1…2`) runs planning → maneuver → battles →
winter (including the colonial transfers and neutral entry) to a decisive
result; the naval sweep (`N-1…10`) adds fleet builds, sea moves and naval
battles; the amphibious sweep (`A-1…8`) performs ~200 real 19.10 landings. A
mixed stress sweep (`tools/ie-sim/stress.test.ts`) adds random pending choices
on half the seeds, and the naval runs answer the 19.1 interception decision
dozens of times. The full Jest suite is **438/438 suites, 4093/4093 tests**, and `tsc` plus the
server `tsc` are clean; `tools/` is excluded from `yarn test` because the batch
sweep alone takes minutes and is run explicitly instead.

## Known fallbacks and simplifications

### Treaty, peace and war settlement

- `resolveWar` classifies the result (major/normal/defensive/negotiated/white
  peace/ally knockout) and opens an interactive `treatyOption` decision for the
  winning primary when legal options exist. The winner may choose territorial
  cession, realignment, war reparations, righteous defense or colonial cession,
  optionally pick a follow-up `treatySpace`, or finish early. Declining settles
  the war without a treaty.
- **Ally calls are consented (14.0).** `callWarAlly` opens a private
  `warAllyConsent` decision for the called ally. Accept re-validates and joins
  through `joinWarAsAlly`; refuse (or `declinePending`) applies
  `applyAllyRefusal` — committed box: −1 stability and +10 neutral MPIT;
  aligned box: +5 neutral MPIT; a truce-forced refusal is exempt. A refused
  ally is recorded on the war and cannot be asked twice.
- **Multi-ally treaty allocation is live.** Treaty options expand per eligible
  beneficiary (primary first, then participating player allies) and per
  knocked-out enemy ally. Printed limits are enforced: only territorial cession
  and war reparations may go to allies; realignment and colonial cession stay
  primary-only; righteous defense may return a defender home to a defender
  ally. Entity ids keep the bare option id for primary+primary (stored-pending
  compatibility) and use `@ALLY` / `#KNOCKOUT` suffixes otherwise. Every
  allocation is logged.
- **Demobilisation free actions are live.** After settlement the move layer
  opens an optional `demobilizationFreeAction` decision for each entitled power
  (winning side first), offering one free move per land/naval unit and a
  destination sub-decision. No CP is spent, no battle/support can start, ports
  must be friendly, and the actions are archived on the war
  (`freeActionEntitlements`, `freeActions`). Done/decline advances to the next
  power; eliminated/no-action powers are skipped; the action phase resumes with
  the winner.
- **Truces are enforced (13.5 / 16.3).** `war.truceTurns` is set (1 for white
  peace, 2 otherwise) and decremented in `resolveEnd`. `truceRivals(G, power)`
  lists every belligerent on the other side of a settled war whose truce is
  still running; `declareWar` rejects a target under truce, and `callWarAlly`
  passes `truceWith: truceRivals(G, ally)`, so an ally cannot join against any
  truce partner (the block carries no refusal penalty, as printed).
- `surrender` sets `war.status = "victory"` and a victor, then the normal
  `resolveWar` classification/treaty path handles the rest.
- `war.treaties` is populated by `applyTreaty`; the once-per-option rule is
  enforced.
- **Fixed in this pass:** 16.2.1’s mandatory cession (liberation/Italian
  unification) is enforced; a both-sides-knockout white-peace order is
  negotiated (proposal → response → counter → initiative fallback); 13.4.1’s
  abandonment −1 and 14.0’s committed-box −1 stack.
- **Remaining gaps:** treaty beneficiaries are independent minors, not arbitrary
  neutral minors; free redeploy/naval moves reuse the existing
  destination/NMP simplifications.

### Crisis table

- `engine/crisisTable.ts` carries the printed **23.0–23.5** table as typed frozen
  data: all ten rows (Assassination; Naval Arms Race; Powder Keg/Balkan Wars
  Steps 1–2; The Black Hand Steps 1–2; Bosnian Crisis; Moroccan Crisis/‘Urabi
  Revolt; Impulsive Leader; Alliance System/Shifting Alliances), the six result
  cells per row, the Balkan States table and the `*` / `**` / `†` footnotes.
- `crisisRoll` rolls `d6 + crisisDrm` once, resolves the inciting card’s printed
  row and either returns an International Conference (GW does not start, WTT
  reset to 4, once per game; a second conference result rerolls) or applies the
  printed special result before `outbreakGreatWar` (23.2; the rest of the
  inciting event’s text is ignored on outbreak).
- Special results are live: bordering nation (active player picks a legal
  bordering power), minority nationality, Balkan Table (roll once/twice,
  reroll non-independent states, Choice = player pick), 23.3.2 Bosnian Crisis
  puts the states in the alliance opposing AU, 23.3.3 Balkan Wars/Powder Keg
  resolves the threatened state and respondent, and 23.4 impossible results
  remain narrative with the GW still occurring.
- **23.5 neutral players joining an alliance** is live: the single neutral
  freely chooses a legal side (<3 players and not larger than the opposing
  alliance); multiple neutrals are allocated randomly. The real blamed
  incident/result now drives 25.3 Italy’s forced entry; the old card-id list is
  only a fallback for callers without table context.
- **A067’s +2 crisis DRM** is live.
- **Remaining gaps:** minor powers drawn into the GW are recorded as ally
  markers (no minor-belligerent list in the GW state); Powder Keg/Balkan Wars
  apply their whole handler text before the crisis opens, so the “rest of the
  text is ignored on outbreak” rule is enforced only for effects after the
  handler; a step-2 conference on those rows is treated as “no respondent”;
  the bordering relation is derived from land connections between printed home
  spaces (a strictly European reading may be preferred); some rows are only
  reachable when the inciting card actually raises the WTT.

### Card targets

- Explicit, validated choices now exist for **Second Opium War** (UK then
  France), **Rebellions in China** (active player, then another player), **Berlin
  Conference** (printed placement order; Italy via its ally; Belgium marker;
  12.5.2 one-influence-marker-per-player-in-Africa until the event, then
  permanently lifted; 12.6 removal exception), **Urabi Revolt** and **Moroccan
  Crisis** (full private card auctions — sequential face-down bids, d6 + CP,
  Egypt +2, UK aid, rerolled ties, control/colonial-home transfer, WTT +1 at
  two or more cards), **Naval Arms Race** (target validation, two-turn build
  discount, alliance shifts, 4/4 naval-limit flags), **High Seas Fleet**,
  **Empire of the Sun** (Korea/Manchuria, defender discard, Pacific naval
  DRM/losses), **The Balkan Wars** (printed roll, independence selection,
  Macedonia award) and **Submarines** (blockade condition, ±2 DRM, printed
  table). **Political Pressure**, **Exhaustion**, **Nicholas II** and **The
  Young Turks** now enforce their stored flags (see below).
- **Still simplified or gapped:** auction cards are not publicly revealed
  after the auction; a few older specials still auto-pick or log only; both
  contingents of a GW joint naval operation must start in the same box.
  **Closed 2026-11-20:** Loose Grip takes every named Ottoman space (no choice);
  Political Pressure's "occupying an empty enemy key" clause is live
  (`notePoliticalPressureOccupation`); Exhaustion already activates at the
  impulse boundary (`queueGwExhaustion` / `activateGwExhaustion`); the Balkans and
  every other displacement now go through 5.7's closest-friendly-LoC helper.
  **Closed 2026-11-21:** the printed triggers on A44/A65/A67/A89/A109 are
  engine-wide; Egypt's live colonial home key drives 12.4/30.0/A78 and the
  board; `gwJointNaval` is pinned across three sea connections.
- A few older specials still auto-pick or log only (the specific Italian table
  results, several “log-only” display effects).

### Combat cards

- The window is data-driven: all seven action combat cards (`IE-A043/A058/A059/
  A060/A061/A062/A066`) plus GW-03–GW-06. Action cards are hand-only and pre-GW;
  GW cards come from `gwCard` and from face-up in-front cards.
- **A061** offers its +2 and no-mines modes; **A066** offers its no-mines and
  +1 naval modes. A060 applies its −1 to the opponent. Mines are deferred until
  after the pre-dice window, so A061/A066 can cancel them.
- **A058 Siege Guns** reduces a fort by two levels before the dice and queues the
  printed end-of-battle draw; a removed sole defender ends the battle without
  dice and the attacker advances.
- **A059 Flank Attack** is attacker-only, puts one step loss on an enemy army
  before the dice and queues the extra draw; removing the last step ends the
  battle as a battle-level decisive victory (not a war-level major victory).
- **A062 Miscommunication** opens an explicit support-denial choice, strips any
  committed support from the chosen space and recomputes BDRM; a decline
  reopens the choice.
- **A043 At Any Cost** requires a German elite corps, gives +1 and queues the
  end-of-battle draw; its discard-pile special discards a hand card (never a
  mandatory event or home card) and does not draw the extra card.
- **A061 Ironclads** cannot be used after Dreadnoughts; if drawn afterwards it
  is removed and replaced.
- **End-of-battle draws** are queued on `battle.extraDraws` and drawn by
  `finishBattle`, including battles that ended before dice.
- **GW-05 Capable Commander** is a post-dice reroll (one per battle, machine-gun
  floor, differential/CRT recomputed) and its normal-event mode flips one
  facedown in-front card face up once per impulse.
- **GW-03/GW-04 lifecycle** is live: the +2, trench cancellation from GW turn 3,
  placement face down in front of the opponent, planning flip, public identity
  and both-cards-in-hand are modelled.
- **GW-06 They Shall Not Pass** keeps the losing land/naval units in the space
  and can be revealed face up.
- **Remaining:** trench markers are created by GW terrain/markers, but the
  full 28.1 trench-battle state machine is simplified (see §18–19); combat
  cards remain limited to the listed printed set.

### Response cards

- `responseWindowFor` opens the response window at the start of an action
  impulse, a limited-war maneuver impulse, the limited-war alliance step and a
  Great War maneuver impulse. It requires no pending decision, no battle, and
  the active power for action/maneuver/GW windows; at the alliance step every
  belligerent may answer.
- The start-of-impulse rule is enforced against the recorded spend flags:
  `actionCpSpentThisImpulse` and `cpRemaining` for the action phase,
  `warCpSpentThisImpulse` for wartime maneuver, and `gwActionsThisImpulse` for
  the GW maneuver. Responses cannot be played mid-impulse.
- `responseCardEligibility` enforces `CardDef.warOnly`/`gwOnly` and the printed
  per-card windows: A023/A024 are maneuver-only, A063 is legal at the
  alliance-to-maneuver transition and the maneuver step, and A064 is
  alliance-step only. Action combat cards and GW-06 are rejected from this path
  and remain in the battle card window.
- The board renders the response control only for the eligible seat and disables
  it with the same reason; spectators and non-active seats do not get the
  control.
- A065 and A067 resolve their two printed options through the generic
  card-option pending decision. A066 is a combat card and is handled by the
  combat window.
- **A063 is fully wired:** `startWarManeuver` puts the playing belligerent
  first, the first maneuver deploy may be free (`rapidFreeDeployUsed`), and
  `deployReserveLimit` adds one to the half-industry total for the rest of the
  war (still capped at three).

### Flags and values now read by the live engine

- `A063` (“Rapid Mobilization”) sets `G.flags.rapidMobilization` and stamps the
  playing belligerent’s `flags.rapidMobilization`; `startWarManeuver` reads both
  and moves that belligerent to the front of the initiative order.
  `deployReserveLimit` reads the stamp for the extra reserve army and
  `rapidMobilizationFreeDeploy` reads it for the free first deploy.
- **GW-08/GW-09 Political Pressure is enforced.** The cards target a player with
  war budget ≥2 that is adjacent to an enemy army; the target and the GW turn
  are stored (`persistent.politicalPressure`), a land attack is recorded in
  `beginLandBattle` (`flags.landAttackTurn`), **and the printed "occupying an
  empty key controlled or occupied by an enemy" clause is recorded by
  `notePoliticalPressureOccupation`** from the great-war march/rail path.  At
  `resolveGwWinter` an unsatisfied, still-adjacent player loses 1 stability; the
  flags are then cleared.
- **GW-10 Exhaustion is enforced.** On GW turn 0 it does nothing; otherwise the
  player chooses “stability” (major/decisive defeats cost 2 instead of 1) or
  “vp” (only if a neutral player exists; every GW belligerent loses 1 VP). The
  mode is stored in `persistent.exhaustion` and cleared at the end of the GW
  turn. Its no-pass clause remains live.
- **A093 Nicholas II** makes God Save the Tsar grant stability only on a roll of
  3+; **A106 The Young Turks** places an EC, grants permanent +1 Turkish
  manpower (applied in `recomputeTracks`) and raises the Ottoman EC cap from 1
  to 2. **A110 Extreme Militarism** is read through `reserveAllowance` /
  `reserveRemaining`.
- `GW-05`’s legacy `persistent.gwCardFlipped` flag is not read; flip state is
  authoritative in `G.gw.combatCardsInFront`.
- **Remaining:** `A063`'s war-window priority is covered by the no-pass section;
  no other unread flag is known beyond the deliberate GW-05 legacy field.

### CP chain, decade, industry and card economy

- **CP chain (12.14) is live.** `cpChain` moves up to two cards from hand into
  `PowerState.cpChain`; chained mandatory events resolve immediately, controlled
  by the active player. `useCpChain` starts one chain-funded impulse per action
  phase, setting `cpRemaining` to the banked total capped at 4. The cards remain
  face-up until the action phase ends, when `discardCpChainsAtActionEnd`
  discards them and clears the chain flags; nothing returns to hand and no CP
  carries over. The board renders the chain and a “Use CP chain” button. Chained
  cards cannot be used to industrialize.
- **Decade advancement is live.** `prepBegin` calls `beginTurnDecade`, sets
  `G.decade`, and passes its `entering` list — already filtered against
  deck/discard/removed, hands, home slots, CP chains and the industry slot — to
  `prepareDeck`. `resolveEnd` also sets `G.decade` after the turn increment.
  `deck.ts` re-exports economy’s canonical `decadeForTurn`; there is one
  implementation.
- **Decade labels are live.** Turns 1–7 map one-for-one to 1850s, 1860s, 1870s,
  1880s, 1890s, 1900s and 1910s. The 1860s and 1910s are **empty label-only
  bands**: no action card is printed for either, so `beginTurnDecade` returns
  `entering: []` for turns 2 and 7 and no card was moved. See
  [`DECADE_AUDIT.md`](DECADE_AUDIT.md).
- The first deal uses the printed `cardsToDraw` formula (industry, stability,
  flashpoints and characteristics); later prep deals use the same helper.
- Industrialisation is a card + end-phase roll (`d6 + CP + DRM` vs 5; RU/OT need
  6) and `resolveEnd` uses `industryTarget`/`industryRollNeeded` plus the
  `autoIndustry` chit. The Second Industrial Revolution DRM, Foreign Investment
  auto-industry path and OT “no own card” restriction: the OT restriction is now
  enforced; the Second Industrial Revolution/Foreign Investment paths remain
  approximations.
- Berlin Conference’s 12.5.2 one-influence-marker-per-player-in-Africa limit is
  enforced until the event, and 12.6’s removal exception after it.

### Naval and amphibious

- `navalMove` is a 1-CP move that traces the printed **12.3 NMP** path through
  connected sea boxes and ports (`engine/navalMovement.ts#planNavalMove`):
  unlimited European cruising, 1 NMP per non-European box entry, free port
  entry, Suez/Dardanelles gates, enemy-occupied boxes and enemy ports refused
  (a battle is a separate action), and movement ends on entering a port.
- **19.10 amphibious assault** is live: an enemy port with at most 2 armies, a
  legal origin box/loading port, a 2:1 escort when enemy naval units are
  present, the −1 amphibious DRM, and an unopposed landing that occupies the
  port.
- **19.1 naval interception** is live: after the mover’s `navalMove`, a defender
  may intercept from a port; 19.1.1 DRMs apply, a 5+ total starts a naval battle
  with the active player as attacker.
- **19.7–19.9 naval retreat/occupation/port-fort rules** are live; GW joint
  naval operations (`gwJointNaval`) are live. Naval units do not use the land
  retreat/advance code; `finishBattle` has a dedicated naval path.
- **19.2 naval avoidance is live:** a naval move or explicit `navalBattle` that
  contacts the enemy first opens a cross-seat `navalAvoid` decision for the
  defender (legal friendly port/box destinations, printed 19.2 DRMs,
  split-port fallback, 5+ roll; failure gives the printed −1 and starts the
  battle; intercepted/intercepting ships are never offered avoidance).
- **19.0–19.2 contact chain:** a move that contacts enemy ships opens every
  adjacent hostile port’s interception attempt first (in deterministic order),
  then the defender’s 19.2 avoidance; a successful interception fights
  immediately and never offers avoidance. The GW naval/joint-naval maneuver
  uses the same contact chain.
- **Remaining:** general action-phase joint naval operations are not exposed;
  amphibious loading starts from a friendly port because there is no separate
  naval-transport move; both GW joint-naval contingents must start in the same
  box (the move itself traces the full 12.3 NMP route, several boxes at a
  time); 19.1’s “continue after winning an interception” is not implemented;
  19.5’s port-count DRMs feed the 19.2 avoid roll rather than the battle dice.
- Interception/avoidance/amphibious for the **GW** follow the same limitations;
  `beginLandBattle`’s amphibious flag is now reachable from `amphibiousAssault`.

### Great War

- **30.0 key loss/recapture is live.** `finishBattle`’s land advance calls
  `applyGwKeyCapture`: the controller of a captured territorial key on the main
  map (or of its own home key on the Asia/Africa submaps) loses 1 stability via
  `applyKeyLoss` (RU Scorched Earth absorbs the first one), and a power that
  recaptures its own such key gains 1. An occupier driven out of an enemy key
  loses nothing. `applyKeyLoss` counts an enemy occupation as a loss even
  though `control` is unchanged during the GW.
- **28.1 trenches are live.** At the start of GW turn 1 every printed
  key/capital/subcapital (including minor home keys) gets `SpaceState.trenchLine`;
  turn 0 has none. Attacks need a full-strength army in the main force, the
  attacker takes the printed extra step loss, support into a trench battle is
  halved, draft is refused in a marker space, and the trench-battle marker
  lifecycle (`attackerAdvantage`/`deadlock`/`defenderAdvantage`) is tracked.
  GW-03/04 can cancel trenches with committed support FP recomputed.
- **US and Italy entry (GW #2) is live**, including the US alliance chit, Italy’s
  4–6 roll, the remove-and-replace fallback, “no US on GW turn 0”, the entered
  major’s own impulse on its own budget, and **25.3 Italy at the outbreak**
  (neutral stays out / aligned rolls 4+ / committed joins / a blamed incident
  forces the join), with an independent Italy taking its Italian home keys and
  its own `"IT"` slot.
- **US/Italian stability and surrender are live** (`engine/gwMajors.ts`): the US
  loses 1 on a US army elimination, a US-led decisive defeat, or enemy naval
  units in the North Atlantic at winter; Italy loses 1 on an enemy-occupied
  Italian home key or an Italian-led decisive defeat and gains 1 on a retaken
  key; at 0 stability the major surrenders and its units leave play. **Italy’s capital surrender now works:** the printed `rome`/Papal States space
  exists, and an enemy-held Rome immediately surrenders the independent Kingdom
  of Italy (units removed, re-entry blocked). A pre-entry enemy occupation of
  Rome surrenders Italy on entry.
- **Bonus impulses (25.7.1 / 30.1):** `advanceGwImpulse` opens an alliance
  player choice (or activates its sole member) at each `"bonus"` slot. The
  alliance may pass without spending CP; bonus passes preserve ordinary pass
  history. Outbreak alternation, neutral entrants, multiple elimination-earned
  markers, next-year leading slots and saved choices are covered by
  `gwBonusImpulseChoice.test.ts` / `capitalBookkeeping.test.ts`.
- **Neutral entry (29.3) is a player procedure.** Each living neutral chooses
  whether to join a legal alliance (three-player cap, not larger than the
  opposing alliance); multiple neutrals roll off for order, and a joining
  neutral gets a free redeployment, a free deploy-reserves and the next order
  slot, while a staying-neutral player may redeploy and give one bonus CP to a
  legal belligerent. The decision is a private pending and the winter step stays
  open until the neutral chain finishes.
- **Blockade (29.1)** tracks the blockaded set from a capital→naval-box LoC
  (Baltic/Black Sea endings count; RU Pacific needs the TSRR), reduces each
  blockaded power’s maximum industry by 1 per GW year (floor 3) and clamps
  current industry; the US North Atlantic check is part of the winter result.
- **Colonial war (29.2)** applies the printed per-side modifiers (EF/elite/
  army/naval supremacy), the opposed rolls, the one/two-step losses and
  territorial transfer, the UK/RU stability effects and the 1/3 bonus CP paid at
  the next planning step. The losing side's unit loss, the winner's transfer
  and the bonus-CP split are live pendings (`gwColonialLoss` /
  `gwColonialTransfer` / `gwColonialBonusCp`).
- GW combat cards are offered from `gwCard` and face-up in-front cards,
  including the post-dice GW-05/GW-06 window. GW-05/GW-06 go to `G.gw.discard`;
  GW-03/GW-04 are placed face down in front of the opponent and flipped at
  planning. Face-up cards are tracked in `G.flags.gwFaceupCombat`.
- **30.1 capital-occupation surrender is live in the GW:** AU/RU/OT need both
  capital and subcapital; enemy occupation is immediate, idempotent and logged;
  **22.4** places one Italian army in Rome and two on the frontier, with the
  squadron in Naples/Piedmont.
- **Remaining:** non-GW 15.6 knockout is still computed only at victory;
  20.3’s Italian rebuild reads the shared 22.4 plan (`italianArmyDeploySpaces` /
  `italianNavalDeploySpace`) and reports unplaceable counters in `heldBack`;
  the 32.1 guard has no live US land route out of North America yet; a joint
  naval operation still requires both contingents to begin in the same box
  (the route itself may cross any number of sea connections on one NMP).

### Minor-defender support and windows

- `beginLandBattle` records `minorDefender` when the defending space is held by
  a minor and keeps a fallback `battle.defender` for the loss/retreat helpers.
  The decision power comes from `defenderSupportPower`:
  - a controlling player (space `ally`/`control`) gets the defender support and
    combat-card windows, so the battle is not resolved without a defender
    choice;
  - an independent minor (no player controller) opens no defender window: every
    legal support space is committed automatically (`minorAutoSupport`) and the
    defender card window is skipped. The attacker’s own units are never offered
    as defender support.
- Support is led by the defending minor for the 18.3.2 halving rule: the minor’s
  own armies are full FP, while the controller’s own armies and other minors’
  armies are halved. An independent minor can be supported only by non-player
  units in independent spaces.
- Both sides are capped at **two supporting spaces**, a space cannot be
  committed twice, a red/severe-only link cannot support, and a clear+difficult
  link is not halved.

### National characteristics: enforced vs sub-clause approximations

`engine/characteristicsCoverage.ts` records **39 `live` bullets and zero
`display-only` bullets**. The right-hand column below therefore lists the
remaining printed *sub-clause* approximations (each already carried in the
registry’s `gaps`), not unimplemented abilities.

| Power | Enforced in the live paths at this refresh | Sub-clauses still approximated |
| --- | --- | --- |
| GE | Bewegungskrieg wins initiative ties and the GW alliance goes first; German unification marks `unified` and converts German-flashpoint spaces held by diplomacy/ally to GE control; Imperial Germany’s one-time +1 manpower is granted at the next end phase; Continental Focus pacification 2 CP and 2/2 naval cap until unification; **Superior Staff Work** (one free deploy in GE’s first war/GW impulse, not stacking with A063); **German Confederation** (after a won unification war, annex Bavaria/Saxony/Hanover including a realignment gain; control, unit removal, permanent elimination, permanent home); **Zollverein** (GE-controlled German unification spaces count as territorial keys); **Blood and Iron!** (turn-1 end phase search for NG-08 and play it faceup). | Full Zollverein home/source treatment; German Confederation `homeOverride` is stamped only by the annexation (not every treaty/conquest gain); the Staff Work “first impulse” is approximated as “before GE first passes”. |
| UK | No reserve armies; global pre-GW British army limit; starting London 1st Army +1 DRM; India card/DRM; Crown Jewel; pass/save at two; Indian armies limited by colonial manpower, auto-displaced at end of turn/war and capped at 1 after independence; Indian Fort; **India independence**; **Rapid Deployment**; **Join Your Country’s Army!**; **Maintaining the Status Quo** (primary-defender neutral invites in the alliance step); **CW army** (GW only, Australia/NZ/Canada, shared colonial manpower). | The free Join-Your-Country armies bypass the 4.2 pool and may overstack London; a Status Quo invited player’s post-war draw is deterministic; the CW army uses the shared colonial ceiling. |
| FR | City of Light +1 card at ≥4; Second Empire → Third Republic at stability ≤1 or a lost war outside the GW (`applyWarEndCharacteristics` → `changeStability(..., {lostWar: true})`, with the A44 trigger stamped in the same step); Second Empire +1 GW budget; Third Republic 2 free alliance-track CP once per turn; Zouaves +1 DRM/pacification and rebuilds; **Napoleon’s Legacy** (reveal NG-24 before a conquest declaration for the printed −2 stability, publicly revealed). | Full Zouave rebuild/pacification edge cases. |
| AU | Metternich’s first two candidate alliances; Dual Monarchy card event and turn-2 add-to-hand; the three **Special Actions** — exactly as printed (Reforms 3 CP, Expand Citizenship 3 CP with the 3+/+1-per-citizen roll and the optional −1 stability for +2 DRM, Incorporate 3 CP; `moves.ts#auAction`) — so “a special action rather than a card” is the printed shape, not a gap; full Unstable Situation discard-or-marker choice; A New Way Forward; Continental Power pacification; Bind Them Together; **citizen-nationality wars of unification** and **Arbiter of Italy** liberation targeting; full citizenship also records rights and removes that nationality from Nationalist Uprising targeting (`minorityNationalitiesFor`/`auCitizenshipProtectsSpace`). | Failed Unstable Situation has no separate −1 card marker visual (the marker is applied to the card-marker total). |
| RU | TSRR +1 card/+2 keys and the free rail move once per impulse; Endless Space now keys only on the battle spaces; Agrarian industrialisation 6; Tsarist Repression through the stability table; Second Rome +2 VP for Istanbul at the end of the game and a separate +2 at the GW outbreak; Scorched Earth absorbs the first GW key loss; Russian Steamroller’s +1 reserve limit (end phase and `recruit`). The Ottoman capital switches to Ankara when RU takes Istanbul (`capitalOf`/`isBlockaded`). | The TSRR is a movement allowance, not a distinct railroad unit (as printed); Second Rome wartime control beyond the Istanbul capture flag. |
| OT | Poor Infrastructure 2-stack limit; Local Autonomy Arab/Egyptian keys and Tunisia/Tripoli land-LoC condition (typed `otLandLocKeyType`); Turkish/Arab army split with separate Arab manpower; Europeanization 6 and no-own-card rejection; Jihad gain/use/discard; A106 two ECs. | Full “Arab manpower spending” display edge cases; non-player counter rows are enforced as pools (chart-less rows stay null). |

## Test and build evidence

> **Current (2026-11-23):** the 19.11 follow-up is rebased on `origin/master`
> and has NOT yet been through a full local/served run; only targeted jest
> suites and `tsc --noEmit` were run (see the 19.11 entry near the top of this
> file). The full-suite figures below are the earlier 2026-11-15 baseline
> (460 suites / 4425 tests). GitHub Actions is the authoritative result for
> this commit.

**The full IE Jest suite passes 2641/2641 tests in 205/205 suites**; `tsc`,
`yarn build` and `yarn build:server` are clean. The three browser specs were not
rerun in round 9 (the round-8 evidence remains the latest browser smoke).
Round 8 added `powerProjection.test.ts`, `components/gwControls.test.tsx`,
`gwDraftEf.test.ts`, `redeployPath.test.ts` and `gwRebels.test.ts`; round 9
added `gwColonialLossChoice.test.ts` and `italianLoc.test.ts` and extended the
suite from 2632/203 to 2641/205.

> **Environment note (this checkout).** `node_modules` is a symlink to the main
> checkout, which has moved from `@i18n-chain/react` to `@i18n-chain/core`. The
> declared `@i18n-chain/react@2.0.1` package (and its existing
> `hoist-non-react-statics` dependency) has now been installed into that shared
> `node_modules`, so all board/log suites load under the stock
> `jest.config.js`; no repository config or shim is needed.

The seven six-workstream passes took the IE suite from **800 tests / 51
suites** to **2532 tests / 197 suites** (including the round-7 migration and UI
suites). Round-7 added:

- Round 1: `crisisTable` (23), `crisisFlow` (21), `allyConsent` (10),
  `treatyAllocation` (8), `demobilization` (6), `recruitmentLimitsLive` (14),
  `characteristicsLive` (35), `overstacking` (11), `brokenLoc` (13),
  `trenchCreation` (13), `counterLimits` (9), `amphibiousInterception` (9),
  `cardTargetChoices` (33), `flagEnforcement` (22), `endPhaseSteps` (20),
  `allianceCap` (9), `navalPath` (9) and `privacyFlags` (6).
- Round 2: `cardPlayability` (36), `egyptKeyType` (5), `boardActions` (14),
  `indiaIndependence` (11), `indianArmyDisplacement` (10),
  `ukRapidDeployment` (12), `joinYourCountrysArmy` (6), `endPhaseResiduals`
  (13), `navalAvoidance` (15), `trenchBattleSpace` (11), `movementStacking`
  (11), `minorBrokenLoc` (8), `gwBlockade` (10), `gwColonialWar` (19),
  `gwNeutralEntry` (14), `romeSpace` (15), `usNorthAmerica` (11),
  `otCapital` (8).
- Round 3: `geCharacteristicsLive` (18), `auWarAims` (15),
  `napoleonsLegacy` (8), `cardPlayability2` (19), `auctionReveal` (5),
  `boardActions2` (58), `capitalSurrender` (17), `italyRomeRedeploy` (14),
  `polishLimits` (9), `displacementRules` (9), `counterPoolChart` (9),
  `defenderShift` (14), `statusQuo` (11), `balanceOfPower` (16), `cwArmy` (10),
  `gwNavalContact` (6), `interceptionOrder` (5), `trenchRetreatChoice` (3),
  `portBattleDrm` (5), `dardanellesGate` (5), `freeActionsAllUnits` (3),
  `neutralDeployMarker` (3).
- Round 4: `capitalBookkeeping` (12), `wartimeKnockout` (12),
  `italianRebuild` (9), `minorWar` (14), `allyAidShift` (6),
  `italyRandomShift` (10), `allianceCardTie` (6), `gwNavalNmp` (7),
  `interceptionContinuation` (6), `portBattleDrms` (6),
  `dardanellesDirect` (4), `trenchRetreatPerUnit` (4),
  `polishRecruitment` (14), `tsrrRailArmy` (10), `nonPlayerCounters` (8),
  `cardImpulseWindows` (21), `looseGripSpaces` (8), `navalTransport` (14),
  `usExit` (4), `revealedGoalsUi` (3), `polishDeployToggle` (5),
  `indiaTreatyGuard` (5), `zollverein` (4), `joinYourCountryArmyPool` (4).
- Round 5: `battleDrmConsumption` (11), `turnDurationFlags` (6),
  `exhaustionImpulseBoundary` (9), `colonialTransferChoice` (10),
  `colonialBonusCpAllocation` (7), `a79Removal` (8),
  `eliminationDisplacement` (12), `formerlyControlledRail` (11),
  `gwMajorChitCleanup` (10), `minorAbandonment` (8), `seekingAid` (22),
  `loserTreatyChoice` (8), `italyAidShift` (9), `navalDrmComplete` (7),
  `dreadnoughtLosses` (4), `transitInterception` (11),
  `ordinaryRetreatChoice` (8), `nonPlayerPlacementLimits` (19), `polishCap`
  (7), `tsrrAllies` (11).
- Round 7: `italyCardResolution`, `aidRefusalPenalty`, `whitePeaceOrder`,
  `loneWarPanel`, `minorMarkersUi`, `pendingKindLabels`,
  `navalSequenceOrder`, `navalPortSplit`, `dardanellesAllied`,
  `occupationPersistence`, `permanentMinorSweep`, `frEmpireBudget`,
  `frCulturalSymbol`, `auMetternichChoice`, `auNewWayForward`,
  `geStaffWorkImpulse`, `geConfederationHome`, `joinYourCountryArmyLimit`,
  `otAutonomyKeys`, `legacySaveDefaults`, `legacySaveFlows` (21 suites).

Existing suites were also extended (notably `components/logText` for the new
bilingual log keys, and the campaign auto-play test now answers the new pending
decisions and accepts either a turn-7 or a Great War ending). A few assertions
changed where a printed rule changed the old behaviour: ally consent replaces
immediate joins; settlement leaves a declinable demobilisation pending; the
public-flag allowlist replaces wholesale flag hiding; the 12.2/A106 elite-corps
cap; the GW-03 trench fixture now uses an intra-space battle (28.1.2); and
`otCapital`/blockade now follow the enemy-held and Ankara capital.

### Commands

```sh
# IE unit tests (Jest)
./node_modules/.bin/jest src/imperialElegy

# type-check / build
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/tsc -p tsconfig.server.json
yarn build                 # tsc && vite build
yarn build:server

# all repository regressions
yarn test

# IE browser specs (preview prerequisites below; full commands in README)
./node_modules/.bin/playwright test --config=playwright.ie-regression.config.ts e2e/imperial-elegy.spec.ts
./node_modules/.bin/playwright test --config=playwright.ie-controls.config.ts e2e/imperial-elegy-controls.spec.ts
./node_modules/.bin/playwright test --config=playwright.ie-spectator.config.ts e2e/imperial-elegy-spectator.spec.ts

# asset integrity
python3 scripts/extract-imperial-elegy.py --check
```

The IE browser specs use three separate Playwright configs. The **regression**
config (5 tests, preview `:5203`) and the **controls** config (3 tests, preview
`:5201`) each start their own `vite preview` over `build/`; the **spectator**
config (3 tests) self-starts a boardgame.io server on `:4004` and a preview on
`:5202` and requires `yarn build:server` first (build the server after
`yarn build`, which clears `build/`). The default `yarn test:e2e` ignores all
three because they do not run on the dev server's origin; `yarn test:e2e:ie`
runs them. **Browser specs were rerun on this build:** 5/5 regression, 3/3
controls and 3/3 spectator passed. The full commands are in
[`README.md#ie-playwright-configs`](README.md#ie-playwright-configs).

### Targeted evidence available in the tree

| Area | Evidence |
| --- | --- |
| Card inventory, decade bands, setup, manifest | `data.test.ts` pins 100 action cards 13–112, the 58/11/10/8/13 split, 12 home, 10 GW, 49/48 goals, UK colonial keys 7 and setup quantities. |
| Map/data corrections | `mapValidation.test.ts` pins the UK colonial-manpower track, every port entry → real naval box → sea link, Egypt as an independent minor with `MINOR_POWER_HOMES.Egypt`, and map symmetry. |
| Decade audit | `decadeLabels.test.ts` (7), `decadeAudit.test.ts` (8), `cardDecadeBand.test.ts` (4) and [`DECADE_AUDIT.md`](DECADE_AUDIT.md) pin the seven-value union, the empty 1860s/1910s bands, the per-turn additions, card 100 in 1900s and the single canonical `decadeForTurn`. |
| Limited war / treaty chooser | `limitedWarIntegration.test.ts` covers declaration validation, initiative, ally calls, victory classification, treaty pending/space choices, decline, demobilisation and truce countdown; `treatyChoice.test.ts` covers option legality and follow-up spaces; `treatyResponse.test.ts` covers the realignment minor chooser; `allyConsent.test.ts`, `treatyAllocation.test.ts` and `demobilization.test.ts` cover consent/refusal, multi-ally allocation/knockout and free actions. |
| Great War flow | `greatWarIntegration.test.ts`, `greatWarFlow.test.ts` and `greatWarFlowStability.test.ts` cover planning, budgets, transfer, bonus impulse, winter, GW cards, trench creation and colonial-war stability causes. |
| Crisis table | `crisisTable.test.ts` (23) covers every printed row/column, footnotes, the Balkan States table, special/impossible results and blame; `crisisFlow.test.ts` (21) covers conference once/reroll, outbreak, pending choices, neutral joins with the three-player limit, Italy’s blamed incursion, DRM consumption and post-WTT text skipping. |
| National characteristics | `characteristics.test.ts` (pure), `characteristicsIntegration.test.ts`, `recruitmentLimitsLive.test.ts` (14) and `characteristicsLive.test.ts` (35) cover card draws, stability decisions, DRMs, support, save limits, recruitment pools, AU/FR/RU/OT special actions, Jihad, TSRR rail and government changes. |
| Combat / logistics | `combatCards.test.ts` (43), `combatCardsIntegration.test.ts` (9), `combatCardModes*.test.ts`, `combatFallbacks.test.ts` (27), `combatResiduals.test.ts` (17), `gw05Flip.test.ts` (5), `overstacking.test.ts` (11), `brokenLoc.test.ts` (13), `trenchCreation.test.ts` (13), `counterLimits.test.ts` (9) and `amphibiousInterception.test.ts` (9). |
| Card choices / GW flags | `cardTargetChoices.test.ts` (33) covers the printed target choices and auctions; `flagEnforcement.test.ts` (22) covers Political Pressure, Exhaustion, Nicholas II, Young Turks and Submarines conditions. |
| Response windows | `responseWindows.test.ts` (8), `responseTriggers.test.ts` (7), `responseCardOptions.test.ts`, `responseAlliance.test.ts` and `components/board.test.tsx` cover impulse-start windows, mid-impulse blocking, combat/GW-06 rejection, the printed A44/A65/A67/A89/A109 triggers, the crisis and pacification windows, and board gating. |
| Privacy | `privacy.test.ts`, `privateInfo.test.ts`, `privacyFlags.test.ts` (6) and `newPendingPrivacy.test.ts` cover seat/spectator redaction, hidden deck order, pending decisions, the public-flag allowlist, auction bids and face-up combat cards. |
| End phase / alliance / naval | `economy.test.ts`, `economyIntegration.test.ts`, `endPhaseSteps.test.ts` (20), `endPhaseResiduals.test.ts` (13), `allianceCap.test.ts` (9), `navalPath.test.ts` (9), `navalAvoidance.test.ts` (15), `trenchBattleSpace.test.ts` (11), `movementStacking.test.ts` (11), `minorBrokenLoc.test.ts` (8) and `components/logText.test.ts` cover the 12-step live order, 20.1/20.5/20.9 choices, the three-player cap, NMP paths, 19.2 avoidance, trench-space movement and bilingual log rendering. |
| Great War home front | `gwBlockade.test.ts` (10), `gwColonialWar.test.ts` (19) and `gwNeutralEntry.test.ts` (14) cover capital→box blockade/max industry, the printed colonial-war modifiers/losses/transfers/stability/bonus CP, and the neutral join/stay-out decisions with the three-player cap. |
| UK / India / Rome / majors | `indiaIndependence.test.ts` (11), `indianArmyDisplacement.test.ts` (10), `ukRapidDeployment.test.ts` (12), `joinYourCountrysArmy.test.ts` (6), `romeSpace.test.ts` (15), `usNorthAmerica.test.ts` (11) and `otCapital.test.ts` (8) cover 33.2.2, Indian army movement/caps, UK entry bonuses, the Rome/Papal States space and Italy capital surrender, 32.1 and the Ankara switch. |
| Card playability / UI | `cardPlayability.test.ts` (36), `egyptKeyType.test.ts` (5), `components/boardActions.test.tsx` (14), `cardPlayability2.test.ts` (19), `auctionReveal.test.ts` (5) and `components/boardActions2.test.tsx` (58) cover the printed event/power gates, A70/A54, the Egypt colonial key override, the auction reveal, all move/pending controls and bilingual pending labels. `components/board.test.tsx` also asserts that required card/Goal choices render their SVG face (home card, National Goal, combat and auction options) while space/power options stay plain buttons and a hidden bid stays hidden from opponents, and that the two random draws (prep discard, diplomacy gift) render no per-card choice; it also covers the decision dock — the phase buttons render in its bar for the acting seat only, a collapsed dock keeps the summary and those buttons while dropping the body, and the optional stability discard/give-card are tagged and say how to skip them while the mandatory home-card and Goal choices are not. |
| Capital / Rome / major powers | `capitalSurrender.test.ts` (17) and `italyRomeRedeploy.test.ts` (14) cover 30.1, AU/RU/OT capital+subcapital, idempotent elimination, 22.4 Rome/frontier placement and the Italian squadron. |
| GE/AU/FR / Poland | `geCharacteristicsLive.test.ts` (18), `auWarAims.test.ts` (15), `napoleonsLegacy.test.ts` (8), `polishLimits.test.ts` (9), `displacementRules.test.ts` (9) and `counterPoolChart.test.ts` (9) cover the GE/AU/FR abilities, 22.5 Poland, the 5.7 displacement helper and the transcribed 4.2 counter pools. |
| 8.2 / Status Quo / BoP / CW | `defenderShift.test.ts` (14), `statusQuo.test.ts` (11), `balanceOfPower.test.ts` (16) and `cwArmy.test.ts` (10) cover the declaration shift/8.4 exception, UK neutral invites, the UK becoming primary defender and the CW army. |
| GW contact / retreat / Dardanelles | `gwNavalContact.test.ts` (6), `interceptionOrder.test.ts` (5), `trenchRetreatChoice.test.ts` (3), `portBattleDrm.test.ts` (5), `dardanellesGate.test.ts` (5), `freeActionsAllUnits.test.ts` (3) and `neutralDeployMarker.test.ts` (3) cover 19.0–19.2 contact, 28.1.1 retreat choice, 19.5 box choice, 3.4.1, 17.0 all-unit free actions and the 29.3 deploy marker. `gwNavalNmp` (7), `interceptionContinuation` (6), `portBattleDrms` (6), `dardanellesDirect` (4) and `trenchRetreatPerUnit` (4) cover the GW NMP path, 19.1 continuation, battle port DRMs, direct Dardanelles paths and per-unit retreat. |
| Round-4 capital / war / Poland / UI | `capitalBookkeeping` (12), `wartimeKnockout` (12), `italianRebuild` (9), `minorWar` (14), `allyAidShift` (6), `italyRandomShift` (10), `allianceCardTie` (6), `polishRecruitment` (14), `tsrrRailArmy` (10), `nonPlayerCounters` (8), `cardImpulseWindows` (21), `looseGripSpaces` (8), `navalTransport` (14), `usExit` (4), `revealedGoalsUi` (3), `polishDeployToggle` (5), `indiaTreatyGuard` (5), `zollverein` (4) and `joinYourCountryArmyPool` (4) cover the round-4 rules. |
| Round-5 war clauses / elimination | `minorAbandonment` (8), `seekingAid` (22), `loserTreatyChoice` (8), `italyAidShift` (9), `eliminationDisplacement` (12), `formerlyControlledRail` (11) and `gwMajorChitCleanup` (10) cover 13.4.1/13.4.2/14.2/16.1.6 and the 15.6/30.1/30.2 cleanup. |
| Round-5 naval / flags / colonial / Poland | `navalDrmComplete` (7), `dreadnoughtLosses` (4), `transitInterception` (11), `ordinaryRetreatChoice` (8), `battleDrmConsumption` (11), `turnDurationFlags` (6), `exhaustionImpulseBoundary` (9), `colonialTransferChoice` (10), `colonialBonusCpAllocation` (7), `a79Removal` (8), `nonPlayerPlacementLimits` (19), `polishCap` (7) and `tsrrAllies` (11) cover the remaining printed DRMs/losses/retreats, flag lifecycles, Exhaustion timing, colonial choices/A79 and non-player/Polish/TSRR limits. |
| Browser smoke | `e2e/imperial-elegy.spec.ts` (5), `e2e/imperial-elegy-controls.spec.ts` (3) and `e2e/imperial-elegy-spectator.spec.ts` (3) cover seat switching, map/card play, a support decision, bilingual rendering, online creation, panels and spectators. Controls/regression need a manual preview (`:5201`/`:5203`); spectator self-starts `:4004`/`:5202`. |

The prior QA run in `docs/qa/ie-hotseat-2026-11-12/REPORT.md` predates this work;
the targeted counts above are the current evidence. The manifest on this
checkout contains **501** published files.

## Code/document mismatches found at this refresh

1. ~~German unification’s +1 manpower is overwritten.~~ **Fixed:** granted at
   the next end phase and kept by `recomputeTracks`. `resolveEnd` also no
   longer re-derives manpower after `recomputeTracks`, which had been
   discarding AU’s A New Way Forward bonus every end phase.
2. ~~`applyKeyLoss` is defined but never called.~~ **Fixed:** called from the GW
   land advance through `applyGwKeyCapture`.
3. ~~`engine/greatWar.ts` retains unused legacy flow helpers.~~ **Fixed:** the
   dead helpers (`beginGwPlanning`, `endGwPlanning`, `nextGwImpulse`,
   `playGwCard`, `gWScoring`, private colonial war) were removed; the legacy
   `winter` now delegates to `greatWarFlow.ts#resolveGwWinter`, and the live loop
   is `greatWarFlow.ts`.
4. ~~`enterGwAlly` is unused.~~ **Fixed:** GW #2 calls it through
   `resolveMajorPowerEntry`. GW-05/GW-06 are response-typed; GW-06 can be marked
   face-up, while GW-05’s event mode flips another card.
5. ~~Trench state has no live producer.~~ **Fixed:** `greatWarFlow.ts#beginGwTurn`
   creates trench terrain on the printed keys at GW turn 1, and the battle path
   creates/updates/clears trench-battle markers.
6. **All engine-live moves have board controls.** `rebuildZouave`, `auAction`,
   `tsrrRailMove`, `useJihad`, `rapidDeploy`, `amphibiousAssault`,
   `navalIntercept`, `navalTransport`, `playBalanceOfPower`,
   `chooseAllianceShift`, `polishRecruit`, the CW army build, `deployReserves`,
   `callWarMinor` and the Great War maneuver actions (`gwMarch`, `gwRail`, `gwDeploy`,
   `gwTransferBudget`, `gwRevealCombat`) are reachable from the board; pending
   kinds have bilingual labels; revealed goals are public. Round 8 added the
   GW controls (march/rail after choosing a land unit and destination, draft,
   deploy, planning CP transfer, faceup combat-card reveal) with a component
   suite. Round 8 gives the shared card target helpers
   (`powerOptions`/`spaceOptions`/`openSpecialSpace`) Chinese labels; round 9
   adds the `gwJointNaval` board buttons and localizes the remaining one-off
   card option labels (A65/A67 options, Balkan award, foreign investment,
   Empire of the Sun, major-power entry, GW combat-card flips, Submarines and
   Exhaustion).
7. **`openDecision` widens boardgame.io’s active seats while a decision is
   open.** Cross-seat card chains (UK/FR placements, auctions, a defending
   player’s discard choice) would otherwise be rejected because the deciding
   seat is not the active power. The rules remain gated by `G.activePower` and
   the seat check in `resolvePending`; this is a transport-level change worth
   keeping when the pending model is next revised.

## Printed response triggers and live key types (2026-11-21)

Three items that the previous pass listed as open were closed together because
each was a place where the printed text (or the map data) was cosmetic.

- **Response triggers (9.1.3).** `responseTriggerBlock` is the single live
  predicate behind both the hand button and `playResponseCard`:
  - A44 Paris Commune — closed unless France lost a war (`frLostWarTurn`) or
    lost stability (`stabilityDecreasedTurn`) in the current or previous turn;
  - A89 Cossacks — closed until Russia's stability has been decreased (past
    tense, so the loss stays a legal trigger);
  - A109 Revolution of 1905 — the same trigger, for the current or previous
    turn;
  - A67 International Conference — its only response window is the open
    `crisis` decision, where it adds its +2 DRM without replacing the roll; the
    Impulsive Ruler exception is enforced. Its printed normal-event mode is now
    reachable and applies only the WTT decrease (`eventPlayability` allows A67
    like A41);
  - A65 Indian Ocean Arms Trade — `pacify(..., "marker" | "rebel")` consumes
    the card before its own roll (and the board offers one row per printed
    effect when the pacifying player holds it), so the printed "prior to a
    pacification roll" window is the only place it can be used.
- **Egypt's live colonial home.** `effectiveKeyType`/`homeOverride` now decide
  12.4 fleet construction (`moves.ts#constructFleet` and the build row in
  `actionAvailability.ts`), 30.0 GW stability keys (`greatWar.ts#gwStabilityKey`)
  and A78's colonial-key target (`effects.ts#crackColonialTroops`). The static
  `SpaceDef.keyType` remains the printed map: the override is per-game state,
  and mutating the catalog would leak one match's A71 result into every other
  seat and save.
- **GW joint naval.** The move already used `planNavalMove` for both
  contingents; a regression now pins a three-connection joint route. The claim
  that it allowed only one sea connection per action point was stale and is
  removed. The remaining honest limitation is the shared starting box.

Coverage: `responseTriggers.test.ts` (7), `responseCardOptions.test.ts`
(rewritten A65/A67 windows), `egyptKeyType.test.ts` (+3 engine-wide readers),
`components/actionAvailability.test.ts` (Egypt build row) and
`jointTransitInterception.test.ts` (+1 multi-connection joint move).

## Card inspector: one language per view, close control always reachable (2026-11-21)

Reported as "帝国挽歌点开卡牌之后的界面移除另外一个语言的文本，关闭按钮不明显
容易被挡住 参考图表页面只留按钮不要再附带显示英文原图 点进去之后留着英文原图按钮就行".

- **One language at a time.** The inspector used to lead with the English scan in
  print-face mode and print the reader's-language transcription under it
  (`ie-card-inspector-text`, "事件文本"), so a zh_CN reader saw two copies of the
  same card in two languages. `CardInspector` now always opens on the vector
  CardFace in the reader's language; the transcription panel is gone, and so is
  the face's own "English text / 中文译文" disclosure (the inspector passes
  `showTranslation={false}`). `HandTray`'s edit-in-place body dropped its copy of
  that disclosure (`CardTranslation`) for the same reason — its rows never show
  it on the live board.
- **The original is a button, like the charts.** Beneath the card's operations
  sits one full-width toggle, `ie-card-inspector-original` — **英文原图** on
  zh_CN, **Original card image** on en — that swaps the body to the printed scan
  and back (**中文卡面 / Localized face**), mirroring the chart lightbox's
  *文字 / 印刷原图* pair. `aria-pressed` carries the state, the scan is mounted
  (and fetched) only while it is shown, and toggling resets whenever another
  card opens. The hand's `ie_card_face` preference still dresses the hand rows
  and the inspector's `data-face-mode`, but no longer decides the inspector's
  body.
- **The close control cannot hide.** The header is sticky and panel-coloured
  with a hairline rule below it, and the ✕ is now a brass-filled 36 px (44 px on
  a phone) icon button with a `关闭（Esc）` tooltip instead of a short text
  button that a long title or a tall scan could push out of reach.

Coverage: `CardInspector.test.tsx` (rewritten for the single-language body and
the toggle wiring) and `e2e/imperial-elegy-controls.spec.ts` (the inspector test
now toggles the scan, asserts the face is replaced rather than stacked, and that
the ✕ stays in the viewport).

## Another player's decision reads "xx决策中" (2026-11-23)

Reported as "帝国挽歌 其他玩家需要决策时 应该显示 xx决策中".

Every surface that reported a decision belonging to another seat used a generic
wait ("等待: 法国", "待决", "等待其他玩家决策", "有决策待处理"), so an online
reader could not tell who had to act and a hotseat reader saw the same wording
for their own decision and someone else's.

- **One phrase, `decidingText`** (`components/i18n.ts`): `法国决策中` /
  "France is deciding". The seat name is the printed power (A047's Austria
  still prints as the Austrian Empire where the rest of the UI does).
- **Seat strip.** The pending state of a seat other than the viewer is now
  `决策中` / "Deciding" instead of `待决` / "Decision waiting"; the tab still
  carries the power's name, so it reads `P3 · FR 法国 ○ 决策中`.
- **Notice.** `SeatAlert` now says `<power>决策中：<kind>` (English
  `<power> is deciding: <kind>`). A hotseat keeps the `前往` / "Go to seat"
  button; an online client renders the same notice **without** it
  (`onGo` is optional), because `resolvePending` is only exposed to the deciding
  player and seat switching does not exist online.
- **Panel, dock and badge.** The pending panel's heading, the dock summary
  (`ie-dock-summary`) and the status badge use the phrase too; the panel keeps
  the kind and prompt below it, and `t.waitingOther` still explains that the
  reader must wait.
- **Phone and hand peek.** `MobileDock` and `HandTray` take an optional
  `decisionLabel` / `decisionPeekLabel`; while another seat's decision is open
  the peek reads `法国决策中` instead of telling the reader to answer it in the
  panel. A battle or the final score (no seat to name) keeps the generic line.

Coverage: `components/SeatStrip.test.tsx` (labels and the no-`onGo` notice),
`components/board.test.tsx` (the online read-only other-seat decision names
France and has no jump button), `components/mobileDock.test.tsx` (labelled
peek, generic fallback) and `components/mobileDecision.test.tsx` (the hand
peek's labelled line).
