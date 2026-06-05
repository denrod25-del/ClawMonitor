// main/collectors/sensors.js
import * as siDefault from 'systeminformation'
import http from 'node:http'

// systeminformation can't read CPU temp on most Windows desktops (the ACPI
// sensor is empty). LibreHardwareMonitor (running, with its web server on)
// exposes real sensors as JSON at http://localhost:8085/data.json. We read that
// first and fall back to systeminformation.

function defaultFetchJson(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null) }
      let data = ''
      res.setEncoding('utf8')
      res.on('data', c => data += c)
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch { resolve(null) } })
    })
    req.on('error', () => resolve(null))
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null) })
  })
}

function parseDeg(v) {
  if (typeof v !== 'string') return null
  const m = /(-?\d+(?:\.\d+)?)/.exec(v)
  return m ? Math.round(parseFloat(m[1])) : null
}

// Walk the LHM sensor tree and return the best CPU temperature: prefer a
// package / Tctl/Tdie reading, else the hottest CPU core.
export function findCpuTemp(root) {
  let pkg = null
  const cores = []
  function walk(n, inCpu) {
    const sid = (n.SensorId || '').toLowerCase()
    const isCpu = inCpu || /\/(amdcpu|intelcpu|cpu)\//.test(sid)
    if (isCpu && typeof n.Value === 'string' && /°\s*c/i.test(n.Value)) {
      const val = parseDeg(n.Value)
      if (val != null) {
        if (/package|tctl|tdie/i.test(n.Text || '')) pkg = val
        else if (/core/i.test(n.Text || '')) cores.push(val)
      }
    }
    for (const c of (n.Children || [])) walk(c, isCpu)
  }
  walk(root, false)
  if (pkg != null) return pkg
  if (cores.length) return Math.max(...cores)
  return null
}

export async function readSensors(deps = {}) {
  const si = deps.si || siDefault
  const fetchJson = deps.fetchJson || defaultFetchJson

  const data = await fetchJson('http://localhost:8085/data.json')
  if (data) {
    const t = findCpuTemp(data)
    if (t != null) return { available: true, cpuTempC: t, cpuFanPct: null }
  }

  const st = await si.cpuTemperature()
  const ok = st.main != null && st.main > 0
  return { available: ok, cpuTempC: ok ? Math.round(st.main) : null, cpuFanPct: null }
}
