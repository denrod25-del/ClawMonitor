# ClawMonitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a frameless, always-on-top neon "synthwave" system-monitor bar for Windows that shows live CPU/RAM/GPU/disk/network plus OpenClaw/WSL/Docker/Ollama health, expanding to a detail panel on hover.

**Architecture:** Electron app. The **main process** runs a collector orchestrator that polls modular collectors (each a pure-ish `read()` returning a typed slice) on a fast (2s) and slow (8s) timer, merges them into a `MetricsSnapshot`, and pushes it to the renderer over IPC. The **renderer** is a frameless transparent page that renders a collapsed strip and a hover panel purely from the latest snapshot. Pure logic (formatting, alert thresholds, config merge) lives in dependency-injected modules with unit tests; collectors are tested against stubbed `systeminformation`/probe deps.

**Tech Stack:** Node.js, Electron, [`systeminformation`](https://www.npmjs.com/package/systeminformation), Vitest (tests). Windows-only v1.

---

## Data contract (referenced by every task)

The orchestrator emits this `MetricsSnapshot`. Each collector returns its own slice or throws; the orchestrator replaces a failed slice with `null` and records the message in `errors`.

```js
// MetricsSnapshot
{
  ts: 1717000000000,
  cpu:     { loadPct: 28, perCore: [40,12,...], clockGHz: 3.9, top: [{name:'node', cpuPct:11}, ...] } | null,
  memory:  { usedPct: 41, usedGB: 19.6, totalGB: 47.9 } | null,
  gpu:     { model:'RTX 3070', utilPct:9, tempC:48, vramUsedGB:2.1, vramTotalGB:8.0, powerW:38, fanPct:0 } | null,
  disk:    { drives: [{ mount:'C:', freeGB:241, sizeGB:465, busyPct:14 }, ...] } | null,
  network: { rxMBs: 2.1, txMBs: 0.3 } | null,
  sensors: { available:true, cpuTempC:46, cpuFanPct:null } | null,
  stack:   { openclaw:true, wsl:{ up:true, vmmemGB:7.9 }, docker:false, ollama:true } | null,
  errors:  { gpu: 'nvidia-smi timed out' }   // only failing slices appear
}
```

Thresholds object (from config, see Task 4):
```js
{ cpuPct:90, gpuPct:90, tempC:80, diskFreeGB:10, ramPct:90 }
```

---

## File structure

```
ClawMonitor/
  package.json
  vitest.config.js
  .gitignore
  config.json                 # generated on first run
  main/
    index.js                  # Electron app: window, IPC, resize, login-item, auto-hide
    collector.js              # orchestrator + fast/slow timers + merge
    config.js                 # defaults + load/merge/save
    alerts.js                 # snapshot -> active alert keys (pure)
    format.js                 # unit/format helpers (pure)
    probe.js                  # httpOk / execOk / execOut (injectable I/O)
    collectors/
      cpu.js  memory.js  gpu.js  disk.js  network.js  sensors.js  stack.js
  renderer/
    index.html
    styles.css
    palette.js                # palette maps (classic-synthwave default)
    store.js                  # holds latest snapshot, notifies subscribers
    strip.js                  # renders collapsed bar
    panel.js                  # renders 3-tile hover panel
  test/
    format.test.js  alerts.test.js  config.test.js
    cpu.test.js  memory.test.js  gpu.test.js  disk.test.js
    network.test.js  sensors.test.js  stack.test.js
    collector.test.js  store.test.js
  docs/superpowers/...
```

---

### Task 1: Project scaffold

**Files:**
- Create: `ClawMonitor/package.json`
- Create: `ClawMonitor/vitest.config.js`
- Create: `ClawMonitor/.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "clawmonitor",
  "version": "0.1.0",
  "description": "Always-on-top neon system monitor bar for Windows",
  "main": "main/index.js",
  "scripts": {
    "start": "electron .",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "systeminformation": "^5.22.0"
  },
  "devDependencies": {
    "electron": "^31.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.js'] }
})
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
config.json
*.log
.superpowers/
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, electron + systeminformation + vitest present, no errors.

- [ ] **Step 5: Verify the test runner works (no tests yet)**

Run: `npm test`
Expected: Vitest runs and reports "No test files found" (exit non-zero is fine here) — confirms vitest is installed.

- [ ] **Step 6: Commit**

```bash
git init
git add package.json vitest.config.js .gitignore
git commit -m "chore: scaffold ClawMonitor project"
```

---

### Task 2: `format.js` — pure formatting helpers

**Files:**
- Create: `main/format.js`
- Test: `test/format.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { pct, gb, rateMBs, temp, clamp } from '../main/format.js'

describe('format', () => {
  it('pct rounds to whole percent', () => {
    expect(pct(28.4)).toBe('28%')
    expect(pct(28.6)).toBe('29%')
    expect(pct(null)).toBe('n/a')
  })
  it('gb converts bytes to GB with 1 decimal', () => {
    expect(gb(8 * 1024 ** 3)).toBe(8.0)
    expect(gb(2.15 * 1024 ** 3)).toBe(2.2)
  })
  it('rateMBs converts bytes/sec to MB/s with 1 decimal', () => {
    expect(rateMBs(2.1 * 1024 ** 2)).toBe(2.1)
    expect(rateMBs(null)).toBe(0)
  })
  it('temp formats celsius with degree sign', () => {
    expect(temp(48)).toBe('48°')
    expect(temp(null)).toBe('—')
  })
  it('clamp bounds a number', () => {
    expect(clamp(150, 0, 100)).toBe(100)
    expect(clamp(-5, 0, 100)).toBe(0)
    expect(clamp(50, 0, 100)).toBe(50)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/format.test.js`
Expected: FAIL — cannot resolve `../main/format.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// main/format.js
export function pct(n) {
  if (n == null || Number.isNaN(n)) return 'n/a'
  return `${Math.round(n)}%`
}
export function gb(bytes) {
  if (bytes == null) return 0
  return Math.round((bytes / 1024 ** 3) * 10) / 10
}
export function rateMBs(bytesPerSec) {
  if (bytesPerSec == null) return 0
  return Math.round((bytesPerSec / 1024 ** 2) * 10) / 10
}
export function temp(c) {
  if (c == null || Number.isNaN(c)) return '—'
  return `${Math.round(c)}°`
}
export function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/format.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add main/format.js test/format.test.js
git commit -m "feat: add pure formatting helpers"
```

---

### Task 3: `alerts.js` — threshold logic

**Files:**
- Create: `main/alerts.js`
- Test: `test/alerts.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { computeAlerts } from '../main/alerts.js'

const T = { cpuPct:90, gpuPct:90, tempC:80, diskFreeGB:10, ramPct:90 }

describe('computeAlerts', () => {
  it('returns empty when everything is healthy', () => {
    const snap = {
      cpu:{loadPct:30}, memory:{usedPct:40}, gpu:{utilPct:10,tempC:50},
      disk:{drives:[{mount:'C:',freeGB:200}]}, sensors:{cpuTempC:45},
      stack:{openclaw:true}
    }
    expect(computeAlerts(snap, T)).toEqual([])
  })
  it('flags cpu, gpu, temp, ram, disk and openclaw-down', () => {
    const snap = {
      cpu:{loadPct:95}, memory:{usedPct:92}, gpu:{utilPct:99,tempC:85},
      disk:{drives:[{mount:'C:',freeGB:5}]}, sensors:{cpuTempC:82},
      stack:{openclaw:false}
    }
    expect(computeAlerts(snap, T).sort()).toEqual(
      ['cpu','disk','gpu','openclaw','ram','temp'].sort()
    )
  })
  it('ignores null slices safely', () => {
    expect(computeAlerts({ cpu:null, gpu:null, stack:null }, T)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/alerts.test.js`
Expected: FAIL — cannot resolve `../main/alerts.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// main/alerts.js
export function computeAlerts(snap, t) {
  const a = new Set()
  if (snap.cpu && snap.cpu.loadPct >= t.cpuPct) a.add('cpu')
  if (snap.memory && snap.memory.usedPct >= t.ramPct) a.add('ram')
  if (snap.gpu) {
    if (snap.gpu.utilPct >= t.gpuPct) a.add('gpu')
    if (snap.gpu.tempC != null && snap.gpu.tempC >= t.tempC) a.add('temp')
  }
  if (snap.sensors && snap.sensors.cpuTempC != null && snap.sensors.cpuTempC >= t.tempC) a.add('temp')
  if (snap.disk) {
    for (const d of snap.disk.drives) if (d.freeGB < t.diskFreeGB) a.add('disk')
  }
  if (snap.stack && snap.stack.openclaw === false) a.add('openclaw')
  return [...a]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/alerts.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add main/alerts.js test/alerts.test.js
git commit -m "feat: add alert threshold logic"
```

---

### Task 4: `config.js` — defaults, merge, persistence

**Files:**
- Create: `main/config.js`
- Test: `test/config.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { DEFAULTS, mergeConfig } from '../main/config.js'

describe('config', () => {
  it('exposes sane defaults', () => {
    expect(DEFAULTS.palette).toBe('classic-synthwave')
    expect(DEFAULTS.edge).toBe('top')
    expect(DEFAULTS.pollFastMs).toBe(2000)
    expect(DEFAULTS.thresholds.cpuPct).toBe(90)
  })
  it('deep-merges user overrides over defaults', () => {
    const merged = mergeConfig({ palette:'toxic', thresholds:{ cpuPct:80 } })
    expect(merged.palette).toBe('toxic')
    expect(merged.thresholds.cpuPct).toBe(80)
    expect(merged.thresholds.tempC).toBe(80)   // default preserved
    expect(merged.edge).toBe('top')            // default preserved
  })
  it('ignores null/undefined user config', () => {
    expect(mergeConfig(null).palette).toBe('classic-synthwave')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/config.test.js`
Expected: FAIL — cannot resolve `../main/config.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// main/config.js
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

export const DEFAULTS = {
  palette: 'classic-synthwave',
  edge: 'top',
  autoHide: false,
  scanline: false,
  launchAtLogin: false,
  pollFastMs: 2000,
  pollSlowMs: 8000,
  modules: { sensors: true, stack: true, network: true, disk: true },
  thresholds: { cpuPct: 90, gpuPct: 90, tempC: 80, diskFreeGB: 10, ramPct: 90 }
}

function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v) }

function deepMerge(base, over) {
  if (!isObj(over)) return base
  const out = Array.isArray(base) ? [...base] : { ...base }
  for (const k of Object.keys(over)) {
    out[k] = isObj(base[k]) && isObj(over[k]) ? deepMerge(base[k], over[k]) : over[k]
  }
  return out
}

export function mergeConfig(user) { return deepMerge(DEFAULTS, user || {}) }

export function loadConfig(path) {
  if (!existsSync(path)) { writeFileSync(path, JSON.stringify(DEFAULTS, null, 2)); return { ...DEFAULTS } }
  try { return mergeConfig(JSON.parse(readFileSync(path, 'utf8'))) }
  catch { return { ...DEFAULTS } }
}

export function saveConfig(path, cfg) { writeFileSync(path, JSON.stringify(cfg, null, 2)) }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/config.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add main/config.js test/config.test.js
git commit -m "feat: add config defaults and deep-merge"
```

---

### Task 5: `probe.js` — injectable I/O helpers

**Files:**
- Create: `main/probe.js`

(No unit test: this is the thin I/O boundary that collectors mock. It is exercised indirectly by collector tests via injection.)

- [ ] **Step 1: Write implementation**

```js
// main/probe.js
import http from 'node:http'
import { exec } from 'node:child_process'

export function httpOk(url, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume()
      resolve(res.statusCode >= 200 && res.statusCode < 400)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(false) })
  })
}

export function execOut(cmd, timeoutMs = 4000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: timeoutMs, windowsHide: true }, (err, stdout) => {
      resolve(err ? null : String(stdout))
    })
  })
}

export async function execOk(cmd, timeoutMs = 4000) {
  return (await execOut(cmd, timeoutMs)) != null
}
```

- [ ] **Step 2: Sanity-check it loads**

Run: `node -e "import('./main/probe.js').then(m=>console.log(Object.keys(m)))"`
Expected: prints `[ 'httpOk', 'execOut', 'execOk' ]`.

- [ ] **Step 3: Commit**

```bash
git add main/probe.js
git commit -m "feat: add injectable http/exec probe helpers"
```

---

### Task 6: `collectors/cpu.js`

**Files:**
- Create: `main/collectors/cpu.js`
- Test: `test/cpu.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest'
import { readCpu } from '../main/collectors/cpu.js'

const fakeSi = {
  currentLoad: vi.fn(async () => ({ currentLoad: 27.6, cpus: [{load:40},{load:12}] })),
  cpuCurrentSpeed: vi.fn(async () => ({ avg: 3.9 })),
  processes: vi.fn(async () => ({ list: [
    { name:'node', cpu: 11.2 }, { name:'blender', cpu: 6.1 },
    { name:'chrome', cpu: 4.0 }, { name:'idle', cpu: 0 }
  ] }))
}

describe('readCpu', () => {
  it('maps load, per-core, clock and top-3 processes', async () => {
    const out = await readCpu(fakeSi)
    expect(out.loadPct).toBe(28)
    expect(out.perCore).toEqual([40, 12])
    expect(out.clockGHz).toBe(3.9)
    expect(out.top).toEqual([
      { name:'node', cpuPct:11 }, { name:'blender', cpuPct:6 }, { name:'chrome', cpuPct:4 }
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/cpu.test.js`
Expected: FAIL — cannot resolve `../main/collectors/cpu.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// main/collectors/cpu.js
import * as siDefault from 'systeminformation'

export async function readCpu(si = siDefault) {
  const [load, speed, procs] = await Promise.all([
    si.currentLoad(), si.cpuCurrentSpeed(), si.processes()
  ])
  const top = [...procs.list]
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, 3)
    .map(p => ({ name: p.name, cpuPct: Math.round(p.cpu) }))
  return {
    loadPct: Math.round(load.currentLoad),
    perCore: load.cpus.map(c => Math.round(c.load)),
    clockGHz: speed.avg,
    top
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/cpu.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add main/collectors/cpu.js test/cpu.test.js
git commit -m "feat: add cpu collector"
```

---

### Task 7: `collectors/memory.js`

**Files:**
- Create: `main/collectors/memory.js`
- Test: `test/memory.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest'
import { readMemory } from '../main/collectors/memory.js'

const GB = 1024 ** 3
const fakeSi = {
  mem: vi.fn(async () => ({ total: 47.9 * GB, active: 19.6 * GB }))
}

describe('readMemory', () => {
  it('maps used/total GB and used percent from active memory', async () => {
    const out = await readMemory(fakeSi)
    expect(out.totalGB).toBe(47.9)
    expect(out.usedGB).toBe(19.6)
    expect(out.usedPct).toBe(41)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/memory.test.js`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write minimal implementation**

```js
// main/collectors/memory.js
import * as siDefault from 'systeminformation'

export async function readMemory(si = siDefault) {
  const m = await si.mem()
  const usedGB = Math.round((m.active / 1024 ** 3) * 10) / 10
  const totalGB = Math.round((m.total / 1024 ** 3) * 10) / 10
  return { usedGB, totalGB, usedPct: Math.round((m.active / m.total) * 100) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/memory.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add main/collectors/memory.js test/memory.test.js
git commit -m "feat: add memory collector"
```

---

### Task 8: `collectors/gpu.js`

**Files:**
- Create: `main/collectors/gpu.js`
- Test: `test/gpu.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest'
import { readGpu } from '../main/collectors/gpu.js'

describe('readGpu', () => {
  it('maps the first NVIDIA controller', async () => {
    const si = { graphics: vi.fn(async () => ({ controllers: [{
      vendor:'NVIDIA', model:'NVIDIA GeForce RTX 3070',
      utilizationGpu: 9, temperatureGpu: 48,
      memoryUsed: 2150, memoryTotal: 8192, powerDraw: 38, fanSpeed: 0
    }] })) }
    const out = await readGpu(si)
    expect(out.model).toContain('RTX 3070')
    expect(out.utilPct).toBe(9)
    expect(out.tempC).toBe(48)
    expect(out.vramUsedGB).toBe(2.1)
    expect(out.vramTotalGB).toBe(8.0)
    expect(out.powerW).toBe(38)
    expect(out.fanPct).toBe(0)
  })
  it('returns null when no usable controller is present', async () => {
    const si = { graphics: vi.fn(async () => ({ controllers: [] })) }
    expect(await readGpu(si)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/gpu.test.js`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write minimal implementation**

```js
// main/collectors/gpu.js
import * as siDefault from 'systeminformation'

export async function readGpu(si = siDefault) {
  const { controllers } = await si.graphics()
  const g = controllers.find(c => c.utilizationGpu != null || /nvidia/i.test(c.vendor || ''))
  if (!g) return null
  const mb = v => (v == null ? null : Math.round((v / 1024) * 10) / 10)
  return {
    model: g.model,
    utilPct: Math.round(g.utilizationGpu ?? 0),
    tempC: g.temperatureGpu ?? null,
    vramUsedGB: mb(g.memoryUsed),
    vramTotalGB: mb(g.memoryTotal),
    powerW: g.powerDraw == null ? null : Math.round(g.powerDraw),
    fanPct: g.fanSpeed ?? null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/gpu.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add main/collectors/gpu.js test/gpu.test.js
git commit -m "feat: add gpu collector"
```

---

### Task 9: `collectors/disk.js`

**Files:**
- Create: `main/collectors/disk.js`
- Test: `test/disk.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest'
import { readDisk } from '../main/collectors/disk.js'

const GB = 1024 ** 3
describe('readDisk', () => {
  it('maps each drive to mount/free/size/busy', async () => {
    const si = { fsSize: vi.fn(async () => [
      { mount:'C:', size: 465*GB, available: 241*GB, use: 48.2 },
      { mount:'D:', size: 930*GB, available: 800*GB, use: 14.0 }
    ]) }
    const out = await readDisk(si)
    expect(out.drives).toEqual([
      { mount:'C:', freeGB:241, sizeGB:465, busyPct:48 },
      { mount:'D:', freeGB:800, sizeGB:930, busyPct:14 }
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/disk.test.js`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write minimal implementation**

```js
// main/collectors/disk.js
import * as siDefault from 'systeminformation'

export async function readDisk(si = siDefault) {
  const list = await si.fsSize()
  const round = b => Math.round(b / 1024 ** 3)
  return {
    drives: list.map(d => ({
      mount: d.mount,
      freeGB: round(d.available),
      sizeGB: round(d.size),
      busyPct: Math.round(d.use)
    }))
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/disk.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add main/collectors/disk.js test/disk.test.js
git commit -m "feat: add disk collector"
```

---

### Task 10: `collectors/network.js`

**Files:**
- Create: `main/collectors/network.js`
- Test: `test/network.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest'
import { readNetwork } from '../main/collectors/network.js'

describe('readNetwork', () => {
  it('sums rx/tx byte rates across interfaces', async () => {
    const si = { networkStats: vi.fn(async () => [
      { rx_sec: 2.0 * 1024**2, tx_sec: 0.2 * 1024**2 },
      { rx_sec: 0.1 * 1024**2, tx_sec: 0.1 * 1024**2 }
    ]) }
    const out = await readNetwork(si)
    expect(out.rxMBs).toBe(2.1)
    expect(out.txMBs).toBe(0.3)
  })
  it('treats null rates as zero', async () => {
    const si = { networkStats: vi.fn(async () => [{ rx_sec: null, tx_sec: null }]) }
    expect(await readNetwork(si)).toEqual({ rxMBs: 0, txMBs: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/network.test.js`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write minimal implementation**

```js
// main/collectors/network.js
import * as siDefault from 'systeminformation'

export async function readNetwork(si = siDefault) {
  const stats = await si.networkStats()
  const sum = (k) => stats.reduce((t, s) => t + (s[k] || 0), 0)
  const mb = b => Math.round((b / 1024 ** 2) * 10) / 10
  return { rxMBs: mb(sum('rx_sec')), txMBs: mb(sum('tx_sec')) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/network.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add main/collectors/network.js test/network.test.js
git commit -m "feat: add network collector"
```

---

### Task 11: `collectors/sensors.js`

**Files:**
- Create: `main/collectors/sensors.js`
- Test: `test/sensors.test.js`

CPU temp/fan depend on LibreHardwareMonitor being present; `si.cpuTemperature().main` is `null`/`-1` when unavailable. The collector reports `available:false` in that case. CPU fan is not reliably exposed by `systeminformation`; v1 always reports `cpuFanPct: null`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest'
import { readSensors } from '../main/collectors/sensors.js'

describe('readSensors', () => {
  it('reports available temp when LibreHardwareMonitor exposes it', async () => {
    const si = { cpuTemperature: vi.fn(async () => ({ main: 46.0, max: 52 })) }
    expect(await readSensors(si)).toEqual({ available:true, cpuTempC:46, cpuFanPct:null })
  })
  it('reports unavailable when temp is null or -1', async () => {
    const si = { cpuTemperature: vi.fn(async () => ({ main: null })) }
    expect(await readSensors(si)).toEqual({ available:false, cpuTempC:null, cpuFanPct:null })
    const si2 = { cpuTemperature: vi.fn(async () => ({ main: -1 })) }
    expect(await readSensors(si2)).toEqual({ available:false, cpuTempC:null, cpuFanPct:null })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/sensors.test.js`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write minimal implementation**

```js
// main/collectors/sensors.js
import * as siDefault from 'systeminformation'

export async function readSensors(si = siDefault) {
  const t = await si.cpuTemperature()
  const ok = t.main != null && t.main > 0
  return {
    available: ok,
    cpuTempC: ok ? Math.round(t.main) : null,
    cpuFanPct: null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/sensors.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add main/collectors/sensors.js test/sensors.test.js
git commit -m "feat: add sensors collector (LHM-aware)"
```

---

### Task 12: `collectors/stack.js`

**Files:**
- Create: `main/collectors/stack.js`
- Test: `test/stack.test.js`

Uses injected probe functions so no real I/O happens in tests. WSL vmmem is parsed from `tasklist` CSV for `vmmemWSL.exe`/`vmmem.exe` (memory column like `"7,340,116 K"`).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest'
import { readStack } from '../main/collectors/stack.js'

describe('readStack', () => {
  it('reports health from probes and parses vmmem from tasklist', async () => {
    const deps = {
      httpOk: vi.fn(async (url) => url.includes('18789') || url.includes('11434')),
      execOk: vi.fn(async (cmd) => !cmd.startsWith('docker')),   // docker down
      execOut: vi.fn(async () => '"vmmemWSL.exe","9000","Console","1","7,340,116 K"\n')
    }
    const out = await readStack(deps)
    expect(out.openclaw).toBe(true)
    expect(out.ollama).toBe(true)
    expect(out.docker).toBe(false)
    expect(out.wsl.up).toBe(true)
    expect(out.wsl.vmmemGB).toBe(7.0)   // 7,340,116 KB -> ~7.0 GB
  })
  it('reports wsl down and zero vmmem when tasklist has no match', async () => {
    const deps = {
      httpOk: vi.fn(async () => false),
      execOk: vi.fn(async () => false),
      execOut: vi.fn(async () => 'INFO: No tasks are running which match the specified criteria.\n')
    }
    const out = await readStack(deps)
    expect(out.wsl).toEqual({ up:false, vmmemGB:null })
    expect(out.openclaw).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/stack.test.js`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write minimal implementation**

```js
// main/collectors/stack.js
import * as probe from '../probe.js'

function parseVmmemGB(tasklistOut) {
  if (!tasklistOut) return null
  // CSV rows: "name","pid","session","sessionNo","12,345 K"
  let totalKB = 0, matched = false
  for (const line of tasklistOut.split(/\r?\n/)) {
    const m = /^"(vmmem(?:WSL)?\.exe)",.*?,"([\d,]+) K"\s*$/i.exec(line)
    if (m) { matched = true; totalKB += Number(m[2].replace(/,/g, '')) }
  }
  if (!matched) return null
  return Math.round((totalKB / 1024 / 1024) * 10) / 10
}

export async function readStack(deps = probe) {
  const { httpOk, execOk, execOut } = deps
  const [openclaw, ollama, docker, vmmemOut] = await Promise.all([
    httpOk('http://127.0.0.1:18789/'),
    httpOk('http://127.0.0.1:11434/'),
    execOk('docker ps --format "{{.ID}}"'),
    execOut('tasklist /FI "IMAGENAME eq vmmemWSL.exe" /FI "IMAGENAME eq vmmem.exe" /FO CSV /NH')
  ])
  const vmmemGB = parseVmmemGB(vmmemOut)
  return { openclaw, ollama, docker, wsl: { up: vmmemGB != null, vmmemGB } }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/stack.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add main/collectors/stack.js test/stack.test.js
git commit -m "feat: add stack health collector"
```

---

### Task 13: `collector.js` — orchestrator

**Files:**
- Create: `main/collector.js`
- Test: `test/collector.test.js`

The orchestrator wraps each collector with a timeout + try/catch, merges results into a `MetricsSnapshot`, and calls `onSnapshot`. Fast collectors run on `pollFastMs`; `stack` runs on `pollSlowMs`. It is built with injected collector functions + injected timer hooks so it is fully unit-testable without Electron or real timers.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest'
import { mergeSnapshot, withTimeout } from '../main/collector.js'

describe('collector helpers', () => {
  it('mergeSnapshot keeps successes and records errors for failures', () => {
    const results = {
      cpu: { ok:true, value:{ loadPct:30 } },
      gpu: { ok:false, error:'nvidia-smi timed out' }
    }
    const snap = mergeSnapshot(results, 1717000000000)
    expect(snap.ts).toBe(1717000000000)
    expect(snap.cpu).toEqual({ loadPct:30 })
    expect(snap.gpu).toBeNull()
    expect(snap.errors).toEqual({ gpu:'nvidia-smi timed out' })
  })

  it('withTimeout resolves ok:false when the call exceeds the limit', async () => {
    vi.useFakeTimers()
    const slow = new Promise(r => setTimeout(() => r('late'), 5000))
    const p = withTimeout(slow, 100, 'slow')
    await vi.advanceTimersByTimeAsync(150)
    await expect(p).resolves.toEqual({ ok:false, error:'slow timed out' })
    vi.useRealTimers()
  })

  it('withTimeout resolves ok:true with the value on success', async () => {
    const p = withTimeout(Promise.resolve({ loadPct:30 }), 100, 'cpu')
    await expect(p).resolves.toEqual({ ok:true, value:{ loadPct:30 } })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/collector.test.js`
Expected: FAIL — cannot resolve `../main/collector.js`.

- [ ] **Step 3: Write minimal implementation**

```js
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

export function createCollector({ cfg, onSnapshot, now = () => Date.now() }) {
  let last = {}
  async function runGroup(group, timeoutMs) {
    const entries = await Promise.all(
      Object.entries(group).map(async ([k, fn]) => [k, await withTimeout(fn(), timeoutMs, k)])
    )
    for (const [k, r] of entries) last[k] = r
    onSnapshot(mergeSnapshot(last, now()))
  }
  const fastTimer = setInterval(() => runGroup(FAST, Math.max(1500, cfg.pollFastMs - 200)), cfg.pollFastMs)
  const slowTimer = setInterval(() => runGroup(SLOW, cfg.pollSlowMs - 500), cfg.pollSlowMs)
  // prime immediately
  runGroup(FAST, cfg.pollFastMs); runGroup(SLOW, cfg.pollSlowMs)
  return { stop() { clearInterval(fastTimer); clearInterval(slowTimer) } }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/collector.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests from Tasks 2–13 PASS.

- [ ] **Step 6: Commit**

```bash
git add main/collector.js test/collector.test.js
git commit -m "feat: add collector orchestrator with timeout + merge"
```

---

### Task 14: `renderer/palette.js` + `renderer/store.js`

**Files:**
- Create: `renderer/palette.js`
- Create: `renderer/store.js`
- Test: `test/store.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../renderer/store.js'

describe('store', () => {
  it('holds the latest snapshot and notifies subscribers', () => {
    const store = createStore()
    const sub = vi.fn()
    store.subscribe(sub)
    store.set({ ts:1, cpu:{ loadPct:30 } })
    expect(store.get().cpu.loadPct).toBe(30)
    expect(sub).toHaveBeenCalledWith(store.get())
  })
  it('starts with a null-ish empty snapshot', () => {
    expect(createStore().get()).toEqual({ ts:0, errors:{} })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/store.test.js`
Expected: FAIL — cannot resolve `../renderer/store.js`.

- [ ] **Step 3: Write `store.js`**

```js
// renderer/store.js
export function createStore() {
  let snap = { ts: 0, errors: {} }
  const subs = new Set()
  return {
    get: () => snap,
    set(next) { snap = next; for (const s of subs) s(snap) },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn) }
  }
}
```

- [ ] **Step 4: Write `palette.js`**

```js
// renderer/palette.js
export const PALETTES = {
  'classic-synthwave': {
    cpu:'#22d3ee', ram:'#34d399', gpu:'#f472b6', net:'#a78bfa',
    disk:'#fb923c', warn:'#fbbf24', up:'#34d399', down:'#475569',
    border:'#7c3aed', glow:'rgba(124,58,237,0.55)'
  },
  'tron-ice':  { cpu:'#22d3ee', ram:'#67e8f9', gpu:'#38bdf8', net:'#7dd3fc', disk:'#0ea5e9', warn:'#fbbf24', up:'#22d3ee', down:'#475569', border:'#0ea5e9', glow:'rgba(14,165,233,0.55)' },
  'toxic':     { cpu:'#a3e635', ram:'#34d399', gpu:'#22d3ee', net:'#84cc16', disk:'#eab308', warn:'#f59e0b', up:'#a3e635', down:'#475569', border:'#65a30d', glow:'rgba(101,163,13,0.55)' }
}
export function palette(name) { return PALETTES[name] || PALETTES['classic-synthwave'] }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/store.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add renderer/palette.js renderer/store.js test/store.test.js
git commit -m "feat: add renderer store and palette map"
```

---

### Task 15: Renderer views — `strip.js` and `panel.js`

**Files:**
- Create: `renderer/strip.js`
- Create: `renderer/panel.js`

These build DOM strings from a snapshot using the `format` helpers and the active palette. They are exercised visually in Task 17; keep them pure (snapshot → HTML string) so they could be tested later, but no unit test is required here.

- [ ] **Step 1: Write `strip.js`**

```js
// renderer/strip.js
import { pct, temp, rateMBs } from '../main/format.js'

const seg = (label, color, value, extra = '') =>
  `<span class="seg" style="color:${color};text-shadow:0 0 9px ${color}">${label} <b>${value}</b>${extra}</span>`

export function renderStrip(snap, pal, alerts = []) {
  const a = new Set(alerts)
  const cls = k => a.has(k) ? ' class="seg alert"' : ''
  const cpu = snap.cpu ? seg('CPU', pal.cpu, pct(snap.cpu.loadPct)) : ''
  const ram = snap.memory ? seg('RAM', pal.ram, pct(snap.memory.usedPct)) : ''
  const gpu = snap.gpu
    ? seg('GPU', pal.gpu, pct(snap.gpu.utilPct),
        snap.gpu.tempC != null ? ` <span style="color:${pal.warn}">${temp(snap.gpu.tempC)}</span>` : '')
    : ''
  const net = snap.network ? seg('NET', pal.net, `↓${rateMBs(snap.network.rxMBs*1024**2)}`) : ''
  const disk = snap.disk && snap.disk.drives[0] ? seg('DISK', pal.disk, pct(snap.disk.drives[0].busyPct)) : ''
  const dot = (on, label) =>
    `<span style="color:${on ? pal.up : pal.down};text-shadow:${on ? `0 0 8px ${pal.up}` : 'none'}">●${label}</span>`
  const st = snap.stack
  const dots = st
    ? `<span class="dots">${dot(st.wsl?.up, 'WSL')} ${dot(st.openclaw, 'CLAW')} ${dot(st.docker, 'DOCK')}</span>`
    : ''
  const clock = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
  return `${cpu}${ram}${gpu}${net}${disk}<span class="spacer"></span>${dots}<span class="clock">${clock}</span>`
}
```

- [ ] **Step 2: Write `panel.js`**

```js
// renderer/panel.js
import { pct, gb, temp } from '../main/format.js'

function bars(perCore, color) {
  return `<div class="bars">${perCore.map(v =>
    `<i style="height:${Math.max(4, v)}%;background:${color};box-shadow:0 0 6px ${color}"></i>`).join('')}</div>`
}
function rows(pairs) {
  return pairs.map(([k, v]) => `<div class="row"><span>${k}</span><span class="v">${v}</span></div>`).join('')
}

export function renderPanel(snap, pal) {
  const c = snap.cpu, g = snap.gpu, m = snap.memory, s = snap.sensors, st = snap.stack, d = snap.disk
  const cpuTemp = s && s.available ? ` · ${temp(s.cpuTempC)}` : ''
  const cpuTile = c ? `
    <div class="tile" style="border-color:#1e3a8a">
      <div class="th" style="color:${pal.cpu};text-shadow:0 0 8px ${pal.cpu}">CPU · ${pct(c.loadPct)} · ${c.clockGHz}GHz${cpuTemp}</div>
      ${bars(c.perCore, pal.cpu)}
      ${rows(c.top.map(p => [p.name, `${p.cpuPct}%`]))}
    </div>` : ''
  const gpuTile = `
    <div class="tile" style="border-color:#831843">
      <div class="th" style="color:${pal.gpu};text-shadow:0 0 8px ${pal.gpu}">${g ? `GPU · ${g.model.replace(/NVIDIA GeForce /,'')} · ${pct(g.utilPct)} · ${temp(g.tempC)}` : 'GPU · n/a'}</div>
      ${g ? rows([
        ['VRAM', `${g.vramUsedGB} / ${g.vramTotalGB} GB`],
        ['Power', g.powerW != null ? `${g.powerW} W` : 'n/a'],
        ['Fan', g.fanPct != null ? `${g.fanPct}%` : 'n/a']
      ]) : ''}
      <div class="hr" style="background:#831843"></div>
      <div class="th" style="color:${pal.ram};text-shadow:0 0 8px ${pal.ram}">${m ? `RAM · ${pct(m.usedPct)} · ${m.usedGB}/${m.totalGB} GB` : 'RAM · n/a'}</div>
      ${st ? rows([['vmmem (WSL)', st.wsl.vmmemGB != null ? `${st.wsl.vmmemGB} GB` : '—']]) : ''}
    </div>`
  const dot = on => `<span style="color:${on ? pal.up : pal.down};text-shadow:${on?`0 0 6px ${pal.up}`:'none'}">●</span>`
  const stackTile = `
    <div class="tile" style="border-color:#6d28d9">
      <div class="th" style="color:${pal.net};text-shadow:0 0 8px ${pal.net}">YOUR STACK</div>
      ${st ? `
        <div class="row">${dot(st.openclaw)} OpenClaw <span class="v">:18789</span></div>
        <div class="row">${dot(st.wsl.up)} WSL <span class="v">${st.wsl.vmmemGB != null ? st.wsl.vmmemGB+' GB' : 'down'}</span></div>
        <div class="row">${dot(st.docker)} Docker <span class="v">${st.docker ? 'up' : 'stopped'}</span></div>
        <div class="row">${dot(st.ollama)} Ollama <span class="v">:11434</span></div>` : '<div class="row">n/a</div>'}
      <div class="hr" style="background:#6d28d9"></div>
      <div class="th" style="color:${pal.disk};text-shadow:0 0 8px ${pal.disk}">DISK</div>
      ${d ? d.drives.map(dr => `<div class="row"><span>${dr.mount}</span><span class="v">${dr.freeGB} GB free</span></div>`).join('') : ''}
    </div>`
  return `<div class="panel">${cpuTile}${gpuTile}${stackTile}</div>`
}
```

- [ ] **Step 3: Sanity-check both modules load**

Run: `node -e "Promise.all([import('./renderer/strip.js'),import('./renderer/panel.js')]).then(([a,b])=>console.log(typeof a.renderStrip, typeof b.renderPanel))"`
Expected: prints `function function`.

- [ ] **Step 4: Commit**

```bash
git add renderer/strip.js renderer/panel.js
git commit -m "feat: add strip and panel renderers"
```

---

### Task 16: `renderer/index.html` + `renderer/styles.css`

**Files:**
- Create: `renderer/index.html`
- Create: `renderer/styles.css`

- [ ] **Step 1: Write `index.html`**

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div id="bar"></div>
  <div id="panelHost"></div>
  <script type="module">
    import { createStore } from './store.js'
    import { palette } from './palette.js'
    import { renderStrip } from './strip.js'
    import { renderPanel } from './panel.js'
    import { computeAlerts } from '../main/alerts.js'

    const store = createStore()
    let cfg = { palette:'classic-synthwave', thresholds:{ cpuPct:90,gpuPct:90,tempC:80,diskFreeGB:10,ramPct:90 } }
    let pinned = false

    const bar = document.getElementById('bar')
    const host = document.getElementById('panelHost')

    function paint() {
      const snap = store.get()
      const pal = palette(cfg.palette)
      const alerts = computeAlerts(snap, cfg.thresholds)
      document.body.style.setProperty('--border', pal.border)
      document.body.style.setProperty('--glow', pal.glow)
      bar.innerHTML = renderStrip(snap, pal, alerts)
      if (host.dataset.open === '1') host.innerHTML = renderPanel(snap, pal)
    }

    function openPanel(open) {
      host.dataset.open = open ? '1' : '0'
      host.innerHTML = open ? renderPanel(store.get(), palette(cfg.palette)) : ''
      window.clawmonitor.setPanel(open)   // ask main to resize the window
    }

    bar.addEventListener('mouseenter', () => { if (!pinned) openPanel(true) })
    host.addEventListener('mouseleave', () => { if (!pinned) openPanel(false) })
    bar.addEventListener('click', () => { pinned = !pinned; openPanel(pinned) })

    store.subscribe(paint)
    window.clawmonitor.onMetrics(snap => store.set(snap))
    window.clawmonitor.onConfig(c => { cfg = c; paint() })
    paint()
  </script>
</body>
</html>
```

- [ ] **Step 2: Write `styles.css`**

```css
* { margin:0; box-sizing:border-box; }
html,body { background:transparent; overflow:hidden; font-family:'Cascadia Code',Consolas,monospace; user-select:none; }
#bar {
  height:34px; display:flex; align-items:center; font-size:13px; color:#cbd5e1;
  background:rgba(10,7,28,0.85); border-bottom:1px solid var(--border,#7c3aed);
  box-shadow:0 0 20px var(--glow,rgba(124,58,237,0.55)), inset 0 0 14px rgba(124,58,237,0.12);
  -webkit-app-region: drag;
}
.seg { padding:0 13px; -webkit-app-region:no-drag; }
.seg b { color:#e2e8f0; }
.spacer { flex:1; }
.dots span { margin:0 4px; }
.dots, .clock { padding:0 10px; font-size:12px; }
.clock { color:#64748b; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
.seg.alert { color:#ef4444 !important; text-shadow:0 0 10px #ef4444 !important; animation:pulse 1s infinite; }
.panel { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; padding:12px;
  background:rgba(7,4,16,0.94); border-bottom:1px solid var(--border,#7c3aed); }
.tile { background:rgba(10,7,28,0.8); border:1px solid #333; border-radius:8px; padding:11px; font-size:11px; }
.th { font-size:11px; margin-bottom:8px; }
.bars { display:flex; gap:2px; align-items:flex-end; height:28px; margin-bottom:9px; }
.bars i { flex:1; display:block; }
.row { display:flex; justify-content:space-between; color:#94a3b8; line-height:1.85; font-size:10px; }
.row .v { color:#e2e8f0; }
.hr { height:1px; margin:7px 0; opacity:.7; }
```

- [ ] **Step 3: Commit**

```bash
git add renderer/index.html renderer/styles.css
git commit -m "feat: add renderer html/css shell"
```

---

### Task 17: Electron main — window, IPC, preload

**Files:**
- Create: `main/index.js`
- Create: `main/preload.js`

The main process creates the frameless transparent always-on-top window, loads config, starts the collector, forwards snapshots to the renderer, and resizes the window when the panel opens/closes. A preload script exposes a minimal `window.clawmonitor` bridge.

- [ ] **Step 1: Write `main/preload.js`**

```js
// main/preload.js
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('clawmonitor', {
  onMetrics: (cb) => ipcRenderer.on('metrics:update', (_e, snap) => cb(snap)),
  onConfig:  (cb) => ipcRenderer.on('config:update', (_e, cfg) => cb(cfg)),
  setPanel:  (open) => ipcRenderer.send('panel:set', open)
})
```

- [ ] **Step 2: Write `main/index.js`**

```js
// main/index.js
import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadConfig } from './config.js'
import { createCollector } from './collector.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BAR_H = 34, PANEL_H = 190
const CFG_PATH = join(app.getPath('userData'), 'config.json')

let win, cfg

function build() {
  cfg = loadConfig(CFG_PATH)
  const { width } = screen.getPrimaryDisplay().workAreaSize
  win = new BrowserWindow({
    x: 0, y: 0, width, height: BAR_H,
    frame: false, transparent: true, resizable: false, movable: false,
    skipTaskbar: true, alwaysOnTop: true, focusable: false,
    webPreferences: { preload: join(__dirname, 'preload.js'), contextIsolation: true }
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.loadFile(join(__dirname, '..', 'renderer', 'index.html'))
  win.webContents.on('did-finish-load', () => win.webContents.send('config:update', cfg))

  ipcMain.on('panel:set', (_e, open) => {
    const { width } = screen.getPrimaryDisplay().workAreaSize
    win.setBounds({ x:0, y:0, width, height: open ? BAR_H + PANEL_H : BAR_H })
  })

  const collector = createCollector({ cfg, onSnapshot: (snap) => {
    if (win && !win.isDestroyed()) win.webContents.send('metrics:update', snap)
  }})
  app.on('before-quit', () => collector.stop())
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.whenReady().then(build)
  app.on('window-all-closed', () => app.quit())
}
```

- [ ] **Step 3: Make `package.json` ESM-aware for `main/index.js`**

The main process uses `import`. Add `"type": "module"` to `package.json` so Node/Electron treat `.js` as ESM. The preload stays CommonJS — rename it to `main/preload.cjs` and update the path in `main/index.js` (`'preload.cjs'`) and the require stays valid because `.cjs` is always CommonJS.

Edit `package.json` to add at top level: `"type": "module",`
Rename: `git mv main/preload.js main/preload.cjs` and change `preload.js` → `preload.cjs` in `main/index.js`.

- [ ] **Step 4: Confirm the test suite still passes (ESM change can break imports)**

Run: `npm test`
Expected: all prior tests still PASS (they already use ESM `import`).

- [ ] **Step 5: Launch the app**

Run: `npm start`
Expected: a thin glowing neon bar appears pinned to the top of the screen showing live CPU/RAM/GPU/NET/DISK and WSL/CLAW/DOCK dots. Hovering drops the 3-tile panel; clicking pins it.

- [ ] **Step 6: Commit**

```bash
git add main/index.js main/preload.cjs package.json
git commit -m "feat: add electron main process, preload bridge, and window"
```

---

### Task 18: Launch-at-login + manual end-to-end verification

**Files:**
- Modify: `main/index.js` (apply login-item setting)

- [ ] **Step 1: Apply the login-item setting from config**

Add inside `build()` after `cfg = loadConfig(CFG_PATH)`:

```js
app.setLoginItemSettings({ openAtLogin: !!cfg.launchAtLogin })
```

- [ ] **Step 2: Verify live metrics match reality**

Run: `npm start`, then in a second terminal run `nvidia-smi` and PowerShell `Get-CimInstance Win32_Processor | % LoadPercentage`.
Expected: the bar's GPU% / temp roughly match `nvidia-smi`; CPU% roughly matches the PowerShell reading (±a few % due to timing).

- [ ] **Step 3: Verify stack dots react**

With the app running: stop the OpenClaw gateway (`Stop-Process` on its node PID). Within ~8 s the **CLAW** dot turns grey and pulses red (openclaw alert). Restart it; the dot returns to green.

- [ ] **Step 4: Verify graceful degradation without LibreHardwareMonitor**

If LibreHardwareMonitor is not running, the CPU tile shows no CPU-temp suffix and the app runs normally (GPU temp still shows). No errors in the console.

- [ ] **Step 5: Final full test run**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add main/index.js
git commit -m "feat: apply launch-at-login setting from config"
```

---

## Self-review notes

- **Spec coverage:** form factor/behavior → Tasks 16–18; synthwave visual + alerts → Tasks 3,14,16; strip+panel content → Tasks 15–16; collector architecture + tiers → Tasks 6–13; data sources incl. LHM-optional sensors and custom stack checks → Tasks 11–12; config (palette/edge/autoHide/thresholds/modules) → Task 4; launch-at-login → Task 18; error handling (timeouts, null slices) → Tasks 13,15,16; testing → every collector + pure module has a test task.
- **Deferred to v1.1 per spec §12 (not in this plan):** click-to-control services, history graphs, auto-hide reveal animation, multi-GPU, packaging/installer. `autoHide`/`scanline`/`edge:'bottom'` config keys exist but their behaviors are intentionally not wired in v1 — only `launchAtLogin`, `palette`, `thresholds`, and poll intervals are honored.
- **Type consistency:** `MetricsSnapshot` slice shapes are identical across collector outputs, `mergeSnapshot`, `renderStrip`, `renderPanel`, and `computeAlerts` (`cpu.loadPct`, `memory.usedPct`, `gpu.utilPct/tempC`, `stack.wsl.vmmemGB`, `sensors.available/cpuTempC`).
- **Known v1 simplification:** `network.rxMBs` is already in MB/s; `renderStrip` multiplies back to bytes before calling `rateMBs` — kept consistent in Task 15.
```
