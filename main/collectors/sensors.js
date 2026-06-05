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
