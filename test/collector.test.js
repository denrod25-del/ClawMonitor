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
