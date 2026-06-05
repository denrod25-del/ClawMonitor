# Contributing to ClawMonitor

Thanks for your interest! ClawMonitor is a small, focused Windows system-monitor bar, and contributions are welcome — bug fixes, new collectors, palettes, or polish.

## Getting set up

```bash
git clone https://github.com/denrod25-del/ClawMonitor.git
cd ClawMonitor
npm install
npm start        # run the app
npm test         # run the test suite (Vitest)
npm run dist     # build a Windows installer into dist/
```

Requirements: **Node.js 18+** and **Windows** (the app uses Windows-specific APIs — AppBar, tasklist, nvidia-smi).

## Project layout

```
main/                 Electron main process
  index.js            app lifecycle, window, click-through, hover polling, AppBar
  collector.js        orchestrator: fast/slow tiers, timeout-wrapped, merge
  collectors/*.js     one reader each (cpu, memory, gpu, disk, network, sensors, stack)
  appbar.js           Windows AppBar (SHAppBarMessage via koffi) + self-heal
  config.js           defaults + deep-merge of config.json
  alerts.js           snapshot -> active alerts (pure)
  format.js           unit/format helpers (pure)
  probe.js            injectable http/exec helpers
renderer/             frameless transparent UI (strip + hover panel)
test/                 Vitest unit tests
```

## How it's built (the important idea)

Each **collector** is a small module with one `read()` that returns a typed slice of the snapshot, and takes its I/O dependency by injection so it can be unit-tested against stubs (no real system calls in tests). The orchestrator wraps every collector in a timeout and merges results, so one slow/failed reader never blocks the rest. Keep this shape when adding a collector.

## Guidelines

- **Tests:** pure logic and collectors must have a Vitest test. Run `npm test` before opening a PR — it should stay green.
- **TDD-friendly:** add the failing test first, then the implementation.
- **Keep files focused** — one clear responsibility per file. Prefer adding a new collector over growing an existing one.
- **No new heavy dependencies** without a good reason — the app is intentionally lean.
- **Match the existing style** (small modules, dependency injection, no build step for the renderer).

## Adding a collector (example)

1. Create `main/collectors/yourthing.js` exporting `async function readYourthing(dep = realDep)`.
2. Add `test/yourthing.test.js` with stubbed `dep`.
3. Wire it into the `FAST` or `SLOW` group in `main/collector.js`.
4. Render it in `renderer/strip.js` and/or `renderer/panel.js`.

## Pull requests

- Branch off `master`, keep PRs focused and small.
- Describe what changed and why; include a screenshot/GIF for UI changes.
- Make sure `npm test` passes.

## Reporting bugs / ideas

Use the issue templates — a bug report with your Windows version, GPU, and steps to reproduce makes fixes much faster.
