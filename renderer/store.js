// renderer/store.js
export function createStore() {
  let snap = { ts: 0, errors: {} }
  const subs = new Set()
  return {
    get: () => snap,
    set(next) { snap = next; for (const s of subs) s(snap) },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn) }
  }
}
