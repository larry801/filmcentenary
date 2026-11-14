# Imperial Elegy — implementation status

**Snapshot:** 2026-11-13 round-9 pass, workspace
`/Users/larryw/tools/filmcentenary`.
**Round-9 pass:** 29.2 now opens a losing-alliance `gwColonialLoss` decision
before the winner's transfer; 30.1's two-survivor minor-heir case uses the
printed die roll; AU's Unstable Situation is a live discard-or-marker choice;
5.6.1's Italian Exception gives unified Italy player-style LoC/supply; the
Great War joint naval operation has board controls; and the remaining one-off
card option labels carry Chinese text. The deliberately deferred 34.x content
(bots, alternate scenarios and promo cards P1–P3) is unchanged.
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
the move) instead of teleporting; 32.5 now displaces units from rebel
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

**Scope:** the six-player 1850–1920 campaign only (no bots, alternate scenarios or
promotional cards).

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

| Rules | Status | Live implementation at this refresh | Principal gaps / fallbacks |
| --- | --- | --- | --- |
| **1–4 Key concepts** | **Partial** | Seat order GE, UK, FR, AU, RU, OT; phases; active power; dice through `ctx.random`; half-FP rounding; impulse loop with pass/end-impulse. **4.2 counter pools are transcribed from the printed `counter-count` chart** for all six players **and 24 non-player rows** (armies/reserves/EC/EF/squadrons/dreadnoughts) and enforced in recruit/buildEf/constructFleet/GW draft/Polish recruitment; the printed naval limits (GE/AU/OT 2/2 until A092 4/4 or GE unification) sit on top. 4.2.1’s five-minor-ally cap is enforced by distinct minor power. | A few non-player rows the chart omits (Tuscany, Papal States, Egypt, Morocco, Korea, Mexico) stay `null` rather than invented; some printed “cannot be played by” clauses remain event-mode only (see §9–12). |
| **5 Units, stacking, LoC** | **Partial** | Typed armies, reserve armies, EC/EF, elite colonial EF, Zouaves, squadrons, dreadnoughts; two-step armies; stacking caps 3 (Europe) / 2 (elsewhere, including all OT home spaces); ports hold 4 naval units; BFS LoC and supply sources. **5.5.3 overstacking** now costs one step per overstacked stack at the start of the owning player's impulse (owner chooses; one step total) and caps contributing defenders; **5.6.2 broken LoC** costs one step at impulse start, gives −1 BDRM and forbids support; **5.6.3** displaces a peacetime broken-LoC army to the nearest friendly LoC space. | Supply now traces through naval boxes and is blocked by enemy naval boxes in wartime; the 5.6.1 minor supply sources are live, including the sea trace. 5.7 has reusable displacement helpers used by war-end and event paths, and movement-end stacking is enforced on the remaining movement paths (free TSRR rail, GW deploy and draft). The 5.6.1 Italian Exception is live: after unification, `IT` units trace a player-style LoC to an Italian controlled home key that has a LoC to another Italian controlled home key, and their broken LoC charges the combat DRM/support/impulse rules. |
| **6–7 Displays and tracks** | **Partial** | Stability, manpower, industry, territorial/colonial/Arab keys, reserves, City of Light, citizenship/rights, India stability, TSRR, Jihad; stability VP/BM/card tables, industry card counts and key→manpower tables. UK colonial keys 7; UK secondary-manpower track, four port links and Egypt `minorHome` corrected. All printed characteristic bullets are wired through `engine/characteristics.ts`/`characteristicsCoverage`. | A71’s Egypt colonial-home key type is live (explicit override plus a dynamic legacy-save fallback keyed on the UK/FR home override); India independence and Poland’s limits are live; the remaining display gaps are the per-bullet partial clauses in the registry notes. |
| **8 Alliances and MPIT** | **Partial** | MPIT placement, alliance-track shifts, the 20.9 resolution (highest total first, 2d6 + influence, ≥10 = two boxes, 8.5 reset), card-driven shifts, the **8.2 declaration shift**, the **8.6 action-phase Alliance System tie** (`allianceTie` pending), **unified Italy’s random declaration shift**, **typed Italy MPIT (8.5/8.6)** resolved in 20.9 and card events, **13.4.2 Seeking Aid**, **13.4.1 abandonment + 14.0 refusal**, and the **14.2 Italy aid shift**; 8.4’s three-player cap is enforced across 20.9, card shifts, neutral entry and calls. | 13.4.1’s abandonment −1 and 14.0’s committed-box −1 are separate penalties and now stack; the US and Italy are exempt from the cap by the printed wording; no separate alliance-resolution phase (runs as 20.9 and card events); Italy resolves after player powers. |
| **9–12 Cards and action phase** | **Partial** | 100 action, 12 home and 10 GW cards; types, decade build, prep deals, CP chain, response/combat/GW windows, save card. Card targets/playability (A41/A98/A54 windows, A59 attacker-only, GW-10 timing, A70 removal, A54 Young Turks), Loose Grip’s full Ottoman set, auction reveal and 12.3 land-plus-naval transport (incl. 32.1 US exit) are live. A98/A41 DRMs are consumed, all `duration:"turn"` flags clear at the printed boundary, Exhaustion activates at impulse end, A85/A75 are correctly scoped, and every printed characteristic bullet has a live path (`characteristicsCoverage`). | Transports now open the 19.1 interception chain at their first transit box, and the first deal uses the printed `cardsToDraw` formula; a few “remainder of turn” clauses stay approximate. |
| **Privacy / playerView** | **Implemented** | `engine/privacy.ts#redactForView` runs from `game.ts#playerView`; hides opponents’ hands/goals/goal decks/GW cards/per-power secret flags, replaces deck/discard/removed order with public counts, redacts active and suspended pending decisions, hides inciting-card fields, and masks card-naming log arguments unless the printed rules put the card faceup (events, responses, combat/GW cards, industrialization and CP-chain cards; CP-spent, saved, random-discard and refused plays stay masked). A documented `PUBLIC_POWER_FLAGS` allowlist now exposes the genuinely public flags (power projection, professional army, rapid mobilization, reserve bonus, naval limit/discount, etc.) while keeping secret flags hidden. Face-up GW combat cards remain public; auction bids are private. | Per-power flags are split by an explicit allowlist rather than a full public/private field split, so a future flag must be added to the allowlist to be visible; log entries that do not name a card are public by design. |
| **13–17 Limited war** | **Partial** | Declaration validation, war aims/objectives, budgets, ally calls, 8.2 shift, Status Quo, Balance of Power, **13.4/13.5 non-player war**, **13.4.1 abandonment + 14.0 refusal**, **13.4.2 Seeking Aid**, **14.2 Italy aid shift**, **16.1.6 two-stage knockout treaties**, **15.4.2 lone non-player WarState**, **Italy MPIT (8.5/8.6) in 20.9 and card events**, **independent-minor treaty beneficiaries**, white-peace both-side knockout sequence with chooser order, initiative, maneuver/battles, surrender, multi-ally treaties, demobilisation and truces. | 16.2.1 mandatory cession is enforced in both the interactive chooser (no early finish) and the explicit settlement path; the both-sides white-peace order is a proposal/response/counter negotiation with an initiative fallback; 13.4.1 and 14.0 stability penalties stack; 15.0’s consecutive-pass reset, 16.2.5 colonial cessions to the primary/player allies/independent minors and 17.0/17.1 war-end displacement + blockade are live; treaty beneficiaries still exclude arbitrary neutral minors. |
| **18–19 Combat** | **Partial** | CRT/BDRM, support, elites, losses, EC/EF, forts, trenches/machine guns, naval dice/mines, data-driven cards, 28.1 trench lifecycle, 19.10 amphibious, 19.1 interception/19.2 avoidance and the contact chain, GW multi-box NMP/continuation, complete 19.5 DRMs, 19.4/19.6 dreadnought-majority losses, **19.3 mine-first sequence + two-hit retreat**, **19.8 split port retreat**, transit interception incl. `gwJointNaval`, **all-port mines**, land/naval manpower exhausted, Dardanelles prompts including allied controllers, per-unit land/naval/trench retreats, movement-end stacking/port capacity and minor broken-LoC penalties. | GW-05 rerolls keep mine/trench hits outside the decisive doubling; 19.8 enumerates every legal split up to 512 list options and switches to a complete per-unit chooser above that (no lossy covering set); 19.1 keeps the interrupted movement for survivors of a partial 19.8 move; the 19.4 mine-retreat choice is unconditional; 19.7 forbids retreating into the attacker’s origin box. Interception battles cannot be avoided (19.2), and an unescorted transport caught alone gets no 19.6.1(2) elimination. |
| **20 End phase** | **Partial** | Live `beginEndPhase` walks the 12 steps and suspends on 20.1/20.5/20.9; 20.2 fort decay (Indian exempt), 20.3 non-player builds at printed counter rows (Poland 2, Italy via 22.4/5th army), 20.4 naval return, 20.5 owner trimming (CW on the colonial track), 20.6 industry, 20.7 truces, 20.8 WoI, 20.10 WTT, 20.11 NG draw, 20.12 advance + turn-flag clear + Italy 8.6. | 20.1 offers “skip” only when no legal benefit exists (it is the deterministic fallback); 20.5 prints no track-choice (each track trims itself); 20.8 follows the printed displacement/−1 stability/0→+1 flip; 20.3 Italy keeps some unplaced counters in the box when the chart is full. |
| **21–23 Rebels, Italy/Poland, crisis** | **Partial** | Per-space rebellion state and rebel armies; Italian Minor Power Table and unification, **22.1.3 internal war through the 4.2 pool** (interactive Sardinia-Piedmont / Two Sicilies choice when both are legal), **Italy’s 5th army/22.3.1 grants**, **22.5 Polish recruitment/reserve/build limits and TSRR**; Poland/AU/RU special cases via card handlers; **the printed Crisis Table (23.0–23.5)** as typed data + live resolver: every printed row, the Balkan States table, footnotes (`*` conference once/reroll, `**` special, `†`, `>6`), 23.3 bordering nation/minority/Balkan special results, 23.4 impossible results, 23.5 neutral players joining an alliance with the three-player limit, and the real blamed incident driving 25.3 Italy; GW outbreak; 23.1’s Powder Keg / The Balkan Wars open the crisis before the rest of their text. | “Minor powers drawn into the GW” are recorded as ally markers (no separate minor-belligerent list); A100’s second printed WTT increase inside the handler can still open a second crisis after its sub-decisions; some rows are reachable only when a handler raises the WTT. |
| **24–32 The Great War** | **Partial** | Outbreak, alliances, NGs, national will, order/bonus, planning/maneuver/winter, 29.1 blockade (RU/TSRR allies, capital→box, yearly max industry, US check), 29.2 colonial war with player-chosen losses/transfers/bonus CP, 29.3 neutral entry, 30.0 key loss/recapture, 30.1 capital surrender with full marker bookkeeping **and allied-unit displacement / formerly-controlled march-rail / permanent-minor sweep**, 30.2 US/Italy surrender with symmetric chit cleanup, 15.6 knockout + displacement, **15.3 persistent occupation on all moves**, GW #2/25.3 Italy, 28.1 trenches, crisis blame, multi-ally treaties, Rome/Italy capital, 32.1 US Mexico/Canada, Ankara capital, 22.4 Italian redeployment. | Blockade/colonial LoC traces apply Suez/Dardanelles closure; direct/event control writes route through `setSpaceControl`, which retires a stale `occupiedBy` marker (unification preserves a live enemy occupation); `surrenderGwMajor` runs the permanent-minor sweep; 30.0 now charges the dreadnought stability loss and counts committed support for the decisive-force threshold; 31.0’s one-power/no-neutral alliance-defeat condition ends the GW immediately; 29.3’s free redeployment moves all land units; 29.2’s losing alliance chooses its loss and 30.1’s two-survivor heir uses a die roll; 22.1.3 is an interactive choice when both Italian minors are legal. |
| **33 National characteristics** | **Partial** | Live and covered by `characteristicsCoverage` (zero display-only bullets/gaps): UK pools/India/Rapid Deployment/Join Your Country’s Army/Status Quo/CW; OT Turkish-Arab split/Local Autonomy/Europeanization/Jihad; AU Dual Monarchy/Reforms/Expand Citizenship/Incorporate/Unstable Situation/Continental Power/Metternich/New Way Forward/Arbiter; FR Third Republic/CP/Zouaves/Cultural Symbol/Second Empire/Napoleon’s Legacy; RU TSRR/Second Rome/Ankara; GE Imperial Germany/Continental Focus/Superior Staff Work/German Confederation/Zollverein/Blood and Iron!; **22.5 Polish recruitment/reserve/build limits**. | Remaining are printed-clause boundaries, not unwired abilities: Zollverein has no fuller home/source text, Poland’s total-cap interpretation, chart-less non-player rows stay null, and a few timing conventions (GE’s limited-war “first impulse” window). Round 8 added citizenship-aware Nationalist Uprising targeting, the start-of-GW Second Rome VPs and a live `refreshPowerProjection`; its port formula still shows FR/RU at 4 where the playbook prints 3, so those two displayed values are +1 until the port model is reconciled. |
| **34 Bots, scenarios, promos** | **Partial** | Campaign scenario only. Bot engine (rule 34) implemented in `engine/bot.ts`: Priority 1 and Priority 2 action tables, BDIT targeting, BMPIT influence, wartime priorities, GW priorities, end-phase army-build preference, and pending-decision auto-answers. Hotseat local mode has per-seat bot toggle. | Bot PAC/priority random dice, power-specific home-card logic (†Home Card Revealed), and GW maneuver target selection use simplified deterministic defaults. Alternate scenarios (1870/1880/No-GW/alternate-GW), the 1850 tutorial and promotional cards P1–P3 remain deferred. |

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
| `engine/privacy.ts` | Pure `redactForView` redaction of hands, goal decks, deck order, per-power flags (public allowlist), pending decisions and hidden-card log arguments (faceup event/response/combat/industrialization/CP-chain plays stay public). | **Yes** — `game.ts#playerView` calls it. | `privacy.test.ts`, `privateInfo.test.ts`, `privacyFlags.test.ts`, `newPendingPrivacy.test.ts` |
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
- `moves.ts#playCard` — a no-pass card may be played for CP **on top of** CP
  already banked (`rescueMode`), which is the legal escape; the banked CP is
  kept rather than overwritten. `board.tsx` enables that button, disables
  `pass` with a tooltip explaining why, and gates the GW pass button.

Regression coverage: `passRestriction.test.ts`, plus the campaign auto-play
test, which had been intermittently failing (~1 run in 3) for this reason.

## Fixed: six deadlocks and duplicates found by seeded self-play

A seeded self-play harness (`tools/ie-sim/`) drives the real boardgame.io
engine — seeded random plugin, phase/turn flow, move validation and
`playerView` redaction — with the Rule 34 bot for every seat, for the 1850
campaign, a match started in the Great War, and a variant that declares limited
wars, a naval variant that builds fleets and fights 19.0 contact battles, and an
amphibious variant that stages landings next to enemy ports. Running many seeds
surfaced thirteen engine bugs that the hand-built fixtures never reached. All
eleven are fixed; twelve are engine fixes and one (the rebel-space naval destination, see
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

**Verification:** the sweep at `IE_SEEDS=IE-SIM-1…10` finishes every campaign
with zero refused moves and zero invariant breaks; the limited-war sweep
(`W-1…8`) declares wars, runs the wartime impulses and settles them; and the
Great War sweep (`GA-1…6`, `GW-1…2`) runs planning → maneuver → battles →
winter (including the colonial transfers and neutral entry) to a decisive
result; the naval sweep (`N-1…10`) adds fleet builds, sea moves and naval
battles; the amphibious sweep (`A-1…8`) performs ~200 real 19.10 landings. A
mixed stress sweep (`tools/ie-sim/stress.test.ts`) adds random pending choices
on half the seeds, and the naval runs answer the 19.1 interception decision
dozens of times. The full Jest suite is **438/438 suites, 4073/4073 tests**, and
`tsc` plus the server `tsc` are clean; `tools/` is excluded from `yarn test`
because the batch sweep alone takes minutes and is run explicitly instead.

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
- **Still simplified or gapped:** card playability conditions printed on some
  faces are not gated engine-wide; auction cards are not publicly revealed
  after the auction; Egypt’s “colonial home spaces” set a `homeOverride` but do
  not change `SpaceDef.keyType`; Loose Grip takes one chosen space, not all
  named Ottoman spaces; Political Pressure’s “occupying an empty enemy key”
  condition is unreachable in the current maneuver model; Exhaustion activates
  when played rather than at the impulse boundary; the Balkans displace units
  to the first friendly controlled space rather than a free displacement.
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
  `beginLandBattle` (`flags.landAttackTurn`), and at `resolveGwWinter` an
  unsatisfied, still-adjacent player loses 1 stability; the flags are then
  cleared.
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
- **Remaining:** `A063`’s no-pass/CP rescue behavior is covered by the no-pass
  section; no other unread flag is known beyond the deliberate GW-05 legacy
  field.

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
  naval-transport move; the GW `gwJointNaval` still allows one sea connection
  per action point; 19.1’s “continue after winning an interception” is not
  implemented; 19.5’s port-count DRMs feed the 19.2 avoid roll rather than the
  battle dice.
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
- Bonus impulses: the order contains a `"bonus"` slot and `advanceGwImpulse`
  grants an extra impulse to the side with fewer living slots; the controller
  is deterministic (rotates by prior bonus grants), not a player choice.
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
  20.3’s Italian rebuild uses its own legacy placement; the 32.1 guard has no
  live US land route out of North America yet; `gwJointNaval` still allows one
  sea connection per action point.

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

### National characteristics: enforced vs displayed only

| Power | Enforced in the live paths at this refresh | Displayed/data only, helper-only, or not live |
| --- | --- | --- |
| GE | Bewegungskrieg wins initiative ties and the GW alliance goes first; German unification marks `unified` and converts German-flashpoint spaces held by diplomacy/ally to GE control; Imperial Germany’s one-time +1 manpower is granted at the next end phase; Continental Focus pacification 2 CP and 2/2 naval cap until unification; **Superior Staff Work** (one free deploy in GE’s first war/GW impulse, not stacking with A063); **German Confederation** (after a won unification war, annex Bavaria/Saxony/Hanover including a realignment gain; control, unit removal, permanent elimination, permanent home); **Zollverein** (GE-controlled German unification spaces count as territorial keys); **Blood and Iron!** (turn-1 end phase search for NG-08 and play it faceup). | Full Zollverein home/source treatment; German Confederation `homeOverride` is stamped only by the annexation (not every treaty/conquest gain); the Staff Work “first impulse” is approximated as “before GE first passes”. |
| UK | No reserve armies; global pre-GW British army limit; starting London 1st Army +1 DRM; India card/DRM; Crown Jewel; pass/save at two; Indian armies limited by colonial manpower, auto-displaced at end of turn/war and capped at 1 after independence; Indian Fort; **India independence**; **Rapid Deployment**; **Join Your Country’s Army!**; **Maintaining the Status Quo** (primary-defender neutral invites in the alliance step); **CW army** (GW only, Australia/NZ/Canada, shared colonial manpower). | The free Join-Your-Country armies bypass the 4.2 pool and may overstack London; a Status Quo invited player’s post-war draw is deterministic; the CW army uses the shared colonial ceiling. |
| FR | City of Light +1 card at ≥4; Second Empire → Third Republic at stability ≤1 or a lost war outside the GW; Second Empire +1 GW budget; Third Republic 2 free alliance-track CP once per turn; Zouaves +1 DRM/pacification and rebuilds; **Napoleon’s Legacy** (reveal NG-24 before a conquest declaration for the printed −2 stability, publicly revealed). | The lost-war republic switch still has no card-driven `lostWar` caller beyond war settlement; full Zouave rebuild/pacification edge cases. |
| AU | Metternich’s first two candidate alliances; Dual Monarchy card event and turn-2 add-to-hand; Reforms/Expand Citizenship/Incorporate; full Unstable Situation discard-or-marker choice; A New Way Forward; Continental Power pacification; Bind Them Together; **citizen-nationality wars of unification** and **Arbiter of Italy** liberation targeting; full citizenship also records rights and removes that nationality from Nationalist Uprising targeting (`minorityNationalitiesFor`/`auCitizenshipProtectsSpace`). | Generic Expand Citizenship remains a special action rather than a card; failed Unstable Situation has no separate −1 card marker visual. |
| RU | TSRR +1 card/+2 keys and the free rail move once per impulse; Endless Space now keys only on the battle spaces; Agrarian industrialisation 6; Tsarist Repression through the stability table; Second Rome +2 VP for Istanbul at the end of the game and a separate +2 at the GW outbreak; Scorched Earth absorbs the first GW key loss; Russian Steamroller’s +1 reserve limit (end phase and `recruit`). The Ottoman capital switches to Ankara when RU takes Istanbul (`capitalOf`/`isBlockaded`). | The TSRR is a movement allowance, not a distinct railroad unit (as printed); Second Rome wartime control beyond the Istanbul capture flag. |
| OT | Poor Infrastructure 2-stack limit; Local Autonomy Arab/Egyptian keys and Tunisia/Tripoli land-LoC condition (typed `otLandLocKeyType`); Turkish/Arab army split with separate Arab manpower; Europeanization 6 and no-own-card rejection; Jihad gain/use/discard; A106 two ECs. | Full “Arab manpower spending” display edge cases; non-player counter rows are enforced as pools (chart-less rows stay null). |

## Test and build evidence

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
| Response windows | `responseWindows.test.ts` (8), `responseCardOptions.test.ts`, `responseAlliance.test.ts` and `components/board.test.tsx` cover impulse-start windows, mid-impulse blocking, combat/GW-06 rejection, A065/A067 options and board gating. |
| Privacy | `privacy.test.ts`, `privateInfo.test.ts`, `privacyFlags.test.ts` (6) and `newPendingPrivacy.test.ts` cover seat/spectator redaction, hidden deck order, pending decisions, the public-flag allowlist, auction bids and face-up combat cards. |
| End phase / alliance / naval | `economy.test.ts`, `economyIntegration.test.ts`, `endPhaseSteps.test.ts` (20), `endPhaseResiduals.test.ts` (13), `allianceCap.test.ts` (9), `navalPath.test.ts` (9), `navalAvoidance.test.ts` (15), `trenchBattleSpace.test.ts` (11), `movementStacking.test.ts` (11), `minorBrokenLoc.test.ts` (8) and `components/logText.test.ts` cover the 12-step live order, 20.1/20.5/20.9 choices, the three-player cap, NMP paths, 19.2 avoidance, trench-space movement and bilingual log rendering. |
| Great War home front | `gwBlockade.test.ts` (10), `gwColonialWar.test.ts` (19) and `gwNeutralEntry.test.ts` (14) cover capital→box blockade/max industry, the printed colonial-war modifiers/losses/transfers/stability/bonus CP, and the neutral join/stay-out decisions with the three-player cap. |
| UK / India / Rome / majors | `indiaIndependence.test.ts` (11), `indianArmyDisplacement.test.ts` (10), `ukRapidDeployment.test.ts` (12), `joinYourCountrysArmy.test.ts` (6), `romeSpace.test.ts` (15), `usNorthAmerica.test.ts` (11) and `otCapital.test.ts` (8) cover 33.2.2, Indian army movement/caps, UK entry bonuses, the Rome/Papal States space and Italy capital surrender, 32.1 and the Ankara switch. |
| Card playability / UI | `cardPlayability.test.ts` (36), `egyptKeyType.test.ts` (5), `components/boardActions.test.tsx` (14), `cardPlayability2.test.ts` (19), `auctionReveal.test.ts` (5) and `components/boardActions2.test.tsx` (58) cover the printed event/power gates, A70/A54, the Egypt colonial key override, the auction reveal, all move/pending controls and bilingual pending labels. `components/board.test.tsx` also asserts that required card/Goal choices render their SVG face (home card, National Goal, stability discard, combat and auction options) while space/power options stay plain buttons and a hidden bid stays hidden from opponents. |
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
