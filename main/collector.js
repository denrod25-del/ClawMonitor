// main/collector.js
import { readCpu } from './collectors/cpu.js'
import { readMemory } from './collectors/memory.js'
import { readGpu } from './collectors/gpu.js'
import { readDisk } from './collectors/disk.js'
import { readNetwork } from './collectors/network.js'
import { readSensors } from './collectors/sensors.js'
import { readStack } from './collectors/stack.js'

export function withTimeout(promise, ms, label) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok:false, error:`${label} timed out` }), ms)
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve({ ok:true, value }) },
      (err)   => { clearTimeout(timer); resolve({ ok:false, error: String(err && err.message || err) }) }
    )
  })
}

export function mergeSnapshot(results, ts) {
  const snap = { ts, errors: {} }
  for (const key of ['cpu','memory','gpu','disk','network','sensors','stack']) {
    const r = results[key]
    if (!r) { snap[key] = null; continue }
    if (r.ok) snap[key] = r.value
    else { snap[key] = null; snap.errors[key] = r.error }
  }
  return snap
}

const FAST = { cpu: readCpu, memory: readMemory, gpu: readGpu, disk: readDisk, network: readNetwork, sensors: readSensors }
const SLOW = { stack: readStack }

function filterGroup(group, modules) {
  const out = {}
  for (const [k, fn] of Object.entries(group)) {
    if (modules && modules[k] === false) continue
    out[k] = fn
  }
  return out
}

export function createCollector({ cfg, onSnapshot, now = () => Date.now(), groups }) {
  const FAST_G = groups?.fast ?? FAST
  const SLOW_G = groups?.slow ?? SLOW
  const fast = filterGroup(FAST_G, cfg.modules)
  const slow = filterGroup(SLOW_G, cfg.modules)
  let last = {}
  async function runGroup(group, timeoutMs) {
    const entries = await Promise.all(
      Object.entries(group).map(async ([k, fn]) => [k, await withTimeout(fn(), timeoutMs, k)])
    )
    for (const [k, r] of entries) last[k] = r
    onSnapshot(mergeSnapshot(last, now()))
  }
  const fastTimer = setInterval(() => { runGroup(fast, Math.max(1500, cfg.pollFastMs - 200)).catch(() => {}) }, cfg.pollFastMs)
  const slowTimer = setInterval(() => { runGroup(slow, cfg.pollSlowMs - 500).catch(() => {}) }, cfg.pollSlowMs)
  // prime immediately
  runGroup(fast, cfg.pollFastMs).catch(() => {})
  runGroup(slow, cfg.pollSlowMs).catch(() => {})
  return { stop() { clearInterval(fastTimer); clearInterval(slowTimer) } }
}
