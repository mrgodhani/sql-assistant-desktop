<script setup lang="ts">
import { watch } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import { Controls } from '@vue-flow/controls'
import { useSchemaVisualizationStore } from '@renderer/stores/useSchemaVisualizationStore'

import '@vue-flow/minimap/dist/style.css'
import '@vue-flow/controls/dist/style.css'

const store = useSchemaVisualizationStore()
const { fitView } = useVueFlow()

watch(
  () => store.nodes.length,
  (len) => {
    if (len > 0) {
      setTimeout(() => fitView({ padding: 0.2 }), 50)
    }
  }
)

defineExpose({ fitView })
</script>

<template>
  <MiniMap class="bg-muted/50! border-border!" />
  <Controls class="bg-background! border-border! shadow-sm!" />
</template>
