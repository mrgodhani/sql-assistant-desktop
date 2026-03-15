<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessageSquare, Network, PencilRuler, Settings } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import ConnectionPopover from './ConnectionPopover.vue'
import SettingsSheet from './SettingsSheet.vue'

const route = useRoute()
const router = useRouter()
const isMac = computed(() => window.platformApi?.getPlatform() === 'darwin')
const settingsOpen = ref(false)

const tabs = [
  { path: '/chat', label: 'Chat', icon: MessageSquare },
  { path: '/schema', label: 'Schema', icon: Network },
  { path: '/schema-designer', label: 'Designer', icon: PencilRuler }
] as const

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}

function navigate(path: string): void {
  router.push(path)
}
</script>

<template>
  <header
    class="flex h-12 shrink-0 items-center border-b border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60"
    data-testid="app-topbar"
  >
    <div v-if="isMac" class="w-[70px] shrink-0" data-testid="traffic-lights-region" />

    <div class="flex flex-1 items-center justify-between px-4" :class="{ 'app-region-drag': isMac }">
      <nav class="flex items-center gap-1" :class="{ 'app-region-no-drag': isMac }">
        <Button
          v-for="tab in tabs"
          :key="tab.path"
          variant="ghost"
          size="sm"
          class="gap-2 text-sm"
          :class="isActive(tab.path)
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:text-foreground'"
          @click="navigate(tab.path)"
        >
          <component :is="tab.icon" class="size-4" />
          {{ tab.label }}
        </Button>
      </nav>

      <div class="flex items-center gap-1" :class="{ 'app-region-no-drag': isMac }">
        <ConnectionPopover />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="size-8"
                data-testid="settings-button"
                @click="settingsOpen = true"
              >
                <Settings class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  </header>

  <SettingsSheet v-model:open="settingsOpen" />
</template>

<style scoped>
.app-region-drag {
  -webkit-app-region: drag;
}

.app-region-no-drag {
  -webkit-app-region: no-drag;
}
</style>
