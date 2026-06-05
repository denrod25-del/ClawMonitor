// main/index.js
import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadConfig } from './config.js'
import { createCollector } from './collector.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BAR_H = 34, PANEL_H = 190
const CFG_PATH = join(app.getPath('userData'), 'config.json')

let win, cfg, collector, hoverTimer

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
  app.on('before-quit', () => { clearInterval(hoverTimer); collector?.stop() })
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.whenReady().then(build)
  app.on('window-all-closed', () => { clearInterval(hoverTimer); collector?.stop(); app.quit() })
}
