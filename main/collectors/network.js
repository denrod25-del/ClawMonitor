// main/collectors/network.js
import * as siDefault from 'systeminformation'

export async function readNetwork(si = siDefault) {
  const stats = await si.networkStats()
  const sum = (k) => stats.reduce((t, s) => t + (s[k] || 0), 0)
  const mb = b => Math.round((b / 1024 ** 2) * 10) / 10
  return { rxMBs: mb(sum('rx_sec')), txMBs: mb(sum('tx_sec')) }
}
