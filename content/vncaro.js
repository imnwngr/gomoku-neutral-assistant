(function () {
  'use strict'

  let settings = GNCore.normalizeSettings()
  let board = null
  let boardObserver = null
  let pageObserver = null
  let resizeObserver = null
  let overlay = null
  let scanTimer = null
  let latestKey = null
  let latestRequestId = 0
  let latestSuggestions = []
  let latestSnapshot = null

  async function loadSettings() {
    const stored = await chrome.storage.sync.get(GNCore.DEFAULT_SETTINGS)
    settings = GNCore.normalizeSettings(stored)
  }

  function collectCellRecords(boardElement) {
    return Array.from(boardElement.querySelectorAll(':scope > .cell')).map((cell) => ({
      id: cell.id,
      classes: Array.from(cell.classList),
      piece: cell.querySelector('.PX[aria-label="X"]') ? 'X' : cell.querySelector('.PO[aria-label="O"]') ? 'O' : null,
    }))
  }

  function detectContext() {
    const roomText = (document.getElementById('game-room-lbl') || {}).textContent || ''
    const spectatorText = (document.getElementById('spec-bar-txt') || {}).textContent || ''
    const result = document.getElementById('result-modal')
    return {
      gameType: roomText.includes('🏆') ? 'ranked' : roomText.includes('🏟️') ? 'arena' : 'casual',
      spectator: /đang xem/i.test(spectatorText),
      ended: !!(result && getComputedStyle(result).display !== 'none'),
    }
  }

  function gameTabIsActive() {
    const tab = document.getElementById('tp-game')
    return !!(tab && tab.classList.contains('active'))
  }

  function setStatus(text) {
    ensureOverlay()
    if (!overlay) return
    let node = overlay.querySelector('.gna-status')
    if (!text) {
      if (node) node.remove()
      return
    }
    if (!node) {
      node = document.createElement('div')
      node.className = 'gna-status'
      overlay.appendChild(node)
    }
    node.textContent = text
  }

  function ensureOverlay() {
    if (!board || !board.isConnected) return null
    const inner = document.getElementById('binner') || board.parentElement
    if (!inner) return null
    if (getComputedStyle(inner).position === 'static') inner.style.position = 'relative'
    if (!overlay || !overlay.isConnected || overlay.parentElement !== inner) {
      if (overlay) overlay.remove()
      overlay = document.createElement('div')
      overlay.id = 'gna-overlay-root'
      inner.appendChild(overlay)
    }
    return overlay
  }

  function clearMarkers() {
    if (!overlay) return
    overlay.querySelectorAll('.gna-marker').forEach((node) => node.remove())
    latestSuggestions = []
  }

  function renderSuggestions(suggestions, snapshot) {
    ensureOverlay()
    if (!overlay || !board) return
    overlay.querySelectorAll('.gna-marker').forEach((node) => node.remove())
    latestSuggestions = suggestions || []
    latestSnapshot = snapshot

    const containerRect = overlay.getBoundingClientRect()
    for (const suggestion of latestSuggestions) {
      const row = suggestion.y
      const col = suggestion.x
      const cell = document.getElementById('c' + row + '_' + col)
      if (!cell || cell.classList.contains('placed') || cell.classList.contains('forb') || cell.classList.contains('hidden')) continue
      const rect = cell.getBoundingClientRect()
      const marker = document.createElement('div')
      marker.className = 'gna-marker ' + (snapshot.turn === 'X' ? 'gna-x' : 'gna-o')
      marker.dataset.rank = String(suggestion.rank)
      marker.style.left = rect.left - containerRect.left + rect.width / 2 + 'px'
      marker.style.top = rect.top - containerRect.top + rect.height / 2 + 'px'
      const size = Math.min(rect.width, rect.height) * settings.markerScale / 100
      marker.style.width = size + 'px'
      marker.style.height = size + 'px'
      marker.style.fontSize = Math.max(9, size * 0.48) + 'px'
      marker.style.opacity = String(settings.markerOpacity / 100)
      marker.textContent = settings.showRank ? String(suggestion.rank) : ''
      marker.title = 'Gợi ý ' + suggestion.rank + ' · ô ' + GNCore.displayLabel(row, col)
      overlay.appendChild(marker)
    }
  }

  function scheduleScan(delay) {
    clearTimeout(scanTimer)
    scanTimer = setTimeout(scanBoard, delay == null ? 90 : delay)
  }

  async function scanBoard() {
    findAndAttachBoard()
    if (!board || !gameTabIsActive()) {
      clearMarkers()
      setStatus('')
      latestKey = null
      return
    }
    if (!settings.enabled) {
      clearMarkers()
      setStatus('Phân tích đang tắt')
      return
    }

    const context = detectContext()
    const snapshot = GNCore.recordsToSnapshot(collectCellRecords(board), context)
    if (!snapshot.valid) {
      clearMarkers()
      setStatus(snapshot.reason === 'neutral-count' ? 'Đang chờ đủ 3 Neutral' : 'Đang đồng bộ bàn cờ')
      latestKey = null
      return
    }
    if (snapshot.ended) {
      clearMarkers()
      setStatus('Ván đã kết thúc')
      return
    }
    if (snapshot.gameType === 'ranked' && !snapshot.spectator && !settings.allowCompetitive) {
      clearMarkers()
      setStatus('Tắt trong ván xếp hạng')
      latestKey = null
      return
    }

    const key = GNCore.snapshotKey(snapshot)
    if (key === latestKey) {
      if (latestSuggestions.length) renderSuggestions(latestSuggestions, latestSnapshot || snapshot)
      return
    }

    latestKey = key
    clearMarkers()
    setStatus('Rapfi đang phân tích…')
    const requestId = ++latestRequestId

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'GNA_ANALYZE',
        requestId,
        snapshot,
        settings,
      })
      if (requestId !== latestRequestId || key !== latestKey) return
      if (!result || !result.ok) throw new Error((result && result.error) || 'Không nhận được kết quả')
      renderSuggestions(result.suggestions, snapshot)
      setStatus(result.suggestions.length ? '' : 'Rapfi không trả về nước hợp lệ')
    } catch (error) {
      if (requestId !== latestRequestId) return
      clearMarkers()
      setStatus('Lỗi engine: ' + (error && error.message ? error.message : String(error)))
    }
  }

  function findAndAttachBoard() {
    const candidate = document.getElementById('board')
    if (candidate === board) return
    if (boardObserver) boardObserver.disconnect()
    if (resizeObserver) resizeObserver.disconnect()
    board = candidate
    latestKey = null
    if (!board) return

    boardObserver = new MutationObserver(() => scheduleScan(90))
    boardObserver.observe(board, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] })
    resizeObserver = new ResizeObserver(() => {
      if (latestSuggestions.length && latestSnapshot) renderSuggestions(latestSuggestions, latestSnapshot)
    })
    resizeObserver.observe(board)
    ensureOverlay()
  }

  async function initialize() {
    await loadSettings()
    findAndAttachBoard()
    pageObserver = new MutationObserver((mutations) => {
      const relevant = mutations.some((mutation) => {
        if (overlay && (mutation.target === overlay || overlay.contains(mutation.target))) return false
        if (board && (mutation.target === board || board.contains(mutation.target))) return false
        return true
      })
      if (!relevant) return
      findAndAttachBoard()
      scheduleScan(100)
    })
    pageObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return
      const next = Object.assign({}, settings)
      for (const key of Object.keys(changes)) next[key] = changes[key].newValue
      settings = GNCore.normalizeSettings(next)
      latestKey = null
      scheduleScan(0)
    })
    window.addEventListener('scroll', () => {
      if (latestSuggestions.length && latestSnapshot) renderSuggestions(latestSuggestions, latestSnapshot)
    }, { passive: true })
    scheduleScan(0)
  }

  initialize().catch((error) => console.error('[Gomoku Neutral Assistant]', error))
})()
