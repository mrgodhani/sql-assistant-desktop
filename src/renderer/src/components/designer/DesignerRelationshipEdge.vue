<script setup lang="ts">
import { computed } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@vue-flow/core'
import { X } from 'lucide-vue-next'
import { useDesignerStore } from '@renderer/stores/useDesignerStore'

const props = defineProps<{
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition?: string
  targetPosition?: string
  data?: { type?: '1:1' | '1:N' | 'N:M'; relId?: string }
  markerEnd?: string
  style?: Record<string, string>
}>()

const store = useDesignerStore()

const pathData = computed(() =>
  getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY
  })
)
const edgePath = computed(() => pathData.value[0])
const labelX = computed(() => pathData.value[1])
const labelY = computed(() => pathData.value[2])

const relId = computed(() => props.data?.relId ?? props.id)
const label = computed(() => props.data?.type ?? '1:N')
const isSelected = computed(() => store.selectedEdgeId === relId.value)

const CARDINALITY_OPTIONS = ['1:1', '1:N', 'N:M'] as const

function handleLabelClick(): void {
  store.selectEdge(isSelected.value ? null : relId.value)
}

function setType(type: '1:1' | '1:N' | 'N:M'): void {
  store.updateRelationshipType(relId.value, type)
  store.selectEdge(null)
}

function deleteEdge(): void {
  store.removeRelationship(relId.value)
}
</script>

<template>
  <BaseEdge
    :id="id"
    :path="edgePath"
    :marker-end="markerEnd"
    :style="{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1.5, ...style }"
  />

  <EdgeLabelRenderer>
    <div
      :style="{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
        pointerEvents: 'all'
      }"
      class="nodrag nopan"
    >
      <!-- Cardinality label -->
      <button
        class="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm hover:bg-muted transition-colors"
        data-testid="edge-label"
        @click.stop="handleLabelClick"
      >
        {{ label }}
      </button>

      <!-- Type picker popover -->
      <div
        v-if="isSelected"
        class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 flex gap-1 rounded-md border border-border bg-background p-1 shadow-md"
        data-testid="cardinality-popover"
      >
        <button
          v-for="opt in CARDINALITY_OPTIONS"
          :key="opt"
          class="rounded px-2 py-0.5 text-[10px] font-semibold transition-colors"
          :class="label === opt ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'"
          @click.stop="setType(opt)"
        >
          {{ opt }}
        </button>
        <button
          class="rounded px-1.5 py-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Delete relationship"
          data-testid="edge-delete"
          @click.stop="deleteEdge"
        >
          <X class="size-3" />
        </button>
      </div>
    </div>
  </EdgeLabelRenderer>
</template>
