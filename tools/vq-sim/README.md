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

The sweep found three bugs so far. Each is pinned by a test under
`src/virginQueen/`.

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


