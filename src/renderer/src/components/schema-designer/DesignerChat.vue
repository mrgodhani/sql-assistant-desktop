<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useSchemaDesignerStore } from '@renderer/stores/useSchemaDesignerStore'
import DesignerChatMessage from './DesignerChatMessage.vue'
import DesignerChatInput from './DesignerChatInput.vue'

const store = useSchemaDesignerStore()
const scrollRef = ref<HTMLElement | null>(null)

watch(
  () => store.messages.length,
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
