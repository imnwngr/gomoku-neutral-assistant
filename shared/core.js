;(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  root.GNCore = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'
  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    nbest: 1,
    timeMode: 'analysis',
    customTime: 5000,
    maxDepth: 100,
    maxNodes: 0,
    handicap: 0,
    model: 'config.toml',
    candRange: 3,
    hashSize: 128,
    markerOpacity: 88,
    markerScale: 68,
  })
  const MODELS = ['config.toml', 'classical220723.toml', 'classical210901.toml']
  const clamp = (v, min, max, f) =>
    Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : f
  const pointKey = (p) => p.row + ':' + p.col
  const list = (points) =>
    points
      .slice()
      .sort((a, b) => a.row - b.row || a.col - b.col)
      .map(pointKey)
      .join(';')
  function normalizeSettings(value = {}) {
    const s = { ...DEFAULT_SETTINGS, ...value }
    return {
      enabled: s.enabled !== false,
      nbest: Math.round(clamp(s.nbest, 1, 10, 1)),
      timeMode: ['fast', 'slow', 'analysis', 'custom'].includes(s.timeMode)
        ? s.timeMode
        : 'analysis',
      customTime: Math.round(clamp(s.customTime, 100, 3600000, 5000)),
      maxDepth: Math.round(clamp(s.maxDepth, 1, 100, 100)),
      maxNodes: Math.round(clamp(s.maxNodes, 0, 1e12, 0)),
      handicap: Math.round(clamp(s.handicap, 0, 100, 0)),
      model: MODELS.includes(s.model) ? s.model : MODELS[0],
      candRange: Math.round(clamp(s.candRange, 0, 5, 3)),
      hashSize: [32, 64, 128, 256].includes(Number(s.hashSize))
        ? Number(s.hashSize)
        : 128,
      markerOpacity: clamp(s.markerOpacity, 0, 100, 88),
      markerScale: clamp(s.markerScale, 35, 95, 68),
    }
  }
  function limits(settings) {
    const s = normalizeSettings(settings)
    if (s.timeMode === 'analysis')
      return { turn: Infinity, match: Infinity, depth: 100, nodes: 0 }
    if (s.timeMode === 'fast')
      return { turn: 7000, match: 180000, depth: 100, nodes: 0 }
    if (s.timeMode === 'slow')
      return { turn: 40000, match: 900000, depth: 100, nodes: 0 }
    return {
      turn: s.customTime,
      match: Infinity,
      depth: s.maxDepth,
      nodes: s.maxNodes,
    }
  }
  function parseCellId(id) {
    const m = /^c(\d+)_(\d+)$/.exec(String(id || ''))
    return m ? { row: Number(m[1]), col: Number(m[2]) } : null
  }
  function recordsToSnapshot(records, options = {}) {
    const black = [],
      white = [],
      neutral = [],
      seen = new Set()
    for (const r of records || []) {
      const p = parseCellId(r.id)
      if (!p || p.row >= 19 || p.col >= 19) continue
      if (seen.has(pointKey(p)))
        return { valid: false, reason: 'duplicate-cell' }
      seen.add(pointKey(p))
      if ((r.classes || []).includes('forb')) neutral.push(p)
      else if (r.piece === 'X') black.push(p)
      else if (r.piece === 'O') white.push(p)
    }
    if (seen.size !== 361) return { valid: false, reason: 'incomplete-board' }
    if (neutral.length !== 3) return { valid: false, reason: 'neutral-count' }
    if (black.length !== white.length && black.length !== white.length + 1)
      return { valid: false, reason: 'piece-count' }
    return {
      valid: true,
      boardSize: 19,
      black,
      white,
      neutral,
      turn: black.length === white.length ? 'X' : 'O',
      moveCount: black.length + white.length,
      gameId: options.gameId || '',
      ended: !!options.ended,
    }
  }
  function snapshotKey(s) {
    return s && s.valid
      ? [
          s.gameId || '',
          s.turn,
          list(s.neutral),
          list(s.black),
          list(s.white),
        ].join('|')
      : 'invalid'
  }
  function sameGame(a, b) {
    return (
      !!a &&
      !!b &&
      a.boardSize === b.boardSize &&
      a.gameId === b.gameId &&
      list(a.neutral) === list(b.neutral)
    )
  }
  function orderedMoves(s) {
    if (Array.isArray(s.moves) && s.moves.length === s.moveCount) return s.moves
    // Gomocup reads a sequence, not color sets. Grouping X then O inserts PASS.
    const moves = []
    for (let i = 0; i < s.black.length; i++) {
      moves.push({ ...s.black[i], piece: 'X' })
      if (s.white[i]) moves.push({ ...s.white[i], piece: 'O' })
    }
    return moves
  }
  function trackPosition(previous, raw) {
    const s = { ...raw }
    let moves = orderedMoves(s),
      exact = s.moveCount <= 1,
      reset =
        !sameGame(previous, s) || (previous.moveCount > 0 && s.moveCount === 0)
    if (!reset) {
      const old = orderedMoves(previous),
        oldSet = new Set(old.map((p) => p.piece + pointKey(p))),
        all = orderedMoves(s),
        allSet = new Set(all.map((p) => p.piece + pointKey(p))),
        add = all.filter((p) => !oldSet.has(p.piece + pointKey(p)))
      if (
        old.every((p) => allSet.has(p.piece + pointKey(p))) &&
        add.length <= 1
      ) {
        moves = old.concat(add)
        exact = previous.historyExact || s.moveCount <= 1
      } else if (
        all.length < old.length &&
        old.slice(0, all.length).every((p) => allSet.has(p.piece + pointKey(p)))
      ) {
        moves = old.slice(0, all.length)
        exact = previous.historyExact
      } else reset = true
    }
    return { ...s, moves, historyExact: !!exact, reset }
  }
  function buildBoardCommand(s) {
    if (!s || !s.valid) throw new Error('Invalid board')
    const fields = s.neutral.map((p) => `${p.col},${p.row},3`),
      selfBlack = s.black.length === s.white.length
    for (const p of orderedMoves(s))
      fields.push(
        `${p.col},${p.row},${(p.piece === 'X') === selfBlack ? 1 : 2}`
      )
    return 'YXBOARD ' + fields.join(' ') + ' DONE'
  }
  function isLegal(s, m) {
    if (!m || m.x < 0 || m.y < 0 || m.x >= s.boardSize || m.y >= s.boardSize)
      return false
    if (
      [...s.black, ...s.white, ...s.neutral].some(
        (p) => p.col === m.x && p.row === m.y
      )
    )
      return false
    const distance = (p) =>
      Math.max(Math.abs(p.col - m.x), Math.abs(p.row - m.y))
    if (s.turn === 'X' && s.black.length === 0)
      return s.neutral.some((p) => distance(p) === 1)
    if (s.turn === 'X' && s.black.length === 1) return distance(s.black[0]) > 3
    return true
  }
  function blockCommand(s) {
    if (s.turn !== 'X' || s.black.length > 1) return null
    const blocked = []
    for (let y = 0; y < s.boardSize; y++)
      for (let x = 0; x < s.boardSize; x++)
        if (!isLegal(s, { x, y })) blocked.push(x + ',' + y)
    return 'YXBLOCK ' + blocked.join(' ') + ' DONE'
  }
  function parserState() {
    return { currentPv: 0, pv: {}, pending: {}, stats: {} }
  }
  function parseEngineLine(line, s) {
    const text = String(line || '').trim()
    if (/^\d+,\d+$/.test(text)) {
      const [x, y] = text.split(',').map(Number)
      return { done: true, best: { x, y } }
    }
    if (text.startsWith('ERROR ')) return { done: true, error: text.slice(6) }
    if (!text.startsWith('INFO ')) return null
    const [, head, tail = ''] = /^INFO (\S+)(?: (.*))?$/.exec(text) || []
    s.stats ||= {}
    s.pending ||= {}
    if (head === 'PV') {
      if (tail === 'DONE') {
        for (const [i, row] of Object.entries(s.pending))
          if (row.bestline?.length) s.pv[i] = row
        s.pending = {}
        return { progress: true }
      }
      s.currentPv = Number(tail) || 0
      s.pending[s.currentPv] = { rank: s.currentPv + 1, bestline: [] }
      return null
    }
    const pv = (s.pending[s.currentPv] ||= {
      rank: s.currentPv + 1,
      bestline: [],
    })
    if (head === 'BESTLINE')
      pv.bestline = (tail.match(/\d+,\d+/g) || []).map((pair) => {
        const [x, y] = pair.split(',').map(Number)
        return { x, y }
      })
    else if (head === 'EVAL') pv.eval = tail
    else if (head === 'WINRATE') pv.winrate = Number(tail)
    else if (head === 'DEPTH') pv.depth = Number(tail)
    else if (head === 'SELDEPTH') pv.seldepth = Number(tail)
    else if (head === 'NUMPV') s.numPv = Number(tail)
    if (['NODES', 'TOTALNODES', 'TOTALTIME', 'SPEED'].includes(head))
      s.stats[head.toLowerCase()] = Number(tail)
    return null
  }
  function suggestionsFromState(s, best, limit = 5) {
    const rows = Object.keys(s.pv)
        .map(Number)
        .sort((a, b) => a - b)
        .map((i) => s.pv[i])
        .filter((p) => p.bestline?.length),
      result = [],
      seen = new Set()
    const add = (p) => {
      const m = p.bestline[0],
        key = m.x + ':' + m.y
      if (!seen.has(key)) {
        seen.add(key)
        result.push({ ...p, ...m, rank: result.length + 1 })
      }
    }
    if (best)
      add(
        rows.find(
          (p) => p.bestline[0].x === best.x && p.bestline[0].y === best.y
        ) || { bestline: [best] }
      )
    rows.forEach(add)
    return result.slice(0, limit)
  }
  function coord(m, size = 19) {
    return String.fromCharCode(65 + m.x) + (size - m.y)
  }
  function positionText(s) {
    if (!s) return ''
    if (!s.historyExact)
      return JSON.stringify({
        size: s.boardSize,
        turn: s.turn,
        neutral: s.neutral,
        black: s.black,
        white: s.white,
      })
    const label = (p) =>
      coord({ x: p.col, y: p.row }, s.boardSize).toLowerCase()
    return (
      'n:' + s.neutral.map(label).join(',') + '|' + s.moves.map(label).join('')
    )
  }
  function evaluationNumber(v) {
    if (/^[+-]?M\d+$/i.test(String(v)))
      return String(v).startsWith('-') ? -1000 : 1000
    return v !== undefined && v !== '' && Number.isFinite(Number(v))
      ? Number(v)
      : null
  }
  return {
    DEFAULT_SETTINGS,
    normalizeSettings,
    limits,
    parseCellId,
    recordsToSnapshot,
    snapshotKey,
    sameGame,
    trackPosition,
    orderedMoves,
    buildBoardCommand,
    blockCommand,
    isLegal,
    parserState,
    parseEngineLine,
    suggestionsFromState,
    coord,
    positionText,
    evaluationNumber,
    displayLabel: (row, col) => row * 20 + col + 1,
  }
})
