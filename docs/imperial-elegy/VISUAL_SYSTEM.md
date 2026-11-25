# Imperial Elegy — Visual System (superseded)

**Status:** Superseded on 2026-11-25 by [`MINIMAL_UI.md`](MINIMAL_UI.md).
**Revision:** 2.0 — 2026-11-25

Revision 1.1 of this document specified **The Imperial Field Atlas**: a dark
oilcloth shell, a printed atlas sheet, brass instruments, EB Garamond and Libre
Franklin, textures and ornament. That direction was replaced wholesale by the
minimal "One Sheet" language:

- one paper ground (`#F4F2EC`), white panels and hairlines instead of a dark
  table with gradients and grain;
- one ink-blue accent (`#1F5A78`) instead of brass;
- one platform sans instead of two self-hosted webfonts;
- one 44 px status row, a full-width map, an orders drawer and a folded card
  strip instead of a seat row, a track row, a mat column and a permanent panel.

Colour, typography, surfaces, structure, interaction and the verification
method now live in [`MINIMAL_UI.md`](MINIMAL_UI.md). Behaviour and the rules
contract are unchanged and remain in [`README.md`](README.md) and
[`UI_CHECKLIST.md`](UI_CHECKLIST.md); the region diagram in `README.md` is the
authoritative layout.

The migration tables in revision 1.1 (§11.2 token map, §15 phase sequencing,
§14 probes) are obsolete: the token names survived, their values and meaning
did not. `yarn ie:tokens:check` and `yarn ie:contrast` remain the gates, and
both read `src/imperialElegy/design/tokens.json`.
