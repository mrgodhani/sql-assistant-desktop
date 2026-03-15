<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatStore } from '@renderer/stores/useChatStore'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'close'): void
}>()

const chatStore = useChatStore()
const searchQuery = ref('')
const results = ref<Array<{ table: string; column: string }>>([])
const loading = ref(false)
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

const connectionId = computed(
  () => chatStore.activeConnectionId ?? chatStore.currentConversation?.connectionId ?? null
)

const hasConnection = computed(() => Boolean(connectionId.value))

const flatResults = computed(() => results.value.map((r) => `${r.table}.${r.column}`))

const groupedResults = computed(() => {
  const groups = new Map<string, string[]>()
  for (const r of results.value) {
    const key = r.table
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(`${r.table}.${r.column}`)
  }
  return Array.from(groups.entries())
})

const totalResults = computed(() => results.value.length)

const performSearch = useDebounceFn(async () => {
  const connId = connectionId.value
  const query = searchQuery.value.trim()
  if (!connId) {
    results.value = []
    return
  }
  loading.value = true
  try {
    results.value = await window.schemaApi.search(connId, query)
  } catch {
    results.value = []
  } finally {
    loading.value = false
    selectedIndex.value = 0
  }
}, 300)

watch(searchQuery, () => {
  if (!hasConnection.value) return
  performSearch()
})

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      searchQuery.value = ''
      results.value = []
      selectedIndex.value = 0
      setTimeout(() => inputRef.value?.focus(), 0)
    }
  }
)

function close(): void {
  emit('update:open', false)
  emit('close')
}

function select(item: string): void {
  chatStore.inputContentForEdit = item
  close()
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    if (totalResults.value > 0) {
      select(flatResults.value[selectedIndex.value] ?? '')
    }
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, totalResults.value - 1)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
    return
  }
}

function getFlatIndex(groupIdx: number, itemIdx: number): number {
  let idx = 0
  for (let g = 0; g < groupedResults.value.length; g++) {
    const items = groupedResults.value[g][1]
    if (g < groupIdx) {
      idx += items.length
    } else {
      idx += itemIdx
      break
    }
  }
  return idx
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[9999] flex items-start justify-center bg-black/50 pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Schema search"
      @keydown="onKeydown"
      @click.self="close"
    >
      <div class="w-full max-w-xl rounded-lg border border-border bg-card shadow-lg" @click.stop>
        <div class="border-b border-border p-2">
          <Input
            ref="inputRef"
            v-model="searchQuery"
            placeholder="Search tables and columns..."
            class="h-10 border-0 bg-transparent shadow-none focus-visible:ring-0"
            :disabled="!hasConnection"
          />
        </div>
        <div class="max-h-[min(60vh,400px)] overflow-hidden">
          <div v-if="!hasConnection" class="px-4 py-8 text-center text-sm text-muted-foreground">
            Connect to a database first
          </div>
          <div v-else-if="loading" class="px-4 py-8 text-center text-sm text-muted-foreground">
            Searching...
          </div>
          <div
            v-else-if="searchQuery.trim() && totalResults === 0"
            class="px-4 py-8 text-center text-sm text-muted-foreground"
          >
            No results
          </div>
          <ScrollArea v-else class="h-full">
            <div class="p-2">
              <div v-for="(group, groupIdx) in groupedResults" :key="group[0]" class="mb-2">
                <div
                  class="mb-1 px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {{ group[0] }}
                </div>
                <div class="flex flex-col gap-0.5">
                  <button
                    v-for="(item, itemIdx) in group[1]"
                    :key="item"
                    type="button"
                    class="flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    :class="{
                      'bg-accent text-accent-foreground':
                        getFlatIndex(groupIdx, itemIdx) === selectedIndex
                    }"
                    @click="select(item)"
                  >
                    {{ item }}
                  </button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  </Teleport>
</template>
