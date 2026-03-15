# Schema Visualization — Interactive ER Diagram

**Date:** 2026-03-15
**Status:** Approved
**Approach:** Vue Flow with dagre auto-layout

---

## Overview

Add an interactive ER diagram view to SQL Assist Desktop. Users navigate to a dedicated Schema view, select a connected database, and see all tables, views, columns, and foreign key relationships rendered as a draggable, zoomable node graph. The feature handles schemas from a handful of tables up to 500+ with progressive disclosure and virtualization.

---

## 1. Architecture & Navigation

**New route:** `/schema/:connectionId?` — a dedicated `SchemaView.vue`.

**Sidebar entry:** "Schema" item in `AppSidebar.vue` using the `Network` icon from `lucide-vue-next`, positioned between "Chat" and "Connections".

**Access flow:** User navigates to Schema view → selects a connected database from a dropdown (or auto-selects active connection) → ER diagram renders from introspected schema data.

### New files

| File | Purpose |
|------|---------|
| `src/renderer/src/views/SchemaView.vue` | View shell — connection picker + diagram container |
| `src/renderer/src/stores/useSchemaVisualizationStore.ts` | Pinia store — nodes, edges, layout, filters, search |
| `src/renderer/src/components/schema/SchemaCanvas.vue` | Vue Flow canvas with custom nodes and edges |
| `src/renderer/src/components/schema/TableNode.vue` | Custom Vue Flow node — table card with columns |
| `src/renderer/src/components/schema/SchemaToolbar.vue` | Search, filter, layout toggle, export button |
| `src/renderer/src/components/schema/SchemaControls.vue` | Zoom controls + minimap wrapper |

### Data pipeline

```
window.schemaApi.introspect(connectionId)
  → SchemaIntrospectionResult { schema: DatabaseSchema }
    → store.buildGraph(schema)
      → TableInfo[] mapped to Vue Flow Nodes
      → ForeignKeyInfo[] mapped to Vue Flow Edges
        → dagre auto-layout applied
          → Vue Flow renders
```

No new IPC channels — `schema:introspect` already returns tables, columns, types, PKs, FKs, and indexes.

---

## 2. Table Node Design

Each table renders as a custom Vue Flow node — a card styled with the existing shadcn/Tailwind design system.

### Visual structure

```
┌─────────────────────────────┐
│  📋 users          table    │  ← Header: icon, name, badge (table/view)
├─────────────────────────────┤
│  🔑 id          integer     │  ← PK row: key icon, name, type
│  ── name        varchar     │  ← Regular column
│  ── email       varchar     │  ← Regular column
│  🔗 org_id      integer  →  │  ← FK row: link icon, name, type, arrow
│  ── created_at  timestamp   │
└─────────────────────────────┘
```

### Node states

- **Default:** Header + columns (collapsed if >8 columns — shows PKs, FKs, first 3 others + "N more..." expander)
- **Selected:** Blue border highlight, all columns visible
- **Hover:** Subtle elevation/shadow change
- **Connected highlight:** Selecting a table highlights all FK-connected tables with a secondary color, connecting edges become bold/colored, unrelated tables dim to ~30% opacity

### Edge handles

Source handles on FK columns (right side), target handles on referenced PK columns (left side) — edges connect column-to-column.

### Styling

Uses existing CSS variables: `bg-card`, `border`, `rounded-lg`, `text-card-foreground`. Respects dark/light theme automatically. Nullable columns show a subtle `?` indicator on the type.

---

## 3. Toolbar, Search, Filter & Layout

### Toolbar (horizontal bar above canvas)

```
[ 🔍 Search tables...  ]  [ Filter: All ▾ ]  [ Layout: Auto ▾ ]  [ ⟳ Re-layout ]  [ 📥 Export ▾ ]
```

### Search

- Text input filters tables by name
- Matching tables stay fully visible, non-matching fade to ~20% opacity (spatial context preserved)
- Debounced at ~200ms
- Pans and zooms to matching results
- Clears on Escape

### Filter dropdown

- "All" — show everything
- "Tables only" — hide views
- "Views only" — hide tables
- "Connected to selected" — selected table + direct FK neighbors only
- "With relationships" — hide orphan tables with no FK connections

### Layout options

- **Top-to-bottom (default):** Hierarchical dagre layout, parent tables above children
- **Left-to-right:** Horizontal dagre layout, better for wide schemas
- **Re-layout button:** Re-runs layout after manual drag rearrangement

### Export

- Export as PNG
- Export as SVG
- Uses `html-to-image` to capture the Vue Flow viewport

### Minimap & zoom controls (bottom-right)

- Vue Flow's built-in `MiniMap` component
- Zoom in / zoom out / fit-to-view buttons via `Controls` component
- Keyboard shortcuts: `Cmd+/Cmd-` for zoom, `Cmd+0` for fit

---

## 4. Large Schema Performance

### Scale targets

| Schema size | Strategy |
|-------------|----------|
| < 30 tables | Render all tables flat, no grouping |
| 30-100 tables | Optional grouping, column collapsing on by default |
| 100-500 tables | Grouped by schema/prefix, collapsed by default, edge bundling |
| 500+ tables | Same + Web Worker layout, focus mode encouraged |

### Progressive disclosure — schema grouping

- Group tables by `schema` property (e.g., `public`, `auth`, `billing`) or by naming prefix
- Collapsed group boxes by default — one rounded rectangle per group showing name + table count
- Click a group to expand and see individual tables
- For databases without schema namespaces (SQLite), cluster by FK connectivity via graph walk

### Column collapsing

- Tables with >8 columns show only PKs, FKs, and first 3 other columns
- "Show all N columns" expander at the bottom of the node

### Edge culling & bundling

- Only render edges for visible tables
- Collapsed groups show a single thick "bundle" edge labeled with count (e.g., "4 relationships")
- On expand, bundle edges split into individual FK edges

### Layout performance

- Dagre handles ~500 nodes comfortably
- For 1000+ nodes, compute layout in a Web Worker
- Cache computed positions — re-layout only on explicit request or filter change
- Incremental layout on group expand — only re-layout the expanded group

### Search as navigation

- For large schemas, search is the primary navigation tool
- Searching pans and zooms to matching tables
- Focus mode: double-click a search result to see that table + 2 degrees of FK separation

---

## 5. Pinia Store Design

### State

```typescript
interface SchemaVisualizationState {
  connectionId: string | null
  schema: DatabaseSchema | null
  loading: boolean
  error: string | null

  nodes: Node[]
  edges: Edge[]

  selectedNodeId: string | null
  expandedGroups: Set<string>
  expandedColumns: Set<string>
  searchQuery: string
  filter: 'all' | 'tables' | 'views' | 'connected' | 'with-relationships'
  layoutDirection: 'TB' | 'LR'
}
```

### Actions

- `loadSchema(connectionId)` — fetch via `window.schemaApi.introspect`
- `buildGraph()` — transform `TableInfo[]` → nodes + edges
- `applyLayout()` — run dagre, update node positions
- `toggleGroup(groupId)` — expand/collapse a schema group
- `toggleColumns(nodeId)` — expand/collapse column list
- `selectNode(nodeId | null)` — highlight node + connected neighbors
- `setFilter(filter)` — apply filter, rebuild visible nodes/edges
- `setSearch(query)` — filter + pan to matching nodes
- `exportImage(format: 'png' | 'svg')` — capture viewport

### Getters

- `visibleNodes` — nodes after filter + search applied
- `visibleEdges` — edges between visible nodes only
- `connectedNodeIds` — nodes connected to `selectedNodeId` via FK
- `groups` — computed from schema namespaces or FK clusters
- `tableCount` / `visibleTableCount`

### Separation of concerns

- Store: data transformation + interaction state
- `SchemaCanvas.vue`: Vue Flow instance, syncs with store
- `TableNode.vue`: pure presentation, receives props from Vue Flow
- `SchemaToolbar.vue`: dispatches actions to store

---

## 6. Dependencies

### New packages

| Package | Purpose | Size |
|---------|---------|------|
| `@vue-flow/core` | Node-based diagram canvas | ~80KB gzipped |
| `@vue-flow/minimap` | Bird's-eye overview | ~5KB |
| `@vue-flow/controls` | Zoom in/out/fit buttons | ~3KB |
| `dagre` | Auto-layout algorithm | ~30KB |
| `html-to-image` | Export to PNG/SVG | ~10KB |

No new backend dependencies. No new IPC channels. No database schema changes.

### Error states

| Scenario | Handling |
|----------|----------|
| No connections exist | Empty state: "Add a connection to visualize its schema" with button to `/connections` |
| Connection not connected | Connection picker with inline "Connect" button |
| Introspection fails | Error banner with retry, using existing `ErrorMessage` component |
| 0 tables | Empty state: "This database has no tables or views" |
| No foreign keys | Render tables without edges, info banner about no relationships |
| Export fails | Toast notification with error |
| Slow layout (500+) | Loading spinner: "Computing layout..." |

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `/` or `Cmd+F` | Focus search |
| `Escape` | Clear selection / search |
| `Cmd+Plus` | Zoom in |
| `Cmd+Minus` | Zoom out |
| `Cmd+0` | Fit to view |
| `Cmd+Shift+E` | Export PNG |

### Theme support

All colors use existing CSS variables (`--card`, `--border`, `--primary`, `--muted`). Dark mode works automatically. Edge colors: `--muted-foreground` default, `--primary` when highlighted.
