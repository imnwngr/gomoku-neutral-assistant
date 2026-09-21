'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const core = require('../shared/core.js')

function makeBoard(extra) {
  const map = new Map(
    (extra || []).map((item) => [item.row + ':' + item.col, item])
  )
  const records = []
  for (let row = 0; row < 19; row++) {
    for (let col = 0; col < 19; col++) {
      const value = map.get(row + ':' + col) || {}
      records.push({
        id: 'c' + row + '_' + col,
        classes: value.classes || ['cell'],
        piece: value.piece || null,
      })
    }
  }
  return records
}

test('parses VNCaro cell ids', () => {
  assert.deepEqual(core.parseCellId('c10_13'), { row: 10, col: 13 })
  assert.equal(core.parseCellId('other'), null)
})

test('extracts X, O and exactly three Neutral cells', () => {
  const records = makeBoard([
    { row: 5, col: 9, classes: ['cell', 'forb'] },
    { row: 10, col: 13, classes: ['cell', 'forb'] },
    { row: 12, col: 6, classes: ['cell', 'forb'] },
    { row: 6, col: 8, classes: ['cell', 'placed'], piece: 'X' },
    { row: 9, col: 8, classes: ['cell', 'placed'], piece: 'O' },
    { row: 9, col: 10, classes: ['cell', 'placed'], piece: 'X' },
  ])
  const snapshot = core.recordsToSnapshot(records, { gameType: 'casual' })
  assert.equal(snapshot.valid, true)
  assert.equal(snapshot.turn, 'O')
  assert.equal(snapshot.moveCount, 3)
  assert.deepEqual(snapshot.neutral[0], { row: 5, col: 9 })
})

test('serializes VNCaro row/column as engine x/y', () => {
  const snapshot = {
    valid: true,
    neutral: [
      { row: 5, col: 9 },
      { row: 10, col: 13 },
      { row: 12, col: 6 },
    ],
    black: [{ row: 6, col: 8 }],
    white: [{ row: 9, col: 8 }],
  }
  assert.equal(
    core.buildBoardCommand(snapshot),
    'YXBOARD 9,5,3 13,10,3 6,12,3 8,6,1 8,9,2 DONE'
  )
})

test('collects distinct N-best engine moves', () => {
  const state = core.parserState()
  core.parseEngineLine('INFO PV 0', state)
  core.parseEngineLine('INFO EVAL 120', state)
  core.parseEngineLine('INFO BESTLINE 8,9 8,10', state)
  core.parseEngineLine('INFO PV 1', state)
  core.parseEngineLine('INFO BESTLINE 10,9 11,9', state)
  core.parseEngineLine('INFO PV DONE', state)
  const done = core.parseEngineLine('8,9', state)
  const moves = core.suggestionsFromState(state, done.best, 3)
  assert.deepEqual(
    moves.map((m) => [m.x, m.y]),
    [
      [8, 9],
      [10, 9],
    ]
  )
})

test('odd position ends with X and maps SELF to O', () => {
  const s = {
    valid: true,
    black: [
      { row: 5, col: 5 },
      { row: 9, col: 9 },
    ],
    white: [{ row: 6, col: 6 }],
    neutral: [],
  }
  assert.equal(core.buildBoardCommand(s), 'YXBOARD 5,5,2 6,6,1 9,9,2 DONE')
})

test('observed history is appended, rewind is preserved and midgame stays unknown', () => {
  const raw = {
    valid: true,
    boardSize: 19,
    gameId: 'a',
    moveCount: 0,
    black: [],
    white: [],
    neutral: [],
    turn: 'X',
  }
  const empty = core.trackPosition(null, raw)
  const one = core.trackPosition(empty, {
    ...raw,
    black: [{ row: 2, col: 2 }],
    moveCount: 1,
    turn: 'O',
  })
  const two = core.trackPosition(one, {
    ...one,
    white: [{ row: 3, col: 3 }],
    moveCount: 2,
    turn: 'X',
    moves: undefined,
  })
  assert.equal(two.historyExact, true)
  assert.equal(core.positionText(two), 'n:|c17d16')
  assert.equal(core.trackPosition(two, raw).moves.length, 0)
  const unknown = core.trackPosition(null, { ...two, moves: undefined })
  assert.equal(unknown.historyExact, false)
  assert.equal(JSON.parse(core.positionText(unknown)).turn, 'X')
})

test('neutral opening legality and X second radius', () => {
  const s = {
    boardSize: 19,
    turn: 'X',
    black: [],
    white: [],
    neutral: [
      { row: 9, col: 9 },
      { row: 0, col: 0 },
      { row: 18, col: 18 },
    ],
  }
  assert.equal(core.isLegal(s, { x: 9, y: 8 }), true)
  assert.equal(core.isLegal(s, { x: 9, y: 9 }), false)
  assert.equal(core.isLegal(s, { x: 5, y: 5 }), false)
  s.black = [{ row: 8, col: 9 }]
  assert.equal(core.isLegal(s, { x: 12, y: 11 }), false)
  assert.equal(core.isLegal(s, { x: 13, y: 8 }), true)
})

test('PV carries depth, score and line; ranking is engine-defined', () => {
  const s = core.parserState()
  for (const line of [
    'INFO PV 0',
    'INFO DEPTH 15',
    'INFO SELDEPTH 27',
    'INFO EVAL +M3',
    'INFO BESTLINE 8,9 8,10',
    'INFO TOTALNODES 102000',
    'INFO SPEED 247000',
    'INFO TOTALTIME 400',
    'INFO PV DONE',
  ])
    core.parseEngineLine(line, s)
  const row = core.suggestionsFromState(s, { x: 8, y: 9 }, 1)[0]
  assert.equal(row.depth, 15)
  assert.equal(row.seldepth, 27)
  assert.equal(row.eval, '+M3')
  assert.equal(row.bestline.length, 2)
  assert.equal(s.stats.totalnodes, 102000)
  assert.equal(core.coord({ x: 15, y: 8 }), 'P11')
})

test('time modes and removal of obsolete options', () => {
  assert.equal(core.limits({ timeMode: 'analysis' }).turn, Infinity)
  assert.equal(core.limits({ timeMode: 'fast' }).turn, 7000)
  assert.equal(core.limits({ timeMode: 'slow' }).match, 900000)
  const s = core.normalizeSettings({
    showRank: false,
    allowCompetitive: true,
    thinkTime: 500,
  })
  assert.equal('showRank' in s, false)
  assert.equal('allowCompetitive' in s, false)
  assert.equal(s.handicap, 0)
})

test('uses VNCaro stride-20 labels', () => {
  assert.equal(core.displayLabel(0, 18), 19)
  assert.equal(core.displayLabel(1, 0), 21)
  assert.equal(core.displayLabel(9, 10), 191)
})
