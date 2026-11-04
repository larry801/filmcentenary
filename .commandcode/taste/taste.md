# Taste

- When fixing confirmed rule deviations, prefers implementing all of them (not only high-impact ones), adding interactive choice stages for rules that require player decisions, and adding one regression test per fix. Confidence: 0.9
- State shape: add only optional fields to `VQGame` / `PowerState` so existing tests and saved boardgame.io states keep loading. Confidence: 0.9
- Reuse existing helpers (recordNavalLoss, retreatLand, retreatNaval, endForeignWar, displaceNonFriendlyUnits, canControlSpace, etc.) rather than duplicating logic; interactive choice stages follow the existing `pending*` patterns and must be redact-safe (hidden choices must not leak into the log). Confidence: 0.9