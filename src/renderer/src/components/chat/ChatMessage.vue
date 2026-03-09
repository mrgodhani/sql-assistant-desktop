<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChatMessage as ChatMessageType } from '../../../../shared/types'
import MessageActions from './MessageActions.vue'
import MessageContent from './MessageContent.vue'
import MessageHeader from './MessageHeader.vue'
import { useChatStore } from '@renderer/stores/useChatStore'
import { useResultsStore } from '@renderer/stores/useResultsStore'

const props = defineProps<{
  message: ChatMessageType
  messageIndex: number
  isStreaming?: boolean
}>()

const chatStore = useChatStore()
const resultsStore = useResultsStore()

const role = computed(() => (props.message.role === 'user' ? 'user' : 'assistant'))
const copied = ref(false)

async function onCopy(): Promise<void> {
  await navigator.clipboard.writeText(props.message.content)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

async function onRunSql(code: string, blockIndex: number): Promise<void> {
  const connectionId =
    chatStore.activeConnectionId ?? chatStore.currentConversation?.connectionId ?? null
  const result = await resultsStore.executeQuery(connectionId, code, props.messageIndex, blockIndex)
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

const hasError = computed(() => props.message.content.includes('**Error:**'))
</script>

<template>
  <div :class="['group flex w-full', role === 'user' ? 'justify-end' : 'justify-start']">
    <div class="flex max-w-[85%] flex-col items-start gap-1">
      <div class="flex items-center gap-2">
        <MessageHeader :role="role" />
        <MessageActions
          :role="role"
          :is-streaming="isStreaming ?? false"
          :copied="copied"
          @copy="onCopy"
          @regenerate="() => chatStore.regenerateResponse(messageIndex)"
          @edit="() => chatStore.editAndResend(messageIndex)"
        />
      </div>
      <div
        :class="[
          'rounded-lg px-3 py-2 text-sm',
          role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted',
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
  </div>
</template>
