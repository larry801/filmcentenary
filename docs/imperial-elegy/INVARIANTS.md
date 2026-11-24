# Invariant catalog

**Snapshot:** 2026-11-24. Scope: the `A` (structural) group is implemented and
gating; `B`–`E` are catalogued below with what each still needs.

The self-play harness already proved the engine does not crash, does not deadlock
and does not refuse its own legal moves. This catalog covers the other half: that
the states it produces are ones the printed rules allow. It replaces the six
ad-hoc structural checks that used to live in `tools/ie-sim/harness.ts`.

```sh
# the gate (three modes x three seeds, a few minutes)
npx jest --testPathPatterns "tools/ie-sim/invariants" \
  --testPathIgnorePatterns "/node_modules/" --runInBand

# the whole matrix, longer
IE_MODES=all IE_SEEDS=IE-SIM-1,IE-SIM-2,IE-SIM-3 npx jest \
  --testPathPatterns "tools/ie-sim/invariants" \
  --testPathIgnorePatterns "/node_modules/" --runInBand
```

## Layout

| path | role |
| --- | --- |
| `src/imperialElegy/testing/invariants/types.ts` | `Violation`, `Invariant`, levels and severities |
| `src/imperialElegy/testing/invariants/structural.ts` | `A01`–`A16` |
| `src/imperialElegy/testing/invariants/index.ts` | registry, `checkAll`, report formatting |
| `src/imperialElegy/testing/hash.ts` | stable serialization + FNV-1a state hash |
| `src/imperialElegy/invariants.test.ts` | per-constraint positive and negative cases, in `yarn test` |
| `tools/ie-sim/invariants.test.ts` | census over seeds x modes, baseline ratchet |
| `tools/ie-sim/harness.ts` | runs the cheap set after every action, the full set at phase boundaries |
| `docs/imperial-elegy/invariants.baseline.json` | the recorded, triaged breaks |

The checks live under `src/` — not `tools/` — so `yarn test` runs the
per-constraint cases. Nothing imports `testing/` from `game.ts`; it is test-only
code and tree-shakes out of the production bundle.

## Levels and severities

- **cheap** — one state in isolation, no cloning, ~0.2 ms. Runs after every
  dispatched action.
- **full** — adds checks that recompute the board (`A07`) or serialize the whole
  state (`A16`), ~2–5 ms. Runs at every phase boundary and every 25th step.
- **error** — impossible under the printed rules; the census fails on it.
- **warn** — the printed rules permit the state transiently, or the check is
  known to be a subset. Reported, never gating.

## A — structural conservation

Every check holds after *every* action in every phase.

| id | rule | level | severity | asserts |
| --- | --- | --- | --- | --- |
| A01 | 9.x / 10.x | cheap | error | a card is in at most one of deck, discard, removed, delayedCards, hand, cpChain, industryCard, gwCard. `homeCards` is a permanent pool, not a zone (10.4) |
| A02 | 9.x | cheap | error | no zone lists an entry twice; `pending` and `pendingStack` ids are unique |
| A03 | 5.x | cheap | error | `G.units` and every `space.units` list agree in both directions; a reserve counter owned by a power is off the board; no unit is listed in two spaces |
| A04 | 5.1 / 5.3 / 5.4 | cheap | error | steps are 1 or 2; elite counters have exactly one; `naval` matches the kind; squadrons/dreadnoughts sit in a naval box or a port, land counters never in a box |
| A05 | 4.2 | full | error | no power holds more counters of a kind than its pool (naval limits included, EF/elite-colonial EF share one pool) |
| A06 | 7.1 / 7.2 / 7.4 / 3.7 | cheap | error | stability 0..6, manpower/secondary >= 0, industry >= 0, keys >= 0, `wtt` 0..`worldTensionMax` (3.7), `cpRemaining` >= 0 |
| A07 | 4.7 / 7.2 | full | error | at the start of a campaign turn, territorial/colonial/arab keys equal a `recomputeTracks` of the board. 7.2 recomputes them in the end phase, so a mid-turn lag is the printed sequence |
| A08 | 5.5 / 19.9 | cheap | **warn** | armies <= the space's stacking limit (3 main map, 2 submaps, 2 Ottoman home), ships in a port <= 4. 5.5.3 lets a retreating stack exceed the limit until its owner's next impulse, so this warns |
| A09 | 12.12 | cheap | error | fort level 1..3 and forts only on the main map (the Indian fort of 33.2.3 is exempt). The three-fort cap is **not** asserted — see below |
| A10 | 12.14 | cheap | error | a CP chain holds at most two cards and never the industry card |
| A11 | 4.2.1 | cheap | error | at most five distinct minor allies per player |
| A12 | 8.4 | cheap | warn | at most three player powers per alliance; Italy and the US are exempt by the rule itself. 8.3's forced shift can legally fill a full alliance, so this warns |
| A13 | pending.ts | cheap | error | every decision has a player owner, a known kind, and non-empty options with unique ids |
| A14 | 2.1 / 24.1 | cheap | error | phase in the enum, turn 1..8 (20.12 advances the counter before the end), GW turn 0..6 (the winter step advances it before 2.2.2 scores), `activePower` a power, `turnIndex` a non-negative integer (it indexes a seat, then the GW impulse order, then 27.4's neutral order, and keeps the last used value after an order clears), `passed` duplicate-free |
| A15 | 15 / 24 / 25 | cheap | error | a live battle names existing spaces, player powers and a known stage; a live Great War is in turn 0..5, its lists hold only powers, and no power is belligerent and neutral at once |
| A16 | sync | full | error | no `NaN`, `Infinity`, function, `Map`/`Set` or class instance; no `undefined` array entry (it arrives as `null`); `JSON.parse(JSON.stringify(G))` reproduces the state. A property explicitly set to `undefined` is *not* a break: transport drops it and every reader treats it as absent |

### Known limits of the A group

- **A03** asserts one direction for pinned units only: a unit with
  `space === null` that is in no reserve list is *not* reported, because the
  engine legitimately holds eliminated and pre-placed counters that way. The
  board-to-unit direction is asserted fully.
- **A05** covers the six printed player counter kinds. Non-player pools
  (`nonPlayerCounterPool`: Italy, the US, the minors) are enforced by the live
  build paths but not yet asserted here.
- **A08** and **A12** are warns for the same reason: the printed rules allow the
  state to exceed the limit in one specific case, and the state does not record
  which case produced it. 5.5.3 lets a retreating stack overstack until its
  owner's next impulse (the actual requirement is the step loss, a `C` check);
  8.3 lets a forced alliance shift fill an already-full alliance, and no field
  says whether a member joined voluntarily.
- **A09** does not assert 12.12's three-fort cap. The cap bounds the Construct
  Fort action (`buildFort`), while a card effect may also place a fort
  (`effects.ts`), so a state-level count cannot tell a legal fourth fort from an
  illegal one. The cap stays enforced where it is decidable.
- **A15** does not yet assert `war`/`battle`/`gw` mutual exclusion across the
  phase machine; the referential part is what a hand-built state can get wrong.

## B–E — catalogued, not yet implemented

These are the remaining groups of the design. Each is listed with the state it
needs, because several cannot be written as a single-state check.

**B — printed-rule state (23 items).** Decade deals and card markers (10.1–10.4),
hand conservation after a gift (11.1/11.2), one card per impulse (12.0), peace vs
war vs GW budgets (12.1/14.3/26.2), standing/reserve limits (7.2/7.3/12.2), WTT
declaration gates (12.17.1), war aims and truces (13.x), victory types and treaty
options (16.x), territory transfer bookkeeping (13.1–13.3), the twelve end-phase
steps (20.1–20.12), rebels (21.x), Italy (22.x), the crisis table (23.x), GW
outbreak (25.x), GW combat cards and budgets (26.x), GW impulses (27.x),
exhaustion (27.6), blockade (29.1), colonial war (29.2), surrender and
elimination (30.1/30.2), national characteristics (33.x), bot legality (34.x).

**C — transition (12 items).** Needs `ctx.before`, which the harness now passes
to `checkAll` but no check reads yet: `INVALID_MOVE` ⇒ deep-equal state (C01),
card zone change at most once per move (C02), `cpRemaining` monotonicity and
exact action cost (C03), battle loss accounting (C04), track deltas against a
whitelist (C05), WTT delta by phase (C06), control change justified by entry,
victory or event (C07), alliance shift adjacency (C08), one pending opened and
one closed per move (C09), movement legality (C10), decision idempotence (C11),
VP timing (C12).

**D — protocol (8 items).** Validator agreement (`allowed` ⇒ dispatch succeeds,
`!allowed` ⇒ `INVALID_MOVE` and no change), `redactForView` leakage,
view-playability, determinism (same seed + same decisions ⇒ same hash, for which
`testing/hash.ts` exists), save round-trip, random-call accounting, move
coverage, termination.

**E — terminal (4 items).** Result shape and winner set (2.3), the terminal path
that produced it (2.2), eliminated players never acting or scoring (30.1),
terminal cleanup (`battle`/`pending` null, `cpRemaining` 0, GW cards home).

## The baseline ratchet

`invariants.baseline.json` records every `error` break the census currently
observes, with a rule citation, a reason, a pointer to the code that owes the
fix, and a seed/mode pair that reproduces it.

- A break that is not in the baseline fails the census.
- A baselined break that no longer reproduces fails the census, so fixing it
  forces the entry to be deleted in the same change.
- Entries are `error` only. Warns never gate and are never recorded.
- `IE_CENSUS_DUMP=path` writes the full observation, which is the input for
  adding an entry.
