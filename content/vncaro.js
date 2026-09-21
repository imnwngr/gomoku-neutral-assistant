;(function () {
  'use strict'
  let settings = GNCore.normalizeSettings(),
    board = null,
    observer = null,
    resize = null,
    overlay = null,
    timer = null,
    key = null,
    snapshot = null,
    suggestions = [],
    force = false,
    full = true,
    stopped = false
  const records = new Map(),
    dirty = new Set()
  const readCell = (cell) => ({
    id: cell.id,
    classes: Array.from(cell.classList),
    piece: cell.querySelector('.PX[aria-label="X"]')
      ? 'X'
      : cell.querySelector('.PO[aria-label="O"]')
      ? 'O'
      : null,
  })
  function ensureOverlay() {
    const inner = document.getElementById('binner') || board?.parentElement
    if (!inner) return
    if (getComputedStyle(inner).position === 'static')
      inner.style.position = 'relative'
    if (!overlay?.isConnected || overlay.parentElement !== inner) {
      overlay?.remove()
      overlay = document.createElement('div')
      overlay.id = 'gna-overlay-root'
      inner.appendChild(overlay)
    }
  }
  function status(text) {
    ensureOverlay()
    if (!overlay) return
    let node = overlay.querySelector('.gna-status')
    if (!text) {
      node?.remove()
      return
    }
    if (!node) {
      node = document.createElement('div')
      node.className = 'gna-status'
      overlay.appendChild(node)
    }
    node.textContent = text
  }
  function render() {
    ensureOverlay()
    if (!overlay) return
    overlay.querySelectorAll('.gna-marker').forEach((n) => n.remove())
    if (!snapshot) return
    const origin = overlay.getBoundingClientRect()
    for (const p of suggestions) {
      if (!GNCore.isLegal(snapshot, p)) continue
      const cell = document.getElementById(`c${p.y}_${p.x}`)
      if (!cell || cell.classList.contains('hidden')) continue
      const r = cell.getBoundingClientRect(),
        n = document.createElement('div'),
        size = (Math.min(r.width, r.height) * settings.markerScale) / 100
      n.className = 'gna-marker ' + (snapshot.turn === 'X' ? 'gna-x' : 'gna-o')
      n.dataset.rank = String(p.rank)
      n.style.left = r.left - origin.left + r.width / 2 + 'px'
      n.style.top = r.top - origin.top + r.height / 2 + 'px'
      n.style.width = n.style.height = size + 'px'
      n.style.fontSize = Math.max(9, size * 0.44) + 'px'
      n.style.opacity = String(settings.markerOpacity / 100)
      n.textContent = p.rank === 1 ? '★' : String(p.rank)
      n.title = `${
        p.rank === 1 ? 'Best line' : 'PV ' + p.rank
      } · ${GNCore.coord(p)} · ô ${GNCore.displayLabel(p.y, p.x)} · Eval ${
        p.eval ?? '—'
      }`
      overlay.appendChild(n)
    }
  }
  function stop(text) {
    key = null
    suggestions = []
    render()
    status(text)
    if (!stopped) {
      stopped = true
      chrome.runtime.sendMessage({ type: 'GNA_STOP' }).catch(() => {})
    }
  }
  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(scan, 70)
  }
  function attach() {
    const next = document.getElementById('board')
    if (next === board) return
    observer?.disconnect()
    resize?.disconnect()
    board = next
    records.clear()
    dirty.clear()
    full = true
    key = null
    suggestions = []
    if (!board) return
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.target === board && m.type === 'childList') {
          full = true
          continue
        }
        const el = m.target.nodeType === 1 ? m.target : m.target.parentElement,
          cell = el?.closest('.cell')
        if (cell && board.contains(cell)) dirty.add(cell)
      }
      if (full || dirty.size) schedule()
    })
    observer.observe(board, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-label'],
    })
    resize = new ResizeObserver(render)
    resize.observe(board)
    ensureOverlay()
  }
  async function scan() {
    attach()
    if (
      !board ||
      !document.getElementById('tp-game')?.classList.contains('active')
    )
      return stop('')
    if (!settings.enabled) return stop('Phân tích đang tắt')
    if (full) {
      records.clear()
      board
        .querySelectorAll(':scope > .cell')
        .forEach((c) => records.set(c.id, readCell(c)))
      full = false
    } else
      for (const c of dirty) if (c.isConnected) records.set(c.id, readCell(c))
    dirty.clear()
    const modal = document.getElementById('result-modal')
    const next = GNCore.recordsToSnapshot([...records.values()], {
      gameId: (
        document.getElementById('game-room-lbl')?.textContent || ''
      ).trim(),
      ended: !!modal && getComputedStyle(modal).display !== 'none',
    })
    if (!next.valid)
      return stop(
        next.reason === 'neutral-count'
          ? 'Đang chờ đủ 3 Neutral'
          : 'Đang đồng bộ bàn cờ'
      )
    snapshot = next
    if (next.ended) return stop('Ván đã kết thúc')
    const newKey = GNCore.snapshotKey(next)
    if (newKey === key && !force) {
      render()
      return
    }
    key = newKey
    stopped = false
    suggestions = []
    render()
    status('Đang phân tích…')
    const resume = force
    force = false
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'GNA_SUBMIT',
        snapshot: next,
        force: resume,
      })
      if (key !== newKey) return
      if (!result?.ok)
        throw new Error(result?.error || 'Không kết nối được engine')
      update(result.state)
    } catch (e) {
      if (key === newKey) status('Lỗi: ' + e.message)
    }
  }
  function update(state) {
    if (!settings.enabled || !key || state?.key !== key) return
    suggestions = state.suggestions || []
    render()
    const d = suggestions[0]?.depth
    status(
      state.status === 'thinking'
        ? `Đang tính${d ? ' · depth ' + d : ''}`
        : state.status === 'error'
        ? 'Lỗi: ' + state.error
        : state.status === 'paused'
        ? 'Đã tạm dừng'
        : state.status === 'loading'
        ? 'Đang tải engine…'
        : ''
    )
  }
  chrome.runtime.onMessage.addListener((m, sender, reply) => {
    if (m.type === 'GNA_UPDATE') update(m.state)
    if (m.type === 'GNA_RESCAN') {
      force = true
      full = true
      scan()
      reply({ ok: true })
    }
  })
  async function init() {
    settings = GNCore.normalizeSettings(await chrome.storage.sync.get(null))
    attach()
    new MutationObserver((ms) => {
      if (
        ms.some(
          (m) =>
            !(
              overlay &&
              (m.target === overlay || overlay.contains(m.target))
            ) && !(board && (m.target === board || board.contains(m.target)))
        )
      )
        schedule()
    }).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    })
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return
      const next = { ...settings }
      for (const k of Object.keys(changes)) next[k] = changes[k].newValue
      settings = GNCore.normalizeSettings(next)
      if (
        Object.keys(changes).some(
          (k) => k !== 'markerOpacity' && k !== 'markerScale'
        )
      )
        force = true
      schedule()
    })
    window.addEventListener('scroll', render, { passive: true })
    window.addEventListener('resize', render, { passive: true })
    scan()
  }
  init().catch((e) => console.error('[GNA]', e))
})()
