<script setup lang="ts">
import { computed, ref, onMounted, watch, nextTick } from 'vue'
import Prism from 'prismjs'
import 'prismjs/components/prism-sql'
import 'prismjs/themes/prism-tomorrow.css'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, User, Bot, Copy, Check } from 'lucide-vue-next'
import { renderMarkdown } from '@/lib/markdown'
import DDLApprovalCard from './DDLApprovalCard.vue'
import type { DesignerMessage } from '@renderer/stores/useSchemaDesignerStore'

const SQL_BLOCK_REGEX = /```sql\n([\s\S]*?)```/gi

interface Segment {
  type: 'text' | 'sql'
  content: string
}

const props = defineProps<{
  message: DesignerMessage
}>()

const emit = defineEmits<{
  approve: [approved: boolean]
}>()

const isUser = computed(() => props.message.role === 'user')

const segments = computed((): Segment[] => {
  const content = props.message.content
  if (!content) return []

  const result: Segment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  const re = new RegExp(SQL_BLOCK_REGEX.source, 'gi')

  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: 'text', content: content.slice(lastIndex, match.index) })
    }
    result.push({ type: 'sql', content: match[1].trim() })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) {
    result.push({ type: 'text', content: content.slice(lastIndex) })
  }
  if (result.length === 0 && content) {
    result.push({ type: 'text', content })
  }
  return result
})

const codeRefs = ref<(HTMLElement | null)[]>([])

function highlightAll(): void {
  nextTick(() => {
    for (const el of codeRefs.value) {
      if (el) Prism.highlightElement(el)
    }
  })
}

onMounted(highlightAll)
watch(() => props.message.content, highlightAll)

const copiedIndex = ref<number | null>(null)
async function copySql(code: string, index: number): Promise<void> {
  try {
    await navigator.clipboard.writeText(code)
    copiedIndex.value = index
    setTimeout(() => (copiedIndex.value = null), 2000)
  } catch {
    // ignore
  }
}
</script>

<template>
  <div :class="['flex w-full', isUser ? 'justify-end' : 'justify-start']">
    <div :class="['flex max-w-[90%] min-w-0 gap-3', isUser ? 'flex-row-reverse' : 'flex-row']">
      <div
        :class="[
          'flex size-7 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        ]"
      >
        <User v-if="isUser" class="size-3.5" />
        <Bot v-else class="size-3.5" />
      </div>
      <div class="min-w-0 flex-1 space-y-2">
        <!-- User message: plain text -->
        <div v-if="isUser" class="rounded-lg px-4 py-3 text-sm bg-primary text-primary-foreground">
          <p class="whitespace-pre-wrap wrap-break-word">{{ message.content }}</p>
        </div>

        <!-- Assistant message: markdown + SQL blocks -->
        <template v-else>
          <template v-for="(seg, i) in segments" :key="i">
            <div v-if="seg.type === 'text'" class="rounded-lg px-4 py-3 text-sm bg-muted">
              <div
                class="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1 [&_code]:bg-background/50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_p]:mb-2 [&_p:last-child]:mb-0"
                v-html="renderMarkdown(seg.content)"
              />
            </div>

            <div v-else class="overflow-hidden rounded-lg border border-border bg-muted/30">
              <div class="flex items-center justify-between border-b border-border px-2 py-1">
                <span class="text-xs text-muted-foreground">SQL</span>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 gap-1 px-2 text-xs"
                  @click="copySql(seg.content, i)"
                >
                  <Check v-if="copiedIndex === i" class="size-3.5" />
                  <Copy v-else class="size-3.5" />
                  {{ copiedIndex === i ? 'Copied' : 'Copy' }}
                </Button>
              </div>
              <div class="max-h-72 overflow-auto">
                <pre
                  class="bg-muted/40 p-3 text-sm"
                ><code :ref="(el) => { codeRefs[i] = el as HTMLElement }" class="language-sql">{{ seg.content }}</code></pre>
              </div>
            </div>
          </template>
        </template>

        <div
          v-if="message.toolIndicator"
          class="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Loader2 class="size-3 animate-spin" />
          <span>{{ message.toolIndicator }}</span>
        </div>

        <div v-if="message.changelog?.length" class="flex flex-wrap gap-1.5">
          <Badge
            v-for="(change, i) in message.changelog"
            :key="i"
            variant="secondary"
            class="text-xs"
          >
            {{ change }}
          </Badge>
        </div>

        <DDLApprovalCard
          v-if="message.ddlStatements?.length"
          :statements="message.ddlStatements"
          :awaiting-approval="message.awaitingApproval ?? false"
          @approve="(approved) => emit('approve', approved)"
        />
      </div>
    </div>
  </div>
</template>
