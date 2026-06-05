import { describe, it, expect, vi } from 'vitest'
import { readCpu } from '../main/collectors/cpu.js'

const fakeSi = {
  currentLoad: vi.fn(async () => ({ currentLoad: 27.6, cpus: [{load:40},{load:12}] })),
  cpuCurrentSpeed: vi.fn(async () => ({ avg: 3.9 })),
  processes: vi.fn(async () => ({ list: [
    { name:'System Idle Process', cpu: 95.0 },
    { name:'chrome', cpu: 4.0 }, { name:'node', cpu: 11.2 },
    { name:'Idle', cpu: 88.0 }, { name:'blender', cpu: 6.1 }
  ] }))
}

describe('readCpu', () => {
  it('maps load, per-core, clock and top-3 processes, excluding the idle process', async () => {
    const out = await readCpu(fakeSi)
    expect(out.loadPct).toBe(28)
    expect(out.perCore).toEqual([40, 12])
    expect(out.clockGHz).toBe(3.9)
    // "System Idle Process" / "Idle" are filtered even though they have the highest cpu
    expect(out.top).toEqual([
      { name:'node', cpuPct:11 }, { name:'blender', cpuPct:6 }, { name:'chrome', cpuPct:4 }
    ])
  })
})
