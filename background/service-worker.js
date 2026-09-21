'use strict'

const DEFAULT_SETTINGS = {
  enabled: true,
  nbest: 3,
  thinkTime: 1500,
  markerOpacity: 88,
  markerScale: 68,
  showRank: true,
  allowCompetitive: false,
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS)
  await chrome.storage.sync.set(stored)
})

let creatingOffscreen = null

async function hasOffscreenDocument() {
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })
    return contexts.length > 0
  }
  return false
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) return
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: ['WORKERS'],
      justification: 'Run the local Rapfi WebAssembly worker without blocking the game page.',
    }).finally(() => { creatingOffscreen = null })
  }
  await creatingOffscreen
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.target === 'offscreen') return false

  if (message.type === 'GNA_ANALYZE') {
    ;(async () => {
      try {
        await ensureOffscreenDocument()
        const result = await chrome.runtime.sendMessage({
          target: 'offscreen',
          type: 'GNA_ENGINE_ANALYZE',
          requestId: message.requestId,
          snapshot: message.snapshot,
          settings: message.settings,
        })
        sendResponse(result)
      } catch (error) {
        sendResponse({ ok: false, error: error && error.message ? error.message : String(error) })
      }
    })()
    return true
  }

  if (message.type === 'GNA_ENGINE_STATUS') {
    ;(async () => {
      try {
        const exists = await hasOffscreenDocument()
        if (!exists) return sendResponse({ ok: true, ready: false })
        sendResponse(await chrome.runtime.sendMessage({ target: 'offscreen', type: 'GNA_ENGINE_STATUS' }))
      } catch (error) {
        sendResponse({ ok: false, ready: false, error: String(error) })
      }
    })()
    return true
  }

  return false
})
