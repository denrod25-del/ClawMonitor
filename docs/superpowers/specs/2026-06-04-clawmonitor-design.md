# ClawMonitor — Design Spec

**Date:** 2026-06-04
**Status:** Approved (pending spec review)
**Author:** Brainstormed with Claude Code

## 1. Purpose

A single-glance system monitor for the user's Windows 10 PC: a slim, always-on-top
neon bar that shows live CPU / RAM / GPU / disk / network plus the health of the
user's local stack (OpenClaw gateway, WSL, Docker, Ollama). Hovering expands a
detail panel. It replaces the need to open Task Manager / nvidia-smi / terminal
checks for everyday "what's my machine doing right now" questions.

## 2. Target environment

- Windows 10 Home (10.0.19045), 16 logical cores, 47.9 GB RAM.
- NVIDIA RTX 3070 (8 GB VRAM) — `nvidia-smi` available.
- WSL2 (Ubuntu-24.04) + Docker Desktop installed; Ollama runs in WSL.
- OpenClaw gateway on `127.0.0.1:18789`.
- Node.js installed (`C:\Program Files\nodejs`). User is comfortable with web/Node.

## 3. Form factor & behavior

- **Frameless, transparent, always-on-top** window. No taskbar button
  (`skipTaskbar`). Slim bar ~34 px tall, docked to the **top edge, full width**.
- **Hover** over the bar → 3-tile detail panel drops down beneath it. Mouse-leave
  collapses it. **Click** the bar pins the panel open until clicked again.
- Always visible by default. **Auto-hide** (reveal when the cursor hits the top
  edge) is a config toggle, default off.
- **Launch-at-login** optional: a shortcut in the Startup folder
  (`shell:startup`), same mechanism the OpenClaw gateway uses. Default off; toggled
  in config or a first-run prompt.
- Single instance only (Electron `requestSingleInstanceLock`).

## 4. Visual design — "Classic synthwave"

- Bar background `rgba(10,7,28,0.85)`, 1 px `#7c3aed` border, outer glow
  `0 0 20px rgba(124,58,237,0.55)`, inner glow. Faint 22 px purple grid behind.
- Neon metric colors (palette **Classic synthwave**):
  - CPU `#22d3ee` (cyan), RAM `#34d399` (green), GPU `#f472b6` (magenta),
    NET `#a78bfa` (purple), DISK `#fb923c` (orange), temp warn `#fbbf24`.
  - Each value uses a matching `text-shadow` glow.
- Font: **Cascadia Code** (fallback Consolas, monospace).
- **Motion:**
  - Static glow normally; smooth fade/transition on value changes.
  - **Pulsing red alert** animation when a metric redlines (see thresholds §8).
  - **Scanline** overlay available as a config toggle, default **off**.
- Other palettes (`tron-ice`, `toxic`) defined in a palette map for future switching
  but Classic synthwave is the shipped default.

## 5. Displayed metrics

### 5.1 Collapsed strip (always visible)
Left→right: `CPU <total>% <kernel?>` · `RAM <%>` · `GPU <%> <temp°>` ·
`NET ↓<MB/s> ↑<MB/s>` · `DISK <busy%>` · spacer · status dots
`● WSL  ● CLAW  ○ DOCK` · clock. Dot color: green = up, grey = down/stopped.

### 5.2 Hover panel (3 tiles)
- **CPU tile:** total %, clock, CPU temp (if available); per-core mini bar chart;
  top-3 processes by CPU.
- **GPU / RAM tile:** GPU model, util %, temp, VRAM used/total, power draw, fan %;
  divider; RAM used/total %, vmmem (WSL) usage.
- **Your-Stack tile:** OpenClaw gateway (`:18789` up/down), WSL distro + vmmem,
  Docker (running/stopped), Ollama (`:11434` up/down); divider; disk free per drive
  (C:, D:).

## 6. Architecture

Electron app. Two layers:

### 6.1 Main process — collector
- A `Collector` orchestrator owns a set of **collector modules**, each a small unit
  with a single `async read(): Snapshot` method and a declared cadence:
  - `cpu` — load total + per-core, clock, temp (via sensors), top processes.
  - `memory` — total/used/free %, plus vmmem (WSL) lookup.
  - `gpu` — util, temp, VRAM, power, fan (nvidia-smi via systeminformation).
  - `disk` — per-drive free/size, busy %.
  - `network` — rx/tx rates.
  - `sensors` — CPU temp + fan (LibreHardwareMonitor-dependent; null if absent).
  - `stack` — OpenClaw / Docker / Ollama health checks.
- The orchestrator runs two timers: **fast tier (2 s)** for load/temps/net,
  **slow tier (8 s)** for stack health (heavier: HTTP + `docker ps`). Each tick it
  assembles a combined `MetricsSnapshot` and sends it to the renderer over IPC
  (`metrics:update`).
- Collectors are isolated: a throwing/timing-out collector yields a `null`/`error`
  field for its slice and never blocks the others. Each external call has a timeout.

### 6.2 Renderer — UI
- Frameless transparent page. Components, one per metric group, each render from the
  latest snapshot: `StripView` (collapsed) and `PanelView` (the 3 tiles). A small
  store holds the most recent snapshot; components are pure functions of it.
- Hover/click state is local renderer state and controls panel visibility + window
  height (renderer asks main to resize the window taller when the panel opens).
- Alerts: the renderer compares snapshot values against thresholds and applies the
  pulse/red treatment.

### 6.3 Data sources
- **`systeminformation`** npm package is the primary source: `currentLoad` (+ per
  core), `mem`, `fsSize`, `networkStats`, `processes`, `graphics` (nvidia-smi),
  `cpuTemperature` (works only if LibreHardwareMonitor / OpenHardwareMonitor is
  running).
- **CPU temp / fan:** depend on **LibreHardwareMonitor** running in the background.
  The sensors collector returns null when unavailable; the UI hides those fields
  and the rest of the app is unaffected. GPU temp always works via nvidia-smi.
- **Custom stack checks:** OpenClaw = HTTP GET `127.0.0.1:18789/` expecting 200;
  WSL vmmem = process lookup (`vmmem`/`vmmemWSL` working set); Docker = `docker ps`
  exit code / count; Ollama = HTTP `127.0.0.1:11434/`.

## 7. Configuration

`config.json` next to the app (created from defaults on first run):

```jsonc
{
  "palette": "classic-synthwave",   // classic-synthwave | tron-ice | toxic
  "edge": "top",                     // top | bottom
  "autoHide": false,
  "scanline": false,
  "launchAtLogin": false,
  "pollFastMs": 2000,
  "pollSlowMs": 8000,
  "modules": { "sensors": true, "stack": true, "network": true, "disk": true },
  "thresholds": {
    "cpuPct": 90, "gpuPct": 90, "tempC": 80, "diskFreeGB": 10, "ramPct": 90
  }
}
```

## 8. Alert thresholds

A metric "redlines" (pulsing red) when: CPU ≥ 90%, GPU ≥ 90%, any temp ≥ 80 °C,
RAM ≥ 90%, a drive's free space < 10 GB, or **OpenClaw is down** (CLAW dot pulses
red). Values configurable in `config.json`.

## 9. Error handling

- Every external call (nvidia-smi, docker, HTTP, sensors) is wrapped with a timeout
  and try/catch; failures degrade that one field to "n/a" / grey dot, never crash.
- If `systeminformation` is missing a capability on this machine, the affected tile
  shows "n/a" rather than erroring.
- Renderer is defensive: missing snapshot fields render as placeholders.
- A single rotating log file for collector errors (so we can diagnose without a
  console), capped in size.

## 10. Testing

- **Collector unit tests:** each collector module tested against stubbed
  `systeminformation` / child-process output — correct parsing, correct null/error
  behavior on failure and timeout.
- **Snapshot assembly test:** orchestrator merges partial collector results, one
  failing collector doesn't sink the snapshot.
- **Threshold/alert logic test:** pure function mapping snapshot → set of active
  alerts, covering each threshold boundary.
- **Formatting tests:** bytes→MB/s, percent rounding, temp formatting, dot states.
- UI is validated manually via the Electron window (and the brainstorm mockups are
  the visual reference).

## 11. Project layout

```
C:\Users\skyea\claude\ClawMonitor\
  package.json
  main/                 # Electron main process
    index.js            # app lifecycle, window, IPC, tray-less always-on-top
    collector.js        # orchestrator + timers
    collectors/         # cpu.js memory.js gpu.js disk.js network.js sensors.js stack.js
    config.js           # load/merge/save config.json
    alerts.js           # snapshot -> active alerts (pure)
    format.js           # unit/format helpers (pure)
  renderer/
    index.html
    strip.js  panel.js  store.js  palette.js
    styles.css
  test/                 # unit tests
  config.json           # generated on first run
  docs/superpowers/specs/2026-06-04-clawmonitor-design.md
```

## 12. Out of scope (v1)

- Click-to-control services (start/stop OpenClaw, `wsl --shutdown`) — planned v1.1.
- Historical/scrolling graphs beyond the per-core sparkline.
- Multi-GPU, remote machines, cross-platform (macOS/Linux).
- Installer/packaging (`electron-builder`) — run via `npm start` for v1; package later.
```
