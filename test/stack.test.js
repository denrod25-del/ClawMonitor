import { describe, it, expect, vi } from 'vitest'
import { readStack } from '../main/collectors/stack.js'

describe('readStack', () => {
  it('reports health from probes and parses vmmem from tasklist', async () => {
    const deps = {
      httpOk: vi.fn(async (url) => url.includes('18789') || url.includes('11434')),
      execOk: vi.fn(async (cmd) => !cmd.startsWith('docker')),
      execOut: vi.fn(async () => '"vmmemWSL.exe","9000","Console","1","7,340,116 K"\n')
    }
    const out = await readStack(deps)
    expect(out.openclaw).toBe(true)
    expect(out.ollama).toBe(true)
    expect(out.docker).toBe(false)
    expect(out.wsl.up).toBe(true)
    expect(out.wsl.vmmemGB).toBe(7.0)
  })
  it('reports wsl down and zero vmmem when tasklist has no match', async () => {
    const deps = {
      httpOk: vi.fn(async () => false),
      execOk: vi.fn(async () => false),
      execOut: vi.fn(async () => 'INFO: No tasks are running which match the specified criteria.\n')
    }
    const out = await readStack(deps)
    expect(out.wsl).toEqual({ up:false, vmmemGB:null })
    expect(out.openclaw).toBe(false)
  })
  it('sums vmmem across multiple matching tasklist rows', async () => {
    const deps = {
      httpOk: vi.fn(async () => true),
      execOk: vi.fn(async () => true),
      execOut: vi.fn(async () =>
        '"vmmem.exe","100","Console","1","3,145,728 K"\n"vmmemWSL.exe","200","Console","1","3,145,728 K"\n')
    }
    const out = await readStack(deps)
    expect(out.wsl.vmmemGB).toBe(6.0)   // 2 x 3,145,728 KB = 6 GB
    expect(out.wsl.up).toBe(true)
  })
})
