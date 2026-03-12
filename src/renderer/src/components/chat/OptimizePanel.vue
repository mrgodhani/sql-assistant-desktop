<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { renderMarkdown } from '@/lib/markdown'

const props = defineProps<{
  connectionId: string | null
  sql: string
  open: boolean
}>()

const loading = ref(false)
const error = ref<string | null>(null)
const content = ref('')

async function fetchOptimize(): Promise<void> {
  if (!props.connectionId || !props.sql.trim()) return
  loading.value = true
  error.value = null
  content.value = ''
  try {
    content.value = await window.aiApi.optimizeQuery(props.connectionId, props.sql)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to optimize query'
    error.value =
      /connection|not active|reconnect|ECONNREFUSED|ETIMEDOUT/i.test(msg)
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
      fetchOptimize()
    }
  }
)

onMounted(() => {
  if (props.open && props.connectionId && props.sql.trim()) {
    fetchOptimize()
  }
})
</script>

<template>
  <div class="mt-2 rounded-md border border-border bg-muted/20 p-3">
    <div v-if="loading" class="py-4 text-center text-sm text-muted-foreground">
      Running AI optimization...
    </div>
    <div v-else-if="error" class="py-4 text-center text-sm text-destructive">
      {{ error }}
    </div>
    <div
      v-else-if="content"
      class="prose prose-sm dark:prose-invert max-w-none [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm"
      v-html="renderMarkdown(content)"
    />
  </div>
</template>
