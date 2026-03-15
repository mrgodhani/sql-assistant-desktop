<script setup lang="ts">
import { Layers, ChevronDown, ChevronRight } from 'lucide-vue-next'
import { useSchemaVisualizationStore } from '@renderer/stores/useSchemaVisualizationStore'

const props = defineProps<{
  id: string
  data: {
    label: string
    tableCount: number
    isExpanded: boolean
  }
}>()

const store = useSchemaVisualizationStore()

function toggle(): void {
  store.toggleGroup(props.id)
}
</script>

<template>
  <div
    class="border-2 border-dashed border-muted-foreground/30 rounded-xl bg-muted/20 px-6 py-4 min-w-[180px]"
  >
    <div class="flex items-center gap-3">
      <Layers class="h-4 w-4 shrink-0 text-muted-foreground" />
      <div class="flex-1 min-w-0">
        <div class="text-sm font-bold truncate">{{ data.label }}</div>
        <div class="text-xs text-muted-foreground">{{ data.tableCount }} tables</div>
      </div>
      <button
        class="shrink-0 rounded p-1 hover:bg-muted cursor-pointer transition-colors"
        @click.stop="toggle"
      >
        <component
          :is="data.isExpanded ? ChevronDown : ChevronRight"
          class="h-4 w-4 text-muted-foreground"
        />
      </button>
    </div>
  </div>
</template>
