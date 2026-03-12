<script setup lang="ts">
import { computed, ref } from 'vue'
import DataTable from './DataTable.vue'
import ChartPanel from './ChartPanel.vue'
import ExportButton from './ExportButton.vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useResultsStore } from '@renderer/stores/useResultsStore'

const props = defineProps<{
  messageIndex: number
  blockIndex: number
  connectionId: string | null
}>()

const resultsStore = useResultsStore()
const chartPanelRef = ref<InstanceType<typeof ChartPanel> | null>(null)

const result = computed(() => resultsStore.getResult(props.messageIndex, props.blockIndex))

function isNumeric(val: unknown): boolean {
  if (val === null || val === undefined) return false
  const n = Number(val)
  return !Number.isNaN(n) && Number.isFinite(n)
}

const canIncludeChart = computed(() => {
  const r = result.value?.success && result.value?.result
  if (!r || r.rows.length === 0) return false
  const sample = r.rows.slice(0, 100)
  return r.columns.some((col: string) =>
    sample.some((row: Record<string, unknown>) => isNumeric(row[col]))
  )
})

function formatTime(ms: number): string {
  if (ms < 1) return '<1ms'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}
</script>

<template>
  <div
    class="mt-2 min-w-0 rounded-lg border border-border/60 bg-muted/10 p-2.5"
    aria-live="polite"
    aria-atomic="true"
  >
    <template v-if="result?.success && result.result">
      <div
        class="mb-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"
      >
        <div class="flex flex-wrap items-center gap-3">
          <span>{{ result.result.rowCount }} row{{ result.result.rowCount === 1 ? '' : 's' }}</span>
          <span>{{ formatTime(result.result.executionTimeMs) }}</span>
          <span v-if="result.result.truncated" class="text-amber-600 dark:text-amber-500">
            Showing first 100,000 rows
          </span>
        </div>
        <ExportButton
          :columns="result.result.columns"
          :rows="result.result.rows"
          :chart-panel-ref="chartPanelRef"
          :can-include-chart="canIncludeChart"
        />
      </div>
      <Tabs default-value="table" class="results-tabs w-full min-w-0">
        <TabsList class="mb-2">
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="chart">Chart</TabsTrigger>
        </TabsList>
        <TabsContent value="table">
          <DataTable
            :columns="result.result.columns"
            :rows="result.result.rows"
            :row-count="result.result.rowCount"
          />
        </TabsContent>
        <TabsContent value="chart" :force-mount="true">
          <ChartPanel
            ref="chartPanelRef"
            :columns="result.result.columns"
            :rows="result.result.rows"
            :row-count="result.result.rowCount"
          />
        </TabsContent>
      </Tabs>
    </template>
    <template v-else-if="result && !result.success">
      <p
        :class="[
          'text-sm',
          result.error === 'Running query...' ? 'text-muted-foreground' : 'text-destructive'
        ]"
      >
        {{ result.error }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.results-tabs [data-state='inactive'] {
  display: none;
}
</style>
