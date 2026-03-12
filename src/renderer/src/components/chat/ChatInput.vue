<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Square } from 'lucide-vue-next'
import { useChatStore } from '@renderer/stores/useChatStore'

const chatStore = useChatStore()
const input = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

watch(
  () => chatStore.inputContentForEdit,
  (content) => {
    if (content != null) {
      input.value = content
      chatStore.clearInputContentForEdit()
      nextTick(() => textareaRef.value?.focus())
    }
  }
)

const isStreaming = computed(() => Boolean(chatStore.streamingState))
const canSend = computed(() => {
  const trimmed = input.value.trim()
  return trimmed.length > 0 && !isStreaming.value && Boolean(chatStore.activeConnectionId)
})

function send(): void {
  if (!chatStore.activeConnectionId) return
  const validated = chatStore.validateMessage(input.value.trim())
  if (!validated || validated === 'Message too long') return
  chatStore.sendMessage(validated)
  input.value = ''
  chatStore.clearInputContentForEdit()
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}
</script>

<template>
  <div class="border-t border-border bg-background p-3">
    <div class="flex gap-2">
      <Textarea
        ref="textareaRef"
        v-model="input"
        :placeholder="
          chatStore.activeConnectionId
            ? 'Ask a question about your database... (Enter to send, Shift+Enter for new line)'
            : 'Select a connection above to start'
        "
        class="min-h-12 flex-1 resize-none"
        :disabled="isStreaming || !chatStore.activeConnectionId"
        :aria-label="isStreaming ? 'Waiting for response' : 'Message input'"
        @keydown="onKeydown"
      />
      <Button
        v-if="isStreaming"
        variant="outline"
        size="icon"
        class="h-12 w-12 shrink-0"
        aria-label="Stop generating"
        @click="chatStore.cancelRequest"
      >
        <Square class="size-4" />
      </Button>
      <Button
        v-else
        size="icon"
        class="h-12 w-12 shrink-0"
        :disabled="!canSend"
        aria-label="Send message"
        @click="send"
      >
        <Send class="size-4" />
      </Button>
    </div>
  </div>
</template>
