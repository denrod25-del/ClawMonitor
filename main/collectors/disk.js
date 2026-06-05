// main/collectors/disk.js
import * as siDefault from 'systeminformation'

export async function readDisk(si = siDefault) {
  const list = await si.fsSize()
  return {
    drives: list.map(d => ({
      mount: d.mount,
      freeGB: Math.floor(d.available / 1024 ** 3),
      sizeGB: Math.round(d.size / 1024 ** 3),
      busyPct: Math.round(d.use)
    }))
  }
}
