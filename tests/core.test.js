'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const core = require('../shared/core.js')

function makeBoard(extra) {
  const map = new Map((extra || []).map((item) => [item.row + ':' + item.col, item]))
  const records = []
  for (let row = 0; row < 19; row++) {
    for (let col = 0; col < 19; col++) {
      const value = map.get(row + ':' + col) || {}
      records.push({ id: 'c' + row + '_' + col, classes: value.classes || ['cell'], piece: value.piece || null })
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
    neutral: [{ row: 5, col: 9 }, { row: 10, col: 13 }, { row: 12, col: 6 }],
    black: [{ row: 6, col: 8 }],
    white: [{ row: 9, col: 8 }],
  }
  assert.equal(core.buildBoardCommand(snapshot), 'YXBOARD 9,5,3 13,10,3 6,12,3 8,6,1 8,9,2 DONE')
})

test('collects distinct N-best engine moves', () => {
  const state = { currentPv: 0, pv: {} }
  core.parseEngineLine('INFO PV 0', state)
  core.parseEngineLine('INFO EVAL 120', state)
  core.parseEngineLine('INFO BESTLINE 8,9 8,10', state)
  core.parseEngineLine('INFO PV 1', state)
  core.parseEngineLine('INFO BESTLINE 10,9 11,9', state)
  const done = core.parseEngineLine('8,9', state)
  const moves = core.suggestionsFromState(state, done.best, 3)
  assert.deepEqual(moves.map((m) => [m.x, m.y]), [[8, 9], [10, 9]])
})

test('uses VNCaro stride-20 labels', () => {
  assert.equal(core.displayLabel(0, 18), 19)
  assert.equal(core.displayLabel(1, 0), 21)
  assert.equal(core.displayLabel(9, 10), 191)
})
