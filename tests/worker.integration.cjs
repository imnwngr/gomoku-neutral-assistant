'use strict'
const test = require('node:test'),
  assert = require('node:assert/strict'),
  vm = require('node:vm'),
  fs = require('node:fs'),
  path = require('node:path')
const GNCore = require('../shared/core.js'),
  root = path.resolve(__dirname, '../engine')
test('actual worker orchestration preserves WASM, board and hash configuration across slices', async () => {
  const data = fs.readFileSync(root + '/rapfi.data'),
    messages = [],
    commands = []
  let engine,
    loads = 0
  const self = {
    location: { href: 'file://' + root + '/rapfi.worker.js' },
    postMessage: (m) => messages.push(m),
  }
  const context = vm.createContext({
    self,
    GNCore,
    URL,
    WebAssembly,
    console,
    importScripts(name) {
      if (name.endsWith('rapfi-single-simd128.js'))
        self.Rapfi = async (options) => {
          loads++
          engine = await require(root + '/rapfi-single-simd128.js')({
            ...options,
            wasmBinary: fs.readFileSync(root + '/rapfi-single-simd128.wasm'),
            getPreloadedPackage: () =>
              data.buffer.slice(
                data.byteOffset,
                data.byteOffset + data.byteLength
              ),
          })
          const send = engine.sendCommand
          engine.sendCommand = (c) => {
            commands.push(c)
            return send(c)
          }
          return engine
        }
    },
  })
  vm.runInContext(fs.readFileSync(root + '/rapfi.worker.js', 'utf8'), context)
  await self.onmessage({ data: { type: 'init' } })
  assert.ok(messages.some((m) => m.type === 'ready'))
  const snapshot = {
    valid: true,
    boardSize: 19,
    gameId: 'a',
    neutral: [
      { row: 0, col: 0 },
      { row: 18, col: 18 },
      { row: 18, col: 0 },
    ],
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
  const job = {
    type: 'search',
    jobId: 1,
    gameKey: 'game1',
    snapshot,
    settings: { nbest: 2 },
    sliceMs: 150,
    startDepth: 2,
    maxDepth: 16,
    maxNodes: 0,
  }
  await self.onmessage({ data: job })
  const result = messages.findLast((m) => m.type === 'complete')
  assert.equal(result.error, null)
  assert.ok(result.best)
  await self.onmessage({ data: { ...job, jobId: 2, startDepth: 5 } })
  assert.equal(loads, 1)
  assert.equal(commands.filter((c) => c.startsWith('START ')).length, 1)
  assert.equal(commands.filter((c) => c.startsWith('YXBOARD ')).length, 1)
  assert.equal(
    commands.filter((c) => c.startsWith('INFO HASH_SIZE ')).length,
    1
  )
  assert.equal(commands.filter((c) => c.startsWith('TAKEBACK ')).length, 2)
  engine.sendCommand('TRACEBOARD')
  assert.ok(messages.some((m) => m.data === 'MESSAGE Ply: 5'))
  assert.ok(messages.some((m) => m.data === 'MESSAGE SideToMove: White'))
  const next = {
    ...snapshot,
    white: [...snapshot.white, { row: 9, col: 11 }],
    moveCount: 6,
    turn: 'X',
  }
  await self.onmessage({ data: { ...job, jobId: 3, snapshot: next } })
  assert.equal(commands.filter((c) => c.startsWith('START ')).length, 1)
  assert.equal(commands.filter((c) => c.startsWith('YXBOARD ')).length, 2)
  for (const model of [
    'classical220723.toml',
    'classical210901.toml',
    'config.toml',
  ]) {
    await self.onmessage({
      data: { ...job, jobId: ++job.jobId, settings: { model } },
    })
    assert.equal(messages.findLast((m) => m.type === 'complete').error, null)
  }
})
