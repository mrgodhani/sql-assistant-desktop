import { describe, it, expect } from 'vitest'
import {
  findConnectedComponents,
  inferClusterName,
  buildClusteredLayout
} from '../cluster-layout'
import type { SchemaNode, SchemaEdge } from '@renderer/stores/useSchemaVisualizationStore'

// --- findConnectedComponents ---

describe('findConnectedComponents', () => {
  it('returns each isolated node as its own component', () => {
    const result = findConnectedComponents(['a', 'b', 'c'], [])
    expect(result).toHaveLength(3)
    result.forEach((c) => expect(c).toHaveLength(1))
  })

  it('groups directly connected nodes together', () => {
    const edges = [{ source: 'a', target: 'b' }] as SchemaEdge[]
    const result = findConnectedComponents(['a', 'b', 'c'], edges)
    const sizes = result.map((c) => c.length).sort()
    expect(sizes).toEqual([1, 2])
  })

  it('groups transitively connected nodes', () => {
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' }
    ] as SchemaEdge[]
    const result = findConnectedComponents(['a', 'b', 'c'], edges)
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveLength(3)
  })

  it('treats edges as undirected', () => {
    const edges = [{ source: 'b', target: 'a' }] as SchemaEdge[]
    const result = findConnectedComponents(['a', 'b'], edges)
    expect(result).toHaveLength(1)
  })
})

// --- inferClusterName ---

describe('inferClusterName', () => {
  it('uses common underscore prefix', () => {
    expect(inferClusterName(['order_items', 'order_status', 'orders'])).toBe('Orders')
  })

  it('title-cases and strips trailing underscore from prefix', () => {
    expect(inferClusterName(['user_roles', 'user_profiles', 'users'])).toBe('Users')
  })

  it('falls back to Domain label for unrelated names', () => {
    const result = inferClusterName(['foo', 'bar', 'baz'])
    expect(result).toBe('Domain')
  })

  it('returns name of single-table component', () => {
    const result = inferClusterName(['invoices'])
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })
})

// --- buildClusteredLayout ---

describe('buildClusteredLayout', () => {
  function makeNode(id: string): SchemaNode {
    return {
      id,
      type: 'table',
      position: { x: 0, y: 0 },
      data: {
        table: {
          name: id,
          type: 'table' as const,
          columns: [],
          primaryKey: [],
          foreignKeys: [],
          indexes: []
        },
        isSelected: false,
        isConnected: false,
        isDimmed: false,
        isExpanded: false
      }
    } as SchemaNode
  }

  it('returns tableNodes and groupNodes', () => {
    const nodes = ['a', 'b', 'c'].map(makeNode)
    const result = buildClusteredLayout(nodes, [], 280, () => 80)
    expect(result.tableNodes.length).toBe(3)
    expect(result.groupNodes.length).toBeGreaterThan(0)
    expect(result.groupNodes.every((n) => n.type === 'group')).toBe(true)
  })

  it('every tableNode has a defined position', () => {
    const nodes = ['a', 'b'].map(makeNode)
    const result = buildClusteredLayout(nodes, [], 280, () => 80)
    for (const n of result.tableNodes) {
      expect(typeof n.position.x).toBe('number')
      expect(typeof n.position.y).toBe('number')
    }
  })

  it('group nodes have width and height in data', () => {
    const nodes = ['a', 'b'].map(makeNode)
    const result = buildClusteredLayout(nodes, [], 280, () => 80)
    for (const g of result.groupNodes) {
      expect((g.data as Record<string, unknown>).width).toBeGreaterThan(0)
      expect((g.data as Record<string, unknown>).height).toBeGreaterThan(0)
    }
  })
})
