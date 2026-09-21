'use strict'

class RapfiHost {
  constructor() {
    this.worker = null
    this.ready = false
    this.readyPromise = null
    this.current = null
    this.queue = Promise.resolve()
  }

  init() {
    if (this.readyPromise) return this.readyPromise
    this.readyPromise = new Promise((resolve, reject) => {
      this.worker = new Worker(chrome.runtime.getURL('engine/rapfi.worker.js'))
      this.worker.onmessage = (event) => this.onWorkerMessage(event.data, resolve, reject)
      this.worker.onerror = (event) => {
        this.ready = false
        reject(new Error(event.message || 'Rapfi worker failed'))
        if (this.current) this.finishCurrent({ ok: false, error: event.message || 'Rapfi worker failed' })
      }
      this.worker.postMessage({ type: 'init' })
    })
    return this.readyPromise
  }

  onWorkerMessage(message, resolveReady, rejectReady) {
    if (!message) return
    if (message.type === 'ready') {
      this.ready = true
      resolveReady(true)
      return
    }
    if (message.type === 'stderr') {
      console.warn('[Rapfi]', message.data)
      return
    }
    if (message.type === 'error') {
      if (!this.ready) rejectReady(new Error(message.data || 'Rapfi initialization failed'))
      if (this.current) this.finishCurrent({ ok: false, error: message.data || 'Rapfi error' })
      return
    }
    if (message.type !== 'stdout' || !this.current) return

    const parsed = GNCore.parseEngineLine(message.data, this.current.parser)
    if (!parsed || !parsed.done) return
    if (parsed.error) {
      this.finishCurrent({ ok: false, error: parsed.error })
      return
    }

    const suggestions = GNCore.suggestionsFromState(
      this.current.parser,
      parsed.best,
      this.current.settings.nbest
    )
    this.finishCurrent({
      ok: true,
      requestId: this.current.requestId,
      suggestions,
      elapsedMs: Date.now() - this.current.startedAt,
    })
  }

  finishCurrent(result) {
    const active = this.current
    if (!active) return
    this.current = null
    clearTimeout(active.timeout)
    active.resolve(result)
  }

  send(command) {
    this.worker.postMessage({ type: 'command', data: command })
  }

  analyze(request) {
    this.queue = this.queue.catch(() => {}).then(() => this.runAnalysis(request))
    return this.queue
  }

  async runAnalysis(request) {
    await this.init()
    const settings = GNCore.normalizeSettings(request.settings)
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.finishCurrent({ ok: false, error: 'Analysis timed out' })
      }, settings.thinkTime + 15000)

      this.current = {
        resolve,
        timeout,
        requestId: request.requestId,
        settings,
        startedAt: Date.now(),
        parser: { currentPv: 0, pv: {} },
      }

      this.send('START ' + request.snapshot.boardSize)
      this.send('INFO RULE 0')
      this.send('INFO THREAD_NUM 1')
      this.send('INFO HASH_SIZE 65536')
      this.send('INFO CAUTION_FACTOR 3')
      this.send('INFO STRENGTH 100')
      this.send('INFO TIMEOUT_TURN ' + settings.thinkTime)
      this.send('INFO TIMEOUT_MATCH 9999000')
      this.send('INFO MAX_DEPTH 64')
      this.send('INFO MAX_NODE 0')
      this.send('INFO SHOW_DETAIL 3')
      this.send('INFO PONDERING 0')
      this.send(GNCore.buildBoardCommand(request.snapshot))
      this.send('YXNBEST ' + settings.nbest)
    })
  }
}

const host = new RapfiHost()

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.target !== 'offscreen') return false
  if (message.type === 'GNA_ENGINE_STATUS') {
    sendResponse({ ok: true, ready: host.ready })
    return false
  }
  if (message.type === 'GNA_ENGINE_ANALYZE') {
    host.analyze(message).then(sendResponse).catch((error) => {
      sendResponse({ ok: false, error: error && error.message ? error.message : String(error) })
    })
    return true
  }
  return false
})
