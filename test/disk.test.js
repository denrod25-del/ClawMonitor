import { describe, it, expect, vi } from 'vitest'
import { readDisk } from '../main/collectors/disk.js'

const GB = 1024 ** 3
describe('readDisk', () => {
  it('maps each drive to mount/free/size/busy', async () => {
    const si = { fsSize: vi.fn(async () => [
      { mount:'C:', size: 465*GB, available: 241*GB, use: 48.2 },
      { mount:'D:', size: 930*GB, available: 800*GB, use: 14.0 }
    ]) }
    const out = await readDisk(si)
    expect(out.drives).toEqual([
      { mount:'C:', freeGB:241, sizeGB:465, busyPct:48 },
      { mount:'D:', freeGB:800, sizeGB:930, busyPct:14 }
    ])
  })
})
