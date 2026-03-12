<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useChatStore } from '@renderer/stores/useChatStore'
import ChatMessages from '@renderer/components/chat/ChatMessages.vue'
import ChatInput from '@renderer/components/chat/ChatInput.vue'
import ChatPromptSuggestions from '@renderer/components/chat/ChatPromptSuggestions.vue'

const route = useRoute()
const chatStore = useChatStore()

async function initChat(): Promise<void> {
  const conversationId = route.params.conversationId as string | undefined
  if (conversationId) {
    await chatStore.loadConversation(conversationId)
  } else if (!chatStore.currentConversation) {
    await chatStore.startNewConversation()
  }
}

onMounted(() => initChat())

watch(
  () => route.params.conversationId,
  () => initChat()
)
</script>

<template>
  <div class="flex h-full flex-col" data-testid="chat-view">
    <ChatMessages v-if="chatStore.currentConversation?.messages.length" />
    <div v-else class="flex flex-1 flex-col items-center justify-center overflow-y-auto">
      <ChatPromptSuggestions />
    </div>
    <ChatInput />
  </div>
</template>
