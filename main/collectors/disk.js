// main/collectors/disk.js
import * as siDefault from 'systeminformation'

export async function readDisk(si = siDefault) {
  const list = await si.fsSize()
  const round = b => Math.round(b / 1024 ** 3)
  return {
    drives: list.map(d => ({
      mount: d.mount,
      freeGB: round(d.available),
      sizeGB: round(d.size),
      busyPct: Math.round(d.use)
    }))
  }
}
