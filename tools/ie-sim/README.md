# Imperial Elegy — seeded self-play harness

Drives the **real** engine (no mocks): the seeded boardgame.io random plugin,
phase/turn flow, move validation, `playerView` redaction and every move in
`game.ts`. Every seat is played by the Rule 34 bot in `engine/bot.ts`. Anything
this reports is an engine or rule-implementation problem, not a UI issue.

```sh
# Every suite here lives under `tools/`, which jest's default config excludes
# so `yarn test` stays fast.  Run them explicitly:
npx jest --testPathPatterns "tools/ie-sim" \
  --testPathIgnorePatterns "/node_modules/" --runInBand

# pick seeds
IE_SEEDS=IE-SIM-1,IE-SIM-2 npx jest --testPathPatterns "tools/ie-sim" \
  --testPathIgnorePatterns "/node_modules/" --runInBand
```

The harness is deliberately **not** under `src/`, so `yarn test` stays fast.

## What each mode does

| option | what it exercises |
| --- | --- |
| default | the 1850 campaign from setup through turn 7's end phase |
| `war` | declares legal limited wars, so the `wartime` phase (initiative, budgets, maneuver, battles, victory, truces) runs |
| `greatWar` | starts the war through the real `outbreakGreatWar` from inside a move, so the seeded random plugin is live |
| `aggressive` | in the GW, drives contact/battle/retreat and occupation instead of passing |
| `navy` | builds fleets, sails them, fights 19.0 contact battles and answers the 19.1 interception decision |
| `amphibious` | stages two armies plus an escort beside an enemy port and plays the 19.10 landing |
| `chaos` | answers pending decisions randomly instead of taking the first option |
| `IE_BATCH=N` | batch statistics over N seeds × all modes (see below) |

## Test suites here

- `sweep.test.ts` — campaign + Great War per seed (the default gate).
- `scenarios.test.ts` — every printed scenario (`IE_playbook.pdf` pp. 3-10)
  from its own setup: the pre-war scenarios must reach their printed last turn
  and a decisive ending, the GW scenarios must enter the war's own sequence and
  survive its first turn.  The campaign and the GW modes start from the
  campaign setup, so this is the only suite that runs the other seven setups.
- `fullGame.test.ts` — one continuous fixed-seed match from campaign turn 1
  through a real Great War outbreak and GW turns 0–5, with all six seats
  human-controlled (no `G.bots`), asserting the printed milestones and no
  refused move.  This is the hotseat/“整局” gate; it is slow (~35 s) and is run
  explicitly like the other tools suites.
- `war.test.ts` — campaign with limited-war declarations.
- `navy.test.ts` — fleet builds, sea moves and naval battles (19.1–19.9).
- `amph.test.ts` — 19.10 amphibious assaults (unopposed and contested).
- `stress.test.ts` — longer mixed run, random pending choices on half the seeds.
- `cardCombo.test.ts` — every ordered pair of playable *event* cards on one
  state, invariant-checked after each card (~6642 pairs, ~5s).
- `cardTriple.test.ts` — ordered triples: a cover pass (every card first, middle
  and last) plus a deterministic seeded sample (`IE_TRIPLES`, default 20000).
- `cardComboSituations.test.ts` — the same pairs in each board situation:
  action, wartime maneuver, wartime alliance, Great War.  This is what reaches
  the four `warOnly` responses, which are `response` cards and are played with
  `playResponseCard` rather than `playCard`.
- `deckBands.test.ts` — cross-checks the action cards' decade bands against the
  module's own saved deck placement (42 entries across 1870s–1900s, matched by
  printed title).  Matching is exact after normalisation, on purpose: every
  entry resolves, so a fuzzy fallback would only hide a future misfiling.
- `moduleCrossCheck.test.ts` — cross-checks the hand-transcribed campaign
  setup against the publisher's own VASSAL save: the module's zone polygons put
  each of its 591 pieces on a printed space, and the test requires our setup to
  agree on which power starts where.  The few genuine representation
  differences (an Indian Army, fort-garrison formations) are listed in one table
  that a second test keeps honest — a stale entry fails.
- `saveMigration.test.ts` — deletes one documented optional field at a time
  (then all of them plus the container records) and keeps *playing*, so a save
  that only survives loading does not pass.  A progress guard asserts every
  scenario actually advanced the game.
- `exceptionHunt.test.ts` — wide seed sweep whose only assertion is "no engine
  exception"; it reports the first stack frame inside `src/imperialElegy`, so a
  failure names the exact line.  `IE_HUNT` sets the seed count (default 3).
- `cardStates.test.ts` — every action card against ten deliberately extreme
  boards (empty hands, no reserves, stability at both ends, an eliminated
  power, …), so an effect's arithmetic is checked, not just its text.
- `cardSweep.ts` — the shared scaffolding those three use (ctx with a
  `sides`-aware die, single-copy card injection, settle loop, reporting).
- `invariants.test.ts` — the structural (A-group) invariant census: real
  seeded games across modes, failing on any break that is not recorded in
  [`../../docs/imperial-elegy/invariants.baseline.json`](../../docs/imperial-elegy/invariants.baseline.json)
  and on a baseline entry that no longer reproduces.  `IE_SEEDS`, `IE_MODES`
  and `IE_CENSUS_DUMP` steer it.  The catalog and its per-constraint tests are
  in [`../../docs/imperial-elegy/INVARIANTS.md`](../../docs/imperial-elegy/INVARIANTS.md).
- `batch.test.ts` — N seeds × all six modes, aggregated: completion rate per
  mode, result reasons, distinct fatal signatures (each with a reproducing
  seed) and the moves the batch never touched.  Not a pass/fail gate on
  coverage: it prints the report and only fails on a crash, stall or unfinished
  game.

```sh
# `tools/` is outside jest's default paths, so point jest at it explicitly.
IE_BATCH=20 npx jest --testPathPatterns "tools/ie-sim/batch" \
  --testPathIgnorePatterns "/node_modules/" --runInBand
```

A larger batch is sharded and merged, which is how 50 seeds stay practical:

```sh
mkdir -p /tmp/ie-batch
for i in 0 1 2 3; do
  IE_BATCH=50 IE_BATCH_SHARD=$i/4 IE_BATCH_DUMP=/tmp/ie-batch/shard-$i.json \
    npx jest --testPathPatterns "tools/ie-sim/batch" \
    --testPathIgnorePatterns "/node_modules/" --runInBand \
    > /tmp/ie-batch/log-$i.txt 2>&1 &
done
wait
node tools/ie-sim/batch-report.js /tmp/ie-batch/shard-*.json
```

`batch-report.js` merges the dumps and prints the same report once for the
whole batch, adding a step-count distribution (to see whether games converge or
pile up at the step cap) and the share of games each fatal signature affects.
It exits non-zero when the batch has a crash, a stall or an unfinished game.

`tools/` is excluded from `yarn test`, so these never slow the normal suite.

## What it checks

- **Refused moves.** A decision the engine rejects is reported with the flow's
  own reason (`performGwManeuver`'s error, or `INVALID_MOVE`).
- **Deadlocks.** An identical rejected decision three times on an unchanged
  state is reported and escaped, mirroring the hotseat board's fallback.
- **Structural invariants** after every action (`harness.ts#checkInvariants`):
  one physical copy per card, units listed in exactly one space, no negative
  stability/manpower/industry, non-empty pending options — plus the rest of the
  A group in `src/imperialElegy/testing/invariants/` (counter pools, key
  recomputation, stacking, forts, CP chain, alliance caps, JSON round-trip).
  The cheap checks run after every action, the full set at phase boundaries and
  every 25th step.
- **Completion.** The game must reach a result rather than hitting the step cap.

## Findings

The runs have found fifteen engine bugs so far (plus one harness gap); they are listed in
[`../../docs/imperial-elegy/IMPLEMENTATION_STATUS.md`](../../docs/imperial-elegy/IMPLEMENTATION_STATUS.md)
and pinned by `src/imperialElegy/selfPlayRegression.test.ts`.
