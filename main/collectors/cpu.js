// main/collectors/cpu.js
import * as siDefault from 'systeminformation'

export async function readCpu(si = siDefault) {
  const [load, speed, procs] = await Promise.all([
    si.currentLoad(), si.cpuCurrentSpeed(), si.processes()
  ])
  const top = [...procs.list]
    .filter(p => !/^(system idle process|idle)$/i.test((p.name || '').trim()))
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, 3)
    .map(p => ({ name: p.name, cpuPct: Math.round(p.cpu) }))
  return {
    loadPct: Math.round(load.currentLoad),
    perCore: load.cpus.map(c => Math.round(c.load)),
    clockGHz: speed.avg,
    top
  }
}
