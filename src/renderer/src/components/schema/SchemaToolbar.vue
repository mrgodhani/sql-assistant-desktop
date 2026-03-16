<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { Search, X, RotateCcw, Download, Filter } from 'lucide-vue-next'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import TableFilterPopover from '@renderer/components/shared/TableFilterPopover.vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import {
  useSchemaVisualizationStore,
  type SchemaFilter,
  type LayoutDirection
} from '@renderer/stores/useSchemaVisualizationStore'

const store = useSchemaVisualizationStore()

const localSearch = ref(store.searchQuery)

const debouncedSetSearch = useDebounceFn((query: string) => {
  store.setSearch(query)
}, 200)

watch(localSearch, (val) => {
  debouncedSetSearch(val)
})

watch(
  () => store.searchQuery,
  (val) => {
    if (val !== localSearch.value) {
      localSearch.value = val
    }
  }
)

function clearSearch(): void {
  localSearch.value = ''
  store.setSearch('')
}

function onSearchKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    clearSearch()
    ;(e.target as HTMLInputElement).blur()
  }
}

function onFilterChange(value: string | number | bigint | Record<string, unknown> | null): void {
  if (typeof value === 'string') {
    store.setFilter(value as SchemaFilter)
  }
}

function onLayoutChange(value: string | number | bigint | Record<string, unknown> | null): void {
  if (typeof value === 'string') {
    store.applyLayout(value as LayoutDirection)
  }
}

function onIndividualFilterChange(value: string[] | null): void {
  store.setIndividualFilter(value)
}
</script>

<template>
  <div class="flex items-center gap-3 px-4 py-2 border-b border-border bg-background">
    <!-- Search -->
    <div class="relative w-56">
      <Search
        class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
      />
      <Input
        v-model="localSearch"
        placeholder="Search tables..."
        class="pl-8 pr-8 h-8 text-sm"
        data-testid="schema-search-input"
        @keydown="onSearchKeydown"
      />
      <button
        v-if="localSearch"
        class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
        @click="clearSearch"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </div>

    <!-- Filter -->
    <Select :model-value="store.filter" @update:model-value="onFilterChange">
      <SelectTrigger class="w-[170px]" size="sm">
        <SelectValue placeholder="Filter..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        <SelectItem value="tables">Tables only</SelectItem>
        <SelectItem value="views">Views only</SelectItem>
        <SelectItem value="connected" :disabled="!store.selectedNodeId">
          Connected to selected
        </SelectItem>
        <SelectItem value="with-relationships">With relationships</SelectItem>
      </SelectContent>
    </Select>

    <!-- Layout direction -->
    <Select :model-value="store.layoutDirection" @update:model-value="onLayoutChange">
      <SelectTrigger class="w-[160px]" size="sm">
        <SelectValue placeholder="Layout..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="TB">Top to Bottom</SelectItem>
        <SelectItem value="LR">Left to Right</SelectItem>
        <SelectItem value="clustered">Clustered (auto-group)</SelectItem>
      </SelectContent>
    </Select>

    <!-- Individual table filter -->
    <TableFilterPopover
      :tables="store.nodes.filter(n => n.type === 'table').map(n => n.id)"
      :model-value="store.individualFilter"
      :selected-node-id="store.selectedNodeId"
      :get-connected-ids="(id: string) => Array.from(store.getConnectedNodeIdSet(id))"
      @update:model-value="onIndividualFilterChange"
    />

    <!-- Active filter badge -->
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

    <!-- Re-layout -->
    <Button variant="outline" size="sm" @click="store.applyLayout()">
      <RotateCcw class="h-3.5 w-3.5" />
      Re-layout
    </Button>

    <!-- Export -->
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="outline" size="sm">
          <Download class="h-3.5 w-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem @click="() => store.exportImage('png')"> Export PNG </DropdownMenuItem>
        <DropdownMenuItem @click="() => store.exportImage('svg')"> Export SVG </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <!-- Table count -->
    <span class="text-xs text-muted-foreground ml-auto">
      {{ store.visibleTableCount }} / {{ store.tableCount }} tables
    </span>
  </div>
</template>
