// main/config.js
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

export const DEFAULTS = {
  palette: 'classic-synthwave',
  edge: 'top',
  autoHide: false,
  scanline: false,
  clickThrough: true,
  launchAtLogin: false,
  pollFastMs: 2000,
  pollSlowMs: 8000,
  modules: { sensors: true, stack: true, network: true, disk: true },
  thresholds: { cpuPct: 90, gpuPct: 90, tempC: 80, diskFreeGB: 10, ramPct: 90 }
}

function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v) }

function deepMerge(base, over) {
  if (!isObj(over)) return base
  const out = Array.isArray(base) ? [...base] : { ...base }
  for (const k of Object.keys(over)) {
    out[k] = isObj(base[k]) && isObj(over[k]) ? deepMerge(base[k], over[k]) : over[k]
  }
  return out
}

export function mergeConfig(user) { return deepMerge(DEFAULTS, user || {}) }

export function loadConfig(path) {
  if (!existsSync(path)) { writeFileSync(path, JSON.stringify(DEFAULTS, null, 2)); return { ...DEFAULTS } }
  try { return mergeConfig(JSON.parse(readFileSync(path, 'utf8'))) }
  catch { return { ...DEFAULTS } }
}

export function saveConfig(path, cfg) { writeFileSync(path, JSON.stringify(cfg, null, 2)) }
