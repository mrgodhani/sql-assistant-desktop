<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import ChatMessage from './ChatMessage.vue'
import StreamingIndicator from './StreamingIndicator.vue'
import { useChatStore } from '@renderer/stores/useChatStore'

const chatStore = useChatStore()
const messagesEndRef = ref<HTMLElement | null>(null)

function scrollToBottom(): void {
  nextTick(() => {
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
  })
}

watch(
  () => [
    chatStore.currentConversation?.messages.length,
    chatStore.streamingState?.accumulatedContent
  ],
  scrollToBottom,
  { deep: true }
)
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4">
    <div class="mx-auto max-w-3xl space-y-4">
      <ChatMessage
        v-for="(msg, i) in chatStore.currentConversation?.messages"
        :key="i"
        :message="msg"
        :message-index="i"
        :is-streaming="
          chatStore.streamingState !== null &&
          chatStore.streamingState.messageIndex === i
        "
      />
      <StreamingIndicator v-if="chatStore.streamingState" />
      <div ref="messagesEndRef" />
    </div>
  </div>
</template>
