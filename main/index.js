// main/index.js
import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadConfig } from './config.js'
import { createCollector } from './collector.js'
import { registerAppBar, removeAppBar, removeStale, saveHwnd, clearHwndFile, hwndFromBuffer } from './appbar.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BAR_H = 34, PANEL_H = 190
const CFG_PATH = join(app.getPath('userData'), 'config.json')
const APPBAR_STATE = join(app.getPath('userData'), 'appbar.hwnd')

let win, cfg, collector, hoverTimer, appBarHwnd

function cleanup() {
  clearInterval(hoverTimer)
  collector?.stop()
  if (appBarHwnd != null) { removeAppBar(appBarHwnd); appBarHwnd = null }
  clearHwndFile(APPBAR_STATE)
}

function build() {
  cfg = loadConfig(CFG_PATH)
  app.setLoginItemSettings({ openAtLogin: !!cfg.launchAtLogin })
  const { width } = screen.getPrimaryDisplay().workAreaSize
  win = new BrowserWindow({
    x: 0, y: 0, width, height: BAR_H,
    frame: false, transparent: true, resizable: false, movable: false,
    skipTaskbar: true, alwaysOnTop: true, focusable: false,
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true }
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  // Always click-through so clicks reach the apps underneath everywhere on the
  // bar. Because a click-through window gets no DOM hover events, we drive the
  // detail panel from the main process by polling the global cursor position.
  win.setIgnoreMouseEvents(true)
  win.loadFile(join(__dirname, '..', 'renderer', 'index.html'))
  win.webContents.on('did-finish-load', () => win.webContents.send('config:update', cfg))

  // Reserve screen space (Windows AppBar) so maximized apps start below the bar
  // instead of being covered. Uses physical pixels.
  if (cfg.reserveSpace !== false) {
    removeStale(APPBAR_STATE)   // drop any reservation left by a prior crash/kill
    const d = screen.getPrimaryDisplay()
    const s = d.scaleFactor || 1
    appBarHwnd = hwndFromBuffer(win.getNativeWindowHandle())
    registerAppBar(appBarHwnd, {
      left: Math.round(d.bounds.x * s),
      top: Math.round(d.bounds.y * s),
      right: Math.round((d.bounds.x + d.bounds.width) * s),
      bottom: Math.round((d.bounds.y + BAR_H) * s)
    })
    saveHwnd(APPBAR_STATE, appBarHwnd)
  }

  let panelOpen = false
  hoverTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return
    const w = screen.getPrimaryDisplay().workAreaSize.width
    const pt = screen.getCursorScreenPoint()
    const regionH = panelOpen ? BAR_H + PANEL_H : BAR_H
    const over = pt.x >= 0 && pt.x < w && pt.y >= 0 && pt.y < regionH
    if (over !== panelOpen) {
      panelOpen = over
      win.setBounds({ x: 0, y: 0, width: w, height: over ? BAR_H + PANEL_H : BAR_H })
      win.webContents.send('panel:open', over)
    }
  }, 120)

  collector = createCollector({ cfg, onSnapshot: (snap) => {
    if (win && !win.isDestroyed()) win.webContents.send('metrics:update', snap)
  }})
  app.on('before-quit', cleanup)
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.whenReady().then(build)
  app.on('window-all-closed', () => { cleanup(); app.quit() })
}
