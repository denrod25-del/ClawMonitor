// renderer/strip.js
import { pct, temp, rateMBs } from '../main/format.js'

const seg = (label, color, value, extra = '', alert = false) =>
  `<span class="seg${alert ? ' alert' : ''}" style="color:${color};text-shadow:0 0 9px ${color}">${label} <b>${value}</b>${extra}</span>`

export function renderStrip(snap, pal, alerts = []) {
  const a = new Set(alerts)
  const cpu = snap.cpu ? seg('CPU', pal.cpu, pct(snap.cpu.loadPct), '', a.has('cpu')) : ''
  const ram = snap.memory ? seg('RAM', pal.ram, pct(snap.memory.usedPct), '', a.has('ram')) : ''
  const gpu = snap.gpu
    ? seg('GPU', pal.gpu, pct(snap.gpu.utilPct),
        snap.gpu.tempC != null ? ` <span style="color:${pal.warn}">${temp(snap.gpu.tempC)}</span>` : '',
        a.has('gpu') || a.has('temp'))
    : ''
  const net = snap.network ? seg('NET', pal.net, `↓${rateMBs(snap.network.rxMBs*1024**2)}`) : ''
  const disk = snap.disk && snap.disk.drives[0] ? seg('DISK', pal.disk, pct(snap.disk.drives[0].busyPct), '', a.has('disk')) : ''
  const dot = (on, label, alert = false) =>
    `<span class="${alert ? 'alert' : ''}" style="color:${on ? pal.up : pal.down};text-shadow:${on ? `0 0 8px ${pal.up}` : 'none'}">●${label}</span>`
  const st = snap.stack
  const dots = st
    ? `<span class="dots">${dot(st.wsl?.up, 'WSL')} ${dot(st.openclaw, 'CLAW', a.has('openclaw'))} ${dot(st.docker, 'DOCK')}</span>`
    : ''
  const clock = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
  return `${cpu}${ram}${gpu}${net}${disk}<span class="spacer"></span>${dots}<span class="clock">${clock}</span>`
}
