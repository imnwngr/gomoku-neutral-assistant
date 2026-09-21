'use strict'
class RapfiHost {
  constructor() {
    this.sessions = new Map()
    this.active = null
    this.wanted = null
    this.worker = null
    this.ready = false
    this.jobSequence = 0
    this.gameSequence = 0
    this.readyPromise = null
  }
  init() {
    if (this.readyPromise) return this.readyPromise
    this.readyPromise = new Promise((resolve, reject) => {
      this.worker = new Worker(chrome.runtime.getURL('engine/rapfi.worker.js'))
      this.worker.onmessage = ({ data: m }) => {
        if (m.type === 'ready') {
          this.ready = true
          resolve()
          return
        }
        if (m.type === 'error' && !this.ready) {
          reject(new Error(m.data))
          return
        }
        this.receive(m)
      }
      this.worker.onerror = (e) => {
        reject(new Error(e.message))
        this.fail(e.message || 'Engine crashed')
      }
      this.worker.postMessage({ type: 'init' })
    }).catch((e) => {
      this.fail(e.message)
      throw e
    })
    return this.readyPromise
  }
  state(tabId) {
    return (
      this.sessions.get(tabId)?.view || {
        status: 'waiting',
        ready: this.ready,
        suggestions: [],
        history: [],
      }
    )
  }
  publish(session, force = false) {
    if (!force && Date.now() - (session.lastSent || 0) < 120) return
    session.lastSent = Date.now()
    chrome.runtime
      .sendMessage({
        type: 'GNA_UPDATE',
        tabId: session.tabId,
        state: session.view,
      })
      .catch(() => {})
  }
  submit(m) {
    const old = this.sessions.get(m.tabId),
      s = GNCore.trackPosition(old?.snapshot, m.snapshot),
      settings = GNCore.normalizeSettings(m.settings)
    const key = GNCore.snapshotKey(s)
    if (
      old &&
      old.key === key &&
      JSON.stringify(old.settings) === JSON.stringify(settings) &&
      !m.force
    )
      return old.view
    if (old) {
      old.cancelled = true
      if (old.view.status === 'thinking') {
        old.view.status = 'superseded'
        this.publish(old, true)
      }
    }
    const reset = s.reset || !old
    const history = reset
      ? []
      : old.view.history.filter((p) => p.ply <= s.moveCount)
    const session = {
      tabId: m.tabId,
      snapshot: s,
      settings,
      key,
      gameKey: reset ? `${m.tabId}:${++this.gameSequence}` : old.gameKey,
      nodes: 0,
      elapsed: 0,
      depth: 2,
      matchUsed: reset ? 0 : old.matchUsed,
      history,
      view: {
        status: settings.enabled ? 'loading' : 'paused',
        ready: this.ready,
        snapshot: s,
        key,
        suggestions: [],
        history,
        stats: {},
        position: GNCore.positionText(s),
        historyExact: s.historyExact,
      },
    }
    this.sessions.set(m.tabId, session)
    if (this.wanted && this.wanted !== old) {
      this.wanted.cancelled = true
      this.wanted.view.status = 'paused'
      this.publish(this.wanted, true)
    }
    this.wanted = settings.enabled ? session : null
    this.publish(session, true)
    if (settings.enabled) this.pump()
    return session.view
  }
  stop(tabId) {
    const s = this.sessions.get(tabId)
    if (!s) return
    s.cancelled = true
    s.view.status = 'paused'
    if (this.wanted === s) this.wanted = null
    this.publish(s, true)
  }
  async pump() {
    if (this.active || this.starting || !this.wanted || this.wanted.cancelled)
      return
    this.starting = true
    try {
      await this.init()
    } catch {
      this.starting = false
      return
    }
    this.starting = false
    const s = this.wanted
    if (!s || s.cancelled) return
    const lim = GNCore.limits(s.settings)
    const remaining = Math.min(lim.turn - s.elapsed, lim.match - s.matchUsed)
    if (remaining <= 0 || (lim.nodes && s.nodes >= lim.nodes)) {
      s.view.status = 'complete'
      this.wanted = null
      this.publish(s, true)
      return
    }
    const jobId = ++this.jobSequence
    this.active = {
      session: s,
      jobId,
      parser: GNCore.parserState(),
      start: Date.now(),
    }
    s.view.status = 'thinking'
    s.view.ready = true
    this.publish(s, true)
    // The packaged WASM is synchronous single-threaded. Bounded work slices
    // let it process newer positions without terminating the worker/model.
    this.worker.postMessage({
      type: 'search',
      jobId,
      gameKey: s.gameKey,
      snapshot: s.snapshot,
      settings: s.settings,
      sliceMs: Math.max(1, Math.min(750, remaining)),
      startDepth: Math.max(1, Math.min(s.depth, lim.depth)),
      maxDepth: lim.depth,
      maxNodes: lim.nodes ? Math.max(1, lim.nodes - s.nodes) : 0,
    })
    this.active.watchdog = setTimeout(
      () => this.fail('Engine không phản hồi; bấm Phân tích lại để tải lại.'),
      15000
    )
  }
  rows(a, best) {
    return GNCore.suggestionsFromState(a.parser, best, a.session.settings.nbest)
      .filter((p) => GNCore.isLegal(a.session.snapshot, p))
      .map((p, i) => ({ ...p, rank: i + 1 }))
  }
  updateView(a, best) {
    const s = a.session,
      rows = this.rows(a, best)
    if (rows.length) s.view.suggestions = rows
    s.view.stats = {
      ...a.parser.stats,
      nodes: s.nodes + (a.parser.stats.totalnodes || 0),
      timeMs: s.elapsed + Date.now() - a.start,
    }
  }
  receive(m) {
    const a = this.active
    if (!a || m.jobId !== a.jobId) return
    if (m.type === 'stdout') {
      const p = GNCore.parseEngineLine(m.data, a.parser)
      if (p?.error) a.error = p.error
      if (p?.progress && !a.session.cancelled) {
        this.updateView(a)
        this.publish(a.session)
      }
      return
    }
    if (m.type === 'error') {
      this.fail(m.data)
      return
    }
    if (m.type !== 'complete') return
    clearTimeout(a.watchdog)
    this.active = null
    const s = a.session
    const spent = Date.now() - a.start
    if (s.cancelled) {
      this.pump()
      return
    }
    if (m.error || a.error) {
      s.view.status = 'error'
      s.view.error = m.error || a.error
      this.wanted = null
      this.publish(s, true)
      return
    }
    const best = m.best
      ? { x: Number(m.best.split(',')[0]), y: Number(m.best.split(',')[1]) }
      : null
    this.updateView(a, best)
    s.elapsed += spent
    s.matchUsed += spent
    s.nodes += a.parser.stats.totalnodes || 0
    const rows = s.view.suggestions,
      top = rows[0]
    // Resume from the deepest fully reported iteration, retaining TT and model.
    if (rows.length)
      s.depth = Math.max(s.depth, Math.min(...rows.map((p) => p.depth || 2)))
    const score = GNCore.evaluationNumber(top?.eval)
    if (score !== null) {
      const entry = {
        ply: s.snapshot.moveCount,
        turn: s.snapshot.turn,
        eval: top.eval,
        blackEval: s.snapshot.turn === 'X' ? score : -score,
        depth: top.depth,
      }
      const i = s.history.findIndex((p) => p.ply === entry.ply)
      if (i < 0) s.history.push(entry)
      else s.history[i] = entry
    }
    const lim = GNCore.limits(s.settings)
    const complete =
      !rows.length ||
      s.depth >= lim.depth ||
      s.elapsed >= lim.turn ||
      s.matchUsed >= lim.match ||
      (lim.nodes && s.nodes >= lim.nodes) ||
      /^[+-]?M\d+$/.test(top?.eval || '')
    s.view.status = complete ? 'complete' : 'thinking'
    s.view.stats = { ...s.view.stats, nodes: s.nodes, timeMs: s.elapsed }
    this.publish(s, true)
    if (complete) this.wanted = null
    // Yield even on instantly solved positions. No unbounded FIFO of old boards.
    setTimeout(() => this.pump(), 30)
  }
  fail(error) {
    if (this.active) clearTimeout(this.active.watchdog)
    const s = this.active?.session || this.wanted
    if (s) {
      s.view.status = 'error'
      s.view.error = error
      this.publish(s, true)
    }
    this.worker?.terminate()
    this.worker = null
    this.ready = false
    this.readyPromise = null
    this.active = null
    this.wanted = null
  }
}
const host = new RapfiHost()
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m?.target !== 'offscreen') return false
  if (m.type === 'GNA_SUBMIT') {
    reply({ ok: true, state: host.submit(m) })
    return false
  }
  if (m.type === 'GNA_GET') {
    reply({ ok: true, state: host.state(m.tabId) })
    return false
  }
  if (m.type === 'GNA_STOP') {
    host.stop(m.tabId)
    reply({ ok: true })
    return false
  }
  if (m.type === 'GNA_DROP') {
    host.stop(m.tabId)
    host.sessions.delete(m.tabId)
    reply({ ok: true })
    return false
  }
  return false
})
