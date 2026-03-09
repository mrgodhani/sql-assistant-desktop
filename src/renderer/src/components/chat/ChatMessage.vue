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

const chatStore = useChatStore()
const resultsStore = useResultsStore()

async function onRunSql(code: string, blockIndex: number): Promise<void> {
  const result = await resultsStore.executeQuery(
    chatStore.activeConnectionId,
    code,
    props.messageIndex,
    blockIndex
  )
  const messageId = props.message.id
  if (messageId && result.success && result.result) {
    try {
      await window.conversationApi.addGeneratedQuery(messageId, code.trim(), {
        executed: true,
        executionTimeMs: result.result.executionTimeMs,
        rowCount: result.result.rowCount
      })
    } catch {
      // ignore persistence failure
    }
  } else if (messageId && !result.success && result.error) {
    try {
      await window.conversationApi.addGeneratedQuery(messageId, code.trim(), {
        executed: false,
        error: result.error
      })
    } catch {
      // ignore
    }
  }
}

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
const hasError = computed(() => props.message.content.includes('**Error:**'))
</script>

<template>
  <div :class="['flex w-full', isUser ? 'justify-end' : 'justify-start']">
    <div
      :class="[
        'max-w-[85%] rounded-lg px-3 py-2 text-sm',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted',
        hasError && 'border border-destructive/50'
      ]"
    >
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
              <SqlCodeBlock :code="seg.content" :block-index="i" @run="(code) => onRunSql(code, i)" />
              <ResultsPanel
                v-if="resultsStore.getResult(messageIndex, i)"
                :message-index="messageIndex"
                :block-index="i"
                :connection-id="chatStore.activeConnectionId"
              />
            </template>
          </template>
          <span v-if="isStreaming" class="animate-pulse">▌</span>
        </div>
      </template>
    </div>
  </div>
</template>
