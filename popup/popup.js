'use strict'
const $ = (id) => document.getElementById(id)
let tabId = null,
  current = null,
  saveTimer = null
const numeric = [
  'nbest',
  'maxDepth',
  'maxNodes',
  'handicap',
  'candRange',
  'hashSize',
  'markerOpacity',
  'markerScale',
]
const compact = (n) =>
  Number.isFinite(n)
    ? n >= 1e6
      ? (n / 1e6).toFixed(1) + 'M'
      : n >= 1e3
      ? (n / 1e3).toFixed(0) + 'K'
      : String(n)
    : '—'
async function message(type) {
  const r = await chrome.runtime.sendMessage({ type, tabId })
  if (!r?.ok) throw new Error(r?.error || 'Không kết nối được extension')
  return r
}
function showSettings(s) {
  numeric.forEach((k) => {
    $(k).value = s[k]
  })
  $('enabled').checked = s.enabled
  $('model').value = s.model
  $('customSeconds').value = s.customTime / 1000
  document.querySelector(
    `input[name=timeMode][value="${s.timeMode}"]`
  ).checked = true
  refreshFields()
}
function refreshFields() {
  $('customSettings').hidden =
    document.querySelector('input[name=timeMode]:checked')?.value !== 'custom'
  $('opacityOut').value = $('markerOpacity').value + '%'
  $('scaleOut').value = $('markerScale').value + '%'
}
async function save() {
  try {
    const s = {
      enabled: $('enabled').checked,
      model: $('model').value,
      timeMode: document.querySelector('input[name=timeMode]:checked').value,
      customTime: Number($('customSeconds').value) * 1000,
    }
    numeric.forEach((k) => {
      s[k] = Number($(k).value)
    })
    await chrome.storage.sync.set(GNCore.normalizeSettings(s))
    $('saved').textContent = 'Đã lưu · áp dụng cho phân tích tiếp theo'
  } catch (e) {
    $('saved').textContent = e.message
  }
}
function graph(history) {
  const canvas = $('evalChart'),
    r = canvas.getBoundingClientRect()
  if (!r.width) return
  const dpr = devicePixelRatio || 1
  canvas.width = Math.round(r.width * dpr)
  canvas.height = 150 * dpr
  const c = canvas.getContext('2d')
  c.scale(dpr, dpr)
  const w = r.width,
    h = 150,
    left = 34,
    right = w - 10,
    top = 12,
    bottom = h - 22
  const points = (history || [])
    .filter((p) => Number.isFinite(p.blackEval))
    .sort((a, b) => a.ply - b.ply)
  const bound = Math.max(
      200,
      ...points.map((p) => Math.ceil(Math.abs(p.blackEval) / 100) * 100)
    ),
    last = Math.max(10, ...points.map((p) => p.ply)),
    first = Math.max(0, Math.min(...points.map((p) => p.ply)) - 2)
  const x = (ply) => left + ((ply - first) / (last - first)) * (right - left),
    y = (val) => (top + bottom) / 2 - ((val / bound) * (bottom - top)) / 2
  c.font = '9px Segoe UI'
  c.fillStyle = '#94a5af'
  c.strokeStyle = '#33414b'
  c.lineWidth = 1
  for (const v of [-bound, 0, bound]) {
    c.beginPath()
    c.moveTo(left, y(v))
    c.lineTo(right, y(v))
    c.stroke()
    c.fillText(String(v), 1, y(v) + 3)
  }
  for (let i = 0; i <= 4; i++) {
    const ply = Math.round(first + ((last - first) * i) / 4)
    c.fillText(String(ply), x(ply) - 4, h - 6)
  }
  if (points.length) {
    c.strokeStyle = '#8ee3c0'
    c.lineWidth = 2
    c.beginPath()
    points.forEach((p, i) =>
      i
        ? c.lineTo(x(p.ply), y(p.blackEval))
        : c.moveTo(x(p.ply), y(p.blackEval))
    )
    c.stroke()
    for (const p of points) {
      c.fillStyle = p.turn === 'X' ? '#8ee3c0' : '#e3bd83'
      c.beginPath()
      c.arc(x(p.ply), y(p.blackEval), 3, 0, Math.PI * 2)
      c.fill()
    }
  }
  $('chartNote').textContent = points.length
    ? 'Eval quy về phía X: dương = X lợi thế. Màu ngọc = lượt X; vàng = lượt O. Mate hiển thị tại ±1000.'
    : 'Chưa có dữ liệu. Chỉ ghi các position đã được phân tích.'
  canvas.setAttribute(
    'aria-label',
    points
      .map((p) => `Sau ${p.ply} nước, eval phía X ${p.blackEval}`)
      .join('; ') || 'Chưa có dữ liệu'
  )
}
function render(state) {
  current = state || {}
  const rows = current.suggestions || [],
    s = current.snapshot,
    stats = current.stats || {},
    best = rows[0]
  $('boardTitle').textContent = s
    ? `${s.turn === 'X' ? 'X / Black' : 'O / White'} to move · ${
        s.moveCount
      } ply`
    : 'Chờ bàn cờ'
  const labels = {
    waiting: 'WAITING',
    loading: 'LOADING',
    thinking: 'ANALYZING',
    complete: 'COMPLETE',
    paused: 'PAUSED',
    superseded: 'SYNCING',
    error: 'ERROR',
  }
  $('stateBadge').textContent = labels[current.status] || 'WAITING'
  $('stateBadge').classList.toggle('error', current.status === 'error')
  $('status').textContent =
    current.error ||
    (current.status === 'thinking'
      ? 'Đang đào sâu · position và bảng nhớ được giữ trong phiên.'
      : current.status === 'loading'
      ? 'Đang nạp model cục bộ…'
      : current.status === 'complete'
      ? 'Đã kết thúc lượt phân tích. Có thể bấm Phân tích lại.'
      : current.status === 'paused'
      ? 'Phân tích đã tạm dừng.'
      : s
      ? '3 Neutral · 19 × 19 · chỉ hiển thị gợi ý.'
      : 'Mở một bàn cờ VNCaro để bắt đầu.')
  $('depth').textContent = best?.depth
    ? `${best.depth}-${best.seldepth ?? '—'}`
    : '—'
  $('eval').textContent = best?.eval ?? '—'
  $('speed').textContent = compact(stats.speed)
  $('nodes').textContent = compact(stats.nodes)
  $('time').textContent = Number.isFinite(stats.timeMs)
    ? (stats.timeMs / 1000).toFixed(1) + 's'
    : '—'
  $('pvLabel').textContent = `${rows.length} PV · BEST FIRST`
  const body = $('pvRows')
  body.replaceChildren()
  if (!rows.length) {
    const row = body.insertRow(),
      cell = row.insertCell()
    cell.colSpan = 4
    cell.className = 'empty'
    cell.textContent = 'Kết quả sẽ cập nhật trong khi engine đang tính.'
  }
  rows.forEach((p, i) => {
    const row = body.insertRow()
    if (!i) row.className = 'best'
    const values = [
      i === 0 ? '★' : String(i + 1),
      p.depth ? `${p.depth}-${p.seldepth ?? '—'}` : '—',
      p.eval ?? '—',
      (p.bestline || []).map((m) => GNCore.coord(m, s?.boardSize)).join(' '),
    ]
    values.forEach((v) => {
      row.insertCell().textContent = v
    })
  })
  $('position').value = current.position || ''
  $('positionNote').textContent = current.historyExact
    ? 'Lịch sử được quan sát đầy đủ · có thể copy sang Gomoku Calculator.'
    : 'Bắt đầu theo dõi giữa ván: chỉ có snapshot JSON chính xác, không giả định lịch sử các nước đã đi.'
  graph(current.history)
}
async function init() {
  const param = new URLSearchParams(location.search).get('tab')
  if (param !== null) {
    tabId = Number(param)
    document.body.classList.add('detached')
    $('detach').hidden = true
  } else {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    tabId = tabs[0]?.id
  }
  showSettings(GNCore.normalizeSettings(await chrome.storage.sync.get(null)))
  document
    .querySelectorAll('#settingsPanel input,#settingsPanel select')
    .forEach((el) => {
      el.addEventListener(el.type === 'range' ? 'input' : 'change', () => {
        refreshFields()
        clearTimeout(saveTimer)
        if (el.type === 'range') saveTimer = setTimeout(save, 180)
        else save()
      })
      if (el.type === 'range')
        el.addEventListener('change', () => {
          clearTimeout(saveTimer)
          save()
        })
    })
  const select = (setting) => {
    $('analyzePanel').hidden = setting
    $('settingsPanel').hidden = !setting
    for (const [id, on] of [
      ['analyzeTab', !setting],
      ['settingsTab', setting],
    ]) {
      $(id).classList.toggle('selected', on)
      $(id).setAttribute('aria-selected', String(on))
    }
    if (!setting) graph(current?.history)
  }
  $('analyzeTab').onclick = () => select(false)
  $('settingsTab').onclick = () => select(true)
  for (const [id, type] of [
    ['stop', 'GNA_STOP'],
    ['resume', 'GNA_RESUME'],
    ['detach', 'GNA_WINDOW'],
  ])
    $(id).onclick = () =>
      message(type).catch((e) => {
        $('status').textContent = e.message
      })
  $('copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText($('position').value)
      $('copy').textContent = 'Copied'
      setTimeout(() => {
        $('copy').textContent = 'Copy'
      }, 1500)
    } catch {
      $('position').select()
      $('positionNote').textContent = 'Nhấn Ctrl+C để sao chép.'
    }
  }
  chrome.runtime.onMessage.addListener((m) => {
    if (m.type === 'GNA_UPDATE' && m.tabId === tabId) render(m.state)
  })
  window.addEventListener('resize', () => graph(current?.history))
  const r = await message('GNA_GET')
  render(r.state)
}
init().catch((e) => {
  $('status').textContent = e.message
})
