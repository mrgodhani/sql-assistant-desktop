<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import mermaid from 'mermaid'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const props = defineProps<{
  connectionId: string | null
  sql: string
  open: boolean
}>()

const loading = ref(false)
const error = ref<string | null>(null)
const raw = ref('')
const mermaidSvg = ref<string | null>(null)

async function fetchExplain(): Promise<void> {
  if (!props.connectionId || !props.sql.trim()) return
  loading.value = true
  error.value = null
  raw.value = ''
  mermaidSvg.value = null
  try {
    const result = await window.explainApi.run(props.connectionId, props.sql)
    raw.value = result.raw
    if (result.mermaid && result.mermaid !== 'flowchart TB') {
      try {
        const id = `explain-${Date.now()}-${Math.random().toString(36).slice(2)}`
        mermaid.initialize({ startOnLoad: false })
        const { svg } = await mermaid.render(id, result.mermaid)
        mermaidSvg.value = svg
      } catch {
        // Mermaid render failed; raw tab still available
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to run EXPLAIN'
    error.value = /connection|not active|reconnect|ECONNREFUSED|ETIMEDOUT/i.test(msg)
      ? 'Connection lost. Please reconnect.'
      : msg
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.connectionId, props.sql] as const,
  ([open]) => {
    if (open && props.connectionId && props.sql.trim()) {
      fetchExplain()
    }
  }
)

onMounted(() => {
  if (props.open && props.connectionId && props.sql.trim()) {
    fetchExplain()
  }
})
</script>

<template>
  <div class="mt-2 rounded-md border border-border bg-muted/20 p-3">
    <div v-if="loading" class="py-4 text-center text-sm text-muted-foreground">
      Running EXPLAIN...
    </div>
    <div v-else-if="error" class="py-4 text-center text-sm text-destructive">
      {{ error }}
    </div>
    <Tabs v-else default-value="tree" class="w-full">
      <TabsList class="mb-2">
        <TabsTrigger value="tree">Tree</TabsTrigger>
        <TabsTrigger value="raw">Raw</TabsTrigger>
      </TabsList>
      <TabsContent value="tree" class="mt-0">
        <div
          v-if="mermaidSvg"
          class="overflow-auto rounded-md bg-white p-4 dark:bg-muted/30"
          v-html="mermaidSvg"
        />
        <div v-else-if="raw" class="text-sm text-muted-foreground">
          No diagram available (raw format only)
        </div>
      </TabsContent>
      <TabsContent value="raw" class="mt-0">
        <pre v-if="raw" class="max-h-64 overflow-auto rounded-md bg-muted/40 p-3 text-xs">{{
          raw
        }}</pre>
      </TabsContent>
    </Tabs>
  </div>
</template>
