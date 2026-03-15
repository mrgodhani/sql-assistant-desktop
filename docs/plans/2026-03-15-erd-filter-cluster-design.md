# ERD Filter Parity & Clustered Layout Design

**Date:** 2026-03-15
**Status:** Approved

## Problem

The Schema Tab and Designer Tab have inconsistent filtering capabilities. The Designer Tab has a checkbox-based table picker (`DesignerTableFilterPopover`) that lets users show/hide individual tables. The Schema Tab only has a type-based filter dropdown (All / Tables only / Views only / Connected to selected / With relationships) and a text search — there is no way to cherry-pick specific tables.

Additionally, both tabs support drag-to-reposition nodes but offer only two auto-layout modes (Top-to-Bottom, Left-to-Right via dagre). Large schemas produce flat, hard-to-read diagrams. There is no way to visually group related tables into domain clusters.

## Goals

1. **Filter parity** — both tabs get an individual-table checkbox filter, sharing a single component.
2. **Designer Tab filter enhancement** — the Designer Tab gets minor additional filter capability via the shared component's "Connected to selected" quick action (already partially present).
3. **Clustered layout** — a new `'clustered'` layout mode available in both tabs. It auto-detects FK relationship islands, infers domain names from table-name patterns, and renders labeled background group boxes around each cluster.

## Approach

Approach B — Shared Filter Component + Smart Cluster Mode.

- Extract a generic `TableFilterPopover.vue` shared component.
- Add a pure `lib/cluster-layout.ts` utility for the cluster algorithm.
- Minimal store changes; all cluster logic is pure and reusable by both tabs.

## Architecture

```
┌─ Schema Tab ────────────────────────────────────────────────┐
│  SchemaToolbar.vue                                          │
│    + [Filter tables ▾]  <- new TableFilterPopover           │
│    + [Clustered] option in layout select                    │
│  SchemaCanvas.vue          (unchanged)                      │
│  GroupNode.vue             (updated: background-box mode)   │
│  useSchemaVisualizationStore.ts                             │
│    + individualFilter: string[] | null                      │
│    + 'clustered' LayoutDirection                            │
│    + buildClusteredLayout()                                 │
└─────────────────────────────────────────────────────────────┘

┌─ Designer Tab ──────────────────────────────────────────────┐
│  DesignerToolbar.vue                                        │
│    ~ swap DesignerTableFilterPopover -> TableFilterPopover  │
│    + [Clustered] option in Re-layout dropdown               │
│  DesignerCanvas.vue                                         │
│    + local layoutMode ref                                   │
│    + calls buildClusteredLayout() from shared util          │
│  useSchemaDesignerStore.ts  (unchanged)                     │
└─────────────────────────────────────────────────────────────┘

┌─ Shared ────────────────────────────────────────────────────┐
│  components/shared/TableFilterPopover.vue   <- new          │
│  lib/cluster-layout.ts                      <- new          │
│    findConnectedComponents()                                │
│    inferClusterName()                                       │
│    buildClusteredLayout()                                   │
└─────────────────────────────────────────────────────────────┘
```

## Feature 1: Filter Parity

### `TableFilterPopover.vue` (new shared component)

**Props:**
```typescript
defineProps<{
  tables: string[]              // all table IDs to display
  modelValue: string[] | null   // null = show all, [] = hide all, array = specific tables
  selectedNodeId?: string | null
  getConnectedIds?: (nodeId: string) => string[]
}>()
defineEmits<{ 'update:modelValue': [value: string[] | null] }>()
```

**UI:**
- Search input to filter the checkbox list
- Scrollable checkbox list (max-height 240px, overflow scroll)
- Footer quick actions: **Select all**, **Deselect all**, **Connected to selected** (disabled when no node selected)
- Trigger button: `Filter tables` with Filter icon

### Schema Tab wiring

New state added to `useSchemaVisualizationStore`:
```typescript
const individualFilter = ref<string[] | null>(null)
const hasIndividualFilter = computed(() => individualFilter.value !== null)
```

`visibleNodes` applies `individualFilter` as a final pass after the type filter and search query:
```
visibleNodes = all nodes
  -> type filter (tables / views / connected / with-relationships)
  -> search query match
  -> individualFilter (if not null, keep only matching IDs)
```

`SchemaToolbar` additions:
- New `TableFilterPopover` button between the layout select and Re-layout button
- Active badge: `"Showing N of M ×"` (same style as Designer Tab badge) when `hasIndividualFilter` is true

```
[Search...]  [Filter: All ▾]  [Layout: TB ▾]  [Filter tables ▾]  [Re-layout]  [Export ▾]
                                                                               12 / 47 tables
```

### Designer Tab wiring

Drop-in replacement of `DesignerTableFilterPopover` with `TableFilterPopover`:
- `tables`: `store.schema?.tables.map(buildNodeId) ?? []`
- `modelValue`: `store.filteredTables`
- `selectedNodeId`: `store.selectedNodeId`
- `getConnectedIds`: `store.getConnectedTableIds`
- `@update:modelValue`: `store.setFilter`

Existing filter badge and clear button behavior unchanged.

**`DesignerTableFilterPopover.vue` is deleted** — fully replaced.

## Feature 2: Clustered Layout

### `lib/cluster-layout.ts`

Pure utility module with no store imports. Reusable by both tabs.

#### `findConnectedComponents(nodeIds, edges)`

BFS over the FK edge graph. Returns an array of `string[][]` — each inner array is one connected component (relationship island).

Isolated nodes (no FK edges at all) are merged into a single **"Uncategorized"** cluster placed last. This avoids creating dozens of single-node boxes for schemas with many standalone lookup tables.

#### `inferClusterName(tableIds)`

Tries rules in priority order, stopping at first match:

| Priority | Rule | Example result |
|---|---|---|
| 1 | All table names share a common `_`-delimited prefix (>= 3 chars, >= 60% of tables) | `order`, `order_items`, `order_status` -> **"Orders"** |
| 2 | Majority share a common suffix word after splitting on `_` | `user_roles`, `admin_roles` -> **"Roles"** |
| 3 | Single dominant root table (no FK parents, most FK children) | root = `products` -> **"Products"** |
| 4 | Fallback | **"Domain 1"**, **"Domain 2"**, ... |

Names are title-cased and trailing `_` stripped.

#### `buildClusteredLayout(nodes, edges, nodeWidth, getNodeHeight)`

Returns `{ tableNodes: SchemaNode[], groupNodes: SchemaNode[] }`.

**Algorithm:**
1. Run `findConnectedComponents` to get clusters.
2. For each cluster, infer a name with `inferClusterName`.
3. Run dagre (`rankdir: 'TB'`, `nodesep: 60`, `ranksep: 80`) on just the nodes in that cluster to get relative positions starting from `(0, 0)`.
4. Compute each cluster's bounding box (`width`, `height`) from its laid-out nodes plus `GROUP_PADDING = 48px` on all sides.
5. Sort clusters by size descending. Arrange in a grid: `cols = ceil(sqrt(clusterCount))`, `CLUSTER_GAP = 120px` between clusters.
6. Offset each cluster's table nodes by the cluster's grid position (absolute canvas coordinates).
7. Emit a group background node per cluster:
   - `type: 'group'`
   - `position`: cluster top-left (including padding)
   - `data.width` / `data.height`: bounding box dimensions
   - `data.label`: inferred cluster name
   - `data.tableCount`: number of tables in cluster

Table nodes have **no `parentNode`** set — they are positioned absolutely. Group nodes sit behind table nodes via lower z-index. This avoids VueFlow sub-flow complexity and preserves existing drag behavior.

### GroupNode.vue updates

Updated to render as a full background box when `data.width` and `data.height` are provided:
- Applies `style="width: {data.width}px; height: {data.height}px"` to the root div
- Keeps the existing dashed border + label header
- Removes the collapse toggle (not needed for background box mode)
- Adds a subtle tinted background color per cluster (cycle through a fixed palette of 6 muted hues)

### Schema Tab integration

`LayoutDirection` type extended:
```typescript
export type LayoutDirection = 'TB' | 'LR' | 'clustered'
```

`applyLayout()` in `useSchemaVisualizationStore` branches:
```
if direction === 'clustered':
  result = buildClusteredLayout(nodes, edges, ...)
  nodes.value = [...result.groupNodes, ...result.tableNodes]
else:
  run existing dagre layout (unchanged)
  remove any group nodes from nodes.value
```

`SchemaToolbar` layout select gains a third option:
```html
<SelectItem value="clustered">Clustered (auto-group)</SelectItem>
```

### Designer Tab integration

`DesignerCanvas.vue` gains a local `layoutMode` ref (`'TB' | 'LR' | 'clustered'`, default `'TB'`).

The Re-layout button becomes a split button / dropdown:
```
[Re-layout ▾]
  - Top to Bottom
  - Left to Right
  - Clustered (auto-group)
```

When "Clustered" is selected:
1. `store.clearNodePositions()`
2. Calls `buildClusteredLayout` with the current nodes/edges
3. Sets both table node and group node positions in the VueFlow instance via `setNodes`

Switching away from clustered runs the existing dagre layout and removes group nodes.

## State Changes

### `useSchemaVisualizationStore.ts`

```typescript
// New state
const individualFilter = ref<string[] | null>(null)

// Extended type
type LayoutDirection = 'TB' | 'LR' | 'clustered'

// New actions
function setIndividualFilter(tables: string[] | null): void {
  individualFilter.value = tables
}
function clearIndividualFilter(): void {
  individualFilter.value = null
}

// New computed
const hasIndividualFilter = computed(() => individualFilter.value !== null)

// Modified: visibleNodes — add individualFilter pass at the end
// Modified: applyLayout() — branch to buildClusteredLayout when direction === 'clustered'
// Modified: buildGraph() — reset individualFilter and remove any group nodes on schema reload
// Modified: visibleTableCount — exclude group-type nodes from count
```

### `useSchemaDesignerStore.ts`

No changes required.

## File Change Summary

| File | Action | Summary |
|---|---|---|
| `src/renderer/src/lib/cluster-layout.ts` | **Create** | Pure utils: `findConnectedComponents`, `inferClusterName`, `buildClusteredLayout` |
| `src/renderer/src/components/shared/TableFilterPopover.vue` | **Create** | Generic checkbox filter popover (props-driven, replaces Designer-only version) |
| `src/renderer/src/components/schema/GroupNode.vue` | **Modify** | Accept `data.width`/`data.height`, render as full background box with tinted fill |
| `src/renderer/src/components/schema/SchemaToolbar.vue` | **Modify** | Add `TableFilterPopover` button + active badge; add "Clustered" to layout select |
| `src/renderer/src/components/schema-designer/DesignerToolbar.vue` | **Modify** | Swap `DesignerTableFilterPopover` -> `TableFilterPopover`; Re-layout becomes dropdown with Clustered option |
| `src/renderer/src/components/schema-designer/DesignerCanvas.vue` | **Modify** | Add local `layoutMode` ref; call `buildClusteredLayout` when mode is 'clustered' |
| `src/renderer/src/components/schema-designer/DesignerTableFilterPopover.vue` | **Delete** | Replaced by shared `TableFilterPopover` |
| `src/renderer/src/stores/useSchemaVisualizationStore.ts` | **Modify** | Add `individualFilter`, extend `LayoutDirection` to include 'clustered', wire clustered layout |

**No new npm dependencies required.** dagre and VueFlow are already installed.

## Non-Goals

- Editable cluster names (can be added later as Approach C)
- Persisting Schema Tab node positions across app restarts (separate feature)
- Snap-to-grid or align/distribute tools
- AI-based semantic clustering (the name inference is purely string-pattern based)
