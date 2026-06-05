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
