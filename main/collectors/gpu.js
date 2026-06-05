// main/collectors/gpu.js
import * as siDefault from 'systeminformation'

export async function readGpu(si = siDefault) {
  const { controllers } = await si.graphics()
  const g = controllers.find(c => c.utilizationGpu != null || /nvidia/i.test(c.vendor || ''))
  if (!g) return null
  const mb = v => (v == null ? null : Math.round((v / 1024) * 10) / 10)
  return {
    model: g.model,
    utilPct: Math.round(g.utilizationGpu ?? 0),
    tempC: g.temperatureGpu ?? null,
    vramUsedGB: mb(g.memoryUsed),
    vramTotalGB: mb(g.memoryTotal),
    powerW: g.powerDraw == null ? null : Math.round(g.powerDraw),
    fanPct: g.fanSpeed ?? null
  }
}
