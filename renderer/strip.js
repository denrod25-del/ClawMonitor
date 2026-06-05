// renderer/strip.js
import { pct, temp, rateMBs } from '../main/format.js'

const seg = (label, color, value, extra = '') =>
  `<span class="seg" style="color:${color};text-shadow:0 0 9px ${color}">${label} <b>${value}</b>${extra}</span>`

export function renderStrip(snap, pal, alerts = []) {
  const a = new Set(alerts)
  const cls = k => a.has(k) ? ' class="seg alert"' : ''
  const cpu = snap.cpu ? seg('CPU', pal.cpu, pct(snap.cpu.loadPct)) : ''
  const ram = snap.memory ? seg('RAM', pal.ram, pct(snap.memory.usedPct)) : ''
  const gpu = snap.gpu
    ? seg('GPU', pal.gpu, pct(snap.gpu.utilPct),
        snap.gpu.tempC != null ? ` <span style="color:${pal.warn}">${temp(snap.gpu.tempC)}</span>` : '')
    : ''
  const net = snap.network ? seg('NET', pal.net, `↓${rateMBs(snap.network.rxMBs*1024**2)}`) : ''
  const disk = snap.disk && snap.disk.drives[0] ? seg('DISK', pal.disk, pct(snap.disk.drives[0].busyPct)) : ''
  const dot = (on, label) =>
    `<span style="color:${on ? pal.up : pal.down};text-shadow:${on ? `0 0 8px ${pal.up}` : 'none'}">●${label}</span>`
  const st = snap.stack
  const dots = st
    ? `<span class="dots">${dot(st.wsl?.up, 'WSL')} ${dot(st.openclaw, 'CLAW')} ${dot(st.docker, 'DOCK')}</span>`
    : ''
  const clock = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
  return `${cpu}${ram}${gpu}${net}${disk}<span class="spacer"></span>${dots}<span class="clock">${clock}</span>`
}
