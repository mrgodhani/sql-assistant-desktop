import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSchemaVisualizationStore } from '../useSchemaVisualizationStore'

vi.mock('@/lib/export-diagram', () => ({ exportDiagram: vi.fn() }))
vi.mock('electron-log/renderer', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}))

describe('useSchemaVisualizationStore — individualFilter', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('individualFilter is null by default', () => {
    const store = useSchemaVisualizationStore()
    expect(store.individualFilter).toBeNull()
    expect(store.hasIndividualFilter).toBe(false)
  })

  it('setIndividualFilter updates state', () => {
    const store = useSchemaVisualizationStore()
    store.setIndividualFilter(['orders', 'customers'])
    expect(store.individualFilter).toEqual(['orders', 'customers'])
    expect(store.hasIndividualFilter).toBe(true)
  })

  it('clearIndividualFilter resets to null', () => {
    const store = useSchemaVisualizationStore()
    store.setIndividualFilter(['orders'])
    store.clearIndividualFilter()
    expect(store.individualFilter).toBeNull()
    expect(store.hasIndividualFilter).toBe(false)
  })
})

describe('useSchemaVisualizationStore — getConnectedNodeIdSet', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('getConnectedNodeIdSet is accessible on the store', () => {
    const store = useSchemaVisualizationStore()
    expect(typeof store.getConnectedNodeIdSet).toBe('function')
  })

  it('getConnectedNodeIdSet returns empty Set when no edges exist', () => {
    const store = useSchemaVisualizationStore()
    const result = store.getConnectedNodeIdSet('orders')
    expect(result).toBeInstanceOf(Set)
    expect(result.size).toBe(0)
  })
})
