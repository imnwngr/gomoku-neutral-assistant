(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  root.GNCore = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    nbest: 3,
    thinkTime: 1500,
    markerOpacity: 88,
    markerScale: 68,
    showRank: true,
    allowCompetitive: false,
  })

  function clamp(value, min, max, fallback) {
    const number = Number(value)
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
  }

  function normalizeSettings(value) {
    const settings = value || {}
    return {
      enabled: settings.enabled !== false,
      nbest: Math.round(clamp(settings.nbest, 1, 5, DEFAULT_SETTINGS.nbest)),
      thinkTime: Math.round(clamp(settings.thinkTime, 300, 10000, DEFAULT_SETTINGS.thinkTime)),
      markerOpacity: Math.round(clamp(settings.markerOpacity, 20, 100, DEFAULT_SETTINGS.markerOpacity)),
      markerScale: Math.round(clamp(settings.markerScale, 35, 95, DEFAULT_SETTINGS.markerScale)),
      showRank: settings.showRank !== false,
      allowCompetitive: settings.allowCompetitive === true,
    }
  }

  function parseCellId(id) {
    const match = /^c(\d+)_(\d+)$/.exec(String(id || ''))
    if (!match) return null
    return { row: Number(match[1]), col: Number(match[2]) }
  }

  function recordsToSnapshot(records, options) {
    const boardSize = 19
    const black = []
    const white = []
    const neutral = []
    const occupied = new Set()

    for (const record of records || []) {
      const coord = parseCellId(record.id)
      if (!coord || coord.row >= boardSize || coord.col >= boardSize) continue
      const key = coord.row + ':' + coord.col
      if (occupied.has(key)) return { valid: false, reason: 'duplicate-cell' }
      occupied.add(key)

      const classes = new Set(record.classes || [])
      if (classes.has('forb')) neutral.push(coord)
      else if (record.piece === 'X') black.push(coord)
      else if (record.piece === 'O') white.push(coord)
    }

    if (occupied.size !== boardSize * boardSize) return { valid: false, reason: 'incomplete-board' }
    if (neutral.length !== 3) return { valid: false, reason: 'neutral-count' }
    if (!(black.length === white.length || black.length === white.length + 1)) {
      return { valid: false, reason: 'piece-count' }
    }

    const turn = black.length === white.length ? 'X' : 'O'
    const moveCount = black.length + white.length
    const opts = options || {}
    return {
      valid: true,
      boardSize,
      black,
      white,
      neutral,
      turn,
      moveCount,
      gameType: opts.gameType || 'unknown',
      spectator: opts.spectator === true,
      ended: opts.ended === true,
    }
  }

  function pointSort(a, b) {
    return a.row - b.row || a.col - b.col
  }

  function snapshotKey(snapshot) {
    if (!snapshot || !snapshot.valid) return 'invalid'
    const list = (points) => points.slice().sort(pointSort).map((p) => p.row + ',' + p.col).join(';')
    return [snapshot.turn, snapshot.gameType, snapshot.spectator ? 1 : 0, list(snapshot.neutral), list(snapshot.black), list(snapshot.white)].join('|')
  }

  function buildBoardCommand(snapshot) {
    if (!snapshot || !snapshot.valid) throw new Error('Cannot serialize an invalid board')
    const fields = []
    for (const p of snapshot.neutral) fields.push(p.col + ',' + p.row + ',3')
    for (const p of snapshot.black) fields.push(p.col + ',' + p.row + ',1')
    for (const p of snapshot.white) fields.push(p.col + ',' + p.row + ',2')
    return 'YXBOARD ' + fields.join(' ') + ' DONE'
  }

  function parseEngineLine(line, state) {
    const text = String(line || '').trim()
    const target = state || { currentPv: 0, pv: {} }
    if (!text) return null

    if (/^\d+,\d+$/.test(text)) {
      const [x, y] = text.split(',').map(Number)
      return { done: true, best: { x, y } }
    }

    if (text.startsWith('ERROR ')) return { done: true, error: text.slice(6) }
    if (!text.startsWith('INFO ')) return null

    const payload = text.slice(5)
    const split = payload.indexOf(' ')
    const head = split === -1 ? payload : payload.slice(0, split)
    const tail = split === -1 ? '' : payload.slice(split + 1)

    if (head === 'PV') {
      target.currentPv = tail === 'DONE' ? 0 : Number(tail) || 0
      return null
    }

    const index = target.currentPv || 0
    if (!target.pv[index]) target.pv[index] = { rank: index + 1, bestline: [] }
    const pv = target.pv[index]
    if (head === 'BESTLINE') {
      pv.bestline = (tail.match(/\d+,\d+/g) || []).map((pair) => {
        const [x, y] = pair.split(',').map(Number)
        return { x, y }
      })
    } else if (head === 'EVAL') pv.eval = tail
    else if (head === 'WINRATE') pv.winrate = Number(tail)
    else if (head === 'DEPTH') pv.depth = Number(tail)
    return null
  }

  function suggestionsFromState(state, best, limit) {
    const suggestions = []
    const seen = new Set()
    const add = (move, metadata) => {
      if (!move || !Number.isInteger(move.x) || !Number.isInteger(move.y)) return
      const key = move.x + ':' + move.y
      if (seen.has(key)) return
      seen.add(key)
      suggestions.push(Object.assign({ x: move.x, y: move.y }, metadata || {}))
    }

    add(best, { rank: 1 })
    Object.keys((state && state.pv) || {}).map(Number).sort((a, b) => a - b).forEach((index) => {
      const pv = state.pv[index]
      add(pv.bestline && pv.bestline[0], {
        rank: suggestions.length + 1,
        eval: pv.eval,
        winrate: pv.winrate,
        depth: pv.depth,
      })
    })
    return suggestions.slice(0, limit || 5).map((item, index) => Object.assign({}, item, { rank: index + 1 }))
  }

  function displayLabel(row, col) {
    return row * 20 + col + 1
  }

  return {
    DEFAULT_SETTINGS,
    normalizeSettings,
    parseCellId,
    recordsToSnapshot,
    snapshotKey,
    buildBoardCommand,
    parseEngineLine,
    suggestionsFromState,
    displayLabel,
  }
})
