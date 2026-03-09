<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import Prism from 'prismjs'
import 'prismjs/components/prism-sql'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Check, AlertCircle, Copy, Play } from 'lucide-vue-next'

const props = defineProps<{
  code: string
  blockIndex?: number
  hasConnection?: boolean
  validationResult?: { valid: boolean; error?: string } | null
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
  <div class="my-4 mb-6 overflow-hidden rounded-lg border border-border bg-muted/30">
    <div
      class="relative z-10 flex items-center justify-between border-b border-border px-2 py-1 transition-colors duration-150"
    >
      <div class="flex items-center gap-2">
        <span class="text-xs text-muted-foreground">SQL</span>
        <TooltipProvider v-if="validationResult">
          <Tooltip>
            <TooltipTrigger as-child>
              <span
                v-if="validationResult.valid"
                class="flex items-center text-xs text-green-600 dark:text-green-500"
                aria-label="Valid syntax"
              >
                <Check class="size-3.5" />
              </span>
              <span
                v-else
                class="flex items-center text-xs text-amber-600 dark:text-amber-500"
                aria-label="Invalid syntax"
              >
                <AlertCircle class="size-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {{ validationResult.valid ? 'Valid syntax' : (validationResult.error ?? 'Invalid syntax') }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
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
          :disabled="!hasConnection"
          :aria-label="hasConnection ? 'Run query' : 'Select a connection first'"
          @click="run"
        >
          <Play class="size-3.5" />
          Run
        </Button>
      </div>
    </div>
    <ScrollArea class="max-h-64">
      <pre class="bg-muted/40 p-3 text-sm rounded-b-md"><code ref="codeRef" class="language-sql">{{ code }}</code></pre>
    </ScrollArea>
  </div>
</template>
