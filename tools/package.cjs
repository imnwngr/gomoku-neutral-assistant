'use strict'
// Dependency-free packaging for Windows (PowerShell) and Linux/macOS (zip).
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..'),
  version = require('../package.json').version
const source = process.argv.includes('--source'),
  stage = fs.mkdtempSync(path.join(os.tmpdir(), 'gna-package-'))
const name = `gomoku-neutral-assistant${
    source ? '-source' : ''
  }-v${version}.zip`,
  out = path.join(root, name)
if (fs.existsSync(out))
  throw new Error(
    'Archive already exists: ' + out + '. Move it aside before rebuilding.'
  )
const files = [
  'background',
  'content',
  'engine',
  'offscreen',
  'popup',
  'shared',
  'third_party',
  'manifest.json',
  'LICENSE',
  'README.md',
  'CHANGELOG.md',
]
if (source) files.push('tests', 'tools', 'package.json', '.gitignore')
for (const f of files)
  fs.cpSync(path.join(root, f), path.join(stage, f), { recursive: true })
let r
if (process.platform === 'win32') {
  const quote = (s) => "'" + s.replace(/'/g, "''") + "'"
  r = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path ${quote(
        path.join(stage, '*')
      )} -DestinationPath ${quote(out)}`,
    ],
    { stdio: 'inherit' }
  )
} else
  r = spawnSync('zip', ['-q', '-r', out, '.'], { cwd: stage, stdio: 'inherit' })
if (r.error) throw r.error
if (r.status !== 0) throw new Error('Packaging failed (' + r.status + ')')
console.log(out)
// The task-specific staging directory is left in OS temp, never delete user folders.
