import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSchemaDesignerStore } from '../useSchemaDesignerStore'

vi.mock('electron-log/renderer', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}))

describe('useSchemaDesignerStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('setFilter updates filteredTables and hasFilter', () => {
    const store = useSchemaDesignerStore()
    store.setFilter(['a'])
    expect(store.filteredTables).toEqual(['a'])
    expect(store.hasFilter).toBe(true)
  })

  it('setFilter null clears filter', () => {
    const store = useSchemaDesignerStore()
    store.setFilter(['a'])
    expect(store.filteredTables).toEqual(['a'])
    store.setFilter(null)
    expect(store.filteredTables).toBeNull()
  })

  it('setNodePosition stores position', () => {
    const store = useSchemaDesignerStore()
    store.setNodePosition('users', { x: 10, y: 20 })
    expect(store.nodePositions['users']).toEqual({ x: 10, y: 20 })
  })

  it('clearNodePositions clears all', () => {
    const store = useSchemaDesignerStore()
    store.setNodePosition('users', { x: 10, y: 20 })
    expect(store.nodePositions['users']).toEqual({ x: 10, y: 20 })
    store.clearNodePositions()
    expect(store.nodePositions).toEqual({})
  })
})
