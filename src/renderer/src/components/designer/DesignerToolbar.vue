<script setup lang="ts">
import { ref } from 'vue'
import { Plus, Trash2, Clipboard, Download, Check } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useDesignerStore } from '@renderer/stores/useDesignerStore'

const store = useDesignerStore()

const copied = ref(false)

async function handleCopyDDL(): Promise<void> {
  await store.copyDDL()
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function handleClear(): void {
  if (window.confirm('Clear the entire canvas?')) {
    store.clearCanvas()
  }
}
</script>

<template>
  <TooltipProvider :delay-duration="400">
    <div class="flex items-center gap-1 rounded-lg border border-border bg-background/90 backdrop-blur-sm p-1 shadow-md">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon" class="size-8" @click="store.addTable()">
            <Plus class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Add table</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-8"
            :disabled="store.tables.length === 0"
            @click="handleCopyDDL"
          >
            <Check v-if="copied" class="size-4 text-emerald-500" />
            <Clipboard v-else class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ copied ? 'Copied!' : 'Copy DDL' }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-8"
            :disabled="store.tables.length === 0"
            @click="store.exportDDL()"
          >
            <Download class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export DDL (.sql)</TooltipContent>
      </Tooltip>

      <div class="w-px h-5 bg-border mx-0.5" />

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-8 text-muted-foreground hover:text-destructive"
            :disabled="store.tables.length === 0"
            @click="handleClear"
          >
            <Trash2 class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Clear canvas</TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
</template>
