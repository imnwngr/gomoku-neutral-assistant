'use strict'
const test = require('node:test'),
  assert = require('node:assert/strict'),
  vm = require('node:vm'),
  fs = require('node:fs')
const GNCore = require('../shared/core.js')
const tick = () => new Promise((resolve) => setImmediate(resolve))
function setup() {
  const messages = [],
    workers = []
  class Worker {
    constructor() {
      workers.push(this)
      this.sent = []
    }
    postMessage(m) {
      this.sent.push(m)
      if (m.type === 'init') queueMicrotask(() => this.emit({ type: 'ready' }))
    }
    emit(m) {
      this.onmessage({ data: m })
    }
    terminate() {
      this.dead = true
    }
  }
  const context = vm.createContext({
    GNCore,
    Worker,
    setTimeout,
    clearTimeout,
    console,
    chrome: {
      runtime: {
        getURL: (p) => p,
        onMessage: { addListener() {} },
        sendMessage: async (m) => messages.push(m),
      },
    },
  })
  vm.runInContext(
    fs.readFileSync(require.resolve('../offscreen/offscreen.js'), 'utf8'),
    context
  )
  return { host: vm.runInContext('host', context), workers, messages }
}
function snapshot(n = 0) {
  return {
    valid: true,
    boardSize: 19,
    gameId: 'room',
    neutral: [
      { row: 8, col: 8 },
      { row: 0, col: 0 },
      { row: 18, col: 18 },
    ],
    black: n ? [{ row: 9, col: 9 }] : [],
    white: [],
    turn: n ? 'O' : 'X',
    moveCount: n,
  }
}
function finish(worker, jobId) {
  for (const data of [
    'INFO PV 0',
    'INFO DEPTH 10',
    'INFO SELDEPTH 12',
    'INFO TOTALNODES 50',
    'INFO EVAL +M3',
    'INFO BESTLINE 8,9',
    'INFO PV DONE',
    '8,9',
  ])
    worker.emit({ type: 'stdout', jobId, data })
  worker.emit({ type: 'complete', jobId, best: '8,9' })
}
test('host keeps only newest pending position; worker is reused and stop persists', async () => {
  const { host, workers } = setup()
  host.submit({
    tabId: 1,
    snapshot: snapshot(),
    settings: { timeMode: 'analysis' },
  })
  await tick()
  const first = host.active.jobId
  host.submit({ tabId: 1, snapshot: snapshot(1), settings: { nbest: 2 } })
  host.submit({ tabId: 1, snapshot: snapshot(1), settings: { nbest: 3 } })
  finish(workers[0], first)
  await tick()
  assert.equal(workers.length, 1)
  assert.equal(host.active.session.settings.nbest, 3)
  assert.equal(workers[0].sent.filter((m) => m.type === 'search').length, 2)
  host.stop(1)
  const last = host.active.jobId
  finish(workers[0], last)
  await tick()
  assert.equal(host.state(1).status, 'paused')
  assert.equal(host.active, null)
})
test('completed state and PV metadata survive reopening UI; no restart on duplicate', async () => {
  const { host, workers } = setup(),
    m = { tabId: 2, snapshot: snapshot(), settings: { nbest: 1 } }
  host.submit(m)
  await tick()
  finish(workers[0], host.active.jobId)
  const state = host.state(2)
  assert.equal(state.status, 'complete')
  assert.equal(state.suggestions[0].depth, 10)
  assert.equal(state.history.length, 1)
  host.submit(m)
  await tick()
  assert.equal(workers[0].sent.filter((m) => m.type === 'search').length, 1)
})
