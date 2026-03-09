<script setup lang="ts">
import { ref, toRaw } from 'vue'
import { Download } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  columns: string[]
  rows: Record<string, unknown>[]
  disabled?: boolean
}>()

const exporting = ref(false)
const errorMessage = ref<string | null>(null)

/** Serializes rows to JSON string for IPC (handles BigInt, avoids structured clone issues) */
function toExportPayload(rows: Record<string, unknown>[]): string {
  return JSON.stringify(rows, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
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
    const dialogOptions = JSON.stringify({
      defaultPath: defaultFilename('csv'),
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    const path = await window.exportApi.showSaveDialog(dialogOptions)
    if (path) {
      let payload: string
      try {
        const rawRows = toRaw(props.rows) ?? props.rows
        const rawColumns = toRaw(props.columns) ?? props.columns
        payload = JSON.stringify({
          path,
          columns: Array.isArray(rawColumns) ? [...rawColumns] : rawColumns,
          jsonRows: toExportPayload(rawRows)
        })
      } catch {
        errorMessage.value = 'Export data could not be serialized'
        return
      }
      await window.exportApi.exportCsv(payload)
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
    const dialogOptions = JSON.stringify({
      defaultPath: defaultFilename('xlsx'),
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    const path = await window.exportApi.showSaveDialog(dialogOptions)
    if (path) {
      let payload: string
      try {
        const rawRows = toRaw(props.rows) ?? props.rows
        const rawColumns = toRaw(props.columns) ?? props.columns
        payload = JSON.stringify({
          path,
          columns: Array.isArray(rawColumns) ? [...rawColumns] : rawColumns,
          jsonRows: toExportPayload(rawRows)
        })
      } catch {
        errorMessage.value = 'Export data could not be serialized'
        return
      }
      await window.exportApi.exportExcel(payload)
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
