<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessageSquare, Database, Settings, Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import EmptyState from '@renderer/components/shared/EmptyState.vue'
import SidebarConnectionItem from './SidebarConnectionItem.vue'
import ConversationList from './ConversationList.vue'
import { useConnectionStore } from '@renderer/stores/useConnectionStore'
import { useChatStore } from '@renderer/stores/useChatStore'

const route = useRoute()
const router = useRouter()
const connectionStore = useConnectionStore()
const chatStore = useChatStore()

onMounted(async () => {
  if (!connectionStore.connections.length) {
    await connectionStore.loadConnections()
  }
  await chatStore.loadConversations()
})

async function onNewChat(): Promise<void> {
  await chatStore.startNewConversation()
  router.push('/chat')
}

const navItems = [
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/connections', label: 'Connections', icon: Database },
  { to: '/settings', label: 'Settings', icon: Settings }
]

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}

const activeClasses = computed(() => (path: string) =>
  isActive(path)
    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
)
</script>

<template>
  <aside
    class="flex w-[280px] flex-col border-r border-sidebar-border bg-sidebar-background"
    data-testid="app-sidebar"
  >
    <div class="p-3">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              class="w-full justify-start gap-2 hover:shadow-sm"
              data-testid="sidebar-new-chat-button"
              @click="onNewChat"
            >
              <Plus class="size-4" />
              New Chat
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Start a new conversation</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>

    <nav class="space-y-1 px-2" data-testid="sidebar-nav">
      <router-link
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :class="[
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150',
          activeClasses(item.to)
        ]"
        :data-testid="`sidebar-nav-${item.label.toLowerCase()}`"
      >
        <component :is="item.icon" class="size-4" />
        {{ item.label }}
      </router-link>
    </nav>

    <Separator class="my-2" />

    <ScrollArea class="flex-1 min-h-0 px-2">
      <div v-if="!connectionStore.connections.length" class="py-2">
        <EmptyState message="No connections yet" />
      </div>
      <template v-else>
        <div class="space-y-3 py-2">
          <SidebarConnectionItem
            v-for="conn in connectionStore.connections"
            :key="conn.id"
            :connection="conn"
            :status="connectionStore.getStatus(conn.id).status"
          />
        </div>
      </template>
    </ScrollArea>

    <Separator />

    <ScrollArea class="flex-1 min-h-0 px-2">
      <ConversationList />
    </ScrollArea>
  </aside>
</template>
