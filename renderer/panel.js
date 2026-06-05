// renderer/panel.js
import { pct, gb, temp } from '../main/format.js'

function bars(perCore, color) {
  return `<div class="bars">${perCore.map(v =>
    `<i style="height:${Math.max(4, v)}%;background:${color};box-shadow:0 0 6px ${color}"></i>`).join('')}</div>`
}
function rows(pairs) {
  return pairs.map(([k, v]) => `<div class="row"><span>${k}</span><span class="v">${v}</span></div>`).join('')
}

export function renderPanel(snap, pal) {
  const c = snap.cpu, g = snap.gpu, m = snap.memory, s = snap.sensors, st = snap.stack, d = snap.disk
  const cpuTemp = s && s.available ? ` · ${temp(s.cpuTempC)}` : ''
  const cpuTile = c ? `
    <div class="tile" style="border-color:#1e3a8a">
      <div class="th" style="color:${pal.cpu};text-shadow:0 0 8px ${pal.cpu}">CPU · ${pct(c.loadPct)} · ${c.clockGHz}GHz${cpuTemp}</div>
      ${bars(c.perCore, pal.cpu)}
      ${rows(c.top.map(p => [p.name, `${p.cpuPct}%`]))}
    </div>` : ''
  const gpuTile = `
    <div class="tile" style="border-color:#831843">
      <div class="th" style="color:${pal.gpu};text-shadow:0 0 8px ${pal.gpu}">${g ? `GPU · ${g.model.replace(/NVIDIA GeForce /,'')} · ${pct(g.utilPct)} · ${temp(g.tempC)}` : 'GPU · n/a'}</div>
      ${g ? rows([
        ['VRAM', `${g.vramUsedGB} / ${g.vramTotalGB} GB`],
        ['Power', g.powerW != null ? `${g.powerW} W` : 'n/a'],
        ['Fan', g.fanPct != null ? `${g.fanPct}%` : 'n/a']
      ]) : ''}
      <div class="hr" style="background:#831843"></div>
      <div class="th" style="color:${pal.ram};text-shadow:0 0 8px ${pal.ram}">${m ? `RAM · ${pct(m.usedPct)} · ${m.usedGB}/${m.totalGB} GB` : 'RAM · n/a'}</div>
      ${st ? rows([['vmmem (WSL)', st.wsl.vmmemGB != null ? `${st.wsl.vmmemGB} GB` : '—']]) : ''}
    </div>`
  const dot = on => `<span style="color:${on ? pal.up : pal.down};text-shadow:${on?`0 0 6px ${pal.up}`:'none'}">●</span>`
  const stackTile = `
    <div class="tile" style="border-color:#6d28d9">
      <div class="th" style="color:${pal.net};text-shadow:0 0 8px ${pal.net}">YOUR STACK</div>
      ${st ? `
        <div class="row">${dot(st.openclaw)} OpenClaw <span class="v">:18789</span></div>
        <div class="row">${dot(st.wsl.up)} WSL <span class="v">${st.wsl.vmmemGB != null ? st.wsl.vmmemGB+' GB' : 'down'}</span></div>
        <div class="row">${dot(st.docker)} Docker <span class="v">${st.docker ? 'up' : 'stopped'}</span></div>
        <div class="row">${dot(st.ollama)} Ollama <span class="v">:11434</span></div>` : '<div class="row">n/a</div>'}
      <div class="hr" style="background:#6d28d9"></div>
      <div class="th" style="color:${pal.disk};text-shadow:0 0 8px ${pal.disk}">DISK</div>
      ${d ? d.drives.map(dr => `<div class="row"><span>${dr.mount}</span><span class="v">${dr.freeGB} GB free</span></div>`).join('') : ''}
    </div>`
  return `<div class="panel">${cpuTile}${gpuTile}${stackTile}</div>`
}
