import { describe, it, expect } from 'vitest'
import { DEFAULTS, mergeConfig } from '../main/config.js'

describe('config', () => {
  it('exposes sane defaults', () => {
    expect(DEFAULTS.palette).toBe('classic-synthwave')
    expect(DEFAULTS.edge).toBe('top')
    expect(DEFAULTS.pollFastMs).toBe(2000)
    expect(DEFAULTS.thresholds.cpuPct).toBe(90)
  })
  it('deep-merges user overrides over defaults', () => {
    const merged = mergeConfig({ palette:'toxic', thresholds:{ cpuPct:80 } })
    expect(merged.palette).toBe('toxic')
    expect(merged.thresholds.cpuPct).toBe(80)
    expect(merged.thresholds.tempC).toBe(80)
    expect(merged.edge).toBe('top')
  })
  it('ignores null/undefined user config', () => {
    expect(mergeConfig(null).palette).toBe('classic-synthwave')
  })
})
