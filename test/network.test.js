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
