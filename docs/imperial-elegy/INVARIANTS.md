# Invariant catalog

**Snapshot:** 2026-11-26. Scope: the `A` (structural) group is implemented and
gating; `B`–`E` are catalogued below with what each still needs.

The self-play harness already proved the engine does not crash, does not deadlock
and does not refuse its own legal moves. This catalog covers the other half: that
the states it produces are ones the printed rules allow. It replaces the six
ad-hoc structural checks that used to live in `tools/ie-sim/harness.ts`.

```sh
# the gate (all six simulation modes x three seeds: 18 runs, ~7 min on the
# machine the numbers below were measured on)
npx jest --testPathPatterns "tools/ie-sim/invariants" \
  --testPathIgnorePatterns "/node_modules/" --runInBand

# a narrower local loop
IE_MODES=campaign,war IE_SEEDS=IE-SIM-1 npx jest \
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
| `tools/ie-sim/harness.ts` | runs the cheap set after every action, the full set at phase boundaries and every 25th step |
| `docs/imperial-elegy/invariants.baseline.json` | the recorded, triaged breaks |

The checks live under `src/` — not `tools/` — so `yarn test` runs the
per-constraint cases. Nothing imports `testing/` from `game.ts`; it is test-only
code and tree-shakes out of the production bundle.

## Levels and severities

- **cheap** — one state in isolation, no cloning. Measured 0.17–0.22 ms on a
  129–215 KB state. Runs after every dispatched action.
- **full** — adds the checks that recompute the board (`A07`) and walk the whole
  state (`A16`). Measured on the 215 KB end state of a 1369-step campaign:
  6.0 ms at a phase boundary (3.4 ms of it the `A16` walk, 2.2 ms the JSON round
  trip) and 3.7 ms on a cadence step, where `A16` skips the round trip. Runs at
  every phase boundary and every 25th step: 106 passes in that run, 53 of them
  phase boundaries.
- **error** — impossible under the printed rules; the census fails on it.
- **warn** — the printed rules permit the state transiently, or the check is
  known to be a subset. Reported, never gating.

The invariant layer is not what the census spends its time on. In the same run
the reducer took 26.4 s of 31.2 s, the per-seat view clone 3.2 s, the bot 0.7 s
and every invariant pass together 0.9 s — 0.49 s of it `A16` alone, which the
walk cut to 0.28 s. The reducer's share is boardgame.io's: every move runs
against an Immer draft of the whole state, so this engine's read-heavy moves pay
a proxy hop per object access. That is why the per-pass costs above, not a per-step budget, are the
number to reason about.

## A — structural conservation

Every check holds after *every* action in every phase.

| id | rule | level | severity | asserts |
| --- | --- | --- | --- | --- |
| A01 | 9.x / 10.x | cheap | error | a card is in at most one of deck, discard, removed, delayedCards, hand, cpChain, industryCard, gwCard. `homeCards` is a permanent pool, not a zone (10.4) |
| A02 | 9.x | cheap | error | no zone lists an entry twice; `pending` and `pendingStack` ids are unique |
| A03 | 5.x | cheap | error | `G.units` and every `space.units` list agree in both directions; a reserve counter owned by a power is off the board; no unit is listed in two spaces |
| A04 | 5.1 / 5.3 / 5.4 | cheap | error | steps are 1 or 2; elite counters have exactly one; `naval` matches the kind; squadrons/dreadnoughts sit in a naval box or a port. An army *may* sit in a box: 12.3 transport and 19.10 embark it there |
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
| A15 | 15 / 24 / 25 | cheap | error | a live battle names existing spaces, a player attacker and a known stage (15.4.2 lets `defender` hold a non-player control id); a live Great War's lists hold only powers, and no power is belligerent and neutral at once |
| A16 | sync | full | error | no `NaN`, `Infinity`, function, `Map`/`Set` or class instance; no `undefined` array entry (it arrives as `null`). One structural walk that builds a path only when it reports, plus `JSON.parse(JSON.stringify(G))` at phase boundaries, which is what catches a `toJSON` or a cycle. A property explicitly set to `undefined` is *not* a break: transport drops it and every reader treats it as absent |

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

## B — printed-rule state (implemented subset)

The printed rules a *single state* can adjudicate. Everything that needs the
previous state is left to `C`, and everything a card effect may legally override
is recorded as a limit below rather than shipped as an error.

| id | rule | level | severity | asserts |
| --- | --- | --- | --- | --- |
| B02 | 10.4 / 11.1 / 11.2 | cheap | error | each home card belongs to one seat's pool, no pool lists a card twice, and a selected home card is one of its own seat's |
| B04 | 12.1 / 14.3 / 26.2 | cheap | error | war and Great War budgets — live and archived — are whole, non-negative CP |
| B07 | 13.x / 14.x | cheap | error | a war's allies are player powers listed once, the two sides are disjoint (allies of both, attacker on its own side), its objectives exist on the board and are unique, and its aim is liberation/unification/conquest or not yet chosen |
| B10 | 20.1–20.12 | cheap | error | end-phase progress exists only in the end phase, its step cursor is inside the twelve printed steps, 20.1's settlement list holds each power once, and the 20.9/20.11 cursors are inside their orders |
| B18 | 29.1 | cheap | error | industry never exceeds its blockade maximum; a stored maximum is a whole number, at least 3, and no higher than the printed display maximum |
| B22 | 33.x | cheap | error | the characteristic markers sit only on the power that owns them: GE `unified`; RU `tsrr`/`scorchedEarth`; OT `jihad`; UK `indiaStable`/`indiaIndependent`; FR `cityOfLight`/`government` |

### Known limits of the B group

- **B01** (decade deals, card markers) and **B03** (one card per impulse) describe
  a *change*, not a state, so they belong with `C`, which already receives the
  previous state.
- **B05** (standing armies vs manpower, reserve ceilings) and **B06** (the WTT
  declaration gates) bound an *action*: the engine enforces them in
  `canRecruitIn`/`recruit` and the declaration validators, and a state-level
  version cannot tell a mid-resolution state from a violation. They land with
  `D01` (validator agreement), where "allowed ⇒ dispatch succeeds" is decidable.
- **B07** deliberately does not check `defender` against the player list: 15.4.2
  stores a non-player control id there ("Serbia", "IT"). It also does not check
  that the objective count matches the aim, because the printed count depends on
  the aim and on the declaring card.
- **B18** reads the stored `maxIndustry` directly: `maxIndustryOf` clamps to the
  floor and the printed maximum, so the helper cannot report a bad stored value.
- `addReserve` models a "reserve army step" grant as whole 2-step counters, so
  the *number of steps* a card like Aux Armes grants is a rule-modelling
  question this catalog does not adjudicate; the 4.2 pool is what it can prove,
  and the helper now respects it.
- **B02** does not assert that home cards never enter deck or discard. `A01`
  treats `homeCards` as a permanent pool outside the zones by design (10.4), so a
  card appearing there is not a double placement.

## C–E — catalogued, not yet implemented

These are the remaining groups of the design. Each is listed with the state it
needs, because several cannot be written as a single-state check.

**B — the seventeen items still open.** The decade deal and its card markers
(10.1–10.3), one card per impulse (12.0), the standing/reserve ceilings
(7.2/7.3/12.2), the WTT declaration gates (12.17.1), truce expiry (13.5), victory
types and treaty options (16.x), territory transfer bookkeeping (13.1–13.3), what
each of the twelve end-phase steps owes beyond its cursor (20.2–20.12), rebels
(21.x), Italy (22.x), the crisis table's modifiers (23.2–23.4), the GW outbreak
(25.x), GW combat cards (26.1), GW impulses (27.1–27.5), exhaustion (27.6),
colonial war (29.2), surrender and elimination (30.1/30.2) and bot legality
(34.x). Most of these are assertions about a *resolution*, so they will be
written against a `C` delta rather than a lone state.

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
