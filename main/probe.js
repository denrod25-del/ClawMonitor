// main/probe.js
import http from 'node:http'
import { exec } from 'node:child_process'

export function httpOk(url, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume()
      resolve(res.statusCode >= 200 && res.statusCode < 400)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(false) })
  })
}

export function execOut(cmd, timeoutMs = 4000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: timeoutMs, windowsHide: true }, (err, stdout) => {
      resolve(err ? null : String(stdout))
    })
  })
}

export async function execOk(cmd, timeoutMs = 4000) {
  return (await execOut(cmd, timeoutMs)) != null
}
