<script setup lang="ts">
import { computed, inject } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Table2, Eye, KeyRound, Link2, Minus } from 'lucide-vue-next'
import type { TableNodeData } from '@renderer/stores/useSchemaVisualizationStore'
import { useSchemaVisualizationStore } from '@renderer/stores/useSchemaVisualizationStore'
import type { ColumnInfo } from '../../../../shared/types'

const props = defineProps<{
  id: string
  data: TableNodeData
}>()

const store = useSchemaVisualizationStore()
const injectedToggle = inject<((nodeId: string) => void) | null>('toggleColumns', null)

const COLLAPSED_MAX_OTHER = 3

const fkColumnNames = computed(() => {
  return new Set(props.data.table.foreignKeys.flatMap((fk) => fk.columns))
})

const pkColumns = computed(() => {
  return props.data.table.columns.filter((c) => c.isPrimaryKey)
})

const fkColumns = computed(() => {
  return props.data.table.columns.filter((c) => fkColumnNames.value.has(c.name) && !c.isPrimaryKey)
})

const otherColumns = computed(() => {
  return props.data.table.columns.filter((c) => !c.isPrimaryKey && !fkColumnNames.value.has(c.name))
})

const needsCollapsing = computed(() => {
  return props.data.table.columns.length > 8
})

const visibleColumns = computed((): ColumnInfo[] => {
  if (!needsCollapsing.value || props.data.isExpanded) {
    return props.data.table.columns
  }

  const pk = pkColumns.value
  const fk = fkColumns.value
  const other = otherColumns.value.slice(0, COLLAPSED_MAX_OTHER)
  return [...pk, ...fk, ...other]
})

const isFK = computed(() => {
  return (columnName: string) => fkColumnNames.value.has(columnName)
})

function columnIcon(column: ColumnInfo): 'pk' | 'fk' | 'regular' {
  if (column.isPrimaryKey) return 'pk'
  if (fkColumnNames.value.has(column.name)) return 'fk'
  return 'regular'
}

function formatType(column: ColumnInfo): string {
  return column.nullable ? `${column.type}?` : column.type
}
</script>

<template>
  <div
    :class="[
      'w-[280px] rounded-lg border bg-card shadow-sm transition-all',
      data.isSelected && 'ring-2 ring-primary border-primary',
      data.isConnected && !data.isSelected && 'ring-1 ring-primary/50',
      data.isDimmed && 'opacity-20 pointer-events-none',
      !data.isSelected && !data.isConnected && 'border-border'
    ]"
  >
    <!-- Header -->
    <div class="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-t-lg border-b border-border">
      <component
        :is="data.table.type === 'view' ? Eye : Table2"
        class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
      />
      <span class="flex-1 truncate text-sm font-semibold">
        {{ data.table.name }}
      </span>
      <span
        class="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
      >
        {{ data.table.type }}
      </span>
    </div>

    <!-- Columns -->
    <div class="py-1">
      <div
        v-for="column in visibleColumns"
        :key="column.name"
        class="relative flex items-center gap-2 px-3 py-1 text-xs font-mono"
      >
        <!-- Target handle on PK columns -->
        <Handle
          v-if="column.isPrimaryKey"
          :id="`target-${column.name}`"
          type="target"
          :position="Position.Left"
          class="absolute! left-0! w-2! h-2! bg-primary! border-2! border-background! -translate-x-1/2!"
        />

        <!-- Column icon -->
        <KeyRound v-if="columnIcon(column) === 'pk'" class="h-3 w-3 shrink-0 text-amber-500" />
        <Link2 v-else-if="columnIcon(column) === 'fk'" class="h-3 w-3 shrink-0 text-blue-500" />
        <Minus v-else class="h-3 w-3 shrink-0 text-muted-foreground/50" />

        <!-- Column name -->
        <span class="flex-1 truncate">{{ column.name }}</span>

        <!-- Column type -->
        <span class="shrink-0 text-muted-foreground">{{ formatType(column) }}</span>

        <!-- Source handle on FK columns -->
        <Handle
          v-if="isFK(column.name)"
          :id="`source-${column.name}`"
          type="source"
          :position="Position.Right"
          class="absolute! right-0! w-2! h-2! bg-primary! border-2! border-background! translate-x-1/2!"
        />
      </div>
    </div>

    <!-- Expand/Collapse button -->
    <div v-if="needsCollapsing" class="border-t border-border">
      <button
        class="w-full px-3 py-1.5 text-xs text-primary cursor-pointer hover:underline text-left"
        @click.stop="injectedToggle ? injectedToggle(id) : store.toggleColumns(id)"
      >
        {{ data.isExpanded ? 'Collapse' : `Show all ${data.table.columns.length} columns` }}
      </button>
    </div>
  </div>
</template>
