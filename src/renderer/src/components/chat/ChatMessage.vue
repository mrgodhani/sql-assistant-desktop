<script setup lang="ts">
import { computed } from 'vue'
import type { ChatMessage as ChatMessageType } from '../../../../shared/types'
import MessageContent from './MessageContent.vue'
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
  const connectionId =
    chatStore.activeConnectionId ?? chatStore.currentConversation?.connectionId ?? null
  const result = await resultsStore.executeQuery(
    connectionId,
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
      <MessageContent
        :message="message"
        :message-index="messageIndex"
        :is-streaming="isStreaming"
        @run="(code, blockIndex) => onRunSql(code, blockIndex)"
      />
    </div>
  </div>
</template>
