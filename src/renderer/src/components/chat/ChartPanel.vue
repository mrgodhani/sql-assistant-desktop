<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { Chart, registerables } from 'chart.js'
import type { ChartType } from '../../../../shared/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

Chart.register(...registerables)

const props = defineProps<{
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
}>()

const chartType = ref<ChartType>('bar')
const xAxisColumn = ref<string>('')
const yAxisColumn = ref<string>('')
const chartRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const CHART_POINT_LIMIT = 1000

function isNumeric(val: unknown): boolean {
  if (val === null || val === undefined) return false
  const n = Number(val)
  return !Number.isNaN(n) && Number.isFinite(n)
}

function getNumericColumns(): string[] {
  if (props.rows.length === 0) return props.columns
  return props.columns.filter((col) => {
    const sample = props.rows.slice(0, 100).map((r) => r[col])
    return sample.some((v) => isNumeric(v))
  })
}

function sampleValues(values: unknown[]): unknown[] {
  if (values.length <= CHART_POINT_LIMIT) return values
  const step = Math.ceil(values.length / CHART_POINT_LIMIT)
  return values.filter((_, i) => i % step === 0)
}

function buildChartData(): { labels: string[]; datasets: { label: string; data: number[] }[] } | null {
  const numericCols = getNumericColumns()
  if (numericCols.length === 0) return null

  const yCol = yAxisColumn.value && numericCols.includes(yAxisColumn.value)
    ? yAxisColumn.value
    : numericCols[0]
  const xCol =
    xAxisColumn.value && props.columns.includes(xAxisColumn.value)
      ? xAxisColumn.value
      : props.columns[0] ?? ''

  if (chartType.value === 'pie') {
    const labels = sampleValues(props.rows.map((r) => String(r[xCol] ?? ''))).map(String)
    const data = sampleValues(
      props.rows.map((r) => (isNumeric(r[yCol]) ? Number(r[yCol]) : 0))
    ).map((v) => Number(v))
    return { labels, datasets: [{ label: yCol, data }] }
  }

  const labels = sampleValues(props.rows.map((r) => String(r[xCol] ?? ''))).map(String)
  const data = sampleValues(
    props.rows.map((r) => (isNumeric(r[yCol]) ? Number(r[yCol]) : 0))
  ).map((v) => Number(v))
  return { labels, datasets: [{ label: yCol, data }] }
}

function renderChart(): void {
  if (!chartRef.value) return

  const chartData = buildChartData()
  if (!chartData) return

  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  const type = chartType.value === 'area' ? 'line' : chartType.value
  const datasets = chartData.datasets.map((ds) => ({
    ...ds,
    fill: chartType.value === 'area'
  }))
  const options: Record<string, unknown> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: chartType.value !== 'pie' } }
  }
  if (type !== 'pie') {
    options.scales = { x: { display: true }, y: { beginAtZero: true } }
  }
  chartInstance = new Chart(chartRef.value, {
    type,
    data: { ...chartData, datasets },
    options
  })
}

onMounted(() => {
  if (props.columns.length > 0 && !xAxisColumn.value) xAxisColumn.value = props.columns[0] ?? ''
  const numeric = getNumericColumns()
  if (numeric.length > 0 && !yAxisColumn.value) yAxisColumn.value = numeric[0] ?? ''
  renderChart()
})

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
})

watch(
  () => [props.rows, props.columns, chartType.value, xAxisColumn.value, yAxisColumn.value],
  () => renderChart(),
  { deep: true }
)

function getChartImage(): string | null {
  if (!chartRef.value) return null
  return chartRef.value.toDataURL('image/png')
}

defineExpose({ getChartImage })
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-4">
      <div class="space-y-1.5">
        <Label class="text-xs">Chart type</Label>
        <Select v-model="chartType">
          <SelectTrigger class="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bar">Bar</SelectItem>
            <SelectItem value="line">Line</SelectItem>
            <SelectItem value="area">Area</SelectItem>
            <SelectItem value="pie">Pie</SelectItem>
            <SelectItem value="scatter">Scatter</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div v-if="chartType !== 'pie'" class="space-y-1.5">
        <Label class="text-xs">X axis</Label>
        <Select v-model="xAxisColumn">
          <SelectTrigger class="w-[140px]">
            <SelectValue placeholder="Select column" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="col in columns" :key="col" :value="col">
              {{ col }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="space-y-1.5">
        <Label class="text-xs">Y axis</Label>
        <Select v-model="yAxisColumn">
          <SelectTrigger class="w-[140px]">
            <SelectValue placeholder="Select column" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="col in getNumericColumns()"
              :key="col"
              :value="col"
            >
              {{ col }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
    <div v-if="getNumericColumns().length === 0" class="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
      No numeric columns to visualize
    </div>
    <div v-else class="h-[280px] rounded-md border border-border bg-muted/5 p-2">
      <canvas ref="chartRef" />
    </div>
  </div>
</template>
