import dagre from 'dagre'
import type { SchemaNode, SchemaEdge } from '@renderer/stores/useSchemaVisualizationStore'

const GROUP_PADDING = 48
const CLUSTER_GAP = 120
let domainCounter = 0

export interface ClusterLayoutResult {
  tableNodes: SchemaNode[]
  groupNodes: SchemaNode[]
}

// --- Connected Components (BFS, undirected) ---

export function findConnectedComponents(nodeIds: string[], edges: SchemaEdge[]): string[][] {
  const adj = new Map<string, Set<string>>()
  for (const id of nodeIds) adj.set(id, new Set())
  for (const edge of edges) {
    adj.get(edge.source)?.add(edge.target)
    adj.get(edge.target)?.add(edge.source)
  }

  const visited = new Set<string>()
  const components: string[][] = []

  for (const id of nodeIds) {
    if (visited.has(id)) continue
    const component: string[] = []
    const queue = [id]
    visited.add(id)
    while (queue.length) {
      const node = queue.shift()!
      component.push(node)
      for (const neighbor of adj.get(node) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
    components.push(component)
  }

  return components
}

// --- Name Inference ---

function commonPrefix(names: string[]): string {
  if (names.length === 0) return ''
  let prefix = names[0]
  for (const name of names.slice(1)) {
    while (!name.startsWith(prefix)) {
      prefix = prefix.slice(0, -1)
      if (!prefix) return ''
    }
  }
  return prefix
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

export function inferClusterName(tableIds: string[], fallbackIndex?: number): string {
  // Strip schema prefix (e.g. "dbo.orders" -> "orders")
  const names = tableIds.map((id) => id.split('.').pop()!.toLowerCase())

  if (names.length === 1) {
    return titleCase(names[0].replace(/_/g, ' ').trim())
  }

  // Rule 1: common underscore-delimited prefix (>= 3 chars, covers >= 60% of tables)
  const prefix = commonPrefix(names).replace(/_+$/, '')
  if (prefix.length >= 3) {
    const coverage = names.filter((n) => n.startsWith(prefix)).length / names.length
    if (coverage >= 0.6) {
      // Prefer the root entity table (extends prefix without an underscore separator)
      const baseTable = names
        .filter((n) => n.startsWith(prefix) && (n.length === prefix.length || n[prefix.length] !== '_'))
        .sort((a, b) => a.length - b.length)[0]
      return titleCase(baseTable ?? prefix)
    }
  }

  // Rule 2: majority share a common first word when split by underscore
  const firstWords = names.map((n) => n.split('_')[0])
  const freq = new Map<string, number>()
  for (const w of firstWords) freq.set(w, (freq.get(w) ?? 0) + 1)
  const [topWord, topCount] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]
  if (topWord.length >= 3 && topCount / names.length >= 0.5) {
    return titleCase(topWord)
  }

  // Rule 3: fallback to "Domain N"
  domainCounter++
  return `Domain ${fallbackIndex ?? domainCounter}`
}

// --- Intra-cluster dagre layout ---

function layoutCluster(
  nodes: SchemaNode[],
  edges: SchemaEdge[],
  nodeWidth: number,
  getNodeHeight: (node: SchemaNode) => number
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 })

  const nodeIds = new Set(nodes.map((n) => n.id))
  for (const node of nodes) {
    g.setNode(node.id, { width: nodeWidth, height: getNodeHeight(node) })
  }
  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  }

  dagre.layout(g)

  const positions = new Map<string, { x: number; y: number }>()
  for (const node of nodes) {
    const pos = g.node(node.id)
    positions.set(node.id, {
      x: pos.x - nodeWidth / 2,
      y: pos.y - (pos.height as number) / 2
    })
  }
  return positions
}

// --- Main export ---

export function buildClusteredLayout(
  nodes: SchemaNode[],
  edges: SchemaEdge[],
  nodeWidth: number,
  getNodeHeight: (node: SchemaNode) => number
): ClusterLayoutResult {
  domainCounter = 0

  const nodeIds = nodes.map((n) => n.id)
  const components = findConnectedComponents(nodeIds, edges)

  // Separate isolated singletons (no edges) into one "Uncategorized" cluster
  const edgeNodeIds = new Set(edges.flatMap((e) => [e.source, e.target]))
  const connectedComponents = components.filter((c) => c.length > 1 || edgeNodeIds.has(c[0]))
  const isolatedNodes = components
    .filter((c) => c.length === 1 && !edgeNodeIds.has(c[0]))
    .flatMap((c) => c)

  const clusters: Array<{ ids: string[]; name: string }> = []

  connectedComponents.forEach((ids, i) => {
    clusters.push({ ids, name: inferClusterName(ids, i + 1) })
  })

  if (isolatedNodes.length > 0) {
    clusters.push({ ids: isolatedNodes, name: 'Uncategorized' })
  }

  // Sort largest cluster first
  clusters.sort((a, b) => b.ids.length - a.ids.length)

  // Layout each cluster independently
  const clusterLayouts: Array<{
    name: string
    ids: string[]
    positions: Map<string, { x: number; y: number }>
    bbox: { width: number; height: number }
  }> = []

  for (const cluster of clusters) {
    const clusterNodes = nodes.filter((n) => cluster.ids.includes(n.id))
    const clusterEdges = edges.filter(
      (e) => cluster.ids.includes(e.source) && cluster.ids.includes(e.target)
    )
    const positions = layoutCluster(clusterNodes, clusterEdges, nodeWidth, getNodeHeight)

    // Compute bounding box
    let maxX = 0
    let maxY = 0
    for (const node of clusterNodes) {
      const pos = positions.get(node.id)!
      maxX = Math.max(maxX, pos.x + nodeWidth)
      maxY = Math.max(maxY, pos.y + getNodeHeight(node))
    }

    clusterLayouts.push({
      name: cluster.name,
      ids: cluster.ids,
      positions,
      bbox: { width: maxX, height: maxY }
    })
  }

  // Arrange clusters in a grid
  const cols = Math.max(1, Math.ceil(Math.sqrt(clusterLayouts.length)))
  const tableNodes: SchemaNode[] = []
  const groupNodes: SchemaNode[] = []

  let col = 0
  let rowMaxHeight = 0
  let cursorX = 0
  let cursorY = 0

  for (const cluster of clusterLayouts) {
    const groupWidth = cluster.bbox.width + GROUP_PADDING * 2
    const groupHeight = cluster.bbox.height + GROUP_PADDING * 2 + 32 // 32 = label header

    // Offset table nodes to absolute canvas position
    for (const id of cluster.ids) {
      const relPos = cluster.positions.get(id)!
      const node = nodes.find((n) => n.id === id)!
      tableNodes.push({
        ...node,
        position: {
          x: cursorX + GROUP_PADDING + relPos.x,
          y: cursorY + GROUP_PADDING + 32 + relPos.y
        }
      })
    }

    // Create group background node
    groupNodes.push({
      id: `__group__${cluster.name}`,
      type: 'group',
      position: { x: cursorX, y: cursorY },
      data: {
        label: cluster.name,
        tableCount: cluster.ids.length,
        width: groupWidth,
        height: groupHeight,
        isExpanded: true
      }
    } as unknown as SchemaNode)

    rowMaxHeight = Math.max(rowMaxHeight, groupHeight)
    cursorX += groupWidth + CLUSTER_GAP

    col++
    if (col >= cols) {
      col = 0
      cursorX = 0
      cursorY += rowMaxHeight + CLUSTER_GAP
      rowMaxHeight = 0
    }
  }

  return { tableNodes, groupNodes }
}
