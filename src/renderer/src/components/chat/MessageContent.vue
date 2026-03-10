<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ChatMessage as ChatMessageType } from '../../../../shared/types'
import { renderMarkdown } from '@/lib/markdown'
import SqlCodeBlock from './SqlCodeBlock.vue'
import ResultsPanel from './ResultsPanel.vue'
import { useChatStore } from '@renderer/stores/useChatStore'
import { useResultsStore } from '@renderer/stores/useResultsStore'
import { useValidationStore } from '@renderer/stores/useValidationStore'

const COLLAPSE_THRESHOLD = 350
const TRUNCATE_LENGTH = 250

const props = defineProps<{
  message: ChatMessageType
  messageIndex: number
  isStreaming?: boolean
}>()

const emit = defineEmits<{
  run: [code: string, blockIndex: number]
}>()

const chatStore = useChatStore()
const resultsStore = useResultsStore()
const validationStore = useValidationStore()

const connectionId = computed(
  () => chatStore.activeConnectionId ?? chatStore.currentConversation?.connectionId ?? null
)

const SQL_BLOCK_REGEX = /```sql\n([\s\S]*?)```/gi

interface Segment {
  type: 'text' | 'sql'
  content: string
}

const segments = computed(() => {
  const content = props.message.content
  const result: Segment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  const re = new RegExp(SQL_BLOCK_REGEX.source, 'gi')
  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index)
      result.push({ type: 'text', content: text })
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

watch(
  () => props.isStreaming,
  (isStreaming, wasStreaming) => {
    if (wasStreaming === true && isStreaming === false && connectionId.value) {
      for (let i = 0; i < segments.value.length; i++) {
        const seg = segments.value[i]
        if (seg.type === 'sql') {
          validationStore.validateSqlBlock(
            connectionId.value!,
            props.messageIndex,
            i,
            seg.content
          )
        }
      }
    }
  }
)

const isUser = computed(() => props.message.role === 'user')

const sqlBlockCount = computed(() => segments.value.filter((s) => s.type === 'sql').length)

function getSqlBlockLabel(segmentIndex: number): string | undefined {
  if (sqlBlockCount.value <= 1) return undefined
  const sqlIndex =
    segments.value
      .slice(0, segmentIndex + 1)
      .filter((s) => s.type === 'sql').length
  return `Query ${sqlIndex}`
}

function onRun(code: string, blockIndex: number): void {
  emit('run', code, blockIndex)
}

const expandedByIndex = ref<Record<number, boolean>>({})

function toggleExpand(i: number): void {
  expandedByIndex.value[i] = !expandedByIndex.value[i]
}

function getProseDisplayContent(seg: Segment, index: number): string {
  if (seg.type !== 'text') return seg.content
  if (seg.content.length <= COLLAPSE_THRESHOLD) return seg.content
  if (expandedByIndex.value[index]) return seg.content
  return seg.content.slice(0, TRUNCATE_LENGTH) + '...'
}

function isProseLong(seg: Segment): boolean {
  return seg.type === 'text' && seg.content.length > COLLAPSE_THRESHOLD
}

function isProseExpanded(index: number): boolean {
  return Boolean(expandedByIndex.value[index])
}
</script>

<template>
  <template v-if="isUser">
    <p class="whitespace-pre-wrap">{{ message.content }}</p>
  </template>
  <template v-else>
    <div class="min-w-0 space-y-8">
      <template v-for="(seg, i) in segments" :key="i">
        <div
          v-if="seg.type === 'text'"
          class="rounded-md border-l-2 border-muted bg-muted/5 pl-3 py-2"
        >
          <div
            class="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_p]:mb-4"
            v-html="renderMarkdown(getProseDisplayContent(seg, i))"
          />
          <button
            v-if="isProseLong(seg)"
            type="button"
            class="mt-2 text-sm text-primary hover:underline"
            @click="toggleExpand(i)"
          >
            {{ isProseExpanded(i) ? 'Show less' : 'Show more' }}
          </button>
        </div>
        <template v-else>
          <div class="mt-4">
            <SqlCodeBlock
              :code="seg.content"
              :block-index="i"
              :block-label="getSqlBlockLabel(i)"
              :has-connection="Boolean(connectionId)"
              :validation-result="validationStore.getValidation(messageIndex, i)"
              @run="(code) => onRun(code, i)"
            />
          </div>
          <div v-if="resultsStore.getResult(messageIndex, i)">
            <span class="text-xs font-medium text-muted-foreground">Results</span>
            <ResultsPanel
              :message-index="messageIndex"
              :block-index="i"
              :connection-id="connectionId"
            />
          </div>
        </template>
      </template>
      <span v-if="isStreaming" class="animate-pulse">▌</span>
    </div>
  </template>
</template>
