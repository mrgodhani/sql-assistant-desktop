<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import { AlertCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import log from 'electron-log/renderer'

const hasError = ref(false)
const error = ref<Error | null>(null)

onErrorCaptured((err) => {
  log.error('[ErrorBoundary]', err)
  error.value = err
  hasError.value = true
  return false
})

function reset(): void {
  hasError.value = false
  error.value = null
}
</script>

<template>
  <div v-if="hasError" class="flex flex-col items-center justify-center gap-3 p-8 text-center">
    <AlertCircle class="size-12 text-destructive" />
    <h2 class="text-lg font-medium">Something went wrong</h2>
    <p class="text-sm text-muted-foreground">
      {{ error?.message ?? 'An unexpected error occurred.' }}
    </p>
    <Button variant="outline" @click="reset">Try again</Button>
  </div>
  <slot v-else />
</template>
