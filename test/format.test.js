import { describe, it, expect } from 'vitest'
import { pct, gb, rateMBs, temp, clamp } from '../main/format.js'

describe('format', () => {
  it('pct rounds to whole percent', () => {
    expect(pct(28.4)).toBe('28%')
    expect(pct(28.6)).toBe('29%')
    expect(pct(null)).toBe('n/a')
  })
  it('gb converts bytes to GB with 1 decimal', () => {
    expect(gb(8 * 1024 ** 3)).toBe(8.0)
    expect(gb(2.15 * 1024 ** 3)).toBe(2.2)
  })
  it('rateMBs converts bytes/sec to MB/s with 1 decimal', () => {
    expect(rateMBs(2.1 * 1024 ** 2)).toBe(2.1)
    expect(rateMBs(null)).toBe(0)
  })
  it('temp formats celsius with degree sign', () => {
    expect(temp(48)).toBe('48°')
    expect(temp(null)).toBe('—')
  })
  it('clamp bounds a number', () => {
    expect(clamp(150, 0, 100)).toBe(100)
    expect(clamp(-5, 0, 100)).toBe(0)
    expect(clamp(50, 0, 100)).toBe(50)
  })
})
