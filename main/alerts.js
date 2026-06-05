// main/alerts.js
export function computeAlerts(snap, t) {
  const a = new Set()
  if (snap.cpu && snap.cpu.loadPct >= t.cpuPct) a.add('cpu')
  if (snap.memory && snap.memory.usedPct >= t.ramPct) a.add('ram')
  if (snap.gpu) {
    if (snap.gpu.utilPct >= t.gpuPct) a.add('gpu')
    if (snap.gpu.tempC != null && snap.gpu.tempC >= t.tempC) a.add('temp')
  }
  if (snap.sensors && snap.sensors.cpuTempC != null && snap.sensors.cpuTempC >= t.tempC) a.add('temp')
  if (snap.disk) {
    for (const d of snap.disk.drives) if (d.freeGB < t.diskFreeGB) a.add('disk')
  }
  if (snap.stack && snap.stack.openclaw === false) a.add('openclaw')
  return [...a]
}
