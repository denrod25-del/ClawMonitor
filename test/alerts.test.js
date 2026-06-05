import { describe, it, expect } from 'vitest'
import { computeAlerts } from '../main/alerts.js'

const T = { cpuPct:90, gpuPct:90, tempC:80, diskFreeGB:10, ramPct:90 }

describe('computeAlerts', () => {
  it('returns empty when everything is healthy', () => {
    const snap = {
      cpu:{loadPct:30}, memory:{usedPct:40}, gpu:{utilPct:10,tempC:50},
      disk:{drives:[{mount:'C:',freeGB:200}]}, sensors:{cpuTempC:45},
      stack:{openclaw:true}
    }
    expect(computeAlerts(snap, T)).toEqual([])
  })
  it('flags cpu, gpu, temp, ram, disk and openclaw-down', () => {
    const snap = {
      cpu:{loadPct:95}, memory:{usedPct:92}, gpu:{utilPct:99,tempC:85},
      disk:{drives:[{mount:'C:',freeGB:5}]}, sensors:{cpuTempC:82},
      stack:{openclaw:false}
    }
    expect(computeAlerts(snap, T).sort()).toEqual(
      ['cpu','disk','gpu','openclaw','ram','temp'].sort()
    )
  })
  it('ignores null slices safely', () => {
    expect(computeAlerts({ cpu:null, gpu:null, stack:null }, T)).toEqual([])
  })
})
