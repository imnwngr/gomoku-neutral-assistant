'use strict'

let engine = null

function locateFile(name) {
  const engineBase = new URL('./', self.location.href)
  if (/^rapfi.*\.data$/.test(name)) name = 'rapfi.data'
  return new URL(name, engineBase).href
}

self.onmessage = async function (event) {
  const message = event.data || {}
  if (message.type === 'command') {
    if (!engine) return self.postMessage({ type: 'error', data: 'Engine is not ready' })
    engine.sendCommand(message.data)
    return
  }
  if (message.type !== 'init' || engine) return

  try {
    importScripts(new URL('rapfi-single-simd128.js', self.location.href).href)
    engine = await self.Rapfi({
      locateFile,
      onReceiveStdout: (line) => self.postMessage({ type: 'stdout', data: line }),
      onReceiveStderr: (line) => self.postMessage({ type: 'stderr', data: line }),
      onExit: (code) => self.postMessage({ type: 'exit', data: code }),
      setStatus: (status) => self.postMessage({ type: 'status', data: status }),
      wasmMemory: new WebAssembly.Memory({ initial: 1024, maximum: 8192 }),
    })
    self.postMessage({ type: 'ready' })
  } catch (error) {
    self.postMessage({ type: 'error', data: error && error.message ? error.message : String(error) })
  }
}
