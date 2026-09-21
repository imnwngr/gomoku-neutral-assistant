# Gomoku Neutral Assistant

A Manifest V3 Chromium extension that detects the VNCaro 19×19 board, reads X/O/three Neutral cells, analyzes the position locally with the customized Rapfi WebAssembly engine, and draws ranked suggestions directly over the board. It never clicks or plays a move.

## Current support

- VNCaro DOM adapter (`#board`, `c{row}_{col}`, `.PX`, `.PO`, `.forb`).
- Three permanent Neutral cells serialized as Rapfi wall value `3`.
- Single-thread SIMD Rapfi WebAssembly, fully packaged and offline.
- One to five ranked suggestions.
- Configurable time, opacity, marker size, and labels.
- Competitive-game guard enabled by default.

## Install for development

1. Run `npm test` and `npm run check`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this repository directory.
5. Open VNCaro and enter or watch a game. The first engine load may take several seconds because the packaged model is about 40 MB.

If Chrome reports that it cannot load a file from the repository, run `npm run package`, unzip the generated archive, and load the extracted directory.

## Architecture

- `content/vncaro.js`: board detection, synchronization, and read-only overlay.
- `background/service-worker.js`: request routing and offscreen-host lifecycle.
- `offscreen/`: persistent extension document that owns the engine worker.
- `engine/`: Rapfi worker plus locally packaged JS/WASM/data.
- `shared/core.js`: board normalization, engine protocol, output parsing, and numbering.
- `popup/`: user settings.

The VNCaro adapter reads the rendered board instead of opening another Socket.IO connection. It debounces the site's full-board rerender and converts page `(row, col)` to engine `(x=col, y=row)`.

## Educational and anti-engine work

The observer is intentionally separate from the analyzer. A future anti-engine module can reuse normalized snapshots and timestamps to compare played moves with engine rankings, measure agreement over many moves, and flag statistical patterns for human review. A single matching move is not evidence of engine use.

## License and third-party software

Project code is distributed under GPL-3.0-only. Rapfi is GPLv3 software; its license, authors, and upstream readme are preserved under `third_party/rapfi/`. The packaged engine assets originate from the customized Rapfi/Gomoku Calculator build used by this project.
