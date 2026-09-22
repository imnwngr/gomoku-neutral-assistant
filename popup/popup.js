'use strict'

const $ = (id) => document.getElementById(id)

let tabId = null
let current = null
let saveTimer = null
let copyTimer = null
let language = 'vi'

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

const I18N = {
  vi: {
    documentTitle: 'Neutral Nexus · Phân tích Gomoku',
    detachTitle: 'Mở cửa sổ phân tích riêng',
    analysisTab: 'Phân tích',
    settingsTab: 'Cài đặt',
    currentBoard: 'BÀN CỜ HIỆN TẠI',
    waitingBoard: 'Chờ bàn cờ',
    engineStats: 'Thống kê engine',
    depth: 'Độ sâu',
    evaluation: 'Đánh giá',
    speed: 'Tốc độ',
    nodes: 'Nút',
    time: 'Thời gian',
    principalVariations: 'Các phương án chính',
    bestFirst: 'MẠNH NHẤT TRƯỚC',
    bestline: 'Biến chính',
    resultPending: 'Kết quả sẽ cập nhật trong khi engine đang tính.',
    pvHint: '★ là nước mạnh nhất. 2, 3… là các phương án khác, không phải các nước liên tiếp. Eval tính theo bên đang đến lượt.',
    evaluationHistory: 'Lịch sử đánh giá',
    chartAria: 'Biểu đồ đánh giá thế cờ',
    chartEmpty: 'Chưa có dữ liệu. Chỉ ghi các position đã được phân tích.',
    chartSummary: 'Eval quy về phía X: dương = X lợi thế. Xanh ngọc = lượt X; tím = lượt O. Mate hiển thị tại ±1000.',
    chartPoint: 'Sau {ply} nước, eval phía X {eval}',
    positionRecord: 'Dữ liệu position',
    copy: 'SAO CHÉP',
    copied: 'ĐÃ CHÉP',
    currentPosition: 'Position hiện tại',
    positionPlaceholder: 'Position sẽ xuất hiện tại đây',
    positionDefault: 'Lưu position và các nước đi quan sát được trong phiên.',
    positionExact: 'Lịch sử được quan sát đầy đủ · có thể copy sang Gomoku Calculator.',
    positionSnapshot: 'Bắt đầu theo dõi giữa ván: chỉ có snapshot JSON chính xác, không giả định lịch sử các nước đã đi.',
    manualCopy: 'Nhấn Ctrl+C để sao chép.',
    pause: 'Tạm dừng',
    reanalyze: 'Phân tích lại',
    localOnly: 'LOCAL ONLY · 1 THREAD · CHỈ HIỂN THỊ GỢI Ý',
    engineControl: 'ĐIỀU KHIỂN ENGINE',
    thinkingDisplay: 'Tính toán & hiển thị',
    enableAnalysis: 'Bật phân tích',
    language: 'Ngôn ngữ',
    languageHint: 'ÁP DỤNG NGAY',
    displayLanguage: 'Ngôn ngữ hiển thị',
    languageDescription: 'Lựa chọn được đồng bộ và ghi nhớ.',
    thinkingTime: 'Thời gian tính',
    chooseProfile: 'CHỌN CẤU HÌNH',
    fastGame: 'Ván nhanh',
    fastDescription: '~3 phút / 7 giây mỗi position',
    slowGame: 'Ván chậm',
    slowDescription: '~15 phút / 40 giây mỗi position',
    analysisMode: 'Phân tích',
    analysisDescription: 'Không giới hạn tổng thời gian',
    custom: 'Tùy chỉnh',
    customDescription: 'Tự đặt giới hạn tìm kiếm',
    timePerPosition: 'Thời gian / position',
    secondsUnit: 'Đơn vị: giây',
    maxDepth: 'Độ sâu tối đa',
    maxNodes: 'Số nút tối đa',
    zeroUnlimited: '0 = không giới hạn',
    searchControls: 'Điều khiển tìm kiếm',
    multiPvDescription: 'Số phương án, xếp mạnh → yếu',
    handicap: 'Handicap',
    handicapDescription: '0 = toàn bộ sức mạnh',
    engineModel: 'Mô hình engine',
    candidateRange: 'Phạm vi ứng viên',
    transpositionTable: 'Bảng chuyển vị',
    boardOverlay: 'Hiển thị trên bàn cờ',
    display: 'HIỂN THỊ',
    opacity: 'Độ đậm',
    size: 'Kích thước',
    sessionNote: 'Ghi chú phiên phân tích',
    sessionNoteOne: 'Engine giữ bảng nhớ tìm kiếm trong phiên. Phân tích dừng khi bạn tạm dừng, đổi position, tìm thấy kết quả quyết định hoặc đạt depth 100.',
    sessionNoteTwo: 'Fast/Slow dùng ngân sách tính của extension, không đọc đồng hồ trận đấu. Đổi model, bảng nhớ hoặc candidate range sẽ cấu hình lại engine.',
    autoSave: 'Thiết lập tự động lưu',
    saved: 'Đã lưu · áp dụng cho phân tích tiếp theo',
    messageError: 'Không kết nối được extension',
    stateWaiting: 'ĐANG CHỜ',
    stateLoading: 'ĐANG TẢI',
    stateThinking: 'ĐANG PHÂN TÍCH',
    stateComplete: 'HOÀN TẤT',
    statePaused: 'TẠM DỪNG',
    stateSyncing: 'ĐỒNG BỘ',
    stateError: 'LỖI',
    statusThinking: 'Đang đào sâu · position và bảng nhớ được giữ trong phiên.',
    statusLoading: 'Đang nạp model cục bộ…',
    statusComplete: 'Đã kết thúc lượt phân tích. Có thể bấm Phân tích lại.',
    statusPaused: 'Phân tích đã tạm dừng.',
    statusReady: '3 Neutral · 19 × 19 · chỉ hiển thị gợi ý.',
    statusOpen: 'Mở một bàn cờ Gomoku được hỗ trợ để bắt đầu.',
    boardToMove: '{side} đến lượt · {count} ply',
    blackSide: 'X / Đen',
    whiteSide: 'O / Trắng',
    cand0: 'Ô vuông 2',
    cand1: 'Ô vuông 2 + Đường 3',
    cand2: 'Ô vuông 3',
    cand3: 'Ô vuông 3 + Đường 4 · Khuyên dùng',
    cand4: 'Ô vuông 4',
    cand5: 'Toàn bàn cờ',
  },
  en: {
    documentTitle: 'Neutral Nexus · Gomoku Analysis',
    detachTitle: 'Open a separate analysis window',
    analysisTab: 'Analysis',
    settingsTab: 'Settings',
    currentBoard: 'CURRENT BOARD',
    waitingBoard: 'Waiting for board',
    engineStats: 'Engine statistics',
    depth: 'Depth',
    evaluation: 'Evaluation',
    speed: 'Speed',
    nodes: 'Nodes',
    time: 'Time',
    principalVariations: 'Principal variations',
    bestFirst: 'BEST FIRST',
    bestline: 'Bestline',
    resultPending: 'Results will update while the engine is calculating.',
    pvHint: '★ is the strongest move. 2, 3… are alternative lines, not consecutive moves. Eval is shown for the side to move.',
    evaluationHistory: 'Evaluation history',
    chartAria: 'Board evaluation chart',
    chartEmpty: 'No data yet. Only analyzed positions are recorded.',
    chartSummary: 'Eval is normalized for X: positive means X is better. Cyan = X turn; violet = O turn. Mate is shown at ±1000.',
    chartPoint: 'After {ply} moves, X evaluation {eval}',
    positionRecord: 'Position data',
    copy: 'COPY',
    copied: 'COPIED',
    currentPosition: 'Current position',
    positionPlaceholder: 'The current position will appear here',
    positionDefault: 'Stores the position and observed moves in this session.',
    positionExact: 'Full history observed · ready to copy into Gomoku Calculator.',
    positionSnapshot: 'Tracking started mid-game: the JSON snapshot is exact, but earlier move order is not assumed.',
    manualCopy: 'Press Ctrl+C to copy.',
    pause: 'Pause',
    reanalyze: 'Analyze again',
    localOnly: 'LOCAL ONLY · 1 THREAD · SUGGESTIONS ONLY',
    engineControl: 'ENGINE CONTROL',
    thinkingDisplay: 'Thinking & display',
    enableAnalysis: 'Enable analysis',
    language: 'Language',
    languageHint: 'APPLIES INSTANTLY',
    displayLanguage: 'Display language',
    languageDescription: 'Your choice is synced and remembered.',
    thinkingTime: 'Thinking time',
    chooseProfile: 'CHOOSE A PROFILE',
    fastGame: 'Fast game',
    fastDescription: '~3 min / 7s per position',
    slowGame: 'Slow game',
    slowDescription: '~15 min / 40s per position',
    analysisMode: 'Analysis',
    analysisDescription: 'Unlimited total analysis time',
    custom: 'Custom',
    customDescription: 'Set your own search limits',
    timePerPosition: 'Time / position',
    secondsUnit: 'Unit: seconds',
    maxDepth: 'Maximum depth',
    maxNodes: 'Maximum nodes',
    zeroUnlimited: '0 = unlimited',
    searchControls: 'Search controls',
    multiPvDescription: 'Number of lines, strongest → weakest',
    handicap: 'Handicap',
    handicapDescription: '0 = full strength',
    engineModel: 'Engine model',
    candidateRange: 'Candidate range',
    transpositionTable: 'Transposition table',
    boardOverlay: 'Board overlay',
    display: 'DISPLAY',
    opacity: 'Opacity',
    size: 'Size',
    sessionNote: 'Analysis session note',
    sessionNoteOne: 'The engine keeps its search table during the session. Analysis stops when paused, the position changes, a decisive result is found, or depth 100 is reached.',
    sessionNoteTwo: 'Fast/Slow use the extension’s own compute budget and do not read the game clock. Changing the model, table size, or candidate range reconfigures the engine.',
    autoSave: 'Settings save automatically',
    saved: 'Saved · applies to the next analysis',
    messageError: 'Could not connect to the extension',
    stateWaiting: 'WAITING',
    stateLoading: 'LOADING',
    stateThinking: 'ANALYZING',
    stateComplete: 'COMPLETE',
    statePaused: 'PAUSED',
    stateSyncing: 'SYNCING',
    stateError: 'ERROR',
    statusThinking: 'Searching deeper · the position and search table are retained for this session.',
    statusLoading: 'Loading the local model…',
    statusComplete: 'Analysis finished. Select Analyze again to restart.',
    statusPaused: 'Analysis is paused.',
    statusReady: '3 Neutral · 19 × 19 · suggestions only.',
    statusOpen: 'Open a supported Gomoku board to begin.',
    boardToMove: '{side} to move · {count} ply',
    blackSide: 'X / Black',
    whiteSide: 'O / White',
    cand0: 'Square 2',
    cand1: 'Square 2 + Line 3',
    cand2: 'Square 3',
    cand3: 'Square 3 + Line 4 · Recommended',
    cand4: 'Square 4',
    cand5: 'Full board',
  },
}

const t = (key, values = {}) => {
  let value = I18N[language]?.[key] ?? I18N.en[key] ?? key
  for (const [name, replacement] of Object.entries(values))
    value = value.replaceAll('{' + name + '}', replacement)
  return value
}

function applyLanguage(nextLanguage, rerender = true) {
  language = nextLanguage === 'en' ? 'en' : 'vi'
  document.documentElement.lang = language
  document.title = t('documentTitle')
  if ($('language')) $('language').value = language
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n)
  })
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle)
  })
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria))
  })
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder)
  })
  if (rerender && current !== null) render(current)
}

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
  if (!r?.ok) throw new Error(r?.error || t('messageError'))
  return r
}

function showSettings(raw) {
  const s = GNCore.normalizeSettings(raw)
  numeric.forEach((key) => {
    $(key).value = s[key]
  })
  $('enabled').checked = s.enabled
  $('model').value = s.model
  $('customSeconds').value = s.customTime / 1000
  document.querySelector(
    `input[name=timeMode][value="${s.timeMode}"]`
  ).checked = true
  applyLanguage(raw.language)
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
    const settings = {
      enabled: $('enabled').checked,
      model: $('model').value,
      timeMode: document.querySelector('input[name=timeMode]:checked').value,
      customTime: Number($('customSeconds').value) * 1000,
    }
    numeric.forEach((key) => {
      settings[key] = Number($(key).value)
    })
    await chrome.storage.sync.set({
      ...GNCore.normalizeSettings(settings),
      language,
    })
    $('saved').textContent = t('saved')
  } catch (error) {
    $('saved').textContent = error.message
  }
}

function graph(history) {
  const canvas = $('evalChart')
  const rect = canvas.getBoundingClientRect()
  if (!rect.width) return

  const dpr = devicePixelRatio || 1
  canvas.width = Math.round(rect.width * dpr)
  canvas.height = 150 * dpr
  const context = canvas.getContext('2d')
  context.scale(dpr, dpr)

  const width = rect.width
  const height = 150
  const left = 34
  const right = width - 10
  const top = 12
  const bottom = height - 22
  const points = (history || [])
    .filter((point) => Number.isFinite(point.blackEval))
    .sort((a, b) => a.ply - b.ply)

  const bound = Math.max(
    200,
    ...points.map((point) => Math.ceil(Math.abs(point.blackEval) / 100) * 100)
  )
  const last = Math.max(10, ...points.map((point) => point.ply))
  const first = Math.max(0, Math.min(...points.map((point) => point.ply)) - 2)
  const x = (ply) => left + ((ply - first) / (last - first)) * (right - left)
  const y = (value) =>
    (top + bottom) / 2 - ((value / bound) * (bottom - top)) / 2

  context.font = '9px Consolas'
  context.fillStyle = '#74819a'
  context.strokeStyle = '#28324a'
  context.lineWidth = 1

  for (const value of [-bound, 0, bound]) {
    context.beginPath()
    context.moveTo(left, y(value))
    context.lineTo(right, y(value))
    context.stroke()
    context.fillText(String(value), 1, y(value) + 3)
  }

  for (let i = 0; i <= 4; i++) {
    const ply = Math.round(first + ((last - first) * i) / 4)
    context.fillText(String(ply), x(ply) - 4, height - 6)
  }

  if (points.length) {
    context.shadowBlur = 10
    context.shadowColor = '#4cf3d2'
    context.strokeStyle = '#4cf3d2'
    context.lineWidth = 2
    context.beginPath()
    points.forEach((point, index) =>
      index
        ? context.lineTo(x(point.ply), y(point.blackEval))
        : context.moveTo(x(point.ply), y(point.blackEval))
    )
    context.stroke()
    context.shadowBlur = 0

    for (const point of points) {
      context.fillStyle = point.turn === 'X' ? '#4cf3d2' : '#8b6cff'
      context.beginPath()
      context.arc(x(point.ply), y(point.blackEval), 3, 0, Math.PI * 2)
      context.fill()
    }
  }

  $('chartNote').textContent = points.length ? t('chartSummary') : t('chartEmpty')
  canvas.setAttribute(
    'aria-label',
    points
      .map((point) => t('chartPoint', { ply: point.ply, eval: point.blackEval }))
      .join('; ') || t('chartEmpty')
  )
}

function render(state) {
  current = state || {}
  const rows = current.suggestions || []
  const snapshot = current.snapshot
  const stats = current.stats || {}
  const best = rows[0]

  $('boardTitle').textContent = snapshot
    ? t('boardToMove', {
        side: snapshot.turn === 'X' ? t('blackSide') : t('whiteSide'),
        count: snapshot.moveCount,
      })
    : t('waitingBoard')

  const stateLabels = {
    waiting: 'stateWaiting',
    loading: 'stateLoading',
    thinking: 'stateThinking',
    complete: 'stateComplete',
    paused: 'statePaused',
    superseded: 'stateSyncing',
    error: 'stateError',
  }
  $('stateBadge').textContent = t(stateLabels[current.status] || 'stateWaiting')
  $('stateBadge').classList.toggle('error', current.status === 'error')

  $('status').textContent =
    current.error ||
    (current.status === 'thinking'
      ? t('statusThinking')
      : current.status === 'loading'
      ? t('statusLoading')
      : current.status === 'complete'
      ? t('statusComplete')
      : current.status === 'paused'
      ? t('statusPaused')
      : snapshot
      ? t('statusReady')
      : t('statusOpen'))

  $('depth').textContent = best?.depth
    ? `${best.depth}-${best.seldepth ?? '—'}`
    : '—'
  $('eval').textContent = best?.eval ?? '—'
  $('speed').textContent = compact(stats.speed)
  $('nodes').textContent = compact(stats.nodes)
  $('time').textContent = Number.isFinite(stats.timeMs)
    ? (stats.timeMs / 1000).toFixed(1) + 's'
    : '—'
  $('pvLabel').textContent = `${rows.length} PV · ${t('bestFirst')}`

  const body = $('pvRows')
  body.replaceChildren()
  if (!rows.length) {
    const row = body.insertRow()
    const cell = row.insertCell()
    cell.colSpan = 4
    cell.className = 'empty'
    cell.textContent = t('resultPending')
  }

  rows.forEach((variation, index) => {
    const row = body.insertRow()
    if (!index) row.className = 'best'
    const values = [
      index === 0 ? '★' : String(index + 1),
      variation.depth
        ? `${variation.depth}-${variation.seldepth ?? '—'}`
        : '—',
      variation.eval ?? '—',
      (variation.bestline || [])
        .map((move) => GNCore.coord(move, snapshot?.boardSize))
        .join(' '),
    ]
    values.forEach((value) => {
      row.insertCell().textContent = value
    })
  })

  $('position').value = current.position || ''
  $('positionNote').textContent = snapshot
    ? current.historyExact
      ? t('positionExact')
      : t('positionSnapshot')
    : t('positionDefault')

  graph(current.history)
}

async function init() {
  const param = new URLSearchParams(location.search).get('tab')
  if (param !== null) {
    tabId = Number(param)
    document.documentElement.classList.add('detached-window')
    document.body.classList.add('detached')
    $('detach').hidden = true
  } else {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    tabId = tabs[0]?.id
  }

  const rawSettings = await chrome.storage.sync.get(null)
  showSettings(rawSettings)

  document
    .querySelectorAll('#settingsPanel input,#settingsPanel select')
    .forEach((element) => {
      element.addEventListener(
        element.type === 'range' ? 'input' : 'change',
        () => {
          if (element.id === 'language') applyLanguage(element.value)
          refreshFields()
          clearTimeout(saveTimer)
          if (element.type === 'range') saveTimer = setTimeout(save, 180)
          else save()
        }
      )
      if (element.type === 'range')
        element.addEventListener('change', () => {
          clearTimeout(saveTimer)
          save()
        })
    })

  const selectPanel = (settingsSelected) => {
    $('analyzePanel').hidden = settingsSelected
    $('settingsPanel').hidden = !settingsSelected
    for (const [id, selected] of [
      ['analyzeTab', !settingsSelected],
      ['settingsTab', settingsSelected],
    ]) {
      $(id).classList.toggle('selected', selected)
      $(id).setAttribute('aria-selected', String(selected))
    }
    if (!settingsSelected) graph(current?.history)
  }

  $('analyzeTab').onclick = () => selectPanel(false)
  $('settingsTab').onclick = () => selectPanel(true)

  for (const [id, type] of [
    ['stop', 'GNA_STOP'],
    ['resume', 'GNA_RESUME'],
    ['detach', 'GNA_WINDOW'],
  ])
    $(id).onclick = () =>
      message(type).catch((error) => {
        $('status').textContent = error.message
      })

  $('copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText($('position').value)
      clearTimeout(copyTimer)
      $('copy').textContent = t('copied')
      copyTimer = setTimeout(() => {
        $('copy').textContent = t('copy')
      }, 1500)
    } catch {
      $('position').select()
      $('positionNote').textContent = t('manualCopy')
    }
  }

  chrome.runtime.onMessage.addListener((messageData) => {
    if (messageData.type === 'GNA_UPDATE' && messageData.tabId === tabId)
      render(messageData.state)
  })

  window.addEventListener('resize', () => graph(current?.history))
  const response = await message('GNA_GET')
  render(response.state)
}

init().catch((error) => {
  $('status').textContent = error.message
})

