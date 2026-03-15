<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { Bot } from 'lucide-vue-next'
import { useSchemaDesignerStore } from '@renderer/stores/useSchemaDesignerStore'
import DesignerChatMessage from './DesignerChatMessage.vue'
import DesignerChatInput from './DesignerChatInput.vue'

const store = useSchemaDesignerStore()
const scrollRef = ref<HTMLElement | null>(null)

watch(
  [() => store.messages.length, () => store.isStreaming],
  () => {
    nextTick(() => {
      if (scrollRef.value) {
        scrollRef.value.scrollTop = scrollRef.value.scrollHeight
      }
    })
  }
)

function onApprove(approved: boolean): void {
  store.approveExecution(approved)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div ref="scrollRef" class="flex-1 overflow-y-auto p-4 space-y-4">
      <DesignerChatMessage
        v-for="msg in store.messages"
        :key="msg.id"
        :message="msg"
        @approve="onApprove"
      />

      <!-- Typing bubble: visible while streaming but before first text token arrives -->
      <div
        v-if="store.isStreaming && !store.streamingMessageId"
        class="flex justify-start"
        aria-label="AI is typing"
        role="status"
      >
        <div class="flex items-center gap-3">
          <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
            <Bot class="size-3.5 text-muted-foreground" />
          </div>
          <div class="rounded-lg bg-muted px-4 py-3">
            <div class="flex items-center gap-1">
              <span class="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
              <span class="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
              <span class="size-1.5 rounded-full bg-muted-foreground animate-bounce" />
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="store.error"
        class="rounded-lg bg-destructive/10 border border-destructive/50 p-3 text-sm text-destructive"
      >
        {{ store.error }}
      </div>
      <div
        v-if="!store.messages.length"
        class="flex h-full items-center justify-center text-muted-foreground text-sm"
      >
        Start by describing the database you want to design.
      </div>
    </div>
    <DesignerChatInput />
  </div>
</template>
