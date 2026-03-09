<script setup lang="ts">
import { computed } from 'vue'
import { User, Bot } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    role: 'user' | 'assistant'
    timestamp?: string
  }>(),
  { timestamp: undefined }
)

const label = computed(() => (props.role === 'user' ? 'You' : 'Assistant'))
const avatarClasses = computed(() =>
  props.role === 'user'
    ? 'flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground'
    : 'flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground'
)
</script>

<template>
  <div class="flex items-center gap-2">
    <div :class="avatarClasses" aria-hidden="true">
      <User v-if="role === 'user'" class="size-4" />
      <Bot v-else class="size-4" />
    </div>
    <span class="text-sm font-medium">{{ label }}</span>
    <span v-if="timestamp" class="text-xs text-muted-foreground">{{ timestamp }}</span>
  </div>
</template>
