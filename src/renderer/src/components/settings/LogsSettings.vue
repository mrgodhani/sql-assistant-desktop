<script setup lang="ts">
import { ref } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    setTimeout(() => { copyFeedback.value = 'idle' }, 2000)
  } catch {
    copyFeedback.value = 'error'
    setTimeout(() => { copyFeedback.value = 'idle' }, 2000)
  }
}
</script>

<template>
  <Card data-testid="logs-settings">
    <CardHeader>
      <CardTitle>Support</CardTitle>
    </CardHeader>
    <CardContent class="space-y-3">
      <p class="text-sm text-muted-foreground">
        Open the log folder or copy recent logs for troubleshooting.
      </p>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" @click="openLogFolder">Open log folder</Button>
        <Button variant="outline" @click="copyRecentLogs">
          Copy recent logs
        </Button>
        <span
          v-if="copyFeedback === 'success'"
          class="self-center text-sm text-green-600 dark:text-green-400"
        >
          Copied!
        </span>
        <span
          v-else-if="copyFeedback === 'error'"
          class="self-center text-sm text-destructive"
        >
          Unable to read logs
        </span>
      </div>
    </CardContent>
  </Card>
</template>
