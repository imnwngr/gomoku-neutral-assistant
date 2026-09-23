# Neutral Nexus â€” Gomoku Neutral Assistant

Read-only, locally computed Rapfi analysis for supported 19Ã—19 Gomoku boards with three permanent Neutral cells. Version 0.2.0 fixes position serialization, introduces persistent analysis sessions and adds a modern bilingual Analyze / Settings interface. It never clicks, submits a move or opens a game-server socket.

## Website compatibility

The analysis engine and UI are website-independent. Board recognition is provided by site adapters, because every Gomoku website uses different HTML, board coordinates and update events.

The packaged extension works only on hosts and adapters declared in `manifest.json`. Supporting another website requires a dedicated adapter, its host permission and regression tests. This project does not claim automatic compatibility with every Gomoku website.

## Install / upgrade

1. Back up your current checkout or create a branch (`git switch -c feature/analysis-v020`).
2. Extract the **source** ZIP into the repository folder (the one containing `manifest.json`). Do not replace or delete your existing `.git` directory. The **runtime** ZIP is for installation only.
3. Open `chrome://extensions`, enable Developer mode and load this directory, or click Reload on the existing unpacked extension. If the old extension was loaded from `dist`, load the updated root instead; old `dist` is not updated automatically.
4. Reload the supported Gomoku match page. Extension reloads do not replace content scripts already injected into open tabs.
5. Click the extension icon. Use the upper-right arrow to open a persistent analysis window that stays visible beside the board.

Node.js is only needed for development tests / packaging, not to run the extension.

## What changed

- **Correct Gomocup position serialization.** Version 0.1 grouped all X stones before all O stones. Rapfi interprets a sequence, inserting PASS moves between repeated colors. On odd-ply positions this could leave the engine analyzing Black when White was actually to move. Version 0.2 alternates colors, maps SELF/OPPONENT relative to the side to move, and preserves observed history.
- Persistent WASM instance and model; `START` only for a new/reset game; hash/model/range configuration only when relevant settings change.
- Cached DOM cell records. Mutation batches update affected cells. Some websites redraw the entire board after a move, so reconciliation may still inspect all 361 cells, but unchanged positions do not trigger searches.
- Live depth, selective depth, evaluation, nodes, speed, elapsed time and complete ranked MultiPV lines.
- Only the latest requested board is pending. Results for superseded boards never get painted on the current board.
- Board markers are always ranked: star = best, 2/3/etc. = alternatives. These are alternative first moves, not successive moves in one line.
- Fast / Slow / Analysis / Custom modes; handicap, three bundled models, candidate range, 32â€“256 MB hash, marker opacity and scale.
- Removed competitive-game toggle and rank visibility toggle.
- Evaluation history (normalized to Black/X), copyable position, pause/resume and a detached window.
- Modern dark cryptocurrency-inspired UI with glassmorphic panels, neon accents and a fixed readable popup width.
- Instant Vietnamese / English switching. The selected language is synchronized and remembered.

## Important implementation limits

The shipped binary is **single-thread SIMD** and runs synchronously inside a Web Worker. An ordinary `postMessage('YXSTOP')` cannot interrupt a busy synchronous search. This release does not claim multi-thread search or true concurrent pondering.

To retain the worker/model/hash while accepting new positions, searches run in bounded **750 ms work slices**. Between slices, the worker uses `TAKEBACK` to undo Rapfi's internally applied hypothetical best move, then resumes from the last reported depth using `INFO START_DEPTH`. Analysis has **no overall time budget**, but stops on a reported mate, no legal candidates, depth 100, manual pause or a replaced position. These are repeated searches reusing the transposition table, not a preserved C++ search call stack. Slices have restart overhead; strength parity with native or multi-thread Rapfi has not been benchmarked. The native time limit is approximate, so cancellation can take longer than 750 ms.

On a changed position, the worker sends one cached `YXBOARD`, just as Gomoku Calculator does. It does not rebuild the board for every slice. The existing binary has no silent incremental-play command; a genuine engine-side move/undo protocol would require another engine build. Board serialization is not model reloading or hash clearing.

Fast mode uses up to 7 seconds per position and a 3-minute extension-compute budget per game session; Slow uses 40 seconds and 15 minutes. These correspond to the calculator's preset constants, but the extension budgets **its own analysis time**, not either player's live clock. Custom offers time/depth/node limits. More MultiPV lines distribute search work across more alternatives. Handicap 0 means full strength.

Sessions live in the offscreen document and survive popup closure and service-worker suspension. Browser/extension restart loses engine hash and in-memory sessions. Only the most recently requested board is actively analyzed; opening another board pauses the previous session.

If attached midgame, a board may not expose a complete move history. The extension exports an explicitly labeled **snapshot JSON** rather than fabricating a replay string. When observed from the start, Position uses `n:g12,n14,j7|...` compatible with Gomoku Calculator. Letters use Aâ€“S and rows count upward from the bottom; site-specific numbering is translated by the active adapter. Neutral walls and X's first/second-move root restrictions are enforced. Historical chart points are only from actually analyzed positions; no backfilled or invented scores.

## Development

```sh
npm test
npm run test:engine
npm run check
npm run package
node tools/package.cjs --source
```

No production npm dependencies. Packaging uses PowerShell on Windows and `zip` on Linux/macOS. It refuses to overwrite an existing same-version ZIP. The old v0.1 files remain unchanged.

Optional Chromium integration test:

```sh
npm install --no-save playwright
npx playwright install chromium
npm run test:browser
```

This launches the actual unpacked extension against a locally supplied board fixture. It does not contact or play on a live game server. Unit and real-WASM tests were executed for this release. Chromium integration / visual QA could not be executed in the authoring environment because the browser binary download was unavailable; run this test and verify the layout locally before treating the release as production-ready.

## Structure

- `shared/core.js`: normalization, observed history, Gomocup serialization, opening legality, MultiPV parsing.
- `content/`: site adapters, cached DOM observation and non-interactive board markers.
- `background/service-worker.js`: browser routing and offscreen lifecycle.
- `offscreen/offscreen.js`: per-tab sessions, latest-only scheduling, progress/history.
- `engine/rapfi.worker.js`: persistent WASM, board/config reuse, bounded search, internal takeback.
- `popup/`: Analyze / Settings and detached window.
- `tests/`: unit, host scheduling, real WASM and worker regression tests.

## License

GPL-3.0-only; preserve `LICENSE` and `third_party/rapfi/`. Engine assets are unchanged from the previously packaged customized Rapfi build. Engine source: https://github.com/imnwngr/rapfi ; calculator: https://github.com/imnwngr/gomoku-calculator . Do not assume current upstream HEAD exactly reproduces these binaries without checking the original build revision. Do not represent a source ZIP of this extension as containing the full C++ engine source.
