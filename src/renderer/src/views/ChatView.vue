<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { PanelLeftClose, PanelLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useChatStore } from '@renderer/stores/useChatStore'
import ChatMessages from '@renderer/components/chat/ChatMessages.vue'
import ChatInput from '@renderer/components/chat/ChatInput.vue'
import ChatPromptSuggestions from '@renderer/components/chat/ChatPromptSuggestions.vue'
import ChatHistoryPanel from '@renderer/components/chat/ChatHistoryPanel.vue'
import AiConfigBar from '@renderer/components/chat/AiConfigBar.vue'

const route = useRoute()
const chatStore = useChatStore()
const historyOpen = ref(true)

async function initChat(): Promise<void> {
  const conversationId = route.params.conversationId as string | undefined
  if (conversationId) {
    await chatStore.loadConversation(conversationId)
  } else if (!chatStore.currentConversation) {
    await chatStore.startNewConversation()
  }
}

function toggleHistory(): void {
  historyOpen.value = !historyOpen.value
}

function onKeydown(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
    e.preventDefault()
    toggleHistory()
  }
}

onMounted(() => {
  initChat()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

watch(
  () => route.params.conversationId,
  () => initChat()
)
</script>

<template>
  <div class="flex h-full" data-testid="chat-view">
    <ChatHistoryPanel v-if="historyOpen" />
    <div class="flex flex-1 flex-col min-w-0">
      <div class="flex items-center border-b border-border px-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="size-8 shrink-0"
                @click="toggleHistory"
              >
                <PanelLeftClose v-if="historyOpen" class="size-4" />
                <PanelLeft v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{{ historyOpen ? 'Hide' : 'Show' }} history (⌘B)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <AiConfigBar />
      </div>
      <ChatMessages v-if="chatStore.currentConversation?.messages.length" />
      <div v-else class="flex flex-1 flex-col items-center justify-center overflow-y-auto">
        <ChatPromptSuggestions />
      </div>
      <ChatInput />
    </div>
  </div>
</template>
