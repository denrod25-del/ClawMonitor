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
