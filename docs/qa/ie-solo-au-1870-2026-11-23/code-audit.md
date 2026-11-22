# Imperial Elegy — static code audit: solo 1870 as Austria-Hungary, to the Great War

Date: 2026-11-23 · Auditor: code-auditor (read-only) · Task: `task-2`
Repo: `/Users/larryw/tools/filmcentenary` · Branch audited: `master` (working tree, no edits made)

## Scope and authority

- Rule authority: **only `IE_rule.pdf`** (OCR at `.tmp/ie_rule.txt`) and the app's own page text.
  Playbook-only data (the 1870 setup display, Crisis Table cells, scenario goal lists) is
  treated as **unverifiable from the rulebook** and checked for *internal consistency*
  (scenario data vs. engine behaviour vs. tests vs. the live solo artifacts in `.tmp/au1870/`).
- Read-only audit. No source, test, or package files were modified; the only file written is this one.
- Existing suite baseline: `npx jest src/imperialElegy/scenarioData.test.ts --runInBand`
  → **109/109 pass** (2.3 s). Note that this file passes *while* several defects below exist —
  it asserts the setup-decision flags are written, not that the flags are ever consumed.
- Live solo evidence used (produced by the sibling playthrough agent, not by this audit):
  `.tmp/au1870/state0.json`, `trace.jsonl`, `text-*.txt`, `shot-*.png`.
  Observed values quoted below: `scenario=s1870`, `turn=3`, `wtt=1`, `seed=0`, `bots=[]`,
  `botDifficulty=normal`, AU `goals=["NG-30"]`, AU `goalDeck.length=6`,
  `flags.goalChoice:AU="NG-29,NG-30"`, first action-phase seat = `UK`.

**Severity scale**: P0 = breaks the audited playthrough / rule explicitly violated;
P1 = rules-visible wrong outcome on the audited path; P2 = wrong or missing display/fairness;
P3 = cosmetic/unverifiable-but-suspicious.

| # | Severity | One-line finding |
|---|----------|------------------|
| F1 | P0 | 1870 opening "draw 3 NGs, keep 1" is not a choice and silently destroys two NGs per power (AU deck 6 instead of 8) |
| F2 | P0 | Solo bot seats are never marked as bots; 34.4.5 free bot redeployment never runs and the chosen difficulty has no mechanical effect |
| F3 | P0 | 34.1 bot difficulty is not implemented for NG counts; bots draw NGs like humans in the end phase |
| F4 | P0 | 25.5 "draw to 3 NGs before scoring" is missing at GW outbreak (1870 GW often starts with 1 NG per power) |
| F5 | P1 | Franco-Prussian concession only partly applied: GE +1 card marker missing, FR "-1 card on the first turn" dead, turn-4 marker recorded but never used |
| F6 | P1 | FR bot always concedes the Franco-Prussian War (first-option default instead of a die, 34.3) — solo 1870 always takes the concession branch |
| F7 | P1 | AU NG-deck removal decision is inverted and can be a no-op: the card already kept by the opening draw cannot be removed, log claims it was |
| F8 | P1 | 25.2.2 GW alliance formation uses the constant `G.seed` (=0) instead of a die/choice → deterministic opening pair |
| F9 | P1 | AU Unstable Situation DRM counts nationalities with full citizenship, which 33.4.1 says are no longer minority nationalities |
| F10 | P2 | 20.11/2.4 NG draws never shuffle the NG deck, and unkept cards are appended to the deck end → deterministic draws |
| F11 | P2 | Metternich's Legacy is hard-wired to campaign turn 1, so an 1870 AU player never gets it |
| F12 | P2 | Expand Citizenship target number / Unstable Situation DRM are never displayed; AU player cannot see the roll needed |
| F13 | P3 | "Slovaks" has no Chinese label — the AU nationalities panel shows an untranslated name in the Chinese UI |

---

## F1 (P0) — Opening NG draw: no choice, and the two unkept NGs are destroyed

**Rule.** 2.4 (p. 6): *"During the End Phase of every odd turn … players will shuffle their NG deck,
draw three NG cards, keep one card, and return the other two to their NG deck."*
20.11 (p. 41): *"On turns 1, 3, and 5 players shuffle their NG decks, draw three NG cards, keep one,
and return the rest to their decks."* Play Note (p. 42): *"players start with 1 NG in the 1870 and
1880 scenarios."* The playbook's 1870 setup uses the same draw-3-keep-1 for the opening NG
("unverifiable from rulebook", but the scenario data and the app both claim it).

**Actual.** `engine/setup.ts:303-313`:

```ts
const draw = def.special.startingGoalDraw?.[power] ?? 0;   // GE 2, everyone else 3
const drawn = p.goalDeck.splice(0, draw);
p.goals.push(drawn[0]);                                    // no choice at all
p.flags.startingGoal = drawn[0];
log(G, power, "goalDrawn", {count: drawn.length, kept: drawn[0]});
```

`drawn[1..]` are **dropped from the game**: they are neither kept nor pushed back into
`goalDeck`. The correct existing pattern is right there for *The New Administration*:
`engine/effects.ts:5113-5117` pushes the non-kept cards back (`p.goalDeck.push(...drawn.filter(...))`)
and asks via a `goalChoice` pending decision.

Evidence (live solo state, AU is the human): `.tmp/au1870/state0.json` —
AU `goals=["NG-30"]`, `goalDeck.length=6`, `flags.startingGoal="NG-30"`.
AU's 1870 pool is 9 cards (`goalsForPower("AU","s1870")` = 8 + scenario-only `NG-31`); after a legal
draw-3-keep-1-return-2 the deck must hold **8** cards, and after the printed removal **7**.
The observed 6 proves two cards were destroyed. The same happens to all five bot powers.
`openingGoalDraw()` is imported by `moves.ts:255` but never called anywhere, i.e. the choice was planned and never wired.

**Impact on the audited run.** AU (and every bot) has a thinner NG deck for the turn-3 and turn-5
draws and a smaller pool at 25.5 scoring. The AU player also never chooses their starting NG.

**Verify.** Unit test: `setupImperialElegy(ctx,{scenario:"s1870"})` → `AU.goalDeck.length === 8`,
`AU.goals.length === 1`, and a pending/decision (or an explicit API) exists to pick the kept NG;
after resolution `goals.length + goalDeck.length + 2 returned` still equals 9.
Currently: deck 6, no decision.

---

## F2 (P0) — Solo bot seats are not marked as bots, so 34.4.5 (and `botDifficulty`) do nothing

**Rule.** 34.1 (p. 56): *"A bot's difficulty level determines how many NGs they draw … Easy: 3 NGs,
Normal: 4 NGs, Hard: 5 NGs."* 34.4.5 (p. 57): *"At the beginning of the maneuver step of a war, or the
GW, bots receive a free redeployment action based on their difficulty: Easy: redeploy 1 army;
Normal: redeploy 1/2 of all their armies; Hard: redeploy all armies."*
App page text (allowed authority), `components/i18n.ts:336`: *"One level covers every bot seat: Easy
draws 3 National Goals, Normal 4 and Hard 5, and the level also sets the bots' free redeployment."*

**Actual.** A solo match builds the game with `setupImperialElegy(ctx, {scenario, noGw, botDifficulty})`
— **no `bots` list** (`components/soloMatch.tsx:68-71`). The five bot seats are driven client-side by
`SoloBotSeat` (`components/soloBots.tsx`) but the engine cannot tell they are bots:

- `engine/setup.ts:80,109`: `G.bots` = `[]`; live evidence `.tmp/au1870/state0.json` → `"bots": []`.
- `engine/botRedeployment.ts:55-56`: `isBotSeat = isBotPower(G,power) || G.powers[power].flags.isBot === true`.
  `isBotPower` reads the empty `G.bots`; nothing ever sets `flags.isBot`
  (`grep -rn "flags.isBot\|isBot:" src` → only reads).
- Therefore `botFreeRedeployment` (`botRedeployment.ts:181-184`, called from
  `moves.ts:9018` for wars and `greatWarFlow.ts:1368` for the GW) skips **every** solo bot seat.
- `botDifficultyOf(G)` has exactly one engine consumer: `botRedeployment.ts:181`
  (the other read is the display badge in `components/BoardLayout.tsx:713`).
  In solo the redeployment gate above means the difficulty is read but never applied.

**Impact.** In a solo 1870 game the difficulty radio on the setup page is cosmetic. At GW outbreak
(`greatWarFlow.ts:1368`) the five bot powers get no free redeployment at all, and no other rule can
use the field either. The app's own page text promises otherwise.

**Verify.** Unit test: `setupImperialElegy(ctx,{scenario:"s1870",botDifficulty:"hard"})` → set
`G.phase="gwPlanning"`/`gw.turn=1` and call `startGwManeuver`; `botFreeRedeployment` must move GE's
armies (hard = all). Actual: 0 moved. Second test: the same state built with `{bots:["GE",...]}` moves them.
Fix direction: either write the five bot powers into `G.bots` (or `flags.isBot`) for a solo match, or
have `SoloBotSeat` hand the seat list to setup.

---

## F3 (P0) — 34.1 bot NG handling is not implemented in the engine

**Rule.** 34.1 (p. 56): *"Bots do not draw NGs when player's draw NGs, instead bots draw all their NGs
at the end of the game (if there has been no GW) or the start of the GW."* The level sets the count
(Easy 3 / Normal 4 / Hard 5).

**Actual.**
- `endPhaseDrawNgs` (`moves.ts:7460-7502`) draws for **every** power with no bot test and no
  difficulty test: `const drawn = p.goalDeck.splice(0, ngDrawCount(G, power));`
  (only the 1870/1880 GE-2 rule is honoured).
- At GW outbreak (`greatWar.ts:978-988`) each power's existing `goals` are scored; nothing draws
  4/5 NGs for a bot, and at the no-GW end (`victory.ts:430+`) nothing draws bot NGs either.
- `botDifficultyOf` is never consulted for a goal count anywhere in `src/` (see F2).

So a solo match behaves as if all six seats were human: bots draw 1 + turn-3 + turn-5 NGs (≤3)
and are scored on that hand, whereas a Normal bot should have 4 and a Hard bot 5.

**Impact on the audited run.** The AU player's five opponents score fewer NGs than the selected
difficulty promises (most visible at 25.5 / scenario end), and the difficulty picker is misleading
(compounds F2).

**Verify.** Unit test: 1870 solo-equivalent state (`botDifficulty:"hard"`), jump to
`outbreakGreatWar`; every bot power's `goals.length` must be 5 (34.1) and the human keeps the 25.5
top-up (F4). Actual: bots have whatever the end-phase draws left them (0–3). Also assert the turn-3
end phase does **not** draw for bot seats.

---

## F4 (P0) — 25.5 "top up to 3 NGs" is missing at the GW outbreak

**Rule.** 25.5 (p. 47): *"If the GW occurs early, it is possible for players to have less than 3 NGs.
If this happens, all players with less than 3 NGs draw 3 NGs and choose one to keep. They repeat this
process until they have 3 NGs to score."*

**Actual.** `engine/greatWar.ts:978-990` scores and clears the goals, with no top-up:

```ts
const scores = scoreGoals(G);
for (const p of POWERS) {
  if (scores[p].length > 0) G.powers[p].outbreakGoalScores = ...
  for (const entry of scores[p]) G.powers[p].vp += entry.vp;
  G.powers[p].goals = [];
}
```

No `goals.length < 3` branch exists (`grep "outbreakGoalScores|less than 3|NGs to score"` → only the
scoring/display references).

**Impact on the audited run.** The 1870 scenario is exactly where this rule bites: WTT starts at 1 and
the campaign is only four turns, so a GW that breaks out in turn 3/4 happens **before** the turn-3/5 NG
draws. In the live solo run the AU player held a single NG at turn 3. On outbreak the code would score
1 goal; the rule requires drawing up to 3 first (which can be worth up to 9 VP). This is the single
largest scoring error on the "play until the Great War breaks out" path.

**Verify.** Unit test: `setupImperialElegy(ctx,{scenario:"s1870"})`; force
`changeWtt` + `crisisRoll` → outbreak; assert every power has 3 goal scores (after the 25.5
draw/keep decision). Actual: 1 (AU), 1 (others).

---

## F5 (P1) — Franco-Prussian concession is only partly applied

Source is the 1870 scenario display (playbook p. 4) → **cannot verify quotes from the rulebook**;
this is an internal-consistency finding: the scenario data notes claim the six printed steps are
implemented (`constant/scenarios/s1870.ts:311-320`), and the sibling live run proves the branch is taken
(first action-phase seat is UK, i.e. GE's first impulse was skipped).

`engine/scenarioSetup.ts#applyFrancoPrussianConcession`:

| Printed step | Code | State |
|---|---|---|
| 1. GE gains control of Alsace-Lorraine/Bavaria/Saxony; eliminate Saxon & Bavarian armies + both GE ECs; 1 GE army step loss; keys 10; **+1 card marker**; 2-turn FR truce | `scenarioSetup.ts:157-186` | all applied **except the +1 card marker**: `G.powers.GE.cardMarkers` is never incremented (compare FR's `-= 1` at line 203) |
| 2. FR displace; eliminate 2 armies + 1 EC; keys 8; −1 card marker; 2-turn GE truce | `scenarioSetup.ts:188-203` | applied (FR `cardMarkers -= 1`) |
| 3. Alliance track GE TA-uncommitted / FR committed TE | `scenarioSetup.ts:205-210` | applied |
| 4. Turn Track: −1 card marker with FR control marker on turn 4 | `scenarioSetup.ts:212-216` | **recorded only** (`G.flags.francoPrussianTurn4Marker = 4`); nothing ever reads this flag (`grep francoPrussianTurn4Marker` → one write, zero reads) |
| 5. GE no home card; **FR receives one less card** | `scenarioSetup.ts:218-222`, read by `francoPrussianPrepRule` (`scenarioSetup.ts:315-323`) | GE side applied via `settleSkippedHomeCards`; **FR −1 card is dead**: the first-turn hand is dealt in `engine/setup.ts:293-296` before the concession decision exists, and `prepBegin` (`game.ts:255-265`) only adds cards when `G.turn > scenarioOf(G).firstTurn`. The flag is read only inside that first-turn window, which never comes. |
| 6. Skip GE's first impulse | `scenarioSetup.ts:224-227`, `firstImpulsePower` line 360-362 | applied (live trace: first action stamp `3/action/UK`) |

Also, the comment at `scenarioSetup.ts:181-182` says the printed keys are "checked by
`scenarioSetup.test.ts`" — **that test file does not exist** (`ls src/imperialElegy/scenarioSetup.test.ts`
→ No such file); the Franco-Prussian assertions live in `scenarioData.test.ts:279-330` and only assert
the flags were *written*, not the card economy. This is why the suite is green.

**Verify.** Extend the existing `scenarioData.test.ts` Franco-Prussian test:
`G.powers.GE.cardMarkers === 1` after the concession (actual 0); FR first-turn hand = `cardsToDraw-1`
(actual full); `G.flags.francoPrussianTurn4Marker` is consumed by the turn-4 prep draw.

---

## F6 (P1) — The FR bot always concedes the Franco-Prussian War (no die, 34.3)

**Rule.** 34.3 (p. 56): *"if a bot ever has to make a decision that isn't explicitly laid out on the bot
PAC, roll a die to determine the result."* The Franco-Prussian decision is not on the Bot PAC.

**Actual.** `moves.ts:6104-6118` opens the `francoPrussianConcession` pending decision for FR with
`option("concede", …)` **first** (`moves.ts:6110-6116`). `engine/bot.ts:397-495` has no special case for this kind and the
`default:` branch (`bot.ts:497-498`) returns `resolvePending` with `pending.options[0].id` — i.e. the
conceding option, every time, deterministically. In the audited solo game (AU human, FR bot) this means
the concession branch is always applied; the live trace confirms the consequence
(`.tmp/au1870/trace.jsonl`: first action-phase state is `3/action/UK`, which only happens when
`francoPrussianSkipGeImpulse` was set).

The same first-option default also drives every other off-PAC choice for the five bots
(crisis target/bordering nation, event targets, free demobilization moves, goal keeps), so bot play is
fully deterministic where the rules call for a die roll. For the audited path the FR concession is the
consequential one.

**Verify.** Unit test: solo/setup state at the FR `francoPrussianConcession` pending; stub
`ctx.random.Die` to 6 and 1; assert the bot's answer is not always `concede` (or that the engine
rolls). Actual: always `concede` regardless of dice.

---

## F7 (P1) — AU scenario NG-removal: prompt inverted, and the removal can silently no-op

**Rule.** Rulebook 2.4 (p. 6): *"Special: AU has 9 NG cards, but one of them is only used in the 1870
and 1880 scenarios."* The 1870 display (unverifiable from the rulebook) says AU *"may remove either
'Contain Italy' or 'Contain Prussia' from their NG deck."*

**Actual.**
1. `moves.ts:6120-6136` opens `scenarioGoalChoice` with prompt *"Remove one of these National Goals
   from the deck?"* but the options are the two goals themselves, and
   `moves.ts:6072` → `scenarioSetup.ts:58-74#resolveGoalChoice(G, power, keep)` treats the chosen
   option as the goal to **keep**: it deletes every *other* candidate from `goalDeck`. Choosing
   "Contain Italy" therefore keeps it and removes "Contain Prussia" — the opposite of what the prompt
   says. (The live UI title is *"choose the NG to keep"* while the same panel prints the remove
   prompt; `.tmp/au1870/text-pending-AU-scenarioGoalChoice.txt`.)
2. Structural collision with F1: the opening draw ran **before** this decision
   (`setup.ts:303-313` vs. `openSetupDecisions` in `moves.ts:6104+`), so one of the two candidates can
   already be in AU's hand. Live evidence: `.tmp/au1870/state0.json` has AU `goals=["NG-30"]` while the
   pending candidates are `NG-29,NG-30`. Choosing "keep NG-29" then runs
   `goalDeck.filter(id !== "NG-30")` — NG-30 is not in the deck, so **nothing is removed**, while the
   log at `scenarioSetup.ts:73` claims `goalRemoved {goal:"NG-30"}`. AU ends up with Contain Prussia in
   hand **and** Contain Italy still in the deck: both stay in play, the printed removal does nothing,
   and the player's intended keep is reversed.
3. There is no "keep both" option even though the print says "may remove"; the UI shows a decline
   button for a decision it labels mandatory ("此项决策为必选"), and declining does not run
   `resolveGoalChoice` (falls through `declinePendingDecision`'s generic tail, `moves.ts:6920-6928`),
   so the decision simply reopens on the next `finishPrep`.

**Impact.** In the audited run the AU player's one printed deck edit is unusable/counterproductive and
the log is wrong.

**Verify.** Unit test: `setupScenario("s1870")`; note the hand's starting goal; call
`resolveGoalChoice(G,"AU", <the candidate NOT in hand>)`; assert (a) the removed goal is gone from both
hand and deck, (b) the log matches, (c) the chosen goal is actually the kept one. Actual: log says
removed, card remains.

---

## F8 (P1) — 25.2.2 GW alliance formation uses a constant seed, not a die

**Rule.** 25.2.2 (p. 46): *"In the unlikely event that neither alliance has a player in it, roll a die
and use the following results: 1 – GE and FR go to war … 6 – AU and GE go to war."* For the one-empty
alliance case: *"the alliance with players declares war on a player of their choice (roll a die to
break a dispute)."*

**Actual.** `engine/greatWar.ts:823-841#formAlliances`:

```ts
if (te.length === 0 && ta.length === 0) {
  // 25.2.2: neither alliance has a player - roll a die for a pair of enemies.
  const roll = (G.seed % 6) + 1;            // line 828
  ...
} else if (te.length === 0) {
  const target = POWERS.find((p) => G.powers[p].alliance === "neutral");
  if (target) G.powers[target].alliance = "teCommitted";
}
```

`G.seed` is written once as `seed: 0` (`engine/setup.ts:130`) and **never updated**
(`grep "G\.seed"` → only this read; live state0 confirms `"seed": 0`). So the 25.2.2 die is always 1:
GE vs FR. The one-empty-alliance branch likewise picks the first neutral power in seat order instead
of letting the players choose.

**Impact on the audited path.** The 1870 scenario starts with **all six powers neutral**
(`constant/scenarios/s1870.ts:39-120`, `alliance: "neutral"` for every power). In the solo run the
Franco-Prussian concession puts GE in the Triple Alliance and FR in the Triple Entente (F6), so the
all-neutral branch may not fire on the first turn; but it is still reachable in 1870 — if FR is human
and chooses to fight, or once a 20.9 alliance-resolution step shifts the two chits back to neutral —
and the one-empty-alliance branch is reachable as soon as only one side has a player. Whenever it
does fire the result is fixed (GE vs FR for the all-neutral roll; seat-order-first neutral for the
one-empty case) instead of the rulebook's die/choice, which decides who AU fights in the GW.

**Verify.** Unit test: `setupScenario("s1870")`; force `changeWtt(4)` + a crisis roll → outbreak; run
twice with different `ctx.random.Die` sequences; assert the pair changes. Actual: GE/FR both times
(`G.seed` constant). Also assert the one-empty branch offers a choice.

---

## F9 (P1) — AU Unstable Situation DRM over-counts full citizens

**Rule.** 33.4 (p. 55): *"Unstable Situation: whenever AU decreases stability, roll a die. Add a +1 DRM
for each **minority nationality with rights**."* 33.4.1 (p. 55): *"a nationality with full citizenship is
no longer considered a minority nationality to the AU player."*

**Actual.** `engine/characteristics.ts:229-242`:

```ts
const rights = p.rights.length;
const dieRoll = typeof ctx.dieRoll === "number" ? ctx.dieRoll : null;
const total = dieRoll === null ? null : dieRoll + rights;
```

`grantAuCitizenship` (`characteristics.ts:1567-1578`) pushes every citizen into `p.rights` as well
("Every citizenship grant therefore records rights as well"), and a card grant does the same, so
`p.rights` contains citizens. After AU grants citizenship to N nationalities, the Unstable Situation
roll gets **+1 too many per citizen** — directly inflating AU's chance to avoid the
discard/minus-1-marker penalty.

**Impact on the audited run.** AU's characteristic is a core part of the 1870 solo experience
(Reforms → Expand Citizenship is the natural CP sink); each successful citizenship makes AU's
stability losses *harder*, not easier, which is opposite of the printed rule.

**Verify.** Unit test: AU `citizenship=["Hungarians","Czechs"]`, `rights=["Hungarians","Czechs"]`;
`stabilityLoss(G,"AU",-1,{dieRoll:2})` → expected `total=2` (0 minority rights), actual `total=4`.
Existing test `characteristics.test.ts:127-140` only covers `rights` without citizenship.

---

## F10 (P2) — 20.11 NG draws are never shuffled (and returned cards are appended)

**Rule.** 2.4 (p. 6) and 20.11 (p. 41): *"players will **shuffle their NG deck(s)**, draw three NG
cards, keep one card, and return the other two to their NG deck."*

**Actual.** `moves.ts:7499` draws the top three without shuffling:
`const drawn = p.goalDeck.splice(0, ngDrawCount(G, power));`
and `chooseGoal` (`moves.ts:7705-7713`) appends the two unkept cards to the **end** of the deck
(`p.goalDeck.push(...)`). NG decks are shuffled only at setup / goal-deck edits
(`setup.ts:246`, `scenarioSetup.ts:49`). So the turn-5 draw is fully determined by the turn-3
result and the opening splice order; the printed shuffle never happens. Same gap in the
New Administration path (`effects.ts:2923`) and in the 25.5 top-up that is missing (F4).

**Impact.** Without the shuffle the NG deck order is correlated with how the opening draw sliced it;
the AU player who notices can predict goals. Rules-visible but hard to see in a single playthrough.

**Verify.** Unit test: 1870 state at the turn-3 end phase with a known `goalDeck` order; after the
draw/keep, assert the deck order is not simply `[remaining..., returned...]` (i.e. a shuffle was
applied). Actual: exact deterministic order.

---

## F11 (P2) — Metternich's Legacy never fires in the 1870 scenario

**Rule.** 33.4 (p. 55): *"Metternich's Legacy: at the end of the diplomacy phase of turn 1 AU gains an
alliance with two minor powers of their choice that do not contain an opponent's diplomatic marker."*
The rulebook does not say how a scenario that starts at turn 3 adapts this. **Cannot verify** the
scenario-specific reading from the rulebook; flagged because the audited path is an AU playthrough and
the characteristic is completely absent from it.

**Actual.** `moves.ts:1011`: `if (G.turn === 1 && !G.persistent.metternich) { openMetternichChoice(...) }`
and `characteristics.ts:1602-1612#metternichAllies` also requires `G.turn === 1`. The 1870 scenario's
first turn is 3 (`s1870.ts:27-28`), so the check never passes: no decision, no log, no allies. The
scenario data has no 1870-specific Metternich flag, and the sibling live trace at
`.tmp/au1870/trace.jsonl` closes the turn-3 diplomacy phase without any `metternich` pending.

**Impact.** AU loses its printed turn-1 windfall in 1870. If the intended reading is "first diplomacy
phase of the scenario", this is a P1 rules bug; if the scenario really removes it, the app should say so
in the scenario text. Existing test `auMetternichChoice.test.ts` only covers the campaign turn 1.

**Verify.** 1870 solo as AU: play through prep → diplomacy and close the phase; expected (if adapted) a
`metternich` pending for AU with two choices; actual: phase advances with none.
Suggested engine fix: key on `G.turn === scenarioOf(G).firstTurn` (as `firstImpulsePower` does).

---

## F12 (P2) — AU characteristic numbers are not displayed

**Rules.** 33.4/33.4.1 (p. 55): Expand Citizenship succeeds *"on a roll ≥ 3, increased by one for each
nationality that already has citizenship"*; Unstable Situation adds *+1 DRM per minority nationality
with rights*.

**Actual.** The PlayerMat prints the eight nationalities and their state (rights / full citizenship /
none) — `components/PlayerMat.tsx:428-456` and the live page text confirm this works. However **no
component reads the computed numbers**: `canGrantCitizenship` returns `existingCitizenships`,
`difficulty`, `rollNeeded`, `guaranteed`, `impossible` (`characteristics.ts:1512-1560`) and
`grep -rn "rollNeeded\|existingCitizenships\|baseDifficulty" src/imperialElegy/components` → 0 hits.
The AU national-actions panel (`components/NationalActionsPanel.tsx:80-86`) only offers the
nationality dropdown and the stability-sacrifice checkbox; `useBoardModel.ts:462-515` only uses
`allowed`/`reasons`. Likewise the Unstable Situation rights DRM is never shown.

**Impact.** The AU player must recount rights/citizenship from the eight-item list to know the target
number before spending 3 CP + optional stability; a mis-click is irrecoverable (CP spent, die rolled).

**Verify.** UI path: AU action phase → National Actions panel: no "needs 4+" / current difficulty
anywhere. Expected: show `rollNeeded` (e.g. "needs 4+ with the −2 stability DRM = 2+") next to the
Expand Citizenship button.

---

## F13 (P3) — "Slovaks" is untranslated in the AU nationalities panel

`engine/nationality.ts:118-126` maps Chinese labels for every nationality except `Slovaks`;
`AU_NATIONALITIES` includes `"Slovaks"` (`characteristics.ts:61-70`). The live Chinese page text
(`.tmp/au1870/phase0.txt`, the PlayerMat nationalities block) shows `Slovaks` in Latin text between
`罗马尼亚` and `克罗地亚`. `nationalityLabel` falls back to the English key
(`nationality.ts:128-129`), which is what the player sees.

**Verify.** Open a solo 1870 AU match with the Chinese UI; the AU mat lists "Slovaks" among Chinese
names. Fix: add `Slovaks: "斯洛伐克"` to `NATIONALITY_LABELS_ZH`.

---

## Cannot verify from the rulebook (playbook / component data only)

These are checked for internal consistency only; they are not rulebook claims:

1. **1870 scenario setup quantities** (turn 3–6, WTT 1, unit/fort/marker placement, removed cards
   `Suez Canal, American Civil War, Sepoy Mutiny, Second Opium War, Folie de Grandeur, The Dual
   Monarchy, Reforms of the 1860s, Ironclads`, build box `Bulgaria, Serbia, Bosnia`, GE's 2-NG draw,
   NG draws on turns 3/5, the AU goal-deck edit). Source: playbook p. 4. The data itself is
   self-consistent and `scenarioData.test.ts` passes; the defects in F1/F5/F7 are in the engine's
   *application* of that data, not in the transcription.
2. **The six Franco-Prussian adjustment steps** (F5/F6): exact text is the scenario display; the
   rulebook only defines war of conquest, truces and the alliance track.
3. **Crisis Table cells and their footnotes** (`engine/crisisTable.ts`, including the
   "International Conference resets the WTT to 4 / only once" footnote): the rulebook (23.0–23.5,
   pp. 44-45) states only that every result except International Conference starts the GW, and who
   rolls / what the special rows do. Internal check performed: all four WTT-increasing cards that are
   in the 1870 deck (`IE-A017` Assassination, `IE-A053` Powder Keg, `IE-A015` Shifting Alliances,
   `IE-A071` 'Urabi Revolt) are present in `CRISIS_INCITING` (`crisisTable.ts:364-394`), so no 1870
   inciting event falls through to the generic `fallback` row.
4. **`outbreakGreatWar` sets `G.wtt = 4` after the outbreak** (`greatWar.ts:909` sets 5, line 1034
   resets to 4). The rulebook has no clause resetting the WTT when the GW starts; but the WTT is only
   used pre-GW, so the only visible effect is the track display during the GW. Internal note only.
5. **AU starts the 1870 scenario with Hungarian citizenship** (`s1870.ts:77-84`) while `rights` is
   empty. 33.4.1 says a citizen *retains the benefits of rights*, so storing citizenship without
   rights is internally inconsistent; it is harmless today because the two engine consumers
   (`unstableSituation` counts `rights` — see F9 — and `auRightsDecision` refuses citizens) do not
   change behaviour for Hungarians. Worth normalising when F9 is fixed.

## Checked and found sound (so the team can rule these out)

- **Turn window / scenario end vs. GW.** `finishScenario` is reached only from `endPhaseTurn`
  (`moves.ts:6991-6998`) and the unused `endTurn` move (`moves.ts:7729-7734`); a GW outbreak sets
  `G.phase = "gwPlanning"` (`greatWar.ts:1033`) inside the action phase, so the turn-6 scenario end
  cannot pre-empt a GW that was actually rolled. The GW then runs to its own turn-5 limit
  (`greatWarFlow.ts:3677-3680`) or an alliance victory (`greatWar.ts:2011+`).
- **20.10/20.11 end-phase order** matches the printed SoP: 20.9 alliance step → 20.10 WTT −1 →
  20.11 NG draws → 20.12 advance turn (`moves.ts:7539-7562`); the 1870 draw turns are 3 and 5
  (`scenario.ts:68-76`, `s1870.ts:280-283`), GE draws 2.
- **WTT-5 crisis is opened for every WTT increase that occurs inside a card effect**, including the
  special handlers (post-chain checks at `effects.ts:703,723`; the `wtt` effect at `effects.ts:4304-4310`).
  The only non-event WTT increase is 13.3's conquest declaration (`moves.ts:3348`), and rule
  "Players cannot declare war if the WTT is 3 or higher" (p. 28) caps it at 3, so it cannot reach 5;
  no defect there.
- **1870 setup basics** match the scenario data in the live state: turn 3, decade 1870s, WTT 1,
  Suez complete, Egypt independent with IMP markers, build box, 8 removed cards exist in
  `cards.data.ts`, `alliance: neutral` for all six powers.
- **Bots' 34.2 home-card pile** follows the printed placement (GE/OT top, UK bottom, FR/AU/RU random)
  — `moves.ts:1091-1111#pileHomeCard`, revealed on the bot's impulse (`bot.ts:1135-1136`).
- **20.1 Militarism / 20.5 / 20.9** open a decision for the human and have deterministic bot
  defaults (`moves.ts:6741-6758`); the observed solo end-phase pendings (`militarism`,
  `auUnstable`, `demobilizationFreeAction`) were answered without INVALID_MOVE spam in the trace
  (the FR demobilization loop visible in `.tmp/au1870/trace.jsonl` is the bot walking each eligible
  unit one at a time; it terminates when `demobilizationCandidates` empties — slow, not stuck).

## Suggested cheap regression tests (no suite-fixing required)

1. `1870 setup keeps the NG pool whole` — `AU.goalDeck.length === 8` before the printed removal,
   a pending keep-1 choice exists, and no card id is lost (F1).
2. `solo bot seats are recognised` — `botDifficultyOf` + `botRedeployCount` are applied by
   `botFreeRedeployment` for `{scenario:"s1870", botDifficulty:"hard"}` (F2).
3. `25.5 tops the NG hand up to 3 at the outbreak` — force a turn-3 WTT-5 crisis, assert
   `outbreakGoalScores.length === 3` for AU (F4).
4. `Franco-Prussian concession card economy` — GE `cardMarkers === 1`, FR first-turn hand is one
   card smaller (F5).
5. `AU goal removal actually removes` — resolve `scenarioGoalChoice` with the candidate that the
   opening draw already holds; assert it is gone and the log matches (F7).
6. `25.2.2 is random` — outbreak from the all-neutral 1870 setup with two different die sequences
   produces different pairs (F8).
7. `Unstable Situation ignores full citizens` — `rights` including citizens yields the same DRM as
   minority-rights only (F9).
