// main/collectors/stack.js
import * as probe from '../probe.js'

function parseVmmemGB(tasklistOut) {
  if (!tasklistOut) return null
  let totalKB = 0, matched = false
  for (const line of tasklistOut.split(/\r?\n/)) {
    const m = /^"(vmmem(?:WSL)?\.exe)",.*?,"([\d,]+) K"\s*$/i.exec(line)
    if (m) { matched = true; totalKB += Number(m[2].replace(/,/g, '')) }
  }
  if (!matched) return null
  return Math.round((totalKB / 1024 / 1024) * 10) / 10
}

export async function readStack(deps = probe) {
  const { httpOk, execOk, execOut } = deps
  const [openclaw, ollama, docker, vmmemOut] = await Promise.all([
    httpOk('http://127.0.0.1:18789/'),
    httpOk('http://127.0.0.1:11434/'),
    execOk('docker ps --format "{{.ID}}"'),
    execOut('tasklist /FI "IMAGENAME eq vmmemWSL.exe" /FI "IMAGENAME eq vmmem.exe" /FO CSV /NH')
  ])
  const vmmemGB = parseVmmemGB(vmmemOut)
  return { openclaw, ollama, docker, wsl: { up: vmmemGB != null, vmmemGB } }
}
