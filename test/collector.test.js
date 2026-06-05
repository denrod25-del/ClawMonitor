import { describe, it, expect, vi } from 'vitest'
import { mergeSnapshot, withTimeout } from '../main/collector.js'
import { createCollector } from '../main/collector.js'

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

describe('createCollector', () => {
  const cfg = { pollFastMs: 2000, pollSlowMs: 8000, modules: {} }

  it('primes immediately, emits a merged snapshot, and re-runs fast collectors on the fast interval', async () => {
    vi.useFakeTimers()
    const cpu = vi.fn(async () => ({ loadPct: 30 }))
    const stack = vi.fn(async () => ({ openclaw: true }))
    const snaps = []
    const c = createCollector({
      cfg, now: () => 111, onSnapshot: s => snaps.push(s),
      groups: { fast: { cpu }, slow: { stack } }
    })
    await vi.advanceTimersByTimeAsync(0)            // flush prime microtasks
    expect(cpu).toHaveBeenCalledTimes(1)
    expect(stack).toHaveBeenCalledTimes(1)
    const merged = snaps.find(s => s.cpu && s.stack)
    expect(merged.cpu).toEqual({ loadPct: 30 })
    expect(merged.stack).toEqual({ openclaw: true })
    await vi.advanceTimersByTimeAsync(2000)         // one fast tick
    expect(cpu).toHaveBeenCalledTimes(2)
    expect(stack).toHaveBeenCalledTimes(1)          // slow did NOT re-run yet
    c.stop()
    vi.useRealTimers()
  })

  it('skips a collector whose module is disabled in cfg.modules', async () => {
    vi.useFakeTimers()
    const cpu = vi.fn(async () => ({ loadPct: 30 }))
    const stack = vi.fn(async () => ({ openclaw: true }))
    const c = createCollector({
      cfg: { ...cfg, modules: { stack: false } },
      now: () => 111, onSnapshot: () => {},
      groups: { fast: { cpu }, slow: { stack } }
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(cpu).toHaveBeenCalledTimes(1)
    expect(stack).not.toHaveBeenCalled()
    c.stop()
    vi.useRealTimers()
  })

  it('stop() prevents further collector calls', async () => {
    vi.useFakeTimers()
    const cpu = vi.fn(async () => ({ loadPct: 30 }))
    const c = createCollector({ cfg, now: () => 1, onSnapshot: () => {}, groups: { fast: { cpu }, slow: {} } })
    await vi.advanceTimersByTimeAsync(0)
    const callsAfterPrime = cpu.mock.calls.length
    c.stop()
    await vi.advanceTimersByTimeAsync(10000)
    expect(cpu.mock.calls.length).toBe(callsAfterPrime)
    vi.useRealTimers()
  })
})
