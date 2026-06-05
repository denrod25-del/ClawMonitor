// main/collectors/memory.js
import * as siDefault from 'systeminformation'

export async function readMemory(si = siDefault) {
  const m = await si.mem()
  const usedGB = Math.round((m.active / 1024 ** 3) * 10) / 10
  const totalGB = Math.round((m.total / 1024 ** 3) * 10) / 10
  return { usedGB, totalGB, usedPct: Math.round((m.active / m.total) * 100) }
}
