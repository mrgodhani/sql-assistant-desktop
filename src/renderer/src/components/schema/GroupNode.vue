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

const isBackgroundBox = computed(
  () => props.data.width !== undefined && props.data.height !== undefined
)

const boxStyle = computed(() => {
  if (!isBackgroundBox.value) return {}
  return {
    width: `${props.data.width}px`,
    height: `${props.data.height}px`,
    background: `hsla(${hue.value}, 60%, 50%, 0.04)`,
    borderColor: `hsla(${hue.value}, 60%, 50%, 0.25)`
  }
})
</script>

<template>
  <div
    class="border-2 border-dashed rounded-xl px-6 py-4 min-w-[180px]"
    :style="boxStyle"
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
