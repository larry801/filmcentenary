# Virgin Queen — seeded self-play harness

Drives the **real** engine (no mocks): the seeded boardgame.io random plugin,
phase/turn flow, move validation, `playerView` redaction and every move in
`game.ts`. Each seat is played by the policy in `decision.ts`, which builds its
decisions from the same enumerations the hotseat board renders — the stages in
`game.ts#choiceStages`, the pending panels under
`components/board/PendingPanels/`, `legalTargets` for the map highlights, and
`passBlockReasons` for the Action Phase. Anything this reports is therefore an
engine, rule-implementation or board-panel problem, not a bad test harness.

```sh
# Every suite here lives under `tools/`, which jest's default config excludes
# so `yarn test` stays fast.  Run them explicitly:
npx jest --testPathPatterns "tools/vq-sim" \
  --testPathIgnorePatterns "/node_modules/" --runInBand

# pick seeds
VQ_SEEDS=VQ-SIM-1,VQ-SIM-2 npx jest --testPathPatterns "tools/vq-sim" \
  --testPathIgnorePatterns "/node_modules/" --runInBand
```

The harness is deliberately **not** under `src/`, so `yarn test` stays fast.

## Options

| option | what it exercises |
| --- | --- |
| `scenario` | `campaign` (default), `tournament` or `tutorial` |
| `numPlayers` | 2–6 (the scenario decides which values are legal) |
| `chaos` | `0` takes the first legal choice, `0.5` picks randomly half the time — this is what explores the branches a fixed policy never reaches |
| `maxSteps` | hard cap on dispatched actions (default 40000) |
| `stopAfterTurn` | stop once that rulebook turn has finished |
| `onState` | called with the state after every dispatched action; the property suites use it to run the rule catalogue on each step |

## Rule invariants and property-based simulation

`sweep.test.ts` asks whether the engine accepts the board's decisions.  The
rule layer asks whether the resulting board is *legal*:

| file | what it does |
| --- | --- |
| `invariants.ts` | the rule-cited catalogue (`INVARIANTS`): A-tier hard failures and B-tier rule audits, each with its rulebook section |
| `properties.ts` | generative runner: per-action invariant checks, JSON round-trip, `playerView` privacy, rule 25 outcome, determinism; `shrinkFailure` replays the shortest failing prefix |
| `property.test.ts` | the property suite over a scenario/player-count/chaos matrix (`VQ_PROPERTY_SEEDS`, `VQ_PROPERTY_STEPS`) |
| `invariantMutation.test.ts` | injects one rule break into a real mid-game state per invariant and asserts the checker fires |

```sh
# rule invariants: does each checker actually fire when the board is broken?
npx jest --testPathPatterns "tools/vq-sim/invariantMutation" \
  --testPathIgnorePatterns "/node_modules/" --runInBand

# property-based simulation over generated matches
VQ_PROPERTY_SEEDS=VQ-PROP-1,VQ-PROP-2 npx jest \
  --testPathPatterns "tools/vq-sim/property" \
  --testPathIgnorePatterns "/node_modules/" --runInBand
```

Design notes, the full invariant table and the rule mapping are in
`docs/vq-invariant-property-tests.md`.

## What it checks

- **Refused moves.** A decision the engine rejects is reported with the
  boardgame.io error plus the full phase/turn/pending context.
- **Deadlocks.** An identical refused decision three times is reported as a
  stall (the hotseat board's "bot is stuck" signal).
- **Structural invariants** after every action (`harness.ts#checkInvariants`):
  one physical copy per card across deck/discard/removed/futureDeck/hand/set-aside,
  a leader listed exactly where its state says it is, no negative or fractional
  counters, and sane battle bookkeeping.
- **Completion.** A match must reach a result instead of hitting the step cap.

## Findings

The sweep found three bugs so far, and the rule-invariant layer below adds three
more. Each is pinned by a test under `src/virginQueen/`.

1. **Mandatory #74 deadlocked the Action Phase** (`mandatoryResolvedMinor.test.ts`).
   `playCard` refused Scottish Lords Rebel whenever Scotland had already been
   evaluated that turn (rule 24.6), but Rule 11 keeps `pass` and `endImpulse`
   blocked while a Mandatory Event is in hand — so every seat stayed blocked
   until a choice that could never be made. The card now resolves as an ignored
   evaluation and the impulse can end.

2. **#18 City State Rebels rendered no buttons for an allied minor's garrison**
   (`cityRebelsMinorPanel.test.tsx`). The loss allocation belongs to the major
   that owns the minor, but the panel tested `isPower(controller)` and rendered
   nothing for a Venetian/Irish/etc. fortress while `moveError` blocked every
   seat from passing. `cityRebelsDecider` is now shared by the panel, the
   pending-power cue and the move guard.

3. **A removed card stayed in the secret Spring set-aside**
   (`cardZoneExclusivity.test.ts`). Assassinating Elizabeth I removes the Virgin
   Queen, but `removeCardFromGame` cleared every zone except
   `homeCardSetAside`, so one physical copy sat in `removed` and the face-down
   pile at once. Found by the invariant check after an `assassinate` impulse.

4. **#37 could deactivate the acting power and freeze the Action Phase**
   (`sublimePorteDeactivation.test.ts`). In every reduced-player game the
   Ottoman is an activated major, and #37's status check can hand it to Spain —
   the printed "Deactivate" power. That removed the controlling seat while
   `activePower` still named the Ottoman, whose just-emptied hand left the
   `"played"` flag set; `pass` and `endImpulse` were both refused, so the Action
   Phase never ended. `turnEnd` now skips a deactivated `activePower` and
   `deactivateMajor` clears the per-impulse flags with the hand.


5. **Conversion / Science-Bonus windows deadlocked the Action Phase**
   (`harness.ts#decidingPower`, `decision.ts`).  `moveError` refuses every move
   while `pendingConversion` or `pendingScienceTreasure` is open, but neither is a
   boardgame.io stage, so the policy never answered it and kept asking for
   `endImpulse` until the stall detector fired.  Both windows are now deciding
   powers, and `actionDecision` answers them.  (Registration for
   `chooseConversionNullify` / `chooseScienceTreasureBonus` already existed in
   `game.ts#choiceStages`; the policy simply was not choosing them.)

6. **#34 Holy Roman Intercession could declare war on the HRE itself**
   (`hreIntercession.test.ts`).  `eventTargetOptions` enumerated every warring
   pair without excluding the HRE, so the drawer offered `Spain + HRE` and the
   log read "神圣罗马帝国 declares war on 神圣罗马帝国".  `diplomacy.wars`
   (rule 9.4) caught it.  The target generator and `resolveHolyRomanIntercession`
   now both reject an HRE side.

7. **Winter *return* choices were treated as blocking windows**
   (`invariants.ts#pendingDecider`).  Rule 20 only requires the current power to
   confirm its losses; return moves are optional (the automatic placement is a
   legal result).  Reporting every `winterReturnChoices[0]` produced a phantom
   "pending decision for england, which has no controlling seat" in the
   2-player tutorial.  The decider now only names the active power's loss
   confirmations.

8. **A non-blocking window was reported as the deciding power**
   (`pendingWindow.test.ts`).  `pendingHreReplacement` and
   `pendingCatholicLeague` are set during the winter and resolved by the Spring
   phase's `onBegin`; `moveError` never refuses a move for them.  Listing them in
   `pendingDecider` made the harness hand the turn to the HRE while the active
   power was Spain, and `chooseWinterReturn` (which reads the active power) then
   rejected a legal return in the 2-player sweep.  `pendingDecider` now names
   only windows that actually block play, and the new test asserts that
   `moveError` and `pendingDecider` agree on every state of a short match.
