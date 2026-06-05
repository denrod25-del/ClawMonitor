// main/preload.cjs
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('clawmonitor', {
  onMetrics: (cb) => ipcRenderer.on('metrics:update', (_e, snap) => cb(snap)),
  onConfig:  (cb) => ipcRenderer.on('config:update', (_e, cfg) => cb(cfg)),
  onPanel:   (cb) => ipcRenderer.on('panel:open', (_e, open) => cb(open))
})
