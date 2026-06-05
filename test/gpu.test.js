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
