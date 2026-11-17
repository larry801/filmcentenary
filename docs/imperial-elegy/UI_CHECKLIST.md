# Imperial Elegy — manual acceptance checklist for the redesigned board

This is a **hand checklist**, not an automated test. It describes what a person
should see on the redesigned Imperial Elegy board and how to check it without
reading the source. Every step names the control it looks at: where a step says
`data-testid="…"`, that attribute is on the element (DevTools → Inspect, or a
`document.querySelector('[data-testid="ie-pass"]')` in the console).

Scope: the local board at `/localIE` (hotseat and bot seats), the spectator
view, the phone layout and the two UI languages. It does **not** re-test the
rules engine — see [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) and
[`RULES_COVERAGE.md`](RULES_COVERAGE.md) for that.

Legend: a step ending in **(verify)** could not be confirmed from the source at
the time of writing and has to be checked by hand; the question to answer is
written next to it.

---

## 1. Setup

- [ ] `yarn install && yarn start` completes and Vite prints a local URL on port 5173.
- [ ] Open `http://localhost:5173/localIE` in Chrome (or any Chromium browser) with the window at **1440×900** (DevTools → device toolbar → Responsive → 1440 × 900).
- [ ] The heading reads `帝国挽歌 — 本地热座` (`Imperial Elegy — local hotseat` in English); the board is live at once — plain `/localIE` does *not* open a seat-setup screen.
- [ ] The seat strip `data-testid="ie-seat-strip"` shows six tabs, `data-testid="ie-seat-status-GE"` … `ie-seat-status-OT`, in the printed order GE · UK · FR · AU · RU · OT (P1–P6).
- [ ] Press `2` (or `]`): the focus moves to the UK board without reloading the page or restarting the match. `1`–`6` and `[` / `]` switch seats.
- [ ] Optional, for the bot section: `http://localhost:5173/localIE?solo=1` opens the seat-setup screen first (`data-testid="ie-local-bot-seats"`), with a **Start match** / `开始对局` button `data-testid="ie-start-match"`.
- [ ] Optional, for the online bot section: open `/imperialElegy`, choose **人类玩家 / Human players** (`#outlined-ie-humans`) between 2 and 6, and check the seat preview `data-testid="ie-lobby-seats"`: the tail seats (`ie-lobby-seat-FR` … `ie-lobby-seat-OT` for a 2-human table) show 🤖 and the summary reads `2 名人类 + 4 名机器人（规则 34）`. Creating the match posts `numPlayers: 6` with `setupData.bots`.

---

## 2. One screen

- [ ] **No page scroll.** At 1440×900 the document does not scroll vertically: `document.documentElement.scrollHeight` equals the viewport height, and the wheel over the page body does not move it. Only the hand tray's card row and the turn panel bodies scroll, and they scroll sideways/inside themselves. The card row is the class `.ie-tray-scroll` on a plain `<div>` — it has **no** test id, so select it with `document.querySelector('.ie-tray-scroll')`.
- [ ] **One CP readout is visible.** The board renders **two** nodes with `data-testid="ie-command-cp"`: the turn panel head, and the track strip's phone chip `.ie-track-cp`. Exactly **one** of them is on screen at 1440×900 — the strip chip is `display: none` from 768 px up, and the panel head is hidden below 768 px. Check it with
  `[...document.querySelectorAll('[data-testid="ie-command-cp"]')].filter((el) => el.checkVisibility({checkVisibilityCSS: true, checkOpacity: true})).length` → `1`,
  and `getComputedStyle(document.querySelector('.ie-track-cp')).display` → `none`. The visible readout is the panel head's, `CP left  <n>` / `剩余 CP <n>`.
- [ ] **Hand row ≤ 230 px.** Without a pending decision, the hand tray `data-testid="ie-hand-tray"` is at most **212 px** tall (CSS `max-height: 212px` on `.ie-table .ie-hand-tray`); when collapsed (`data-open="false"`) it is a 44 px bar. Measure it: `document.querySelector('[data-testid="ie-hand-tray"]').getBoundingClientRect().height` ≤ 212.
- [ ] **Turn panel tabs.** The tab strip is `div.ie-turn-tabs` with `role="tablist"` — a class and a role, but **no** `data-testid="ie-turn-tabs"`, so address it as `[role="tablist"]` inside `ie-dock` or by the class. Its buttons `data-testid="ie-turn-tab-action|war|log"` show `指令` / `Orders`, `记录` / `Log` — and `战局` / `War` only while a war or the Great War is running. Each button is `role="tab"`; the selected tab has `aria-selected="true"`.
- [ ] The Orders tab label becomes `决策` / `Decision` while a pending decision or battle is open.
- [ ] **Reference `?`.** The round `?` button in the strip is `data-testid="ie-open-reference"`; it opens the right-hand drawer `data-testid="ie-reference-drawer"` (`data-open="true"`, `hidden` removed) on the current step — the drawer's `data-testid="ie-ref-sequence"` has that step highlighted. `Esc` or `data-testid="ie-reference-close"` closes it.
- [ ] A step in the strip's stepper (`data-testid="ie-stepper"`, buttons `ie-step-prep`, `ie-step-diplomacy`, `ie-step-action`, `ie-step-end`) opens the drawer at that step's reference too.
- [ ] The drawer's sections are present: `ie-ref-crt` (CRT), `ie-ref-costs` (action costs), `ie-ref-sequence`, the power dashboards (`ie-power-GE` …), `ie-ref-charts`, `ie-ref-log`. The MPIT matrix is not in the drawer: it is an action in the Orders tab (`ie-mpit`, `ie-mpit-controls`).

---

## 3. Map and targeting

Setup for this section: click **Go to seat / 前往** on a seat that is acting (strip state `行动中` / `Acting`), or select the active seat's tab.

- [ ] **Select Berlin.** Click the space decoration `data-testid="ie-space-berlin"` (the star marked Berlin / 柏林). The south-edge space card `data-testid="ie-space-card"` names `柏林`, and the space panel shows `data-testid="ie-space-detail"` with control, influence, fort, pacification and the action list `data-testid="ie-action-list"`.
- [ ] **Select an army.** Under `Units:` in the same panel, click one of your `data-testid="ie-unit-<unitId>"` buttons. The panel echoes `已选：…` / `Selected: …`, the unit button has `aria-pressed="true"`, and the map immediately rings that unit's legal destinations (`ie-target-ring` groups). This automatic ring is the "soft" mode: it starts from selecting a unit, not from an Orders button.
- [ ] **Only legal spaces are ringed.** The ring count equals the `n 个合法目标` / `n legal targets` count in the mode pill `data-testid="ie-mode-pill"`; no unringed space moves the unit when clicked.
- [ ] **Move by ring.** Note `CP left` / `剩余 CP` (`ie-command-cp`). Click a ringed friendly space: the token leaves the old space, appears in the new one, and the CP readout dropped by exactly **1** (peacetime redeploy costs 1 CP).
- [ ] **Click a non-target while armed.** Select the army again, then click a space with no ring. Two acceptable results depending on the mode:
  - *Soft* targeting (rings appeared by selecting the unit): the selection moves to the clicked space and the unit stays put; CP is unchanged.
  - *Armed* targeting (rings started by an Orders button, e.g. `在此发动陆战` in `ie-action-list`): the click is ignored outright. CP is unchanged and the unit does not move.
- [ ] **The naval panels can pick on the map too.** Whenever the amphibious (`ie-amphibious-map`), naval-transport (`ie-naval-transport-map`) or interception (`ie-intercept-map`) panel is shown, it carries a `地图选择` / `Pick on map` button. Clicking it arms the same map-targeting mode as an Orders button (rings, mode pill, `Esc` to leave); clicking a ringed destination submits the move. The panels' own selects and their direct `Go` buttons are still there as the keyboard fallback and still work without arming anything.
- [ ] `Esc` leaves the mode: the rings disappear, the mode pill `ie-mode-pill` disappears, the space selection returns to the origin space. A second `Esc` clears the selection.
- [ ] `Esc` while the intent chooser is open closes the chooser first and leaves the rings up: the board's key handler tests the chooser before the generic cancel (the hook gives the chooser priority), and the chooser's cancel re-arms targeting without that destination. A second `Esc` then leaves targeting. `ie-intent-cancel` does the same thing as that first `Esc`.
- [ ] **Inline chooser for two intents.** In the Great War maneuver (or a destination that is both a march and a rail for a Great War land unit), click a ringed space that offers two actions: the popover `data-testid="ie-intent-chooser"` appears with one button per intent (`ie-intent-gwMarch` "行军（1 格）" / `ie-intent-gwRail` "铁路（沿友方线路）"; in the campaign, `ie-intent-redeploy` is the one-intent case, so no chooser should appear).
  - Choosing an intent commits the move; `ie-intent-cancel` or `Esc` closes the chooser without spending CP.
  - The chooser is anchored over the turn panel; the map and its rings stay visible. **(verify)** whether it physically overlaps a ring under it at 1440×900 — the CSS places it in the turn column with a 56 px top offset.

---

## 4. Actions and confirmations

- [ ] **Disabled actions are visible, with a reason and a cost.** In `ie-action-list` every row `data-testid="ie-action-<id>"` is rendered whether or not it is legal (`data-enabled="true|false"`). Its button shows `· n CP` when it costs anything, and a disabled row shows an `.ie-action-reason` line underneath with the reason. No group is empty: each `data-testid="ie-actions-recruit|build|diplomacy|move|greatWar"` carries a count badge `n 项可用`.
- [ ] A disabled row's reason is readable text (not only a tooltip): the reason line stays visible under the button.
- [ ] **Declare war needs two clicks.** The declare-war block `data-testid="ie-war-declare"` keeps its aim/target/CP selects, and its `宣战` / `Declare war` button is `data-testid="ie-declare-war"`, a `ConfirmButton` like the controls below. First click: `data-armed="true"` and the label becomes `确认：宣战（n CP）` / `Confirm: declare war (n CP)`, where n is the CP chosen in the select. Second click: the war is declared (the block is only rendered while `war === null`, so it disappears), and the War tab joins the turn panel's tab strip. It disarms on blur, `Esc` or after **5 s**; with `confirmActions` off it declares on one click. The controls e2e test now clicks it twice.
- [ ] **Play for CP needs two clicks.** In the hand, `data-testid="ie-play-cp-<cardId>"` (`作为 CP 打出` / `Play for CP`). First click: the button changes to `data-armed="true"` and its text to `确认：作 n CP 打出` / `Confirm: play for n CP`. Second click: the card is played and CP rises. A click elsewhere (blur), `Esc`, or **5 s** without a second click disarms it.
- [ ] **Play event** `data-testid="ie-play-event-<cardId>"` behaves the same (`确认：打出事件` / `Confirm: play the event`).
- [ ] **Pass / end impulse needs two clicks.** In the turn panel head, `data-testid="ie-pass"` reads `停牌` / `Pass` while the impulse is unused, and `结束行动轮` / `End impulse` once the seat has played a card or banked CP. First click arms (`data-armed="true"`), second click passes. When passing is illegal the button is disabled and its tooltip is the 12.0 restriction.
- [ ] **End diplomacy needs two clicks.** In the diplomacy step, `data-testid="ie-end-diplomacy"` (`开始行动阶段` / `Start action phase`) arms on the first click.
- [ ] **Ready does not arm; Continue does.** `data-testid="ie-finish-prep"` (`准备完毕` / `Ready`) fires on one click (it carries no `confirm` flag), while in the end step `ie-end-phase-turn` (`继续` / `Continue`) is declared with `confirm: true` and rendered by the same `PhaseActions` → `ConfirmButton` path as pass and end diplomacy, so it arms first.
- [ ] **Turning confirmations off from the UI.** Open the strip's menu (`ie-menu-toggle`), then the Display disclosure (`ie-display-menu` → 显示), and clear **不可撤销的操作需要二次确认** (`data-testid="ie-confirm-actions"`). No reload is needed: the switch writes React state in the board shell, and the phase buttons (`PhaseActions`), the space panel's declare-war button and the hand tray all take that **live** value on the next render — each passes the current flag as its `confirm` prop rather than re-reading storage at mount.
  - `ie-play-cp-*`, `ie-play-event-*`, `ie-pass`, `ie-end-diplomacy`, `ie-end-phase-turn`, `ie-declare-war` and the pending options the board marks as final now fire on **one** click and never show `data-armed="true"`.
  - The value is stored under the `localStorage` key **`ie_confirm_actions`** (`"on"` / `"off"`; absent means on, so a fresh browser asks first). Ticking the box again restores it.
- [ ] **A refused action explains itself.** With a space selected, trigger something the engine refuses (an unaffordable declaration, a card the current window does not allow, a phase button that is out of turn). The board shows the notice `ie-toast` (`role="status"`, `aria-live="polite"`): `无法执行：<action>` / `Not allowed: <action>`, plus the reason the control itself computed (or `当前规则不允许该操作。` / "The rules do not allow that action right now." when it has none). It dismisses itself after about 4.5 s, the ✕ or `Esc` closes it sooner, and hovering pauses the timer. A successful action raises no notice.
  - Detection is by boardgame.io's `_stateID`: a refused move (`INVALID_MOVE`) leaves the counter unchanged, so the board waits **400 ms** on the local hotseat (**4 s** for a remote client, whose update can queue behind another packet) before calling the action refused.
  - Every labelled control runs through the board's `doAction` wrapper: card play, response / industry / chain / save, the phase buttons (ready / pass / end diplomacy / continue), declare war, pending options, map targeting, the Great War, war, national-action, MPIT and naval panels. §12 has the residual limits.

---

## 5. Great War

Prerequisite: a match with a Great War running (play to the outbreak, or use a saved state). Playbook anchor: the Outbreak step is `data-testid="ie-step-outbreak"`.

- [ ] **The War tab exists while a war runs.** `data-testid="ie-turn-tab-war"` (`战局` / `War`) appears as soon as `war` or `gw` is set, and disappears again when neither is. Its body is `data-testid="ie-turn-panel-war"`.
- [ ] The strip shows `GW <turn>` (`data-testid="ie-track-gw"`); a limited war without the Great War shows the attacker — defender badge `data-testid="ie-track-war"` instead.
- [ ] **Trench rows select their space.** In the War tab, `data-testid="ie-trench-board"` lists one row per trench battle, `data-testid="ie-trench-<spaceId>"`, each with a status (`进攻方占优` / `僵持` / `防守方占优`) and the forces present. Clicking a row **selects** that space: the space card `ie-space-card` and the panel `ie-space-detail` switch to it, and the row is marked as current (`aria-current="true"` and `data-current="true"`). The map does **not** recentre by itself; press its ⌖ control, `data-testid="ie-map-focus-selected"` ("Centre on the selected space" / 居中显示所选地点), to bring the space into view. With no trench marked, `data-testid="ie-trench-empty"` is shown instead.
- [ ] The trench list is **read + locate only** — it does not start a battle; the map's markers still open it.
- [ ] **Charts open in the lightbox.** In the reference drawer, `data-testid="ie-chart-<id>"` (e.g. `ie-chart-colonial-great-wars`, `ie-chart-combat-crt`, `ie-chart-sequence-of-play`) opens the full-screen `data-testid="ie-chart-lightbox"` with the image `ie-chart-image` and the close button `ie-chart-close`. `Esc`, the close button or a click on the backdrop closes it.
- [ ] The lightbox focus starts on the close button and `Tab` stays **inside** it: `ChartLightbox` uses `components/useFocusTrap.ts`, `Esc` closes it and focus returns to the chart button that opened it. The reference drawer `ie-reference-drawer` is a different case — it is a `hidden`-toggled `<aside>` with no trap, so `Tab` can still leave it (see §12). Check both and record which one keeps focus.
- [ ] **(verify) the Great War sideboard.** There is **no chart of a sideboard** in the nine published charts: the closest is `ie-chart-influence-track` (labelled `玩家面板` / "Player Display"), and the Great War panel's own rule link `ie-rule-ref-chart-colonial-great-wars` opens the Colonial & Great Wars chart. Which chart is meant by "the sideboard" has to be decided before this step can pass. What is checkable now: clicking these two links opens a lightbox whose image and title match the chart you clicked.
- [ ] Great War state is in the War tab as markup, not as a picture: `ie-gw` (sides, impulse order, budget), `ie-gw-italy-track`, `ie-gw-majors` / `ie-gw-major-<power>`, `ie-gw-combat-cards-in-front` with one `ie-gw-in-front-<cardId>` per card and `data-faceup`.

---

## 6. Bots

- [ ] Open `http://localhost:5173/localIE?solo=1`. The setup screen lists six checkboxes under `机器人席位（规则 34）`; P2–P6 are pre-ticked, P1 is not. Click `开始对局` / **Start match**.
- [ ] Select a bot seat's tab (`ie-seat-status-UK` … `ie-seat-status-OT`): its state reads `机器人` / `Bot` with the 🤖 dot, and the banner `data-testid="ie-bot-banner"` says the seat is read-only (`机器人席位仅供观战。` / "Bot seats are read-only.").
- [ ] **The bots take their impulses by themselves.** Leave the P1 board visible and do nothing: the log (`ie-turn-tab-log` → `ie-log`) grows with the other seats' plays, roughly one impulse every 0.5 s while a bot seat is on turn.
- [ ] **No toast on a bot seat.** No rejection banner/toast appears on a bot seat's board. The notice is only raised by the `doAction` wrapper behind a human's labelled control; the bot driver calls raw moves, so a refused bot decision never raises one. The check is "the bot seat shows no error message inside the board".
- [ ] **No `invalid move` in the console.** Open DevTools → Console, keep it open for at least one full campaign turn with the bots playing, and confirm there is no `invalid move` / `INVALID_MOVE` line from the board. Allowed and expected if a bot decision is ever refused: `[IE bot] repeated invalid decision …` from the board's own fallback (it fires only after three identical refused decisions in the same state).
- [ ] **(verify)** the *number* of such lines: the browser's console is authoritative; the source never logs `invalid move` itself, but boardgame.io's client may. Report exactly what you see, with a screenshot.

---

## 7. Spectator

The spectator is **online-only** — `/localIE` has no spectator mode. Route:
`/join/imperialElegy/<matchID>/spectate`. Create the match first.

- [ ] Create a match at `http://localhost:5173/imperialElegy`; take its `matchID` from the share links. Note that the online client talks to `${protocol}//${host}`, so a plain `yarn start` origin needs the game server on the same origin or a proxy (`yarn serve`, or the bridge the spectator Playwright spec uses).
- [ ] Open `http://localhost:5173/join/imperialElegy/<matchID>/spectate` in a second browser profile.
- [ ] **No orders.** The turn panel `ie-dock` shows no `ie-phase-actions` block, and the Orders body shows no `ie-action-list` (no legal actions for a non-seat).
- [ ] **No mat.** `document.querySelector('[data-testid="ie-mat"]')` is `null` — the player mat is only rendered for a seat (`PlayerMat` returns `null` without a viewer).
- [ ] **No hand.** No `data-testid="ie-hand-tray"`; no `.ie-card` elements. The strip shows the `观战者` / `Spectators` badge, and where the hand would be there is `data-testid="ie-private-info"` reading `私有: 隐藏. 观战者.` / "Private: hidden. Spectators."
- [ ] The CP readout in the strip/panel shows the public wallet (`G.cpRemaining`), not a seat's impulsive budget.
- [ ] **Reference still works.** `ie-open-reference` opens `ie-reference-drawer` with the CRT, costs, sequence, `ie-ref-charts`; a chart opens in `ie-chart-lightbox`.
- [ ] **Log still works.** `ie-turn-tab-log` → `ie-log` lists the public history (newest first), and the drawer's `ie-ref-log-entries` lists it too.
- [ ] If a decision is pending for another seat, `ie-ref-pending` names that seat, and no control in the drawer can resolve it.

---

## 8. Phone 390×844

- [ ] DevTools → device toolbar → **390 × 844** (iPhone 12/13/14 size), then reload `/localIE`.
- [ ] **One bottom dock, four tabs.** At 390 px the board is the 44 px strip, the map and **one** bottom dock `data-testid="ie-mobile-dock"`, not a hand sheet plus a separate turn panel. The dock carries `data-open` (`false` closed, `true` open), `data-expanded` (`false` half, `true` full; meaningful only while open), `data-tab` (`orders` / `hand` / `mat` / `log`, and `war` only while a limited war or the Great War is running) and `data-decision` (`true` while a decision, battle or result is owed). Its bar carries `data-testid="ie-mobile-toggle"` (open / close), `data-testid="ie-mobile-expand"` (half ↔ full) and one button per tab in that order — `ie-mobile-tab-orders` (`指令` / Orders, `决策` / Decision while a decision is owed), `ie-mobile-tab-hand` (`手牌` / Hand), `ie-mobile-tab-mat` (`面板` / Mat), `ie-mobile-tab-log` (`记录` / Log) and `ie-mobile-tab-war` (`战局` / War) only while that tab exists. The active tab is shown inside `data-testid="ie-mobile-body"`. Pressing a tab while the dock is closed opens it to half; reopening with the toggle also starts at half, never at full.
- [ ] **The old controls are hidden, not gone.** `TurnPanel`'s own tab strip `ie-turn-tabs` and `HandTray`'s own `ie-tray-toggle` / `ie-tray-expand` are still in the DOM but must not be visible at 390 px — the dock bar owns them. Check with
  `[...document.querySelectorAll('.ie-turn-tabs, .ie-tray-toggle, .ie-tray-expand')].map((el) => el.checkVisibility({checkVisibilityCSS: true, checkOpacity: true}))`
  → every entry `false`. The panel and tray bodies stay mounted.
- [ ] **The map stays above the dock.** `ie-map-region` keeps the area between the strip and the dock; the dock is the last region in the column and does not overlay the map.
- [ ] **Peek / half / full.** Closed: `data-open="false"`, **44 px** (56 px while a decision is owed — see below). `ie-mobile-toggle` opens to **half**: `data-open="true"`, **40 dvh** ≈ 338 px at 844. `ie-mobile-expand` switches the open dock to **full**: `data-expanded="true"`, `calc(100dvh - 140px)` ≈ 704 px; pressing it again returns to half, and the toggle closes back to the 44 px peek. Measure
  `document.querySelector('[data-testid="ie-mobile-dock"]').getBoundingClientRect().height`
  at each step; the document itself must not grow a page scroll — only the dock body and the hand's card row scroll inside themselves.
- [ ] **44 px strip.** The track strip `data-testid="ie-track-strip"` is exactly 44 px tall. Inside it at this width: no stepper (`ie-step-*` hidden), no alliance track (`ie-track-alliance` hidden), one CP chip `ie-track-cp` (this is the phone's only CP readout — the turn panel head hides `ie-command-cp` below 768 px), and the round buttons `?` and `☰` at 36×36.
- [ ] The `☰` menu `data-testid="ie-menu-toggle"` → `ie-menu` offers **Display only** at this width. `ie-open-charts` and `ie-open-rules` are still in the menu's markup but CSS hides them below 768 px (`.ie-command-menu .ie-btn { display: none }`), so at 390 px they are present in the DOM with `display: none` and cannot be clicked. The same material is still reachable: the strip's `?` (`ie-open-reference`) opens the drawer, which carries the CRT and the `ie-ref-charts` grid, and a chart opens from that grid.
- [ ] **Orders tab.** With the dock open (press `ie-mobile-toggle` if it is closed), press `ie-mobile-tab-orders`: `data-tab="orders"` and `ie-mobile-body` shows the Orders body — the selected space's action list `ie-action-list`, the national actions, MPIT, and the required / optional card choices; while a pending decision, battle or result is open this body is the decision (`PendingPanel`) instead. Disabled rows keep their reason line (§4).
- [ ] **Hand tab.** Press `ie-mobile-tab-hand`: `data-tab="hand"` and `ie-mobile-body` shows `ie-hand-tray`'s card row with its filter / sort controls, the per-card status line, and the `作为 CP 打出` / `Play for CP` and `⋯` buttons. The card row scrolls inside `.ie-tray-scroll`; the hand is reachable even though the old tray toggle is hidden.
- [ ] **Mat tab.** Press `ie-mobile-tab-mat`: `data-tab="mat"` and `ie-mobile-body` contains `ie-mat` with stability, manpower, industry, keys, VP, reserves, the Industry Card, the CP chain and goals. The mat is **no longer hidden on a phone**; this tab is the phone route to the figures that the reference drawer's power dashboards also print.
- [ ] **Log tab.** Press `ie-mobile-tab-log`: `data-tab="log"` and `ie-log` lists the public history, newest first.
- [ ] **War tab only while a war runs.** `ie-mobile-tab-war` is absent without a war or the Great War, appears as soon as `war` or `gw` is set, and `data-tab` can then be `war`; its body is the war panel (`ie-turn-panel-war`, with `ie-trench-board` and, in the Great War, `ie-gw`). When neither runs the button disappears again and the dock must not stay on an empty War body: check that `data-tab` is no longer `war` and the Orders body is in front. This is why a fixed four-tab count is wrong in some match states.
- [ ] **Hand and Mat are seat-only.** At 390 px on the spectator route of §7, the dock shows Orders and Log only (plus War while a war runs): no `ie-mobile-tab-hand`, no `ie-mobile-tab-mat`, no `ie-hand-tray` and no `ie-mat`. The dock still opens, closes and expands for the public tabs.
- [ ] **The decision brings the dock up; the 56 px peek is its collapsed state.** Trigger a pending decision that names a space (e.g. a redeploy / treaty space prompt or a battle target). The dock reports `data-decision="true"` — it is also true for a battle or the result panel — and, when the decision arrives on a mounted board, the dock opens to **half** on the **Orders** tab so the decision is in front (a decision already pending at load does not force it open; that case starts at the 56 px peek). Collapse it with `ie-mobile-toggle`: closed with a decision owed is **56 px**, and the bar shows the short one-line `data-testid="ie-mobile-decision-peek"` (`有决策待处理` / "A decision is waiting") in place of the usual 44 px peek. The line exists **only** while the decision is owed **and** the dock is closed, so it is absent when the dock is open and when no decision is owed. Reopening the dock shows the decision again.
- [ ] **The open decision is capped at 50 dvh.** With a decision owed the dock never grows past **50 dvh** (422 px at 844): `ie-mobile-expand` is inert while the decision is owed, so the sheet stays at its **40 dvh** half (≈ 338 px) rather than jumping to full. The cap is what keeps the map target on screen: with the decision open, scroll-check that the highlighted space in `ie-map` is still visible above the dock. **(verify)** the exact arithmetic at 390×844: strip 44 + dock ≤ 422 = ≤ 466 of 844, so the map should keep ≈ 378 px even at the 50 dvh cap; confirm the site's top bar and the map's pan do not push the target below the fold.
- [ ] **Answering leaves the dock where it is.** Resolve the decision: `data-decision` turns `false`, `ie-mobile-decision-peek` disappears, and the dock is not snapped back to a remembered state or re-opened — it stays where the reader left it, normally still at half on Orders. Confirm the answer needed no reload and no extra toggle, and the tab strip stays usable.

---

## 9. Keyboard only

Put the mouse away for this whole section.

- [ ] **Tab to a legal target.** From the address bar, `Tab` until the map gets a visible focus ring: the map `<svg data-testid="ie-map">` is a single tab stop **only when at least one legal target exists** (`tabindex=-1` otherwise). Select an army first so there are targets.
- [ ] **Arrows between targets.** `ArrowRight` / `ArrowDown` and `ArrowLeft` / `ArrowUp` step through the legal targets in order, the focused one drawn brighter, and the space card `ie-space-card` gains the `聚焦目标` / "focused target" tag. `Home` / `End` jump to the first / last target.
- [ ] **The card follows the focus, not the old selection.** While a target has keyboard focus the space card `ie-space-card` shows the focused target's **own** space — its name, units, fort, pacification and trench — never the space that was selected before targeting began; the `聚焦目标` / "focused target" tag marks it as the focus. When the ring set clears the card falls back to the selected space. Stepping with the arrows re-renders the card for each target.
- [ ] **Enter commits.** `Enter` (or `Space`) on the focused target submits exactly what a click would — CP drops by 1 for a move.
- [ ] **Esc cancels.** `Esc` leaves targeting and restores the origin selection; no CP is spent.
- [ ] With exactly **one** legal target, `Enter` on the page (not on a form control) also confirms it — the board listens for `Enter` while targeting.
- [ ] **The card inspector traps focus.** In the hand, `Tab` to `ie-open-card-<cardId>` and press `Enter`: the inspector `data-testid="ie-card-inspector"` opens (`role="dialog" aria-modal="true"`), focus lands on `ie-card-inspector-close`, and the inspector uses `components/useFocusTrap.ts`: `Tab` / `Shift+Tab` stay inside the panel (close, image, the `ie-card-inspector-actions` buttons, the print toggle) and never reach the board behind. `Esc` closes it and focus returns to the card button that opened it — the trap records the pre-open focus target and restores it when the overlay closes. No browser test asserts the return, so watch where focus lands and report it if it does not come back.
- [ ] **The seat strip is one tab stop.** From a neutral element, `Tab` reaches `ie-seat-strip` **once**: only the current seat's tab (`aria-selected="true"`) has `tabIndex=0`; the other five have `tabIndex=-1`. The strip is a roving `tablist` (`useRovingTabs`, the same hook as the panel tabs): `ArrowRight` / `ArrowDown` and `ArrowLeft` / `ArrowUp` move to the next / previous seat and **select** it, `Home` / `End` jump to the first / last, both ends wrap, and activation follows focus — no `Enter` needed. Switching focuses that seat's `ie-seat-status-<power>`. The number keys `1`–`6` and `[` / `]` still switch seats from anywhere outside a form control.
- [ ] The turn-panel tabs `ie-turn-tab-action|war|log` behave the same way (one tab stop, arrows move, the tab is selected as it receives focus).
- [ ] `Esc` inside a text/select control does **not** cancel a targeting mode (the global handler stands down while a form control has focus).

---

## 10. Both languages

The language toggle is the `中文 / English` switch in the site's top bar (MUI `switch`, `name="locale-switch"`); the app starts in `中文`. It works on the browser's OS/browser zoom but is not inside the board itself — the board's own top bar is the track strip.

- [ ] Start in `中文` (zh_CN) and walk the whole board, writing down every string that stays English:
  - **strip** `ie-track-strip`: decade `1850年代`, `世界紧张`, `3：禁战`, the `?` / `☰` tooltips, the step labels `准备 · 外交 · 行动 · 结束`; the strip's own CP chip (phone only — hidden at 1440×900) prints `剩余 <n>`, dropping the trailing `CP`, while the panel head prints `剩余 CP <n>`;
  - **turn panel** `ie-dock`: `指令`, the CP label, `停牌` / `结束行动轮`, tab labels, the one-line summary;
  - **map**: `ie-space-card`, `ie-space-detail`, the action group titles and every `.ie-action-reason`, the legend;
  - **mat** `ie-mat`: `稳定` (not `稳定度`), `人力`, `工业`, keys, reserves, the figure tooltips;
  - **hand** `ie-hand-tray`: filter/sort, `CP 链`, `可作 CP`, the per-card status line, `中文译文` toggle on each face;
  - **drawer** `ie-reference-drawer`: section headings, the CRT column heads, the cost list, the sequence, `ie-ref-log`;
  - **checklist strings**: the same set in `English` after switching.
- [ ] Switch to `English` with the toggle and confirm each of the above flipped; switch back and confirm nothing stayed English.
- [ ] **No raw placeholders.** Search the rendered text for `{{` and `}}` — `document.body.innerText.includes("{{")` must be `false`. Same for `undefined`, `[object Object]` and a bare key name such as `pendingKind` or `cpMode`.
- [ ] **No untranslated English in zh_CN.** Walk the same list a second time reading only the zh_CN text. Known exceptions that are *by design* and may stay English: `CP`, `VP`, power codes (GE, UK, …), rule numbers, the published chart images (the nine PNGs are printed English art), and card *titles* quoted inside log lines.
- [ ] `document.documentElement.lang` **does not follow the toggle — settled defect, not a test.** `index.html` hardcodes `<html lang="en">` and nothing under `src/` touches `document.documentElement.lang`; only the card faces carry their own `lang` (`CardFace.tsx` sets it on both faces, `HandTray.tsx` on the inline translation block). So a zh_CN board still reports `en` at the document root: do not use the root `lang` to judge localization (screen readers and font fallback will take `en`), and read the board's own strings instead. Record the mismatch if you are auditing accessibility.

---

## 11. Reduced motion

- [ ] Turn on the OS setting: macOS → System Settings → Accessibility → Display → **Reduce motion**; Windows → Settings → Accessibility → Visual effects → **Animation effects: off**; Linux → GNOME → Accessibility → Seeing → Reduce Animation. Keep the browser as the only app that matters and reload the board.
- [ ] **Card hover lift is gone.** In the hand, hover a card `ie-card-<id>` and focus one with `Tab`: it does **not** rise or scale. Normally it moves up 4 px and grows 4 % (`.ie-hand .ie-card:hover`); with reduce-motion the transform and transition are both removed.
- [ ] **Seat-strip pulse is gone.** Select the seat that owes the decision (`ie-seat-status-*` with `data-state="decide"`, class `ie-seat-tab-decide`): its border no longer pulses (normally a 1.6 s infinite `ie-pulse-decide` animation). Watch for five seconds; nothing should cycle.
- [ ] Transitions on the strip, turn panel, mat and hand tray are also off (`transition: none !important`). Switching tabs and opening the tray snap instead of easing.
- [ ] Turn Reduce motion **off** again and reload: the pulse and the hover lift come back.
- [ ] **(verify)** anything outside those four containers — the card inspector's slide-in (`ie-inspector-in`, 0.16 s) and the map's hover-ring opacity — is *not* covered by the reduce-motion blocks; confirm whether the inspector still slides.

---

## 12. Known gaps

Honest list of what is still missing or unwired in the board as it stands. None
of these was introduced by this checklist; they are where a tester's answer is
"not yet" rather than "bug".

1. **No sideboard chart, by design.** The published nine charts contain no
   Great War sideboard: the plan drops that JPG and replaces it with the trench
   list in the War tab (`TrenchBoard`). Section 5 checks the trench rows and the
   two chart links instead; nothing is missing.
2. **The confirmation preference has a switch now, but only in the strip menu.**
   The Display menu carries `ie-confirm-actions` and the board reads it live, so
   flipping it takes effect at once (no reload). It is still one switch behind a
   sub-disclosure, and the setting is per browser rather than per match.
3. **The reference drawer still lets Tab escape.** The chart lightbox now traps
   focus (`ChartLightbox` uses `components/useFocusTrap.ts`, Esc closes and
   focus returns), but the drawer is a `hidden`-toggled `<aside>` rather than a
   dialog, so Tab can still leave it. Deliberate: the drawer is a side panel
   readers scroll while the board stays live, not a modal.
4. **The rejection notice has two blind spots.** Detection is by `_stateID`:
   boardgame.io does not advance it for a refused move, so every labelled
   control now funnels through the board's `doAction` wrapper (card play,
   response / industry / chain / save, the phase buttons, declare war, pending
   options, map targeting, Great War, war, national actions, MPIT and the naval
   panels). What remains: another player's simultaneous update can advance
   `_stateID` first, in which case a refused move looks accepted and no notice
   is raised; and the engine still sends no reason code, so the body is the
   reason the control computed or a generic "the rules do not allow that action
   right now".
5. **Rule links go to the printed charts and the inline tables only.** The
   inline drawer sections registered by anchor are the CRT (`crt`), the costs
   (`costs`) and the sequence (`sequence`); every other `RuleLink` opens one of
   the nine PNGs. There is no per-rule text at the rule number, and
   `RuleLink` renders a plain `?` + number rather than a link when the board
   forgot to pass `onOpenReference` — those spots look identical but do nothing.
6. **Spectating is online-only.** There is no spectator toggle on `/localIE`,
   so section 7 needs a running game server on the same origin; a bare
   `yarn start` origin cannot reach it without a proxy.
7. **The bot runs on the client in hotseat and on the server online.** In the
   hotseat screen each bot seat is driven by a 500 ms `setTimeout` in the board
   while its tab is mounted (all six are always mounted in hotseat), and a
   decision refused three times in a row is replaced by a silent fallback move
   (`[IE bot] repeated invalid decision` in the console). An online match of 2–6
   humans is different: the lobby's `setupData.bots` names the seats no human
   took, the server (`src/game/ieBotDriver.ts`) plays them through a Master with
   each seat's credentials, and the board only shows the read-only banner — a
   client must not also send that move, so the board's bot loop is gated on
   `hotseat`. A server-side refusal follows the same three-strike escape and
   logs `[IE bot] falling back to …`.
8. **Spectator console noise (verify).** Whether boardgame.io's client prints
   `invalid move` lines for a spectator's stripped view is not asserted
   anywhere in the repo; check by hand.
9. **The desktop mat is a 148 px strip, not the brief's 320 px column.** At
   1440×900 the table grid is `148px / 1fr / 348px`, so the mat beside the map
   is **148 px** wide — **132 px** below 1100 px, where the same media query
   narrows the turn panel to 300 px — and the brief asks for 320 px. The
   figures are unchanged; the narrower column scrolls its own body
   (`.ie-mat-grid { overflow: auto }`) and, below 1100 px, folds to a one-line
   chip row with a popover. On a phone the mat is now a tab of the four-tab
   dock (§8), so the desktop column is the only layout target this build does
   not meet.
