<script setup lang="ts">
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import ThemeSettings from '@renderer/components/settings/ThemeSettings.vue'
import ProviderSettings from '@renderer/components/settings/ProviderSettings.vue'
import LogsSettings from '@renderer/components/settings/LogsSettings.vue'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent side="right" class="w-[540px] sm:max-w-[540px]">
      <SheetHeader class="pb-2">
        <SheetTitle>Settings</SheetTitle>
      </SheetHeader>
      <ScrollArea class="h-[calc(100vh-5rem)]">
        <div class="space-y-5 pr-4 pt-2">
          <ThemeSettings />
          <Separator />
          <ProviderSettings />
          <Separator />
          <LogsSettings />
        </div>
      </ScrollArea>
    </SheetContent>
  </Sheet>
</template>
