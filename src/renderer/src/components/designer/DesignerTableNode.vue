<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Table2, KeyRound, Minus, Trash2, Plus } from 'lucide-vue-next'
import type { DesignerTable } from '../../../../../shared/types'
import { useDesignerStore } from '@renderer/stores/useDesignerStore'
import ColumnEditorDialog from './ColumnEditorDialog.vue'

const props = defineProps<{
  id: string
  data: { table: DesignerTable }
}>()

const store = useDesignerStore()

const isEditingName = ref(false)
const editingName = ref('')
const nameInput = ref<HTMLInputElement | null>(null)

const columnEditorOpen = ref(false)
const editingColumnId = ref<string | undefined>(undefined)

const selectedColumnId = computed(() => editingColumnId.value)

function startEditName(): void {
  editingName.value = props.data.table.name
  isEditingName.value = true
  nextTick(() => nameInput.value?.select())
}

function commitName(): void {
  const name = editingName.value.trim()
  if (name && name !== props.data.table.name) {
    store.updateTableName(props.id, name)
  }
  isEditingName.value = false
}

function onNameKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter') commitName()
  if (e.key === 'Escape') isEditingName.value = false
}

function handleDeleteTable(): void {
  if (window.confirm(`Delete table "${props.data.table.name}"?`)) {
    store.removeTable(props.id)
  }
}

function openAddColumn(): void {
  editingColumnId.value = undefined
  columnEditorOpen.value = true
}

function openEditColumn(colId: string): void {
  editingColumnId.value = colId
  columnEditorOpen.value = true
}
</script>

<template>
  <div
    class="w-[260px] rounded-lg border bg-card shadow-sm"
    :class="store.selectedNodeId === id ? 'ring-2 ring-primary border-primary' : 'border-border'"
    @click.stop="store.selectNode(id)"
  >
    <!-- Source handle (table level) -->
    <Handle
      id="source"
      type="source"
      :position="Position.Right"
      class="absolute! right-0! w-2.5! h-2.5! bg-primary! border-2! border-background! translate-x-1/2!"
    />
    <!-- Target handle (table level) -->
    <Handle
      id="target"
      type="target"
      :position="Position.Left"
      class="absolute! left-0! w-2.5! h-2.5! bg-primary! border-2! border-background! -translate-x-1/2!"
    />

    <!-- Header -->
    <div
      class="group flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-t-lg border-b border-border"
    >
      <Table2 class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

      <input
        v-if="isEditingName"
        ref="nameInput"
        v-model="editingName"
        class="flex-1 min-w-0 bg-transparent text-sm font-semibold focus:outline-none"
        @blur="commitName"
        @keydown="onNameKeydown"
      />
      <span
        v-else
        class="flex-1 truncate text-sm font-semibold cursor-pointer"
        @dblclick.stop="startEditName"
      >
        {{ data.table.name }}
      </span>

      <button
        class="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
        title="Delete table"
        @click.stop="handleDeleteTable"
      >
        <Trash2 class="size-3.5" />
      </button>
    </div>

    <!-- Columns -->
    <div class="py-1">
      <div
        v-for="column in data.table.columns"
        :key="column.id"
        class="group/col relative flex items-center gap-2 px-3 py-1 text-xs font-mono hover:bg-muted/30 cursor-pointer"
        @dblclick.stop="openEditColumn(column.id)"
      >
        <KeyRound v-if="column.isPrimaryKey" class="h-3 w-3 shrink-0 text-amber-500" />
        <Minus v-else class="h-3 w-3 shrink-0 text-muted-foreground/50" />

        <span class="flex-1 truncate">{{ column.name }}</span>
        <span class="shrink-0 text-muted-foreground">
          {{ column.type }}{{ column.nullable ? '?' : '' }}
        </span>

        <button
          class="opacity-0 group-hover/col:opacity-100 ml-1 text-muted-foreground hover:text-destructive transition-opacity"
          title="Remove column"
          @click.stop="store.removeColumn(id, column.id)"
        >
          <Trash2 class="size-3" />
        </button>
      </div>
    </div>

    <!-- Footer -->
    <div class="border-t border-border">
      <button
        class="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary hover:bg-muted/30 transition-colors"
        @click.stop="openAddColumn"
      >
        <Plus class="size-3" />
        Add column
      </button>
    </div>

    <Teleport to="body">
      <ColumnEditorDialog
        v-if="columnEditorOpen"
        :open="columnEditorOpen"
        :table-id="id"
        :column="selectedColumnId ? data.table.columns.find((c) => c.id === selectedColumnId) : undefined"
        @update:open="columnEditorOpen = $event"
      />
    </Teleport>
  </div>
</template>
