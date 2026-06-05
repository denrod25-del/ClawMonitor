// main/appbar.js
// Registers the bar as a Windows "AppBar" so the OS reserves screen-edge space
// for it — maximized windows then resize to start below the bar instead of
// being covered. Uses koffi FFI to call shell32!SHAppBarMessage. All calls are
// wrapped so a failure degrades to "no reserved space" rather than crashing.

import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
const require = createRequire(import.meta.url)

let koffi, SHAppBarMessage, APPBARDATA, available = false
try {
  koffi = require('koffi')
  const shell32 = koffi.load('shell32.dll')
  koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' })
  APPBARDATA = koffi.struct('APPBARDATA', {
    cbSize: 'uint32',
    hWnd: 'uint64',
    uCallbackMessage: 'uint32',
    uEdge: 'uint32',
    rc: 'RECT',
    lParam: 'int64'
  })
  SHAppBarMessage = shell32.func('uint64 __stdcall SHAppBarMessage(uint32 dwMessage, _Inout_ APPBARDATA *pData)')
  available = true
} catch (e) {
  available = false
}

const ABM_NEW = 0, ABM_REMOVE = 1, ABM_QUERYPOS = 2, ABM_SETPOS = 3
const ABE_TOP = 1

// Read the HWND value out of the Buffer that Electron's getNativeWindowHandle()
// returns (8 bytes on x64).
export function hwndFromBuffer(buf) {
  return buf.length === 8 ? buf.readBigUInt64LE(0) : BigInt(buf.readUInt32LE(0))
}

function base(hwnd) {
  return { cbSize: koffi.sizeof(APPBARDATA), hWnd: hwnd, uCallbackMessage: 0, uEdge: ABE_TOP, rc: { left: 0, top: 0, right: 0, bottom: 0 }, lParam: 0 }
}

// rect: physical-pixel { left, top, right, bottom } for the top edge.
export function registerAppBar(hwnd, rect) {
  if (!available) return false
  try {
    const data = base(hwnd)
    SHAppBarMessage(ABM_NEW, data)

    data.uEdge = ABE_TOP
    data.rc = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
    SHAppBarMessage(ABM_QUERYPOS, data)        // system may shift rc to avoid conflicts
    data.rc.bottom = data.rc.top + (rect.bottom - rect.top)   // pin height for a top bar
    SHAppBarMessage(ABM_SETPOS, data)          // reserve the space
    return true
  } catch {
    return false
  }
}

export function removeAppBar(hwnd) {
  if (!available) return
  try { SHAppBarMessage(ABM_REMOVE, base(hwnd)) } catch { /* ignore */ }
}

// Self-heal: a crash/force-kill leaves the prior reservation registered with a
// now-dead HWND, which would otherwise stack with the new one. On startup we
// remove the previously-recorded HWND before registering, so reservations never
// accumulate across restarts.
export function removeStale(stateFile) {
  if (!available || !existsSync(stateFile)) return
  try {
    const prev = readFileSync(stateFile, 'utf8').trim()
    if (prev) removeAppBar(BigInt(prev))
  } catch { /* ignore */ }
  try { unlinkSync(stateFile) } catch { /* ignore */ }
}

export function saveHwnd(stateFile, hwnd) {
  try { writeFileSync(stateFile, String(hwnd)) } catch { /* ignore */ }
}

export function clearHwndFile(stateFile) {
  try { if (existsSync(stateFile)) unlinkSync(stateFile) } catch { /* ignore */ }
}
