<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'

const copyFeedback = ref<'idle' | 'success' | 'error'>('idle')

async function openLogFolder(): Promise<void> {
  await window.logsApi.openLogFolder()
}

async function copyRecentLogs(): Promise<void> {
  try {
    const logs = await window.logsApi.getRecentLogs(500)
    if (!logs) {
      copyFeedback.value = 'error'
      return
    }
    await navigator.clipboard.writeText(logs)
    copyFeedback.value = 'success'
    setTimeout(() => {
      copyFeedback.value = 'idle'
    }, 2000)
  } catch {
    copyFeedback.value = 'error'
    setTimeout(() => {
      copyFeedback.value = 'idle'
    }, 2000)
  }
}
</script>

<template>
  <div data-testid="logs-settings">
    <h3 class="text-sm font-medium">Support</h3>
    <p class="mt-1 text-xs text-muted-foreground">
      Open the log folder or copy recent logs for troubleshooting.
    </p>
    <div class="mt-3 flex flex-wrap gap-2">
      <Button variant="outline" size="sm" @click="openLogFolder">Open log folder</Button>
      <Button variant="outline" size="sm" @click="copyRecentLogs">Copy recent logs</Button>
      <span
        v-if="copyFeedback === 'success'"
        class="self-center text-xs text-green-600 dark:text-green-400"
      >
        Copied!
      </span>
      <span v-else-if="copyFeedback === 'error'" class="self-center text-xs text-destructive">
        Unable to read logs
      </span>
    </div>
  </div>
</template>
