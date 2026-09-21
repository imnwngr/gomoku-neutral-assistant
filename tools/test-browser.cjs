'use strict'
// Dev-only: npm install --no-save playwright && npx playwright install chromium
const { chromium } = require('playwright')
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
;(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gna-browser-'))
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-extensions-except=' + root,
      '--load-extension=' + root,
    ],
  })
  try {
    const errors = []
    context.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)))
    let worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent('serviceworker'))
    const id = new URL(worker.url()).host
    await worker.evaluate(async () => {
      await chrome.storage.sync.set({
        timeMode: 'custom',
        customTime: 1200,
        nbest: 3,
        enabled: true,
        hashSize: 128,
      })
    })
    const page = await context.newPage()
    await page.route('https://vncaro.com/**', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html><head><title>Local VNCaro fixture</title><style>#board{display:grid;grid-template-columns:repeat(19,26px)}.cell{width:26px;height:26px;border:1px solid #ddd;box-sizing:border-box}.forb{background:#89939a}#binner{position:relative;width:494px}#result-modal{display:none}</style></head><body><div id="game-room-lbl">Fixture 01</div><div id="tp-game" class="active"><div id="binner"><div id="board"></div></div></div><div id="result-modal"></div></body></html>',
      })
    )
    await page.goto('https://vncaro.com/')
    await page.evaluate(() => {
      const stones = {
        '9:8': 'X',
        '10:8': 'X',
        '11:8': 'X',
        '9:9': 'O',
        '9:10': 'O',
      }
      for (let row = 0; row < 19; row++)
        for (let col = 0; col < 19; col++) {
          const cell = document.createElement('div')
          cell.id = `c${row}_${col}`
          cell.className = 'cell'
          if (['0:0', '18:18', '18:0'].includes(row + ':' + col))
            cell.classList.add('forb')
          const stone = stones[row + ':' + col]
          if (stone) {
            const p = document.createElement('span')
            p.className = 'P' + stone
            p.setAttribute('aria-label', stone)
            p.textContent = stone
            cell.append(p)
          }
          document.getElementById('board').append(cell)
        }
    })
    const tabId = await worker.evaluate(async () => {
      const ts = await chrome.tabs.query({})
      return ts.find((t) => t.url === 'https://vncaro.com/').id
    })
    const ui = await context.newPage()
    await ui.goto(`chrome-extension://${id}/popup/popup.html?tab=${tabId}`)
    await ui.waitForFunction(
      () =>
        document.getElementById('pvRows').querySelectorAll('tr.best').length >
        0,
      null,
      { timeout: 20000 }
    )
    assert.match(
      await ui.locator('#boardTitle').textContent(),
      /O \/ White.*5 ply/
    )
    assert.notEqual(await ui.locator('#eval').textContent(), '—')
    await ui.waitForFunction(
      () => document.getElementById('stateBadge').textContent === 'COMPLETE',
      null,
      { timeout: 20000 }
    )
    assert.ok((await page.locator('.gna-marker').count()) > 0)
    assert.equal(await ui.locator('#allowCompetitive').count(), 0)
    assert.equal(await ui.locator('#showRank').count(), 0)
    // Full VNCaro rerender with no state change must NOT restart the engine.
    const prior = await ui.locator('#time').textContent()
    await page.evaluate(() =>
      document.querySelectorAll('.cell').forEach((c) => {
        c.className = c.className
        c.innerHTML = c.innerHTML
      })
    )
    await ui.waitForTimeout(250)
    assert.equal(await ui.locator('#time').textContent(), prior)
    // New O move -> X turn; progress is for the new board only.
    await page.evaluate(() => {
      const c = document.getElementById('c9_11'),
        p = document.createElement('span')
      p.className = 'PO'
      p.setAttribute('aria-label', 'O')
      p.textContent = 'O'
      c.append(p)
    })
    await ui.waitForFunction(
      () =>
        document
          .getElementById('boardTitle')
          .textContent.includes('X / Black') &&
        document.getElementById('boardTitle').textContent.includes('6 ply')
    )
    await ui.waitForFunction(
      () => document.getElementById('stateBadge').textContent === 'COMPLETE',
      null,
      { timeout: 20000 }
    )
    await ui.setViewportSize({ width: 700, height: 940 })
    await ui.screenshot({
      path: path.join(os.tmpdir(), 'gna-analysis-v020.png'),
      fullPage: true,
    })
    await ui.locator('#settingsTab').click()
    await ui.locator('input[value="analysis"]').check()
    await ui.waitForTimeout(350)
    assert.equal(await ui.locator('#customSettings').isVisible(), false)
    await ui.screenshot({
      path: path.join(os.tmpdir(), 'gna-settings-v020.png'),
      fullPage: true,
    })
    // Settings migration: removed flags must not gate analysis.
    await ui.locator('#analyzeTab').click()
    await ui.locator('#stop').click()
    await ui.waitForFunction(
      () => document.getElementById('stateBadge').textContent === 'PAUSED'
    )
    // Reloaded UI recovers existing host state rather than starting a worker.
    await ui.reload()
    await ui.waitForFunction(
      () => document.getElementById('stateBadge').textContent === 'PAUSED'
    )
    assert.deepEqual(errors, [])
    console.log(
      'Browser PASS: real MV3 offscreen + WASM, live PV, turn sync, rerender dedupe, controls, settings, popup restore.'
    )
    console.log(
      'Screenshots: /tmp/gna-analysis-v020.png /tmp/gna-settings-v020.png'
    )
  } finally {
    await context.close()
  }
})().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
