'use strict'
importScripts('../shared/core.js')
let creating = null
async function exists() {
  return (
    (await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] }))
      .length > 0
  )
}
async function ensure() {
  if (await exists()) return
  if (!creating)
    creating = chrome.offscreen
      .createDocument({
        url: 'offscreen/offscreen.html',
        reasons: ['WORKERS'],
        justification: 'Persistent local Rapfi analysis worker.',
      })
      .finally(() => {
        creating = null
      })
  await creating
}
chrome.runtime.onInstalled.addListener(async () => {
  const old = await chrome.storage.sync.get(null)
  await chrome.storage.sync.set(GNCore.normalizeSettings(old))
  await chrome.storage.sync.remove([
    'allowCompetitive',
    'showRank',
    'thinkTime',
  ])
})
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (!m || m.target === 'offscreen') return false
  if (m.type === 'GNA_UPDATE') {
    // Only our offscreen document can publish engine output.
    if (sender.url !== chrome.runtime.getURL('offscreen/offscreen.html'))
      return false
    chrome.tabs.sendMessage(m.tabId, m).catch(() => {})
    return false
  }
  if (
    !['GNA_SUBMIT', 'GNA_GET', 'GNA_STOP', 'GNA_RESUME', 'GNA_WINDOW'].includes(
      m.type
    )
  )
    return false
  ;(async () => {
    const tabId = sender.tab?.id ?? m.tabId
    if (!Number.isInteger(tabId))
      throw new Error('Mở extension từ tab VNCaro trước.')
    if (m.type === 'GNA_WINDOW') {
      await chrome.windows.create({
        url: chrome.runtime.getURL('popup/popup.html') + '?tab=' + tabId,
        type: 'popup',
        width: 720,
        height: 840,
      })
      return reply({ ok: true })
    }
    if (m.type === 'GNA_RESUME') {
      await chrome.tabs.sendMessage(tabId, { type: 'GNA_RESCAN' })
      return reply({ ok: true })
    }
    if (m.type === 'GNA_GET' && !(await exists()))
      return reply({
        ok: true,
        state: { status: 'waiting', suggestions: [], history: [] },
      })
    await ensure()
    const settings =
      m.type === 'GNA_SUBMIT'
        ? GNCore.normalizeSettings(await chrome.storage.sync.get(null))
        : undefined
    const result = await chrome.runtime.sendMessage({
      ...m,
      target: 'offscreen',
      tabId,
      settings,
    })
    reply(result)
  })().catch((e) => reply({ ok: false, error: e.message || String(e) }))
  return true
})
chrome.tabs.onRemoved.addListener((tabId) => {
  exists()
    .then(
      (ok) =>
        ok &&
        chrome.runtime.sendMessage({
          target: 'offscreen',
          type: 'GNA_DROP',
          tabId,
        })
    )
    .catch(() => {})
})
