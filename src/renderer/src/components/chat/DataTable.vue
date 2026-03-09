<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, CopyCheck } from 'lucide-vue-next'

const props = defineProps<{
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
}>()

const ROW_HEIGHT = 36
const VIRTUAL_THRESHOLD = 100
const COPY_BUTTON_WIDTH = 48

const filterText = ref('')
const sortColumn = ref<string | null>(null)
const sortAsc = ref(true)
const copiedRow = ref<number | null>(null)

const filteredRows = computed(() => {
  const text = filterText.value.trim().toLowerCase()
  if (!text) return props.rows
  return props.rows.filter((row) =>
    props.columns.some((col) => {
      const v = row[col]
      return v != null && String(v).toLowerCase().includes(text)
    })
  )
})

const sortedRows = computed(() => {
  const col = sortColumn.value
  if (!col) return filteredRows.value
  const asc = sortAsc.value
  return [...filteredRows.value].sort((a, b) => {
    const va = a[col]
    const vb = b[col]
    const aNull = va == null
    const bNull = vb == null
    if (aNull && bNull) return 0
    if (aNull) return asc ? 1 : -1
    if (bNull) return asc ? -1 : 1
    const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
    return asc ? cmp : -cmp
  })
})

const useVirtual = computed(() => sortedRows.value.length > VIRTUAL_THRESHOLD)
const scrollRef = ref<HTMLDivElement | null>(null)
const headerTableRef = ref<HTMLTableElement | null>(null)
const columnWidths = ref<number[]>([])

function measureColumns(): void {
  if (!headerTableRef.value) return
  const ths = headerTableRef.value.querySelectorAll('th')
  const widths: number[] = []
  for (let i = 0; i < props.columns.length; i++) {
    widths.push(ths[i]?.getBoundingClientRect().width ?? 80)
  }
  columnWidths.value = widths
}

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  await nextTick()
  measureColumns()
  resizeObserver = new ResizeObserver(measureColumns)
  if (headerTableRef.value) resizeObserver.observe(headerTableRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

watch(
  () => props.columns,
  () => measureColumns(),
  { immediate: true }
)

const virtualRowGridStyle = computed(() => {
  if (columnWidths.value.length === props.columns.length) {
    const cols = columnWidths.value.map((w) => `${w}px`).join(' ')
    return { gridTemplateColumns: `${cols} ${COPY_BUTTON_WIDTH}px` }
  }
  return {
    gridTemplateColumns: `repeat(${props.columns.length}, minmax(80px, 1fr)) ${COPY_BUTTON_WIDTH}px`
  }
})

const virtualizerOptions = computed(() => ({
  count: sortedRows.value.length,
  getScrollElement: () => scrollRef.value,
  estimateSize: () => ROW_HEIGHT,
  overscan: 5
}))

const virtualizer = useVirtualizer(virtualizerOptions)

function formatValue(val: unknown): string {
  if (val == null) return 'NULL'
  return String(val)
}

function displayValue(val: unknown): string {
  if (val == null) return 'NULL'
  return String(val)
}

async function copyCell(rowIndex: number, col: string): Promise<void> {
  const row = sortedRows.value[rowIndex]
  const val = row?.[col]
  const text = val == null ? 'NULL' : String(val)
  try {
    await navigator.clipboard.writeText(text)
    copiedRow.value = rowIndex
    setTimeout(() => (copiedRow.value = null), 1500)
  } catch {
    // ignore
  }
}

async function copyRow(rowIndex: number): Promise<void> {
  const row = sortedRows.value[rowIndex]
  if (!row) return
  const text = props.columns.map((c) => formatValue(row[c])).join('\t')
  try {
    await navigator.clipboard.writeText(text)
    copiedRow.value = rowIndex
    setTimeout(() => (copiedRow.value = null), 1500)
  } catch {
    // ignore
  }
}

function toggleSort(col: string): void {
  if (sortColumn.value === col) sortAsc.value = !sortAsc.value
  else {
    sortColumn.value = col
    sortAsc.value = true
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <Input
      v-model="filterText"
      placeholder="Filter rows..."
      class="max-w-xs text-sm"
      aria-label="Filter table rows"
    />
    <div
      class="rounded border border-border overflow-x-auto"
      role="grid"
      aria-label="Query results"
    >
      <div class="min-w-max">
        <table ref="headerTableRef" class="w-full min-w-max border-collapse text-sm">
          <thead class="bg-muted">
            <tr>
              <th
                v-for="col in columns"
                :key="col"
                :aria-sort="
                  sortColumn === col
                    ? sortAsc
                      ? 'ascending'
                      : 'descending'
                    : undefined
                "
                class="cursor-pointer whitespace-nowrap border-b border-border px-3 py-2 text-left font-medium transition-colors duration-100 hover:bg-muted/80"
                @click="toggleSort(col)"
              >
                {{ col }}
                <span v-if="sortColumn === col" class="ml-1">{{ sortAsc ? '↑' : '↓' }}</span>
              </th>
              <th class="w-12 shrink-0 border-b border-border px-2 py-2"></th>
            </tr>
          </thead>
        </table>
        <div ref="scrollRef" class="max-h-96 overflow-y-auto overflow-x-visible">
          <table v-if="!useVirtual" class="w-full min-w-max border-collapse text-sm">
            <tbody>
              <tr
                v-for="(row, ri) in sortedRows"
                :key="ri"
                class="border-b border-border/50 transition-colors duration-100 hover:bg-muted/30"
              >
                <td
                  v-for="col in columns"
                  :key="col"
                  :class="[
                    'cursor-pointer whitespace-nowrap border-r border-border/30 px-3 py-1.5',
                    (row[col] ?? null) == null && 'italic text-muted-foreground'
                  ]"
                  @click="copyCell(ri, col)"
                >
                  {{ displayValue(row[col]) }}
                </td>
                <td class="px-2 py-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7"
                    :aria-label="copiedRow === ri ? 'Copied' : 'Copy row'"
                    @click="copyRow(ri)"
                  >
                    <CopyCheck v-if="copiedRow === ri" class="size-3.5 text-green-600" />
                    <Copy v-else class="size-3.5" />
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
          <div
            v-else
            :style="{
              height: `${virtualizer.getTotalSize()}px`,
              position: 'relative',
              width: '100%'
            }"
          >
            <div
              v-for="virtualRow in virtualizer.getVirtualItems()"
              :key="String(virtualRow.key)"
              class="absolute left-0 grid w-full border-b border-border/50 bg-background transition-colors duration-100 hover:bg-muted/30"
              :style="{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                ...virtualRowGridStyle
              }"
            >
              <div
                v-for="col in columns"
                :key="col"
                :class="[
                  'min-w-0 cursor-pointer overflow-hidden truncate border-r border-border/30 px-3 py-1.5',
                  (sortedRows[virtualRow.index]?.[col] ?? null) == null &&
                    'italic text-muted-foreground'
                ]"
                @click="copyCell(virtualRow.index, col)"
              >
                {{ displayValue(sortedRows[virtualRow.index]?.[col]) }}
              </div>
              <div class="flex w-12 shrink-0 items-center justify-center px-2">
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-7 w-7"
                  :aria-label="copiedRow === virtualRow.index ? 'Copied' : 'Copy row'"
                  @click="copyRow(virtualRow.index)"
                >
                  <CopyCheck
                    v-if="copiedRow === virtualRow.index"
                    class="size-3.5 text-green-600"
                  />
                  <Copy v-else class="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
