# Neutral Nexus — Gomoku Neutral Assistant

**Language:** English | [Tiếng Việt](README.vi.md)

> **Version 0.2.0 · Chrome/Chromium extension · GPL-3.0-only**

Neutral Nexus is a **read-only Gomoku analysis assistant** powered by a locally running **Rapfi WebAssembly (WASM)** engine. It analyzes supported **19 × 19 boards with three permanent Neutral cells**, displays evaluations and ranked candidate moves, and offers an English/Vietnamese interface.

The extension **never clicks the board, submits a move, or opens a game-server socket**. Its purpose is to inspect and visualize positions—not to play on the user's behalf.

## Highlights

- **Local analysis:** Rapfi runs in a Web Worker, with a persistent WASM instance, model, and hash table while the analysis session remains active.
- **Ranked move suggestions:** A star marks the best candidate; `2`, `3`, and so on identify alternatives. These markers represent **alternative first moves**, not a sequence of moves.
- **Live search information:** Depth, selective depth, evaluation, nodes, speed, elapsed time, and complete ranked MultiPV lines.
- **Configurable analysis:** Fast, Slow, Analysis, and Custom modes; handicap, three bundled models, candidate range, 32–256 MB hash, and marker appearance settings.
- **Session tools:** Pause/resume, a detached analysis window, a copyable position, and a history chart based only on positions actually analyzed.
- **Bilingual interface:** Switch instantly between English and Vietnamese. The selected language is synchronized and remembered.
- **Read-only operation:** No automated clicks, moves, or gameplay commands are sent to the website.

## Supported boards and websites

**Board support is not the same as website support.** The engine and analysis UI are website-independent, but reading the board requires a dedicated site adapter. Each website may use different DOM elements, coordinates, and update events.

The packaged extension supports **only the hosts and adapters declared in `manifest.json`**. Adding a new website requires a site adapter, host permission, and regression tests. It does **not** automatically work on every Gomoku website.

Positions are interpreted with the appropriate three Neutral cells and opening restrictions. When the extension joins a game mid-session without complete move history, it exports an explicitly labeled **snapshot JSON** rather than inventing a replay. If the game was observed from the beginning, the Position format follows the Gomoku Calculator convention (`n:g12,n14,j7|...`). Coordinates use columns A–S and rows counted upward from the bottom, with site-specific numbering handled by the adapter.

## Installation / upgrade

1. Back up your checkout, or create a branch before updating (for example, `git switch -c feature/analysis-v020`).
2. Place the extension source files in the repository root—the directory containing `manifest.json`. If updating from a source ZIP, **do not delete or replace `.git`**. The runtime ZIP is for installation, not for replacing a Git checkout.
3. Visit `chrome://extensions`, turn on **Developer mode**, and choose **Load unpacked** to select the repository root; or click **Reload** for an already-loaded extension. If you previously loaded `dist`, load the updated root instead: the old `dist` directory is not automatically updated.
4. Reload the supported Gomoku page so its content scripts are reinjected.
5. Click the extension icon. Use the upper-right arrow to open a persistent analysis window alongside the board.

Node.js is needed only for development, testing, and packaging—not for running the extension.

## Analysis modes and behavior

| Mode | Per-position limit | Extension analysis budget per game session |
| --- | --- | --- |
| **Fast** | Up to 7 seconds | 3 minutes |
| **Slow** | Up to 40 seconds | 15 minutes |
| **Analysis** | No overall time budget; stops under the conditions described below | No fixed overall budget |
| **Custom** | Configurable time, depth, and/or node limits | Depends on configuration |

These are **extension compute budgets**, not the players' live clocks. More MultiPV lines divide search work across more alternatives. Handicap `0` means full strength.

Only the latest requested board is actively analyzed. When switching to another board, the previous session is paused and obsolete results are never drawn over the current board. Sessions reside in an offscreen document, so they can survive popup closure and service-worker suspension; **browser or extension restarts clear in-memory sessions and engine hash**.

### Engine limitations

The included Rapfi binary is **single-threaded SIMD** and searches synchronously within a Web Worker. An ordinary `postMessage('YXSTOP')` **cannot interrupt a search that is currently blocking the worker**. This release does not provide multithreaded search or true concurrent pondering.

To reuse the worker, model, and transposition table while responding to changing positions, analysis runs in bounded **750 ms work slices**. Between slices, the worker uses `TAKEBACK` to undo Rapfi's internal hypothetical best move and continues from the last reported depth with `INFO START_DEPTH`. A search can stop on a reported mate, no legal candidate, depth 100, manual pause, or a replaced position. The native time limit is approximate, so interruption may take **longer than 750 ms**.

These are restarted search slices—not a preserved C++ search call stack. Restart overhead exists, and strength parity with native or multithreaded Rapfi has **not been benchmarked**. On a changed position, the worker sends one cached `YXBOARD`; it does not rebuild the position each slice. A genuinely incremental engine move/undo protocol would require a different engine build.

## What's new in v0.2.0

- **Correct Gomocup serialization:** v0.1 incorrectly grouped all X stones before all O stones. Because Rapfi interprets an ordered move sequence and inserts PASS moves between repeated colors, certain odd-ply positions could be analyzed for the wrong side to move. v0.2 alternates colors correctly, maps SELF/OPPONENT relative to the current player, and retains observed move history.
- **Better performance:** Persistent WASM engine/model; `START` only on a new or reset game; model/hash/range updates only when their settings change; cached DOM cell records; and no new search for an unchanged position. Whole-board reconciliation may still be needed when a website redraws the entire board.
- **Improved analysis display:** Live progress, complete ranked MultiPV lines, best/alternative board markers, evaluation history, and copyable positions.
- **Improved workflow:** Latest-position-only scheduling, persistent analysis sessions, pause/resume, and a detached window.
- **Updated interface:** Dark glassmorphic Analyze / Settings UI with neon accents, fixed readable popup width, and synchronized English/Vietnamese localization.
- **Simplified settings:** Removed the competitive-game toggle and the rank-visibility toggle.

## Development and testing

```bash
npm test
npm run test:engine
npm run check
npm run package
node tools/package.cjs --source
```

Optional Chromium integration test:

```bash
npm install --no-save playwright
npx playwright install chromium
npm run test:browser
```

The browser test loads the real unpacked extension against a **local board fixture**; it does not contact or play on a live game server.

There are no production npm dependencies. Packaging uses PowerShell on Windows and `zip` on Linux/macOS, and refuses to overwrite an existing ZIP with the same version. The original v0.1 files remain unchanged. Unit and real-WASM tests were reported as executed for v0.2.0; Chromium integration and visual QA could not run in the original authoring environment because the browser binary could not be downloaded. **Verify the browser test and layout locally before treating the release as production-ready.**

## Project structure

| Path | Responsibility |
| --- | --- |
| `shared/core.js` | Position normalization, observed history, Gomocup serialization, opening rules, MultiPV parsing |
| `content/` | Site adapters, cached DOM observation, non-interactive board markers |
| `background/service-worker.js` | Browser message routing and offscreen-document lifecycle |
| `offscreen/offscreen.js` | Per-tab sessions, latest-position scheduling, progress, and evaluation history |
| `engine/rapfi.worker.js` | Persistent WASM engine, board/config reuse, bounded searches, internal takeback |
| `popup/` | Analyze / Settings views and detached window |
| `tests/` | Unit, scheduling, real-WASM, and worker regression tests |

## License and upstream projects

This project is distributed under **GPL-3.0-only**. Preserve `LICENSE` and `third_party/rapfi/` when redistributing.

- Rapfi engine source: <https://github.com/imnwngr/rapfi>
- Gomoku Calculator: <https://github.com/imnwngr/gomoku-calculator>

The bundled engine assets come from a previously packaged **customized Rapfi build**. Do not assume current upstream HEAD exactly reproduces these binaries without verifying the original build revision. A source ZIP of this extension does **not** contain the complete C++ engine source.
