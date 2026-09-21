'use strict'
importScripts('../shared/core.js')
let engine = null,
  boardKey = null,
  gameKey = null,
  configKey = null,
  jobId = null,
  best = null,
  failed = null
const send = (data) => engine.sendCommand(data)
function output(line) {
  if (/^\d+,\d+$/.test(line)) best = line
  if (line.startsWith('ERROR ')) failed = line.slice(6)
  self.postMessage({ type: 'stdout', jobId, data: line })
}
self.onmessage = async ({ data: m }) => {
  try {
    if (m.type === 'init' && !engine) {
      importScripts('rapfi-single-simd128.js')
      engine = await self.Rapfi({
        locateFile: (name) =>
          new URL(
            /^rapfi.*\.data$/.test(name) ? 'rapfi.data' : name,
            self.location.href
          ).href,
        onReceiveStdout: output,
        onReceiveStderr: (data) => self.postMessage({ type: 'stderr', data }),
        wasmMemory: new WebAssembly.Memory({ initial: 1024, maximum: 16384 }),
      })
      self.postMessage({ type: 'ready' })
      return
    }
    if (m.type !== 'search' || !engine) return
    jobId = m.jobId
    best = null
    failed = null
    const s = m.snapshot,
      c = GNCore.normalizeSettings(m.settings)
    const newConfig = JSON.stringify([
      c.model,
      c.hashSize,
      c.candRange,
      c.handicap,
    ])
    if (configKey !== newConfig) {
      if (!configKey || JSON.parse(configKey)[0] !== c.model)
        send('RELOADCONFIG ' + c.model)
      send('INFO HASH_SIZE ' + c.hashSize * 1024)
      send('INFO RULE 0')
      send('INFO THREAD_NUM 1')
      send('INFO CAUTION_FACTOR ' + c.candRange)
      send('INFO STRENGTH ' + (100 - c.handicap))
      send('INFO PONDERING 0')
      // The dashboard needs full PV statistics, not per-candidate REALTIME spam.
      send('INFO SHOW_DETAIL 2')
      configKey = newConfig
      boardKey = null
    }
    if (gameKey !== m.gameKey) {
      send('START ' + s.boardSize)
      gameKey = m.gameKey
      boardKey = null
    }
    const key = GNCore.snapshotKey(s)
    if (boardKey !== key) {
      send(GNCore.buildBoardCommand(s))
      send('YXBLOCKRESET')
      const block = GNCore.blockCommand(s)
      if (block) send(block)
      boardKey = key
    }
    send('INFO TIMEOUT_TURN ' + m.sliceMs)
    send('INFO TIMEOUT_MATCH 999900000')
    send('INFO TIME_LEFT 999900000')
    send('INFO MAX_DEPTH ' + m.maxDepth)
    send('INFO START_DEPTH ' + m.startDepth)
    send('INFO MAX_NODE ' + m.maxNodes)
    if (!failed) send('YXNBEST ' + c.nbest)
    // YXNBEST applies its hypothetical best move internally. Undo it before
    // resuming this same position; never click or write to the website.
    if (best && !failed) send('TAKEBACK ' + best)
    if (failed) boardKey = null
    self.postMessage({ type: 'complete', jobId, best, error: failed })
  } catch (e) {
    boardKey = null
    self.postMessage({ type: 'error', jobId, data: e.message || String(e) })
  }
}
