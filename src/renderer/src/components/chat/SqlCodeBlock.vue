<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import Prism from 'prismjs'
import 'prismjs/components/prism-sql'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Copy, Play } from 'lucide-vue-next'

const props = defineProps<{
  code: string
  blockIndex?: number
}>()

const emit = defineEmits<{
  run: [code: string]
}>()

const codeRef = ref<HTMLElement | null>(null)
const copied = ref(false)

function highlight(): void {
  if (codeRef.value) {
    Prism.highlightElement(codeRef.value)
  }
}

onMounted(highlight)
watch(() => props.code, highlight)

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // ignore
  }
}

function run(): void {
  emit('run', props.code)
}
</script>

<template>
  <div class="my-2 rounded-lg border border-border bg-muted/30">
    <div class="flex items-center justify-between border-b border-border px-2 py-1">
      <span class="text-xs text-muted-foreground">SQL</span>
      <div class="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          class="h-7 gap-1 px-2 text-xs"
          :aria-label="copied ? 'Copied' : 'Copy to clipboard'"
          @click="copy"
        >
          <Copy class="size-3.5" />
          {{ copied ? 'Copied' : 'Copy' }}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="h-7 gap-1 px-2 text-xs"
          aria-label="Run query"
          @click="run"
        >
          <Play class="size-3.5" />
          Run
        </Button>
      </div>
    </div>
    <ScrollArea class="max-h-64">
      <pre class="bg-muted/40 p-3 text-sm"><code ref="codeRef" class="language-sql">{{ code }}</code></pre>
    </ScrollArea>
  </div>
</template>
