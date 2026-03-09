<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

defineProps<{
  title?: string
  message: string
  retry?: () => void
}>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-3 p-6 text-center"
    data-testid="error-message"
  >
    <AlertCircle class="size-10 text-destructive" />
    <h3 v-if="title" class="text-sm font-medium text-foreground">
      {{ title }}
    </h3>
    <p class="text-sm text-muted-foreground">{{ message }}</p>
    <Button
      v-if="retry"
      variant="outline"
      size="sm"
      data-testid="error-retry-button"
      @click="retry"
    >
      Try Again
    </Button>
  </div>
</template>
