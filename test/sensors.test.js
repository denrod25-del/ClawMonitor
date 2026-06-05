import { describe, it, expect, vi } from 'vitest'
import { readSensors, findCpuTemp } from '../main/collectors/sensors.js'

// Minimal LibreHardwareMonitor /data.json shape
const lhm = {
  Text: 'Sensor', Children: [
    { Text: 'DESKTOP', Children: [
      { Text: 'AMD Ryzen', Children: [
        { Text: 'Temperatures', Children: [
          { Text: 'Core (Tctl/Tdie)', Value: '55.0 °C', Type: 'Temperature', SensorId: '/amdcpu/0/temperature/2' },
          { Text: 'CPU Core #1',      Value: '50.0 °C', Type: 'Temperature', SensorId: '/amdcpu/0/temperature/3' }
        ] }
      ] }
    ] }
  ]
}

describe('findCpuTemp', () => {
  it('prefers the package/Tctl reading over individual cores', () => {
    expect(findCpuTemp(lhm)).toBe(55)
  })
  it('falls back to the hottest core when no package reading exists', () => {
    const coresOnly = { Children: [
      { Text: 'CPU Core #1', Value: '48.0 °C', SensorId: '/intelcpu/0/temperature/0' },
      { Text: 'CPU Core #2', Value: '61.0 °C', SensorId: '/intelcpu/0/temperature/1' }
    ] }
    expect(findCpuTemp(coresOnly)).toBe(61)
  })
  it('returns null when there are no CPU temperatures', () => {
    expect(findCpuTemp({ Children: [{ Text: 'GPU Core', Value: '70.0 °C', SensorId: '/gpu/0/temperature/0' }] })).toBeNull()
  })
})

describe('readSensors', () => {
  it('reads CPU temp from the LHM web server when reachable', async () => {
    const out = await readSensors({ fetchJson: vi.fn(async () => lhm), si: { cpuTemperature: vi.fn() } })
    expect(out).toEqual({ available: true, cpuTempC: 55, cpuFanPct: null })
  })
  it('falls back to systeminformation when LHM is unreachable', async () => {
    const si = { cpuTemperature: vi.fn(async () => ({ main: 46.0 })) }
    const out = await readSensors({ fetchJson: vi.fn(async () => null), si })
    expect(out).toEqual({ available: true, cpuTempC: 46, cpuFanPct: null })
  })
  it('reports unavailable when neither source has data', async () => {
    const si = { cpuTemperature: vi.fn(async () => ({ main: null })) }
    expect(await readSensors({ fetchJson: vi.fn(async () => null), si }))
      .toEqual({ available: false, cpuTempC: null, cpuFanPct: null })
  })
})
