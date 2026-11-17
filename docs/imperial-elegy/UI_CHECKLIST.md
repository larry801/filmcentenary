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

---

## 2. One screen

- [ ] **No page scroll.** At 1440×900 the document does not scroll vertically: `document.documentElement.scrollHeight` equals the viewport height, and the wheel over the page body does not move it. Only the hand tray's card row (`data-testid="ie-tray-scroll"`) and the turn panel bodies scroll, and they scroll sideways/inside themselves.
- [ ] **One CP readout.** On the visible board there is exactly **one** `data-testid="ie-command-cp"`. The track strip's copy (`ie-track-cp`) is a phone-only chip and is hidden at desktop width; the readout you see is the one in the turn panel head, `CP left  <n>` / `剩余 CP <n>`.
- [ ] **Hand row ≤ 230 px.** Without a pending decision, the hand tray `data-testid="ie-hand-tray"` is at most **212 px** tall (CSS `max-height: 212px` on `.ie-table .ie-hand-tray`); when collapsed (`data-open="false"`) it is a 44 px bar. Measure it: `document.querySelector('[data-testid="ie-hand-tray"]').getBoundingClientRect().height` ≤ 212.
- [ ] **Turn panel tabs.** `data-testid="ie-turn-tabs"` shows `指令` / `Orders`, `记录` / `Log` — and `战局` / `War` only while a war or the Great War is running. `data-testid="ie-turn-tab-action"`, `ie-turn-tab-war`, `ie-turn-tab-log` are `role="tab"`; the selected tab has `aria-selected="true"`.
- [ ] The Orders tab label becomes `决策` / `Decision` while a pending decision or battle is open.
- [ ] **Reference `?`.** The round `?` button in the strip is `data-testid="ie-open-reference"`; it opens the right-hand drawer `data-testid="ie-reference-drawer"` (`data-open="true"`, `hidden` removed) on the current step — the drawer's `data-testid="ie-ref-sequence"` has that step highlighted. `Esc` or `data-testid="ie-reference-close"` closes it.
- [ ] A step in the strip's stepper (`data-testid="ie-stepper"`, buttons `ie-step-prep`, `ie-step-diplomacy`, `ie-step-action`, `ie-step-end`) opens the drawer at that step's reference too.
- [ ] The drawer's sections are present: `ie-ref-crt` (CRT), `ie-ref-costs` (action costs), `ie-ref-sequence`, the power dashboards (`ie-power-GE` …), `ie-ref-mpit`, `ie-ref-charts`, `ie-ref-log`.

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
- [ ] `Esc` while the intent chooser is open closes only the chooser (rings stay up) — the next `Esc` leaves the mode.
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
- [ ] **Turning confirmations off from the UI.** Open the strip's menu (`ie-menu-toggle`), then the Display disclosure (`ie-display-menu` → 显示), and clear **不可撤销的操作需要二次确认** (`data-testid="ie-confirm-actions"`). No reload is needed: the board reads the preference live and passes it to the hand tray, the phase buttons and the space panel's declare-war button.
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
- [ ] **Trench list focuses the map.** In the War tab, `data-testid="ie-trench-board"` lists one row per trench battle, `data-testid="ie-trench-<spaceId>"`, each with a status (`进攻方占优` / `僵持` / `防守方占优`) and the forces present. Clicking a row selects that space on the map — the map centres on it and `ie-space-card` / `ie-space-detail` switch to it; the row gets `aria-current="true"`. With no trench marked, `data-testid="ie-trench-empty"` is shown instead.
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
- [ ] **44 px strip.** The track strip `data-testid="ie-track-strip"` is exactly 44 px tall. Inside it at this width: no stepper (`ie-step-*` hidden), no alliance track (`ie-track-alliance` hidden), one CP chip `ie-track-cp` (this is the phone's only CP readout — the turn panel head hides `ie-command-cp` below 768 px), and the round buttons `?` and `☰` at 36×36.
- [ ] The `☰` menu `data-testid="ie-menu-toggle"` → `ie-menu` contains Display and the reference buttons `ie-open-charts` and `ie-open-rules`.
- [ ] **Bottom sheet: peek / half / full.** The hand sheet `data-testid="ie-hand-tray"` starts at **peek** (`data-open="false"`, 44 px). `data-testid="ie-tray-toggle"` opens it to **half** (`data-open="true"`, 40 dvh ≈ 338 px at 844). `data-testid="ie-tray-expand"` then switches to **full** (`data-expanded="true"`, `calc(100dvh - 140px)` ≈ 704 px); pressing it again returns to half. The toggle closes back to peek.
- [ ] The map keeps its own area above the sheet (`ie-map-region` is order 1, the sheet order 2, the turn panel order 3 at the bottom).
- [ ] **A decision stays answerable with its map target visible.** Trigger a pending decision that names a space (e.g. a redeploy/treaty space prompt or a battle target):
  - With a decision owed, the sheet reports `data-decision-peek="true"` and folds to 56 px with the line `data-testid="ie-tray-decision-peek"` (`有决策待处理——请在面板中作答` / "A decision is waiting — answer it in the panel"); opening it by hand is pinned at 56 px and shows no cards.
  - The turn panel `ie-dock` reports `data-decision-only="true"`, hides its tab strip, and is capped at **50 dvh**; the hand peek plus that cap leaves the top half of the map visible. Scroll check: with the decision open, the highlighted space on the map is still on screen. **(verify)** the exact arithmetic at 390×844: strip 44 + peek 56 + panel ≤ 422 = ≤ 522 of 844, so the map should keep ≈ 322 px; confirm nothing else (the app bar) pushes the map target below the fold.
  - Answer the decision and confirm the sheet returns to the reader's previous open/expanded state. **(verify)**: the sheet is re-opened by the next toggle, not automatically.

---

## 9. Keyboard only

Put the mouse away for this whole section.

- [ ] **Tab to a legal target.** From the address bar, `Tab` until the map gets a visible focus ring: the map `<svg data-testid="ie-map">` is a single tab stop **only when at least one legal target exists** (`tabindex=-1` otherwise). Select an army first so there are targets.
- [ ] **Arrows between targets.** `ArrowRight` / `ArrowDown` and `ArrowLeft` / `ArrowUp` step through the legal targets in order, the focused one drawn brighter, and the space card `ie-space-card` gains the `聚焦目标` / "focused target" tag. `Home` / `End` jump to the first / last target.
- [ ] **Enter commits.** `Enter` (or `Space`) on the focused target submits exactly what a click would — CP drops by 1 for a move.
- [ ] **Esc cancels.** `Esc` leaves targeting and restores the origin selection; no CP is spent.
- [ ] With exactly **one** legal target, `Enter` on the page (not on a form control) also confirms it — the board listens for `Enter` while targeting.
- [ ] **The card inspector traps focus.** In the hand, `Tab` to `ie-open-card-<cardId>` and press `Enter`: the inspector `data-testid="ie-card-inspector"` opens (`role="dialog" aria-modal="true"`), focus lands on `ie-card-inspector-close`, and `Tab` / `Shift+Tab` cycle **inside** the panel (close, image, the `ie-card-inspector-actions` buttons, the print toggle) without reaching the board behind. `Esc` closes it and focus returns to the card button (`useFocusTrap` records the pre-open focus target and restores it when the overlay closes). No browser test asserts the return, so watch where focus lands and report it if it does not come back.
- [ ] **The seat strip is one tab stop.** From a neutral element, `Tab` reaches `ie-seat-strip` **once**: only the current seat's tab (`aria-selected="true"`) has `tabIndex=0`; the other five have `tabIndex=-1`. `ArrowRight` / `ArrowLeft` / `Home` / `End` move between seats and switch the board with them. Clicking a seat via the arrow keys focuses that seat's `ie-seat-status-<power>`.
- [ ] The turn-panel tabs `ie-turn-tab-action|war|log` behave the same way (one tab stop, arrows move, the tab is selected as it receives focus).
- [ ] `Esc` inside a text/select control does **not** cancel a targeting mode (the global handler stands down while a form control has focus).

---

## 10. Both languages

The language toggle is the `中文 / English` switch in the site's top bar (MUI `switch`, `name="locale-switch"`); the app starts in `中文`. It works on the browser's OS/browser zoom but is not inside the board itself — the board's own top bar is the track strip.

- [ ] Start in `中文` (zh_CN) and walk the whole board, writing down every string that stays English:
  - **strip** `ie-track-strip`: decade `1850年代`, `世界紧张`, `3：禁战`, `剩余 CP`, the `?` / `☰` tooltips, the step labels `准备 · 外交 · 行动 · 结束`;
  - **turn panel** `ie-dock`: `指令`, the CP label, `停牌` / `结束行动轮`, tab labels, the one-line summary;
  - **map**: `ie-space-card`, `ie-space-detail`, the action group titles and every `.ie-action-reason`, the legend;
  - **mat** `ie-mat`: `稳定度`, `人力`, `工业`, keys, reserves, the figure tooltips;
  - **hand** `ie-hand-tray`: filter/sort, `CP 链`, `可作 CP`, the per-card status line, `中文译文` toggle on each face;
  - **drawer** `ie-reference-drawer`: section headings, the CRT column heads, the cost list, the sequence, `ie-ref-log`;
  - **checklist strings**: the same set in `English` after switching.
- [ ] Switch to `English` with the toggle and confirm each of the above flipped; switch back and confirm nothing stayed English.
- [ ] **No raw placeholders.** Search the rendered text for `{{` and `}}` — `document.body.innerText.includes("{{")` must be `false`. Same for `undefined`, `[object Object]` and a bare key name such as `pendingKind` or `cpMode`.
- [ ] **No untranslated English in zh_CN.** Walk the same list a second time reading only the zh_CN text. Known exceptions that are *by design* and may stay English: `CP`, `VP`, power codes (GE, UK, …), rule numbers, the published chart images (the nine PNGs are printed English art), and card *titles* quoted inside log lines.
- [ ] `document.documentElement.lang` follows the toggle. **(verify)**: I could not confirm the board sets `lang` on its own container; the card translation blocks do set `lang` per face.

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
7. **The bot is a client-side loop, not an engine bot.** Each bot seat is driven
   by a 500 ms `setTimeout` in the board while its tab is mounted (all six are
   always mounted in hotseat), and a decision refused three times in a row is
   replaced by a silent fallback move (`[IE bot] repeated invalid decision` in the
   console).
8. **Spectator console noise (verify).** Whether boardgame.io's client prints
   `invalid move` lines for a spectator's stripped view is not asserted
   anywhere in the repo; check by hand.
