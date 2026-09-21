'use strict'
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path')
const core = require('../shared/core.js')
const root = path.resolve(__dirname, '../engine')
test('real WASM: correct turn, zero passes, tactical win, retained position, neutral opening', async () => {
  const data = fs.readFileSync(root + '/rapfi.data')
  let lines = []
  const engine = await require(root + '/rapfi-single-simd128.js')({
    wasmBinary: fs.readFileSync(root + '/rapfi-single-simd128.wasm'),
    getPreloadedPackage: () =>
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    onReceiveStdout: (l) => lines.push(l),
    onReceiveStderr: () => {},
  })
  const send = (c) => engine.sendCommand(c)
  const trace = () => {
    lines = []
    send('TRACEBOARD')
    return lines.join('\n')
  }
  const neutral = [
    { row: 0, col: 0 },
    { row: 18, col: 18 },
    { row: 18, col: 0 },
  ]
  send('START 19')
  send('INFO HASH_SIZE 131072')
  send('INFO TIMEOUT_TURN 150')
  send('INFO TIMEOUT_MATCH 9999000')
  send('INFO MAX_DEPTH 20')
  send('INFO SHOW_DETAIL 3')
  const odd = {
    valid: true,
    boardSize: 19,
    neutral,
    black: [
      { row: 9, col: 8 },
      { row: 10, col: 8 },
      { row: 11, col: 8 },
    ],
    white: [
      { row: 9, col: 9 },
      { row: 9, col: 10 },
    ],
    turn: 'O',
    moveCount: 5,
  }
  // Reproduce v0.1's color-grouped bug on the actual binary.
  send('YXBOARD 0,0,3 18,18,3 0,18,3 8,9,1 8,10,1 8,11,1 9,9,2 10,9,2 DONE')
  assert.match(trace(), /SideToMove: Black/)
  send(core.buildBoardCommand(odd))
  let t = trace()
  assert.match(t, /SideToMove: White/)
  assert.match(t, /Ply: 5\n/)
  assert.match(t, /PassCount\[Black\]: 0  PassCount\[White\]: 0/)
  const hash = t.match(/Hash: (\w+)/)[1]
  lines = []
  send('YXNBEST 2')
  const parser = core.parserState()
  let best
  for (const l of lines) {
    const r = core.parseEngineLine(l, parser)
    if (r?.best) best = r.best
    assert.ok(!r?.error, r?.error)
  }
  assert.ok(core.isLegal(odd, best))
  assert.ok(core.suggestionsFromState(parser, best, 2)[0].depth)
  send(`TAKEBACK ${best.x},${best.y}`)
  assert.equal(trace().match(/Hash: (\w+)/)[1], hash)
  send('INFO START_DEPTH 5')
  lines = []
  send('YXNBEST 1')
  assert.ok(lines.some((l) => /^\d+,\d+$/.test(l)))
  // O must win now (X has an extra stone): both ends of O's four are valid.
  const win = {
    valid: true,
    boardSize: 19,
    neutral,
    black: [
      { row: 3, col: 2 },
      { row: 5, col: 3 },
      { row: 7, col: 4 },
      { row: 12, col: 14 },
      { row: 15, col: 16 },
    ],
    white: [
      { row: 9, col: 7 },
      { row: 9, col: 8 },
      { row: 9, col: 9 },
      { row: 9, col: 10 },
    ],
    moveCount: 9,
    turn: 'O',
  }
  send(core.buildBoardCommand(win))
  lines = []
  send('INFO START_DEPTH 2')
  send('YXNBEST 1')
  const move = lines.findLast((l) => /^\d+,\d+$/.test(l))
  assert.ok(['6,9', '11,9'].includes(move), move)
  // X first must neighbor a Neutral.
  const opening = {
    valid: true,
    boardSize: 19,
    neutral,
    black: [],
    white: [],
    moveCount: 0,
    turn: 'X',
  }
  send(core.buildBoardCommand(opening))
  send('YXBLOCKRESET')
  send(core.blockCommand(opening))
  lines = []
  send('YXNBEST 1')
  const [x, y] = lines
    .findLast((l) => /^\d+,\d+$/.test(l))
    .split(',')
    .map(Number)
  assert.ok(core.isLegal(opening, { x, y }))
})
