# Porting ClawMonitor to other platforms

ClawMonitor is **Windows-first**. This document scopes what it would take to run on
macOS and Linux, and explains why mobile is a non-starter. Contributions welcome —
**Linux is the most achievable target.**

## TL;DR

| Platform | Feasible? | Effort | Notes |
|----------|-----------|--------|-------|
| **Windows** | ✅ shipping | — | Reference platform |
| **Linux** | ✅ realistic | Medium | Closest to Windows; AppBar → X11 struts; drop the WSL tile |
| **macOS** | ⚠️ possible | Medium–High | The system menu bar already owns the top edge → reserve-space is awkward |
| **iOS / Android** | ❌ no | — | Electron doesn't run there, and mobile sandboxes forbid system-wide monitoring |

## What's already cross-platform

These need **no changes** — Electron and `systeminformation` handle them everywhere:

- The entire renderer (`renderer/**`) — bar, panel, palettes, animations.
- **Click-through** (`win.setIgnoreMouseEvents`), **always-on-top**, frameless/transparent window.
- The cursor-polled hover panel (`screen.getCursorScreenPoint`).
- `launch-at-login` via `app.setLoginItemSettings` (Windows + macOS; Linux is partial).
- Collectors that use `systeminformation`: `cpu`, `memory`, `disk`, `network`, and the load/util parts of `gpu`. These read real data on macOS and Linux too.
- The orchestrator, config, alerts, and format modules are pure/portable. **All 35 tests are platform-agnostic and should pass on any OS.**

I also wrote the platform-specific collectors **defensively**, so on macOS/Linux they
*degrade* rather than crash (e.g. `appbar.js` wraps the FFI load in try/catch and
sets `available = false`; `sensors.js` falls back to `systeminformation`; the WSL
probe just returns "down").

## What needs per-OS work

### 1. Reserve screen space — `main/appbar.js`
- **Windows:** `SHAppBarMessage` (shell32) via koffi.
- **Linux (X11):** set the `_NET_WM_STRUT` / `_NET_WM_STRUT_PARTIAL` window properties so the WM reserves the edge. Wayland has no portable equivalent (compositor-dependent) — likely ship without reserve-space there.
- **macOS:** there is no clean equivalent — the system menu bar owns the top 24px. Options: dock the bar *below* the menu bar and skip reservation, or don't reserve at all. **Recommend shipping macOS/Wayland with `reserveSpace` effectively a no-op** (it already degrades safely).

### 2. CPU temperature — `main/collectors/sensors.js`
- **Windows:** LibreHardwareMonitor web server (`localhost:8085`).
- **Linux:** `systeminformation.cpuTemperature()` works with `lm-sensors` installed. The existing fallback already covers this — just confirm and document `sudo apt install lm-sensors && sensors-detect`.
- **macOS:** `systeminformation` uses a helper for Apple temps; verify on Apple Silicon vs Intel.

### 3. WSL / vmmem tile — `main/collectors/stack.js`
- WSL is a Windows-only concept and uses `tasklist`. On macOS/Linux: **drop the WSL row** entirely (gate it behind `process.platform === 'win32'`). Docker (`docker ps`), Ollama, and the HTTP service checks are already cross-platform.

### 4. GPU temp — `main/collectors/gpu.js`
- `nvidia-smi` works on Linux+NVIDIA. On macOS (no NVIDIA), rely on whatever `systeminformation.graphics()` returns and hide temp if absent.

### 5. Auto-start
- **Windows:** Startup-folder shortcut (external).
- **macOS:** `setLoginItemSettings` works.
- **Linux:** write a `~/.config/autostart/clawmonitor.desktop` entry.

### 6. Packaging — `package.json` → `build`
- Add `mac` (`dmg`/`zip`) and `linux` (`AppImage`/`deb`) targets to the electron-builder config, and a `dist:linux` / `dist:mac` script. Note: **macOS builds require a Mac**; Linux builds are easiest in a Linux/Docker environment (or WSL).

## Suggested approach for a Linux port

1. Add `process.platform` guards: skip the WSL row, make `appbar.js` use X11 struts (or no-op on Wayland).
2. Confirm `sensors.js` fallback + `lm-sensors`; confirm `gpu.js` with `nvidia-smi`.
3. Add a Linux electron-builder target + autostart `.desktop`.
4. Build an AppImage; test under X11 (struts) and Wayland (no reserve-space).

Most of the app "just works" via Electron + `systeminformation`; the real work is
items **1, 3, 5, 6** above. A motivated contributor could likely land a usable Linux
build in a focused weekend.

## Why not iOS / Android

Electron does not run on mobile at all, and iOS/Android sandboxes **prohibit** reading
system-wide CPU/GPU/other-process information from a normal app. A system monitor like
this is fundamentally incompatible with the mobile app model — it's not a porting
effort, it's a non-starter.
