// main/index.js
import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadConfig } from './config.js'
import { createCollector } from './collector.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BAR_H = 34, PANEL_H = 190
const CFG_PATH = join(app.getPath('userData'), 'config.json')

let win, cfg, collector

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
  // Click-through: clicks pass to the app underneath the bar; forwarded mouse
  // moves still let the renderer detect hover (so the detail panel opens).
  if (cfg.clickThrough !== false) win.setIgnoreMouseEvents(true, { forward: true })
  win.loadFile(join(__dirname, '..', 'renderer', 'index.html'))
  win.webContents.on('did-finish-load', () => win.webContents.send('config:update', cfg))

  ipcMain.on('panel:set', (_e, open) => {
    if (!win || win.isDestroyed()) return
    const { width } = screen.getPrimaryDisplay().workAreaSize
    win.setBounds({ x:0, y:0, width, height: open ? BAR_H + PANEL_H : BAR_H })
  })

  collector = createCollector({ cfg, onSnapshot: (snap) => {
    if (win && !win.isDestroyed()) win.webContents.send('metrics:update', snap)
  }})
  app.on('before-quit', () => collector?.stop())
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.whenReady().then(build)
  app.on('window-all-closed', () => { collector?.stop(); app.quit() })
}
