<script setup lang="ts">
import { ref, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Square } from 'lucide-vue-next'
import { useSchemaDesignerStore } from '@renderer/stores/useSchemaDesignerStore'

const store = useSchemaDesignerStore()
const input = ref('')

const canSend = computed(() => input.value.trim().length > 0 && !store.isStreaming)

function send(): void {
  const msg = input.value.trim()
  if (!msg || store.isStreaming) return
  store.sendMessage(msg)
  input.value = ''
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
        v-model="input"
        placeholder="Describe your database schema..."
        class="min-h-12 flex-1 resize-none"
        :disabled="store.isStreaming"
        @keydown="onKeydown"
      />
      <Button
        v-if="store.isStreaming"
        variant="outline"
        size="icon"
        class="h-12 w-12 shrink-0"
        aria-label="Stop generating"
        @click="store.cancel"
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
