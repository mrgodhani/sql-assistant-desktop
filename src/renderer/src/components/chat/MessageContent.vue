<script setup lang="ts">
import { computed } from 'vue'
import type { ChatMessage as ChatMessageType } from '../../../../shared/types'
import { renderMarkdown } from '@/lib/markdown'
import SqlCodeBlock from './SqlCodeBlock.vue'
import ResultsPanel from './ResultsPanel.vue'
import { useChatStore } from '@renderer/stores/useChatStore'
import { useResultsStore } from '@renderer/stores/useResultsStore'

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

const connectionId = computed(
  () =>
    chatStore.activeConnectionId ??
    chatStore.currentConversation?.connectionId ??
    null
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

const isUser = computed(() => props.message.role === 'user')

function onRun(code: string, blockIndex: number): void {
  emit('run', code, blockIndex)
}
</script>

<template>
  <template v-if="isUser">
    <p class="whitespace-pre-wrap">{{ message.content }}</p>
  </template>
  <template v-else>
    <div class="space-y-4">
      <template v-for="(seg, i) in segments" :key="i">
        <div
          v-if="seg.type === 'text'"
          class="prose prose-sm dark:prose-invert max-w-none [&_p]:mb-3"
          v-html="renderMarkdown(seg.content)"
        />
        <template v-else>
          <SqlCodeBlock :code="seg.content" :block-index="i" @run="(code) => onRun(code, i)" />
          <ResultsPanel
            v-if="resultsStore.getResult(messageIndex, i)"
            :message-index="messageIndex"
            :block-index="i"
            :connection-id="connectionId"
          />
        </template>
      </template>
      <span v-if="isStreaming" class="animate-pulse">▌</span>
    </div>
  </template>
</template>
