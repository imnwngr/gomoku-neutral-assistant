'use strict'

const fields = ['enabled', 'nbest', 'thinkTime', 'markerOpacity', 'markerScale', 'showRank', 'allowCompetitive']

function readField(id) {
  const input = document.getElementById(id)
  return input.type === 'checkbox' ? input.checked : Number(input.value)
}

function refreshOutputs() {
  document.getElementById('markerOpacityOut').textContent = document.getElementById('markerOpacity').value + '%'
  document.getElementById('markerScaleOut').textContent = document.getElementById('markerScale').value + '%'
}

async function save() {
  const values = {}
  fields.forEach((id) => { values[id] = readField(id) })
  await chrome.storage.sync.set(GNCore.normalizeSettings(values))
  refreshOutputs()
}

async function initialize() {
  const settings = GNCore.normalizeSettings(await chrome.storage.sync.get(GNCore.DEFAULT_SETTINGS))
  fields.forEach((id) => {
    const input = document.getElementById(id)
    if (input.type === 'checkbox') input.checked = settings[id]
    else input.value = String(settings[id])
    input.addEventListener(input.type === 'range' ? 'input' : 'change', save)
  })
  refreshOutputs()

  const status = document.getElementById('status')
  try {
    const result = await chrome.runtime.sendMessage({ type: 'GNA_ENGINE_STATUS' })
    status.textContent = result && result.ready ? 'Engine đã sẵn sàng' : 'Engine sẽ tải khi bắt đầu phân tích'
    status.className = 'ready'
  } catch (error) {
    status.textContent = 'Không kiểm tra được engine'
    status.className = 'error'
  }
}

initialize()
