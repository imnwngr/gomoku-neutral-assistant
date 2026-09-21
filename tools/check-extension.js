'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')
)
const required = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  'offscreen/offscreen.html',
  'engine/rapfi.worker.js',
  'engine/rapfi-single-simd128.js',
  'engine/rapfi-single-simd128.wasm',
  'engine/rapfi.data',
]
for (const item of required) {
  if (!fs.existsSync(path.join(root, item)))
    throw new Error('Missing extension file: ' + item)
}
for (const script of manifest.content_scripts.flatMap((entry) => [
  ...entry.js,
  ...(entry.css || []),
])) {
  if (!fs.existsSync(path.join(root, script)))
    throw new Error('Missing content asset: ' + script)
}
const sourceDirs = [
  'background',
  'content',
  'engine',
  'offscreen',
  'popup',
  'shared',
  'tools',
  'tests',
]
for (const dir of sourceDirs) {
  for (const name of fs.readdirSync(path.join(root, dir))) {
    if (!/\.(?:js|cjs)$/.test(name)) continue
    const result = spawnSync(
      process.execPath,
      ['--check', path.join(root, dir, name)],
      { encoding: 'utf8' }
    )
    if (result.status !== 0) throw new Error(result.stderr)
  }
}
for (const htmlFile of ['popup/popup.html', 'offscreen/offscreen.html']) {
  const html = fs.readFileSync(path.join(root, htmlFile), 'utf8')
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (!fs.existsSync(path.resolve(root, path.dirname(htmlFile), match[1])))
      throw new Error('Missing HTML asset: ' + match[1])
  }
}
const html = fs.readFileSync(path.join(root, 'popup/popup.html'), 'utf8')
const popup = fs.readFileSync(path.join(root, 'popup/popup.js'), 'utf8')
for (const match of popup.matchAll(/\$\('([^']+)'\)/g)) {
  if (!html.includes('id="' + match[1] + '"'))
    throw new Error('Missing UI element: ' + match[1])
}
if (manifest.version !== require('../package.json').version)
  throw new Error('Version mismatch')
console.log(
  'Manifest, packaged assets, JS syntax, HTML references and UI IDs are valid.'
)
