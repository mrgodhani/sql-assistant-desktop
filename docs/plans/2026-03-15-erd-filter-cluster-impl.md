# ERD Filter Parity & Clustered Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add individual-table checkbox filtering to the Schema Tab (matching the Designer Tab), and add a "Clustered (auto-group)" layout mode to both tabs that detects FK relationship islands and renders labeled domain group boxes.

**Architecture:** A pure `lib/cluster-layout.ts` utility handles connected-component detection, name inference, and layout — shared by both tabs. A generic `TableFilterPopover.vue` replaces the existing `DesignerTableFilterPopover.vue` and is wired into both toolbars. The Schema Tab store gains `individualFilter` state and the `'clustered'` layout direction. The Designer Tab uses a local `layoutMode` ref in `DesignerCanvas.vue` and calls the shared utility.

**Tech Stack:** Vue 3 Composition API (`<script setup>`), TypeScript, Pinia, VueFlow (`@vue-flow/core`), dagre, Vitest, Vue Test Utils.

**Design doc:** `docs/plans/2026-03-15-erd-filter-cluster-design.md`

---

## Task 1: Pure cluster-layout utility

**Files:**
- Create: `src/renderer/src/lib/cluster-layout.ts`
- Create: `src/renderer/src/lib/__tests__/cluster-layout.test.ts`

### Step 1: Write the failing tests

Create `src/renderer/src/lib/__tests__/cluster-layout.test.ts`:

```typescript
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
    expect(result).toMatch(/^Domain \d+$|^Foo$|^Bar$|^Baz$/)
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
```

### Step 2: Run tests to verify they fail

```bash
npm run test -- src/renderer/src/lib/__tests__/cluster-layout.test.ts
```
Expected: FAIL — "Cannot find module '../cluster-layout'"

### Step 3: Implement `cluster-layout.ts`

Create `src/renderer/src/lib/cluster-layout.ts`:

```typescript
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
      return titleCase(prefix)
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
  const connectedComponents = components.filter(
    (c) => c.length > 1 || edgeNodeIds.has(c[0])
  )
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
  let row = 0
  let rowMaxHeight = 0
  let cursorX = 0
  let cursorY = 0

  // Track row starting X positions for column widths
  const rowWidths: number[] = []

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
    rowWidths[row] = cursorX

    col++
    if (col >= cols) {
      col = 0
      row++
      cursorX = 0
      cursorY += rowMaxHeight + CLUSTER_GAP
      rowMaxHeight = 0
    }
  }

  return { tableNodes, groupNodes }
}
```

### Step 4: Run tests to verify they pass

```bash
npm run test -- src/renderer/src/lib/__tests__/cluster-layout.test.ts
```
Expected: All tests PASS

### Step 5: Commit

```bash
git add src/renderer/src/lib/cluster-layout.ts src/renderer/src/lib/__tests__/cluster-layout.test.ts
git commit -m "feat: add cluster-layout utility (connected components + name inference)"
```

---

## Task 2: Update GroupNode for background-box rendering

**Files:**
- Modify: `src/renderer/src/components/schema/GroupNode.vue`

GroupNode needs to render as a sized background box when `data.width` and `data.height` are provided (clustered layout mode), while preserving existing collapse behavior for any future schema-group usage.

### Step 1: Modify GroupNode.vue

Replace the entire file content:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { Layers } from 'lucide-vue-next'
import { useSchemaVisualizationStore } from '@renderer/stores/useSchemaVisualizationStore'

const props = defineProps<{
  id: string
  data: {
    label: string
    tableCount: number
    isExpanded: boolean
    width?: number
    height?: number
  }
}>()

const store = useSchemaVisualizationStore()

// Cycle through 6 muted hues for visual distinction between clusters
const HUE_PALETTE = [220, 160, 280, 30, 330, 90] // blue, teal, purple, orange, pink, green
const groupIndex = computed(() => {
  const groups = store.nodes.filter((n) => n.type === 'group')
  const idx = groups.findIndex((n) => n.id === props.id)
  return idx >= 0 ? idx : 0
})
const hue = computed(() => HUE_PALETTE[groupIndex.value % HUE_PALETTE.length])
const backgroundStyle = computed(() => `hsla(${hue.value}, 60%, 50%, 0.04)`)
const borderColor = computed(() => `hsla(${hue.value}, 60%, 50%, 0.25)`)

const isBackgroundBox = computed(() => props.data.width !== undefined && props.data.height !== undefined)
const boxStyle = computed(() => {
  if (!isBackgroundBox.value) return {}
  return {
    width: `${props.data.width}px`,
    height: `${props.data.height}px`,
    background: backgroundStyle.value,
    borderColor: borderColor.value
  }
})
</script>

<template>
  <div
    class="border-2 border-dashed rounded-xl px-6 py-4 min-w-[180px]"
    :style="boxStyle"
    :class="isBackgroundBox ? 'absolute' : ''"
  >
    <div class="flex items-center gap-3">
      <Layers class="h-4 w-4 shrink-0 text-muted-foreground" />
      <div class="flex-1 min-w-0">
        <div class="text-sm font-bold truncate">{{ data.label }}</div>
        <div class="text-xs text-muted-foreground">{{ data.tableCount }} tables</div>
      </div>
    </div>
  </div>
</template>
```

### Step 2: Verify visually (manual)

Run the app: `npm run dev`

Navigate to Schema Tab → select a connection with tables → choose "Clustered (auto-group)" layout (added in Task 4). Group boxes should appear as tinted background rectangles with a dashed colored border and domain label.

### Step 3: Commit

```bash
git add src/renderer/src/components/schema/GroupNode.vue
git commit -m "feat: update GroupNode to render as sized background box for clustered layout"
```

---

## Task 3: Create shared TableFilterPopover component

**Files:**
- Create: `src/renderer/src/components/shared/TableFilterPopover.vue`

### Step 1: Implement TableFilterPopover.vue

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Filter, Search } from 'lucide-vue-next'

const props = defineProps<{
  tables: string[]
  modelValue: string[] | null
  selectedNodeId?: string | null
  getConnectedIds?: (nodeId: string) => string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[] | null]
}>()

const searchQuery = ref('')

const selectedSet = computed(() => {
  if (props.modelValue === null) return new Set(props.tables.map((id) => id.toLowerCase()))
  return new Set(props.modelValue.map((id) => id.toLowerCase()))
})

const lowerToOriginal = computed(
  () => new Map(props.tables.map((id) => [id.toLowerCase(), id]))
)

const filteredTables = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return props.tables
  return props.tables.filter((id) => id.toLowerCase().includes(q))
})

function isChecked(tableId: string): boolean {
  return selectedSet.value.has(tableId.toLowerCase())
}

function toggle(tableId: string, checked: boolean): void {
  const lower = tableId.toLowerCase()
  let newSet: Set<string>
  if (props.modelValue === null) {
    newSet = new Set(props.tables.map((id) => id.toLowerCase()))
  } else {
    newSet = new Set(props.modelValue.map((id) => id.toLowerCase()))
  }

  if (checked) {
    newSet.add(lower)
  } else {
    newSet.delete(lower)
  }

  if (newSet.size === 0) {
    emit('update:modelValue', [])
    return
  }
  if (newSet.size === props.tables.length) {
    emit('update:modelValue', null)
    return
  }
  emit('update:modelValue', Array.from(newSet).map((l) => lowerToOriginal.value.get(l) ?? l))
}

function selectAll(): void {
  emit('update:modelValue', null)
}

function deselectAll(): void {
  emit('update:modelValue', [])
}

function connectedToSelected(): void {
  if (!props.selectedNodeId || !props.getConnectedIds) return
  const ids = props.getConnectedIds(props.selectedNodeId)
  emit('update:modelValue', ids.length === props.tables.length ? null : ids)
}
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button variant="outline" size="sm">
        <Filter class="size-3.5 mr-1" />
        Filter tables
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[280px] p-0" align="start">
      <div class="flex flex-col gap-2 p-3">
        <div class="relative">
          <Search
            class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
          />
          <Input
            v-model="searchQuery"
            placeholder="Search tables..."
            class="pl-8 h-8 text-sm"
          />
        </div>
        <div class="max-h-[240px] overflow-y-auto space-y-1.5 pr-1">
          <label
            v-for="tableId in filteredTables"
            :key="tableId"
            class="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-accent text-sm"
          >
            <Checkbox
              :checked="isChecked(tableId)"
              @update:checked="(v) => toggle(tableId, v === true)"
            />
            <span class="truncate">{{ tableId }}</span>
          </label>
          <p v-if="filteredTables.length === 0" class="text-xs text-muted-foreground px-2 py-1.5">
            No tables match
          </p>
        </div>
        <div class="flex flex-wrap gap-1 pt-1 border-t border-border">
          <Button variant="ghost" size="sm" class="h-7 text-xs" @click="selectAll">
            Select all
          </Button>
          <Button variant="ghost" size="sm" class="h-7 text-xs" @click="deselectAll">
            Deselect all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-7 text-xs"
            :disabled="!selectedNodeId"
            @click="connectedToSelected"
          >
            Connected to selected
          </Button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
```

### Step 2: Verify no lint errors

```bash
npm run typecheck
```
Expected: No errors in the new file.

### Step 3: Commit

```bash
git add src/renderer/src/components/shared/TableFilterPopover.vue
git commit -m "feat: add shared TableFilterPopover component"
```

---

## Task 4: Update useSchemaVisualizationStore — individualFilter + clustered layout

**Files:**
- Modify: `src/renderer/src/stores/useSchemaVisualizationStore.ts`
- Modify: `src/renderer/src/stores/__tests__/` (create new test file)
- Create: `src/renderer/src/stores/__tests__/useSchemaVisualizationStore.spec.ts`

### Step 1: Write failing tests

Create `src/renderer/src/stores/__tests__/useSchemaVisualizationStore.spec.ts`:

```typescript
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
```

### Step 2: Run tests to verify they fail

```bash
npm run test -- src/renderer/src/stores/__tests__/useSchemaVisualizationStore.spec.ts
```
Expected: FAIL — `store.individualFilter is not a function` or similar

### Step 3: Update the store

In `src/renderer/src/stores/useSchemaVisualizationStore.ts`:

**3a. Extend the `LayoutDirection` type:**
```typescript
export type LayoutDirection = 'TB' | 'LR' | 'clustered'
```

**3b. Add new state after `layoutDirection`:**
```typescript
const individualFilter = ref<string[] | null>(null)
```

**3c. Add new computed after `visibleTableCount`:**
```typescript
const hasIndividualFilter = computed(() => individualFilter.value !== null)
```

**3d. Add new actions before the `return` statement:**
```typescript
function setIndividualFilter(tables: string[] | null): void {
  individualFilter.value = tables
}

function clearIndividualFilter(): void {
  individualFilter.value = null
}
```

**3e. Update `visibleNodes` computed** — add a final individualFilter pass at the end of the existing computed:

```typescript
// After the existing search query filter block, add:
if (individualFilter.value !== null) {
  const filterSet = new Set(individualFilter.value.map((id) => id.toLowerCase()))
  filtered = filtered.filter((n) => filterSet.has(n.id.toLowerCase()))
}

return filtered
```

**3f. Update `buildGraph()`** — reset individual filter on schema reload. Add at the start of the function:
```typescript
individualFilter.value = null
```

Also reset `individualFilter` when removing group nodes from `nodes.value`. Since `buildGraph` rebuilds all nodes from scratch, group nodes are automatically cleared. No extra work needed.

**3g. Update `visibleTableCount`** — exclude group nodes:
```typescript
const visibleTableCount = computed((): number => {
  return visibleNodes.value.filter((n) => n.type === 'table').length
})
```

**3h. Update `applyLayout()`** — add the clustered branch. Import `buildClusteredLayout` at the top of the file:
```typescript
import { buildClusteredLayout } from '@/lib/cluster-layout'
```

Then in `applyLayout()`:
```typescript
function applyLayout(direction?: LayoutDirection): void {
  if (direction) {
    layoutDirection.value = direction
  }

  if (layoutDirection.value === 'clustered') {
    // Remove any existing group nodes first
    const tableNodesOnly = nodes.value.filter((n) => n.type === 'table')
    const result = buildClusteredLayout(
      tableNodesOnly,
      edges.value,
      NODE_WIDTH,
      (node) => {
        const columnCount = getVisibleColumnCount(node)
        return NODE_HEADER_HEIGHT + columnCount * COLUMN_ROW_HEIGHT + NODE_PADDING
      }
    )
    nodes.value = [...result.groupNodes, ...result.tableNodes]
    return
  }

  // Remove group nodes when switching back to TB/LR
  nodes.value = nodes.value.filter((n) => n.type === 'table')

  // Existing dagre layout code (unchanged below)
  const g = new dagre.graphlib.Graph()
  // ... rest of existing dagre code unchanged
}
```

**3i. Expose new state/actions in the return object:**
```typescript
return {
  // ... existing exports ...
  individualFilter,
  hasIndividualFilter,
  setIndividualFilter,
  clearIndividualFilter,
}
```

### Step 4: Run tests to verify they pass

```bash
npm run test -- src/renderer/src/stores/__tests__/useSchemaVisualizationStore.spec.ts
```
Expected: All tests PASS

### Step 5: Commit

```bash
git add src/renderer/src/stores/useSchemaVisualizationStore.ts src/renderer/src/stores/__tests__/useSchemaVisualizationStore.spec.ts
git commit -m "feat: add individualFilter and clustered layout to schema visualization store"
```

---

## Task 5: Update SchemaToolbar — filter button + clustered layout option

**Files:**
- Modify: `src/renderer/src/components/schema/SchemaToolbar.vue`

### Step 1: Update SchemaToolbar.vue

**5a. Add imports at top of `<script setup>`:**
```typescript
import TableFilterPopover from '@renderer/components/shared/TableFilterPopover.vue'
import { Filter, X } from 'lucide-vue-next'
```

**5b. Add handler functions:**
```typescript
function onIndividualFilterChange(value: string[] | null): void {
  store.setIndividualFilter(value)
}
```

**5c. Add `'clustered'` to the layout Select in the template:**
```html
<SelectItem value="clustered">Clustered (auto-group)</SelectItem>
```

**5d. Add `TableFilterPopover` button after the layout Select, before the Re-layout button:**
```html
<!-- Individual table filter -->
<TableFilterPopover
  :tables="store.nodes.filter(n => n.type === 'table').map(n => n.id)"
  :model-value="store.individualFilter"
  :selected-node-id="store.selectedNodeId"
  @update:model-value="onIndividualFilterChange"
/>

<!-- Active individual filter badge -->
<Badge
  v-if="store.hasIndividualFilter"
  variant="secondary"
  class="gap-1.5 pl-2 pr-1 cursor-pointer hover:bg-secondary/80"
  @click="store.clearIndividualFilter"
>
  <Filter class="size-3" />
  Showing {{ store.visibleTableCount }} of {{ store.tableCount }}
  <X class="size-3 text-muted-foreground hover:text-foreground" />
</Badge>
```

**5e. Add Badge import:**
```typescript
import { Badge } from '@renderer/components/ui/badge'
```

### Step 2: Type-check

```bash
npm run typecheck
```
Expected: No new errors.

### Step 3: Commit

```bash
git add src/renderer/src/components/schema/SchemaToolbar.vue
git commit -m "feat: add individual table filter and clustered layout to Schema Tab toolbar"
```

---

## Task 6: Update Designer Tab — swap filter component + add clustered Re-layout

**Files:**
- Modify: `src/renderer/src/components/schema-designer/DesignerToolbar.vue`
- Modify: `src/renderer/src/components/schema-designer/DesignerCanvas.vue`
- Delete: `src/renderer/src/components/schema-designer/DesignerTableFilterPopover.vue`

### Step 1: Update DesignerToolbar.vue

**6a. Replace the `DesignerTableFilterPopover` import with `TableFilterPopover`:**
```typescript
// Remove:
import DesignerTableFilterPopover from './DesignerTableFilterPopover.vue'

// Add:
import TableFilterPopover from '@renderer/components/shared/TableFilterPopover.vue'
```

**6b. Add `buildNodeId` helper** (same as in the deleted component):
```typescript
import type { TableDesign } from '../../../../shared/types'

function buildNodeId(t: TableDesign): string {
  return t.schema ? `${t.schema}.${t.name}` : t.name
}
```

**6c. In the template, replace `<DesignerTableFilterPopover />` with:**
```html
<TableFilterPopover
  v-if="store.hasSchema"
  :tables="store.schema?.tables.map(buildNodeId) ?? []"
  :model-value="store.filteredTables"
  :selected-node-id="store.selectedNodeId"
  :get-connected-ids="store.getConnectedTableIds"
  @update:model-value="store.setFilter"
/>
```

**6d. Change the Re-layout button into a dropdown:**

Replace:
```html
<Button v-if="store.hasSchema" variant="outline" size="sm" @click="store.clearNodePositions">
  <RotateCcw class="size-3.5 mr-1" />
  Re-layout
</Button>
```

With:
```html
<DropdownMenu v-if="store.hasSchema">
  <DropdownMenuTrigger as-child>
    <Button variant="outline" size="sm">
      <RotateCcw class="size-3.5 mr-1" />
      Re-layout
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem @click="emit('relayout', 'TB')">Top to Bottom</DropdownMenuItem>
    <DropdownMenuItem @click="emit('relayout', 'LR')">Left to Right</DropdownMenuItem>
    <DropdownMenuItem @click="emit('relayout', 'clustered')">Clustered (auto-group)</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**6e. Add emit to DesignerToolbar:**
```typescript
const emit = defineEmits<{
  relayout: [mode: 'TB' | 'LR' | 'clustered']
}>()
```

**6f. In DesignerView.vue, wire the relayout event:**
```html
<DesignerToolbar @relayout="onRelayout" />
```

Add handler in `SchemaDesignerView.vue`:
```typescript
import { ref } from 'vue'
const layoutMode = ref<'TB' | 'LR' | 'clustered'>('TB')
function onRelayout(mode: 'TB' | 'LR' | 'clustered'): void {
  layoutMode.value = mode
  store.clearNodePositions()
}
```

Pass `layoutMode` as a prop to `DesignerCanvas`:
```html
<DesignerCanvas
  :schema="store.schema"
  :previous-schema="store.previousSchema"
  :filtered-tables="store.filteredTables"
  :layout-mode="layoutMode"
/>
```

### Step 2: Update DesignerCanvas.vue

**6g. Add `layoutMode` prop:**
```typescript
const props = defineProps<{
  schema: SchemaDesign | null
  previousSchema: SchemaDesign | null
  filteredTables: string[] | null
  layoutMode?: 'TB' | 'LR' | 'clustered'
}>()
```

**6h. Import `buildClusteredLayout`:**
```typescript
import { buildClusteredLayout } from '@/lib/cluster-layout'
import GroupNode from '@renderer/components/schema/GroupNode.vue'
```

**6i. Add `group` to nodeTypes:**
```typescript
const nodeTypes = {
  table: markRaw(TableNode),
  group: markRaw(GroupNode)
} as Record<string, unknown>
```

**6j. Update `layoutNodes` computed** to handle `'clustered'` mode:

```typescript
const layoutNodes = computed(() => {
  const nodeList = nodes.value
  const edgeList = edges.value
  const stored = schemaDesignerStore.nodePositions
  if (nodeList.length === 0) return []

  if (props.layoutMode === 'clustered') {
    const result = buildClusteredLayout(
      nodeList,
      edgeList,
      NODE_WIDTH,
      (node) => {
        const colCount = node.data.table.columns.length
        return NODE_HEADER_HEIGHT + colCount * COLUMN_ROW_HEIGHT + NODE_PADDING
      }
    )
    return [...result.groupNodes, ...result.tableNodes] as SchemaNode[]
  }

  // Existing dagre layout (TB/LR) — unchanged
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: props.layoutMode === 'LR' ? 'LR' : 'TB', nodesep: 60, ranksep: 80 })

  for (const node of nodeList) {
    const colCount = node.data.table.columns.length
    const height = NODE_HEADER_HEIGHT + colCount * COLUMN_ROW_HEIGHT + NODE_PADDING
    g.setNode(node.id, { width: NODE_WIDTH, height })
  }
  for (const edge of edgeList) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  return nodeList.map((node) => {
    const dagrePos = g.node(node.id)
    const dagrePosition = {
      x: dagrePos.x - NODE_WIDTH / 2,
      y: dagrePos.y - (dagrePos.height as number) / 2
    }
    const position = stored[node.id] ?? dagrePosition
    return { ...node, position } as SchemaNode
  })
})
```

### Step 3: Delete DesignerTableFilterPopover.vue

```bash
git rm src/renderer/src/components/schema-designer/DesignerTableFilterPopover.vue
```

### Step 4: Type-check

```bash
npm run typecheck
```
Expected: No new errors.

### Step 5: Commit

```bash
git add -A
git commit -m "feat: update Designer Tab with shared filter and clustered layout mode"
```

---

## Task 7: Final integration verification

### Step 1: Full test run

```bash
npm run test
```
Expected: All tests pass (no regressions).

### Step 2: Build check

```bash
npm run build
```
Expected: Build succeeds with no TypeScript errors.

### Step 3: Manual smoke test

Run `npm run dev` and verify:

**Schema Tab:**
- [ ] "Filter tables" button opens checkbox popover with search
- [ ] Checking/unchecking tables hides/shows them in the ERD
- [ ] "Select all" / "Deselect all" work
- [ ] "Connected to selected" is enabled only when a node is selected
- [ ] Active filter badge shows correct count and clears on × click
- [ ] Layout select has "Clustered (auto-group)" option
- [ ] Clustered mode renders colored group boxes with inferred domain names
- [ ] Table nodes can still be dragged after clustering
- [ ] Switching back to TB/LR removes group boxes

**Designer Tab:**
- [ ] "Filter tables" button works identically to before
- [ ] Re-layout button is now a dropdown with TB / LR / Clustered options
- [ ] Clustered mode renders group boxes with inferred domain names
- [ ] Table nodes can still be dragged in clustered mode

### Step 4: Final commit

```bash
git add -A
git commit -m "feat: ERD filter parity and clustered domain layout for Schema and Designer tabs"
```

---

## Summary

| Task | Deliverable |
|---|---|
| 1 | `lib/cluster-layout.ts` + tests |
| 2 | `GroupNode.vue` background-box rendering |
| 3 | `shared/TableFilterPopover.vue` |
| 4 | Store: `individualFilter` + `'clustered'` layout direction |
| 5 | `SchemaToolbar.vue`: filter button + clustered select option |
| 6 | Designer Tab: swap filter component, Re-layout dropdown, clustered canvas |
| 7 | Integration verification |
