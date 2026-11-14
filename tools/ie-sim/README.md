# Imperial Elegy — seeded self-play harness

Drives the **real** engine (no mocks): the seeded boardgame.io random plugin,
phase/turn flow, move validation, `playerView` redaction and every move in
`game.ts`. Every seat is played by the Rule 34 bot in `engine/bot.ts`. Anything
this reports is an engine or rule-implementation problem, not a UI issue.

```sh
# campaign + Great War, default seeds
npx jest --testPathPatterns tools/ie-sim --runInBand

# pick seeds
IE_SEEDS=IE-SIM-1,IE-SIM-2 npx jest --testPathPatterns tools/ie-sim --runInBand
```

The harness is deliberately **not** under `src/`, so `yarn test` stays fast.

## What each mode does

| option | what it exercises |
| --- | --- |
| default | the 1850 campaign from setup through turn 7's end phase |
| `war` | declares legal limited wars, so the `wartime` phase (initiative, budgets, maneuver, battles, victory, truces) runs |
| `greatWar` | starts the war through the real `outbreakGreatWar` from inside a move, so the seeded random plugin is live |
| `aggressive` | in the GW, drives contact/battle/retreat and occupation instead of passing |
| `chaos` | answers pending decisions randomly instead of taking the first option |

## Test suites here

- `sweep.test.ts` — campaign + Great War per seed (the default gate).
- `war.test.ts` — campaign with limited-war declarations.
- `stress.test.ts` — longer mixed run, random pending choices on half the seeds.

## What it checks

- **Refused moves.** A decision the engine rejects is reported with the flow's
  own reason (`performGwManeuver`'s error, or `INVALID_MOVE`).
- **Deadlocks.** An identical rejected decision three times on an unchanged
  state is reported and escaped, mirroring the hotseat board's fallback.
- **Structural invariants** after every action (`harness.ts#checkInvariants`):
  one physical copy per card, units listed in exactly one space, no negative
  stability/manpower/industry, non-empty pending options.
- **Completion.** The game must reach a result rather than hitting the step cap.

## Findings

The runs have found eight bugs so far; they are listed in
[`../../docs/imperial-elegy/IMPLEMENTATION_STATUS.md`](../../docs/imperial-elegy/IMPLEMENTATION_STATUS.md)
and pinned by `src/imperialElegy/selfPlayRegression.test.ts`.
