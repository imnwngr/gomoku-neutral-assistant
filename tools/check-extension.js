'use strict'

const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
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
  if (!fs.existsSync(path.join(root, item))) throw new Error('Missing extension file: ' + item)
}
for (const script of manifest.content_scripts.flatMap((entry) => [...entry.js, ...(entry.css || [])])) {
  if (!fs.existsSync(path.join(root, script))) throw new Error('Missing content asset: ' + script)
}
console.log('Manifest and packaged assets are valid.')
