<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { MessageSquare, Trash2, Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

const router = useRouter()
const chatStore = useChatStore()

async function onNewChat(): Promise<void> {
  await chatStore.startNewConversation()
  router.push('/chat')
}

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
  <div class="flex h-full w-[240px] shrink-0 flex-col border-r border-border bg-background">
    <div class="p-2">
      <Button
        variant="outline"
        size="sm"
        class="w-full justify-start gap-2 text-xs"
        @click="onNewChat"
      >
        <Plus class="size-4" />
        New Chat
      </Button>
    </div>
    <ScrollArea class="min-h-0 flex-1">
      <div v-if="chatStore.conversations.length > 0" class="space-y-0.5 p-2">
        <button
          v-for="conv in chatStore.conversations"
          :key="conv.id"
          type="button"
          class="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent/50"
          :class="{
            'bg-accent text-accent-foreground': chatStore.currentConversation?.id === conv.id
          }"
          @click="selectConversation(conv.id)"
        >
          <MessageSquare class="size-3.5 shrink-0 text-muted-foreground" />
          <span class="min-w-0 flex-1 truncate" :title="formatRelativeTime(conv.updatedAt)">{{ conv.title }}</span>
          <Button
            variant="ghost"
            size="icon"
            class="size-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            @click="(e: Event) => deleteConversation(e, conv.id)"
          >
            <Trash2 class="size-3.5" />
          </Button>
        </button>
      </div>
      <p
        v-else
        class="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground"
      >
        No conversations yet
      </p>
    </ScrollArea>
  </div>
</template>
