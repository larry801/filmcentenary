# Imperial Elegy — Rules Checklist for the Solo 1870 Austria-Hungary → Great War QA Run

**Run under test:** solo mode; **1870 scenario** (turn 3 = 1870s … turn 6 = 1900s, 4 turns); **Austria-Hungary (AU)** seat; play continues **until the Great War (GW) breaks out** (Outbreak Step reached / GW declared). All non-AU seats are bots.

**Rule authority:** `IE_rule.pdf` only. Quotations below are English text from that PDF's text layer, with line-wrap hyphens removed. Page citations are the **printed page numbers** in the rulebook (PDF page = printed page in this file; verified from page footers).

**Not authority:** `IE_playbook.pdf`, `IE_ERRATA*`, `docs/imperial-elegy/**`, source code, web. Anything that only exists there is tagged **`[NOT IN RULEBOOK]`** and must not be graded as a rulebook violation.

How to use: for each rule group, compare the on-screen behavior against the quoted rule and the "check in playthrough" bullets. A section qualifies only if every bullet for it is observable and true; unresolved bullets go to the evidence log in §14.

---

## 0. Run baseline structure

### 2.0 / 2.1 / 4.3 / 4.5 — turns, phases, turn order, impulses

> **2.0 (p. 5):** "IE is a Card Driven Game that takes place over 7 turns, with each turn representing a decade. If a Great War (GW) occurs, the game can be extended by, at most, 6 additional shorter GW turns (numbered 0-5). … IE was designed primarily as a 6 player game, but it can accommodate smaller player counts, including solitaire."

> **2.1 (p. 5):** "Each turn is composed of the following 4 phases, which are in order:
> - **Prep Phase [10.0]:** (1) add new cards to the deck, (2) reshuffle deck, (3) deal cards. (4) Optional: players can each discard a random card to gain 1 stability, cannot discard home card or mandatory events
> - **Diplomacy Phase [11.0]:** (1) make deals, (2) announce deals in turn order, (3) select home card
> - **Action Phase [12.0]:** in turn order, players perform impulses by playing cards to conduct actions and events
> - **End Phase [20.0]:** (1) militarism: gain one army step or prevent a fort from degrading, (2) degrade forts, (3) non-player power build step, (4) all naval units go to port, (5) set manpower, (6) industrialize, (7) progress truces, (8) progress WoIs, (9) alliance resolution step, (10) decrease the WTT by 1, (11) on turns 1, 3, and 5 players draw three NGs keeping one, (12) advance the turn marker"

> **4.3 (p. 12):** "When instructed to do so, play proceeds in the following order: (1) GE (2) UK (3) FR (4) AU (5) RU (6) OT"

> **4.4 (p. 12):** "The player who is currently taking an impulse is the active player."
> **4.5 (p. 12):** "An impulse refers to the actions players take when they are the active player during the action phase. A player can have any number of impulses during the action phase, but most players will have four to seven. A turn refers to completing one sequence of play. Certain actions can be taken once per impulse whilst others can be taken once per turn."

**Check in playthrough**
- [ ] Each of turns 3–6 runs all four phases in the stated order; no phase skipped before the GW.
- [ ] Default turn order inside each phase is GE → UK → FR → AU → RU → OT; AU is 4th.
- [ ] "Active player" highlight/state moves correctly with the impulse, and actions flagged "once per turn" cannot be repeated in the same turn.
- [ ] Impulse count is driven by cards (a player may take many impulses per turn), not one fixed action per turn.

---

## 1. Solo / bot rules — 34.0 to 34.5

### 34.0 Bots (p. 56) — bot setup

> **34.0 (p. 56):** "When playing with less than 6 people, players can be controled [sic] by IE's bot system. Any number of 'players' can be bots, and bots can be substituted for any 'player.' (Real life) players use the bot PAC to determine what a bot does on its impulse."
> "**Design Note:** Some may find the bot rules to be a bit 'loose.' This is intentional. … (real life) players will be constantly rolling dice to randomly determine what bots do on their impulse."

**Check in playthrough**
- [ ] In the solo 1870 AU game exactly one seat is human (AU) and the other five are bots — the rulebook allows any number of bots; **which** seats are bots in the 1870 scenario is `[NOT IN RULEBOOK]` (scenario setup is in the playbook).
- [ ] Bots are driven by the **Bot PAC** card (and the **BMPIT**), not by human negotiation. Where the UI makes an unspecified bot decision, it must roll/randomize rather than silently optimize.
- [ ] Bot decisions are reproducible from a dice roll / seeded RNG (a "loose" framework, deliberately not deterministic flowcharts).

### 34.1 Bot Difficulty (p. 56) — NG counts 3 / 4 / 5

> **34.1 (p. 56):** "Bots in IE have a difficulty rating, this difficulty does not make the bots play inherently better, but it does make it easier for them to score VPs. Bots do not draw NGs when player's draw NGs, instead bots draw all their NGs at the end of the game (if there has been no GW) or the start of the GW. At the start of the game, set a difficulty level for the bots … A bot's difficulty level determines how many NGs they draw. The bot difficulty levels are:
> - **Easy: 3 NGs**
> - **Normal: 4 NGs**
> - **Hard: 5 NGs**
>
> **Important:** a bot's difficulty level also determines how many armies they get to redeploy for free at the start of a war."
> "**Design Note:** Yes this means bots cheat, and yes, in theory, a hard bot may be impossible to beat. … hard bots are supposed to be exactly that, hard."

**Check in playthrough**
- [ ] A difficulty level (Easy/Normal/Hard) is chosen at game start (per bot or globally per rulebook's "in theory … for each bot" allowance).
- [ ] Bots do **not** draw NGs during the End Phase when the human/AU draws NGs (20.11); their NG total is fixed by difficulty: 3 / 4 / 5 cards.
- [ ] Bot NGs are drawn "at the end of the game (if there has been no GW) or the start of the GW." In this run (ends at GW outbreak) the bot NG set must materialize at GW start, not before.
- [ ] Difficulty also sets each bot's free wartime redeployment quantum (see 34.4.5): Easy = 1 army, Normal = ½ of all armies, Hard = all armies.
- [ ] Difficulty does **not** change bot action logic/PAC priorities (it only changes VP scoring and free redeployment).

> **Interaction ambiguity (record as open question, not a bug):** 34.1 says bots draw *all* their NGs at GW start, while 25.5 (p. 47) says "all players with less than 3 NGs draw 3 NGs and choose one to keep." The rulebook does not say whether 25.5 applies to bots. `[NOT IN RULEBOOK]`

### 34.2 Bot SoP (p. 56) — diplomacy / home cards / phase behavior

> **34.2 (p. 56):** "All bot actions are listed on the Bot PAC, and are not explicitly laid out here. Bots will act in the following ways in each phase of the turn:
> - **Prep Phase:** Bots are dealt their cards as normal. Each bot's cards are shuffled into a pile. Bots will take the optional stability increase [10.4] if their stability is ≤ 2.
> - **Diplomacy Phase:** Bots do not participate in the diplomacy phase. Do not choose a home card for bots, instead each bot adds a random home card to their pile. When a bot home card is revealed, use the 'Home Card Revealed' section in the PAC to determine which home card is played. Add home cards to the piles as follows:
>   - GE and OT **on top** of their pile
>   - FR, AU, and RU **shuffled in**
>   - UK **on bottom** of their pile
> - **Action Phase:** Bots will never pass. On a bot's impulse reveal the top card of their pile and conduct a priority 1 action or roll a die to conduct priority 2 actions.
> - **End Phase:** Bots will always build an army step instead of maintaining a fort (unless they cannot build an army step)."

**Check in playthrough**
- [ ] Bots are dealt cards in Prep like a normal player (per 10.2/10.3), then their hand is a **single shuffled pile**.
- [ ] A bot takes the +1 stability optional discard ("optional stability increase [10.4]") **only when its stability ≤ 2**, and the discarded card is random (10.4 rules).
- [ ] Bots do **not** negotiate, give/receive cards, or choose a home card strategically; one random home card is inserted into the pile at the position required by the list (GE/OT top, FR/AU/RU random, UK bottom).
- [ ] On a bot impulse the **top** pile card is revealed; it is either played for its event (priority 1) or a die is rolled for priority 2. The bot **never passes**.
- [ ] A bot's End-Phase militarism choice is always "gain 1 army step"; it only "prevents fort degradation" if it literally cannot build an army step.

### 34.3 Bots in the Action Phase (p. 56–57)

> **34.3 (p. 56):** "The priority 1 actions are listed in priority order. … if a bot ever has to make a decision that isn't explicitly laid out on the bot PAC, roll a die to determine the result. If a bot cannot play an event or has excess CP it will build armies. Then they will spend any additional excess CP on the Major Power Influence Track using BMPIT. Bots will always spend all their CP to influence a single power. Exception: Neutral bots may split their CP, see below BMPIT on bot PAC."

> **34.3.1 (p. 56):** "When bots build land units they place them in their capital if their capital does not contain a land unit. If their capital has a land unit, place bot units on a space adjacent to another player. Prioritize spaces that do not border players who are in an alliance with the bot. Apply the same process to building forts. Bot naval units will be placed in a random port they control until that port has reached its stacking limit."

> **34.3.2 (p. 57):** "When performing a priority 2 action, unless a 5 or 6 is rolled, a bot will automatically spend 1 CP to pacify a space if able. In this case 'if able' means if they currently have a land unit in a space with a pacification marker."

> **34.3.3 (p. 57):** "A bot will not play its home card for its event if their stability is at 6 and their home card event would have less of an effect than playing the card for CP. Example: The GE bot plays German General Staff but already has 6 stability … The bot will instead spend the card for CP …"

> **34.3.4 (p. 57):** "The bot box is located under the CP value of certain action cards. This box is only utilized when playing with a bot(s). If bot plays a card and that bot's player-power is listed in the bot box, that bot will automatically play that card for its event if able. … However, bots will never play a card that (1) hurts the bot or (2) hurts one of the bot's allies."

**Check in playthrough**
- [ ] Priority-1 actions are evaluated in the PAC's stated priority order; only when none applies does the bot roll for a priority-2 action.
- [ ] Excess CP always becomes armies first, then a **single** MPIT power via BMPIT (except neutral bots may split, per PAC).
- [ ] Bot unit placement follows the capital → adjacent-to-another-player → avoid allied borders sequence; naval units go to a random controlled port with stacking space.
- [ ] Priority-2 pacification: automatic 1 CP spend **unless the die is 5–6**, and only if the bot has a land unit in a pacification-marked space.
- [ ] Bot at stability 6 does not waste its home card's weak event; it plays it for CP if the event is the lesser effect.
- [ ] Any card whose bot box lists the bot's power is auto-played for its event when able — but never if the event hurts the bot or a bot ally.

### 34.4 Bots in Wartime (p. 57)

> **34.4.1 Bot Declarations of War:** "Bots only declare war using their home card. Bots will not declare war on a power that has ≥4 more army steps than them (including minor power allies)."

> **34.4.2 Bot War Aims:** "Bots will always target the closest spaces. If a bot has 0 industry they will only target a single space, otherwise they will target two spaces."

> **34.4.3 Bot War Budget:** "Bots will always play their top card, unless it's their home card, for their war budget. If their home card is their top card, draw the next card to use it as the bot's war budget. If a mandatory event is drawn, draw another card. In both of the above cases return the unplayed card to the bot's card pile."

> **34.4.4 Bot Alliances:** "Bots will always call allies. Committed bots will always join their allies if called. Aligned bots will join a war on a roll of 3+, one bot invited to join via Balance of Power will join on a roll of 3+ provided they are given the card for entering the war. Bots will use their top non home card to join a war. Bots will aid minor powers."

> **34.4.5 Free Bot Redeployment (p. 57):** "At the beginning of the maneuver step of a war the GW bots receive a free redeployment action based on their difficulty: [sic — likely 'of a war or the GW']
> - **Easy: redeploy 1 army**
> - **Normal: redeploy 1/2 of all their armies**
> - **Hard: redeploy all armies**"

> **34.4.6 Bot Behavior in Wartime:** "In wartime, bots are controlled by a player ally. If the bot is in the neutral box, use the Bot Wartime Action Priorities list on the Bot PAC …"
> **34.4.7 Bot ECs:** "Bots will use their EC if the differential after support is between -2 and +2 in their favor."
> **34.4.8 Bot Treaty Options:** "Bots will never give land or +1 card markers to other players, they will always give treaty options [16.2] to themselves."

> **34.5 Bot Response and Combat Cards (p. 57):** "Bots will never play response cards or combat cards for their events. Additionally, bots will never play the Impulsive Ruler card for its event. Exception: a UK bot might play Balance of Power after a war is declared, see bot PAC."

> **Naming note:** task notes call 34.4.5 "demobilization," but 34.4.5 is **Free Bot Redeployment**. The demobilization step is **17.0** (p. 34): "All players involved in the war do the following • Check for blockade [17.1]. • Remove all reserve armies from the map and place them in their respective reserve armies holding box. • Displace any units in enemy controlled territory [5.7]. • All belligerent players then receive a free redeployment action [12.14] followed by a free naval movement action [12.3] (the winning side goes first, followed by the losing side). These free actions allow players to move all their units, not just those that participated in the war." → **17.1 (p. 34):** "If a player is blockaded when the war ends, they gain a -1 card marker. … Major Victory Exception: a player (or players belonging to an alliance) that won a major victory can never be blockaded." Note that **17.0 demobilization applies to pre-GW wars**, not to the GW itself (the GW has no demobilization step; it has the Winter Step, 29.0).

> **Naming note:** the rulebook's AU ability is **Incorporate** (33.4), not "Annexation." If UI/QA docs say "Annexation," treat it as an alias for Incorporate and grade against the 33.4 text.

**Check in playthrough**
- [ ] A bot only declares war via its home card; it refuses a target with ≥ 4 more army steps (counting minor-power allies).
- [ ] Bot war aims = closest space(s); 1 target if industry is 0, 2 targets otherwise.
- [ ] Bot CP war budget = top non-home card; home card on top → draw next card; mandatory event drawn → draw another; unplayed card returns to the pile.
- [ ] Bot alliance calls/joins use the stated thresholds (aligned join 3+, Balance-of-Power invite 3+, committed auto-join); cost = top non-home card.
- [ ] Free redeployment at the start of a war / the GW matches difficulty (1 army / half of all / all).
- [ ] Bots never play response/combat card **events** (they can still use them as CP where applicable), never play Impulsive Ruler's event; only a UK bot may play Balance of Power.
- [ ] Bots always take treaty options onto themselves (never grant land or +1 card markers to others).
- [ ] When an AU war (not the GW) ends, the 17.0 demobilization sequence runs: reserve armies return to the holding box, units displace from enemy territory, winner gets free redeploy then free naval move, loser follows; a blockaded AU gets a −1 card marker unless it won a major victory.

---

## 2. Austria-Hungary — 33.0 / 33.4 / 33.4.1 (pp. 53–55)

### 33.4 Austrian Characteristics (p. 55, verbatim)

> "• **Metternich's Legacy:** at the end of the diplomacy phase of turn 1 AU gains an alliance with two minor powers of their choice that do not contain an opponent's diplomatic marker.
> • **A Compromise Needed:** During the prep phase of turn 2, add the Dual Monarchy card to the Austrian hand if it was not played for its event on turn 1.
> • **Special Actions:**
>   **Reforms - 3 CP:** grant one eligible nationality their rights [33.4.1].
>   **Expand Citizenship - 3 CP:** Attempt to grant one eligible nationality full citizenship [33.4.1]. Roll one die, a roll ≥ 3 succeeds. Increase the difficulty of the roll by one for each nationality that already has citizenship. Before rolling, you may decrease your stability by 1 to apply a +2 DRM.
> • **Incorporate:** this ability has two effects - as a special 3 CP action AU gains control of a minor power that is (1) allied to AU and (2) has a nationality that has been granted full citizenship. Additionally, AU can launch wars of unification targeting spaces that contain nationalities with full citizenship.
> • **Unstable Situation:** whenever AU decreases stability, roll a die. Add a +1 DRM for each minority nationality with rights. On a roll of a 6 or higher AU passes and there is no further effect. If AU fails, they must either discard a random card or take a minus one card marker (if they cannot discard a card, they must take the minus one card marker). This has no effect during the GW.
> • **Continental Power:** pacification actions cost 2 CP.
> • **Arbiter of Italy:** Until Italy unifies, when AU declares a war of liberation they can target spaces with Italian nationalities that are not currently in rebellion. In other words, AU can liberate Italian minor powers even if their space doesn't contain rebels.
> • **A New Way Forward:** AU receives +1 manpower when 4 nationalities have citizenship, AU must control a space with that nationality in order for it to count towards this bonus. AU gains this manpower during the end phase, this is a one time bonus."

### 33.4.1 Rights and Full Citizenship (p. 55)

> "There are eight nationalities that can be granted rights and full citizenship by the AU player. They are shown by having their flags and names on the AU player's display next to the Event Holding Box. A nationality must be granted rights before it can be granted full citizenship. A nationality retains the benefits of having rights when it has full citizenship. AU may still grant rights and full citizenship to these eight nationalities even if they become a minor power, or if they are a minor power allied to an enemy of AU, or if they are in a home space of another player.
> Granting a nationality rights helps AU with their Unstable Situation trait as more nationalities with rights improves AU's chances to not lose a card when they lose stability. Granting a nationality full citizenship gives two benefits to the AU player. First, AU can use its Incorporate ability to take control of a minor power provided that minor power has full citizenship and is allied to AU. Second, AU can declare wars of unification targeting nationalities that have been granted citizenship. In both of the above cases, this includes a nationality that became a minor power over the course of the game. Additionally, a nationality with full citizenship is no longer considered a minority nationality to the AU player."

> **Cross-reference — 3.2.6 (p. 9):** "Exception: Cards do not affect AU controlled spaces with a minority nationality if that minority nationality has full citizenship (nationalities having full citizenship is an AU special rule [33.4.1])."

> **Cross-reference — 13.2 Unification (p. 29):** "The AU player may declare wars of unification targeting spaces that contain nationalities with full citizenship in the Austrian Empire [33.4.1]. Objectives: the attacker chooses up to two spaces controlled by the defender, those spaces must contain German nationality in a German war of unification or nationalities that have AU citizenship (only AU can do this)."

> **Cross-reference — 13.1.2 Special Liberation Wars (p. 29):** "As an exception to [13.1], the AU and RU players can liberate spaces in Italy and the Balkans (respectively) that are not in rebellion [13.1]. However, … AU can only do so before Italy unifies."

> **Cross-reference — 22.1.2 (p. 43):** "Note that the AU player does not gain this +1 card marker if they win a war of unification using their Incorporate national characteristic [33.4]. This rule only applies to Italian wars of unification [22.1.6]."

**Check in playthrough (AU special rules)**
- [ ] The AU display shows eight nationality slots (Rights Granted / Full Citizenship); rights must be granted before citizenship is attempted; the order is enforced.
- [ ] Reforms = 3 CP special action (no die roll); Expand Citizenship = 3 CP, success on **≥ 3**, **+1 to the required roll per nationality already holding citizenship** (i.e. base 3, then 4, 5, 6 …), optional −1 stability for **+2 DRM** before rolling.
- [ ] Expand Citizenship roll cannot succeed once the target number exceeds 6 (no "auto success" path); the UI must show the DRM-adjusted target.
- [ ] Incorporate (3 CP) is only legal when the minor power is (a) allied to AU **and** (b) has a citizenship nationality; it transfers control (not merely alliance) and enables unification wars over citizenship nationalities.
- [ ] Unstable Situation fires on **every** AU stability decrease (pre-GW only): die + 1 per minority nationality with rights; ≥ 6 = pass; failure = discard a random card, or take a −1 card marker if no card can be discarded. **No effect during the GW.**
- [ ] Continental Power: pacification costs AU **2 CP**, not the base 1 CP (12.11).
- [ ] Arbiter of Italy: before Italian unification, AU's war of liberation may target Italian-nationality spaces **without** requiring rebellion — this is an exception to 13.1's "in rebellion" condition.
- [ ] A New Way Forward: +1 manpower once, in the End Phase, when AU **controls** a space of at least one nationality for 4 nationalities that hold citizenship. It is a one-time bonus, not per turn.
- [ ] Full-citizenship nationalities no longer count as minority nationalities for AU (affects card/event effects per 3.2.6 and the Unstable Situation DRM).
- [ ] Metternich's Legacy (turn 1) and A Compromise Needed (turn 2) are wired to **turn numbers**, not "the first/second turn played"; whether the 1870 scenario rebases these to its first two turns is `[NOT IN RULEBOOK]`.
- [ ] The eight nationalities' **names** appear only on the AU player display, not in the rulebook text: `[NOT IN RULEBOOK]` for the rule text; the app must nevertheless render all eight.

---

## 3. 1870 scenario, turn entry, NG deck and scoring

### 2.4 National Goals (p. 6)

> "Each player has a small deck of eight NG cards. … During the End Phase of every odd turn, except turn 7 (meaning turns 1, 3, and 5), players will shuffle their NG deck, draw three NG cards, keep one card, and return the other two to their NG deck. This is also indicated on the turn track."
> "**Special:** AU has 9 NG cards, but one of them is only used in the 1870 and 1880 scenarios. This is also explained both in the scenario rules and on the ninth NG card."
> "**2.4.2 NG Types:** … Achievement NGs give players a specified amount of VPs (3 or 4) if that player completes the goal on the card. Ranked NGs are marked with an asterisk (*); … The player(s) in first place receives 3 VPs, 2 VPs for second, 1 VP for third, and 0 for any other place. There are no tie breakers, and if two players are tied for a place the next place VP reward is skipped. … **Important:** only the player who selected the ranked NG can actually receive VPs for it."

### 20.11 Draw NGs (p. 41–42)

> "On turns 1, 3, and 5 players shuffle their NG decks, draw three NG cards, keep one, and return the rest to their decks. This is a one time decision, selected cards constitute the main way players earn victory points during the game. At this time, if a player has more than 3 NG cards, they choose one and return it to their NG deck."
> "**Play Note:** Players do not start the campaign game with any NGs (players start with 1 NG in the 1870 and 1880 scenarios). The only times players draw NGs are during the end phase or via the New Administration event. …"

### 2.2.1 The End of Turn 7 / end of scenario (p. 6)

> "**2.2:** The game will end in one of the following ways: 1. At the end of turn 7 (or the end of the scenario) …"
> "**2.2.1:** This is the simplest way for the game to end. If the game reaches the end of turn 7 all players reveal their National Goals (NGs) [2.4] and total their VPs. A player's score can be modified by their current stability, national characteristics (in the case of GE and RU), and penalties from certain events. The player with the highest VP total wins the game. The vast majority of VPs are scored through NGs, although the GE and RU players can score special VPs as described on their player displays. Players can also lose VPs for having low stability."

### 7.0 / 10.1 — where scenario setup comes from

> **7.0 (p. 18):** "The circled numbers on each track indicate where that player's track starts at the beginning of the campaign game. **See the playbook for the starting positions for other scenarios.**"

> **10.1 (p. 22):** "First add new cards to the deck. Many cards do not start in the deck. Instead, these cards are marked with the turn/decade they come into play. Then shuffle the discard pile in with the draw deck."

> **9.1 card anatomy (p. 22 figure caption):** "1870s — Turn entry indicator" (cards carry the decade they enter the deck).

**Check in playthrough**
- [ ] The 1870 game begins at **turn 3 / 1870s**, and the deck is built from base + all cards whose turn-entry decade is 1870s or earlier; later-entry cards are absent until their decade.
- [ ] AU starts the 1870 scenario with **1 NG** already selected (20.11 Play Note), not zero and not three.
- [ ] End-Phase NG draws occur on **turns 3 and 5** if the scenario keeps the "odd turns, except turn 7" rule; the rulebook text itself says "turns 1, 3, and 5" with no scenario exception → whether the 1870 scenario drops the turn-1 draw is `[NOT IN RULEBOOK]` (scenario rules live in the playbook). Verify the *printed/implemented* scenario rule and record which one the engine follows.
- [ ] Each draw is "draw 3, keep 1, return 2" to the AU NG deck; a player above 3 NGs immediately returns one (20.11) — so the NG count must never silently exceed 3 mid-game.
- [ ] AU's NG deck has **9** cards in the 1870 scenario, including the scenario-only ninth card; both are `[NOT IN RULEBOOK]` as to card names/VP values (printed on cards/display).
- [ ] Ranked NG scoring: 3/2/1/0 with skipped places on ties, and only the selecting player can score that NG; achievement NGs score their printed 3 or 4 VPs.
- [ ] End-of-scenario scoring is the 2.2.1 reveal-and-total procedure; the rulebook's only scenario wording is "or the end of the scenario" — the exact scenario end turn/last-turn flag is `[NOT IN RULEBOOK]`.
- [ ] Stability VP penalties apply only **at the moment of scoring** (7.1), not when stability first drops.
- [ ] GE/RU special display VPs exist; AU has no special VP source (only NGs + stability) — do not award AU display VPs.

**`[NOT IN RULEBOOK]` for the 1870 setup, must come from the scenario/playbook, not graded against the rulebook:**
starting positions/tracks (stability, manpower, industry, keys), initial WTT value, initial alliance-box positions for all six powers, units/forts on map, which cards are added/held, bot seats, bot difficulty, and the scenario's exact turn range (turns 3–6 = 1870s–1900s).

---

## 4. Action Phase — 12.0, 12.1, 12.2, 12.7, 12.8, 12.11, 12.17

> **12.0 (p. 23):** "During a player's impulse they either: • Play a card for its CP value to conduct actions • Play a card for the event • Pass (see below). Players can only pass if they only have zero or one card remaining in their hand (exception: the UK can pass with 2 cards) and if their hand does not contain a home card or a mandatory event. There is no 'hard passing,' meaning players can still play their one remaining card on a future impulse."
> "**Important:** each player can hold a card for the next turn. This card, however, cannot be a home card or a mandatory event as those always have to be played."
> "**Ending the action phase:** the action phase ends when either: (1) all players consecutively pass or (2) when all players have no remaining cards."

> **9.1.4 Mandatory event cards (p. 22):** "Mandatory event cards must be played for their events. However, when playing a mandatory event card, players trigger the event and receive the CP to spend on actions. The events on mandatory event cards are always resolved first. If a mandatory event card is discarded, the event immediately triggers. … If two mandatory events are discarded in the same impulse the events are resolved in turn order."
> **9.1.5 Mandatory Response (p. 22):** "There is only one mandatory response card in the game (Impulsive Ruler). It must be played as a response card when its conditions are met. Once its event is resolved, the player who played it does not get any CP to spend (as it would with a mandatory event) but instead draws another card."

> **12.1 (p. 23) — peacetime CP actions:** "Recruitment: 1-4 CP • Naval Movement: 1 CP • Construct Fleet: 1-3 CP • Place Influence or Diplomacy: 1 CP • Remove Influence or Diplomacy: 1 CP • Influence Great Power: 1-4 CP • Minor Power Alliance: 3 CP • Remove Minor Power Alliance: 4 CP • Expeditionary Force: 1-2 CP • Pacification: 1 CP • Construct Fort: 1-2 CP • CP Chain: 1 Card • Industrialize: 1 Card • Redeployment: 1 CP • Land Battle (against rebels): 1 CP • Declare War: 1-4 CP."

> **12.2 Recruitment (p. 23):** "Standing Army - 1 CP per step • Reserve Army - 1 CP per step • Elite Corps - 2 CP … Standing armies are placed directly onto the map in a home territorial key whilst reserve armies are placed into a player's reserve armies holding box … During peacetime, standing armies cannot exceed a player's manpower, and reserve armies cannot exceed a player's manpower or industry, whichever is lower."

> **12.8 / 12.9 (p. 26):** "A player may place an ally marker with a minor power provided they already have a diplomacy marker on that minor power. Each minor power can only be allied with one player. … **Remove Minor Power Alliance: 4 CP.** Flip any one ally marker on a minor power to its diplomacy side."

> **12.11 Pacification (p. 26–27):** "Pacification is required to gain control of uncontrolled spaces. Players must have a land unit in a space to pacify it. … When a pacification action is taken the player rolls two dice and adds the value of the pacification marker in the space; players also receive a +1 DRM if they have at least one naval unit in a naval box adjacent to the space being pacified. If the roll is ≥ 10 the space is successfully pacified, replace the player's influence marker with a control marker. If the attempt fails, increase the space's pacification value by one. Pacification actions can only be taken once per space, per impulse …"

> **12.12 Construct Fort (p. 27):** "The amount of CPs spent (up to a maximum of 2) gives the player that level fort. …"

> **12.17 Declare War (p. 28):** "By far the most comprehensive action in IE, declare war actions represent entire wars through the play of a single card. … A war can be declared for any number of CP. However, the more CP a player spends the more they can do during the war, and higher CP cards give players a better chance of going first during the war."

**Check in playthrough**
- [ ] One card per impulse: the active player either spends a card's CP, resolves a card event, or passes — no multi-card impulses, no free actions without an action type.
- [ ] Pass is offered only with 0–1 cards left in hand (UK exception: 2) and never with a home card or mandatory event in hand; passing is not "hard" (the last card can still be played later).
- [ ] Ending the Action Phase requires **all players consecutively passed** or **all hands empty**.
- [ ] Home cards cannot be held to the next turn; ordinary action cards can (one held card).
- [ ] Mandatory events always resolve their event AND grant their CP; they cannot be played for CP alone, cannot be discarded to sit in hand, and they trigger immediately if discarded (e.g. by Unstable Situation). Two discarded mandatory events resolve in turn order.
- [ ] Impulsive Ruler, when its condition is met, is played as a mandatory response, grants **no CP**, and draws a replacement card.
- [ ] CP totals/action costs match the 12.1 list; AU pacification is 2 CP (33.4 Continental Power); CP Chain max 2 cards / single action ≤ 4 CP (12.14).
- [ ] Recruitment caps enforced: peacetime standing armies ≤ manpower; reserve armies ≤ min(manpower, industry); AU reserve box limit uses 7.3.
- [ ] Minor Power Alliance requires an existing diplomacy marker, one ally per minor power, 3 CP; removal is 4 CP and only flips ally → diplomacy.
- [ ] Pacification: roll 2 dice + marker value (+1 with adjacent naval unit), ≥ 10 succeeds, failure raises the marker, once per space per impulse; AU pays 2 CP.

---

## 5. World Tension Track, war of conquest, and war-declaration lockout

> **3.7 (p. 12):** "This section of the board is used to track the current turn, the current GW turn (which will be on GW turn 0 for much of the game), and the WTT. Use the associated counters to track these." (The WTT's starting value itself is `[NOT IN RULEBOOK]` — board/scenario setup.)

> **4.9.3 The Great War (p. 14):** "Certain events and player actions will increase the WTT. When the WTT reaches 5 a crisis roll [23.0] is made and the GW may occur. The GW is very similar to wartime and follows many of the same rules, but the GW also has many unique rules including its own SoP [24.1]."

> **13.3 Conquest (p. 29):** "Purpose - take control of land that is controlled by a foreign power. **A war of conquest automatically increases the WTT by one. Declaring a war of conquest then decreases the stability of the attacking power by the current level of the WTT.** Objectives: the attacker chooses up to two spaces controlled by the defender, only one of these spaces can be a key."
> **13.3.1:** "Capitals and subcapitals cannot be targeted as objectives in wars of conquest."

> **7.1.1 stability table (p. 18):** "Declaring a war of conquest — **−X\***" with "**\*X equals the current space on the WTT after it is increased as a result of the declaration of war.**"

> **12.17.1 Cannot Declare War (p. 28):** "**Players cannot declare war if the WTT is 3 or higher.** However, this restriction only applies to player home cards and players spending CP to declare war. Events that simulate wars (such as the Balkan Wars event, card # 100) still function as normal. Players can never declare war on the US or the CSA."

> **20.10 Decrease World Tension (p. 41):** "Decrease World Tension by 1." (End Phase step 10.)

**Check in playthrough**
- [ ] A war of conquest raises the WTT by **exactly 1**, then AU's stability drops by the **post-increase** WTT value (e.g. WTT 2→3: AU −3 stability). The two effects are ordered, and the stability table's "−X" matches.
- [ ] The +1 WTT happens even if the declaration would be the last point before 5; the crisis roll is triggered by the WTT *reaching* 5 (see §6).
- [ ] Other WTT sources are card/event text; no invented WTT changes.
- [ ] At WTT ≥ 3, AU cannot declare war via home card or CP (the button must be disabled with a rules reason); event-driven wars (e.g. Balkan Wars card #100) are still allowed.
- [ ] End Phase step 10 reduces WTT by 1 every normal turn; the decrease does not happen if the GW has already replaced the standard SoP.
- [ ] Wars of conquest cannot target capitals/subcapitals; max two spaces, at most one key.
- [ ] Declaring a war of conquest is itself an AU stability decrease → **Unstable Situation roll must fire** (pre-GW).
- [ ] War declarations against non-player powers follow 13.4 (ally-of-player = war on that player; no attacks on allied/diplomacy-marked non-player powers) — verify on the AU UI.

---

## 6. Crisis roll and Great War onset — 23.0–23.5, 24.1, 25.0–25.7

### 23.0 The Crisis Table (p. 44)

> "The Crisis Table is on the back of the playbook. When the WTT reaches 5, the active player rolls on the Crisis Table to check if the GW occurs. **All Crisis Table results except 'International Conference' cause the outbreak of the GW.** If the GW occurs play proceeds to the Outbreak Step of the GW SoP [25.0]. Most Crisis Table results are purely narrative and do not affect the game state in anyway. However, special Crisis Table results [23.3] will cause additional powers to join the GW."

### 23.1 Crisis Roll Sequencing (p. 44)

> "When the play of an event causes the WTT to increase to 5, a roll is made on the Crisis table. This event is called the inciting event. The text of the inciting event must be followed carefully. **Everything that is stated on the event before increasing the WTT to 5, still occurs. Then the crisis roll is made. If GW breaks out the rest of the text on the event is ignored. If it doesn't break out, the rest of the text is followed.**"

### 23.2/23.3/23.4/23.5 (p. 44–45)

> "**23.2:** Before rolling, consult the incident column of the table. … After consulting the incident column, the active player rolls on the row matching the inciting event. Some events require two rolls. … If any of these results occurs, play simply proceeds to the Outbreak Step of the GW [25.0]."
> "**23.3:** Special Crisis Table Results are results that draw non-player powers into the GW. They are marked with a double asterisk. These results are significant because they draw minor powers into the GW when it starts (otherwise no minor powers enter the war when it starts regardless of who is their current ally). When a 'bordering nation' result is rolled the active player selects a power that borders the targeted player. … The active player cannot choose a bordering power that is allied to the targeted power, and a unified Italy can only be chosen if there are no other options … If a minor power was selected, any player in the alliance opposing the targeted power places an ally marker in the minor power's space if one was not already present …"
> "**23.4:** Some Crisis table results will be 'impossible.' … If any 'impossible' result like this occurs a member of the opposing alliance is blamed and the GW still occurs. Such results are purely narrative and do not affect the game state."
> "**23.5:** Under certain circumstances neutral players will be forced to enter an alliance as a result of a crisis roll. … At the end of the crisis roll procedure shift the associated neutral player into their alliance. If only one neutral player is drawn into the GW, the player freely chooses which alliance they shift into. They cannot, however, choose an alliance that has more players than the opposing alliance, they also cannot choose an alliance that already contains three players. If multiple neutral players are drawn into the GW at this time, randomly determine which players go into which alliances."

> **The Crisis Table's actual result faces are `[NOT IN RULEBOOK]`** — the rulebook states "The Crisis Table is on the back of the playbook," so row/result content (including which rows are "International Conference" or "**") cannot be validated against `IE_rule.pdf`; only the *procedure* can.

### 24.0 / 24.1 GW Sequence of Play (p. 46)

> "**24.0 The Great War.** **24.1 GW Sequence of Play:** Once the GW occurs the game switches from the standard SoP to the GW SoP. Below is a simplified GW SoP:
> - **Outbreak Step:** (1) Discard all cards, (2) form alliances, (3) place US in neutral box, (4) reveal and score NGs, (5) national will step, (6) set the GW turn order
> 1. **Planning Step:** (1) draw GW card, (2) flip facedown GW combat cards, (3) set war budget (industry + colonial war bonus CP), (4) give 1 CP to an ally
> 2. **Maneuver Step:** in GW turn order, players conduct up to 1 CP worth of actions
> 3. **Winter Step:** (1) check for Blockade (US blockade?), (2) the Colonial War, (3) Neutrals may join or give 1 CP to another player, (4) go back to Planning Step"

### 25.0–25.7 Outbreak Step (p. 46–47)

> "**25.0:** This step is only done once at the beginning of the GW, it is never repeated."
> "**25.1 Discard Remaining Action Cards:** First, all players discard their remaining action cards, including their home card, they will not be used during the GW."
> "**25.2 Alliances and the US:** Players then determine the opposing alliances. All players in an alliance automatically join the GW with their fellow alliance members regardless of whether they are aligned or committed. Neutral players will not immediately join the GW, but they may join later. Place the US alliance chit in the neutral box of the Alliance Track. Exception: do not place the US alliance chit if the CSA won the American Civil War. …"
> "**25.2.1 Minor Power Allies in the Outbreak Step:** Minor power allies will not join the GW at this time. They will only join the GW via certain special crisis table results or the Minor Power Entry GW card."
> "**25.3 Italy in the GW:** If Italy is in the neutral box it does not join the GW during the Outbreak Step. If Italy is in an aligned alliance box a die is rolled to see if Italy joins the war during the Outbreak Step. On a roll of 4 or higher Italy joins the GW … if Italy is in a committed alliance box, it automatically joins …"
> "**25.4 Entering the GW at 0 stability:** If a player enters the GW at 0 stability that player immediately gains 1 stability."
> "**25.5 Score NGs:** All players reveal and score their NGs. Their score can be modified by their current stability, negative VP markers, national characteristics (in the case of GE and RU). **If the GW occurs early, it is possible for players to have less than 3 NGs. If this happens, all players with less than 3 NGs draw 3 NGs and choose one to keep. They repeat this process until they have 3 NGs to score.**"
> "**25.6 National Will Step:** … 0-2 VPs - no bonus; 3-4 VPs - 1 EC; 5-6 VPs - 1 EC and 1 display track boost; 7-8 VPs - 1 EC and 2 display track boosts; 9-10+ VPs - 1 EC and 3 display track boosts. … Each 'display track boost' increases that player's stability, manpower, or industry by one; players can boost any track but cannot boost the same track twice. … Each time a player boosts a track that is already maxed out they immediately place a bonus reserve army in their reserve armies holding box. **Important:** These bonus reserve armies can exceed players' reserve armies holding box limit."
> "**25.6.2 Remove Pacification markers:** At the end of the National Will Step players remove all pacification markers from the board."
> "**25.7 Set GW Turn Order:** A new turn order is set for the GW with the alliances alternating impulses. Each alliance sets their turn order for the entirety of the GW, the alliance with the GE player always goes first (although GE does not have to get the first impulse). … **If the GE player is neutral the alliance with the UK always goes first, then the alliance with FR, then AU, and then RU.** Neutral powers go after all those participating in the GW [27.4]."
> "**25.7.1 GW Bonus Impulses:** If one alliance has fewer players, that alliance gets a bonus impulse(s). Any alliance member can act during a bonus impulse, but only one player is allowed to act. Additionally, during a bonus impulse players are always allowed to pass without spending any CP in their CP war budget."

### 2.2.2 / 2.2.3 / 2.3 GW victory (p. 6)

> "**2.2.2 An Alliance Wins the GW:** The alliance that wins the GW does not automatically win the game. First, check if there are any neutral players. If there are no neutral players, then the alliance that won the GW wins the game as a team regardless of their individual VP totals. Exception: if a player was eliminated during the GW [30.0], they automatically lose the game even if their alliance wins the GW. If there is a neutral player (or players) at the end of the GW, the team that wins the GW scores bonus VPs equal to 4 minus the current GW turn … Compare the highest VP total of a single player in the victorious alliance to the highest VP total of a single player amongst neutral players. …"
> "**2.2.3 The End of GW Turn 5:** The game will automatically end after GW turn 5 has been completed, if neither alliance has won, regardless of the current board state. If this occurs … • The neutral player with the highest VP total wins • If there are no neutral players, the player with the highest stability wins"
> "**2.3 VP Ties:** There are no tie breakers, if there is a tie for first those players win together."

**Check in playthrough (GW onset)**
- [ ] The crisis roll fires **exactly when the WTT reaches 5** (not at 4, not at 6+), with the acting player as roller.
- [ ] Inciting-event ordering: text before the WTT increase resolves, then the crisis roll; if GW breaks out, the **remainder of the event text is skipped**; if not, the remainder resolves.
- [ ] "International Conference" is the **only** non-outbreak result; every other result → Outbreak Step. (The individual result names/rows are `[NOT IN RULEBOOK]`; validate only the binary outcome and the special-result handling.)
- [ ] Special (double-asterisk) results can pull minor powers into the war at start; bordering-nation choice cannot pick an ally of the target; Italy only as last resort and never if allied to the target; impossible results still cause the GW with an "opposing alliance blamed" narrative.
- [ ] Neutral players drawn into the GW via 23.5 shift at the end of the crisis procedure, subject to the "≤ opposing alliance size" and "not 3 players already" constraints; multiple neutrals are randomly split.
- [ ] The moment the GW occurs the standard SoP is abandoned and the GW SoP begins with the **Outbreak Step** (25.0), performed once.
- [ ] Outbreak Step order: discard all cards incl. home card → form alliances (alliance members auto-join) → place US chit in neutral box (unless CSA exception) → reveal and score NGs → National Will → set GW turn order.
- [ ] Minor power allies do **not** join at outbreak (only via special crisis results or Minor Power Entry GW card).
- [ ] Italy: neutral box = stays out; aligned box = join on 4+; committed = auto-join; not unified = rule doesn't apply.
- [ ] AU entering the GW at 0 stability immediately gains 1 stability.
- [ ] 25.5 NG score happens at outbreak; a scenario starting with 1 NG (1870) must be topped up to 3 by repeating "draw 3, keep 1" for every player with fewer than 3 NGs. The bot interaction with 34.1 is an open question (see §1).
- [ ] National Will: VP band → EC / display-track boosts (no track boosted twice) / bonus reserve army if a boost is wasted on a maxed track; bonus reserve armies may exceed the AU reserve-box limit; pacification markers removed at the end of this step.
- [ ] GW turn order: alternating impulses; Triple Alliance (GE's alliance) always goes first; if GE is neutral the order is UK alliance → FR → AU → RU; neutrals after all belligerents; bonus impulse when one alliance has fewer players, and passing on a bonus impulse costs no CP.
- [ ] If the QA run stops "when the GW breaks out," verify whether the game stops at outbreak or plays GW turn 0; the rulebook treats outbreak as the start of the GW SoP and explicitly says there is a **GW turn 0** (2.2 / 28.1). Record which the app does.

---

## 7. GW Planning Step — 26.0–26.3

> "**26.0 (p. 47):** The standard action card deck and player home cards are not used during the GW, instead players use the GW deck. At the start of the planning step reshuffle the GW discard pile into the GW card deck, then deal all players, including neutral players, one GW card. GW cards function differently than standard action cards, and all players have a GW hand limit of 1. Players are allowed to hold their GW card until the next GW turn, but if they choose to do so they will not draw a new GW card next turn."
> "**26.1 Flip Facedown GW Combat Cards (p. 47–48):** … Once GW combat cards have been played for their event, they will never be discarded or added back into the GW deck. … During the planning step of each GW turn, GW combat cards in front of players are flipped faceup (if not already faceup) and may be used by the player who has them during the turn."
> "**26.2 Set CP budget (p. 48):** All players set their CP budget equal to their industry level. Exception: during the GW, all players have a minimum CP budget of 2. Italy has a 2 CP war budget and the US has a 4 CP war budget. All belligerent players, and the US if it's in the war, can also transfer 1 CP to an ally, but they must be able to trace a LoC to that power [5.6]."
> "**26.3 Non-Player Powers in the GW (p. 48):** Should they join the war, the US and a unified Italy always go after all player powers in the following order: US and then Italy. … Players may not conduct actions with US or Italian units with CP from their personal war budget, however, these units may still participate in a player-launched land battle."

**Check in playthrough**
- [ ] GW deck replaces the normal deck and home cards; every player **including neutrals** is dealt exactly 1 GW card; hand limit is 1.
- [ ] A held GW card means no new draw next turn (player chooses draw vs. hold).
- [ ] GW combat cards behave as described (never discarded/recycled; flip faceup in Planning; may be passed to an alliance member) — if the GW breaks out during the run, verify the first GW Planning flip.
- [ ] CP war budget = industry, **minimum 2**; Italy 2 CP / US 4 CP; one CP may be transferred to an ally only with a LoC.
- [ ] US/Italy act after all player powers (US then Italy) and cannot be commanded with a player's own war-budget CP.

---

## 8. GW Maneuver / combat / Winter Step — 27.0–29.3

> "**27.0:** During this step players move armies and fight battles. Most of the GW rules are similar to the wartime rules, however, there are some very important differences."
> "**27.1 GW Impulses:** In their impulse, players can: • Spend up to 1 CP from their CP war budget to conduct an action, and they have the option of playing their GW card in addition to their action … or • They may pass. **Important:** players can only pass if their CP war budget is ≤ 2 and they do not have the GW mandatory event card in their hand."
> "**27.2 GW Cards:** In addition to their action, players can play their GW cards in one of two ways: • For a bonus action that must be conducted immediately. • For the card's event, which will occur after the player conducts their action. … When using their GW card for a bonus action, players are not allowed to (1) conduct the same action twice or (2) conduct a land battle action during their impulse. Exception: the free GE 'deploy reserves' action [33.1] does not count …"
> "**27.3 GW Mandatory Events:** There is only 1 mandatory event in the GW deck: Exhaustion. … players cannot pass with the Exhaustion card in their hand. However, players are not obligated to immediately play Exhaustion; but they must do so at some point during the turn, and it must be played in addition to their GW action."
> "**27.4 Neutral Player GW Impulses:** After all belligerent powers have gone, Neutral players, in normal turn order, may play their GW card for its event."
> "**27.5 GW Actions:** Deploy Reserves [15.2.3] • Land Battle [15.2.6] • Rail Move [15.2.5] • March [15.2.4] • Naval Movement [15.2.1] • Joint Naval Operations [15.2.2] • Refit Fleet* [27.5.4] • Refit* [27.5.1] • Draft* [27.5.2] • Elite Corps* [27.5.3]. Actions marked with an asterisk(*) can only be taken during the GW …"
> "**27.5.2 Draft: 1 CP and 1 Manpower.** Gain 2 reduced armies. This is the only way to build new armies during the GW. …"
> "**27.6 Manpower in the GW:** Manpower is a finite resource during the GW. When a player's manpower reaches zero it becomes exhausted. A player with exhausted manpower cannot build any new armies and receives a permanent -1 modifier for both land and naval battles for the rest of the GW."
> "**27.7 Ending a GW turn:** A GW maneuver step ends when all players consecutively pass or when all players' CP war budgets reach 0."
> "**28.1 Trenches:** At the start of GW turn 1 all keys automatically contain trenches (Play Note: remember that there is a GW turn 0). Players are only allowed to attack a trench if they have a full strength army in their main attack force. Additionally, regardless of the outcome of the battle, the attacker will suffer an additional step loss for attacking a trench space."
> "**29.0 Winter Step.** **29.1 Blockade:** A player is blockaded if they cannot trace a LOC from their capital to any naval box except the Baltic Sea or Black Sea. … At the end of each year of the GW (not GW turn 0), decrease the maximum industry level of every blockaded player by one. This cannot reduce a player's industry level below three. …"
> "**29.2 The Colonial War:** The war in Africa and Asia is abstracted to two die rolls at the end of a GW turn. … Both alliances make an opposed die roll with the following modifiers: +1 per EF on the continent* • +1 per elite unit on the continent (elite colonial EFs provide a total of +2)* • +1 per army on the continent* • +2 for naval supremacy …"
> "**29.3 Neutral player powers in the GW:** At this point neutral players may shift their alliance chit into an alliance space. … Players cannot shift into an alliance that has 3 players or into an alliance that contains more players than the opposing alliance. Once a player shifts into an alliance they immediately join that alliance and are no longer considered neutral. If a neutral player joins an alliance they may immediately conduct a free redeployment action, a free deploy reserves action, and they are placed in the next available spot in the GW turn order. … If a neutral player chooses to not join an alliance they may take a free redeployment action. Neutral players may then give a bonus CP to a belligerent power if they can trace a LOC to that power's capital."

**Check in playthrough**
- [ ] GW impulse = up to **1 CP** of actions from the war budget, optionally plus the GW card; pass only when budget ≤ 2 and no Exhaustion in hand.
- [ ] GW card bonus action cannot duplicate the same action or be a land battle in the same impulse (GE free deploy-reserves exception only).
- [ ] Exhaustion (the single GW mandatory event) must be played during the turn, in addition to the GW action; it cannot be passed with.
- [ ] Neutral players act **after** all belligerents, in normal turn order, and may play their GW card for its event only.
- [ ] Only GW-listed actions exist; Draft is the only way to build armies and costs 1 CP + 1 manpower; Refit/Refit Fleet/Draft/Elite Corps are GW-only.
- [ ] Exhausted manpower (0) blocks new armies and gives a permanent −1 land/naval battle modifier.
- [ ] A GW maneuver step ends on all-consecutive-pass **or** all budgets at 0.
- [ ] Trenches: all keys get trenches at the start of **GW turn 1**; trench attack requires a full-strength army in the main force; attacker takes an extra step loss regardless of result.
- [ ] Winter Step runs after each GW maneuver: blockade check (industry cap −1 per year, floor 3, not on GW turn 0), Colonial War rolls with the listed modifiers and territorial/stability effects (29.2.1), then neutral joining/gifting, then back to Planning.
- [ ] Colonial War: naval supremacy definitions, attacker/defender unit elimination and space seizure at the stated margins (+1 / +4), "control a colonial continent → opponent's roll treated as 0", and the UK/RU stability penalties.
- [ ] Neutral joining in the Winter Step: alliance-size constraints, free redeploy/deploy reserves on joining, next available GW turn order slot, bonus-impulse marker handling; non-joining neutral free redeploy + 1 CP gift requiring a LoC.

---

## 9. GW stability, elimination, ending, victory — 30.0, 30.1, 31.0, 32.x

> "**30.0 Stability and Elimination in the GW (p. 52):** Players and Italy adjust their stability during the GW in the following ways:
> • Losing a controlled territorial key on the main map or losing a home key on the Asia or Africa submaps: -1 stability
> • Recapturing one of the above keys: +1 stability
> • Suffering a defeat in a decisive battle in a battle*: -1 stability
> • Losing a dreadnought in battle: -1 stability
> • Certain Colonial War Results for the UK and RU: -1 stability
> \*Decisive battles only cause a stability loss if the defeated force contained at least 2 armies (including supporting armies) or 2 naval units. The lead defender/attacker suffers the stability loss."
> "**30.1 GW Surrender and Elimination (p. 52):** When a player surrenders they are eliminated from the game. A player immediately surrenders when their stability reaches 0 or if their capital is occupied. **Exception: AU, RU, and OT players have a capital and a subcapital, both must be occupied to force them to surrender.** … Lastly, replace the eliminated player's space on the wartime initiative track with a bonus impulse for their alliance. Exception: only one alliance can have a bonus impulse …"
> "**30.2 (p. 52):** Minor Powers do not surrender during the GW. … The US and a unified Italy: their stability starts at 3, and they surrender when their stability reaches 0. Italy also surrenders if Rome is taken. …"
> "**31.0 Ending the GW (p. 52):** The GW ends immediately when an alliance is defeated. An alliance is defeated when one of the following occurs: • All powers in an alliance are eliminated • There is only one power remaining in an alliance and there are no neutral players. If neither alliance has won the GW it automatically ends at the end of GW turn 5. …"
> "**32.3 Attacking Neutral Players (p. 53):** Players cannot attack neutral players."
> "**32.4 Attacking Neutral non-player Powers (p. 53):** Players can declare war on non-player powers at any point during their impulse. When this happens a player from the opposing alliance immediately places an alliance marker in the minor power's space. …"

**Check in playthrough**
- [ ] AU elimination requires **both** capital and subcapital occupied (or stability 0) — occupying only one must not eliminate AU.
- [ ] Stability changes exactly per the 30.0 list; decisive-battle loss only applies with ≥2 armies (including supports) or ≥2 naval units in the defeated force, and only the lead defender/attacker loses the point.
- [ ] Losing a **controlled territorial** key on the main map is −1, but losing a non-key space is not; losing a home key on the Asia/Africa submaps is −1; recapture is +1.
- [ ] Neutral players cannot be attacked (32.3); attacks on neutral non-player powers use 32.4's alliance-marker placement.
- [ ] GW end conditions and the automatic end after GW turn 5 are implemented; victory resolution follows 2.2.2/2.2.3 (neutral players can win; GW team win with no neutrals; eliminated players lose even on the winning side).
- [ ] Elimination consequences: units/ally markers/initiative marker removed, minor power allies reassigned to an alliance member, bonus impulse injection respects the "one bonus impulse per alliance" cap.
- [ ] Score/tie handling: no tiebreakers (2.3); multiple winners allowed.

---

## 10. End Phase step order and details — 20.0–20.12 (pp. 41–42)

The End Phase runs in this exact order (quoted from 2.1; each step's full text is on pp. 41–42):

1. **20.1 Militarism:** "Players gain one of the following benefits: gain one army step (either reserve or standing) or prevent a fort from degrading in the next step. Players cannot prevent level 3 forts from degrading. Treat the 'gain 1 army step' like a 1 CP recruitment action [12.2], applying all relevant rules."
2. **20.2 Degrade forts:** "Players degrade all forts on the map by one level, this also removes level one forts."
3. **20.3 Non-Player Power Build Step:** unified Italy rebuilds/redeploys; independent minor powers in the build box gain one army step (Poland exception 22.5); "This step increase cannot give a minor power more than 1 army."
4. **20.4 Naval Units Go to Port:** "All naval units (and land units at sea) return to the nearest friendly port space. … If a power does not control a port their naval units are eliminated."
5. **20.5 Set manpower:** "Players set their manpower based on how many keys they control [7.2]. Armies in excess of a player's new manpower limit are eliminated."
6. **20.6 Industrialization:** "All players that played a card into industrialization, roll one die adding the CP value of the card they played into industrialization. If their roll is ≥5 (≥6 for RU and OT) they successfully industrialize. … If a player fails to industrialize they then flip their industrialization chit to its auto industrialization side …"
7. **20.7 Progress truces:** "Players return one turn truces to their respective players and then flip 2 turn truces to their one turn side."
8. **20.8 Progress WoIs:** "At this point players progress all WoIs on the map by one step. … If a space contains a WoI marker that began this phase on its +1 side that space gains independence. … the player who lost the space decreases their stability by 1. … All 0 WoI markers are flipped to their +1 side."
9. **20.9 Conduct an Alliance Resolution Step [8.6].**
10. **20.10 Decrease World Tension:** "Decrease World Tension by 1."
11. **20.11 Draw NGs:** "On turns 1, 3, and 5 players shuffle their NG decks, draw three NG cards, keep one, and return the rest to their decks. … At this time, if a player has more than 3 NG cards, they choose one and return it to their NG deck."
12. **20.12 Advance Turn:** "Advance the turn marker or, if turn 7, end the game."

**Check in playthrough**
- [ ] Steps run 1→12 in this order (a common bug is doing NG draws before/after WTT or skipping the alliance resolution).
- [ ] 20.1 militarism: exactly one benefit, army step or fort protection; level-3 forts cannot be protected; the army step obeys recruitment placement/limits.
- [ ] Bots choose "gain 1 army step" in 20.1, not fort protection (34.2).
- [ ] Manpower reset (20.5) can eliminate excess AU armies — verify the "keys → manpower" recalculation happens before the excess-army removal.
- [ ] Industrialization rolls use the card's **CP value**; RU/OT threshold is 6; AU threshold is 5.
- [ ] WoI progression/independence (20.8) applies the losing player's −1 stability and displaces units.
- [ ] Alliance Resolution (20.9) is executed with the MPIT rules of 8.6 (influence totals, highest-total-first order, ties by turn order, one shift per player plus 8.6.1 double shift at ≥10 differential).
- [ ] WTT decreases by 1 (20.10) — but not if the GW has replaced the SoP.
- [ ] NG draw (20.11) occurs in the End Phase only on turns 1/3/5 (subject to the 1870 scenario open question in §3), draw-3-keep-1, trim to 3.
- [ ] Turn marker advances and the scenario's last turn (turn 6 for 1870) triggers end-of-scenario scoring rather than continuing to turn 7.

---

## 11. Alliance system basics relevant to AU (8.1–8.6)

> "**8.1.1 (p. 19):** All players start in the Neutral Box at the beginning of the game. Players in the neutral box: • Cannot be invited to join wars during the alliance step of a war. … • Can declare war on any other player. • Will remain neutral at the start of the GW (if it occurs)."
> "**8.1.2 (p. 19):** Players in an alliance box: • Cannot declare war on members of their alliance. • Cannot declare war on a minor power allied to or having an diplomacy marker on it which belongs to a member of their alliance. • May join wars involving their alliance members, but are not required to do so. … • Will automatically join the GW with their alliance if it occurs."
> "**8.2 (p. 19):** A declaration of war causes the defending power to shift away from the attacker one space on the Alliance Track. …"
> "**8.4 (p. 19):** Only three player powers can ever be in an alliance. Exception: when a defender is forced to shift after a declaration of war, the defender can shift into an alliance that already has three players."
> "**8.6 (p. 20):** During the alliance resolution step, each player totals the amount of influence their power has accumulated on the MPIT … Alliance resolutions are then carried out for each power, starting with the power with the highest total and working downwards. Ties are broken by turn order. … If a power only has one type of influence ≥1, it automatically is shifted in that direction … If it has 2 or 3 types of influence ≥1, a die is rolled for each marker. … Shift the power's alliance marker in the direction of the highest result …"
> "**8.6.1 (p. 20):** During the alliance resolution step, if the differential between a player's highest and second highest alliance rolls (don't forget to add influence) is ≥ 10, that alliance is shifted twice if possible."

**Check in playthrough**
- [ ] Baseline campaign start is "all players neutral"; the 1870 scenario's actual starting alliance boxes are `[NOT IN RULEBOOK]` (playbook setup) — do not flag a non-neutral AU start as a rulebook violation if the scenario sets it.
- [ ] Alliance membership blocks declaring war on allies and their allied/diplomacy-marked minor powers.
- [ ] War declaration shifts the **defender** one space away from the attacker (not the attacker).
- [ ] Max 3 players per alliance, with the forced-defender-shift exception; Italy is not a player power and is exempt.
- [ ] Alliance resolution: highest total influence first, ties by turn order, single-influence auto-shift, multi-influence die per marker + DRM, highest result wins (player chooses on tie), 3-player cap respected, double shift at ≥10 differential.
- [ ] MPIT markers reset correctly after resolution: current-position marker to 1, the other two to 0.

---

## 12. `[NOT IN RULEBOOK]` register (do not grade these against `IE_rule.pdf`)

| Item | Why / where it actually lives |
|---|---|
| 1870 scenario setup: starting tracks (stability/manpower/industry/keys), units, forts, alliances, initial WTT | 7.0 (p. 18) explicitly says "See the playbook for the starting positions for other scenarios." |
| Scenario turn range/labels (turn 3 = 1870s … turn 6 = 1900s) and end-of-scenario definition | Rulebook only says "end of turn 7 (or the end of the scenario)" and shows "1870s" on the card turn-entry indicator; no scenario turn map in the rules text. |
| Whether the 1870 scenario keeps the turn-1 NG draw or only draws on turns 3 & 5 | 2.4/20.11 say "turns 1, 3, and 5"; the scenario modification is referenced but not stated in the rulebook. |
| Starting NG = 1 in the 1870 scenario | **IS** in the rulebook: 20.11 Play Note (p. 42) — this one *is* gradeable. |
| AU's 9-card NG deck contents/VP values and the scenario-only ninth card text | 2.4 says the deck exists and the ninth card is scenario-only; actual cards are on the cards/display. |
| The eight AU nationalities' names | 33.4.1 says they are "shown … on the AU player's display"; not enumerated in rule text. |
| The Crisis Table's actual rows/results ("International Conference", ** special results, Balkan tables) | 23.0 (p. 44): "The Crisis Table is on the back of the playbook." Only the procedure is in the rulebook. |
| Bot PAC priority lists / BMPIT / BDIT details | 34.2/34.3 defer to the Bot PAC; the rulebook only describes phase behavior. |
| Whether 25.5 ("draw until 3 NGs") applies to bots | 34.1 says bots draw all NGs at GW start; interaction not stated. |
| WTT starting value | Not stated in rules text (board/scenario setup). |
| AU capital / subcapital space names | 30.1 states AU has both; names are on the map/display. |

---

## 13. QA evidence log (fill during the playthrough)

| # | Rule (page) | Expected behavior | Observed (turn/step) | Verdict |
|---|---|---|---|---|
| 1 | 34.1 (p. 56) | Bot NG counts 3/4/5; bots draw at GW start, not during 20.11 | | |
| 2 | 34.2 (p. 56) | Bots never pass; top pile card; home card position by power | | |
| 3 | 34.3.2 (p. 57) | Bot auto-pacifies unless 5–6 rolled | | |
| 4 | 33.4 (p. 55) | Reforms 3 CP / Expand Citizenship ≥3 +1 per citizen, optional −1 stab for +2 DRM | | |
| 5 | 33.4 (p. 55) | Unstable Situation roll on every AU stability loss, +1 per rights nationality, no effect in GW | | |
| 6 | 33.4 (p. 55) | Continental Power: AU pacification 2 CP | | |
| 7 | 33.4.1 (p. 55) | Rights before citizenship; 8 nationalities; citizenship removes minority status | | |
| 8 | 2.4 / 20.11 (p. 6, 41–42) | AU starts 1870 with 1 NG; draw 3 keep 1 on turns 3/5 | | |
| 9 | 2.2.1 (p. 6) | End-of-scenario VP scoring (NG + stability) | | |
| 10 | 12.0 (p. 23) | Pass legality / one card per impulse / end conditions | | |
| 11 | 9.1.4 (p. 22) | Mandatory events: event + CP, no holding, immediate on discard | | |
| 12 | 13.3 (p. 29) | Conquest: WTT +1 then stability −WTT | | |
| 13 | 12.17.1 (p. 28) | No war declarations at WTT ≥ 3 (CP/home card only) | | |
| 14 | 20.10 (p. 41) | WTT −1 in End Phase step 10 | | |
| 15 | 23.0/23.1 (p. 44) | Crisis roll exactly at WTT 5; inciting-event ordering; all results but International Conference → GW | | |
| 16 | 25.1–25.7 (p. 46–47) | Outbreak Step order; minor powers don't join; 0-stability +1; NG score top-up; National Will; GW turn order | | |
| 17 | 26.0–26.3 (p. 47–48) | GW deck/hand limit 1; budget = industry min 2; US/Italy after players | | |
| 18 | 27.1–27.7 (p. 48–49) | GW impulses/pass; Exhaustion; neutral impulses last; Draft-only builds; exhausted manpower | | |
| 19 | 28.1 / 29.x (p. 49–52) | Trenches from GW turn 1; Winter Step blockade/colonial war/neutral join | | |
| 20 | 30.1 / 31.0 (p. 52) | AU needs capital **and** subcapital occupied; GW end/victory | | |
| 21 | 20.1 / 20.5 (p. 41) | Militarism choice; manpower reset and excess army removal | | |
| 22 | 8.6 (p. 19–20) | Alliance resolution order/influence/3-player cap | | |

**Overall verdict:** ☐ pass ☐ pass with open questions ☐ fail — attach the completed log and note any `[NOT IN RULEBOOK]` item that could not be checked without the playbook.
