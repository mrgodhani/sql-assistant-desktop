<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { MessageSquare, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@renderer/stores/useChatStore'

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hr ago`
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

const router = useRouter()
const chatStore = useChatStore()

function selectConversation(id: string): void {
  chatStore.loadConversation(id)
  router.push(`/chat/${id}`)
}

async function deleteConversation(e: Event, id: string): Promise<void> {
  e.stopPropagation()
  try {
    await window.conversationApi.delete(id)
    if (chatStore.currentConversation?.id === id) {
      await chatStore.startNewConversation()
      router.push('/chat')
    }
    await chatStore.loadConversations()
  } catch {
    // ignore
  }
}

onMounted(() => chatStore.loadConversations())

watch(
  () => chatStore.currentConversation?.id,
  () => chatStore.loadConversations()
)
</script>

<template>
  <div class="space-y-3 py-2">
    <template v-if="chatStore.conversations.length > 0">
      <button
        v-for="conv in chatStore.conversations"
        :key="conv.id"
        type="button"
        class="group flex w-full items-center gap-2 rounded-md px-3 py-3 text-left text-sm transition-colors duration-150 hover:bg-sidebar-accent/50"
        :class="{
          'bg-sidebar-accent text-sidebar-accent-foreground':
            chatStore.currentConversation?.id === conv.id
        }"
        @click="selectConversation(conv.id)"
      >
        <MessageSquare class="size-4 shrink-0" />
        <span class="min-w-0 flex-1 truncate">{{ conv.title }}</span>
        <span class="shrink-0 text-xs text-muted-foreground">
          {{ formatRelativeTime(conv.updatedAt) }}
        </span>
        <Button
          variant="ghost"
          size="icon"
          class="size-7 shrink-0 opacity-0 transition-opacity duration-150 hover:opacity-100 group-hover:opacity-100"
          @click="(e: Event) => deleteConversation(e, conv.id)"
        >
          <Trash2 class="size-3.5" />
        </Button>
      </button>
    </template>
    <p v-else class="px-3 py-4 text-center text-sm text-muted-foreground">
      No conversations yet
    </p>
  </div>
</template>
