<script setup lang="ts">
import { ref } from 'vue'
import { Download } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  columns: string[]
  rows: Record<string, unknown>[]
  disabled?: boolean
}>()

const exporting = ref(false)
const errorMessage = ref<string | null>(null)

/** Converts to IPC-safe plain objects (unwraps Vue proxies, handles BigInt/Date/Buffer) */
function sanitizeForIpc(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return JSON.parse(
    JSON.stringify(rows, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  )
}

function defaultFilename(ext: string): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`
  return `export-${ts}.${ext}`
}

async function exportCsv(): Promise<void> {
  if (props.disabled || props.rows.length === 0 || exporting.value) return
  exporting.value = true
  errorMessage.value = null
  try {
    const path = await window.exportApi.showSaveDialog({
      defaultPath: defaultFilename('csv'),
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (path) {
      await window.exportApi.exportCsv(path, props.columns, sanitizeForIpc(props.rows))
    }
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Export failed'
  } finally {
    exporting.value = false
  }
}

async function exportExcel(): Promise<void> {
  if (props.disabled || props.rows.length === 0 || exporting.value) return
  exporting.value = true
  errorMessage.value = null
  try {
    const path = await window.exportApi.showSaveDialog({
      defaultPath: defaultFilename('xlsx'),
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (path) {
      await window.exportApi.exportExcel(path, props.columns, sanitizeForIpc(props.rows))
    }
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Export failed'
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="flex items-center gap-2">
    <Button
      variant="outline"
      size="sm"
      :disabled="disabled || rows.length === 0 || exporting"
      @click="exportCsv"
    >
      <Download class="mr-1.5 size-3.5" />
      {{ exporting ? 'Exporting...' : 'CSV' }}
    </Button>
    <Button
      variant="outline"
      size="sm"
      :disabled="disabled || rows.length === 0 || exporting"
      @click="exportExcel"
    >
      <Download class="mr-1.5 size-3.5" />
      Excel
    </Button>
    <span v-if="errorMessage" class="text-xs text-destructive">{{ errorMessage }}</span>
  </div>
</template>
