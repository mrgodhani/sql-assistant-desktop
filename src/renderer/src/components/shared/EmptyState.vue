<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  icon?: Component
  title?: string
  message: string
}>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-3 p-6 text-center"
    data-testid="empty-state"
  >
    <component
      :is="icon"
      v-if="icon"
      class="size-12 text-muted-foreground/60"
    />
    <h3 v-if="title" class="font-medium text-foreground">
      {{ title }}
    </h3>
    <p class="text-sm text-muted-foreground">{{ message }}</p>
  </div>
</template>
