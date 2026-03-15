<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RefreshCw, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

const updateVersion = ref<string | null>(null)
const dismissed = ref(false)
let cleanup: (() => void) | undefined

onMounted(() => {
  cleanup = window.updaterApi?.onUpdateDownloaded((version) => {
    updateVersion.value = version
    dismissed.value = false
  })
})

onUnmounted(() => {
  cleanup?.()
})

function restart(): void {
  window.updaterApi?.installUpdate()
}
</script>

<template>
  <div
    v-if="updateVersion && !dismissed"
    class="flex items-center justify-center gap-3 border-b border-border bg-primary px-4 py-1.5 text-primary-foreground"
    data-testid="update-banner"
  >
    <span class="text-sm">
      A new version (v{{ updateVersion }}) is available
    </span>
    <Button
      size="sm"
      variant="secondary"
      class="h-7 gap-1.5 text-xs"
      @click="restart"
    >
      <RefreshCw class="size-3" />
      Restart to Update
    </Button>
    <button
      class="ml-1 rounded-sm opacity-70 hover:opacity-100 focus:outline-none"
      aria-label="Dismiss update notification"
      @click="dismissed = true"
    >
      <X class="size-3.5" />
    </button>
  </div>
</template>
