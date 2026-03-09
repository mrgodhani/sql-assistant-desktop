<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { MessageSquare } from 'lucide-vue-next'
import { useChatStore } from '@renderer/stores/useChatStore'
import ChatHeader from '@renderer/components/chat/ChatHeader.vue'
import ChatMessages from '@renderer/components/chat/ChatMessages.vue'
import ChatInput from '@renderer/components/chat/ChatInput.vue'
import EmptyState from '@renderer/components/shared/EmptyState.vue'

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
    <ChatHeader />
    <ChatMessages v-if="chatStore.currentConversation?.messages.length" />
    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center"
    >
      <EmptyState
        :icon="MessageSquare"
        title="Chat"
        message="Connect to a database and start asking questions"
      />
    </div>
    <ChatInput />
  </div>
</template>
