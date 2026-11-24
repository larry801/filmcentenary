# Imperial Elegy — Visual System

**Status:** Implemented (phases 1–7), normative
**Revision:** 1.1 — 2026-11-18
**Owner:** Imperial Elegy UI
**Applies to:** `src/imperialElegy/components/**`, `public/imperial-elegy/**`, `docs/imperial-elegy/**`

This document defines the visual language of the Imperial Elegy board. It is a
**contract**, not a one-off redesign brief: implementation, reviews and future
features are measured against it.

The keywords MUST, MUST NOT, SHOULD, SHOULD NOT and MAY are used as defined in
RFC 2119.

---

## 0. Front matter

### 0.1 Precedence

When two sources disagree, the earlier entry wins:

1. The publisher's printed rules and the game data (`POWER_DEFS`, `SPACES`,
   card text).
2. Behaviour and layout contracts: [`README.md`](README.md),
   [`UI_CHECKLIST.md`](UI_CHECKLIST.md), [`MAP.md`](MAP.md).
3. This visual specification.
4. Existing implementation details.

A visual choice MUST NOT change what a control does, when it is legal, or what
text it shows. If a visual treatment would require a layout or behaviour change,
the treatment is wrong, not the contract.

### 0.2 Frozen surface

The following are **frozen** for the whole visual programme:

- Gameplay, phase flow, and information architecture.
- The region layout described in `README.md` (seat strip, track strip, map,
  player mat, turn panel, hand tray) and the phone bottom dock.
- Interaction patterns: click-to-select, targeting rings, arm-then-confirm,
  the card inspector, the reference drawer.
- Every `data-testid="ie-*"` attribute.
- Every `ie-*` class name. State continues to be expressed with `data-*`
  attributes.
- No inline `style=` attributes in non-SVG elements (enforced by the existing
  e2e audit).
- Bilingual parity: every string exists in `en` and `zh_CN`; neither language
  is a fallback rendering of the other.

### 0.3 Scope of this document

In scope: colour, typography, surfaces, texture, ornament, elevation,
iconography, motion, component appearance, density budgets, token migration,
accessibility, performance, and the verification method for all of the above.

Out of scope: rules, AI, server behaviour, the printed-board route's content,
new artwork, and any change to component structure.

---

## 1. Design intent

### 1.1 Problem

The current board is functionally complete and visually coherent, but its
language is generic "dark UI with parchment accents": a near-black shell, a
photographic map scan, rounded MUI-adjacent controls, and gold used as a general
highlight. It does not yet read as the object the game depicts — a working
general-staff table with a printed atlas, field orders and brass instruments.

### 1.2 Observable goals

A redesign succeeds when all of these are true:

1. At two metres, the screen reads as a **printed map on a dark work table**,
   not as a web application.
2. At 390 px, it reads as the **same object**, not a mobile theme of it.
3. The map never loses area to chrome; ornament adds no layout height.
4. The player can find "what should I press now?" in under two seconds, in
   either language.
5. Text remains legible at the 12 px floor over every texture in the system.
6. Nothing about the redesign changes a test id, a rule, or a control's meaning.

### 1.3 Audience

- **Seated player (desktop):** long turns, dense information, keyboard use.
- **Hotseat switcher:** six seats, frequent seat changes, needs to see whose
  decision is owed.
- **Phone player:** one-handed, map-first, dock-driven.
- **Spectator:** public information only; must not look like a broken player
  view.

### 1.4 Decision log

| ID | Decision | Rejected alternative |
|---|---|---|
| D-01 | Art direction is **The Imperial Field Atlas** | Generic "premium dark strategy UI"; steampunk |
| D-02 | Three surface families: table, paper, plate | Parchment everywhere; dark everywhere |
| D-03 | Brass marks exactly one primary action per viewport | Brass as a general accent |
| D-04 | Red overprint means decision/urgency only | Red as a generic emphasis colour |
| D-05 | Self-host Latin only; no CJK webfont | Noto Sans SC / Source Han subset |
| D-06 | EB Garamond (display) + Libre Franklin (UI) | Georgia + system sans; Inter |
| D-07 | 12 px hard floor; serif never below 15 px | Keep 8–11 px micro-labels |
| D-08 | Power fills stay byte-identical to `POWER_DEFS` | Re-tint powers for contrast |
| D-09 | Small text is never placed on a power fill | Cream labels on every fill |
| D-10 | Tokens come from one generated source | Hand-mirrored TS and CSS |
| D-11 | CSS splits into ordered layers | One 3,278-line stylesheet |
| D-12 | One inline SVG icon set | MUI icons; emoji |
| D-13 | Mechanical motion, 100/160/180 ms | Spring/bounce animation |
| D-14 | Layout ledger is frozen; ornament is out of flow | Ornamental rows and headers |
| D-15 | Phone dock heights stay as measured today | Re-proportion the dock |
| D-16 | 44 px hit areas on phone/coarse pointers | Visual size equals hit size |
| D-17 | Test ids and class names are frozen | Rename for a cleaner API |
| D-18 | `CardFace` and `PrintedBoard` are artwork, exempt from webfonts | Load webfonts into SVG exports |
| D-19 | Texture only on non-text surfaces | Textured paper behind all text |
| D-20 | No inline styles; theming via tokens and data attributes | Runtime style injection |
| D-21 | One added token, `--ie-move-ink: #2F5D7C` (2026-11-18) | Reuse a power fill (FR/IT blue) for the map's move ring |
| D-22 | One added token, `--ie-move-ink-on-dark: #8FB4D4` (2026-11-20) | Paint the map key's move swatch with the paper-only `--ie-move-ink` (2.14:1 on panel) |

---

## 2. Art direction — The Imperial Field Atlas（帝国战地图志）

### 2.1 Thesis

> The interface is a working general-staff table in 1914: a dark oilcloth work
> surface, one printed atlas sheet, letterpress field orders, brass
> instruments, and a red grease pencil that appears only where a decision is
> owed.

### 2.2 Five material metaphors

| Metaphor | Visual carrier | Behavioural rule |
|---|---|---|
| **The table** | Shell ground, track strip, panel chrome, dock | Never carries long reading text |
| **The atlas sheet** | The map, and only the map, as a large paper field | Chrome never overlaps its working area |
| **The field order** | Cards, hand rows, reference sheets, toast slips | Printed, flat, ruled; no gloss |
| **The brass instrument** | The one primary action, current-step markers, selected keys | Exactly one per viewport |
| **The grease pencil** | Decision borders, hostile markers, urgency | Never used for decoration |

### 2.3 Period references

Colour and mark-making reference:

- GSGS 1:100,000 trench maps (1915–1918): buff paper, blue-green water,
  red-brown enemy overprint, hairline grid.
- Ordnance Survey one-inch sheets: restrained land wash, black names, sparse
  spot heights.
- Baedeker city plans: dense but orderly naming, boxed keys, fold-out plates.
- Railway timetables and mobilization orders: ruled ledgers, tabular figures.
- Letterpress playbills and regimental stationery: heavy display serif,
  hairline rules, corner ticks, small folio numbers.

### 2.4 What this is not

- Not steampunk: no gears, rivets, brass pipes, leather straps.
- Not fantasy: no filigree, scrollwork, drop-cap ornament, heraldic excess.
- Not skeuomorphic photography: no leather or wood photographs as surfaces.
- Not a sepia filter: paper stays paper; dark stays dark; colour is purposeful.
- Not "museum UI": no faux aging, torn edges, stains, or random rotation.
- Not a component library showcase: no pill buttons, large radii, floating
  cards, glows, or glassmorphism.

---

## 3. Design principles

1. **Paper is content; dark is chrome.** Reading happens on paper. Operating
   happens on the table. A surface MUST be one or the other, never both.
2. **Brass is command, not decoration.** Exactly one brass-filled primary
   action is visible per viewport. Brass keylines and markers are allowed on
   selected/current elements only.
3. **Red overprint is information.** It means "a decision is owed" or
   "hostile/danger". It MUST NOT be used for generic emphasis, hover, or brand.
4. **Print is flat.** Depth comes from keylines, rules and one shadow step.
   No bevels, gloss, inner highlight stacks or gradients that simulate metal.
5. **Ornament is painted inside the box.** Corner ticks, registration marks,
   folios and vignettes are pseudo-elements or absolutely positioned overlays.
   They MUST NOT add layout height or reduce a scroll region.
6. **Motion is mechanical.** Press, slide, settle. No bounce, overshoot,
   parallax or ambient animation.
7. **Both languages get the same hierarchy.** A Chinese panel title is not
   smaller, lighter or less prominent than its English counterpart.

---

## 4. Colour system

### 4.1 Surface architecture

| Family | Token | Hex | Role |
|---|---|---|---|
| Table | `--ie-table` | `#1B1712` | Shell ground |
| Table | `--ie-table-2` | `#211B15` | Vignette midpoint |
| Table | `--ie-panel` | `#241E17` | Panel chrome |
| Table | `--ie-panel-2` | `#2C251C` | Raised plate / row |
| Table | `--ie-panel-3` | `#342C21` | Hover plate |
| Table | `--ie-rule` | `#4A3A26` | Decorative hairline (non-text) |
| Table | `--ie-rule-strong` | `#857050` | Interactive boundary (3.48:1 on panel) |
| Table | `--ie-on-dark` | `#F0E6D2` | Primary text on dark |
| Table | `--ie-on-dark-2` | `#CDBB9A` | Secondary text on dark |
| Table | `--ie-on-dark-muted` | `#A89678` | Meta text on dark |
| Paper | `--ie-paper` | `#F2E9D8` | Atlas sheet, card face |
| Paper | `--ie-paper-2` | `#E7D9BF` | Secondary paper, print mat |
| Paper | `--ie-paper-3` | `#DCCBA9` | Paper inset / track fill |
| Paper | `--ie-paper-rule` | `#8A7350` | Rule on paper (non-text, 3.75:1) |
| Paper | `--ie-ink` | `#241C14` | Text on paper |
| Paper | `--ie-ink-2` | `#4D3E2C` | Secondary text on paper |
| Paper | `--ie-ink-muted` | `#6F5C43` | Meta text on paper |
| Accent | `--ie-brass` | `#C2A05A` | Primary action fill; accent border on dark |
| Accent | `--ie-brass-soft` | `#E8CE93` | Accent text/keyline on dark |
| Accent | `--ie-brass-deep` | `#8A6E46` | Brass keyline on dark (3.46:1) |
| Accent | `--ie-brass-ink` | `#6E531B` | Brass text/keyline on paper |
| Overprint | `--ie-overprint` | `#A33A28` | Red overprint on paper |
| Overprint | `--ie-overprint-border-dark` | `#C0492F` | Overprint boundary on dark (3.33:1) |
| Overprint | `--ie-overprint-text-dark` | `#E08B72` | Overprint text on dark |
| Focus | `--ie-focus-dark` | `#F4D574` | Focus ring on dark |
| Focus | `--ie-focus-paper` | `#6E531B` | Focus ring on paper |
| Map | `--ie-move-ink` | `#2F5D7C` | Legal-move ring on the atlas paper (D-21) |
| Map | `--ie-move-ink-on-dark` | `#8FB4D4` | Legal-move ring in the dark map key (D-22) |

**D-02:** The map is the only large paper field. The right column, hand and mat
stay dark chrome with paper documents inside them.

### 4.2 Status colours

Status fills are never used as text. Each semantic has three tokens:

| Semantic | Fill | Text on dark | Text on paper |
|---|---|---|---|
| ok | `--ie-ok: #6F9D5A` | `--ie-ok-text-dark: #A6D28D` | `--ie-ok-text-paper: #3F6B2E` |
| warn | `--ie-warn: #C87830` | `--ie-warn-text-dark: #E9A45C` | `--ie-warn-text-paper: #8A4A12` |
| danger | `--ie-danger: #A3432F` | `--ie-danger-text-dark: #E28A78` | `--ie-danger-text-paper: #8F2F1F` |

`--ie-ok-text-paper` is only used on `--ie-paper` (5.19:1). On `--ie-paper-2`
it measures 4.49 and MUST NOT be used for text; use `--ie-ink-2` there.

### 4.3 Power colours

The nine fills MUST remain byte-identical to `POWER_DEFS` and the legend, so
the map, chips, pips and printed references cannot drift.

| Power | Fill | Text on dark | Text on paper | Label on fill | Allowed label |
|---|---|---|---|---|---|
| GE | `#4A4A4A` | `#E3E3DE` (12.81) | `#3B3B38` (9.32) | `#F4EFE2` (7.72) | cream |
| UK | `#A12B2B` | `#F0A9A0` (8.55) | `#8E2222` (7.25) | `#F4EFE2` (6.32) | cream |
| FR | `#245A94` | `#9BBCE3` (8.40) | `#1E4E80` (7.09) | `#F4EFE2` (6.17) | cream |
| AU | `#C9A227` | `#EBCB6E` (10.45) | `#7A5E0F` (5.07) | `#241C14` (6.94) | ink |
| RU | `#E8E4D8` | `#F2EEE2` (14.22) | `#6B6452` (4.88) | `#241C14` (13.20) | ink, 1 px `#8A8170` edge |
| OT | `#2F7A45` | `#8CCB9C` (8.75) | `#24643A` (5.89) | `#F4EFE2` (4.58) | cream (minimum) |
| Neutral | `#7B5AA6` | `#C0A9DE` (7.83) | `#624588` (6.39) | `#F4EFE2` (4.74) | cream (minimum) |
| IT | `#3F7F8F` | `#96C8D2` (9.02) | `#2F6672` (5.34) | — (3.94, fails) | paper label only |
| US | `#5B6FA8` | `#AFC0E4` (9.02) | `#465A8C` (5.62) | — (4.27, fails) | paper label only |

**D-08 / D-09 rules:**

- The nine fills are data, not UI colours. They are used for map counters,
  pips, flags, and large prevents.
- Small text is **never** placed directly on a power fill. IT and US carry a
  paper label beside the fill, not on it. Neutral is allowed only at the
  4.74 minimum and SHOULD use a paper label where space permits.
- Power chips and badges on dark use a transparent fill, `--ie-rule-strong`
  boundary and the on-dark power text. On paper they use a paper fill, a
  1 px ink keyline and the on-paper power text.
- A power hue MUST NOT serve as a control boundary on dark: several are below
  3:1 against the table (UK 1.46, FR 1.55, OT/Neutral 1.81, IT 2.05, US 1.96).
- Unit counters on the map use a cream edge, the power fill, a 1 px ink
  keyline and the flag. RU adds a visible `#8A8170` edge so it does not vanish
  into the paper.

### 4.4 Urgency encoding

| State | MUST encode as | MUST NOT rely on |
|---|---|---|
| Your decision | Overprint border + seal icon + label | Red alone |
| Another seat's decision | Neutral plate + seat name | Red |
| War / Great War | Crossed-sabres icon + overprint label | Red alone |
| Legal move target | Blue-ink ring + dash pattern + tick | Colour alone |
| Legal attack target | Overprint ring + dash pattern + tick | Colour alone |
| Legal rail target | `--ie-brass-soft` ring + dash + tick | Colour alone |
| Choice target | Ink ring + dash + tick | Colour alone |
| Selection | 2 px `--ie-brass-soft` ring + four corner ticks | Glow |
| Success / info | Status text variant | Status fill as text |

The map key (`components/MapLegend.tsx`) repeats this vocabulary as one swatch
per style: `move` `--ie-move-ink-on-dark`, `attack` `--ie-overprint-text-dark`,
`rail` `--ie-brass-soft`, `choice` `--ie-ok-text-dark`, `pending`
`--ie-warn-text-dark`.  Every style gets its own swatch; two entries must never
share a colour, or the key promises a distinction the map does not draw.

### 4.5 Contrast rules

- Body text and all UI text at 12–17 px: **≥ 4.5:1** against its surface.
- Large text (≥ 24 px, or ≥ 18.5 px bold), control boundaries and focus
  indicators: **≥ 3:1**.
- Decorative hairlines (`--ie-rule`) are exempt from a ratio because they
  carry no information and are always paired with a stronger cue.
- Text over texture MUST be measured against the texture's darkest local
  value, not the flat base colour.
- Disabled controls MAY fall below 4.5 only when `disabled`/`aria-disabled`
  is present and the control is also distinguishable by opacity and cursor.

Prohibited pairs:

- `--ie-brass` as text on paper (2.06:1). Use `--ie-brass-ink` (5.97:1).
- `--ie-on-dark` on `--ie-brass` (2.00:1). Brass fills use ink text
  (6.77:1).
- `--ie-ink-muted` on `--ie-paper-3` (4.00:1) or on `--ie-paper-2` (4.59:1 is
  below the 4.5 floor for safety).
- Any power fill behind small text.

---

## 5. Typography

### 5.1 Decision: self-host Latin, use system CJK

**D-05:** Ship two open-licence Latin families, self-hosted. Do **not** ship a
CJK webfont in this phase.

| Family | Role | Weights | Licence | Budget |
|---|---|---|---|---|
| EB Garamond | Display, card titles, folios, numerals ≥ 15 px | 400, 600 | OFL 1.1 | ≤ 70 KB woff2 |
| Libre Franklin | UI, dense text, data, labels | 400, 600 | OFL 1.1 | ≤ 70 KB woff2 |

Total font budget: **≤ 140 KB woff2**, `font-display: swap`, exactly one
preloaded file (Libre Franklin 400). Files live under
`public/imperial-elegy/fonts/`; a `LICENSE` and checksums are recorded beside
them.

Why no CJK webfont: a single full Noto Sans SC weight is roughly 8–10 MB; a
GB2312 subset is about 3.5 MB; even a game-corpus subset is typically
0.8–2 MB per weight. That is 10–20× the entire Latin budget and larger than
many phone first loads. The game already ships 14 MB of opt-in card scans;
adding megabytes of CJK by default is the wrong trade.

**Revisit trigger:** a CJK webfont MAY be reconsidered only when a subset can
be delivered under 300 KB per weight and measured cross-platform parity is
demonstrated on macOS and Windows.

### 5.2 Stacks

```css
--ie-font-display: "EB Garamond", Georgia, "Songti SC", "STSong",
                   "Noto Serif CJK SC", "Source Han Serif SC", "SimSun", serif;
--ie-font-ui:      "Libre Franklin", system-ui, -apple-system, "Segoe UI",
                   "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
                   "Noto Sans CJK SC", sans-serif;
--ie-font-data:    var(--ie-font-ui);
```

- Display serif is for titles, card display text, panel headings at ≥ 15 px,
  and large numerals. It is never used for UI labels, buttons, tables or body
  copy below 15 px.
- UI sans carries every dense string, including Chinese.
- `--ie-font-data` exists so tabular numerals and IDs can converge on the UI
  family without a second decision.

### 5.3 Ramp

| Token | Size / line (Latin) | Size / line (CJK) | Weight | Use |
|---|---|---|---|---|
| `--ie-font-xs` | 12 / 16 | 12 / 18 | 500 | Badges, meta, legends, tabs, table labels |
| `--ie-font-sm` | 13 / 18 | 13 / 20 | 400–500 | Buttons, fields, hand names, panel body |
| `--ie-font-md` | 14 / 20 | 14 / 22 | 400 | Rules text, log, card translation |
| `--ie-font-lg` | 18 / 24 | 18 / 26 | 600 | Panel titles, inspector h2, mat figures |
| `--ie-font-xl` | 24 / 28 | 24 / 30 | 600 | CP readout, turn, page title |
| `--ie-font-2xl` | 30 / 34 | 30 / 36 | 600 | Empty state / splash only |

The existing `--ie-font-*` names are kept (D-17); only the values change:
`md 15 → 14`, `lg 20 → 18`, `xl 26 → 24`. `--ie-font-2xl` is new.

**D-07:** 12 px is the absolute floor. The single documented exception is the
rule-reference superscript, raised from 8 px to 10 px and marked with a dotted
underline (`.ie-rule-ref`, already excluded by the e2e text audit).

Numerals: every figure a player compares MUST use
`font-variant-numeric: tabular-nums lining-nums` — CP, VP, WTT, turn, decade,
stability, manpower, industry, keys, reserves, die rolls.

### 5.4 Bilingual rules

- Latin micro-labels MAY be uppercase with `letter-spacing: .08em`.
- Chinese MUST NOT be uppercased and MUST NOT be letter-spaced beyond `.02em`.
- `data-locale="en|zh_CN"` is set on `.ie-surface`; CJK line-heights in the
  ramp are applied from it, not by duplicating every rule.
- Truncation: Latin truncates at word boundaries with an ellipsis; CJK may
  break anywhere, but never inside a number-plus-unit pair (`3 CP`, `第 12 回合`).
- Mixed strings must be tested at every ramp size:
  `Turn 12 · 第十二回合 · Berlin 柏林 · 1914–1918 · 3 CP / 3 指挥点`.
- Serif display and sans UI must not be mixed inside one label except where the
  label is a quoted card title.

### 5.5 Artwork exceptions

- `CardFace.tsx` is generated SVG artwork. It keeps its 300-unit geometry,
  18/25 body size and Georgia/SimSun fallback. It MUST NOT depend on a webfont,
  and it is exempt from the DOM 12 px audit.
- `PrintedBoard.tsx` MUST NOT reference a webfont. Its test asserts the sheet
  has no external font dependency. This is a documented exception, not drift.
- Map nameplates are SVG artwork with their own minimum size (see §10.10).

---

## 6. Material, texture, ornament and elevation

### 6.1 Layer recipes

| Layer | Recipe |
|---|---|
| Table ground | `--ie-table`; radial vignette to `--ie-table-2` at 30% 0%; one 96×96 grain tile at 3–5% opacity |
| Paper | `#F2E9D8`; grain tile at 4–6% multiply; optional chain lines at 28 px / 3% opacity only on large documents |
| Plate | `linear-gradient(180deg, #2C251C, #241E17)`; `inset 0 1px 0 rgba(255,244,220,.06)`; 1 px `#3A3025`; shadow `0 1px 2px rgba(9,7,4,.45)` |

**D-19:** Texture is allowed only on non-text surfaces. Text-bearing paper
(panel bodies, card bodies, hand rows, log lines, form fields) stays flat. If a
texture is used behind text anywhere, the contrast must be re-measured against
its darkest local value.

### 6.2 Rules and ornament

- Double rule: 1 px `--ie-rule-strong`, 8 px gap, 1 px `#3A3025`.
- A single brass hairline is reserved for the active or selected element.
- Corner ticks (8 px L-shapes) on dialogs, paper sheets and the dock's active
  tab only.
- Registration cross in panel headers, at 40% opacity, 6 px.
- Folio line (small number + rule) in drawers and the printed sheet.
- All ornament is a `::before`/`::after` or absolutely positioned element.
  It MUST NOT participate in layout height.

### 6.3 Elevation

Only three shadows exist:

```css
--ie-shadow-1: 0 1px 2px rgba(9, 7, 4, .45);
--ie-shadow-2: 0 6px 18px rgba(9, 7, 4, .42);
--ie-shadow-3: 0 14px 40px rgba(9, 7, 4, .55);
```

No blur above 40 px, no `backdrop-filter`, no animated `box-shadow`, no glow,
no multi-layer emboss.

### 6.4 Radii

`--ie-radius-sm: 2px`, `--ie-radius-md: 3px`, `--ie-radius-lg: 6px`.

Pills disappear except for circular pips and unit counters. Printed matter has
crisp corners. The existing `999px` badge radius is reduced to `2px`.

### 6.5 Forbidden

- Texture inside a scroll container's text area.
- Texture over map nameplates or card text.
- Gold gradients, metallic sheen, glow.
- Bevel stacks (`inset` highlight + `outset` shadow + gradient on one control).
- Torn paper, stains, rotation, faux aging.

---

## 7. Iconography

**D-12:** One inline SVG set, defined in `src/imperialElegy/components/Icon.tsx`
(implementation phase). No icon library and no `@mui/icons-material`.

### 7.1 Grid and rendering

- 16×16 viewBox, 1.5 px stroke, square caps, miter joins, `fill: none`,
  `stroke: currentColor`.
- Rendered sizes: 14, 16, 20, 24 px. A 44 px hit area wraps small icons on
  phone.
- Every icon is `aria-hidden="true" focusable="false"` unless it is the only
  accessible name of a control; in that case the button carries an
  `aria-label` and the icon stays hidden.
- Icons never carry information that text does not also carry.

### 7.2 Inventory

`chevron-down`, `chevron-up`, `chevron-left`, `chevron-right`, `close`, `menu`,
`check`, `plus`, `minus`, `search`, `book-reference`, `chart`, `printer`,
`download`, `crosshair`, `anchor`, `crossed-sabres`, `seal-decision`, `star`,
`laurel-goal`, `fort`, `trench`, `rail`, `arrow-right`, `bot`, `lock`,
`warning-triangle`, `info-circle`.

### 7.3 Replacement map

| Current glyph | Context | Replacement |
|---|---|---|
| U+1F916 🤖 | Bot seat | `bot` icon + retained visible "BOT" / localized text |
| U+2694 ⚔ | War badge / War tab | `crossed-sabres` |
| U+2715 ✕ | Close buttons, toast dismiss | `close` |
| U+2316 ⌖ | Centre on selected space | `crosshair` |
| U+2605 ★ | Capital marker | `star` (map art may keep the SVG star) |
| U+25B8 / U+25BE ▸ ▾ | Folds and displays | `chevron-right` / `chevron-down` |
| U+25C9 ◉ | Current step | `seal-decision` or a brass lozenge |
| U+2693 ⚓ | Naval plate | `anchor` |
| U+2713 ✓ | Confirm / selected | `check` |
| U+2733 ✳ | Goal | `laurel-goal` |

Typographic symbols inside printed reference tables (`★`, `★★`, `·`) are
content semantics and are retained.

Flags and unit counters are **data**, not icons: they remain SVG in
`printedStyle.tsx` and `UnitToken.tsx`. The 312 counter PNGs remain unused.

---

## 8. Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| `--ie-motion-press` | 100 ms | `linear` | Button press offset, row hover |
| `--ie-motion-pop` | 160 ms | `cubic-bezier(.2,.8,.3,1)` | Popover, intent chooser, toast |
| `--ie-motion-sheet` | 180 ms | `cubic-bezier(.2,.8,.3,1)` | Drawer, mobile dock |

Rules:

- Animate only `transform` and `opacity`. Never animate layout properties,
  `box-shadow`, `filter` or colours across large areas.
- The decision pulse is a 1.6 s opacity cycle on a 2 px rule, not a glow, and
  is disabled entirely under `prefers-reduced-motion`.
- Card hover lift is at most 2 px and 0% scale (the current 4 px / 1.04 is
  reduced); under reduced motion it is removed.
- No motion may be the only carrier of a state change.

---

## 9. Layout and density contract

### 9.1 Desktop ledger at 1440×900

The app bar is 48 px; the board shell is **852 px** (900 − 48).

```
+-------------------------------------------------------------------+
| seat strip                                              40 px     |
+-------------------------------------------------------------------+
| track strip                                             52 px     |
+--------+-------------------------------------+--------------------+
| mat    | map                                 | turn panel         |
| 148 px | (flex, min 0)                       | 348 px             |
|        |                                     | (spans both rows)  |
|        +-------------------------------------+                    |
| hand (max 212 px, spans mat + map)                                |
+--------+-------------------------------------+--------------------+
```

- `.ie-table`: `grid-template-columns: 148px minmax(0,1fr) 348px`;
  `grid-template-rows: minmax(0,1fr) minmax(212px,auto)`;
  areas `"mat map turn" / "hand hand turn"`.
- Row gap 4 px, column gap 8 px, all `border-box`.
- Below 1100 px the columns become `132px / 1fr / 300px`; behaviour is
  unchanged.
- The hand tray is ≤ 212 px open and 44 px folded.
- The turn panel is a permanent column, not a floating overlay.

**D-14:** No new row, bar, header or footer may be added inside the shell. A
new control lives in an existing row, an overlay, or a drawer.

### 9.2 Phone ledger at 390×844

```
+-----------------------------+
| track strip            44px |
+-----------------------------+
| map                   flex  |
|                             |
+-----------------------------+
| dock (one bottom sheet)     |
|   closed          44 px     |
|   decision peek   56 px     |
|   half          40 dvh      |
|   full   calc(100dvh-140px) |
|   decision cap  50 dvh      |
+-----------------------------+
```

- The map is the only flex child above the dock that grows.
- The strip carries a **step chip** in place of the four-button stepper: the
  current step name, the acting power's code and its pip, opening that step's
  reference. It sits in the band the stepper cannot use at this width and is
  hidden from 768 px up.
- The **framing bar** is 44 px tall on a phone (the chips keep their 28 px look
  with a 44 px hit area). Below 460 px the three atlas-sheet chips step aside —
  their sheets are three options away in the theatre select — so the theatre
  select is on screen rather than 79 px past the right edge. The find control is
  an icon chip in that bar, and its picker is an overlay under it.
- The **seat strip** draws the power code and the state dot only; the P-number,
  the printed name and the state word stay in the button's accessible name.
- The dock remains `data-open` / `data-expanded` / `data-tab` /
  `data-decision` driven. Its heights are frozen (D-15).
- Short phones (≤ 699 px tall) keep their existing 44 dvh / `calc(100dvh-120px)`
  / 46 dvh decision values.
- The map region MUST keep more than 55% of the layout height at 390×844.

### 9.3 Line-height per region

Typography changes MUST NOT increase a fixed row height. Fixed line boxes:

| Region | Line-height |
|---|---|
| Track strip | 16 px |
| Seat strip tabs | 16 px |
| Hand row | 18 px |
| Panel head | 20 px |
| Dock tab bar | 16 px |

CJK line-heights apply only inside scrollable bodies and paper documents, never
inside a fixed-height bar.

### 9.4 Scroll ownership

Only these surfaces scroll:

- The hand card row (`.ie-tray-scroll`), horizontally/vertically inside itself.
- Turn-panel bodies (`.ie-turn-body`).
- The player mat body (`.ie-mat-grid`).
- Drawer and lightbox bodies.
- The phone dock body.

The document itself does not scroll at 1440×900. The existing
`max-height: 699px` desktop escape hatch is retained; do not remove it in the
name of the no-scroll rule.

### 9.5 Density rules

- Desktop controls: 32–36 px; primary buttons 36 px.
- Phone/coarse pointer: 44×44 px hit area, visual size may remain 36 px via
  `::before { inset: -4px }`. Adjacent targets keep 4 px separation. Verify
  with `document.elementFromPoint` that the expansion does not steal clicks.
- Panel padding: 12 px. Card/row separators: 1 px, no per-row outer border.
- Every panel title truncates with an ellipsis rather than wrapping on desktop.

---

## 10. Component specifications

Each component states: anatomy, dimensions, tokens, states, desktop vs phone,
content limits, and the rule that its test ids do not change.

State matrix applies to every interactive component: `rest`, `hover`, `active`,
`selected`, `focus-visible`, `disabled`, `error`. A component MUST have a
visible focus-visible treatment and MUST NOT signal state by colour alone.

**Consolidated state matrix** (P = `--ie-panel`, P2 = `--ie-panel-2`,
P3 = `--ie-panel-3`, R = `--ie-rule-strong`, B = `--ie-brass`,
BS = `--ie-brass-soft`, O = `--ie-overprint`):

| Component | rest | hover | active / pressed | selected / current | focus-visible | disabled | error |
|---|---|---|---|---|---|---|---|
| Seat tab | P, 1 px `--ie-rule` | P2 | P3 | B keyline + 2 px bottom rule | 2 px `--ie-focus-dark` | 45%, `aria-disabled` | — |
| Track step | transparent, 12 px label | P2 | P3 | `B` lozenge, ink text | focus ring | 45% | — |
| Panel tab | transparent, on-dark-2 | P2 | P3 | paper index tab, ink text | focus ring | 45% | — |
| Button secondary | P2, text on-dark, border R | P3 | translateY(1px) | B keyline | focus ring | 45% | — |
| Button primary | B, ink text | lighten 4% via filter? **no** — use `BS` border | translateY(1px) | — | focus ring | 45% | — |
| Chip / badge | transparent, border R, power text | P2 | P3 | BS underline | focus ring | 45% | — |
| Hand row | transparent, 1 px separator | P3 | P2 | 2 px BS left rule | focus ring | 45% + reason | reason in danger text |
| Card face | paper | 2 px translate | — | 2 px BS ring | 2 px focus ring | — | — |
| Map target ring | ring per §4.4 | opacity 1.0 | commit on click | BS ring + corner ticks | brighter ring + `聚焦目标` | no ring drawn | O ring for attack |
| Mat track box | P3, ink text | P2 | — | B lozenge, ink text | focus ring | 45% | — |
| Form field | P, border R | border `--ie-brass-deep` | — | — | focus ring | 45% | O border + danger text |
| Dock tab | transparent, on-dark-2 | P2 | P3 | BS + 2 px top rule | focus ring | 45% | badge only |
| Toast | paper slip, 3 px O left rule | pause timer | — | — | focus close | — | danger text |

Primary buttons never lighten on hover by filter or opacity; the hover cue is
the `--ie-brass-soft` keyline and a 1 px lift, so contrast is stable.

### 10.1 Shell

- `.ie-surface`: table ground + vignette + grain; padding 6 px vertical,
  12 px horizontal; `color: --ie-on-dark`; `data-locale` set here.
- `.ie-board`: 852 px at 1440×900; two rows (`auto` strip, `1fr` table).
- No extra height. Focus ring is `outline: 2px solid var(--ie-focus-dark)`
  with `outline-offset: 2px`.

### 10.2 Seat strip

- 40 px. Plate tabs, 2 px radius, 13 px/600.
- Active: brass keyline + dark plate + 2 px bottom rule.
- State dot 8 px: ok/ink, bot gear, eliminated struck + 55% opacity.
- Roving tab stop; only the selected seat is `tabIndex=0`.
- Desktop: six tabs, `P1 · GE Germany ● Acting`.
- Phone: six tabs of power code + state dot, all six in the row. The P-number,
  the name and the state word are visually hidden (`clip-path`, not
  `display: none`) so the tab's accessible name stays complete. The hit area is
  the row's own 40 px: a 44 px target would not fit a frozen 40 px row.

### 10.3 Track strip

- Exactly 52 px desktop, 44 px phone; one line, never wraps.
- Decade = folio plate; turn/step = brass lozenge for the current step, not a
  glow.
- CP readout: one visible node at every viewport. 24 px tabular numeral.
- WTT: five stamped 10 px squares; the third is overprint. Pips carry
  `aria-label` with the numeric value.
- Alliance boxes: five ruled cells, 12 px labels.
- Menu and reference buttons: 28 px desktop / 44 px hit phone.
- Phone replaces the stepper with one step chip (see §9.2); the row never wraps.

### 10.4 Panel

- Dark chrome, 1 px `--ie-rule` + 1 px brass hairline on the top edge only.
- Head 36 px; title 18 px display serif; caret 28 px desktop, 44 px hit phone.
- Body 12 px padding, flat (no texture) when it contains text.
- Folded hint remains visible at 12 px.
- `aria-expanded` and existing test ids preserved.

### 10.5 Tabs

- Selected tab = paper index tab: `--ie-paper`, ink text, no bottom rule.
- Unselected: transparent, `--ie-on-dark-2`.
- 40 px desktop; 44 px hit phone.
- MUI theme (`MuiTab`, `MuiTabs`) is aligned to these values so any MUI
  control that appears elsewhere in the page matches.

### 10.6 Buttons

| Variant | Fill | Text | Border | Use |
|---|---|---|---|---|
| Primary (brass) | `--ie-brass` | `--ie-ink` | `--ie-brass-deep` | Exactly one per viewport |
| Secondary | `--ie-panel-2` | `--ie-on-dark` | `--ie-rule-strong` | Most controls |
| Quiet | transparent | `--ie-on-dark-2` | none | Inline row actions |
| Danger | `--ie-overprint` | `--ie-paper` | `--ie-overprint-border-dark` | Destructive decisions |
| Disabled | 45% opacity | — | — | With `disabled`/`aria-disabled` |

- Sizes: 26 px compact, 32 px default, 36 px primary, 44 px phone hit.
- Pressed: `translateY(1px)`; no shadow change.
- Armed confirmation state: 2 px overprint left rule + label swap; focus stays.

### 10.7 Badges, chips, pips

- Badge: 18 px tall, 2 px radius, 12 px/600, uppercase Latin only.
- Power chip on dark: transparent fill, `--ie-rule-strong` border, on-dark
  power text. On paper: paper fill, ink keyline, on-paper power text.
- Pips: 10 px, 1 px ink edge, never text-sized.
- Selected view chip: brass underline, not a filled pill.

### 10.8 Hand rows

- A ledger row, not a card tile. 34 px desktop, 40 px phone.
- CP stamp 22 px on the left, 13 px/600 card name, one line.
- Disabled reason line: 12 px, `--ie-on-dark-muted`, always visible.
- Expanded/selected row: 2 px brass left rule, no outer border.
- Row separators 1 px; the whole row is the click target for the inspector.
- Card faces stay SVG by default; printed scans remain opt-in.

### 10.9 Card face, print face, inspector

- Generated face keeps its geometry; paper ground, ink text, 1 px inner
  keyline, folio numerals. CP numeral display serif.
- Print face: `--ie-paper-2` mat, 1 px rule, 12 px caption.
- Inspector: 440 px drawer on desktop, full width on phone; dark chrome, paper
  card face, 2 px brass top rule, folio. Actions in two columns, 36 px.
- One language per view: the body shows the vector face or the printed scan,
  never both. The **英文原图 / 中文卡面** toggle is one full-width, 36 px secondary
  button under the actions; the scan is fetched only while it is shown.
- The header is sticky (panel-coloured, hairline rule below) so the title and
  the close control never scroll away behind a tall scan. Close button 36 px
  desktop / 44 px phone, brass fill with ink glyph. Focus trap and Esc unchanged.

### 10.10 Map

- Paper `#E9DCC0`; sea gradient `#C3D4CF → #8FAEB0`; coast/rule
  `#6E5A3E`; graticule at 10% opacity.
- Flashpoint hatching at no more than 55% of the current contrast.
- Nameplates: paper `#F4EFE2`, ink `#2B241A`, 1 px `#8A7350`; selected plate
  `#E8CE93`; minimum 12 screen px at full detail.
- Counters: cream edge, power fill, 1 px ink keyline, flag; RU gets the
  `#8A8170` edge.
- Target rings: colour + dash + tick, per §4.4. Selection: brass ring + four
  corner ticks.
- Map chrome (framing bar, legend, key, zoom controls) stays dark and inside
  the existing allocated height. Ornament is inset/overlay, never padding.
- The framing bar is one overlay row; its find control lives there too (as an
  icon chip on a phone) and its picker drops under the bar as an overlay. A
  control in the stage's flow is clipped away by the stage — the find control
  was, at every width, until it moved into the bar.
- Phone: the bar is 44 px tall, chips are visually 28 px with a 44 px hit area,
  the native theatre select is 44 px.

### 10.11 Player mat

- 148 px column; dark plate with ledger rules.
- Track box 18 px; current box = brass lozenge with ink text.
- Figures: 12 px muted label over 18 px tabular value.
- Collapsed chip row at ≤ 1099 px keeps its current behaviour.
- Printed-display link keeps its anchor.

### 10.12 Drawers, lightbox, choosers

- Paper body for reading; dark frame; corner ticks; folio.
- Drawer 480 px desktop, full width phone; close 44 px.
- Backdrop opaque dark, no blur.
- Chart lightbox keeps `role="dialog"`, focus trap, Esc, and focus return.

### 10.13 Toast

- Paper slip, 3 px overprint left rule, icon roundel.
- 13 px body / 12 px meta; max width 520 px; bottom offset 96 px desktop,
  104 px phone.
- 160 ms slide + fade; dismiss on Esc, ✕, timeout, hover-pause.

### 10.14 Mobile dock

- 44 px bar with a 2 px brass top rule.
- Tabs 13 px; selected = `--ie-brass-soft` + 2 px top rule.
- Visual controls 36 px with 44 px hit areas.
- Heights frozen per §9.2.
- Decision peek is 56 px and shows the one-line prompt.
- No new tab, no reordering.

### 10.15 Forms

- 32 px desktop, 44 px hit phone.
- Dark inset field, 1 px `--ie-rule-strong`, brass focus ring.
- Native `<select>` is allowed and preferred on phone.
- Labels 12 px above the field; errors 12 px `--ie-danger-text-dark`.

### 10.16 Empty, loading and error states

- Paper slip or quiet plate, never a centred spinner on the map.
- Empty text 12–13 px, `--ie-on-dark-muted`; one action at most.
- Errors use the toast pattern, not a modal, unless the board is unusable.

---

## 11. Token migration

### 11.1 Naming

Keep the `--ie-` prefix. Group by **role**, not hue:

`--ie-table*`, `--ie-panel*`, `--ie-paper*`, `--ie-ink*`, `--ie-brass*`,
`--ie-overprint*`, `--ie-rule*`, `--ie-on-dark*`, `--ie-focus*`,
`--ie-power-*`.

### 11.2 Old → new

| Old | New | Action |
|---|---|---|
| `--ie-surface` | `--ie-paper` | Alias for one release, then remove |
| `--ie-surface-2` | `--ie-paper-2` | Alias, then remove |
| `--ie-frame` | `--ie-table` | Alias, then remove |
| `--ie-frame-2` | `--ie-panel` | Alias, then remove |
| `--ie-line` | `--ie-rule` | Rename |
| `--ie-accent` | `--ie-brass` | Rename |
| `--ie-accent-soft` | `--ie-brass-soft` | Rename |
| `--ie-parchment` | `--ie-paper` | Remove (alias only) |
| `--ie-gold` | `--ie-brass` | Remove after aliases |
| `--ie-dark` | `--ie-table` | Remove after aliases |
| `--ie-panel` (old alias) | `--ie-panel` (new real token) | Remove old alias immediately; it collides |
| `--ie-ink` | kept, value changes `#2A2218 → #241C14` | Recorded explicitly because the name survives |
| `--ie-ok`, `--ie-warn`, `--ie-danger` | kept as fills | Add `-text-dark` / `-text-paper` |
| `--ie-power-ge`, `--ie-power-uk`, `--ie-power-fr`, `--ie-power-au`, `--ie-power-ru`, `--ie-power-ot`, `--ie-power-neutral`, `--ie-power-it`, `--ie-power-us` | kept, byte-identical to `POWER_DEFS` | Add `onDark`, `onPaper`, `onFill`, `edge`; never use the fill as a boundary |
| `--ie-space-1`, `--ie-space-2`, `--ie-space-3`, `--ie-space-4` | kept | Spacing unchanged (4 / 8 / 12 / 20) |
| `--ie-font-xs`, `--ie-font-sm`, `--ie-font-md`, `--ie-font-lg`, `--ie-font-xl` | kept | Values change per §5.3; add `--ie-font-2xl` |
| `--ie-radius-sm`, `--ie-radius-md`, `--ie-radius-lg` | kept | Values change in place; no rename |
| `--ie-radius` (alias of `--ie-radius-md`) | `--ie-radius-md` | Remove after aliases |

**Radius change:** values are reduced in place (`10 → 6`, `6 → 3`, `3 → 2`);
the names stay. Pill radii (`999px`) are removed from non-pip elements.

### 11.3 Single source of truth

**D-10:** Author tokens once in `src/imperialElegy/design/tokens.json`
(implementation phase). Then:

- `ie-theme.ts` imports the JSON and builds the MUI theme; no hex literals.
- `scripts/generate-ie-tokens.mjs` writes
  `src/imperialElegy/components/styles/00-tokens.generated.css`; output is
  committed.
- `npm run ie:tokens:check` regenerates and diffs; CI fails on drift.
- A Jest test parses the generated custom properties and asserts exact parity
  with `tokens.json` and `IE_THEME_TOKENS`, and forbids raw hex in component
  CSS.
- `map.tsx` and `printedStyle.tsx` import the same JSON for fills and edges.

The current hand-maintained mirror in `ie-theme.ts` is the drift risk; a test
alone catches it late. Generation prevents it.

### 11.4 CSS layers

**D-11:** Split mechanically with zero visual change before restyling:

```
styles/00-tokens.generated.css
styles/10-base.css        reset, focus, typography primitives
styles/20-shell.css       board, header, seat strip, track strip, table grid
styles/30-panels.css      panel, tabs, turn panel, player mat
styles/40-cards.css       card, hand, inspector, faces
styles/50-map.css         map stage, controls, legend, overlay, unit token
styles/60-overlays.css    drawer, lightbox, toast, chooser, picker
styles/90-phone.css       all max-width:767px and mobile-dock rules
styles/99-print.css       printed-board-only rules
```

`imperial-elegy.css` becomes an ordered `@import` entry, preserving the single
import site and Jest mocks. Rules:

- Every selector appears once. Phone rules only in `90-phone.css`, loaded last.
- No `!important` outside reduced-motion and forced-colors blocks.
- No element selectors outside `10-base.css`.
- Keep every `ie-*` class and every `data-testid` (D-17).
- Add modifiers and data attributes, never rename.

### 11.5 Alias schedule

- Phase 1: introduce new tokens and aliases.
- Phase 2–6: migrate consumers.
- Phase 7: delete all aliases; `ie:tokens:check` fails if any remain.

---

## 12. Accessibility

- Contrast: see §4.5 and Appendix B (computed, not claimed).
- Focus: `2 px solid --ie-focus-dark` on dark, `--ie-focus-paper` on paper,
  offset 2 px; never removed. The existing `#f4d574` ring is retained as
  `--ie-focus-dark`.
- Hit areas: 44×44 on phone and `pointer: coarse`; 32–36 px desktop.
- Keyboard: every tablist is roving; arrows move and activate; Home/End jump;
  Esc returns focus; modals trap focus and return it to the opener.
- Colour is never the only encoding: target kinds carry dash + tick shape;
  decisions carry border + seal + label.
- Screen readers: icons are hidden; controls carry the localized action name;
  the decision pulse is decorative and has no `aria-live`.
- Reduced motion: all transitions `none !important`; pulse removed; hover lift
  removed.
- Forced colours: the board remains usable; borders and focus use system
  colours.
- Bilingual: both languages run the same hierarchy and the same test corpus.

---

## 13. Performance

| Budget | Limit |
|---|---|
| Fonts (woff2, total) | ≤ 140 KB |
| Texture assets | ≤ 20 KB |
| CSS added for ornament | ≤ 8 KB gzip |
| Concurrent animations | ≤ 3, all transform/opacity |
| Long paint on map pan | < 16 ms per frame at 1440×900 |

Banned: `backdrop-filter`, large `filter: blur()`, animated `box-shadow`,
per-frame JS-driven texture, background photographs as surfaces, and more than
one shadow step on a control.

The map remains vector (`data/map-background.json`), not the 15 MB scan. The 312
counter PNGs stay unused. Printed card scans stay opt-in.

---

## 14. Verification

### 14.1 Contrast

The implementation MUST ship `scripts/check-ie-contrast.mjs`. It reads
`tokens.json`, computes WCAG 2.1 relative luminance, and fails:

- any text pair below 4.5:1;
- any large-text / control-boundary / focus pair below 3.0:1;
- any use of `--ie-brass` as text on paper;
- any status fill used as text.

Appendix B is generated by this script. Values in this document are the
computed output, not estimates.

### 14.2 Token parity

- `npm run ie:tokens:check` — regeneration diff.
- `npx jest src/imperialElegy/components/ieTokens.test.ts` — generated CSS vs
  JSON vs MUI theme; no raw hex in component CSS; no font size below 12 px
  outside `.ie-rule-ref`; no `!important` outside allowed files.

### 14.3 Layout probes (single tests, not full suites)

- `npx playwright test e2e/imperial-elegy-controls.spec.ts -g "1440x900"`
- `npx playwright test e2e/imperial-elegy-mobile.spec.ts -g "map"`

**Known verification defect to fix before using it as a gate:**
`e2e/imperial-elegy-mobile.spec.ts` measures `.ie-layout`, but no component in
the current tree renders that class (it exists only in the stylesheet). Repoint
the assertion to `.ie-board` / `.ie-map-region`, or restore the class.

Suggested `scripts/ie-visual-check.mjs` (one browser, `/localIE`, both
viewports) emits JSON for: document height, tray height, map proportion,
sub-12 px text count, inline-style count, visible CP readout count, and the
bounding boxes of all 44 px targets.

### 14.4 Static audit

A grep/test forbids:

- fixed region heights other than the ledger values;
- font sizes below 12 px outside `.ie-rule-ref`;
- inline `style=` outside SVG;
- `border-radius: 999px` outside pips/counters;
- `backdrop-filter`;
- renamed `data-testid` / `ie-*` classes.

### 14.5 Bilingual rendering

Corpus string, at every ramp size:
`Turn 12 · 第十二回合 · Berlin 柏林 · 1914–1918 · 3 CP / 3 指挥点`.

Both locales at 1440×900 and 390×844. Measure `scrollWidth > clientWidth` on
the track strip, seat tabs, hand row, panel head, dock tabs and badge rows.
Check clipped descenders and CJK line-height collisions.

After load:

```js
document.fonts.check('400 13px "Libre Franklin"'); // true
document.fonts.check('600 18px "EB Garamond"');    // true
```

No CJK element uses uppercase tracking. Tabular numerals align in CP/VP/turn
columns. `PrintedBoard` contains no external font reference.

### 14.6 Screenshot pairs

Capture desktop and phone in `en` and `zh_CN` at rest, hover, selected,
focus-visible and decision states. Store under `docs/qa/ie-visual-<date>/`.
Screenshots are review aids, not pixel gates.

### 14.7 Document self-review

- [ ] Every section has a decision-log entry or cites one.
- [ ] Every component has the full state matrix.
- [ ] Every old `--ie-*` token has a mapping or a deletion note.
- [ ] Every colour pair in Appendix B has a computed ratio.
- [ ] Every constraint names its verification probe.
- [ ] Every non-goal is explicit.
- [ ] Both languages appear in the layout and typography rules.

---

## 15. Migration sequencing

Each phase MUST leave every test id and every measured budget unchanged.

| Phase | Work | Exit criteria |
|---|---|---|
| 0 | Baseline: screenshot matrix, hard-coded value inventory, freeze ids/classes | Inventory reviewed; no source changes |
| 1 | Mechanical CSS split; add `tokens.json`, generator, fonts | Zero visual diff; token parity test passes |
| 2 | Shell: table, seat strip, track strip, panels, tabs, buttons, focus | Desktop probes pass; one-screen holds |
| 3 | Cards: hand rows, card face, print face, inspector | Card tests pass; 12 px floor holds |
| 4 | Map: paper/sea/rules, counters, nameplates, rings, legend | Target/ring tests pass; no map area loss |
| 5 | Phone: dock, peek, half/full, targets, phone type | Mobile probes pass; map > 55% |
| 6 | Icons and motion | No glyph assertions remain; reduced-motion pass |
| 7 | Remove aliases; performance and accessibility audit; update links | `ie:tokens:check` clean; a11y checklist green |

---

## 16. Non-goals

- No gameplay, information-architecture, region-layout or interaction change.
- No new map or card artwork; no use of the 312 counter PNGs or `greatWar.jpg`.
- No CJK webfont in this phase; no theme switch; no light mode.
- No icon-library dependency; inline SVG only.
- No class or test-id renames; no new region rows.
- No print-sheet restyle beyond preventing regressions.
- No animation that carries meaning alone; no blur, parallax or WebGL.
- No removal of the short-window scroll escape hatch.

---

## 17. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation | Early signal |
|---|---|---|---|---|
| Ornate chrome eats map area | Medium | High | Ornament out of flow; ledger frozen; map probe each phase | Map proportion drops |
| Texture harms 12 px legibility | Medium | High | Texture only on non-text surfaces; measure darkest local value | Contrast audit failures |
| Brass on paper fails | High if unmanaged | Medium | Separate fill/ink tokens; script rejects brass text on paper | Contrast script |
| Power fill behind small text fails | Medium | Medium | Paper-label rule; fills only for counters/pips | Review of chips |
| Font budget / CLS | Medium | Medium | `swap`, one preload, 140 KB cap; system-stack fallback | Lighthouse CLS, font payload |
| CJK platform variance | High | Medium | Sans for UI, serif for display, bilingual overflow matrix | Width/line-height probes |
| CSS split regressions | Medium | High | Mechanical split first, zero-diff check, ordered imports | Visual diff |
| Token drift | Medium | High | Generated CSS + check mode + unit test | CI parity failure |
| Icon replacement breaks tests | Low | Low | Only two tests assert literal glyphs; assert names/ids | Unit test failures |
| MUI dark text on paper | Medium | Medium | Scope variables per body; avoid MUI inside paper | Visual review |
| Short desktop windows | Medium | Medium | Keep `max-height:699px` escape hatch | User report |

---

## 18. Appendices

### Appendix A — Token reference

The complete token list is generated into
`src/imperialElegy/components/styles/00-tokens.generated.css` in phase 1. This
document defines the authoritative names; values are those in §4 and §5.

Aliases are removed in phase 7. Any token not listed in §11.2 is unchanged.

### Appendix B — Computed contrast matrix

WCAG 2.1 relative luminance, computed from the hex values in §4. Text targets
are 4.5:1; non-text control/focus targets are 3.0:1.

**Text on dark surfaces**

| Token | on `#1B1712` | on `#241E17` | on `#2C251C` | on `#342C21` |
|---|---|---|---|---|
| `--ie-on-dark` `#F0E6D2` | 14.39 | 13.32 | 12.21 | 11.09 |
| `--ie-on-dark-2` `#CDBB9A` | 9.48 | 8.77 | 8.05 | 7.31 |
| `--ie-on-dark-muted` `#A89678` | 6.20 | 5.73 | 5.26 | 4.78 |
| `--ie-brass-soft` `#E8CE93` | 11.61 | 10.75 | 9.85 | 8.95 |
| `--ie-focus-dark` `#F4D574` | 12.41 | 11.48 | 10.53 | 9.56 |
| `--ie-overprint-text-dark` `#E08B72` | 6.88 | 6.37 | 5.84 | 5.30 |
| `--ie-ok-text-dark` `#A6D28D` | 10.38 | 9.60 | 8.80 | 8.00 |
| `--ie-warn-text-dark` `#E9A45C` | 8.43 | 7.80 | 7.15 | 6.50 |
| `--ie-danger-text-dark` `#E28A78` | 6.91 | 6.39 | 5.86 | 5.33 |
| `--ie-move-ink-on-dark` `#8FB4D4` | 8.19 | 7.58 | 6.95 | 6.31 |
| `--ie-ink` on brass `#C2A05A` | — | — | — | 6.77 |
| `--ie-on-dark` on brass `#C2A05A` | — | — | — | **2.00 (forbidden)** |

**Text on paper surfaces**

| Token | on `#F2E9D8` | on `#E7D9BF` | on `#DCCBA9` |
|---|---|---|---|
| `--ie-ink` `#241C14` | 13.92 | 12.05 | 10.52 |
| `--ie-ink-2` `#4D3E2C` | 8.54 | 7.39 | 6.45 |
| `--ie-ink-muted` `#6F5C43` | 5.30 | 4.59 | **4.00 (not text)** |
| `--ie-brass-ink` `#6E531B` | 5.97 | 5.17 | 4.51 |
| `--ie-focus-paper` `#6E531B` | 5.97 | 5.17 | 4.51 |
| `--ie-overprint` `#A33A28` | 5.46 | 4.72 | **4.12 (not text)** |
| `--ie-ok-text-paper` `#3F6B2E` | 5.19 | **4.49 (not text)** | 3.92 |
| `--ie-warn-text-paper` `#8A4A12` | 5.68 | 4.91 | 4.29 |
| `--ie-danger-text-paper` `#8F2F1F` | 6.72 | 5.81 | 5.07 |

**Power colours** (text variants; fill values are data)

| Power | Fill | on dark panel | on paper | label on fill | Verdict |
|---|---|---|---|---|---|
| GE | `#4A4A4A` | 12.81 | 9.32 | 7.72 | cream label |
| UK | `#A12B2B` | 8.55 | 7.25 | 6.32 | cream label |
| FR | `#245A94` | 8.40 | 7.09 | 6.17 | cream label |
| AU | `#C9A227` | 10.45 | 5.07 | 6.94 | ink label |
| RU | `#E8E4D8` | 14.22 | 4.88 | 13.20 | ink label + edge |
| OT | `#2F7A45` | 8.75 | 5.89 | 4.58 | cream label (minimum) |
| Neutral | `#7B5AA6` | 7.83 | 6.39 | 4.74 | cream label (minimum) |
| IT | `#3F7F8F` | 9.02 | 5.34 | **3.94** | paper label only |
| US | `#5B6FA8` | 9.02 | 5.62 | **4.27** | paper label only |

**Non-text boundaries and indicators**

| Pair | Ratio | Use |
|---|---|---|
| `--ie-rule-strong` `#857050` on panel | 3.48 | Control boundary |
| `--ie-rule-strong` `#857050` on table | 3.76 | Control boundary |
| `--ie-rule-strong` `#857050` on plate | 3.19 | Control boundary |
| `--ie-brass-deep` `#8A6E46` on panel | 3.46 | Brass keyline |
| `--ie-brass` `#C2A05A` on table | 7.19 | Primary fill (non-text) |
| `--ie-overprint-border-dark` `#C0492F` on panel | 3.33 | Decision boundary |
| `--ie-overprint-border-dark` `#C0492F` on table | 3.60 | Decision boundary |
| `--ie-paper` `#F2E9D8` on `--ie-overprint` `#A33A28` | 5.46 | Danger button label |
| `--ie-focus-dark` `#F4D574` on table | 12.41 | Focus ring |
| `--ie-focus-paper` `#6E531B` on paper | 5.97 | Focus ring |
| `--ie-paper-rule` `#8A7350` on paper | 3.75 | Rule on paper |
| `--ie-rule` `#4A3A26` on panel | 2.51 | Decorative only (no 3:1 claim) |

### Appendix C — Icon inventory

See §7.2. Icons are authored at 16×16 with a 1.5 px stroke. Any addition MUST
follow the grid, stroke and `currentColor` rules, and MUST be added to the
inventory in the same change.

### Appendix D — Selector and token map

- Token map: §11.2.
- Class policy: all `ie-*` classes are retained. New appearance is expressed by
  new tokens, `data-*` state, and new modifier classes. Existing selectors are
  never renamed for style.
- Test ids: all retained. A visual change that makes a test id unreachable is a
  bug in the change, not a reason to edit the test.

### Appendix E — Decision log

The table in §1.4 is the index. Each phase adds a row for decisions made during
implementation, including the rejected alternatives and the date. A decision
that contradicts this document MUST update this document in the same pull
request; otherwise the implementation is wrong.
