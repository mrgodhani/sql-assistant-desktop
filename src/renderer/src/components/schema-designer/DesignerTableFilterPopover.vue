<script setup lang="ts">
import { computed, ref } from 'vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Filter, Search } from 'lucide-vue-next'
import { useSchemaDesignerStore } from '@renderer/stores/useSchemaDesignerStore'
import type { TableDesign } from '../../../../shared/types'

const store = useSchemaDesignerStore()
const searchQuery = ref('')

function buildNodeId(t: TableDesign): string {
  return t.schema ? `${t.schema}.${t.name}` : t.name
}

const allTableIds = computed(
  () => store.schema?.tables.map(buildNodeId) ?? []
)

const selectedSet = computed(() => {
  const ids = allTableIds.value
  if (store.filteredTables === null) return new Set(ids.map((id) => id.toLowerCase()))
  if (store.filteredTables.length === 0) return new Set<string>()
  return new Set(store.filteredTables.map((id) => id.toLowerCase()))
})

const lowerToOriginal = computed(() =>
  new Map(allTableIds.value.map((id) => [id.toLowerCase(), id]))
)

const filteredTableIds = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return allTableIds.value
  return allTableIds.value.filter((id) => id.toLowerCase().includes(q))
})

function isChecked(tableId: string): boolean {
  return selectedSet.value.has(tableId.toLowerCase()) || selectedSet.value.has(tableId)
}

function toggle(tableId: string, checked: boolean): void {
  const lower = tableId.toLowerCase()
  let newSet: Set<string>
  if (store.filteredTables === null) {
    newSet = new Set(allTableIds.value.map((id) => id.toLowerCase()))
  } else {
    newSet = new Set(store.filteredTables.map((id) => id.toLowerCase()))
  }
  if (checked) {
    newSet.add(lower)
  } else {
    newSet.delete(lower)
  }
  if (newSet.size === 0) {
    store.setFilter([])
    return
  }
  if (newSet.size === allTableIds.value.length) {
    store.setFilter(null)
    return
  }
  const ids = Array.from(newSet).map((l) => lowerToOriginal.value.get(l) ?? l)
  store.setFilter(ids)
}

function selectAll(): void {
  store.setFilter(null)
}

function deselectAll(): void {
  store.setFilter([])
}

function connectedToSelected(): void {
  const nodeId = store.selectedNodeId?.value ?? null
  if (!nodeId) return
  const ids = store.getConnectedTableIds(nodeId)
  store.setFilter(ids.length === allTableIds.value.length ? null : ids)
}
</script>

<template>
  <Popover v-if="store.hasSchema">
    <PopoverTrigger as-child>
      <slot name="trigger">
        <Button variant="outline" size="sm">
          <Filter class="size-3.5 mr-1" />
          Filter tables
        </Button>
      </slot>
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
            v-for="tableId in filteredTableIds"
            :key="tableId"
            class="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-accent text-sm"
          >
            <Checkbox
              :checked="isChecked(tableId)"
              @update:checked="(v) => toggle(tableId, v === true)"
            />
            <span class="truncate">{{ tableId }}</span>
          </label>
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
            :disabled="!store.selectedNodeId"
            @click="connectedToSelected"
          >
            Connected to selected
          </Button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
