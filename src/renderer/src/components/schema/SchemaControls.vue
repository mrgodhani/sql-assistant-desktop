<script setup lang="ts">
import { MiniMap } from '@vue-flow/minimap'
import { Controls } from '@vue-flow/controls'

import '@vue-flow/minimap/dist/style.css'
import '@vue-flow/controls/dist/style.css'
</script>

<template>
  <MiniMap class="bg-muted/50! border-border!" />
  <Controls class="bg-background! border-border! shadow-sm!" />
</template>
