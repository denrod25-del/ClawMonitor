// main/format.js
export function pct(n) {
  if (n == null || Number.isNaN(n)) return 'n/a'
  return `${Math.round(n)}%`
}
export function gb(bytes) {
  if (bytes == null) return 0
  return Math.round((bytes / 1024 ** 3) * 10) / 10
}
export function rateMBs(bytesPerSec) {
  if (bytesPerSec == null) return 0
  return Math.round((bytesPerSec / 1024 ** 2) * 10) / 10
}
export function temp(c) {
  if (c == null || Number.isNaN(c)) return '—'
  return `${Math.round(c)}°`
}
export function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}
