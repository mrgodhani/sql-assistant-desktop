# Schema Visualization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an interactive ER diagram view using Vue Flow that renders tables, columns, and foreign key relationships from introspected database schemas.

**Architecture:** New `/schema` route with a Vue Flow canvas. A Pinia store transforms `DatabaseSchema` from the existing `schema:introspect` IPC into Vue Flow nodes and edges. Dagre computes the layout. Custom `TableNode` renders each table as a card with columns.

**Tech Stack:** Vue 3, Vue Flow (`@vue-flow/core`, `@vue-flow/minimap`, `@vue-flow/controls`), dagre, html-to-image, Pinia, Tailwind CSS / shadcn-vue

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install Vue Flow and layout packages**

Run:
```bash
npm install @vue-flow/core @vue-flow/minimap @vue-flow/controls dagre html-to-image
```

**Step 2: Install dagre type definitions**

Run:
```bash
npm install -D @types/dagre
```

**Step 3: Verify build still works**

Run:
```bash
npm run build
```
Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(schema-viz): add vue-flow, dagre, and html-to-image dependencies"
```

---

### Task 2: Create the Pinia Store

**Files:**
- Create: `src/renderer/src/stores/useSchemaVisualizationStore.ts`

**Step 1: Create the store with state, getters, and actions**

The store manages schema data, Vue Flow nodes/edges, layout, search, filter, and selection state. It transforms `TableInfo[]` from the existing `DatabaseSchema` type into Vue Flow `Node[]` and `Edge[]`, then runs dagre to compute positions.

Key responsibilities:
- `loadSchema(connectionId)` — calls `window.schemaApi.introspect()`, stores the result
- `buildGraph()` — maps `TableInfo` → nodes, `ForeignKeyInfo` → edges
- `applyLayout(direction)` — runs dagre to assign x/y positions to each node
- `selectNode(id)` — sets selection and computes connected node IDs for highlighting
- `setSearch(query)` — filters visible nodes, fades non-matching
- `setFilter(filter)` — filters by table/view/connected/relationships
- `toggleGroup(groupId)` / `toggleColumns(nodeId)` — progressive disclosure
- Getters: `visibleNodes`, `visibleEdges`, `connectedNodeIds`, `groups`, `tableCount`, `visibleTableCount`

Node ID format: `schema ? \`${schema}.${name}\` : name`

Edge ID format: `\`${sourceTable}.${sourceCol}->${targetTable}.${targetCol}\``

Node grouping logic:
- If tables have a `schema` property, group by schema
- Otherwise cluster by FK connectivity (BFS from each unvisited table)
- Schemas with <30 tables skip grouping entirely

Column collapsing: tables with >8 columns show PKs + FKs + first 3 others. Track expanded state in `expandedColumns: Set<string>`.

**Step 2: Commit**

```bash
git add src/renderer/src/stores/useSchemaVisualizationStore.ts
git commit -m "feat(schema-viz): add schema visualization Pinia store"
```

---

### Task 3: Create the TableNode Component

**Files:**
- Create: `src/renderer/src/components/schema/TableNode.vue`

**Step 1: Create the custom Vue Flow node**

This is the core visual element — a card representing one database table.

Structure:
- Header row: table icon (from lucide — `Table2` for tables, `Eye` for views), table name, type badge
- Column rows: each column shows an icon (key icon `Key` for PK, link icon `Link2` for FK, dash for regular), column name, data type, `?` if nullable
- If collapsed (>8 columns), show PKs + FKs + first 3 others + "Show all N columns" button at bottom
- Vue Flow `Handle` components: `source` handle (Position.Right) on FK columns, `target` handle (Position.Left) on PK columns that are referenced by other tables

Props received from Vue Flow's `data` property:
- `table: TableInfo`
- `isSelected: boolean`
- `isConnected: boolean` (connected to selected node)
- `isDimmed: boolean` (not matching search/filter)
- `isExpanded: boolean` (showing all columns)
- `onToggleColumns: () => void`

Styling:
- `bg-card border rounded-lg shadow-sm` base
- Selected: `ring-2 ring-primary border-primary`
- Connected: `ring-1 ring-primary/50`
- Dimmed: `opacity-20 pointer-events-none`
- Header: `bg-muted/50 px-3 py-2 border-b` with `text-sm font-semibold`
- Column rows: `px-3 py-1 text-xs font-mono` with hover `bg-muted/30`
- Width: fixed at `280px` for consistent layout

**Step 2: Commit**

```bash
git add src/renderer/src/components/schema/TableNode.vue
git commit -m "feat(schema-viz): add TableNode custom Vue Flow node component"
```

---

### Task 4: Create the SchemaCanvas Component

**Files:**
- Create: `src/renderer/src/components/schema/SchemaCanvas.vue`

**Step 1: Create the Vue Flow canvas wrapper**

This component hosts the `<VueFlow>` instance and wires it to the store.

Setup:
- Import `VueFlow` from `@vue-flow/core`, plus `@vue-flow/core/dist/style.css` and `@vue-flow/core/dist/theme-default.css`
- Register `TableNode` as a custom node type via the `node-types` prop: `{ table: TableNode }`
- Bind `:nodes` and `:edges` to the store's `visibleNodes` and `visibleEdges` getters
- Listen to `@node-click` to call `store.selectNode()`
- Listen to `@pane-click` to call `store.selectNode(null)` (deselect)
- Use `useVueFlow()` composable to get `fitView`, `zoomIn`, `zoomOut` — expose these for the controls component
- Apply default edge styling: `animated: false`, `type: 'smoothstep'`, `style: { stroke: 'var(--muted-foreground)' }`
- Selected/highlighted edges override with `style: { stroke: 'var(--primary)', strokeWidth: 2 }`

Container: `class="h-full w-full"` — fills the parent.

**Step 2: Commit**

```bash
git add src/renderer/src/components/schema/SchemaCanvas.vue
git commit -m "feat(schema-viz): add SchemaCanvas Vue Flow wrapper"
```

---

### Task 5: Create the SchemaToolbar Component

**Files:**
- Create: `src/renderer/src/components/schema/SchemaToolbar.vue`

**Step 1: Create the toolbar with search, filter, layout, and export**

Layout: horizontal bar with `flex items-center gap-3 px-4 py-2 border-b bg-background`.

Elements (left to right):
1. **Search input** — `<Input>` (shadcn) with search icon, `v-model` bound to store's `searchQuery`, `@input` debounced at 200ms calling `store.setSearch()`. Placeholder: "Search tables...". Clears on Escape.
2. **Filter dropdown** — `<Select>` (shadcn) with options: All, Tables only, Views only, Connected to selected (disabled if nothing selected), With relationships. Calls `store.setFilter()`.
3. **Layout dropdown** — `<Select>` with options: Top to Bottom, Left to Right. Calls `store.applyLayout(direction)`.
4. **Re-layout button** — `<Button variant="outline" size="sm">` with `RotateCcw` icon. Calls `store.applyLayout()`.
5. **Export dropdown** — `<Select>` with options: Export PNG, Export SVG. Calls `store.exportImage(format)`.
6. **Table count** — right-aligned `<span class="text-xs text-muted-foreground">` showing `${visibleTableCount} / ${tableCount} tables`.

**Step 2: Commit**

```bash
git add src/renderer/src/components/schema/SchemaToolbar.vue
git commit -m "feat(schema-viz): add SchemaToolbar with search, filter, layout, export"
```

---

### Task 6: Create SchemaControls Component

**Files:**
- Create: `src/renderer/src/components/schema/SchemaControls.vue`

**Step 1: Create minimap and zoom controls**

Wrap Vue Flow's built-in components:
- `<MiniMap>` from `@vue-flow/minimap` — positioned bottom-right, import `@vue-flow/minimap/dist/style.css`
- `<Controls>` from `@vue-flow/controls` — positioned bottom-left, import `@vue-flow/controls/dist/style.css`

Override default control styles with CSS to match the app's theme (use `--background`, `--border`, `--foreground` variables).

**Step 2: Commit**

```bash
git add src/renderer/src/components/schema/SchemaControls.vue
git commit -m "feat(schema-viz): add SchemaControls with minimap and zoom"
```

---

### Task 7: Create SchemaView and Wire Up Route + Navigation

**Files:**
- Create: `src/renderer/src/views/SchemaView.vue`
- Modify: `src/renderer/src/router/index.ts`
- Modify: `src/renderer/src/components/sidebar/AppSidebar.vue`

**Step 1: Create SchemaView**

Structure:
- Connection picker at top (if no `connectionId` param): dropdown of `connectionStore.connectedConnections`, auto-selects first connected
- Error states: no connections → empty state with link to `/connections`; not connected → "Connect" button inline; introspection error → `ErrorMessage` with retry
- Loading state: `LoadingSpinner` while introspecting
- Main content: `SchemaToolbar` above `SchemaCanvas` (with `SchemaControls` rendered inside the canvas)
- `onMounted`: load schema for selected connection
- Watch `connectionId` param for route changes

Layout: `<div class="flex h-full flex-col">` — toolbar at top, canvas fills remaining space.

**Step 2: Add route**

In `src/renderer/src/router/index.ts`, add between the `/chat/:conversationId` and `/connections` routes:

```typescript
{
  path: '/schema',
  name: 'schema',
  component: SchemaView,
  meta: { title: 'Schema' }
},
{
  path: '/schema/:connectionId',
  name: 'schema-connection',
  component: SchemaView,
  meta: { title: 'Schema' }
}
```

Import `SchemaView` at top of file.

**Step 3: Add sidebar nav item**

In `src/renderer/src/components/sidebar/AppSidebar.vue`, add to the `navItems` array after "Chat":

```typescript
{ to: '/schema', label: 'Schema', icon: Network }
```

Import `Network` from `lucide-vue-next`.

**Step 4: Verify the app loads and navigates to Schema view**

Run:
```bash
npm run dev
```
Expected: App starts. Sidebar shows "Schema" between "Chat" and "Connections". Clicking it navigates to `/schema`. Empty state shows if no connections.

**Step 5: Commit**

```bash
git add src/renderer/src/views/SchemaView.vue src/renderer/src/router/index.ts src/renderer/src/components/sidebar/AppSidebar.vue
git commit -m "feat(schema-viz): add SchemaView, route, and sidebar navigation"
```

---

### Task 8: Add Dagre Auto-Layout

**Files:**
- Modify: `src/renderer/src/stores/useSchemaVisualizationStore.ts`

**Step 1: Implement the layout function**

In the store's `applyLayout` action:

```typescript
import dagre from 'dagre'

function applyLayout(direction: 'TB' | 'LR' = 'TB') {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 })

  for (const node of nodes.value) {
    g.setNode(node.id, { width: 280, height: estimateNodeHeight(node) })
  }
  for (const edge of edges.value) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  nodes.value = nodes.value.map((node) => {
    const pos = g.node(node.id)
    return { ...node, position: { x: pos.x - 140, y: pos.y - pos.height / 2 } }
  })
}
```

`estimateNodeHeight(node)`: header (40px) + visible columns * 28px + padding (16px). Use collapsed column count if not expanded.

**Step 2: Verify layout renders correctly**

Run `npm run dev`, connect to a database, navigate to Schema. Tables should appear in a hierarchical layout.

**Step 3: Commit**

```bash
git add src/renderer/src/stores/useSchemaVisualizationStore.ts
git commit -m "feat(schema-viz): add dagre auto-layout for node positioning"
```

---

### Task 9: Add Node Selection and Highlighting

**Files:**
- Modify: `src/renderer/src/stores/useSchemaVisualizationStore.ts`
- Modify: `src/renderer/src/components/schema/TableNode.vue`
- Modify: `src/renderer/src/components/schema/SchemaCanvas.vue`

**Step 1: Implement selection logic in store**

When `selectNode(id)` is called:
- Set `selectedNodeId = id`
- Compute `connectedNodeIds` by walking FK edges from the selected node (both directions — tables it references and tables that reference it)
- Pass `isSelected`, `isConnected`, `isDimmed` to node data for each node

**Step 2: Update TableNode to respond to selection state**

Apply conditional classes based on `isSelected`, `isConnected`, `isDimmed` props already defined in Task 3.

**Step 3: Update edge styling on selection**

In `SchemaCanvas`, compute edge styles reactively: edges connected to the selected node get `stroke: var(--primary)` and `strokeWidth: 2`, others get `opacity: 0.2` when a selection is active.

**Step 4: Verify selection and highlighting**

Click a table → it highlights blue, connected tables highlight faintly, edges between them go bold, everything else dims. Click the canvas background → deselects all.

**Step 5: Commit**

```bash
git add src/renderer/src/stores/useSchemaVisualizationStore.ts src/renderer/src/components/schema/TableNode.vue src/renderer/src/components/schema/SchemaCanvas.vue
git commit -m "feat(schema-viz): add node selection with connected highlighting"
```

---

### Task 10: Add Search and Filter

**Files:**
- Modify: `src/renderer/src/stores/useSchemaVisualizationStore.ts`
- Modify: `src/renderer/src/components/schema/SchemaToolbar.vue`
- Modify: `src/renderer/src/components/schema/SchemaCanvas.vue`

**Step 1: Implement search in store**

`setSearch(query)`:
- Case-insensitive match against table names
- Matching tables stay fully visible, non-matching tables get `isDimmed = true`
- If exactly one match, use Vue Flow's `fitView({ nodes: [matchId] })` to pan/zoom to it

**Step 2: Implement filter in store**

`setFilter(filter)`:
- `'all'`: show everything
- `'tables'`: hide nodes where `table.type === 'view'`
- `'views'`: hide nodes where `table.type === 'table'`
- `'connected'`: show only `selectedNodeId` + `connectedNodeIds` (no-op if nothing selected)
- `'with-relationships'`: hide nodes that have zero FK edges (no outgoing or incoming)

Filtered-out nodes are removed from `visibleNodes`; their edges are removed from `visibleEdges`.

**Step 3: Wire toolbar inputs to store**

Bind search input `v-model` with debounce. Bind filter/layout selects to store actions.

**Step 4: Verify search and filter**

Type a table name → non-matching tables fade. Select "Tables only" → views disappear. Select "Connected to selected" with a table selected → only neighbors visible.

**Step 5: Commit**

```bash
git add src/renderer/src/stores/useSchemaVisualizationStore.ts src/renderer/src/components/schema/SchemaToolbar.vue src/renderer/src/components/schema/SchemaCanvas.vue
git commit -m "feat(schema-viz): add search and filter functionality"
```

---

### Task 11: Add Schema Grouping for Large Schemas

**Files:**
- Modify: `src/renderer/src/stores/useSchemaVisualizationStore.ts`
- Create: `src/renderer/src/components/schema/GroupNode.vue`
- Modify: `src/renderer/src/components/schema/SchemaCanvas.vue`

**Step 1: Create GroupNode component**

A collapsed group box: rounded rectangle with `bg-muted/30 border-dashed border-2 rounded-xl`. Shows group name, table count, and an expand button. On click, calls `store.toggleGroup(groupId)`.

When expanded, the group becomes a transparent background rectangle (Vue Flow parent node) containing its child table nodes.

**Step 2: Implement grouping logic in store**

In `buildGraph()`, after creating all nodes:
- If total tables >= 30 and tables have `schema` property, group by schema
- If total tables >= 30 and no schema property, cluster by FK connectivity (BFS)
- Create a `GroupNode` for each group, set child nodes' `parentNode` to the group ID
- Track `expandedGroups: Set<string>`

`toggleGroup(groupId)`:
- If expanding: set child nodes visible, re-run dagre for the group's children
- If collapsing: hide child nodes, show group node

**Step 3: Implement edge bundling**

When a group is collapsed, replace all individual FK edges between its tables and other groups/tables with a single "bundle" edge labeled with the count.

**Step 4: Register GroupNode in SchemaCanvas**

Add to node types: `{ table: TableNode, group: GroupNode }`.

**Step 5: Verify with a large schema**

Test with a database that has 30+ tables. Groups should appear collapsed. Clicking expands to show individual tables.

**Step 6: Commit**

```bash
git add src/renderer/src/stores/useSchemaVisualizationStore.ts src/renderer/src/components/schema/GroupNode.vue src/renderer/src/components/schema/SchemaCanvas.vue
git commit -m "feat(schema-viz): add schema grouping and edge bundling for large schemas"
```

---

### Task 12: Add Export and Keyboard Shortcuts

**Files:**
- Modify: `src/renderer/src/stores/useSchemaVisualizationStore.ts`
- Modify: `src/renderer/src/components/schema/SchemaCanvas.vue`
- Modify: `src/renderer/src/components/schema/SchemaToolbar.vue`

**Step 1: Implement export**

In the store, `exportImage(format)`:

```typescript
import { toPng, toSvg } from 'html-to-image'

async function exportImage(format: 'png' | 'svg') {
  const el = document.querySelector('.vue-flow') as HTMLElement
  if (!el) return
  const dataUrl = format === 'png' ? await toPng(el) : await toSvg(el)
  const { filePath } = await window.exportApi.showSaveDialog({
    defaultPath: `schema.${format}`,
    filters: [{ name: format.toUpperCase(), extensions: [format] }]
  })
  if (!filePath) return
  // Send dataUrl to main process for saving, or use a download link in the renderer
}
```

Alternative approach if `showSaveDialog` doesn't support writing binary: create a temporary `<a>` download link in the renderer.

**Step 2: Add keyboard shortcuts**

In `SchemaCanvas.vue`, use `onKeydown` listener (or `@vueuse/core`'s `useMagicKeys`):

| Shortcut | Action |
|----------|--------|
| `/` or `Cmd+F` | Focus search input (emit event or use template ref) |
| `Escape` | Clear selection and search |
| `Cmd+=` | `zoomIn()` |
| `Cmd+-` | `zoomOut()` |
| `Cmd+0` | `fitView()` |
| `Cmd+Shift+E` | Export PNG |

**Step 3: Verify export and shortcuts**

Export PNG → save dialog opens, file saves correctly. Press `/` → search focuses. Press Escape → clears.

**Step 4: Commit**

```bash
git add src/renderer/src/stores/useSchemaVisualizationStore.ts src/renderer/src/components/schema/SchemaCanvas.vue src/renderer/src/components/schema/SchemaToolbar.vue
git commit -m "feat(schema-viz): add PNG/SVG export and keyboard shortcuts"
```

---

### Task 13: Final Polish and Manual Testing

**Files:**
- Various — fix any styling or behavior issues found during testing

**Step 1: Test with each database type**

Connect to PostgreSQL, MySQL, SQLite, and SQL Server (if available). Verify:
- Schema loads and renders for each
- FK edges connect correctly
- Column types display correctly
- Views are distinguished from tables

**Step 2: Test dark mode**

Toggle theme in Settings. Verify all node colors, edges, toolbar, and controls adapt correctly.

**Step 3: Test edge cases**

- Database with 0 tables → empty state
- Database with no FKs → tables render without edges, info banner shows
- Database with 100+ tables → grouping activates
- Rapid connection switching → no stale state

**Step 4: Test responsive behavior**

Resize the Electron window. Canvas should fill available space. Toolbar should not overflow (wrap or truncate gracefully).

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(schema-viz): polish and fix edge cases"
```
