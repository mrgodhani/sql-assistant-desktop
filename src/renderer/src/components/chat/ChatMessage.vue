<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChatMessage as ChatMessageType } from '../../../../shared/types'
import MessageActions from './MessageActions.vue'
import MessageContent from './MessageContent.vue'
import MessageHeader from './MessageHeader.vue'
import { useChatStore } from '@renderer/stores/useChatStore'
import { useResultsStore } from '@renderer/stores/useResultsStore'
import { useValidationStore } from '@renderer/stores/useValidationStore'

const props = defineProps<{
  message: ChatMessageType
  messageIndex: number
  isStreaming?: boolean
}>()

const chatStore = useChatStore()
const resultsStore = useResultsStore()
const validationStore = useValidationStore()

const role = computed(() => (props.message.role === 'user' ? 'user' : 'assistant'))
const copied = ref(false)

async function onCopy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.message.content)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // ignore copy failure
  }
}

async function onRunSql(code: string, blockIndex: number): Promise<void> {
  const connectionId =
    chatStore.activeConnectionId ?? chatStore.currentConversation?.connectionId ?? null
  if (!connectionId) return
  const validation = await validationStore.validateSqlBlock(
    connectionId,
    props.messageIndex,
    blockIndex,
    code
  )
  if (!validation.valid) {
    resultsStore.setResult(props.messageIndex, blockIndex, {
      success: false,
      error: validation.error
    })
    return
  }
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

const showRegenerateError = computed(
  () => role.value === 'assistant' && chatStore.regenerateError?.messageIndex === props.messageIndex
)
</script>

<template>
  <div :class="['group flex w-full', role === 'user' ? 'justify-end' : 'justify-start']">
    <div class="flex max-w-[85%] min-w-0 flex-col items-start gap-4">
      <div class="flex items-center gap-2 pb-3 mb-3 border-b border-border/60 w-full">
        <MessageHeader :role="role" :has-error="hasError" />
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
          'rounded-lg px-4 py-3 text-sm',
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
      <p
        v-if="showRegenerateError && chatStore.regenerateError"
        class="mt-2 text-xs text-destructive"
      >
        {{ chatStore.regenerateError.message }}
      </p>
    </div>
  </div>
</template>
