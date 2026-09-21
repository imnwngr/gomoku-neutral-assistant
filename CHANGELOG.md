# Changelog

## 0.2.0 — Persistent analysis and Neutral Lab UI

### Fixed

- Corrected Gomocup move serialization: alternate X/O and map SELF/OPPONENT relative to the side to move. This removes artificial PASS moves and wrong-side analysis on odd-ply positions.
- Preserved MultiPV metadata on the final best move (depth, selective depth, score and full line).
- Prevented obsolete queued positions from delaying every subsequent request or rendering stale results.
- Undid internally applied engine suggestions before continuing analysis of the same position.

### Added

- Persistent engine/config/position sessions, hash reuse, cached board observation and continuous sliced Analysis mode.
- Live Analyze dashboard: depth, eval, speed, nodes, time, ranked MultiPV table, evaluation chart and position export.
- Fast, Slow, Analysis and Custom thinking modes; handicap, engine model, candidate range and transposition-table controls.
- Pause/resume, a separate persistent analysis window and regression tests against the real packaged WASM engine.
- Cross-platform source/runtime packaging.

### Changed

- New dark Neutral Lab interface with Analyze and Settings tabs.
- Default: Analysis mode, one PV, handicap 0 and 128 MB transposition table.
- Always show ranked board suggestions; removed the rank visibility and competitive-game permission switches.

### Known limitations

- Still single-thread SIMD. Continuous analysis uses bounded repeated searches with retained hash, not multi-thread pondering or an uninterrupted search stack.
- Complete game history cannot be recovered from a midgame DOM snapshot; exports are labeled accordingly.
- Chromium integration / visual QA still needs local verification. No quantified playing-strength claim is made.
