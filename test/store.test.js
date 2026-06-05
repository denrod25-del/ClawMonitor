import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../renderer/store.js'

describe('store', () => {
  it('holds the latest snapshot and notifies subscribers', () => {
    const store = createStore()
    const sub = vi.fn()
    store.subscribe(sub)
    store.set({ ts:1, cpu:{ loadPct:30 } })
    expect(store.get().cpu.loadPct).toBe(30)
    expect(sub).toHaveBeenCalledWith(store.get())
  })
  it('starts with a null-ish empty snapshot', () => {
    expect(createStore().get()).toEqual({ ts:0, errors:{} })
  })
})
